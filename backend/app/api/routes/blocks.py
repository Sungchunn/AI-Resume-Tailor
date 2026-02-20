"""
Blocks Router - Vault API for Experience Blocks.

Provides CRUD operations for experience blocks (the Vault) including:
- Create, read, update, delete blocks
- Block verification
- Bulk import from resume content
- Embedding generation triggers
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session, get_current_user_id
from app.core.protocols import BlockType
from app.crud.block import block_repository
from app.schemas.block import (
    BlockCreate,
    BlockUpdate,
    BlockResponse,
    BlockListResponse,
    BlockImportRequest,
    BlockImportResponse,
    BlockEmbedRequest,
    BlockEmbedResponse,
    BlockVerifyRequest,
)
from app.services.ai.embedding import get_embedding_service

router = APIRouter()


@router.post("", response_model=BlockResponse, status_code=status.HTTP_201_CREATED)
async def create_block(
    block_in: BlockCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> BlockResponse:
    """
    Create a new experience block.

    The block will be created without an embedding. Use the /embed endpoint
    or POST /blocks/{id}/embed to generate embeddings.
    """
    block_data = await block_repository.create(
        db,
        user_id=current_user_id,
        content=block_in.content,
        block_type=block_in.block_type,
        tags=block_in.tags,
        source_company=block_in.source_company,
        source_role=block_in.source_role,
        source_date_start=block_in.source_date_start,
        source_date_end=block_in.source_date_end,
    )
    await db.commit()
    return BlockResponse.model_validate(block_data)


@router.get("", response_model=BlockListResponse)
async def list_blocks(
    block_types: list[BlockType] | None = Query(None, description="Filter by block types"),
    tags: list[str] | None = Query(None, description="Filter by tags (AND logic)"),
    verified_only: bool = Query(False, description="Only return verified blocks"),
    limit: int = Query(100, ge=1, le=500, description="Maximum results"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> BlockListResponse:
    """
    List experience blocks with optional filters.

    Supports filtering by block type, tags, and verification status.
    Results are paginated.
    """
    blocks = await block_repository.list_blocks(
        db,
        user_id=current_user_id,
        block_types=block_types,
        tags=tags,
        verified_only=verified_only,
        limit=limit,
        offset=offset,
    )

    total = await block_repository.count(
        db,
        user_id=current_user_id,
        block_types=block_types,
        tags=tags,
        verified_only=verified_only,
    )

    return BlockListResponse(
        blocks=[BlockResponse.model_validate(b) for b in blocks],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{block_id}", response_model=BlockResponse)
async def get_block(
    block_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> BlockResponse:
    """Get a single experience block by ID."""
    block = await block_repository.get(db, block_id=block_id, user_id=current_user_id)
    if not block:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Block not found",
        )
    return BlockResponse.model_validate(block)


@router.patch("/{block_id}", response_model=BlockResponse)
async def update_block(
    block_id: int,
    block_in: BlockUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> BlockResponse:
    """
    Update an experience block.

    Only provided fields are updated. If content is changed, the embedding
    will be marked as stale and should be regenerated.
    """
    block = await block_repository.update(
        db,
        block_id=block_id,
        user_id=current_user_id,
        content=block_in.content,
        block_type=block_in.block_type,
        tags=block_in.tags,
        verified=block_in.verified,
        source_company=block_in.source_company,
        source_role=block_in.source_role,
        source_date_start=block_in.source_date_start,
        source_date_end=block_in.source_date_end,
    )
    if not block:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Block not found",
        )
    await db.commit()
    return BlockResponse.model_validate(block)


@router.delete("/{block_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_block(
    block_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> None:
    """
    Soft delete an experience block.

    The block is not permanently deleted, just marked with a deleted_at timestamp.
    It will be excluded from searches and listings.
    """
    deleted = await block_repository.soft_delete(
        db,
        block_id=block_id,
        user_id=current_user_id,
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Block not found",
        )
    await db.commit()


@router.post("/{block_id}/verify", response_model=BlockResponse)
async def verify_block(
    block_id: int,
    verify_in: BlockVerifyRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> BlockResponse:
    """
    Mark a block as verified or unverified.

    Verified blocks are user-confirmed facts that can be trusted
    for resume generation.
    """
    block = await block_repository.verify(
        db,
        block_id=block_id,
        user_id=current_user_id,
        verified=verify_in.verified,
    )
    if not block:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Block not found",
        )
    await db.commit()
    return BlockResponse.model_validate(block)


@router.post("/import", response_model=BlockImportResponse, status_code=status.HTTP_201_CREATED)
async def import_blocks(
    import_in: BlockImportRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> BlockImportResponse:
    """
    Import blocks from raw resume content.

    Uses AI to split the content into atomic blocks and classify them.
    The imported blocks will need embedding generation after import.
    """
    # Import the services here to avoid circular imports
    from app.services.resume.block_splitter import get_block_splitter
    from app.services.resume.block_classifier import get_block_classifier

    splitter = get_block_splitter()
    classifier = get_block_classifier()

    # Split the raw content into atomic blocks
    split_blocks = await splitter.split(
        raw_content=import_in.raw_content,
        source_company=import_in.source_company,
        source_role=import_in.source_role,
    )

    created_blocks = []
    for split_block in split_blocks:
        # Classify if not already classified
        block_type_str = getattr(split_block, "block_type", None)
        if block_type_str:
            block_type = BlockType(block_type_str)
        else:
            block_type = await classifier.classify(split_block.content)

        # Suggest tags if not provided
        tags = getattr(split_block, "suggested_tags", [])
        if not tags:
            tags = await classifier.suggest_tags(split_block.content)

        # Create the block
        block_data = await block_repository.create(
            db,
            user_id=current_user_id,
            content=split_block.content,
            block_type=block_type,
            tags=tags,
            source_company=getattr(split_block, "source_company", None) or import_in.source_company,
            source_role=getattr(split_block, "source_role", None) or import_in.source_role,
        )
        created_blocks.append(block_data)

    await db.commit()

    return BlockImportResponse(
        imported_count=len(created_blocks),
        blocks=[BlockResponse.model_validate(b) for b in created_blocks],
    )


@router.post("/embed", response_model=BlockEmbedResponse)
async def embed_blocks(
    embed_in: BlockEmbedRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> BlockEmbedResponse:
    """
    Generate embeddings for blocks that need them.

    If block_ids is provided, only those blocks are embedded.
    Otherwise, all blocks needing embedding are processed.
    """
    embedding_service = get_embedding_service()

    if embed_in.block_ids:
        # Get specific blocks
        blocks_to_embed = await block_repository.get_by_ids(
            db,
            block_ids=embed_in.block_ids,
            user_id=current_user_id,
        )
    else:
        # Get all blocks needing embedding
        blocks_to_embed = await block_repository.get_needing_embedding(
            db,
            user_id=current_user_id,
            batch_size=100,
        )

    embedded_ids = []
    for block in blocks_to_embed:
        # Generate embedding
        embedding = await embedding_service.embed_document(block.content)
        content_hash = embedding_service.compute_content_hash(block.content)

        # Update the block
        await block_repository.update_embedding(
            db,
            block_id=block.id,
            embedding=embedding,
            content_hash=content_hash,
        )
        embedded_ids.append(block.id)

    await db.commit()

    return BlockEmbedResponse(
        embedded_count=len(embedded_ids),
        block_ids=embedded_ids,
    )


@router.post("/{block_id}/embed", response_model=BlockResponse)
async def embed_single_block(
    block_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> BlockResponse:
    """
    Generate embedding for a single block.

    Useful for immediately embedding a newly created or updated block.
    """
    block = await block_repository.get(db, block_id=block_id, user_id=current_user_id)
    if not block:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Block not found",
        )

    embedding_service = get_embedding_service()

    # Generate embedding
    embedding = await embedding_service.embed_document(block.content)
    content_hash = embedding_service.compute_content_hash(block.content)

    # Update the block
    await block_repository.update_embedding(
        db,
        block_id=block_id,
        embedding=embedding,
        content_hash=content_hash,
    )

    await db.commit()

    # Get updated block
    updated_block = await block_repository.get(db, block_id=block_id, user_id=current_user_id)
    return BlockResponse.model_validate(updated_block)
