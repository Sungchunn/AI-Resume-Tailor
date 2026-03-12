"""Admin API endpoints for AI usage analytics."""

import logging
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session, require_admin
from app.crud.ai_usage import ai_pricing_crud, ai_usage_crud
from app.schemas.ai_usage import (
    AIUsageSummaryResponse,
    EndpointUsageResponse,
    PricingConfigCreate,
    PricingConfigResponse,
    PricingConfigUpdate,
    ProviderUsageResponse,
    TimeSeriesDataPoint,
    TimeSeriesResponse,
    UserUsageResponse,
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

    updated = await ai_pricing_crud.update(
        db, config, data.model_dump(exclude_unset=True)
    )

    return PricingConfigResponse(
        id=updated.id,
        provider=updated.provider,
        model=updated.model,
        input_cost_per_1k=float(updated.input_cost_per_1k),
        output_cost_per_1k=float(updated.output_cost_per_1k),
        effective_date=updated.effective_date,
        is_active=updated.is_active,
    )


@router.post(
    "/pricing",
    response_model=PricingConfigResponse,
    status_code=status.HTTP_201_CREATED,
)
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
