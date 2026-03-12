"""MongoDB Pydantic model for Resume documents."""

from datetime import datetime
from typing import Any

from bson import ObjectId
from pydantic import BaseModel, Field, field_serializer, model_validator


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
    minor: str | None = None
    relevant_courses: list[str] = Field(default_factory=list)


class ProjectEntry(BaseModel):
    """Project entry in parsed resume."""

    id: str | None = None  # Unique ID for frontend diffing in Two Copies architecture
    name: str | None = None
    description: str | None = None
    technologies: list[str] = Field(default_factory=list)
    url: str | None = None
    bullets: list[str] = Field(default_factory=list)
    start_date: str | None = None
    end_date: str | None = None


class LanguageEntry(BaseModel):
    """Language proficiency entry in parsed resume."""

    id: str | None = None
    language: str | None = None
    proficiency: str | None = None


class VolunteerEntry(BaseModel):
    """Volunteer experience entry in parsed resume."""

    id: str | None = None
    role: str | None = None
    organization: str | None = None
    location: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    description: str | None = None
    bullets: list[str] = Field(default_factory=list)


class PublicationEntry(BaseModel):
    """Publication entry in parsed resume."""

    id: str | None = None
    title: str | None = None
    authors: list[str] = Field(default_factory=list)
    publication: str | None = None  # Journal/Conference name
    date: str | None = None
    url: str | None = None
    doi: str | None = None


class AwardEntry(BaseModel):
    """Award/honor entry in parsed resume."""

    id: str | None = None
    title: str | None = None
    issuer: str | None = None
    date: str | None = None
    description: str | None = None


class ReferenceEntry(BaseModel):
    """Professional reference entry in parsed resume."""

    id: str | None = None
    name: str | None = None
    title: str | None = None
    company: str | None = None
    email: str | None = None
    phone: str | None = None
    relationship: str | None = None


class CourseEntry(BaseModel):
    """Course/training entry in parsed resume."""

    id: str | None = None
    name: str | None = None
    institution: str | None = None
    date: str | None = None
    description: str | None = None


class MembershipEntry(BaseModel):
    """Professional membership entry in parsed resume."""

    id: str | None = None
    organization: str | None = None
    role: str | None = None
    start_date: str | None = None
    end_date: str | None = None


class LeadershipEntry(BaseModel):
    """Leadership experience entry in parsed resume."""

    id: str | None = None
    title: str | None = None  # Changed from role to match frontend
    organization: str | None = None
    location: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    description: str | None = None
    bullets: list[str] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def migrate_role_to_title(cls, data: Any) -> Any:
        """Migrate old `role` field to `title` for backward compatibility."""
        if isinstance(data, dict) and "role" in data and "title" not in data:
            data["title"] = data.pop("role")
        return data


class CertificationEntry(BaseModel):
    """Certification entry in parsed resume."""

    id: str | None = None
    name: str | None = None
    issuer: str | None = None
    date: str | None = None
    expiry_date: str | None = None
    credential_id: str | None = None
    url: str | None = None


class ParsedContent(BaseModel):
    """Structured parsed content from resume.

    Supports all 16 section types for comprehensive resume parsing.
    """

    contact: ContactInfo | None = None
    summary: str | None = None
    experience: list[ExperienceEntry] = Field(default_factory=list)
    education: list[EducationEntry] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    certifications: list[CertificationEntry] = Field(default_factory=list)
    projects: list[ProjectEntry] = Field(default_factory=list)
    languages: list[LanguageEntry] = Field(default_factory=list)
    volunteer: list[VolunteerEntry] = Field(default_factory=list)
    publications: list[PublicationEntry] = Field(default_factory=list)
    awards: list[AwardEntry] = Field(default_factory=list)
    interests: str | None = None
    references: list[ReferenceEntry] = Field(default_factory=list)
    courses: list[CourseEntry] = Field(default_factory=list)
    memberships: list[MembershipEntry] = Field(default_factory=list)
    leadership: list[LeadershipEntry] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def migrate_certifications(cls, data: Any) -> Any:
        """Migrate old certifications format (list[str]) to new format (list[CertificationEntry]).

        This ensures backwards compatibility with existing resumes that have
        certifications stored as plain strings.
        """
        if isinstance(data, dict) and "certifications" in data:
            certs = data["certifications"]
            if certs and isinstance(certs, list) and len(certs) > 0:
                # Check if first item is a string (old format)
                if isinstance(certs[0], str):
                    data["certifications"] = [
                        {"name": cert} for cert in certs
                    ]
        return data


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

    # Verification status for Parse-Once, Tailor-Many architecture
    parsed_verified: bool = False
    parsed_verified_at: datetime | None = None

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
    parsed_verified: bool | None = None
