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


@dataclass
class AccumulatedMetrics:
    """Accumulated metrics from multiple AI calls.

    Used by services that make multiple AI calls to track total usage.
    """

    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_tokens: int = 0
    total_latency_ms: int = 0
    call_count: int = 0
    provider: str = ""
    model: str = ""

    def add(self, response: AIResponse) -> None:
        """Add metrics from an AI response."""
        self.total_input_tokens += response.metrics.input_tokens
        self.total_output_tokens += response.metrics.output_tokens
        self.total_tokens += response.metrics.total_tokens
        self.total_latency_ms += response.metrics.latency_ms
        self.call_count += 1
        # Use the last response's provider/model
        self.provider = response.provider
        self.model = response.model

    def to_ai_response(self, content: str = "") -> AIResponse:
        """Convert accumulated metrics to an AIResponse for logging."""
        return AIResponse(
            content=content,
            metrics=AIUsageMetrics(
                input_tokens=self.total_input_tokens,
                output_tokens=self.total_output_tokens,
                total_tokens=self.total_tokens,
                latency_ms=self.total_latency_ms,
            ),
            provider=self.provider,
            model=self.model,
        )
