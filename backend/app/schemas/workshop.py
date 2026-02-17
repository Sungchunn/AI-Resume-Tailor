"""
Pydantic schemas for Workshop API endpoints.

These schemas handle request validation and response serialization
for all workshop-related operations.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any

from pydantic import BaseModel, Field

from app.core.protocols import WorkshopStatus, DiffOperation, SuggestionImpact


class DiffSuggestion(BaseModel):
    """Schema for a single diff-based suggestion."""

    operation: DiffOperation = Field(..., description="JSON Patch operation type")
    path: str = Field(..., description="JSON Pointer path (RFC 6901)")
    value: Any = Field(..., description="New value to apply")
    original_value: Optional[Any] = Field(None, description="Original value being replaced")
    reason: str = Field(..., description="Explanation for why this improves job fit")
    impact: SuggestionImpact = Field(..., description="Impact level of the suggestion")
    source_block_id: Optional[int] = Field(None, description="Vault block supporting this suggestion")


class WorkshopBase(BaseModel):
    """Base schema with common workshop fields."""

    job_title: str = Field(..., min_length=1, max_length=255)
    job_company: Optional[str] = Field(None, max_length=255)
    job_description: Optional[str] = Field(None, min_length=1)


class WorkshopCreate(WorkshopBase):
    """Schema for creating a new workshop."""

    pass


class WorkshopUpdate(BaseModel):
    """Schema for updating a workshop. All fields optional."""

    job_title: Optional[str] = Field(None, min_length=1, max_length=255)
    job_company: Optional[str] = Field(None, max_length=255)
    job_description: Optional[str] = None


class WorkshopResponse(WorkshopBase):
    """Schema for workshop API responses."""

    id: int
    user_id: int
    status: str
    sections: Dict[str, Any] = Field(default_factory=dict)
    pulled_block_ids: List[int] = Field(default_factory=list)
    pending_diffs: List[DiffSuggestion] = Field(default_factory=list)
    created_at: datetime
    updated_at: Optional[datetime] = None
    exported_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class WorkshopListResponse(BaseModel):
    """Schema for paginated workshop list responses."""

    workshops: List[WorkshopResponse]
    total: int
    limit: int
    offset: int


class PullBlocksRequest(BaseModel):
    """Schema for pulling blocks into a workshop."""

    block_ids: List[int] = Field(..., min_length=1, description="IDs of blocks to pull from Vault")


class PullBlocksResponse(BaseModel):
    """Schema for pull blocks response."""

    workshop: WorkshopResponse
    newly_pulled: List[int] = Field(..., description="Block IDs that were newly added")
    already_pulled: List[int] = Field(default_factory=list, description="Block IDs already in workshop")


class RemoveBlockRequest(BaseModel):
    """Schema for removing a block from a workshop."""

    block_id: int


class SuggestRequest(BaseModel):
    """Schema for requesting AI suggestions."""

    max_suggestions: int = Field(10, ge=1, le=50, description="Maximum suggestions to generate")
    focus_sections: Optional[List[str]] = Field(None, description="Sections to focus on (None=all)")


class SuggestResponse(BaseModel):
    """Schema for suggestion generation response."""

    workshop: WorkshopResponse
    new_suggestions_count: int
    gaps_identified: List[str] = Field(default_factory=list, description="Skill gaps with no Vault coverage")


class DiffActionRequest(BaseModel):
    """Schema for accepting or rejecting a diff."""

    diff_index: int = Field(..., ge=0, description="Index of the diff in pending_diffs")


class DiffActionResponse(BaseModel):
    """Schema for diff action response."""

    workshop: WorkshopResponse
    action: str = Field(..., description="accept or reject")
    applied_diff: Optional[DiffSuggestion] = None


class UpdateSectionsRequest(BaseModel):
    """Schema for updating workshop sections."""

    sections: Dict[str, Any] = Field(..., description="Section content to update/merge")


class UpdateStatusRequest(BaseModel):
    """Schema for updating workshop status."""

    status: WorkshopStatus


class WritebackRequest(BaseModel):
    """Schema for write-back request."""

    edited_content: str = Field(..., min_length=1, description="Content to write back to Vault")
    source_block_id: Optional[int] = Field(None, description="Original block ID if updating")
    create_new: bool = Field(False, description="Force creation of new block")


class WritebackProposal(BaseModel):
    """Schema for write-back proposal response."""

    action: str = Field(..., description="create or update")
    preview: Dict[str, Any] = Field(..., description="Preview of the block that would be created/updated")
    original: Optional[Dict[str, Any]] = Field(None, description="Original block if updating")
    changes: List[str] = Field(default_factory=list, description="List of changes detected")


class ExportRequest(BaseModel):
    """Schema for export request."""

    format: str = Field("docx", pattern="^(pdf|docx|txt|json)$", description="Export format")
    template: str = Field("default", description="Template to use")
