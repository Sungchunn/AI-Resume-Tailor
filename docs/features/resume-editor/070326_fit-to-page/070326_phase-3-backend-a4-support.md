# Phase 3: Backend - A4 Support

**Status:** Not Started
**Dependencies:** Phase 2

## Overview

Add A4 page size support to WeasyPrint CSS templates, enabling international users to generate properly formatted resumes.

## Background

- **Letter:** 8.5" x 11" (215.9mm x 279.4mm) - US standard
- **A4:** 8.27" x 11.69" (210mm x 297mm) - International standard

A4 is slightly narrower but taller than Letter. The fit-to-page algorithm must account for this difference.

## Tasks

### 3.1 Add page size mapping

**File:** `/backend/app/services/export/html_to_document.py`

Add page size constants:

```python
PAGE_SIZE_CSS = {
    "letter": "letter",
    "a4": "210mm 297mm",
}
```

### 3.2 Update CSS templates

**File:** `/backend/app/services/export/html_to_document.py`

Update all three templates to use parameterized page size.

**Classic template (line 59):**

```css
/* Before */
@page { size: letter; margin: ... }

/* After */
@page {{ size: {page_size}; margin: ... }}
```

**Modern template (line 129):**

Same change as above.

**Minimal template (line 201):**

Same change as above.

### 3.3 Update `_get_css()` method

**File:** `/backend/app/services/export/html_to_document.py`

Update the CSS generation method to include page size:

```python
def _get_css(self, options: ExportOptions) -> str:
    """Generate CSS with all options including page size."""
    page_size_css = PAGE_SIZE_CSS.get(options.page_size, "letter")

    return TEMPLATE_CSS[options.template].format(
        margin_top=options.margin_top,
        margin_bottom=options.margin_bottom,
        margin_left=options.margin_left,
        margin_right=options.margin_right,
        font_size=options.font_size,
        line_spacing=options.line_spacing,
        font_family=options.font_family,
        page_size=page_size_css,  # Add this
    )
```

### 3.4 Update fit-to-page service for A4

**File:** `/backend/app/services/export/fit_to_page.py`

The compression algorithm should work identically for both page sizes since:

- WeasyPrint handles the actual layout
- The `render_page_count()` method returns accurate counts for any page size
- Compression steps are content-relative, not page-relative

No code changes needed, but add test coverage for A4.

## Tests

Add A4-specific test cases:

1. Generate PDF with A4 size - verify correct page dimensions
2. Fit-to-page with A4 - verify algorithm converges
3. Same content on Letter vs A4 - may have different page counts due to width difference

## Acceptance Criteria

- [ ] A4 PDFs have correct 210mm x 297mm dimensions
- [ ] CSS templates properly interpolate page size
- [ ] Fit-to-page algorithm works correctly with A4
- [ ] No regression in Letter-size export
