"""
AI Response Types

Dataclasses for AI response metrics and usage tracking.
"""

from dataclasses import dataclass


@dataclass
class AIUsageMetrics:
    """Metrics captured from an AI API call."""

    input_tokens: int
    output_tokens: int
    total_tokens: int
    latency_ms: int


@dataclass
class AIResponse:
    """Response from an AI generation call with usage metrics."""

    content: str
    metrics: AIUsageMetrics
    provider: str
    model: str


@dataclass
class EmbeddingResponse:
    """Response from an embedding call with usage metrics."""

    embedding: list[float]
    metrics: AIUsageMetrics
    provider: str
    model: str


@dataclass
class BatchEmbeddingResponse:
    """Batch embedding response with vectors and usage metrics."""

    embeddings: list[list[float]]
    metrics: AIUsageMetrics
    provider: str
    model: str
