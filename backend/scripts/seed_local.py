"""Seed one dummy user + one dummy resume into local Postgres and MongoDB.

Run from the repo root with:
    cd backend && poetry run python scripts/seed_local.py

Idempotent: re-running updates the existing dummy records instead of duplicating.
Safe-by-default: refuses to run unless the configured database URLs point at localhost,
so it can never touch production.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from urllib.parse import urlparse

from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import User

DUMMY_EMAIL = "dev@example.com"
DUMMY_PASSWORD = "devpassword123"
DUMMY_TITLE = "Dummy Resume"

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _assert_local(url: str, label: str) -> None:
    host = urlparse(url.replace("+asyncpg", "").replace("+psycopg2", "")).hostname or ""
    if host not in {"localhost", "127.0.0.1", "postgres", "mongodb"}:
        raise SystemExit(f"Refusing to seed: {label} points at {host!r}, not a local host.")


def seed_user(sync_url: str) -> int:
    engine = create_engine(sync_url)
    with Session(engine) as s:
        user = s.execute(select(User).where(User.email == DUMMY_EMAIL)).scalar_one_or_none()
        if user is None:
            user = User(
                email=DUMMY_EMAIL,
                hashed_password=pwd_ctx.hash(DUMMY_PASSWORD),
                full_name="Jane Dev",
                is_active=True,
                is_admin=True,
                auth_provider="email",
                headline="Software Engineer",
            )
            s.add(user)
            s.commit()
            s.refresh(user)
            print(f"[postgres] created user id={user.id} email={user.email}")
        else:
            print(f"[postgres] user already exists id={user.id}")
        return user.id


async def seed_mongo_resume(mongo_uri: str, db_name: str, user_id: int) -> None:
    client = AsyncIOMotorClient(mongo_uri, serverSelectionTimeoutMS=5000)
    db = client[db_name]
    now = datetime.now(timezone.utc)
    doc = {
        "user_id": user_id,
        "title": DUMMY_TITLE,
        "is_master": True,
        "raw_content": "Jane Dev\nSoftware Engineer\nShipped things at Acme.",
        "html_content": None,
        "parsed": {
            "contact": {"name": "Jane Dev", "email": DUMMY_EMAIL},
            "summary": "Dummy summary for local UI testing.",
            "experience": [
                {
                    "id": "exp-1",
                    "title": "Software Engineer",
                    "company": "Acme",
                    "location": "Remote",
                    "start_date": "2024-01",
                    "end_date": "Present",
                    "bullets": ["Shipped features.", "Fixed bugs."],
                }
            ],
            "education": [],
            "skills": ["Python", "TypeScript"],
            "certifications": [],
            "projects": [],
            "languages": [],
            "volunteer": [],
            "publications": [],
            "awards": [],
            "references": [],
            "courses": [],
            "memberships": [],
            "leadership": [],
        },
        "style": None,
        "original_file": None,
        "parsed_verified": True,
        "parsed_verified_at": now,
        "version": 1,
        "updated_at": now,
    }

    existing = await db.resumes.find_one(
        {"user_id": user_id, "title": DUMMY_TITLE}, {"_id": 1}
    )
    if existing:
        await db.resumes.update_one({"_id": existing["_id"]}, {"$set": doc})
        print(f"[mongo] updated resume _id={existing['_id']}")
    else:
        doc["created_at"] = now
        res = await db.resumes.insert_one(doc)
        print(f"[mongo] inserted resume _id={res.inserted_id}")

    client.close()


async def main() -> None:
    settings = get_settings()
    sync_url = settings.database_url_sync or settings.database_url.replace(
        "+asyncpg", "+psycopg2"
    )
    _assert_local(sync_url, "DATABASE_URL_SYNC")
    _assert_local(settings.mongodb_uri, "MONGODB_URI")

    user_id = seed_user(sync_url)
    await seed_mongo_resume(settings.mongodb_uri, settings.mongodb_database, user_id)

    print()
    print("Seed complete. Local login:")
    print(f"  email:    {DUMMY_EMAIL}")
    print(f"  password: {DUMMY_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(main())
