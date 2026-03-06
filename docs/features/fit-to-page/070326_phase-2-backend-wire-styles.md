# Phase 2: Backend - Wire Styles to Export

**Status:** Not Started
**Dependencies:** Phase 1

## Overview

Update the existing export endpoint to accept and use style parameters from the frontend, ensuring exported PDFs match the preview.

## Tasks

### 2.1 Update export endpoint signature

**File:** `/backend/app/api/routes/export.py`

Current (line 22-28):

```python
@router.get("/{tailored_id}")
async def export_tailored_resume(
    tailored_id: int,
    format: ExportFormat = ExportFormat.PDF,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> Response:
```

Updated:

```python
from app.schemas.export import PageSize

@router.get("/{tailored_id}")
async def export_tailored_resume(
    tailored_id: int,
    format: ExportFormat = ExportFormat.PDF,
    # Style parameters
    font_size: int = Query(11, ge=8, le=16, description="Base font size in points"),
    margin_top: float = Query(0.75, ge=0.5, le=2.0, description="Top margin in inches"),
    margin_bottom: float = Query(0.75, ge=0.5, le=2.0, description="Bottom margin in inches"),
    margin_left: float = Query(0.75, ge=0.5, le=2.0, description="Left margin in inches"),
    margin_right: float = Query(0.75, ge=0.5, le=2.0, description="Right margin in inches"),
    line_spacing: float = Query(1.4, ge=1.1, le=2.0, description="Line height multiplier"),
    page_size: PageSize = Query(PageSize.LETTER, description="Page size"),
    template: str = Query("classic", description="Style template"),
    db: AsyncSession = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id),
) -> Response:
```

### 2.2 Pass styles to export service

**File:** `/backend/app/api/routes/export.py`

Update PDF generation call (currently line 54):

```python
# Current
content = export_service.generate_pdf(tailored_content)

# Updated
from app.services.export.html_to_document import ExportOptions, StyleTemplate

options = ExportOptions(
    template=StyleTemplate(template),
    font_size=font_size,
    margin_top=margin_top,
    margin_bottom=margin_bottom,
    margin_left=margin_left,
    margin_right=margin_right,
    line_spacing=line_spacing,
    page_size=page_size.value,
)

content = export_service.generate_pdf(tailored_content, options=options)
```

### 2.3 Update export service method signature

**File:** `/backend/app/services/export/service.py`

Ensure `generate_pdf` accepts and forwards `ExportOptions`:

```python
def generate_pdf(
    self,
    content: dict[str, Any],
    options: ExportOptions | None = None,
) -> bytes:
    """Generate PDF with optional style customization."""
    html = self._render_html(content)
    return self.html_service.generate_pdf(html, options)
```

### 2.4 Add page_size to ExportOptions

**File:** `/backend/app/services/export/html_to_document.py`

Update the `ExportOptions` dataclass:

```python
@dataclass
class ExportOptions:
    template: StyleTemplate = StyleTemplate.CLASSIC
    font_family: str = "Arial"
    font_size: int = 11
    margin_top: float = 0.75
    margin_bottom: float = 0.75
    margin_left: float = 0.75
    margin_right: float = 0.75
    line_spacing: float = 1.15
    page_size: str = "letter"  # Add this field
```

## Tests

Update existing export tests to verify style parameters are applied:

1. Export with custom font size - verify PDF uses correct size
2. Export with custom margins - verify PDF layout
3. Export with A4 page size - verify correct dimensions

## Acceptance Criteria

- [ ] Export endpoint accepts all style query parameters
- [ ] Exported PDF uses provided style values
- [ ] Default values match current behavior (backward compatible)
- [ ] API documentation updated automatically via OpenAPI
