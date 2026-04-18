"""Pull ONE user's data (rows they own) from prod into the local Docker stack.

Only the invoking user's rows travel. No other user's data is read or written.
Read-only against prod. Destructive against local:
  * TRUNCATEs local `users` (CASCADE) before importing.
  * Drops the local Mongo resumes / tailored_resumes / resume_builds docs keyed
    on the local user id that was just wiped.
  * Refuses to run if the "local" URLs don't resolve to localhost/127.0.0.1.

Env:
  PROD_DATABASE_URL_SYNC  required. Sync psycopg2 URL to prod Postgres.
  PROD_MONGODB_URI        required. Connection string to prod MongoDB.
  PROD_USER_EMAIL         required. The email of the user to pull.

The local URLs come from app settings (backend/.env).

Typical invocation (from backend/):
  set -a; source .env.prod-backup-20260419; set +a
  PROD_DATABASE_URL_SYNC="$DATABASE_URL_SYNC" \
    PROD_MONGODB_URI="$MONGODB_URI" \
    PROD_USER_EMAIL=sungchun.hua@gmail.com \
    PYTHONPATH=. poetry run python scripts/pull_my_prod_data.py
"""

from __future__ import annotations

import asyncio
import os
import sys
from urllib.parse import urlparse

from motor.motor_asyncio import AsyncIOMotorClient
from psycopg2.extras import Json
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from app.core.config import get_settings

# Postgres tables to copy, in FK-safe insert order.
# (table_name, column that references users.id, other FK columns to null-check).
# Postgres tables with a real FK to users.id that we want to copy, in FK-safe
# insert order. `resumes` was moved to Mongo by migration 20260312_0002, so it is
# deliberately absent here. If any table is missing at runtime (schema drift),
# the copy step logs and skips it.
OWNED_TABLES: list[tuple[str, str]] = [
    ("users", "id"),
    ("job_descriptions", "owner_id"),
    ("resume_builds", "user_id"),
]

# Sample size for the shared `job_listings` table. Keep small — these rows are
# public scraped postings, no PII, but the prod table may have 10k+ rows.
JOB_LISTINGS_LIMIT = int(os.environ.get("JOB_LISTINGS_LIMIT", "200"))

# Mongo collections to copy, all keyed on user_id.
MONGO_COLLECTIONS = ("resumes", "tailored_resumes", "resume_builds")


def _load_prod_env_file() -> dict[str, str]:
    """Parse a dotenv-style file whose values may contain unquoted `&`.

    Shell `source` chokes on that, so we read KEY=VALUE lines ourselves.
    """
    path = os.environ.get("PROD_ENV_FILE")
    if not path:
        return {}
    loaded: dict[str, str] = {}
    with open(path) as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            loaded[key.strip()] = val.strip().strip('"').strip("'")
    return loaded


def _jsonb_columns(conn, table: str) -> set[str]:
    """Return the set of JSONB column names in a local table."""
    rows = conn.execute(
        text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = :t "
            "AND data_type = 'jsonb'"
        ),
        {"t": table},
    )
    return {r[0] for r in rows}


def _wrap_jsonb(row: dict, jsonb_cols: set[str]) -> dict:
    """psycopg2 treats Python list/dict as text[]; Json() forces JSONB."""
    if not jsonb_cols:
        return row
    return {
        k: (Json(v) if k in jsonb_cols and isinstance(v, (dict, list)) else v)
        for k, v in row.items()
    }


def _must_env(name: str, extra: dict[str, str] | None = None) -> str:
    val = os.environ.get(name)
    if not val and extra:
        val = extra.get(name)
    if not val:
        print(f"ERROR: {name} must be set.", file=sys.stderr)
        sys.exit(2)
    return val


def _assert_local(url: str, label: str) -> None:
    host = urlparse(url.replace("+asyncpg", "").replace("+psycopg2", "")).hostname or ""
    if host not in {"localhost", "127.0.0.1"}:
        raise SystemExit(
            f"Refusing: local {label} host is {host!r}, not localhost. "
            f"Check backend/.env."
        )


def _assert_prod(url: str, label: str) -> None:
    host = urlparse(url.replace("+asyncpg", "").replace("+psycopg2", "")).hostname or ""
    if host in {"localhost", "127.0.0.1", ""}:
        raise SystemExit(f"Refusing: prod {label} host looks local: {host!r}.")


def fetch_prod_user_id(prod_engine: Engine, email: str) -> int:
    with prod_engine.connect() as conn:
        row = conn.execute(
            text("SELECT id FROM users WHERE email = :e"), {"e": email}
        ).first()
    if row is None:
        raise SystemExit(f"No prod user with email {email!r}. Nothing to do.")
    return int(row[0])


def copy_postgres(prod_engine: Engine, local_engine: Engine, user_id: int) -> None:
    print(f"[pg] pulling rows for user_id={user_id} from prod")

    # Pull from prod as dict rows per table.
    pulled: dict[str, list[dict]] = {}
    with prod_engine.connect() as pconn:
        for table, user_col in OWNED_TABLES:
            exists = pconn.execute(
                text("SELECT to_regclass(:t) IS NOT NULL"), {"t": f"public.{table}"}
            ).scalar()
            if not exists:
                print(f"[pg]   {table}: skipped (table not in prod)")
                pulled[table] = []
                continue
            stmt = text(f"SELECT * FROM {table} WHERE {user_col} = :uid")  # noqa: S608 — table/col fixed list
            rows = [dict(r._mapping) for r in pconn.execute(stmt, {"uid": user_id})]
            pulled[table] = rows
            print(f"[pg]   {table}: {len(rows)} row(s)")

    if not pulled["users"]:
        raise SystemExit("Prod user row not found after id lookup — aborting.")

    # Wipe + reinsert locally.
    with local_engine.begin() as lconn:
        print("[pg] TRUNCATE users CASCADE (local)")
        lconn.execute(text("TRUNCATE TABLE users RESTART IDENTITY CASCADE"))

        for table, _ in OWNED_TABLES:
            rows = pulled[table]
            if not rows:
                continue
            jsonb_cols = _jsonb_columns(lconn, table)
            cols = list(rows[0].keys())
            col_list = ", ".join(cols)
            placeholders = ", ".join(f":{c}" for c in cols)
            insert_sql = text(
                f"INSERT INTO {table} ({col_list}) VALUES ({placeholders})"  # noqa: S608
            )
            for row in rows:
                lconn.execute(insert_sql, _wrap_jsonb(row, jsonb_cols))
            print(f"[pg] inserted {len(rows)} into local {table}")

        # Pull shared job_listings + the user's interactions with them.
        listings_count = _copy_job_listings_and_interactions(
            prod_engine=prod_engine, lconn=lconn, user_id=user_id
        )

        # Reset sequences so future inserts don't collide with imported IDs.
        sequence_tables = [t for t, _ in OWNED_TABLES]
        if listings_count:
            sequence_tables.extend(["job_listings", "user_job_interactions"])
        for table in sequence_tables:
            if table in pulled and not pulled[table]:
                continue
            # pg_get_serial_sequence returns NULL if there's no sequence (e.g. UUID PK).
            lconn.execute(
                text(
                    f"""
                    SELECT setval(
                        pg_get_serial_sequence('{table}', 'id'),
                        COALESCE((SELECT MAX(id) FROM {table}), 1),
                        (SELECT MAX(id) FROM {table}) IS NOT NULL
                    )
                    WHERE pg_get_serial_sequence('{table}', 'id') IS NOT NULL
                    """
                )
            )


def _copy_job_listings_and_interactions(
    prod_engine: Engine, lconn, user_id: int
) -> int:
    """Pull a recent sample of shared job_listings + the user's interactions."""
    with prod_engine.connect() as pconn:
        exists = pconn.execute(
            text("SELECT to_regclass('public.job_listings') IS NOT NULL")
        ).scalar()
        if not exists:
            print("[pg]   job_listings: skipped (table not in prod)")
            return 0

        listings = [
            dict(r._mapping)
            for r in pconn.execute(
                text(
                    "SELECT * FROM job_listings ORDER BY created_at DESC NULLS LAST LIMIT :n"
                ),
                {"n": JOB_LISTINGS_LIMIT},
            )
        ]
        print(f"[pg]   job_listings: {len(listings)} row(s) (limit {JOB_LISTINGS_LIMIT})")

        interactions: list[dict] = []
        if listings:
            listing_ids = [row["id"] for row in listings]
            interactions_exists = pconn.execute(
                text("SELECT to_regclass('public.user_job_interactions') IS NOT NULL")
            ).scalar()
            if interactions_exists:
                interactions = [
                    dict(r._mapping)
                    for r in pconn.execute(
                        text(
                            "SELECT * FROM user_job_interactions "
                            "WHERE user_id = :uid AND job_listing_id = ANY(:ids)"
                        ),
                        {"uid": user_id, "ids": listing_ids},
                    )
                ]
                print(f"[pg]   user_job_interactions: {len(interactions)} row(s)")

    # Wipe local and insert. TRUNCATE CASCADE because interactions FK to listings.
    lconn.execute(text("TRUNCATE TABLE job_listings RESTART IDENTITY CASCADE"))
    for table, rows in (
        ("job_listings", listings),
        ("user_job_interactions", interactions),
    ):
        if not rows:
            continue
        jsonb_cols = _jsonb_columns(lconn, table)
        cols = list(rows[0].keys())
        col_list = ", ".join(cols)
        placeholders = ", ".join(f":{c}" for c in cols)
        stmt = text(f"INSERT INTO {table} ({col_list}) VALUES ({placeholders})")  # noqa: S608
        for row in rows:
            lconn.execute(stmt, _wrap_jsonb(row, jsonb_cols))
        print(f"[pg] inserted {len(rows)} into local {table}")
    return len(listings)


async def copy_mongo(
    prod_uri: str, local_uri: str, local_db_name: str, user_id: int
) -> None:
    prod_client = AsyncIOMotorClient(prod_uri, serverSelectionTimeoutMS=10000)
    local_client = AsyncIOMotorClient(local_uri, serverSelectionTimeoutMS=5000)
    try:
        prod_db_name = urlparse(prod_uri).path.lstrip("/") or "resume_tailor"
        prod_db = prod_client[prod_db_name]
        local_db = local_client[local_db_name]

        for coll_name in MONGO_COLLECTIONS:
            deleted = await local_db[coll_name].delete_many({"user_id": user_id})
            print(f"[mongo] local {coll_name}: cleared {deleted.deleted_count} doc(s)")

            cursor = prod_db[coll_name].find({"user_id": user_id})
            docs = [doc async for doc in cursor]
            if docs:
                await local_db[coll_name].insert_many(docs)
            print(f"[mongo] copied {len(docs)} doc(s) into local {coll_name}")
    finally:
        prod_client.close()
        local_client.close()


async def main() -> None:
    prod_env = _load_prod_env_file()
    prod_pg = os.environ.get("PROD_DATABASE_URL_SYNC") or prod_env.get(
        "DATABASE_URL_SYNC", ""
    )
    prod_mongo = os.environ.get("PROD_MONGODB_URI") or prod_env.get("MONGODB_URI", "")
    prod_email = _must_env("PROD_USER_EMAIL")
    if not prod_pg:
        sys.exit("ERROR: PROD_DATABASE_URL_SYNC (or DATABASE_URL_SYNC in PROD_ENV_FILE) required.")
    if not prod_mongo:
        sys.exit("ERROR: PROD_MONGODB_URI (or MONGODB_URI in PROD_ENV_FILE) required.")

    settings = get_settings()
    local_pg = settings.database_url_sync or settings.database_url.replace(
        "+asyncpg", "+psycopg2"
    )
    local_mongo = settings.mongodb_uri
    local_mongo_db = settings.mongodb_database

    _assert_prod(prod_pg, "DATABASE_URL")
    _assert_prod(prod_mongo, "MONGODB_URI")
    _assert_local(local_pg, "DATABASE_URL_SYNC")
    _assert_local(local_mongo, "MONGODB_URI")

    print(f"Pulling user {prod_email!r} from prod.")
    print("  prod PG:", urlparse(prod_pg).hostname)
    print("  prod Mongo:", urlparse(prod_mongo).hostname)
    print("  → local PG:", urlparse(local_pg).hostname)
    print("  → local Mongo:", urlparse(local_mongo).hostname)
    print()

    prod_engine = create_engine(prod_pg.replace("postgresql://", "postgresql+psycopg2://"))
    local_engine = create_engine(local_pg)
    try:
        user_id = fetch_prod_user_id(prod_engine, prod_email)
        copy_postgres(prod_engine, local_engine, user_id)
        await copy_mongo(prod_mongo, local_mongo, local_mongo_db, user_id)
        print()
        print(f"Done. Local user id={user_id}, email={prod_email}.")
        print("Log in locally with your production password (copied as-is).")
    finally:
        prod_engine.dispose()
        local_engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
