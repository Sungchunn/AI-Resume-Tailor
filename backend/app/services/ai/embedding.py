"""
Gemini Embedding Service - Optimized for text-embedding-004

This service handles embedding generation with proper task_type separation
for optimal retrieval quality with Google's Gemini embedding models.

CRITICAL: Task Type Separation
------------------------------
Google's embedding API produces different vector representations based on task_type:

1. RETRIEVAL_DOCUMENT - Use when SAVING/INGESTING content
   - Optimized for being found (document in a search index)
   - Use for: experience blocks, resume content, stored text

2. RETRIEVAL_QUERY - Use when SEARCHING/QUERYING
   - Optimized for finding relevant documents
   - Use for: job description matching, semantic search queries

Mixing these up will significantly degrade retrieval quality!

Available task types (for reference):
- RETRIEVAL_QUERY: Query for semantic search
- RETRIEVAL_DOCUMENT: Document for semantic search
- SEMANTIC_SIMILARITY: Text similarity comparison
- CLASSIFICATION: Text classification
- CLUSTERING: Clustering similar texts

See: https://ai.google.dev/gemini-api/docs/embeddings
"""

from enum import Enum
from functools import lru_cache
import hashlib

from google import genai
from google.genai import types

from app.core.config import get_settings
from app.services.core.pii_stripper import get_pii_stripper


class EmbeddingTaskType(str, Enum):
    """
    Gemini embedding task types for optimized retrieval.

    IMPORTANT: Always use the correct task type for your use case:
    - RETRIEVAL_DOCUMENT when storing/indexing content
    - RETRIEVAL_QUERY when searching for content
    """
    RETRIEVAL_DOCUMENT = "RETRIEVAL_DOCUMENT"  # For indexing/storing
    RETRIEVAL_QUERY = "RETRIEVAL_QUERY"        # For searching
    SEMANTIC_SIMILARITY = "SEMANTIC_SIMILARITY"
    CLASSIFICATION = "CLASSIFICATION"
    CLUSTERING = "CLUSTERING"


# Model configuration
EMBEDDING_MODEL = "text-embedding-004"
EMBEDDING_DIMENSIONS = 768  # Native output, do not truncate/pad


class EmbeddingService:
    """
    Service for generating embeddings using Google's Gemini API.

    Optimized for the Vault & Workshop architecture:
    - Uses text-embedding-004 with 768 native dimensions
    - Proper task_type separation for asymmetric retrieval
    - Content hashing for lazy updates (don't re-embed unchanged content)

    Usage:
        service = get_embedding_service()

        # When SAVING experience blocks to the Vault:
        doc_embedding = await service.embed_document("Built Redis caching layer...")

        # When SEARCHING (job matching, semantic search):
        query_embedding = await service.embed_query("Python backend experience")
    """

    def __init__(self, api_key: str, strip_pii: bool = True):
        """Initialize the embedding service with Gemini API key.

        Args:
            api_key: Gemini API key
            strip_pii: Whether to strip PII before embedding (default: True)
                       SECURITY: Should always be True in production.
        """
        self.client = genai.Client(api_key=api_key)
        self.model = EMBEDDING_MODEL
        self.dimensions = EMBEDDING_DIMENSIONS
        self.strip_pii = strip_pii
        self._pii_stripper = get_pii_stripper() if strip_pii else None

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
            768-dimensional embedding vector

        Example:
            embedding = await service.embed_document(
                content="Reduced API latency by 40% through Redis caching",
                title="Backend Achievement"
            )
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
            768-dimensional embedding vector

        Example:
            embedding = await service.embed_query("Python microservices experience")
            results = await ExperienceBlock.search_experience(
                db=db,
                query_vector=embedding,
                user_id=user.id,
            )
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

        Args:
            text: Text to embed for similarity comparison

        Returns:
            768-dimensional embedding vector
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

        Args:
            contents: List of text contents to embed
            titles: Optional list of titles (must match contents length)

        Returns:
            List of 768-dimensional embedding vectors
        """
        if titles and len(titles) != len(contents):
            raise ValueError("titles must have same length as contents")

        embeddings = []
        for i, content in enumerate(contents):
            title = titles[i] if titles else None
            embedding = await self.embed_document(content, title)
            embeddings.append(embedding)

        return embeddings

    async def _embed(
        self,
        text: str,
        task_type: EmbeddingTaskType,
        title: str | None = None,
    ) -> list[float]:
        """
        Internal method to generate embeddings with specified task type.

        SECURITY: PII is automatically stripped before embedding when
        strip_pii=True (default). This prevents PII from being stored
        in vector databases.

        Args:
            text: Text to embed
            task_type: Gemini task type for optimal retrieval
            title: Optional title (only used with RETRIEVAL_DOCUMENT)

        Returns:
            768-dimensional embedding vector
        """
        # Strip PII before embedding (security measure)
        if self._pii_stripper:
            text = self._pii_stripper.strip(text)
            if title:
                title = self._pii_stripper.strip(title)

        # Prepare content - include title if provided for document embeddings
        content = text
        if title and task_type == EmbeddingTaskType.RETRIEVAL_DOCUMENT:
            content = f"{title}\n\n{text}"

        # Configure embedding request
        config = types.EmbedContentConfig(
            task_type=task_type.value,
            output_dimensionality=self.dimensions,
        )

        # Generate embedding
        result = self.client.models.embed_content(
            model=self.model,
            contents=content,
            config=config,
        )

        # Return the embedding vector
        return result.embeddings[0].values

    @staticmethod
    def compute_content_hash(content: str) -> str:
        """
        Compute SHA-256 hash for content change detection.

        Use this to check if content needs re-embedding:

            stored_hash = block.content_hash
            new_hash = service.compute_content_hash(new_content)
            if stored_hash != new_hash:
                # Content changed, re-embed
                embedding = await service.embed_document(new_content)
                block.embedding = embedding
                block.content_hash = new_hash
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

        Args:
            new_content: The current/new content
            current_hash: Stored content hash (or None)
            current_embedding: Stored embedding (or None)

        Returns:
            True if embedding is needed
        """
        if current_embedding is None:
            return True
        if current_hash is None:
            return True

        new_hash = self.compute_content_hash(new_content)
        return new_hash != current_hash


@lru_cache
def get_embedding_service() -> EmbeddingService:
    """Get a singleton embedding service instance."""
    settings = get_settings()
    return EmbeddingService(api_key=settings.gemini_api_key)
