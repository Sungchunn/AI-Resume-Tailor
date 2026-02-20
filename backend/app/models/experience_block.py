"""
ExperienceBlock Model - Optimized for Google Gemini Embeddings

This model is optimized for cost-efficient semantic search using:
- Google's text-embedding-004 model (768 native dimensions)
- HNSW indexing for fast approximate nearest neighbor search
- Content hashing to avoid redundant re-embedding
- Filter-first hybrid search to minimize vector compute costs

IMPORTANT: Gemini Embedding Task Types
--------------------------------------
Google's embedding API requires specifying a `task_type` for optimal retrieval:
- RETRIEVAL_DOCUMENT: Use when SAVING/INGESTING content (storing experience blocks)
- RETRIEVAL_QUERY: Use when SEARCHING/QUERYING (finding relevant blocks)

Failure to separate these task types will significantly degrade retrieval quality.
See: https://ai.google.dev/gemini-api/docs/embeddings
"""

import hashlib
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Date,
    ForeignKey,
    Boolean,
    Index,
    select,
    and_,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship, Mapped
from sqlalchemy.sql import func
from sqlalchemy.ext.asyncio import AsyncSession
from pgvector.sqlalchemy import Vector

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.user import User


# Gemini text-embedding-004 outputs 768 dimensions natively
# Do NOT use 512 (truncated) or 1536 (OpenAI standard)
GEMINI_EMBEDDING_DIMENSIONS = 768


class ExperienceBlock(Base):
    """
    Atomic unit of career information for the Vault.

    Each block represents a single verifiable fact (achievement, responsibility,
    skill, project, etc.) that can be semantically searched and retrieved
    for resume tailoring.

    Embedding Strategy:
    - Uses Google's text-embedding-004 (768 dimensions)
    - HNSW index for O(log n) approximate nearest neighbor queries
    - Content hash prevents redundant API calls for unchanged content
    """

    __tablename__ = "experience_blocks"

    # Identity
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Content
    content = Column(Text, nullable=False)  # The actual text/fact
    block_type = Column(String(50), nullable=False)  # achievement, responsibility, skill, project, certification, education

    # Taxonomy for filtering
    tags: Mapped[list[str]] = Column(ARRAY(String), default=list)  # ["python", "leadership", "backend"]

    # Provenance (source context)
    source_company = Column(String(255), nullable=True)
    source_role = Column(String(255), nullable=True)
    source_date_start = Column(Date, nullable=True)
    source_date_end = Column(Date, nullable=True)  # NULL = current position

    # Embeddings (pgvector) - Optimized for Gemini text-embedding-004
    embedding = Column(Vector(GEMINI_EMBEDDING_DIMENSIONS), nullable=True)
    embedding_model = Column(String(100), default="text-embedding-004")

    # Lazy Update Support - SHA-256 hash of content to detect changes
    content_hash = Column(String(64), nullable=True)  # SHA-256 hex digest

    # Verification (user confirms accuracy)
    verified = Column(Boolean, default=False)
    verification_date = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)  # Soft delete

    # Relationships
    owner: Mapped["User"] = relationship("User", back_populates="experience_blocks")

    # Indexes - HNSW for fast approximate nearest neighbor search
    # HNSW params: m=16 (connections per layer), ef_construction=64 (build quality)
    __table_args__ = (
        # User lookup - most queries are scoped to a user
        Index("ix_experience_blocks_user_id", "user_id"),

        # HNSW vector index for semantic search
        # Using cosine distance (vector_cosine_ops) for normalized embeddings
        # m=16: Each node connects to 16 others (balance of speed/recall)
        # ef_construction=64: Build quality (higher = better recall, slower build)
        Index(
            "ix_experience_blocks_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),

        # GIN index for tag filtering (efficient array containment queries)
        Index("ix_experience_blocks_tags", "tags", postgresql_using="gin"),

        # Composite index for common filter patterns
        Index("ix_experience_blocks_user_type", "user_id", "block_type"),
    )

    def compute_content_hash(self) -> str:
        """
        Compute SHA-256 hash of the content for change detection.

        Returns:
            64-character hex digest of the content hash
        """
        return hashlib.sha256(self.content.encode("utf-8")).hexdigest()

    def check_needs_reembedding(self, new_content: str | None = None) -> bool:
        """
        Check if the block needs re-embedding based on content changes.

        This prevents burning API credits on content that hasn't changed.

        Args:
            new_content: Optional new content to compare against.
                        If None, uses the current self.content.

        Returns:
            True if embedding is missing or content has changed, False otherwise.
        """
        # Always need embedding if we don't have one
        if self.embedding is None:
            return True

        # Always need embedding if we don't have a stored hash
        if self.content_hash is None:
            return True

        # Check if content has changed
        content_to_check = new_content if new_content is not None else self.content
        new_hash = hashlib.sha256(content_to_check.encode("utf-8")).hexdigest()

        return new_hash != self.content_hash

    def update_content_hash(self) -> None:
        """Update the stored content hash after successful embedding."""
        self.content_hash = self.compute_content_hash()

    @classmethod
    async def search_experience(
        cls,
        db: AsyncSession,
        query_vector: list[float],
        user_id: int,
        limit: int = 20,
        block_types: list[str] | None = None,
        tags: list[str] | None = None,
        include_unverified: bool = True,
    ) -> list["ExperienceBlock"]:
        """
        Hybrid semantic search with filter-first optimization.

        CRITICAL: SQL filters (user_id, block_type, tags) are applied BEFORE
        vector distance calculation to minimize compute costs. This prevents
        the database from calculating distances for blocks that would be
        filtered out anyway.

        Args:
            db: Async database session
            query_vector: 768-dimensional query embedding
                         (MUST be generated with task_type="RETRIEVAL_QUERY")
            user_id: Filter to this user's blocks only (required for security)
            limit: Maximum number of results to return
            block_types: Optional list of block types to include
                        (e.g., ["achievement", "project"])
            tags: Optional list of tags - blocks must contain ALL specified tags
            include_unverified: Whether to include unverified blocks (default True)

        Returns:
            List of ExperienceBlock objects ordered by semantic similarity (closest first)

        Example:
            # Generate query embedding with RETRIEVAL_QUERY task type
            query_embedding = await embedding_service.embed_query("Python backend experience")

            # Search with filters applied BEFORE vector distance
            results = await ExperienceBlock.search_experience(
                db=db,
                query_vector=query_embedding,
                user_id=current_user.id,
                limit=10,
                block_types=["achievement", "project"],
                tags=["python", "backend"],
            )
        """
        # Build filter conditions - these are applied BEFORE vector distance
        conditions = [
            cls.user_id == user_id,
            cls.deleted_at.is_(None),  # Exclude soft-deleted
            cls.embedding.isnot(None),  # Must have embedding
        ]

        if not include_unverified:
            conditions.append(cls.verified == True)

        if block_types:
            conditions.append(cls.block_type.in_(block_types))

        if tags:
            # Array contains all specified tags (AND logic)
            conditions.append(cls.tags.contains(tags))

        # Build query with filter-first approach
        # The CTE/subquery pattern ensures filters are applied before distance calc
        stmt = (
            select(cls)
            .where(and_(*conditions))
            # Cosine distance (1 - cosine_similarity), lower is better
            .order_by(cls.embedding.cosine_distance(query_vector))
            .limit(limit)
        )

        result = await db.execute(stmt)
        return list(result.scalars().all())

    @classmethod
    async def get_blocks_needing_embedding(
        cls,
        db: AsyncSession,
        user_id: int | None = None,
        batch_size: int = 100,
    ) -> list["ExperienceBlock"]:
        """
        Get blocks that need embedding (new or content changed).

        Useful for batch embedding jobs and migration scripts.

        Args:
            db: Async database session
            user_id: Optional user filter (None = all users)
            batch_size: Maximum blocks to return

        Returns:
            List of ExperienceBlock objects needing embedding
        """
        conditions = [
            cls.deleted_at.is_(None),
            # Need embedding if: no embedding OR no hash (content changed check)
            (cls.embedding.is_(None)) | (cls.content_hash.is_(None)),
        ]

        if user_id is not None:
            conditions.append(cls.user_id == user_id)

        stmt = (
            select(cls)
            .where(and_(*conditions))
            .order_by(cls.created_at.asc())  # Oldest first
            .limit(batch_size)
        )

        result = await db.execute(stmt)
        return list(result.scalars().all())

    def __repr__(self) -> str:
        return (
            f"<ExperienceBlock(id={self.id}, type={self.block_type}, "
            f"user_id={self.user_id}, verified={self.verified})>"
        )
