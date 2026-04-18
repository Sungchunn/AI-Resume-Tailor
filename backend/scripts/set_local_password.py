"""Set a password on a local user so you can log in via email+password.

Local-only. Refuses to run against non-localhost DBs.

Usage (from backend/):
    PYTHONPATH=. poetry run python scripts/set_local_password.py \
        sungchun.hua@gmail.com devpassword123
"""

from __future__ import annotations

import sys
from urllib.parse import urlparse

from passlib.context import CryptContext
from sqlalchemy import create_engine, text

from app.core.config import get_settings


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit("Usage: set_local_password.py <email> <new_password>")
    email, new_password = sys.argv[1], sys.argv[2]

    settings = get_settings()
    url = settings.database_url_sync or settings.database_url.replace(
        "+asyncpg", "+psycopg2"
    )
    host = urlparse(url.replace("+psycopg2", "")).hostname or ""
    if host not in {"localhost", "127.0.0.1"}:
        sys.exit(f"Refusing: DB host is {host!r}, not localhost.")

    hashed = CryptContext(schemes=["bcrypt"]).hash(new_password)
    eng = create_engine(url)
    with eng.begin() as conn:
        result = conn.execute(
            text(
                "UPDATE users SET hashed_password = :p, auth_provider = 'email' "
                "WHERE email = :e RETURNING id"
            ),
            {"p": hashed, "e": email},
        )
        rows = result.fetchall()

    if not rows:
        sys.exit(f"No local user with email {email!r}.")
    print(f"OK — user id={rows[0][0]} can now log in as {email} / {new_password}")


if __name__ == "__main__":
    main()
