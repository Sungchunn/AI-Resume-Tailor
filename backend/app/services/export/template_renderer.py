"""
Resume Template Renderer

Normalizes resume data from various input formats and renders HTML
using Jinja2 templates for PDF export via WeasyPrint.
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape


@dataclass
class ContactInfo:
    """Contact information for resume header."""

    name: str | None = None
    headline: str | None = None
    email: str | None = None
    phone: str | None = None
    location: str | None = None
    linkedin: str | None = None
    website: str | None = None


@dataclass
class ResumeSection:
    """A single section in the resume."""

    type: str  # "experience", "education", "skills", "highlights", etc.
    label: str  # Display header text
    entries: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class NormalizedResume:
    """Normalized resume structure for template rendering."""

    contact: ContactInfo | None = None
    summary: str | None = None
    sections: list[ResumeSection] = field(default_factory=list)


@dataclass
class ExportStyle:
    """Style options for PDF export."""

    template: str = "classic"  # classic, modern, minimal
    font_family: str = "Arial"
    font_size: int = 11  # Base font size in points
    margin_top: float = 0.75  # inches
    margin_bottom: float = 0.75
    margin_left: float = 0.75
    margin_right: float = 0.75
    line_spacing: float = 1.15
    section_spacing: int = 14  # points
    entry_spacing: int = 10  # points
    page_size: str = "letter"  # "letter" or "a4"


class ResumeTemplateRenderer:
    """
    Renders resume content to HTML using Jinja2 templates.

    Handles normalization of various input formats (tailored_content dict,
    resume builds, etc.) into a unified NormalizedResume structure.
    """

    def __init__(self):
        # Set up template directory
        self._template_dir = Path(__file__).parent / "templates"
        self._styles_dir = Path(__file__).parent / "styles"

        # Configure Jinja2 environment
        self._env = Environment(
            loader=FileSystemLoader(str(self._template_dir)),
            autoescape=select_autoescape(["html", "xml"]),
            trim_blocks=True,
            lstrip_blocks=True,
        )

    def _load_css(self, filename: str) -> str:
        """Load CSS file content."""
        css_path = self._styles_dir / filename
        if css_path.exists():
            return css_path.read_text()
        return ""

    def normalize_tailored_content(
        self,
        content: dict[str, Any],
        contact: dict[str, Any] | None = None,
    ) -> NormalizedResume:
        """
        Normalize tailored_content dict to NormalizedResume.

        Expected input format:
        {
            "summary": "...",
            "experience": [...],
            "skills": [...],
            "highlights": [...],
            "education": [...],
            ...
        }
        """
        resume = NormalizedResume()

        # Extract contact info if provided
        if contact:
            resume.contact = ContactInfo(
                name=contact.get("name"),
                headline=contact.get("headline"),
                email=contact.get("email"),
                phone=contact.get("phone"),
                location=contact.get("location"),
                linkedin=contact.get("linkedin"),
                website=contact.get("website"),
            )

        # Extract summary
        resume.summary = content.get("summary")

        # Map known section types
        section_configs = [
            ("experience", "Experience"),
            ("education", "Education"),
            ("skills", "Skills"),
            ("highlights", "Key Highlights"),
            ("certifications", "Certifications"),
            ("projects", "Projects"),
            ("awards", "Awards"),
            ("publications", "Publications"),
            ("languages", "Languages"),
            ("interests", "Interests"),
        ]

        for section_key, section_label in section_configs:
            if section_key in content and content[section_key]:
                entries = content[section_key]
                # Ensure entries is a list
                if not isinstance(entries, list):
                    entries = [entries]
                resume.sections.append(
                    ResumeSection(
                        type=section_key,
                        label=section_label,
                        entries=entries,
                    )
                )

        # Handle any additional custom sections
        known_keys = {"summary"} | {cfg[0] for cfg in section_configs}
        for key, value in content.items():
            if key not in known_keys and value:
                # Custom section
                entries = value if isinstance(value, list) else [value]
                resume.sections.append(
                    ResumeSection(
                        type=key,
                        label=key.replace("_", " ").title(),
                        entries=entries,
                    )
                )

        return resume

    def normalize_resume_build(
        self,
        sections: dict[str, Any],
    ) -> NormalizedResume:
        """
        Normalize resume build sections to NormalizedResume.

        Resume builds store sections keyed by section name.
        """
        resume = NormalizedResume()

        # Check for contact info in sections
        if "contact" in sections:
            contact_data = sections["contact"]
            resume.contact = ContactInfo(
                name=contact_data.get("name"),
                headline=contact_data.get("headline"),
                email=contact_data.get("email"),
                phone=contact_data.get("phone"),
                location=contact_data.get("location"),
                linkedin=contact_data.get("linkedin"),
                website=contact_data.get("website"),
            )

        # Check for summary
        if "summary" in sections:
            summary_data = sections["summary"]
            if isinstance(summary_data, str):
                resume.summary = summary_data
            elif isinstance(summary_data, dict):
                resume.summary = summary_data.get("content") or summary_data.get(
                    "text"
                )

        # Map sections to normalized structure
        section_type_map = {
            "experience": "experience",
            "work_experience": "experience",
            "work": "experience",
            "education": "education",
            "skills": "skills",
            "technical_skills": "skills",
            "highlights": "highlights",
            "key_highlights": "highlights",
            "achievements": "highlights",
            "certifications": "certifications",
            "certificates": "certifications",
            "projects": "projects",
        }

        skip_keys = {"contact", "summary"}

        for section_name, section_data in sections.items():
            if section_name in skip_keys:
                continue

            if not section_data:
                continue

            # Determine section type
            normalized_type = section_type_map.get(section_name.lower(), section_name)

            # Get entries
            if isinstance(section_data, list):
                entries = section_data
            elif isinstance(section_data, dict):
                entries = section_data.get("entries", section_data.get("items", []))
                if not entries and "content" not in section_data:
                    entries = [section_data]
            else:
                entries = [section_data]

            # Determine label
            label = section_name.replace("_", " ").title()
            if normalized_type == "experience":
                label = "Experience"
            elif normalized_type == "education":
                label = "Education"
            elif normalized_type == "skills":
                label = "Skills"
            elif normalized_type == "highlights":
                label = "Key Highlights"

            resume.sections.append(
                ResumeSection(
                    type=normalized_type,
                    label=label,
                    entries=entries,
                )
            )

        return resume

    def render(
        self,
        resume: NormalizedResume,
        style: ExportStyle | None = None,
    ) -> str:
        """
        Render normalized resume to HTML string.

        Args:
            resume: Normalized resume data
            style: Export style options

        Returns:
            Complete HTML document string
        """
        if style is None:
            style = ExportStyle()

        # Load CSS files
        fonts_css = self._load_css("_fonts.css")
        base_css = self._load_css("_base.css")
        template_css = self._load_css(f"{style.template}.css")

        # Get template
        template = self._env.get_template("resume.html.j2")

        # Convert resume to dict for template
        resume_dict = {
            "contact": (
                {
                    "name": resume.contact.name,
                    "headline": resume.contact.headline,
                    "email": resume.contact.email,
                    "phone": resume.contact.phone,
                    "location": resume.contact.location,
                    "linkedin": resume.contact.linkedin,
                    "website": resume.contact.website,
                }
                if resume.contact
                else None
            ),
            "summary": resume.summary,
            "sections": [
                {
                    "type": s.type,
                    "label": s.label,
                    "entries": s.entries,
                }
                for s in resume.sections
            ],
        }

        # Page size CSS value
        page_size_css = "210mm 297mm" if style.page_size == "a4" else "letter"

        # Render template
        return template.render(
            resume=resume_dict,
            fonts_css=fonts_css,
            base_css=base_css,
            template_css=template_css,
            font_family=style.font_family,
            font_size=style.font_size,
            margin_top=style.margin_top,
            margin_bottom=style.margin_bottom,
            margin_left=style.margin_left,
            margin_right=style.margin_right,
            line_spacing=style.line_spacing,
            section_spacing=style.section_spacing,
            entry_spacing=style.entry_spacing,
            page_size=page_size_css,
        )


# Singleton instance
_template_renderer: ResumeTemplateRenderer | None = None


def get_template_renderer() -> ResumeTemplateRenderer:
    """Get the template renderer singleton."""
    global _template_renderer
    if _template_renderer is None:
        _template_renderer = ResumeTemplateRenderer()
    return _template_renderer
