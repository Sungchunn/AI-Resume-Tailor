"""AI Chat Schemas for Resume Section Improvements."""

from typing import Literal

from pydantic import BaseModel, Field

# Section types that can be improved
SectionType = Literal[
    "summary",
    "experience",
    "education",
    "skills",
    "projects",
    "certifications",
    "volunteer",
    "publications",
    "awards",
    "interests",
    "languages",
    "references",
    "courses",
    "memberships",
]


class ImproveSectionRequest(BaseModel):
    """Request to improve a resume section using AI."""

    section_type: SectionType = Field(
        description="The type of section being improved"
    )
    section_content: str = Field(
        description="The current content of the section (JSON string or plain text)"
    )
    instruction: str = Field(
        description="User instruction for how to improve the section",
        examples=[
            "Make this more concise",
            "Add more action verbs",
            "Improve for a software engineer role",
            "Highlight leadership experience",
        ],
    )
    job_context: str | None = Field(
        default=None,
        description="Optional job description to tailor improvements towards",
    )


class ImproveSectionResponse(BaseModel):
    """Response containing AI-improved section content."""

    improved_content: str = Field(
        description="The improved content for the section"
    )
    changes_summary: str = Field(
        description="Brief summary of what was changed and why"
    )
    suggestions: list[str] = Field(
        default_factory=list,
        description="Additional suggestions for further improvement",
    )


class ChatMessage(BaseModel):
    """A single message in the chat history."""

    role: Literal["user", "assistant"] = Field(description="Who sent the message")
    content: str = Field(description="The message content")


class ChatRequest(BaseModel):
    """Request for a conversational AI chat about resume improvement."""

    message: str = Field(description="The user's message")
    section_type: SectionType | None = Field(
        default=None,
        description="Optional section type for context",
    )
    section_content: str | None = Field(
        default=None,
        description="Optional current section content for context",
    )
    chat_history: list[ChatMessage] = Field(
        default_factory=list,
        description="Previous messages in the conversation",
    )
    job_context: str | None = Field(
        default=None,
        description="Optional job description for context",
    )


class ChatResponse(BaseModel):
    """Response from the AI chat."""

    message: str = Field(description="The assistant's response")
    improved_content: str | None = Field(
        default=None,
        description="If the response includes improved content, it will be here",
    )
    action_type: Literal["advice", "improvement", "question"] = Field(
        description="Type of response: advice (general tips), improvement (content changes), question (clarifying)"
    )


# ─── Rewrite Resume Schemas ───────────────────────────────────────────────────


class BulletEntryContext(BaseModel):
    """Contextual information about the experience entry containing a bullet."""

    title: str = Field(default="", description="Job title or role name")
    company: str = Field(default="", description="Company or organization name")
    date_range: str = Field(default="", description="Employment date range")


class BulletRewriteItem(BaseModel):
    """A single bullet point to be rewritten."""

    element_id: str = Field(description="DOM element ID (blockId:entryId:bullets:N)")
    text: str = Field(description="Current bullet text")
    entry_context: BulletEntryContext = Field(
        default_factory=BulletEntryContext,
        description="Context about the parent experience entry",
    )


class RewriteOptions(BaseModel):
    """Controls which parts of the resume are rewritten."""

    rewrite_bullets: bool = Field(default=True)
    rewrite_summary: bool = Field(default=True)


class RewriteResumeRequest(BaseModel):
    """Request to rewrite an entire resume targeted at a specific job."""

    resume_id: str = Field(description="ID of the resume being rewritten")
    job_id: str = Field(description="ID of the target job")
    job_description: str = Field(description="Full text of the job description")
    bullets: list[BulletRewriteItem] = Field(
        default_factory=list,
        description="All bullets to rewrite",
    )
    summary: str | None = Field(
        default=None,
        description="Current summary text to rewrite",
    )
    missing_keywords: list[str] = Field(
        default_factory=list,
        description="Keywords missing from the resume that appear in the job description",
    )
    options: RewriteOptions = Field(default_factory=RewriteOptions)


class BulletRewriteResult(BaseModel):
    """AI-rewritten version of a single bullet point."""

    element_id: str
    original: str
    proposed: str
    reason: str
    impact: Literal["high", "medium", "low"]
    keywords_added: list[str] = Field(default_factory=list)


class SummaryRewriteResult(BaseModel):
    """AI-rewritten version of the resume summary."""

    original: str
    proposed: str
    reason: str


class RewriteStats(BaseModel):
    """Aggregate statistics about the rewrite operation."""

    bullets_changed: int
    bullets_unchanged: int
    keywords_added: int


class RewriteResumeResponse(BaseModel):
    """Response containing AI-rewritten resume content."""

    bullets: list[BulletRewriteResult]
    summary: SummaryRewriteResult | None = None
    stats: RewriteStats
