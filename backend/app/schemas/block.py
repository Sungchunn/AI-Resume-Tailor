"""
Pydantic schemas for ExperienceBlock (Vault) API endpoints.

These schemas handle request validation and response serialization
for all block-related operations.
"""

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field

from app.core.protocols import BlockType


class BlockBase(BaseModel):
    """Base schema with common block fields."""

    content: str = Field(..., min_length=1, description="The block content/text")
    block_type: BlockType = Field(..., description="Type classification of the block")
    tags: list[str] = Field(default_factory=list, description="Taxonomy tags")
    source_company: str | None = Field(None, max_length=255, description="Source company")
    source_role: str | None = Field(None, max_length=255, description="Job title at source")
    source_date_start: date | None = Field(None, description="When experience started")
    source_date_end: date | None = Field(None, description="When experience ended (None=current)")


class BlockCreate(BlockBase):
    """Schema for creating a new experience block."""

    pass


class BlockUpdate(BaseModel):
    """Schema for updating an experience block. All fields optional."""

    content: str | None = Field(None, min_length=1)
    block_type: BlockType | None = None
    tags: list[str] | None = None
    source_company: str | None = Field(None, max_length=255)
    source_role: str | None = Field(None, max_length=255)
    source_date_start: date | None = None
    source_date_end: date | None = None
    verified: bool | None = None


class BlockResponse(BlockBase):
    """Schema for block API responses."""

    id: int
    user_id: int
    verified: bool
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class BlockListResponse(BaseModel):
    """Schema for paginated block list responses."""

    blocks: list[BlockResponse]
    total: int
    limit: int
    offset: int


class BlockImportRequest(BaseModel):
    """Schema for importing blocks from resume content."""

    raw_content: str = Field(..., min_length=1, description="Raw resume text to split into blocks")
    source_company: str | None = Field(None, description="Default company for all blocks")
    source_role: str | None = Field(None, description="Default role for all blocks")


class BlockImportResponse(BaseModel):
    """Schema for import endpoint response."""

    imported_count: int
    blocks: list[BlockResponse]


class BlockEmbedRequest(BaseModel):
    """Schema for triggering embedding generation."""

    block_ids: list[int] | None = Field(None, description="Specific blocks to embed (None=all needing embedding)")


class BlockEmbedResponse(BaseModel):
    """Schema for embedding endpoint response."""

    embedded_count: int
    block_ids: list[int]


# Semantic Match Schemas

class SemanticMatchResult(BaseModel):
    """Schema for a single semantic match result."""

    block: BlockResponse
    score: float = Field(..., ge=0, le=1, description="Similarity score (0-1, higher is better)")
    matched_keywords: list[str] = Field(default_factory=list)


class MatchRequest(BaseModel):
    """Schema for semantic match request."""

    job_description: str = Field(..., min_length=1, description="Job description to match against")
    limit: int = Field(20, ge=1, le=100, description="Maximum results")
    block_types: list[BlockType] | None = Field(None, description="Filter by block types")
    tags: list[str] | None = Field(None, description="Filter by tags (AND logic)")


class MatchResponse(BaseModel):
    """Schema for semantic match response."""

    matches: list[SemanticMatchResult]
    query_keywords: list[str] = Field(default_factory=list, description="Keywords extracted from job")
    total_vault_blocks: int = Field(..., description="Total blocks in user's Vault")


class GapAnalysisResponse(BaseModel):
    """Schema for skill gap analysis."""

    match_score: int = Field(..., ge=0, le=100)
    skill_matches: list[str]
    skill_gaps: list[str]
    keyword_coverage: float = Field(..., ge=0, le=1)
    recommendations: list[str]


class BlockVerifyRequest(BaseModel):
    """Schema for verifying a block."""

    verified: bool = True
