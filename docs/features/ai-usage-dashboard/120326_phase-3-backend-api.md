# Phase 3: Backend API

## Overview

Create CRUD operations, Pydantic schemas, and admin API endpoints for the dashboard.

---

## 3.1 Pydantic Schemas

**File:** `/backend/app/schemas/ai_usage.py`

```python
"""AI usage tracking schemas."""

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


# Response schemas for dashboard
class AIUsageSummaryResponse(BaseModel):
    """Aggregated usage summary for a time period."""

    total_requests: int
    successful_requests: int
    failed_requests: int
    total_input_tokens: int
    total_output_tokens: int
    total_tokens: int
    total_cost_usd: float
    avg_latency_ms: float
    success_rate: float = Field(ge=0, le=1)
    period_start: datetime
    period_end: datetime


class EndpointUsageResponse(BaseModel):
    """Usage breakdown by endpoint."""

    endpoint: str
    request_count: int
    total_tokens: int
    total_cost_usd: float
    avg_latency_ms: float
    success_rate: float


class ProviderUsageResponse(BaseModel):
    """Usage breakdown by provider and model."""

    provider: str
    model: str
    request_count: int
    input_tokens: int
    output_tokens: int
    total_tokens: int
    total_cost_usd: float
    avg_latency_ms: float


class UserUsageResponse(BaseModel):
    """Usage breakdown by user."""

    user_id: int
    user_email: str
    user_name: str | None
    request_count: int
    total_tokens: int
    total_cost_usd: float


class TimeSeriesDataPoint(BaseModel):
    """Single data point in usage time series."""

    timestamp: datetime
    request_count: int
    total_tokens: int
    total_cost_usd: float
    avg_latency_ms: float


class TimeSeriesResponse(BaseModel):
    """Time series usage data."""

    granularity: Literal["hour", "day", "week"]
    data: list[TimeSeriesDataPoint]


# Pricing config schemas
class PricingConfigResponse(BaseModel):
    """AI pricing configuration."""

    id: int
    provider: str
    model: str
    input_cost_per_1k: float
    output_cost_per_1k: float
    effective_date: datetime
    is_active: bool


class PricingConfigUpdate(BaseModel):
    """Update pricing configuration."""

    input_cost_per_1k: float | None = None
    output_cost_per_1k: float | None = None
    is_active: bool | None = None


class PricingConfigCreate(BaseModel):
    """Create new pricing configuration."""

    provider: str
    model: str
    input_cost_per_1k: float
    output_cost_per_1k: float
```

---

## 3.2 CRUD Operations

**File:** `/backend/app/crud/ai_usage.py`

```python
"""CRUD operations for AI usage analytics."""

from datetime import datetime
from decimal import Decimal
from typing import Literal

from sqlalchemy import func, select, and_, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_usage_log import AIUsageLog
from app.models.ai_pricing_config import AIPricingConfig
from app.models.user import User


class AIUsageCRUD:
    """CRUD operations for AI usage data."""

    async def get_summary(
        self,
        db: AsyncSession,
        start_date: datetime,
        end_date: datetime,
    ) -> dict:
        """Get aggregated usage summary for a time period."""
        query = select(
            func.count(AIUsageLog.id).label("total_requests"),
            func.sum(case((AIUsageLog.success == True, 1), else_=0)).label("successful_requests"),
            func.sum(case((AIUsageLog.success == False, 1), else_=0)).label("failed_requests"),
            func.coalesce(func.sum(AIUsageLog.input_tokens), 0).label("total_input_tokens"),
            func.coalesce(func.sum(AIUsageLog.output_tokens), 0).label("total_output_tokens"),
            func.coalesce(func.sum(AIUsageLog.total_tokens), 0).label("total_tokens"),
            func.coalesce(func.sum(AIUsageLog.cost_usd), Decimal("0")).label("total_cost_usd"),
            func.coalesce(func.avg(AIUsageLog.latency_ms), 0).label("avg_latency_ms"),
        ).where(
            and_(
                AIUsageLog.created_at >= start_date,
                AIUsageLog.created_at < end_date,
            )
        )

        result = await db.execute(query)
        row = result.one()

        total = row.total_requests or 0
        successful = row.successful_requests or 0

        return {
            "total_requests": total,
            "successful_requests": successful,
            "failed_requests": row.failed_requests or 0,
            "total_input_tokens": row.total_input_tokens,
            "total_output_tokens": row.total_output_tokens,
            "total_tokens": row.total_tokens,
            "total_cost_usd": float(row.total_cost_usd),
            "avg_latency_ms": float(row.avg_latency_ms),
            "success_rate": successful / total if total > 0 else 1.0,
            "period_start": start_date,
            "period_end": end_date,
        }

    async def get_by_endpoint(
        self,
        db: AsyncSession,
        start_date: datetime,
        end_date: datetime,
    ) -> list[dict]:
        """Get usage breakdown by endpoint."""
        query = select(
            AIUsageLog.endpoint,
            func.count(AIUsageLog.id).label("request_count"),
            func.coalesce(func.sum(AIUsageLog.total_tokens), 0).label("total_tokens"),
            func.coalesce(func.sum(AIUsageLog.cost_usd), Decimal("0")).label("total_cost_usd"),
            func.coalesce(func.avg(AIUsageLog.latency_ms), 0).label("avg_latency_ms"),
            func.sum(case((AIUsageLog.success == True, 1), else_=0)).label("successful"),
        ).where(
            and_(
                AIUsageLog.created_at >= start_date,
                AIUsageLog.created_at < end_date,
            )
        ).group_by(AIUsageLog.endpoint).order_by(func.sum(AIUsageLog.cost_usd).desc())

        result = await db.execute(query)
        rows = result.all()

        return [
            {
                "endpoint": row.endpoint,
                "request_count": row.request_count,
                "total_tokens": row.total_tokens,
                "total_cost_usd": float(row.total_cost_usd),
                "avg_latency_ms": float(row.avg_latency_ms),
                "success_rate": row.successful / row.request_count if row.request_count > 0 else 1.0,
            }
            for row in rows
        ]

    async def get_by_provider(
        self,
        db: AsyncSession,
        start_date: datetime,
        end_date: datetime,
    ) -> list[dict]:
        """Get usage breakdown by provider and model."""
        query = select(
            AIUsageLog.provider,
            AIUsageLog.model,
            func.count(AIUsageLog.id).label("request_count"),
            func.coalesce(func.sum(AIUsageLog.input_tokens), 0).label("input_tokens"),
            func.coalesce(func.sum(AIUsageLog.output_tokens), 0).label("output_tokens"),
            func.coalesce(func.sum(AIUsageLog.total_tokens), 0).label("total_tokens"),
            func.coalesce(func.sum(AIUsageLog.cost_usd), Decimal("0")).label("total_cost_usd"),
            func.coalesce(func.avg(AIUsageLog.latency_ms), 0).label("avg_latency_ms"),
        ).where(
            and_(
                AIUsageLog.created_at >= start_date,
                AIUsageLog.created_at < end_date,
            )
        ).group_by(AIUsageLog.provider, AIUsageLog.model).order_by(func.sum(AIUsageLog.cost_usd).desc())

        result = await db.execute(query)
        rows = result.all()

        return [
            {
                "provider": row.provider,
                "model": row.model,
                "request_count": row.request_count,
                "input_tokens": row.input_tokens,
                "output_tokens": row.output_tokens,
                "total_tokens": row.total_tokens,
                "total_cost_usd": float(row.total_cost_usd),
                "avg_latency_ms": float(row.avg_latency_ms),
            }
            for row in rows
        ]

    async def get_by_user(
        self,
        db: AsyncSession,
        start_date: datetime,
        end_date: datetime,
        limit: int = 10,
    ) -> list[dict]:
        """Get top users by usage."""
        query = select(
            AIUsageLog.user_id,
            User.email,
            User.full_name,
            func.count(AIUsageLog.id).label("request_count"),
            func.coalesce(func.sum(AIUsageLog.total_tokens), 0).label("total_tokens"),
            func.coalesce(func.sum(AIUsageLog.cost_usd), Decimal("0")).label("total_cost_usd"),
        ).join(
            User, AIUsageLog.user_id == User.id
        ).where(
            and_(
                AIUsageLog.created_at >= start_date,
                AIUsageLog.created_at < end_date,
                AIUsageLog.user_id.isnot(None),
            )
        ).group_by(
            AIUsageLog.user_id, User.email, User.full_name
        ).order_by(
            func.sum(AIUsageLog.cost_usd).desc()
        ).limit(limit)

        result = await db.execute(query)
        rows = result.all()

        return [
            {
                "user_id": row.user_id,
                "user_email": row.email,
                "user_name": row.full_name,
                "request_count": row.request_count,
                "total_tokens": row.total_tokens,
                "total_cost_usd": float(row.total_cost_usd),
            }
            for row in rows
        ]

    async def get_time_series(
        self,
        db: AsyncSession,
        start_date: datetime,
        end_date: datetime,
        granularity: Literal["hour", "day", "week"] = "day",
    ) -> list[dict]:
        """Get usage over time for charting."""
        # Use date_trunc for PostgreSQL
        if granularity == "hour":
            trunc_expr = func.date_trunc("hour", AIUsageLog.created_at)
        elif granularity == "week":
            trunc_expr = func.date_trunc("week", AIUsageLog.created_at)
        else:
            trunc_expr = func.date_trunc("day", AIUsageLog.created_at)

        query = select(
            trunc_expr.label("timestamp"),
            func.count(AIUsageLog.id).label("request_count"),
            func.coalesce(func.sum(AIUsageLog.total_tokens), 0).label("total_tokens"),
            func.coalesce(func.sum(AIUsageLog.cost_usd), Decimal("0")).label("total_cost_usd"),
            func.coalesce(func.avg(AIUsageLog.latency_ms), 0).label("avg_latency_ms"),
        ).where(
            and_(
                AIUsageLog.created_at >= start_date,
                AIUsageLog.created_at < end_date,
            )
        ).group_by(trunc_expr).order_by(trunc_expr)

        result = await db.execute(query)
        rows = result.all()

        return [
            {
                "timestamp": row.timestamp,
                "request_count": row.request_count,
                "total_tokens": row.total_tokens,
                "total_cost_usd": float(row.total_cost_usd),
                "avg_latency_ms": float(row.avg_latency_ms),
            }
            for row in rows
        ]


# Pricing CRUD
class AIPricingCRUD:
    """CRUD operations for AI pricing configuration."""

    async def get_all_active(self, db: AsyncSession) -> list[AIPricingConfig]:
        """Get all active pricing configurations."""
        query = select(AIPricingConfig).where(
            AIPricingConfig.is_active == True
        ).order_by(AIPricingConfig.provider, AIPricingConfig.model)

        result = await db.execute(query)
        return list(result.scalars().all())

    async def get_by_id(self, db: AsyncSession, config_id: int) -> AIPricingConfig | None:
        """Get pricing config by ID."""
        return await db.get(AIPricingConfig, config_id)

    async def update(
        self,
        db: AsyncSession,
        config: AIPricingConfig,
        update_data: dict,
    ) -> AIPricingConfig:
        """Update pricing configuration."""
        for field, value in update_data.items():
            if value is not None:
                setattr(config, field, value)
        await db.commit()
        await db.refresh(config)
        return config

    async def create(self, db: AsyncSession, data: dict) -> AIPricingConfig:
        """Create new pricing configuration."""
        config = AIPricingConfig(**data)
        db.add(config)
        await db.commit()
        await db.refresh(config)
        return config


# Singleton instances
ai_usage_crud = AIUsageCRUD()
ai_pricing_crud = AIPricingCRUD()
```

---

## 3.3 Admin API Routes

**File:** `/backend/app/api/routes/admin_ai_usage.py`

```python
"""Admin API endpoints for AI usage analytics."""

import logging
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session, require_admin
from app.crud.ai_usage import ai_usage_crud, ai_pricing_crud
from app.schemas.ai_usage import (
    AIUsageSummaryResponse,
    EndpointUsageResponse,
    ProviderUsageResponse,
    UserUsageResponse,
    TimeSeriesResponse,
    TimeSeriesDataPoint,
    PricingConfigResponse,
    PricingConfigUpdate,
    PricingConfigCreate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai-usage", dependencies=[Depends(require_admin)])


@router.get("/summary", response_model=AIUsageSummaryResponse)
async def get_usage_summary(
    start_date: datetime = Query(..., description="Start of time range (inclusive)"),
    end_date: datetime = Query(..., description="End of time range (exclusive)"),
    db: AsyncSession = Depends(get_db_session),
) -> AIUsageSummaryResponse:
    """Get overall AI usage statistics for a time period."""
    summary = await ai_usage_crud.get_summary(db, start_date, end_date)
    return AIUsageSummaryResponse(**summary)


@router.get("/by-endpoint", response_model=list[EndpointUsageResponse])
async def get_usage_by_endpoint(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    db: AsyncSession = Depends(get_db_session),
) -> list[EndpointUsageResponse]:
    """Get usage breakdown by API endpoint."""
    data = await ai_usage_crud.get_by_endpoint(db, start_date, end_date)
    return [EndpointUsageResponse(**row) for row in data]


@router.get("/by-provider", response_model=list[ProviderUsageResponse])
async def get_usage_by_provider(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    db: AsyncSession = Depends(get_db_session),
) -> list[ProviderUsageResponse]:
    """Get usage breakdown by AI provider and model."""
    data = await ai_usage_crud.get_by_provider(db, start_date, end_date)
    return [ProviderUsageResponse(**row) for row in data]


@router.get("/by-user", response_model=list[UserUsageResponse])
async def get_usage_by_user(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    limit: int = Query(default=10, ge=1, le=50),
    db: AsyncSession = Depends(get_db_session),
) -> list[UserUsageResponse]:
    """Get top users by AI usage."""
    data = await ai_usage_crud.get_by_user(db, start_date, end_date, limit)
    return [UserUsageResponse(**row) for row in data]


@router.get("/time-series", response_model=TimeSeriesResponse)
async def get_usage_time_series(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    granularity: Literal["hour", "day", "week"] = Query(default="day"),
    db: AsyncSession = Depends(get_db_session),
) -> TimeSeriesResponse:
    """Get usage over time for charting."""
    data = await ai_usage_crud.get_time_series(db, start_date, end_date, granularity)
    return TimeSeriesResponse(
        granularity=granularity,
        data=[TimeSeriesDataPoint(**row) for row in data],
    )


@router.get("/pricing", response_model=list[PricingConfigResponse])
async def get_current_pricing(
    db: AsyncSession = Depends(get_db_session),
) -> list[PricingConfigResponse]:
    """Get all active AI pricing configurations."""
    configs = await ai_pricing_crud.get_all_active(db)
    return [
        PricingConfigResponse(
            id=c.id,
            provider=c.provider,
            model=c.model,
            input_cost_per_1k=float(c.input_cost_per_1k),
            output_cost_per_1k=float(c.output_cost_per_1k),
            effective_date=c.effective_date,
            is_active=c.is_active,
        )
        for c in configs
    ]


@router.put("/pricing/{config_id}", response_model=PricingConfigResponse)
async def update_pricing(
    config_id: int,
    data: PricingConfigUpdate,
    db: AsyncSession = Depends(get_db_session),
) -> PricingConfigResponse:
    """Update AI pricing configuration."""
    config = await ai_pricing_crud.get_by_id(db, config_id)
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pricing configuration not found",
        )

    updated = await ai_pricing_crud.update(db, config, data.model_dump(exclude_unset=True))

    return PricingConfigResponse(
        id=updated.id,
        provider=updated.provider,
        model=updated.model,
        input_cost_per_1k=float(updated.input_cost_per_1k),
        output_cost_per_1k=float(updated.output_cost_per_1k),
        effective_date=updated.effective_date,
        is_active=updated.is_active,
    )


@router.post("/pricing", response_model=PricingConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_pricing(
    data: PricingConfigCreate,
    db: AsyncSession = Depends(get_db_session),
) -> PricingConfigResponse:
    """Create new AI pricing configuration."""
    config = await ai_pricing_crud.create(db, data.model_dump())

    return PricingConfigResponse(
        id=config.id,
        provider=config.provider,
        model=config.model,
        input_cost_per_1k=float(config.input_cost_per_1k),
        output_cost_per_1k=float(config.output_cost_per_1k),
        effective_date=config.effective_date,
        is_active=config.is_active,
    )
```

---

## 3.4 Register Routes

**File:** `/backend/app/api/routes/__init__.py`

Add to router registration:

```python
from app.api.routes import admin_ai_usage

# In the router setup
api_router.include_router(
    admin_ai_usage.router,
    prefix="/admin",
    tags=["admin-ai-usage"],
)
```

---

## Verification

```bash
# Test endpoints with httpie
http GET localhost:8000/api/admin/ai-usage/summary \
  start_date==2026-03-01T00:00:00Z \
  end_date==2026-03-13T00:00:00Z \
  Authorization:"Bearer $ADMIN_TOKEN"

http GET localhost:8000/api/admin/ai-usage/by-endpoint \
  start_date==2026-03-01T00:00:00Z \
  end_date==2026-03-13T00:00:00Z \
  Authorization:"Bearer $ADMIN_TOKEN"

http GET localhost:8000/api/admin/ai-usage/pricing \
  Authorization:"Bearer $ADMIN_TOKEN"

# Verify non-admin gets 403
http GET localhost:8000/api/admin/ai-usage/summary \
  start_date==2026-03-01T00:00:00Z \
  end_date==2026-03-13T00:00:00Z \
  Authorization:"Bearer $USER_TOKEN"
# Should return 403 Forbidden
```
