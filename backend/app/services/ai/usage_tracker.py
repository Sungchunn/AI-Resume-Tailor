"""
AI Usage Tracking Service

Logs AI API usage for analytics and cost monitoring.
"""

import logging
from decimal import Decimal
from functools import lru_cache

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_pricing_config import AIPricingConfig
from app.models.ai_usage_log import AIUsageLog
from app.services.ai.response import AIResponse, EmbeddingResponse

logger = logging.getLogger(__name__)


class AIUsageTracker:
    """Tracks AI API usage for analytics and cost monitoring."""

    @staticmethod
    async def get_current_pricing(
        db: AsyncSession,
        provider: str,
        model: str,
    ) -> tuple[Decimal, Decimal]:
        """Get current pricing for a model.

        Returns:
            Tuple of (input_cost_per_1k, output_cost_per_1k)
        """
        query = (
            select(
                AIPricingConfig.input_cost_per_1k,
                AIPricingConfig.output_cost_per_1k,
            )
            .where(
                AIPricingConfig.provider == provider,
                AIPricingConfig.model == model,
                AIPricingConfig.is_active == True,  # noqa: E712
            )
            .order_by(AIPricingConfig.effective_date.desc())
            .limit(1)
        )

        result = await db.execute(query)
        row = result.first()

        if row:
            return row.input_cost_per_1k, row.output_cost_per_1k

        # Default to zero if no pricing configured
        logger.warning(f"No pricing config found for {provider}/{model}")
        return Decimal("0"), Decimal("0")

    @staticmethod
    def calculate_cost(
        input_tokens: int,
        output_tokens: int,
        input_cost_per_1k: Decimal,
        output_cost_per_1k: Decimal,
    ) -> Decimal:
        """Calculate total cost for token usage."""
        input_cost = (Decimal(input_tokens) / 1000) * input_cost_per_1k
        output_cost = (Decimal(output_tokens) / 1000) * output_cost_per_1k
        return input_cost + output_cost

    async def log_generation(
        self,
        db: AsyncSession,
        user_id: int | None,
        endpoint: str,
        response: AIResponse | dict,
        success: bool = True,
        error_message: str | None = None,
    ) -> AIUsageLog:
        """Log an AI generation request.

        Args:
            db: Database session
            user_id: ID of the user who made the request (None for system ops)
            endpoint: API endpoint that triggered this call
            response: The AI response with metrics (AIResponse object or dict from cache)
            success: Whether the call succeeded
            error_message: Error message if failed

        Returns:
            The created log entry

        Note:
            Caller is responsible for committing the session.
        """
        # Extract metrics from AIResponse object or dict (from cache)
        if isinstance(response, dict):
            provider = response["provider"]
            model = response["model"]
            metrics = response["metrics"]
            input_tokens = metrics["input_tokens"]
            output_tokens = metrics["output_tokens"]
            total_tokens = metrics["total_tokens"]
            latency_ms = metrics["latency_ms"]
        else:
            provider = response.provider
            model = response.model
            input_tokens = response.metrics.input_tokens
            output_tokens = response.metrics.output_tokens
            total_tokens = response.metrics.total_tokens
            latency_ms = response.metrics.latency_ms

        # Get current pricing
        input_rate, output_rate = await self.get_current_pricing(db, provider, model)

        # Calculate cost
        cost = self.calculate_cost(
            input_tokens,
            output_tokens,
            input_rate,
            output_rate,
        )

        # Create log entry
        log = AIUsageLog(
            user_id=user_id,
            endpoint=endpoint,
            provider=provider,
            model=model,
            operation_type="generation",
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            cost_usd=cost,
            latency_ms=latency_ms,
            success=success,
            error_message=error_message,
        )

        db.add(log)
        # Note: Caller is responsible for committing the session

        return log

    async def log_embedding(
        self,
        db: AsyncSession,
        user_id: int | None,
        endpoint: str,
        response: EmbeddingResponse,
        success: bool = True,
        error_message: str | None = None,
    ) -> AIUsageLog:
        """Log an embedding request.

        Args:
            db: Database session
            user_id: ID of the user who made the request (None for system ops)
            endpoint: API endpoint that triggered this call
            response: The embedding response with metrics
            success: Whether the call succeeded
            error_message: Error message if failed

        Returns:
            The created log entry

        Note:
            Caller is responsible for committing the session.
        """
        # Embeddings only have input tokens
        input_rate, _ = await self.get_current_pricing(
            db, response.provider, response.model
        )

        cost = (Decimal(response.metrics.total_tokens) / 1000) * input_rate

        log = AIUsageLog(
            user_id=user_id,
            endpoint=endpoint,
            provider=response.provider,
            model=response.model,
            operation_type="embedding",
            input_tokens=response.metrics.input_tokens,
            output_tokens=0,
            total_tokens=response.metrics.total_tokens,
            cost_usd=cost,
            latency_ms=response.metrics.latency_ms,
            success=success,
            error_message=error_message,
        )

        db.add(log)
        return log

    async def log_embedding_raw(
        self,
        db: AsyncSession,
        user_id: int | None,
        endpoint: str,
        provider: str,
        model: str,
        total_tokens: int,
        latency_ms: int,
        success: bool = True,
        error_message: str | None = None,
    ) -> AIUsageLog:
        """Log an embedding request with raw metrics.

        Use this when you don't have an EmbeddingResponse object.

        Args:
            db: Database session
            user_id: ID of the user who made the request
            endpoint: API endpoint that triggered this call
            provider: AI provider name
            model: Model name used
            total_tokens: Total tokens used
            latency_ms: Request latency in milliseconds
            success: Whether the call succeeded
            error_message: Error message if failed

        Returns:
            The created log entry
        """
        input_rate, _ = await self.get_current_pricing(db, provider, model)
        cost = (Decimal(total_tokens) / 1000) * input_rate

        log = AIUsageLog(
            user_id=user_id,
            endpoint=endpoint,
            provider=provider,
            model=model,
            operation_type="embedding",
            input_tokens=total_tokens,
            output_tokens=0,
            total_tokens=total_tokens,
            cost_usd=cost,
            latency_ms=latency_ms,
            success=success,
            error_message=error_message,
        )

        db.add(log)
        return log


@lru_cache
def get_usage_tracker() -> AIUsageTracker:
    """Get singleton usage tracker instance."""
    return AIUsageTracker()
