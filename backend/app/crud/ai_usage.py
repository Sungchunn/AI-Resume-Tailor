"""CRUD operations for AI usage analytics."""

from datetime import datetime
from decimal import Decimal
from typing import Literal

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_pricing_config import AIPricingConfig
from app.models.ai_usage_log import AIUsageLog
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
            func.sum(case((AIUsageLog.success == True, 1), else_=0)).label(  # noqa: E712
                "successful_requests"
            ),
            func.sum(case((AIUsageLog.success == False, 1), else_=0)).label(  # noqa: E712
                "failed_requests"
            ),
            func.coalesce(func.sum(AIUsageLog.input_tokens), 0).label(
                "total_input_tokens"
            ),
            func.coalesce(func.sum(AIUsageLog.output_tokens), 0).label(
                "total_output_tokens"
            ),
            func.coalesce(func.sum(AIUsageLog.total_tokens), 0).label("total_tokens"),
            func.coalesce(func.sum(AIUsageLog.cost_usd), Decimal("0")).label(
                "total_cost_usd"
            ),
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
        query = (
            select(
                AIUsageLog.endpoint,
                func.count(AIUsageLog.id).label("request_count"),
                func.coalesce(func.sum(AIUsageLog.total_tokens), 0).label(
                    "total_tokens"
                ),
                func.coalesce(func.sum(AIUsageLog.cost_usd), Decimal("0")).label(
                    "total_cost_usd"
                ),
                func.coalesce(func.avg(AIUsageLog.latency_ms), 0).label(
                    "avg_latency_ms"
                ),
                func.sum(case((AIUsageLog.success == True, 1), else_=0)).label(  # noqa: E712
                    "successful"
                ),
            )
            .where(
                and_(
                    AIUsageLog.created_at >= start_date,
                    AIUsageLog.created_at < end_date,
                )
            )
            .group_by(AIUsageLog.endpoint)
            .order_by(func.sum(AIUsageLog.cost_usd).desc())
        )

        result = await db.execute(query)
        rows = result.all()

        return [
            {
                "endpoint": row.endpoint,
                "request_count": row.request_count,
                "total_tokens": row.total_tokens,
                "total_cost_usd": float(row.total_cost_usd),
                "avg_latency_ms": float(row.avg_latency_ms),
                "success_rate": (
                    row.successful / row.request_count if row.request_count > 0 else 1.0
                ),
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
        query = (
            select(
                AIUsageLog.provider,
                AIUsageLog.model,
                func.count(AIUsageLog.id).label("request_count"),
                func.coalesce(func.sum(AIUsageLog.input_tokens), 0).label(
                    "input_tokens"
                ),
                func.coalesce(func.sum(AIUsageLog.output_tokens), 0).label(
                    "output_tokens"
                ),
                func.coalesce(func.sum(AIUsageLog.total_tokens), 0).label(
                    "total_tokens"
                ),
                func.coalesce(func.sum(AIUsageLog.cost_usd), Decimal("0")).label(
                    "total_cost_usd"
                ),
                func.coalesce(func.avg(AIUsageLog.latency_ms), 0).label(
                    "avg_latency_ms"
                ),
            )
            .where(
                and_(
                    AIUsageLog.created_at >= start_date,
                    AIUsageLog.created_at < end_date,
                )
            )
            .group_by(AIUsageLog.provider, AIUsageLog.model)
            .order_by(func.sum(AIUsageLog.cost_usd).desc())
        )

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
        query = (
            select(
                AIUsageLog.user_id,
                User.email,
                User.full_name,
                func.count(AIUsageLog.id).label("request_count"),
                func.coalesce(func.sum(AIUsageLog.total_tokens), 0).label(
                    "total_tokens"
                ),
                func.coalesce(func.sum(AIUsageLog.cost_usd), Decimal("0")).label(
                    "total_cost_usd"
                ),
            )
            .join(User, AIUsageLog.user_id == User.id)
            .where(
                and_(
                    AIUsageLog.created_at >= start_date,
                    AIUsageLog.created_at < end_date,
                    AIUsageLog.user_id.isnot(None),
                )
            )
            .group_by(AIUsageLog.user_id, User.email, User.full_name)
            .order_by(func.sum(AIUsageLog.cost_usd).desc())
            .limit(limit)
        )

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

        query = (
            select(
                trunc_expr.label("timestamp"),
                func.count(AIUsageLog.id).label("request_count"),
                func.coalesce(func.sum(AIUsageLog.total_tokens), 0).label(
                    "total_tokens"
                ),
                func.coalesce(func.sum(AIUsageLog.cost_usd), Decimal("0")).label(
                    "total_cost_usd"
                ),
                func.coalesce(func.avg(AIUsageLog.latency_ms), 0).label(
                    "avg_latency_ms"
                ),
            )
            .where(
                and_(
                    AIUsageLog.created_at >= start_date,
                    AIUsageLog.created_at < end_date,
                )
            )
            .group_by(trunc_expr)
            .order_by(trunc_expr)
        )

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
        query = (
            select(AIPricingConfig)
            .where(AIPricingConfig.is_active == True)  # noqa: E712
            .order_by(AIPricingConfig.provider, AIPricingConfig.model)
        )

        result = await db.execute(query)
        return list(result.scalars().all())

    async def get_by_id(
        self, db: AsyncSession, config_id: int
    ) -> AIPricingConfig | None:
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
