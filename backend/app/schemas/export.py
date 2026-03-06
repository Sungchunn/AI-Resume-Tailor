"""
Pydantic schemas for document export API endpoints.

Handles request validation for HTML-to-document export operations
with style templates and customization options.
"""

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class PageSize(str, Enum):
    """Supported page sizes for export."""
    LETTER = "letter"
    A4 = "a4"


class HTMLExportRequest(BaseModel):
    """Schema for exporting HTML content to PDF or DOCX."""

    html_content: str = Field(..., min_length=1, description="TipTap HTML content to export")
    format: Literal["pdf", "docx"] = Field("pdf", description="Export format")
    template: Literal["classic", "modern", "minimal"] = Field(
        "classic", description="Style template to apply"
    )
    font_family: str = Field("Arial", description="Font family for the document")
    font_size: int = Field(11, ge=8, le=16, description="Base font size in points")
    margin_top: float = Field(0.75, ge=0.25, le=2.0, description="Top margin in inches")
    margin_bottom: float = Field(0.75, ge=0.25, le=2.0, description="Bottom margin in inches")
    margin_left: float = Field(0.75, ge=0.25, le=2.0, description="Left margin in inches")
    margin_right: float = Field(0.75, ge=0.25, le=2.0, description="Right margin in inches")


class ResumeExportRequest(BaseModel):
    """Schema for exporting a resume by ID."""

    format: Literal["pdf", "docx"] = Field("pdf", description="Export format")
    template: Literal["classic", "modern", "minimal"] = Field(
        "classic", description="Style template to apply"
    )
    font_family: str = Field("Arial", description="Font family for the document")
    font_size: int = Field(11, ge=8, le=16, description="Base font size in points")
    margin_top: float = Field(0.75, ge=0.25, le=2.0, description="Top margin in inches")
    margin_bottom: float = Field(0.75, ge=0.25, le=2.0, description="Bottom margin in inches")
    margin_left: float = Field(0.75, ge=0.25, le=2.0, description="Left margin in inches")
    margin_right: float = Field(0.75, ge=0.25, le=2.0, description="Right margin in inches")


class ExportTemplateInfo(BaseModel):
    """Information about an export template."""

    name: str
    description: str
    preview_image: str | None = None


class ExportTemplatesResponse(BaseModel):
    """Response containing available export templates."""

    templates: list[ExportTemplateInfo]


class FitToPageRequest(BaseModel):
    """Request to calculate fit-to-page adjustments."""

    html_content: str = Field(..., min_length=1, description="HTML content to fit")
    font_size: int = Field(11, ge=8, le=16, description="Base font size in points")
    margin_top: float = Field(0.75, ge=0.5, le=2.0, description="Top margin in inches")
    margin_bottom: float = Field(0.75, ge=0.5, le=2.0, description="Bottom margin in inches")
    margin_left: float = Field(0.75, ge=0.5, le=2.0, description="Left margin in inches")
    margin_right: float = Field(0.75, ge=0.5, le=2.0, description="Right margin in inches")
    line_spacing: float = Field(1.4, ge=1.1, le=2.0, description="Line height multiplier")
    section_spacing: int = Field(16, ge=8, le=32, description="Section spacing in pixels")
    entry_spacing: int = Field(8, ge=4, le=16, description="Entry spacing in pixels")
    page_size: PageSize = Field(PageSize.LETTER, description="Page size")
    max_iterations: int = Field(5, ge=1, le=10, description="Maximum compression iterations")


class StyleReduction(BaseModel):
    """A single style reduction applied during compression."""

    property: str
    from_value: float
    to_value: float
    label: str


class FitToPageResponse(BaseModel):
    """Response with adjusted styles and page count."""

    page_count: int
    adjusted_style: dict
    reductions_applied: list[StyleReduction]
    warning: str | None = None
