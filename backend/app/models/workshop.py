"""
Workshop Model - Job-specific tailoring workspace

Workshops are where users build tailored resumes for specific jobs.
Each workshop:
- Targets one job description
- Pulls relevant experience blocks from the user's Vault
- Accumulates AI-generated diff suggestions
- Tracks sections of the resume being built
- Can be exported to PDF/DOCX when complete
"""

from datetime import datetime
from typing import Optional, List, Dict, Any, TYPE_CHECKING

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    Index,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import relationship, Mapped
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.user import User


# Match Gemini text-embedding-004 output dimensions
GEMINI_EMBEDDING_DIMENSIONS = 768


class Workshop(Base):
    """
    Job-specific workspace for resume tailoring.

    Workflow:
    1. User creates workshop with job title/description
    2. System embeds job description for semantic matching
    3. User pulls relevant blocks from their Vault
    4. AI generates diff-based suggestions
    5. User accepts/rejects suggestions
    6. User exports final resume

    The pending_diffs field stores AI suggestions as JSON Patch operations
    (RFC 6902) which can be accepted/rejected individually.
    """

    __tablename__ = "workshops"

    # Identity
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Job information
    job_title = Column(String(255), nullable=False)
    job_company = Column(String(255), nullable=True)
    job_description = Column(Text, nullable=True)

    # Job embedding for semantic matching with experience blocks
    job_embedding = Column(Vector(GEMINI_EMBEDDING_DIMENSIONS), nullable=True)

    # Workflow status: draft, in_progress, exported
    status = Column(String(50), default="draft")

    # Resume sections being built (JSONB for flexibility)
    # Structure: {"summary": "...", "experience": [...], "skills": [...]}
    sections: Mapped[Dict[str, Any]] = Column(JSONB, default=dict)

    # IDs of experience blocks pulled from the Vault
    pulled_block_ids: Mapped[List[int]] = Column(ARRAY(Integer), default=list)

    # Pending AI suggestions (JSON Patch operations)
    # Each diff has: operation, path, value, reason, impact, source_block_id
    pending_diffs: Mapped[List[Dict[str, Any]]] = Column(JSONB, default=list)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    exported_at = Column(DateTime(timezone=True), nullable=True)  # Last export time

    # Relationships
    owner: Mapped["User"] = relationship("User", back_populates="workshops")

    # Indexes
    __table_args__ = (
        Index("ix_workshops_user_id", "user_id"),
        Index("ix_workshops_status", "user_id", "status"),
    )

    def is_draft(self) -> bool:
        """Check if workshop is in draft status."""
        return self.status == "draft"

    def is_in_progress(self) -> bool:
        """Check if workshop is being actively worked on."""
        return self.status == "in_progress"

    def is_exported(self) -> bool:
        """Check if workshop has been exported."""
        return self.status == "exported"

    def mark_in_progress(self) -> None:
        """Transition workshop to in_progress status."""
        if self.status == "draft":
            self.status = "in_progress"

    def mark_exported(self) -> None:
        """Transition workshop to exported status and record timestamp."""
        self.status = "exported"
        self.exported_at = datetime.utcnow()

    def add_pulled_block(self, block_id: int) -> None:
        """Add a block ID to the pulled blocks list."""
        if self.pulled_block_ids is None:
            self.pulled_block_ids = []
        if block_id not in self.pulled_block_ids:
            self.pulled_block_ids = self.pulled_block_ids + [block_id]

    def remove_pulled_block(self, block_id: int) -> None:
        """Remove a block ID from the pulled blocks list."""
        if self.pulled_block_ids and block_id in self.pulled_block_ids:
            self.pulled_block_ids = [bid for bid in self.pulled_block_ids if bid != block_id]

    def add_pending_diff(self, diff: Dict[str, Any]) -> None:
        """Add a diff suggestion to pending diffs."""
        if self.pending_diffs is None:
            self.pending_diffs = []
        self.pending_diffs = self.pending_diffs + [diff]

    def get_pending_diff(self, index: int) -> Optional[Dict[str, Any]]:
        """Get a specific pending diff by index."""
        if self.pending_diffs and 0 <= index < len(self.pending_diffs):
            return self.pending_diffs[index]
        return None

    def remove_pending_diff(self, index: int) -> Optional[Dict[str, Any]]:
        """Remove and return a pending diff by index."""
        if self.pending_diffs and 0 <= index < len(self.pending_diffs):
            diff = self.pending_diffs[index]
            self.pending_diffs = (
                self.pending_diffs[:index] + self.pending_diffs[index + 1:]
            )
            return diff
        return None

    def clear_pending_diffs(self) -> None:
        """Clear all pending diffs."""
        self.pending_diffs = []

    def update_section(self, section_name: str, content: Any) -> None:
        """Update a specific section of the resume."""
        if self.sections is None:
            self.sections = {}
        new_sections = dict(self.sections)
        new_sections[section_name] = content
        self.sections = new_sections

    def get_section(self, section_name: str) -> Optional[Any]:
        """Get a specific section of the resume."""
        if self.sections:
            return self.sections.get(section_name)
        return None

    def __repr__(self) -> str:
        return (
            f"<Workshop(id={self.id}, job_title='{self.job_title}', "
            f"user_id={self.user_id}, status='{self.status}')>"
        )
