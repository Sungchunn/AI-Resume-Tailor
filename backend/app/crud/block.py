"""
Block Repository - Data access layer for ExperienceBlocks (the Vault).

Implements the IBlockRepository protocol for all database operations
related to experience blocks.
"""

from datetime import date, datetime
from typing import Optional, List

from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.experience_block import ExperienceBlock
from app.core.protocols import (
    BlockType,
    ExperienceBlockData,
    SemanticMatchData,
)


def _block_to_data(block: ExperienceBlock) -> ExperienceBlockData:
    """Convert ExperienceBlock model to ExperienceBlockData TypedDict."""
    return {
        "id": block.id,
        "user_id": block.user_id,
        "content": block.content,
        "block_type": block.block_type,
        "tags": block.tags or [],
        "source_company": block.source_company,
        "source_role": block.source_role,
        "source_date_start": block.source_date_start.isoformat() if block.source_date_start else None,
        "source_date_end": block.source_date_end.isoformat() if block.source_date_end else None,
        "verified": block.verified,
        "created_at": block.created_at.isoformat() if block.created_at else None,
        "updated_at": block.updated_at.isoformat() if block.updated_at else None,
    }


class BlockRepository:
    """
    Repository for ExperienceBlock CRUD operations.

    Implements IBlockRepository protocol.
    All methods include user_id checks for authorization.
    """

    async def create(
        self,
        db: AsyncSession,
        *,
        user_id: int,
        content: str,
        block_type: BlockType,
        tags: Optional[List[str]] = None,
        source_company: Optional[str] = None,
        source_role: Optional[str] = None,
        source_date_start: Optional[date] = None,
        source_date_end: Optional[date] = None,
    ) -> ExperienceBlockData:
        """
        Create a new experience block.

        Note: Embedding is NOT generated here. Use the embedding service
        separately to generate embeddings, then call update_embedding.
        """
        db_obj = ExperienceBlock(
            user_id=user_id,
            content=content,
            block_type=block_type.value if isinstance(block_type, BlockType) else block_type,
            tags=tags or [],
            source_company=source_company,
            source_role=source_role,
            source_date_start=source_date_start,
            source_date_end=source_date_end,
        )
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return _block_to_data(db_obj)

    async def get(
        self,
        db: AsyncSession,
        *,
        block_id: int,
        user_id: int,
    ) -> Optional[ExperienceBlockData]:
        """Get block by ID with user ownership check."""
        result = await db.execute(
            select(ExperienceBlock).where(
                and_(
                    ExperienceBlock.id == block_id,
                    ExperienceBlock.user_id == user_id,
                    ExperienceBlock.deleted_at.is_(None),
                )
            )
        )
        block = result.scalar_one_or_none()
        return _block_to_data(block) if block else None

    async def get_model(
        self,
        db: AsyncSession,
        *,
        block_id: int,
        user_id: int,
    ) -> Optional[ExperienceBlock]:
        """Get the raw SQLAlchemy model (for internal use)."""
        result = await db.execute(
            select(ExperienceBlock).where(
                and_(
                    ExperienceBlock.id == block_id,
                    ExperienceBlock.user_id == user_id,
                    ExperienceBlock.deleted_at.is_(None),
                )
            )
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        db: AsyncSession,
        *,
        user_id: int,
        block_types: Optional[List[BlockType]] = None,
        tags: Optional[List[str]] = None,
        verified_only: bool = False,
        limit: int = 100,
        offset: int = 0,
    ) -> List[ExperienceBlockData]:
        """List blocks with filters."""
        conditions = [
            ExperienceBlock.user_id == user_id,
            ExperienceBlock.deleted_at.is_(None),
        ]

        if block_types:
            type_values = [bt.value if isinstance(bt, BlockType) else bt for bt in block_types]
            conditions.append(ExperienceBlock.block_type.in_(type_values))

        if tags:
            # Array contains all specified tags (AND logic)
            conditions.append(ExperienceBlock.tags.contains(tags))

        if verified_only:
            conditions.append(ExperienceBlock.verified == True)

        result = await db.execute(
            select(ExperienceBlock)
            .where(and_(*conditions))
            .order_by(ExperienceBlock.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        blocks = result.scalars().all()
        return [_block_to_data(b) for b in blocks]

    async def count(
        self,
        db: AsyncSession,
        *,
        user_id: int,
        block_types: Optional[List[BlockType]] = None,
        tags: Optional[List[str]] = None,
        verified_only: bool = False,
    ) -> int:
        """Count blocks matching filters."""
        conditions = [
            ExperienceBlock.user_id == user_id,
            ExperienceBlock.deleted_at.is_(None),
        ]

        if block_types:
            type_values = [bt.value if isinstance(bt, BlockType) else bt for bt in block_types]
            conditions.append(ExperienceBlock.block_type.in_(type_values))

        if tags:
            conditions.append(ExperienceBlock.tags.contains(tags))

        if verified_only:
            conditions.append(ExperienceBlock.verified == True)

        result = await db.execute(
            select(func.count(ExperienceBlock.id)).where(and_(*conditions))
        )
        return result.scalar() or 0

    async def update(
        self,
        db: AsyncSession,
        *,
        block_id: int,
        user_id: int,
        content: Optional[str] = None,
        block_type: Optional[BlockType] = None,
        tags: Optional[List[str]] = None,
        verified: Optional[bool] = None,
        source_company: Optional[str] = None,
        source_role: Optional[str] = None,
        source_date_start: Optional[date] = None,
        source_date_end: Optional[date] = None,
    ) -> Optional[ExperienceBlockData]:
        """
        Update block with user ownership check.

        Note: If content changes, the content_hash will become stale.
        Call update_embedding after content changes to refresh the embedding.
        """
        block = await self.get_model(db, block_id=block_id, user_id=user_id)
        if not block:
            return None

        if content is not None:
            block.content = content
            # Mark content_hash as stale so embedding gets regenerated
            block.content_hash = None

        if block_type is not None:
            block.block_type = block_type.value if isinstance(block_type, BlockType) else block_type

        if tags is not None:
            block.tags = tags

        if verified is not None:
            block.verified = verified
            if verified:
                block.verification_date = datetime.utcnow()

        if source_company is not None:
            block.source_company = source_company

        if source_role is not None:
            block.source_role = source_role

        if source_date_start is not None:
            block.source_date_start = source_date_start

        if source_date_end is not None:
            block.source_date_end = source_date_end

        db.add(block)
        await db.flush()
        await db.refresh(block)
        return _block_to_data(block)

    async def soft_delete(
        self,
        db: AsyncSession,
        *,
        block_id: int,
        user_id: int,
    ) -> bool:
        """Soft delete block (sets deleted_at timestamp)."""
        block = await self.get_model(db, block_id=block_id, user_id=user_id)
        if not block:
            return False

        block.deleted_at = datetime.utcnow()
        db.add(block)
        await db.flush()
        return True

    async def search_semantic(
        self,
        db: AsyncSession,
        *,
        user_id: int,
        query_embedding: List[float],
        limit: int = 20,
        block_types: Optional[List[BlockType]] = None,
        tags: Optional[List[str]] = None,
    ) -> List[SemanticMatchData]:
        """
        Semantic search using vector similarity.

        IMPORTANT: query_embedding MUST be generated with
        task_type="RETRIEVAL_QUERY" for optimal results.

        Uses filter-first optimization: SQL filters applied BEFORE
        vector distance calculation to minimize compute costs.
        """
        conditions = [
            ExperienceBlock.user_id == user_id,
            ExperienceBlock.deleted_at.is_(None),
            ExperienceBlock.embedding.isnot(None),
        ]

        if block_types:
            type_values = [bt.value if isinstance(bt, BlockType) else bt for bt in block_types]
            conditions.append(ExperienceBlock.block_type.in_(type_values))

        if tags:
            conditions.append(ExperienceBlock.tags.contains(tags))

        # Query with cosine distance (lower is better, so we convert to similarity score)
        result = await db.execute(
            select(
                ExperienceBlock,
                (1 - ExperienceBlock.embedding.cosine_distance(query_embedding)).label("similarity")
            )
            .where(and_(*conditions))
            .order_by(ExperienceBlock.embedding.cosine_distance(query_embedding))
            .limit(limit)
        )

        matches = []
        for row in result.all():
            block = row[0]
            similarity = row[1]
            matches.append({
                "block": _block_to_data(block),
                "score": float(similarity) if similarity else 0.0,
                "matched_keywords": [],  # Populated by SemanticMatcher service
            })

        return matches

    async def get_needing_embedding(
        self,
        db: AsyncSession,
        *,
        user_id: Optional[int] = None,
        batch_size: int = 100,
    ) -> List[ExperienceBlockData]:
        """Get blocks that need embedding generation."""
        conditions = [
            ExperienceBlock.deleted_at.is_(None),
            # Need embedding if: no embedding OR no hash (content changed)
            (ExperienceBlock.embedding.is_(None)) | (ExperienceBlock.content_hash.is_(None)),
        ]

        if user_id is not None:
            conditions.append(ExperienceBlock.user_id == user_id)

        result = await db.execute(
            select(ExperienceBlock)
            .where(and_(*conditions))
            .order_by(ExperienceBlock.created_at.asc())
            .limit(batch_size)
        )
        blocks = result.scalars().all()
        return [_block_to_data(b) for b in blocks]

    async def update_embedding(
        self,
        db: AsyncSession,
        *,
        block_id: int,
        embedding: List[float],
        content_hash: str,
    ) -> None:
        """Update block's embedding and content hash."""
        result = await db.execute(
            select(ExperienceBlock).where(ExperienceBlock.id == block_id)
        )
        block = result.scalar_one_or_none()
        if block:
            block.embedding = embedding
            block.content_hash = content_hash
            db.add(block)
            await db.flush()

    async def verify(
        self,
        db: AsyncSession,
        *,
        block_id: int,
        user_id: int,
        verified: bool = True,
    ) -> Optional[ExperienceBlockData]:
        """Mark block as verified or unverified."""
        return await self.update(
            db,
            block_id=block_id,
            user_id=user_id,
            verified=verified,
        )

    async def get_by_ids(
        self,
        db: AsyncSession,
        *,
        block_ids: List[int],
        user_id: int,
    ) -> List[ExperienceBlockData]:
        """Get multiple blocks by IDs (for workshop block pulling)."""
        if not block_ids:
            return []

        result = await db.execute(
            select(ExperienceBlock).where(
                and_(
                    ExperienceBlock.id.in_(block_ids),
                    ExperienceBlock.user_id == user_id,
                    ExperienceBlock.deleted_at.is_(None),
                )
            )
        )
        blocks = result.scalars().all()
        return [_block_to_data(b) for b in blocks]


# Singleton instance
block_repository = BlockRepository()
