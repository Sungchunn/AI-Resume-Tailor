# Database Rules for Claude

Strict guidelines for all database work in Python (FastAPI/SQLAlchemy) projects.

---

## 1. General Philosophy

### Schema First

- Alembic migrations **must exist before** model code
- Never write model code hoping to auto-generate schema later

### Immutable Migrations

- **Never edit** existing Alembic migration files once applied
- Always create new migrations for changes
- Treat migrations as append-only log

### Migration Versioning

Alembic uses auto-generated revision IDs with descriptive messages:

| Type | Command | Example |
| ----- | ------- | ------- |
| New migration | `alembic revision -m "description"` | `abc123_create_user_preferences.py` |
| Auto-generate | `alembic revision --autogenerate -m "desc"` | Detects model changes |

Alembic tracks migration order via `down_revision` chain in each migration file.

### Naming Conventions

- **Tables**: `snake_case`, plural (`user_profiles`, `job_applications`)
- **Columns**: `snake_case` (`created_at`, `user_id`)
- **Indexes**: `idx_{table}_{column(s)}` (`idx_users_email`)
- **Foreign Keys**: `fk_{table}_{referenced_table}` (`fk_resumes_users`)

---

## 2. PostgreSQL Rules

### Primary Keys

- Use **UUIDv7** (time-sortable) or **BIGINT** with sequence
- Never use simple INT (insufficient range)
- UUIDv7 preferred for distributed systems

### Constraints

- **Foreign Keys**: Always explicit, never implicit relationships
- **NOT NULL**: Default stance; nullable only when justified
- **CHECK constraints**: Use for enum-like values and validation

### Data Types

- **Unstructured data**: Use `JSONB` (not `JSON`)
  - JSONB supports indexing and efficient querying
- **Timestamps**: Use `TIMESTAMPTZ` (timezone-aware)
- **Money**: Use `NUMERIC(precision, scale)`, never `FLOAT`

### Indexing

| Scenario | Index Type |
| ---------- | ------------ |
| Foreign Keys | B-tree (MANDATORY) |
| JSONB columns | GIN |
| Full-text search | GIN with tsvector |
| Geospatial | GIST |
| Composite lookups | B-tree on (col1, col2) |

### Performance (SQLAlchemy)

**Relationship Loading**:

```python
# Default to lazy loading
resumes: Mapped[list["Resume"]] = relationship(lazy="select")

# Use selectinload/joinedload when you KNOW you need related data
from sqlalchemy.orm import selectinload, joinedload
```

**N+1 Prevention**:

```python
# Eager load in query when needed
query = select(User).options(selectinload(User.resumes)).where(User.id == user_id)

# Use joinedload for single related objects
query = select(Resume).options(joinedload(Resume.user)).where(Resume.id == resume_id)
```

**Async Sessions**:

```python
# Use async session for FastAPI
async with async_session() as session:
    result = await session.execute(query)
    return result.scalars().all()
```

### Geospatial (PostGIS)

- Use `Geography(Point, 4326)` for lat/lng coordinates
- Create GIST index: `CREATE INDEX idx_locations_geom ON locations USING GIST(geom);`
- Query with `ST_DWithin()` for radius searches

---

## 3. Redis Rules

### Key Naming

Colon-separated hierarchy: `{service}:{entity}:{id}:{attribute}`

```text
resume-builder:user:550e8400:session
resume-builder:resume:123e4567:pdf_cache
resume-builder:rate_limit:user:550e8400
```

### TTL Policy

- **Mandatory**: Every key must have a TTL
- **Jitter**: Add random offset (e.g., ±10%) to batch expirations

  ```python
  base_ttl = 3600
  jitter = random.randint(-360, 360)
  ttl = base_ttl + jitter
  ```

- Prevents cache stampedes on mass expiration

### Data Structures

| Use Case | Structure |
| ---------- | ----------- |
| Full objects (no partial updates) | STRING with JSON |
| Objects needing partial updates | HASH |
| Queues | LIST |
| Unique collections | SET |
| Leaderboards/sorted data | SORTED SET |

**Prefer HASH over stringified JSON** when you need to update individual fields without fetching the entire object.

---

## Quick Reference

**Alembic Migration Template** (`backend/alembic/versions/<revision>_description.py`):

```python
"""create user preferences

Revision ID: abc123def456
Revises: previous_revision
Create Date: 2026-01-15 10:30:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "abc123def456"
down_revision = "previous_revision"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("metadata", postgresql.JSONB(), server_default=sa.text("'{}'")),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("idx_users_email", "users", ["email"])
    op.create_index("idx_users_metadata", "users", ["metadata"], postgresql_using="gin")


def downgrade() -> None:
    op.drop_index("idx_users_metadata")
    op.drop_index("idx_users_email")
    op.drop_table("users")
```

**Running Migrations**:

```bash
# Apply all pending migrations
poetry run alembic upgrade head

# Rollback last migration
poetry run alembic downgrade -1

# Create a new migration manually
poetry run alembic revision -m "add_user_preferences"

# Auto-generate migration from model changes
poetry run alembic revision --autogenerate -m "add_user_preferences"

# View migration history
poetry run alembic history

# Check current revision
poetry run alembic current
```

**SQLAlchemy Model Template**:

```python
from sqlalchemy import TIMESTAMP, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, server_default=text("gen_random_uuid()"))
    email: Mapped[str] = mapped_column(unique=True, nullable=False)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, server_default=text("'{}'"))
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("NOW()"))
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("NOW()"))
```
