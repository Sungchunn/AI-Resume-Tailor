# Phase 2 — Test Refactor for Real Databases

**Parent:** [master-plan.md](./master-plan.md)
**Status:** Planning
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

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

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
    # Real Postgres — use the default pool so concurrent fixtures don't
    # serialise on StaticPool, but keep it small for CI.
    return create_async_engine(
        TEST_DATABASE_URL,
        pool_size=5,
        max_overflow=0,
        pool_pre_ping=True,
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

### 2.3 pgvector extension + schema fixture

On Postgres, `CREATE EXTENSION IF NOT EXISTS vector` must run before `Base.metadata.create_all` so any model using `pgvector.sqlalchemy.Vector` can create its column type.

```python
@pytest_asyncio.fixture(scope="session")
async def _prepare_schema():
    """Session-scoped: enable pgvector (Postgres only) and create tables once."""
    async with engine.begin() as conn:
        if USING_POSTGRES:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)

    yield

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
```

**Why session scope, not function scope:** recreating the schema on every test adds ~200 ms × N tests of Postgres DDL overhead. Running once per session cuts CI time dramatically. Per-test isolation is instead achieved at the row level via the transaction-rollback pattern in 2.4.

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
async def db_session(_prepare_schema):
    """Fresh, isolated session per test.

    On Postgres we wrap the test in an outer transaction and roll back
    unconditionally, leaving the database identical to its session-scoped
    initial state. On SQLite we keep the simple create_all / drop_all
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
        async with AsyncSession(bind=connection, expire_on_commit=False) as session:
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

### 2.6 Pre-flight audit: tests at risk

Before opening the Phase 3 PR, run `pytest` against real Postgres locally and triage failures into three buckets:

- **Fix immediately** — test assertions that were passing against the JSON-shim compile of JSONB but fail against real `->`/`->>` operators.
- **Mark `@pytest.mark.skip(reason="...")`** with a linked issue — tests that require pgvector similarity ops we haven't implemented yet.
- **Silent hit** — tests that used the SQLite-only `ARRAY → JSON` compile and never exercised real ARRAY containment. These should pass on Postgres without changes.

Document the audit results at the top of the Phase 2 PR description. Budget one working day for this triage.

**Known suspect files** (from a grep of `JSONB` / `ARRAY` / `Vector` model usage):

- `tests/services/ats/*` — ATS scoring touches JSONB-backed keyword lists.
- `tests/services/test_semantic_matching.py` (if present) — vector similarity.
- Any test that constructs a model with `jsonb_field = [...]` literal.

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

Expected: identical pass list, minus any tests you triaged in 2.6. If a test only passes on SQLite, the refactor revealed a real schema bug — fix it, don't paper over.

### Regression guard

Run both commands above in sequence and compare `pytest --collect-only -q` output. The collected test count must match.

---

## Edge cases and gotchas

1. **`StaticPool` vs real Postgres pool.** The SQLite branch still uses `StaticPool` so the single in-memory DB is shared across async sessions. Do NOT copy that pool setting to the Postgres branch — it serialises the whole suite and breaks the transaction-rollback pattern.
2. **Session-scoped fixture ordering.** `_prepare_schema` must run before any per-test fixture that assumes tables exist. Depending on it explicitly in `db_session` (see 2.4) makes pytest resolve the order correctly.
3. **Event-loop scope.** `pytest-asyncio` defaults to function-scoped loops. Session-scoped fixtures that touch the engine need either `asyncio_mode = auto` in `pyproject.toml` (verify it's set) or an explicit `loop_scope="session"` marker. If unsure, test by running a session-scoped fixture on its own and watching for `RuntimeError: Event loop is closed`.
4. **Motor client cleanup.** Always call `client.close()` in the mongo fixture's teardown — orphaned Motor clients hold connections open and cause "resource warning" noise in CI logs.
5. **`pgvector` extension missing on the image.** `pgvector/pgvector:pg16` bundles the extension binary, but `CREATE EXTENSION vector` still needs superuser. The default `POSTGRES_USER` is a superuser on ephemeral CI containers, so this works — but if a future PR switches to a non-superuser role, the fixture breaks.
6. **Test-user id=1 uniqueness.** The fixture hardcodes `id=1`. On Postgres with the `users_id_seq` sequence, an explicit id=1 won't advance the sequence, so a later test that creates a user without an explicit id may collide on `id=2`. Mitigation: after inserting the fixture user, run `SELECT setval('users_id_seq', 100)` so auto-generated ids start at 101.
7. **JSONB equality changes.** `where(User.profile == {"a": 1})` on SQLite compiled to a string comparison; on Postgres it compiles to JSONB equality which is order-sensitive inside arrays. Any test relying on dict-order tolerance may fail.

---

## Rollback

`conftest.py` is the only file that changes. Revert with:

```bash
git checkout HEAD~1 -- backend/tests/conftest.py
```

CI in Phase 3 is not yet shipped, so the old `deploy-backend.yml` (still running its hand-picked pytest subset against env-var DATABASE_URL) is unaffected.

---

## Files modified

| Path | Action | Why |
| ---- | ------ | --- |
| `backend/tests/conftest.py` | Refactor | Env-driven DB URL, gated SQLite shims, pgvector fixture, transaction-rollback isolation |
| `backend/pyproject.toml` | Optional touch | Add `asyncio_mode = "auto"` under `[tool.pytest.ini_options]` if missing |
| Individual test files | Fix as needed | Per the 2.6 audit — JSONB/ARRAY/vector breakage only |

---

## Completion checklist

- [ ] `conftest.py` reads `TEST_DATABASE_URL` / `TEST_MONGODB_URI` with SQLite/mongomock fallbacks
- [ ] `@compiles(JSONB/ARRAY, "sqlite")` decorators scoped inside `if USING_SQLITE:`
- [ ] Session-scoped `_prepare_schema` fixture runs `CREATE EXTENSION vector` on Postgres
- [ ] Per-test isolation via outer transaction + rollback on Postgres
- [ ] Local dual run (SQLite + real Postgres) produces identical collected test count
- [ ] Audit of JSONB/ARRAY/vector-sensitive tests documented in PR description
- [ ] Any newly failing tests either fixed or explicitly skip-marked with a linked issue
- [ ] `pytest --collect-only` count unchanged
- [ ] Review confirms no test hardcodes a Postgres-only URL outside CI env

---

## Next phase

Proceed to [phase-3-ci-workflow.md](./phase-3-ci-workflow.md) to wire the refactored tests into a GitHub Actions workflow that boots Postgres + Mongo service containers.
