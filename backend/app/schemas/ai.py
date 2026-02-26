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
