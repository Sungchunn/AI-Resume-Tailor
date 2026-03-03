"""
Embedding Service - Provider-agnostic wrapper for text embeddings.

Supports:
- Google Gemini (default) - text-embedding-004
- OpenAI - text-embedding-3-small

Task Type Separation (Gemini-specific)
--------------------------------------
Google's embedding API produces different vector representations based on task_type:

1. RETRIEVAL_DOCUMENT - Use when SAVING/INGESTING content
   - Optimized for being found (document in a search index)
   - Use for: experience blocks, resume content, stored text

2. RETRIEVAL_QUERY - Use when SEARCHING/QUERYING
   - Optimized for finding relevant documents
   - Use for: job description matching, semantic search queries

OpenAI embeddings don't have task types but work well for both retrieval and queries.

See: https://ai.google.dev/gemini-api/docs/embeddings
"""

import asyncio
from abc import ABC, abstractmethod
from enum import Enum
from functools import lru_cache
import hashlib

from app.core.config import get_settings
from app.services.core.pii_stripper import get_pii_stripper


# Default embedding dimensions (Gemini text-embedding-004)
# Use get_embedding_service().dimensions for the actual configured provider's dimensions
EMBEDDING_DIMENSIONS = 768


class EmbeddingTaskType(str, Enum):
    """
    Embedding task types for optimized retrieval.

    IMPORTANT: Always use the correct task type for your use case:
    - RETRIEVAL_DOCUMENT when storing/indexing content
    - RETRIEVAL_QUERY when searching for content
    """
    RETRIEVAL_DOCUMENT = "RETRIEVAL_DOCUMENT"  # For indexing/storing
    RETRIEVAL_QUERY = "RETRIEVAL_QUERY"        # For searching
    SEMANTIC_SIMILARITY = "SEMANTIC_SIMILARITY"
    CLASSIFICATION = "CLASSIFICATION"
    CLUSTERING = "CLUSTERING"


class BaseEmbeddingService(ABC):
    """Abstract base class for embedding services."""

    def __init__(self, strip_pii: bool = True):
        """Initialize the embedding service.

        Args:
            strip_pii: Whether to strip PII before embedding (default: True)
                       SECURITY: Should always be True in production.
        """
        self.strip_pii = strip_pii
        self._pii_stripper = get_pii_stripper() if strip_pii else None

    @property
    @abstractmethod
    def dimensions(self) -> int:
        """Return the embedding dimensions."""
        pass

    @abstractmethod
    async def _embed_impl(
        self,
        text: str,
        task_type: EmbeddingTaskType,
        title: str | None = None,
    ) -> list[float]:
        """Internal implementation of embedding generation."""
        pass

    async def _embed(
        self,
        text: str,
        task_type: EmbeddingTaskType,
        title: str | None = None,
    ) -> list[float]:
        """
        Generate embeddings with PII stripping.

        SECURITY: PII is automatically stripped before embedding when
        strip_pii=True (default). This prevents PII from being stored
        in vector databases.
        """
        # Strip PII before embedding (security measure)
        if self._pii_stripper:
            text = self._pii_stripper.strip(text)
            if title:
                title = self._pii_stripper.strip(title)

        return await self._embed_impl(text, task_type, title)

    async def embed_document(self, content: str, title: str | None = None) -> list[float]:
        """
        Generate embedding for a DOCUMENT (content being stored/indexed).

        Use this when:
        - Creating a new experience block
        - Updating experience block content
        - Indexing resume content
        - Storing any text that will be searched later

        Args:
            content: The text content to embed
            title: Optional title for additional context

        Returns:
            Embedding vector
        """
        return await self._embed(
            text=content,
            task_type=EmbeddingTaskType.RETRIEVAL_DOCUMENT,
            title=title,
        )

    async def embed_query(self, query: str) -> list[float]:
        """
        Generate embedding for a QUERY (search/match operation).

        Use this when:
        - Searching for relevant experience blocks
        - Matching job description requirements
        - Finding similar content
        - Any semantic search query

        Args:
            query: The search query text

        Returns:
            Embedding vector
        """
        return await self._embed(
            text=query,
            task_type=EmbeddingTaskType.RETRIEVAL_QUERY,
        )

    async def embed_for_similarity(self, text: str) -> list[float]:
        """
        Generate embedding for similarity comparison.

        Use when comparing two texts for semantic similarity
        (e.g., duplicate detection, content matching).
        """
        return await self._embed(
            text=text,
            task_type=EmbeddingTaskType.SEMANTIC_SIMILARITY,
        )

    async def embed_batch_documents(
        self,
        contents: list[str],
        titles: list[str] | None = None,
    ) -> list[list[float]]:
        """
        Batch embed multiple documents efficiently.

        More efficient than individual calls for bulk operations
        like initial resume parsing or migration.
        """
        if titles and len(titles) != len(contents):
            raise ValueError("titles must have same length as contents")

        embeddings = []
        for i, content in enumerate(contents):
            title = titles[i] if titles else None
            embedding = await self.embed_document(content, title)
            embeddings.append(embedding)

        return embeddings

    @staticmethod
    def compute_content_hash(content: str) -> str:
        """
        Compute SHA-256 hash for content change detection.

        Use this to check if content needs re-embedding.
        """
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    def check_needs_embedding(
        self,
        new_content: str,
        current_hash: str | None,
        current_embedding: list[float] | None,
    ) -> bool:
        """
        Check if content needs (re-)embedding.

        Returns True if:
        - No existing embedding
        - No existing hash
        - Content has changed (hash mismatch)
        """
        if current_embedding is None:
            return True
        if current_hash is None:
            return True

        new_hash = self.compute_content_hash(new_content)
        return new_hash != current_hash


class GeminiEmbeddingService(BaseEmbeddingService):
    """
    Embedding service using Google's Gemini API.

    Uses text-embedding-004 with 768 native dimensions.
    Supports task_type separation for optimal retrieval quality.
    """

    EMBEDDING_MODEL = "text-embedding-004"
    EMBEDDING_DIMENSIONS = 768

    def __init__(self, api_key: str, strip_pii: bool = True):
        super().__init__(strip_pii)
        from google import genai

        self.client = genai.Client(api_key=api_key)
        self.model = self.EMBEDDING_MODEL

    @property
    def dimensions(self) -> int:
        return self.EMBEDDING_DIMENSIONS

    async def _embed_impl(
        self,
        text: str,
        task_type: EmbeddingTaskType,
        title: str | None = None,
    ) -> list[float]:
        from google.genai import types

        # Prepare content - include title if provided for document embeddings
        content = text
        if title and task_type == EmbeddingTaskType.RETRIEVAL_DOCUMENT:
            content = f"{title}\n\n{text}"

        # Configure embedding request
        config = types.EmbedContentConfig(
            task_type=task_type.value,
            output_dimensionality=self.EMBEDDING_DIMENSIONS,
        )

        # Generate embedding (non-blocking)
        result = await asyncio.to_thread(
            self.client.models.embed_content,
            model=self.model,
            contents=content,
            config=config,
        )

        if not result.embeddings:
            raise ValueError("Gemini API returned no embeddings")
        return list(result.embeddings[0].values)


class OpenAIEmbeddingService(BaseEmbeddingService):
    """
    Embedding service using OpenAI's API.

    Uses text-embedding-3-small with 1536 dimensions.
    OpenAI embeddings don't have task_type but work well for both use cases.
    """

    EMBEDDING_DIMENSIONS = 1536

    def __init__(self, api_key: str, model: str = "text-embedding-3-small", strip_pii: bool = True):
        super().__init__(strip_pii)
        from openai import OpenAI

        self.client = OpenAI(api_key=api_key)
        self.model = model

    @property
    def dimensions(self) -> int:
        return self.EMBEDDING_DIMENSIONS

    async def _embed_impl(
        self,
        text: str,
        task_type: EmbeddingTaskType,
        title: str | None = None,
    ) -> list[float]:
        # OpenAI doesn't have task_type, but we can still prepend title for context
        content = text
        if title and task_type == EmbeddingTaskType.RETRIEVAL_DOCUMENT:
            content = f"{title}\n\n{text}"

        # Generate embedding (non-blocking)
        result = await asyncio.to_thread(
            self.client.embeddings.create,
            model=self.model,
            input=content,
        )

        return result.data[0].embedding


# Type alias for the service interface
EmbeddingService = BaseEmbeddingService


@lru_cache
def get_embedding_service() -> EmbeddingService:
    """Get a singleton embedding service instance based on configured provider."""
    settings = get_settings()
    provider = settings.ai_provider.lower()

    if provider == "openai":
        return OpenAIEmbeddingService(
            api_key=settings.openai_api_key,
            model=settings.openai_embedding_model,
        )
    elif provider == "gemini":
        return GeminiEmbeddingService(api_key=settings.gemini_api_key)
    else:
        # Default to Gemini for unknown providers
        return GeminiEmbeddingService(api_key=settings.gemini_api_key)
