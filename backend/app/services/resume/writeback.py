"""
Write-Back Service - Save Workshop edits back to the Vault.

When users edit content in the Workshop, they can optionally save
those edits back to their Vault as new or updated blocks.
"""

import json
from functools import lru_cache
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.protocols import (
    ExperienceBlockData,
    WritebackProposalData,
    BlockType,
)
from app.crud.block import block_repository
from app.services.resume.block_classifier import get_block_classifier
from app.services.ai.embedding import get_embedding_service


class WriteBackService:
    """
    Service for the write-back loop.

    Implements IWriteBackService protocol.

    Allows users to:
    1. Preview what would be saved to Vault
    2. Create new blocks from Workshop edits
    3. Update existing blocks with edits
    """

    def __init__(self):
        self.classifier = get_block_classifier()
        self.embedding_service = get_embedding_service()

    async def propose_writeback(
        self,
        db: AsyncSession,
        workshop_id: int,
        user_id: int,
        edited_content: str,
        source_block_id: int | None = None,
    ) -> WritebackProposalData:
        """
        Propose a write-back to the Vault.

        Shows user what would happen before executing.

        Args:
            db: Database session
            workshop_id: Source workshop
            user_id: User ID for authorization
            edited_content: The edited content to write back
            source_block_id: Original block if editing existing

        Returns:
            Proposal showing action (create/update) and preview
        """
        # Classify the content to determine block type
        block_type = await self.classifier.classify(edited_content)

        # Suggest tags for the content
        tags = await self.classifier.suggest_tags(edited_content)

        # Check if this is an update or create
        original_block = None
        changes = []

        if source_block_id:
            original_block = await block_repository.get(
                db,
                block_id=source_block_id,
                user_id=user_id,
            )

            if original_block:
                # Calculate changes
                if original_block["content"] != edited_content:
                    changes.append("Content modified")
                if original_block["block_type"] != block_type.value:
                    changes.append(f"Type changed from {original_block['block_type']} to {block_type.value}")
                if set(original_block.get("tags", [])) != set(tags):
                    changes.append("Tags updated")

        # Build preview
        now = datetime.utcnow().isoformat()
        preview: ExperienceBlockData = {
            "id": source_block_id or 0,  # 0 indicates new
            "user_id": user_id,
            "content": edited_content,
            "block_type": block_type.value,
            "tags": tags,
            "source_company": original_block.get("source_company") if original_block else None,
            "source_role": original_block.get("source_role") if original_block else None,
            "source_date_start": original_block.get("source_date_start") if original_block else None,
            "source_date_end": original_block.get("source_date_end") if original_block else None,
            "verified": False,  # New/edited content needs re-verification
            "created_at": original_block.get("created_at") if original_block else now,
            "updated_at": now if original_block else None,
        }

        action = "update" if original_block else "create"
        if not changes and original_block:
            changes.append("No changes detected")

        return {
            "action": action,
            "preview": preview,
            "original": original_block,
            "changes": changes,
        }

    async def execute_writeback(
        self,
        db: AsyncSession,
        workshop_id: int,
        user_id: int,
        edited_content: str,
        source_block_id: int | None = None,
        create_new: bool = False,
    ) -> ExperienceBlockData:
        """
        Execute a write-back to the Vault.

        If create_new=True or source_block_id is None, creates new block.
        Otherwise updates the existing block.

        Args:
            db: Database session
            workshop_id: Source workshop
            user_id: User ID for authorization
            edited_content: Content to save
            source_block_id: Block to update (if any)
            create_new: Force creation of new block

        Returns:
            Created or updated block data
        """
        # Classify content
        block_type = await self.classifier.classify(edited_content)

        # Suggest tags
        tags = await self.classifier.suggest_tags(edited_content)

        # Decide: create or update
        if create_new or not source_block_id:
            # Create new block
            block = await block_repository.create(
                db,
                user_id=user_id,
                content=edited_content,
                block_type=block_type,
                tags=tags,
            )
        else:
            # Update existing block
            original = await block_repository.get(
                db,
                block_id=source_block_id,
                user_id=user_id,
            )

            if not original:
                # Block not found, create new
                block = await block_repository.create(
                    db,
                    user_id=user_id,
                    content=edited_content,
                    block_type=block_type,
                    tags=tags,
                )
            else:
                # Preserve source information from original
                block = await block_repository.update(
                    db,
                    block_id=source_block_id,
                    user_id=user_id,
                    content=edited_content,
                    block_type=block_type,
                    tags=tags,
                    verified=False,  # Needs re-verification after edit
                )

        # Generate embedding for the new/updated content
        embedding = await self.embedding_service.embed_document(edited_content)
        content_hash = self.embedding_service.compute_content_hash(edited_content)

        await block_repository.update_embedding(
            db,
            block_id=block["id"],
            embedding=embedding,
            content_hash=content_hash,
        )

        # Commit and return
        await db.commit()

        # Refresh to get updated data
        updated_block = await block_repository.get(
            db,
            block_id=block["id"],
            user_id=user_id,
        )

        return updated_block or block

    async def merge_blocks(
        self,
        db: AsyncSession,
        user_id: int,
        block_ids: list[int],
        merged_content: str,
    ) -> ExperienceBlockData:
        """
        Merge multiple blocks into a single new block.

        Useful when the user wants to combine related experiences.

        Args:
            db: Database session
            user_id: User ID for authorization
            block_ids: IDs of blocks to merge
            merged_content: The merged content

        Returns:
            New merged block
        """
        # Get original blocks for metadata
        original_blocks = await block_repository.get_by_ids(
            db,
            block_ids=block_ids,
            user_id=user_id,
        )

        if not original_blocks:
            raise ValueError("No valid blocks to merge")

        # Classify merged content
        block_type = await self.classifier.classify(merged_content)

        # Combine tags from all original blocks
        all_tags = set()
        for block in original_blocks:
            all_tags.update(block.get("tags", []))

        # Add any new tags from the merged content
        new_tags = await self.classifier.suggest_tags(merged_content)
        all_tags.update(new_tags)

        # Use source info from first block (could be smarter here)
        first_block = original_blocks[0]

        # Create merged block
        merged_block = await block_repository.create(
            db,
            user_id=user_id,
            content=merged_content,
            block_type=block_type,
            tags=list(all_tags)[:10],  # Limit tags
            source_company=first_block.get("source_company"),
            source_role=first_block.get("source_role"),
        )

        # Generate embedding
        embedding = await self.embedding_service.embed_document(merged_content)
        content_hash = self.embedding_service.compute_content_hash(merged_content)

        await block_repository.update_embedding(
            db,
            block_id=merged_block["id"],
            embedding=embedding,
            content_hash=content_hash,
        )

        await db.commit()

        return merged_block


@lru_cache
def get_writeback_service() -> WriteBackService:
    """Get a singleton WriteBackService instance."""
    return WriteBackService()
