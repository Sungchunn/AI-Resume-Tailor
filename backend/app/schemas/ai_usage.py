"""AI usage tracking schemas."""

from datetime import datetime
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
