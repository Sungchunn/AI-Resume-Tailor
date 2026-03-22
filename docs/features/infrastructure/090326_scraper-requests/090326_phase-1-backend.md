# Phase 1: Backend Implementation

**Parent:** [Master Plan](./090326_master-plan.md)

## 1.1 Database Model

**File:** `/backend/app/models/scraper_request.py`

```python
class RequestStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ScraperRequest(Base):
    __tablename__ = "scraper_requests"

    id = Column(Integer, primary_key=True, index=True)

    # Requester
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Request data
    url = Column(Text, nullable=False)
    name = Column(String(100), nullable=True)       # User-suggested preset name
    reason = Column(Text, nullable=True)            # Why they want these jobs

    # Status
    status = Column(SQLAlchemyEnum(RequestStatus), nullable=False, default=RequestStatus.PENDING)
    admin_notes = Column(Text, nullable=True)       # Rejection reason or approval notes

    # Admin review
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    # Link to created preset (if approved)
    preset_id = Column(Integer, ForeignKey("scraper_presets.id"), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    preset = relationship("ScraperPreset")
```

**Update:** `/backend/app/models/__init__.py`

```python
from app.models.scraper_request import ScraperRequest, RequestStatus

__all__ = [
    # ... existing exports ...
    "ScraperRequest",
    "RequestStatus",
]
```

## 1.2 Migration

**File:** `/backend/alembic/versions/YYYYMMDD_add_scraper_requests.py`

```python
def upgrade() -> None:
    op.create_table(
        "scraper_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("name", sa.String(100), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("status", sa.Enum("pending", "approved", "rejected", name="requeststatus"), nullable=False),
        sa.Column("admin_notes", sa.Text(), nullable=True),
        sa.Column("reviewed_by", sa.Integer(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("preset_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["preset_id"], ["scraper_presets.id"]),
    )
    op.create_index("ix_scraper_requests_id", "scraper_requests", ["id"])
    op.create_index("ix_scraper_requests_user_id", "scraper_requests", ["user_id"])
    op.create_index("ix_scraper_requests_status", "scraper_requests", ["status"])


def downgrade() -> None:
    op.drop_table("scraper_requests")
    op.execute("DROP TYPE requeststatus")
```

## 1.3 Schemas

**File:** `/backend/app/schemas/scraper.py` - Add to existing file:

```python
from enum import Enum

class RequestStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


# User-facing schemas
class ScraperRequestCreate(BaseModel):
    url: str = Field(..., min_length=1)
    name: str | None = Field(default=None, max_length=100)
    reason: str | None = Field(default=None, max_length=500)

    @field_validator("url")
    @classmethod
    def validate_linkedin_url(cls, v: str) -> str:
        parsed = urlparse(v)
        if parsed.scheme not in ("http", "https"):
            raise ValueError("URL must use http or https")
        domain = parsed.netloc.lower()
        if domain not in ("linkedin.com", "www.linkedin.com"):
            raise ValueError("URL must be from linkedin.com")
        if not parsed.path.lower().startswith("/jobs"):
            raise ValueError("URL must be a LinkedIn jobs URL")
        return v


class ScraperRequestResponse(BaseModel):
    id: int
    url: str
    name: str | None
    reason: str | None
    status: RequestStatus
    admin_notes: str | None
    created_at: datetime
    updated_at: datetime | None
    reviewed_at: datetime | None
    preset_id: int | None

    model_config = {"from_attributes": True}


class ScraperRequestListResponse(BaseModel):
    requests: list[ScraperRequestResponse]
    total: int


# Admin schemas
class ScraperRequestAdminResponse(ScraperRequestResponse):
    user_id: int
    user_email: str
    reviewed_by: int | None
    reviewer_email: str | None


class ScraperRequestAdminListResponse(BaseModel):
    requests: list[ScraperRequestAdminResponse]
    total: int


class ScraperRequestApproveRequest(BaseModel):
    admin_notes: str | None = None
    create_preset: bool = True
    preset_name: str | None = Field(default=None, max_length=100)
    preset_count: int = Field(default=100, ge=1, le=500)
    preset_is_active: bool = True


class ScraperRequestRejectRequest(BaseModel):
    admin_notes: str = Field(..., min_length=1, max_length=500)
```

## 1.4 Repository

**File:** `/backend/app/crud/scraper_request.py`

```python
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.scraper_request import ScraperRequest, RequestStatus
from app.models.user import User


class ScraperRequestRepository:

    async def create(
        self,
        db: AsyncSession,
        *,
        user_id: int,
        url: str,
        name: str | None = None,
        reason: str | None = None,
    ) -> ScraperRequest:
        db_obj = ScraperRequest(
            user_id=user_id,
            url=url,
            name=name,
            reason=reason,
            status=RequestStatus.PENDING,
        )
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def get(self, db: AsyncSession, request_id: int) -> ScraperRequest | None:
        result = await db.execute(
            select(ScraperRequest).where(ScraperRequest.id == request_id)
        )
        return result.scalar_one_or_none()

    async def get_with_user(self, db: AsyncSession, request_id: int) -> ScraperRequest | None:
        result = await db.execute(
            select(ScraperRequest)
            .options(selectinload(ScraperRequest.user), selectinload(ScraperRequest.reviewer))
            .where(ScraperRequest.id == request_id)
        )
        return result.scalar_one_or_none()

    async def list_by_user(
        self,
        db: AsyncSession,
        user_id: int,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[ScraperRequest], int]:
        # Count
        count_result = await db.execute(
            select(func.count(ScraperRequest.id)).where(ScraperRequest.user_id == user_id)
        )
        total = count_result.scalar_one()

        # List
        result = await db.execute(
            select(ScraperRequest)
            .where(ScraperRequest.user_id == user_id)
            .order_by(ScraperRequest.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all()), total

    async def list_all(
        self,
        db: AsyncSession,
        status: RequestStatus | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[ScraperRequest], int]:
        base_query = select(ScraperRequest)
        count_query = select(func.count(ScraperRequest.id))

        if status:
            base_query = base_query.where(ScraperRequest.status == status)
            count_query = count_query.where(ScraperRequest.status == status)

        count_result = await db.execute(count_query)
        total = count_result.scalar_one()

        result = await db.execute(
            base_query
            .options(selectinload(ScraperRequest.user), selectinload(ScraperRequest.reviewer))
            .order_by(ScraperRequest.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all()), total

    async def approve(
        self,
        db: AsyncSession,
        *,
        request_id: int,
        admin_id: int,
        preset_id: int | None = None,
        admin_notes: str | None = None,
    ) -> ScraperRequest | None:
        request = await self.get(db, request_id)
        if not request or request.status != RequestStatus.PENDING:
            return None

        request.status = RequestStatus.APPROVED
        request.reviewed_by = admin_id
        request.reviewed_at = func.now()
        request.preset_id = preset_id
        request.admin_notes = admin_notes

        await db.flush()
        await db.refresh(request)
        return request

    async def reject(
        self,
        db: AsyncSession,
        *,
        request_id: int,
        admin_id: int,
        admin_notes: str,
    ) -> ScraperRequest | None:
        request = await self.get(db, request_id)
        if not request or request.status != RequestStatus.PENDING:
            return None

        request.status = RequestStatus.REJECTED
        request.reviewed_by = admin_id
        request.reviewed_at = func.now()
        request.admin_notes = admin_notes

        await db.flush()
        await db.refresh(request)
        return request

    async def cancel(
        self,
        db: AsyncSession,
        request_id: int,
        user_id: int,
    ) -> bool:
        request = await self.get(db, request_id)
        if not request:
            return False
        if request.user_id != user_id:
            return False
        if request.status != RequestStatus.PENDING:
            return False

        await db.delete(request)
        await db.flush()
        return True


scraper_request_repository = ScraperRequestRepository()
```

## 1.5 User API Routes

**File:** `/backend/app/api/routes/scraper_requests.py`

```python
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session, get_current_user
from app.models.user import User
from app.crud.scraper_request import scraper_request_repository
from app.schemas.scraper import (
    ScraperRequestCreate,
    ScraperRequestResponse,
    ScraperRequestListResponse,
)

router = APIRouter(prefix="/scraper-requests", tags=["scraper-requests"])


@router.post("", response_model=ScraperRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_request(
    data: ScraperRequestCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ScraperRequestResponse:
    """Submit a new scraper request."""
    db_request = await scraper_request_repository.create(
        db,
        user_id=current_user.id,
        url=data.url,
        name=data.name,
        reason=data.reason,
    )
    await db.commit()
    return ScraperRequestResponse.model_validate(db_request)


@router.get("", response_model=ScraperRequestListResponse)
async def list_my_requests(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ScraperRequestListResponse:
    """List my submitted requests."""
    requests, total = await scraper_request_repository.list_by_user(
        db, user_id=current_user.id, limit=limit, offset=offset
    )
    return ScraperRequestListResponse(
        requests=[ScraperRequestResponse.model_validate(r) for r in requests],
        total=total,
    )


@router.delete("/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_request(
    request_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> None:
    """Cancel a pending request."""
    deleted = await scraper_request_repository.cancel(
        db, request_id=request_id, user_id=current_user.id
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found or cannot be cancelled",
        )
    await db.commit()
```

**Register router in:** `/backend/app/api/routes/__init__.py`

## 1.6 Admin API Routes

**File:** `/backend/app/api/routes/admin.py` - Add these endpoints:

```python
from app.crud.scraper_request import scraper_request_repository
from app.crud.scraper_preset import scraper_preset_repository
from app.schemas.scraper import (
    RequestStatus,
    ScraperRequestAdminResponse,
    ScraperRequestAdminListResponse,
    ScraperRequestApproveRequest,
    ScraperRequestRejectRequest,
)


@router.get("/scraper-requests", response_model=ScraperRequestAdminListResponse)
async def list_scraper_requests(
    status: RequestStatus | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_admin),
) -> ScraperRequestAdminListResponse:
    """List all scraper requests (admin only)."""
    requests, total = await scraper_request_repository.list_all(
        db, status=status, limit=limit, offset=offset
    )
    return ScraperRequestAdminListResponse(
        requests=[
            ScraperRequestAdminResponse(
                **ScraperRequestResponse.model_validate(r).model_dump(),
                user_id=r.user_id,
                user_email=r.user.email,
                reviewer_email=r.reviewer.email if r.reviewer else None,
            )
            for r in requests
        ],
        total=total,
    )


@router.post("/scraper-requests/{request_id}/approve", response_model=ScraperRequestAdminResponse)
async def approve_scraper_request(
    request_id: int,
    data: ScraperRequestApproveRequest,
    db: AsyncSession = Depends(get_db_session),
    admin_user: User = Depends(require_admin),
) -> ScraperRequestAdminResponse:
    """Approve a scraper request and optionally create a preset."""
    request = await scraper_request_repository.get_with_user(db, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    if request.status != RequestStatus.PENDING:
        raise HTTPException(status_code=400, detail="Request already processed")

    preset_id = None
    if data.create_preset:
        preset = await scraper_preset_repository.create(
            db,
            name=data.preset_name or request.name or f"Request #{request.id}",
            url=request.url,
            count=data.preset_count,
            is_active=data.preset_is_active,
        )
        preset_id = preset.id

    updated = await scraper_request_repository.approve(
        db,
        request_id=request_id,
        admin_id=admin_user.id,
        preset_id=preset_id,
        admin_notes=data.admin_notes,
    )
    await db.commit()
    await db.refresh(updated, ["user", "reviewer"])

    return ScraperRequestAdminResponse(
        **ScraperRequestResponse.model_validate(updated).model_dump(),
        user_id=updated.user_id,
        user_email=updated.user.email,
        reviewer_email=updated.reviewer.email if updated.reviewer else None,
    )


@router.post("/scraper-requests/{request_id}/reject", response_model=ScraperRequestAdminResponse)
async def reject_scraper_request(
    request_id: int,
    data: ScraperRequestRejectRequest,
    db: AsyncSession = Depends(get_db_session),
    admin_user: User = Depends(require_admin),
) -> ScraperRequestAdminResponse:
    """Reject a scraper request with notes."""
    request = await scraper_request_repository.get_with_user(db, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    if request.status != RequestStatus.PENDING:
        raise HTTPException(status_code=400, detail="Request already processed")

    updated = await scraper_request_repository.reject(
        db,
        request_id=request_id,
        admin_id=admin_user.id,
        admin_notes=data.admin_notes,
    )
    await db.commit()
    await db.refresh(updated, ["user", "reviewer"])

    return ScraperRequestAdminResponse(
        **ScraperRequestResponse.model_validate(updated).model_dump(),
        user_id=updated.user_id,
        user_email=updated.user.email,
        reviewer_email=updated.reviewer.email if updated.reviewer else None,
    )
```

## Verification

1. Run migration: `alembic upgrade head`
2. Test user endpoints via curl:
   - `POST /api/scraper-requests` with valid LinkedIn URL
   - `GET /api/scraper-requests` returns user's requests
   - `DELETE /api/scraper-requests/{id}` cancels pending request
3. Test admin endpoints:
   - `GET /api/admin/scraper-requests` lists all requests
   - `POST /api/admin/scraper-requests/{id}/approve` creates preset
   - `POST /api/admin/scraper-requests/{id}/reject` saves rejection notes
