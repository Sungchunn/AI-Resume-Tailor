"""
Fit-to-Page Compression Service.

Iteratively compresses resume styles to fit content on a single page.
Uses WeasyPrint for accurate page count detection.
"""

from dataclasses import dataclass
from typing import Any

from app.services.export.html_to_document import (
    ExportOptions,
    HTMLToDocumentService,
    get_html_export_service,
)


@dataclass
class CompressionStep:
    """Definition for a single compression property."""
    property: str
    label: str
    default: float
    minimum: float
    step: float  # Reduction per iteration


# Compression order: margins first, font last (per user requirements)
COMPRESSION_ORDER = [
    CompressionStep("margin_top", "Top margin", 0.75, 0.5, 0.125),
    CompressionStep("margin_bottom", "Bottom margin", 0.75, 0.5, 0.125),
    CompressionStep("margin_left", "Left margin", 0.75, 0.5, 0.125),
    CompressionStep("margin_right", "Right margin", 0.75, 0.5, 0.125),
    CompressionStep("section_spacing", "Section spacing", 16, 8, 2),
    CompressionStep("entry_spacing", "Entry spacing", 8, 4, 1),
    CompressionStep("line_spacing", "Line height", 1.4, 1.1, 0.05),
    CompressionStep("font_size", "Font size", 11, 10, 0.5),
]


@dataclass
class FitToPageResult:
    """Result of the fit-to-page compression."""
    page_count: int
    adjusted_style: dict[str, Any]
    reductions: list[dict[str, Any]]
    warning: str | None = None


class FitToPageService:
    """Service for fitting resume content to a single page."""

    def __init__(self, html_service: HTMLToDocumentService):
        self.html_service = html_service

    def fit(
        self,
        html_content: str,
        initial_style: dict[str, Any],
        page_size: str = "letter",
        max_iterations: int = 5,
    ) -> FitToPageResult:
        """
        Iteratively compress styles until content fits one page.

        Args:
            html_content: HTML content to fit
            initial_style: Starting style values
            page_size: "letter" or "a4"
            max_iterations: Maximum compression iterations

        Returns:
            FitToPageResult with adjusted styles and page count
        """
        style = initial_style.copy()
        reductions: list[dict[str, Any]] = []

        # Check initial state
        page_count = self._render_count(html_content, style, page_size)
        if page_count == 1:
            return FitToPageResult(
                page_count=1,
                adjusted_style=style,
                reductions=[],
                warning=None,
            )

        iterations = 0
        step_index = 0

        while page_count > 1 and iterations < max_iterations:
            iterations += 1

            # Find next property to reduce
            reduced = False
            while step_index < len(COMPRESSION_ORDER):
                step = COMPRESSION_ORDER[step_index]
                current = style.get(step.property, step.default)

                if current > step.minimum:
                    # Apply reduction
                    new_value = max(step.minimum, current - step.step)

                    # Round to avoid floating point issues
                    if isinstance(new_value, float):
                        new_value = round(new_value, 3)

                    style[step.property] = new_value

                    # Track reduction
                    existing = next(
                        (r for r in reductions if r["property"] == step.property),
                        None
                    )
                    if existing:
                        existing["to_value"] = new_value
                    else:
                        reductions.append({
                            "property": step.property,
                            "from_value": current,
                            "to_value": new_value,
                            "label": step.label,
                        })

                    reduced = True
                    break
                else:
                    # This property is at minimum, move to next
                    step_index += 1

            if not reduced:
                # All properties at minimum
                break

            page_count = self._render_count(html_content, style, page_size)

        warning = None
        if page_count > 1:
            warning = (
                f"Content still requires {page_count} pages at minimum settings. "
                "Consider removing content."
            )

        return FitToPageResult(
            page_count=page_count,
            adjusted_style=style,
            reductions=reductions,
            warning=warning,
        )

    def _render_count(
        self,
        html_content: str,
        style: dict[str, Any],
        page_size: str,
    ) -> int:
        """Render HTML and return page count."""
        options = ExportOptions(
            font_size=int(style.get("font_size", 11)),
            margin_top=style.get("margin_top", 0.75),
            margin_bottom=style.get("margin_bottom", 0.75),
            margin_left=style.get("margin_left", 0.75),
            margin_right=style.get("margin_right", 0.75),
            line_spacing=style.get("line_spacing", 1.4),
            page_size=page_size,
        )
        return self.html_service.render_page_count(html_content, options)


# Singleton instance
_fit_to_page_service: FitToPageService | None = None


def get_fit_to_page_service() -> FitToPageService:
    """Get the fit-to-page service singleton."""
    global _fit_to_page_service
    if _fit_to_page_service is None:
        html_service = get_html_export_service()
        _fit_to_page_service = FitToPageService(html_service)
    return _fit_to_page_service
