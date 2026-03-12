"""
AI Usage Log Model

Stores usage records for all AI API calls (LLM and embedding operations).
Used for cost tracking, performance monitoring, and analytics.
"""

from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, Numeric, Index
from sqlalchemy.sql import func

from app.db.session import Base


class AIUsageLog(Base):
    """
    AI usage log entry for tracking API calls.

    Captures:
    - Who made the call (user_id)
    - Which endpoint triggered it (endpoint)
    - Provider and model used
    - Token counts and costs
    - Latency and success status
    """

    __tablename__ = "ai_usage_logs"

    id = Column(Integer, primary_key=True, index=True)

    # Who
    user_id = Column(Integer, nullable=True, index=True)  # Null for system operations

    # What endpoint triggered this
    endpoint = Column(String(100), nullable=False, index=True)

    # Provider and model
    provider = Column(String(20), nullable=False, index=True)  # "openai" | "gemini"
    model = Column(String(50), nullable=False, index=True)

    # Operation type
    operation_type = Column(String(30), nullable=False)  # "generation" | "embedding"

    # Token usage
    input_tokens = Column(Integer, nullable=False, default=0)
    output_tokens = Column(Integer, nullable=False, default=0)
    total_tokens = Column(Integer, nullable=False, default=0)

    # Cost (USD with 6 decimal precision)
    cost_usd = Column(Numeric(10, 6), nullable=False, default=0)

    # Performance
    latency_ms = Column(Integer, nullable=False)

    # Status
    success = Column(Boolean, nullable=False, default=True)
    error_message = Column(Text, nullable=True)

    # When
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Composite indexes for common query patterns
    __table_args__ = (
        Index("ix_ai_usage_logs_time_endpoint", "created_at", "endpoint"),
        Index("ix_ai_usage_logs_time_provider", "created_at", "provider"),
        Index("ix_ai_usage_logs_user_time", "user_id", "created_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<AIUsageLog(id={self.id}, user_id={self.user_id}, "
            f"provider={self.provider}, model={self.model}, "
            f"tokens={self.total_tokens}, cost=${self.cost_usd})>"
        )
