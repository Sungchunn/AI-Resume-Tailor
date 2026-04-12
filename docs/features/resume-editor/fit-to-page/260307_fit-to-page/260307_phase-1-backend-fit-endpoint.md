# Phase 1: Backend - Page Count & Fit Endpoint

**Status:** Not Started
**Dependencies:** None

## Overview

Add server-side infrastructure for accurate page count detection and iterative fit-to-page compression.

## Tasks

### 1.1 Add `render_page_count()` to WeasyPrint service

**File:** `/backend/app/services/export/html_to_document.py`

Add method that renders HTML and returns page count without writing PDF:

```python
def render_page_count(self, html_content: str, options: ExportOptions) -> int:
    """Render HTML and return page count without writing PDF."""
    full_html = self._wrap_html(html_content, options)
    document = HTML(string=full_html).render()
    return len(document.pages)
```

WeasyPrint's `HTML.render()` returns a `Document` object with a `pages` list, enabling accurate page count without full PDF generation.

### 1.2 Add fit-to-page schemas

**File:** `/backend/app/schemas/export.py`

Add new schemas:

```python
from enum import Enum

class PageSize(str, Enum):
    LETTER = "letter"
    A4 = "a4"

class FitToPageRequest(BaseModel):
    """Request to calculate fit-to-page adjustments."""
    html_content: str = Field(..., min_length=1)
    font_size: int = Field(11, ge=8, le=16)
    margin_top: float = Field(0.75, ge=0.5, le=2.0)
    margin_bottom: float = Field(0.75, ge=0.5, le=2.0)
    margin_left: float = Field(0.75, ge=0.5, le=2.0)
    margin_right: float = Field(0.75, ge=0.5, le=2.0)
    line_spacing: float = Field(1.4, ge=1.1, le=2.0)
    section_spacing: int = Field(16, ge=8, le=32)
    entry_spacing: int = Field(8, ge=4, le=16)
    page_size: PageSize = PageSize.LETTER
    max_iterations: int = Field(5, ge=1, le=10)

class StyleReduction(BaseModel):
    """A single style reduction applied."""
    property: str
    from_value: float
    to_value: float
    label: str

class FitToPageResponse(BaseModel):
    """Response with adjusted styles and page count."""
    page_count: int
    adjusted_style: dict  # Same shape as request style fields
    reductions_applied: list[StyleReduction]
    warning: str | None = None
```

### 1.3 Create fit-to-page compression service

**File:** `/backend/app/services/export/fit_to_page.py` (new)

```python
from dataclasses import dataclass
from typing import Any

@dataclass
class CompressionStep:
    property: str
    label: str
    default: float
    minimum: float
    step: float  # Reduction per iteration

# Order matters - margins first, font last
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

class FitToPageService:
    def __init__(self, html_service: HTMLToDocumentService):
        self.html_service = html_service

    def fit(
        self,
        html_content: str,
        initial_style: dict[str, Any],
        page_size: str,
        max_iterations: int = 5,
    ) -> FitToPageResult:
        """Iteratively compress styles until content fits one page."""
        style = initial_style.copy()
        reductions = []

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
            while step_index < len(COMPRESSION_ORDER):
                step = COMPRESSION_ORDER[step_index]
                current = style.get(step.property, step.default)

                if current > step.minimum:
                    # Apply reduction
                    new_value = max(step.minimum, current - step.step)
                    style[step.property] = new_value

                    # Track reduction
                    existing = next((r for r in reductions if r["property"] == step.property), None)
                    if existing:
                        existing["to_value"] = new_value
                    else:
                        reductions.append({
                            "property": step.property,
                            "from_value": current,
                            "to_value": new_value,
                            "label": step.label,
                        })
                    break
                else:
                    step_index += 1

            if step_index >= len(COMPRESSION_ORDER):
                break  # All at minimum

            page_count = self._render_count(html_content, style, page_size)

        warning = None
        if page_count > 1:
            warning = f"Content still requires {page_count} pages at minimum settings. Consider removing content."

        return FitToPageResult(
            page_count=page_count,
            adjusted_style=style,
            reductions=reductions,
            warning=warning,
        )

    def _render_count(self, html: str, style: dict, page_size: str) -> int:
        options = ExportOptions(
            font_size=style.get("font_size", 11),
            margin_top=style.get("margin_top", 0.75),
            margin_bottom=style.get("margin_bottom", 0.75),
            margin_left=style.get("margin_left", 0.75),
            margin_right=style.get("margin_right", 0.75),
            line_spacing=style.get("line_spacing", 1.4),
            page_size=page_size,
        )
        return self.html_service.render_page_count(html, options)
```

### 1.4 Add fit-to-page endpoint

**File:** `/backend/app/api/routes/export.py`

```python
from app.schemas.export import FitToPageRequest, FitToPageResponse
from app.services.export.fit_to_page import get_fit_to_page_service

@router.post("/fit-to-page", response_model=FitToPageResponse)
async def fit_to_page(
    request: FitToPageRequest,
    current_user_id: int = Depends(get_current_user_id),
) -> FitToPageResponse:
    """
    Calculate style adjustments to fit content to one page.
    Returns adjusted styles and page count without generating PDF.
    """
    service = get_fit_to_page_service()

    initial_style = {
        "font_size": request.font_size,
        "margin_top": request.margin_top,
        "margin_bottom": request.margin_bottom,
        "margin_left": request.margin_left,
        "margin_right": request.margin_right,
        "line_spacing": request.line_spacing,
        "section_spacing": request.section_spacing,
        "entry_spacing": request.entry_spacing,
    }

    result = service.fit(
        html_content=request.html_content,
        initial_style=initial_style,
        page_size=request.page_size.value,
        max_iterations=request.max_iterations,
    )

    return FitToPageResponse(
        page_count=result.page_count,
        adjusted_style=result.adjusted_style,
        reductions_applied=result.reductions,
        warning=result.warning,
    )
```

## Tests

**File:** `/backend/tests/services/test_fit_to_page.py` (new)

Test cases:

1. Content fits initially - no reductions applied
2. Margins reduced first before fonts
3. All properties reduced in correct order
4. Minimum values respected
5. Warning returned when content can't fit
6. Letter vs A4 different results

## Acceptance Criteria

- [ ] `render_page_count()` returns accurate page count
- [ ] Compression applies in correct order: margins → spacing → line-height → font
- [ ] Minimums respected: 10pt font, 0.5in margins
- [ ] Warning message when content can't fit
- [ ] Endpoint returns < 500ms for typical resume
