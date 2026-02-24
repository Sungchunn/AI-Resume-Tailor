"""
Pydantic schemas for document export API endpoints.

Handles request validation for HTML-to-document export operations
with style templates and customization options.
"""

from typing import Literal

from pydantic import BaseModel, Field


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
