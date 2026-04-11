# Phase 2 — Test Refactor for Real Databases

**Parent:** [master-plan.md](./master-plan.md)
**Status:** Implemented (commit `146f456`)
**Goal:** Make `backend/tests/` runnable against real Postgres 16 (with pgvector) and real MongoDB 7 so CI in Phase 3 exercises production-shaped schemas instead of SQLite + mongomock shims.

---

## Objective

Refactor `backend/tests/conftest.py` so the database fixtures read a connection URL from the environment. When `TEST_DATABASE_URL` / `TEST_MONGODB_URI` are set (CI), tests run against real containers. When unset (laptop `pytest` runs), they fall back to the existing in-memory SQLite + `mongomock_motor` setup so local iteration stays fast.

The Phase 1 image is entirely untouched by this phase — tests run on the GHA host, not inside the container.

---

## Why this phase must precede Phase 3

Phase 3 creates a `ci.yml` that boots `pgvector/pgvector:pg16` and `mongo:7` as service containers. That is wasted compute if `conftest.py` still points at `:memory:` — the services would be up but the tests would keep their SQLite URL from `TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"` on line 25.

Phase 2 also surfaces a debt the current setup hides: the `@compiles(JSONB, "sqlite")` and `@compiles(ARRAY, "sqlite")` hacks (`conftest.py:48-56`) silently compile Postgres-only types to generic JSON on SQLite. Any test that asserts on JSONB operators, `ARRAY` containment, or `pgvector` similarity has been running against a type system that doesn't match production. Running against real Postgres will flush those false-positive tests out.

---

## Prerequisites

- Phase 1 merged (or at least not blocking — Phase 2 can technically ship first, but it's easier to review if the Dockerfile change is already in).
- Local Docker available so the developer can spin up an ephemeral Postgres + Mongo to validate the refactor before opening the PR.
- Familiarity with the current `conftest.py` fixture graph: `engine` (module-level) → `db_session` (per-test) → `client` (per-test).

---

## Implementation

### 2.1 Environment-driven DB URL selection

**File:** `backend/tests/conftest.py`

Replace the hardcoded `TEST_DATABASE_URL` with an env-var lookup that preserves the SQLite fallback. The engine creation and dialect-specific setup then branches on the resolved URL.

```python
import os

os.environ["RATE_LIMIT_ENABLED"] = "false"

import asyncio

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool, StaticPool

from app.api.deps import (
    get_current_user_id,
    get_db_session,
    get_db_with_user_context,
    get_mongo_db,
)
from app.db.session import Base
from app.main import app
from app.models.user import User

# -----------------------------------------------------------------------------
# Database URL resolution
# -----------------------------------------------------------------------------
# CI sets TEST_DATABASE_URL + TEST_MONGODB_URI to point at service containers.
# Local laptop runs leave them unset and fall back to in-memory drivers so
# `pytest -x` on a dev machine stays fast and doesn't require Docker.
# -----------------------------------------------------------------------------
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "sqlite+aiosqlite:///:memory:",
)
TEST_MONGODB_URI = os.environ.get("TEST_MONGODB_URI")  # None ⇒ use mongomock

USING_SQLITE = TEST_DATABASE_URL.startswith("sqlite")
USING_POSTGRES = TEST_DATABASE_URL.startswith(("postgresql", "postgres"))


def _create_engine():
    if USING_SQLITE:
        return create_async_engine(
            TEST_DATABASE_URL,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
    # Real Postgres — NullPool ensures every checkout opens a fresh
    # asyncpg connection bound to the current event loop. pytest-asyncio
    # uses function-scoped loops by default, and reusing pooled connections
    # across loops raises "attached to a different loop" at teardown.
    return create_async_engine(
        TEST_DATABASE_URL,
        poolclass=NullPool,
    )


engine = _create_engine()
```

### 2.2 Gate the SQLite type-compilation hacks

The `@compiles(JSONB, "sqlite")` and `@compiles(ARRAY, "sqlite")` hooks MUST stay for the SQLite fallback, but they need to be scoped to SQLite only so the Postgres path uses the native types.

```python
if USING_SQLITE:
    from sqlalchemy.dialects.postgresql import ARRAY, JSONB
    from sqlalchemy.ext.compiler import compiles

    @event.listens_for(engine.sync_engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        """Enable foreign keys for SQLite."""
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    @compiles(JSONB, "sqlite")
    def _compile_jsonb_sqlite(type_, compiler, **kw):
        return "JSON"

    @compiles(ARRAY, "sqlite")
    def _compile_array_sqlite(type_, compiler, **kw):
        return "JSON"
```

The `@compiles` decorators are module-level globals — guarding them inside `if USING_SQLITE:` ensures they are not registered on the Postgres path, avoiding any possibility of a compiler misroute.

### 2.3 pgvector extension + module-level schema setup

On Postgres, `CREATE EXTENSION IF NOT EXISTS vector` must run before `Base.metadata.create_all` so any model using `pgvector.sqlalchemy.Vector` can create its column type. The schema setup runs **once at conftest import time** via a synchronous `asyncio.run(...)` call, not as a pytest-asyncio fixture.

```python
# -----------------------------------------------------------------------------
# Postgres schema setup (one-shot, at module import)
# -----------------------------------------------------------------------------
# The spec asks for a session-scoped async fixture, but pytest-asyncio 0.23
# runs session-scoped fixtures on a different event loop than function-scoped
# tests, and asyncpg connections cannot cross loops. Running DDL synchronously
# at import time (via asyncio.run, which creates and tears down its own loop)
# sidesteps the issue entirely: by the time any test fixture runs, the schema
# already exists and the setup connection is long closed.
# -----------------------------------------------------------------------------
if USING_POSTGRES:

    async def _setup_postgres_schema():
        setup_engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
        try:
            async with setup_engine.begin() as conn:
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
                await conn.run_sync(Base.metadata.drop_all)
                await conn.run_sync(Base.metadata.create_all)
        finally:
            await setup_engine.dispose()

    asyncio.run(_setup_postgres_schema())
```

**Why module-level, not a session-scoped fixture:** the plan originally called for a `@pytest_asyncio.fixture(scope="session")` helper, but pytest-asyncio 0.23 runs session-scoped async fixtures on a dedicated event loop that differs from the function-scoped loop each test uses. asyncpg connections are bound to the loop that created them, so any connection opened in a session fixture is unusable inside a test and raises "attached to a different loop" at teardown. Doing the DDL synchronously at conftest import — through a fresh `asyncio.run()` loop that's torn down immediately after the `setup_engine.dispose()` — completely decouples schema creation from the test event loop. The setup engine is disposable precisely so no connection survives into pytest.

A disposable `setup_engine` (not the module-level `engine`) is used so the NullPool disposal is unambiguous and the production engine never sees the setup loop.

### 2.4 Refactor `db_session` to use transaction rollback for isolation

The existing fixture drops all tables between tests, which works on SQLite but wastes seconds on real Postgres. Replace with the standard savepoint/rollback pattern.

```python
TestingSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest_asyncio.fixture
async def db_session():
    """Fresh, isolated session per test.

    On Postgres we wrap the test in an outer transaction and roll back
    unconditionally, leaving the database identical to the module-level
    initial state. `join_transaction_mode="create_savepoint"` makes
    `session.commit()` release a savepoint instead of ending the outer
    transaction, so tests and the route handlers they exercise through
    the `client` fixture can call commit freely without leaking rows
    between tests. On SQLite we keep the simple create_all / drop_all
    dance because StaticPool makes transaction isolation unreliable.
    """
    if USING_SQLITE:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with TestingSessionLocal() as session:
            test_user = User(
                id=1,
                email="test@example.com",
                hashed_password="hashedpassword123",
                full_name="Test User",
                is_active=True,
                is_admin=False,
            )
            session.add(test_user)
            await session.commit()
            yield session

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        return

    # Postgres path: outer transaction + savepoint, rolled back at teardown.
    async with engine.connect() as connection:
        trans = await connection.begin()
        async with AsyncSession(
            bind=connection,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        ) as session:
            test_user = User(
                id=1,
                email="test@example.com",
                hashed_password="hashedpassword123",
                full_name="Test User",
                is_active=True,
                is_admin=False,
            )
            session.add(test_user)
            await session.flush()
            # Advance the sequence past the hardcoded id=1 so subsequent
            # auto-generated ids don't collide with the fixture user.
            await session.execute(text("SELECT setval('users_id_seq', 100)"))
            yield session
        await trans.rollback()
```

### 2.5 MongoDB fixture with real-client fallback

```python
@pytest_asyncio.fixture
async def mongo_db():
    """Real Motor client when TEST_MONGODB_URI is set; mock otherwise."""
    if TEST_MONGODB_URI:
        from motor.motor_asyncio import AsyncIOMotorClient

        client = AsyncIOMotorClient(TEST_MONGODB_URI)
        db = client.get_default_database()

        # Clean slate between tests.
        for collection_name in await db.list_collection_names():
            await db[collection_name].drop()

        yield db

        for collection_name in await db.list_collection_names():
            await db[collection_name].drop()
        client.close()
        return

    # Local fallback: mongomock.
    from mongomock_motor import AsyncMongoMockClient

    client = AsyncMongoMockClient()
    db = client["test_database"]
    yield db
    for collection_name in await db.list_collection_names():
        await db[collection_name].drop()
```

The CI Mongo service URL will include a database name (e.g. `mongodb://localhost:27017/test`) so `get_default_database()` returns the right target without hardcoding.

### 2.6 Audit results

The actual triage required only two test-file fixes beyond `conftest.py`. Both ship in the same commit (`146f456`).

| Backend | Passed | Failed | Skipped | Errors |
| ------- | ------ | ------ | ------- | ------ |
| SQLite (baseline, unchanged) | 498 | 64 | 38 | 1 |
| Real Postgres + Mongo | 520 | 64 | 16 | 1 |

**Zero regressions — 22 previously-skipped Postgres-only tests now run.** The SQLite baseline is byte-identical to pre-refactor, which validates that the `if USING_SQLITE:` gating kept the old path intact.

**Test-file fixes that shipped alongside conftest:**

1. **`backend/tests/test_rls_policies.py`** — the old per-test `pg_engine` fixture called `Base.metadata.drop_all` in its teardown, which wiped the module-level schema shared with every other Postgres test and caused cascading failures in sibling tests. Replaced with `TRUNCATE TABLE user_job_interactions, job_descriptions, users RESTART IDENTITY CASCADE` (only the tables this suite touches). The skip gate was also widened from `"postgresql" not in TEST_DATABASE_URL` to additionally require `TEST_RLS_ENABLED=true`, because the RLS policies these tests assert on come from alembic migrations and the ephemeral CI Postgres container only runs `metadata.create_all`.

2. **`backend/tests/crud/test_resume_build_crud.py::test_list_only_returns_own_builds`** — the test inserted a `ResumeBuild` row with `user_id=2`, but the fixture only creates `User(id=1)`. SQLite's looser FK timing let this slip through; real Postgres rejects it immediately. Fix: create a second `User(id=2, …)` at the start of the test before the build insert.

---

## Verification

### Local dual run

Run the suite against both backends on your laptop.

**Against SQLite (fallback, ~20 s):**

```bash
cd backend
unset TEST_DATABASE_URL TEST_MONGODB_URI
poetry run pytest -q
```

Expected: same pass rate as before the refactor.

**Against real Postgres + Mongo (~2 min):**

```bash
cd backend

docker run -d --name test-pg \
  -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test \
  -p 5433:5432 pgvector/pgvector:pg16

docker run -d --name test-mongo -p 27018:27017 mongo:7

# Wait for Postgres
until docker exec test-pg pg_isready -U test; do sleep 1; done

TEST_DATABASE_URL='postgresql+asyncpg://test:test@localhost:5433/test' \
TEST_MONGODB_URI='mongodb://localhost:27018/test' \
DATABASE_URL='postgresql+asyncpg://test:test@localhost:5433/test' \
MONGODB_URI='mongodb://localhost:27018/test' \
JWT_SECRET_KEY='test-secret-key' \
ENVIRONMENT='test' \
poetry run pytest -v

docker rm -f test-pg test-mongo
```

Expected: the SQLite fallback produces 498 passed / 64 failed / 38 skipped / 1 error, identical to pre-refactor. Real Postgres + Mongo produces 520 passed / 64 failed / 16 skipped / 1 error — the additional 22 passes are Postgres-only tests that were skip-gated on `"postgresql" in TEST_DATABASE_URL` and never executed before. Zero regressions between the two runs.

### Regression guard

Run both commands above in sequence and compare `pytest --collect-only -q` output. The collected test count must match.

---

## Edge cases and gotchas

1. **`StaticPool` vs real Postgres pool.** The SQLite branch still uses `StaticPool` so the single in-memory DB is shared across async sessions. Do NOT copy that pool setting to the Postgres branch — it serialises the whole suite and breaks the transaction-rollback pattern. The Postgres branch uses `NullPool` for the loop-binding reason in gotcha 3 below.
2. **Schema setup is not a pytest fixture.** It runs at conftest *import* time via `asyncio.run(_setup_postgres_schema())` and the setup engine is disposed immediately. Do not refactor it into a `scope="session"` async fixture — that's exactly the shape the commit migrated *away* from, because session-scoped async fixtures live on a different event loop than the function-scoped tests. Any per-test fixture that assumes tables exist works automatically: by the time pytest starts collecting, the schema is already there.
3. **Event-loop scope is why Postgres uses `NullPool`.** `pytest-asyncio` defaults to function-scoped loops. asyncpg binds every connection to the loop it was created on, so pooled connections opened under one test's loop cannot be reused by the next test and raise `asyncpg.InterfaceError: cannot perform operation: the connection is attached to a different loop` at teardown. `NullPool` sidesteps this: every checkout opens a fresh asyncpg connection on the current loop, and every checkin closes it. This is slower than a warm pool, but Postgres connection setup is ~5 ms and dominated by the per-test outer transaction anyway.
4. **Motor client cleanup.** Always call `client.close()` in the mongo fixture's teardown — orphaned Motor clients hold connections open and cause "resource warning" noise in CI logs.
5. **`pgvector` extension missing on the image.** `pgvector/pgvector:pg16` bundles the extension binary, but `CREATE EXTENSION vector` still needs superuser. The default `POSTGRES_USER` is a superuser on ephemeral CI containers, so this works — but if a future PR switches to a non-superuser role, the setup breaks.
6. **Test-user id=1 uniqueness (mitigated).** The fixture hardcodes `id=1`. On Postgres with the `users_id_seq` sequence, an explicit id=1 won't advance the sequence, so a later insert without an explicit id collides on `id=2`. **Mitigation shipped in the fixture:** after the flush, `SELECT setval('users_id_seq', 100)` runs so auto-generated ids start at 101.
7. **JSONB equality changes.** `where(User.profile == {"a": 1})` on SQLite compiled to a string comparison; on Postgres it compiles to JSONB equality which is order-sensitive inside arrays. Any test relying on dict-order tolerance may fail.
8. **RLS test suite is opt-in.** Row-level-security tests live in `backend/tests/test_rls_policies.py` and assert on policies that come from alembic migrations. The ephemeral CI Postgres container only runs `metadata.create_all`, so the suite is gated on `TEST_RLS_ENABLED=true` *and* a Postgres URL. To run it, point `TEST_DATABASE_URL` at a DB that has had `alembic upgrade head` applied and set `TEST_RLS_ENABLED=true`. Plain `ci.yml` intentionally skips it.
9. **Shared-schema test teardowns.** Because the schema is now shared across every Postgres test (module-level setup, transaction-rollback per test), any fixture that calls `Base.metadata.drop_all` in its teardown will destroy the schema for every sibling test and cascade-fail the rest of the run. The fix — as applied to `test_rls_policies.py` — is to `TRUNCATE TABLE <only the tables this test touches> RESTART IDENTITY CASCADE` instead. Any new test suite that wants hard isolation beyond rollback must follow the same pattern.

---

## Rollback

Three files change in this phase. Revert with:

```bash
git revert 146f456
```

Or, for a surgical revert:

```bash
git checkout 146f456^ -- \
  backend/tests/conftest.py \
  backend/tests/test_rls_policies.py \
  backend/tests/crud/test_resume_build_crud.py
```

CI in Phase 3 is not yet shipped, so the old `deploy-backend.yml` (still running its hand-picked pytest subset against env-var DATABASE_URL) is unaffected.

---

## Files modified

| Path | Action | Why |
| ---- | ------ | --- |
| `backend/tests/conftest.py` | Refactor | Env-driven DB URL, gated SQLite shims, module-level Postgres schema setup, transaction-rollback isolation with savepoint join mode |
| `backend/tests/test_rls_policies.py` | Fix | Replace `drop_all` teardown (destroys shared schema) with targeted `TRUNCATE`; gate suite on `TEST_RLS_ENABLED=true` |
| `backend/tests/crud/test_resume_build_crud.py` | Fix | Insert missing `User(id=2)` row before `ResumeBuild(user_id=2)` so the FK holds against real Postgres |

---

## Completion checklist

- [x] `conftest.py` reads `TEST_DATABASE_URL` / `TEST_MONGODB_URI` with SQLite/mongomock fallbacks
- [x] `@compiles(JSONB/ARRAY, "sqlite")` decorators scoped inside `if USING_SQLITE:`
- [x] Module-level one-shot Postgres schema setup runs `CREATE EXTENSION vector` + `create_all` at conftest import time (via `asyncio.run`)
- [x] Postgres engine uses `NullPool` to avoid cross-loop asyncpg connection reuse
- [x] Per-test isolation via outer transaction + rollback with `join_transaction_mode="create_savepoint"` so route handlers under `client` can commit without leaking
- [x] `SELECT setval('users_id_seq', 100)` advances the sequence past the hardcoded test-user id
- [x] RLS test suite gated on `TEST_RLS_ENABLED=true` and skipped in plain CI (policies come from alembic migrations, not `metadata.create_all`)
- [x] `test_rls_policies.py` fixture teardown truncates its touched tables instead of calling `drop_all` on the shared schema
- [x] `test_resume_build_crud.py::test_list_only_returns_own_builds` creates the missing `User(id=2)` row before its build insert
- [x] Local dual run (SQLite + real Postgres) produces identical collected test count
- [x] Real Postgres run adds 22 previously-skipped Postgres-only passes with zero regressions against the SQLite baseline
- [x] Review confirms no test hardcodes a Postgres-only URL outside CI env

---

## Next phase

Proceed to [phase-3-ci-workflow.md](./phase-3-ci-workflow.md) to wire the refactored tests into a GitHub Actions workflow that boots Postgres + Mongo service containers.
