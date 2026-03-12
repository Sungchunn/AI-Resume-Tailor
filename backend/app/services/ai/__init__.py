"""AI service components for LLM and embedding operations."""

from app.services.ai.client import AIClient, get_ai_client
from app.services.ai.embedding import (
    EmbeddingService,
    EmbeddingTaskType,
    get_embedding_service,
    EMBEDDING_DIMENSIONS,
)
from app.services.ai.response import (
    AIResponse,
    AIUsageMetrics,
    EmbeddingResponse,
    BatchEmbeddingResponse,
    AccumulatedMetrics,
)
from app.services.ai.semantic_matcher import SemanticMatcher, get_semantic_matcher
from app.services.ai.usage_tracker import AIUsageTracker, get_usage_tracker

__all__ = [
    # Client
    "AIClient",
    "get_ai_client",
    # Embedding
    "EmbeddingService",
    "EmbeddingTaskType",
    "get_embedding_service",
    "EMBEDDING_DIMENSIONS",
    # Response types
    "AIResponse",
    "AIUsageMetrics",
    "EmbeddingResponse",
    "BatchEmbeddingResponse",
    "AccumulatedMetrics",
    # Usage tracking
    "AIUsageTracker",
    "get_usage_tracker",
    # Semantic matching
    "SemanticMatcher",
    "get_semantic_matcher",
]
