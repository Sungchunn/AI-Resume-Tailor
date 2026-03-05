"""MongoDB Pydantic model for Resume documents."""

from datetime import datetime
from typing import Any

from bson import ObjectId
from pydantic import BaseModel, Field, field_serializer


class PyObjectId(ObjectId):
    """Custom ObjectId type for Pydantic models."""

    @classmethod
    def __get_pydantic_core_schema__(cls, _source_type, _handler):
        from pydantic_core import core_schema

        return core_schema.union_schema(
            [
                core_schema.is_instance_schema(ObjectId),
                core_schema.chain_schema(
                    [
                        core_schema.str_schema(),
                        core_schema.no_info_plain_validator_function(cls.validate),
                    ]
                ),
            ],
            serialization=core_schema.to_string_ser_schema(),
        )

    @classmethod
    def validate(cls, v: str) -> ObjectId:
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)


class ContactInfo(BaseModel):
    """Contact information in parsed resume."""

    name: str | None = None
    email: str | None = None
    phone: str | None = None
    location: str | None = None
    linkedin: str | None = None
    github: str | None = None
    website: str | None = None


class ExperienceEntry(BaseModel):
    """Work experience entry in parsed resume."""

    id: str | None = None  # Unique ID for frontend diffing in Two Copies architecture
    title: str | None = None
    company: str | None = None
    location: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    bullets: list[str] = Field(default_factory=list)


class EducationEntry(BaseModel):
    """Education entry in parsed resume."""

    id: str | None = None  # Unique ID for frontend diffing in Two Copies architecture
    degree: str | None = None
    institution: str | None = None
    location: str | None = None
    graduation_date: str | None = None
    gpa: str | None = None
    honors: list[str] = Field(default_factory=list)


class ProjectEntry(BaseModel):
    """Project entry in parsed resume."""

    id: str | None = None  # Unique ID for frontend diffing in Two Copies architecture
    name: str | None = None
    description: str | None = None
    technologies: list[str] = Field(default_factory=list)
    url: str | None = None


class ParsedContent(BaseModel):
    """Structured parsed content from resume."""

    contact: ContactInfo | None = None
    summary: str | None = None
    experience: list[ExperienceEntry] = Field(default_factory=list)
    education: list[EducationEntry] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    projects: list[ProjectEntry] = Field(default_factory=list)


class StyleSettings(BaseModel):
    """Style settings for resume rendering."""

    font_family: str | None = None
    font_size: int | None = None
    margins: dict[str, Any] | None = None
    line_height: float | None = None


class OriginalFile(BaseModel):
    """Original uploaded file information."""

    storage_key: str | None = None  # MinIO path
    filename: str | None = None
    file_type: str | None = None  # "pdf" or "docx"
    size_bytes: int | None = None


class ResumeDocument(BaseModel):
    """MongoDB Resume document schema."""

    id: PyObjectId | None = Field(default=None, alias="_id")
    user_id: int  # FK to Postgres users.id

    title: str
    is_master: bool = False  # Designates default resume for tailoring flows
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    raw_content: str
    html_content: str | None = None

    parsed: ParsedContent | None = None
    style: StyleSettings | None = None
    original_file: OriginalFile | None = None

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str},
    }

    @field_serializer("id")
    def serialize_id(self, v: PyObjectId | None) -> str | None:
        return str(v) if v else None


class ResumeCreate(BaseModel):
    """Schema for creating a new resume."""

    user_id: int
    title: str
    raw_content: str
    html_content: str | None = None
    parsed: ParsedContent | None = None
    style: StyleSettings | None = None
    original_file: OriginalFile | None = None
    is_master: bool = False


class ResumeUpdate(BaseModel):
    """Schema for updating an existing resume."""

    title: str | None = None
    raw_content: str | None = None
    html_content: str | None = None
    parsed: ParsedContent | None = None
    style: StyleSettings | None = None
    is_master: bool | None = None
