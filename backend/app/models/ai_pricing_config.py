"""
AI Pricing Config Model

Stores pricing configuration for AI providers and models.
Allows dynamic pricing updates without code changes.
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean, Numeric, Index
from sqlalchemy.sql import func

from app.db.session import Base


class AIPricingConfig(Base):
    """
    Pricing configuration for AI API calls.

    Stores cost per 1K tokens for input and output.
    Multiple configs can exist for the same provider/model,
    with effective_date determining which is active.
    """

    __tablename__ = "ai_pricing_configs"

    id = Column(Integer, primary_key=True, index=True)

    # Provider and model
    provider = Column(String(20), nullable=False)  # "openai" | "gemini"
    model = Column(String(50), nullable=False)

    # Pricing per 1K tokens (8 decimal precision for micropayments)
    input_cost_per_1k = Column(Numeric(10, 8), nullable=False)
    output_cost_per_1k = Column(Numeric(10, 8), nullable=False)

    # When this pricing becomes effective
    effective_date = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Whether this config is currently active
    is_active = Column(Boolean, nullable=False, default=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Indexes for common query patterns
    __table_args__ = (
        Index("ix_ai_pricing_configs_provider_model", "provider", "model"),
        Index("ix_ai_pricing_configs_active", "is_active", "provider", "model"),
    )

    def __repr__(self) -> str:
        return (
            f"<AIPricingConfig(id={self.id}, provider={self.provider}, "
            f"model={self.model}, input=${self.input_cost_per_1k}/1K, "
            f"output=${self.output_cost_per_1k}/1K)>"
        )
