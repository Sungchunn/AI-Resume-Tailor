# Fit-to-Page Feature Master Plan

**Created:** 2026-03-07
**Status:** Planning
**Phases:** 5

## Problem Summary

The fit-to-page feature has a working client-side algorithm but fails because:

1. **Export ignores styles** - `export.py:54` calls `generate_pdf(tailored_content)` with no style params
2. **No server validation** - Client estimation uses heuristics that may not match WeasyPrint
3. **No page count feedback** - Users can't verify if PDF actually fits one page
4. **Letter-only** - WeasyPrint templates hardcode `size: letter`

## Solution: Hybrid Approach

Client-side estimation for instant feedback + server-side validation for accuracy.

**Key Design Decisions:**

- **Real-time updates**: Preview updates automatically as server validates (500ms debounce)
- **Overflow handling**: Warn but allow export when content can't fit at minimum settings
- **Compression order**: margins → spacing → line-height → font-size

## Compression Thresholds

| Property | Default | Minimum | Notes |
| -------- | ------- | ------- | ----- |
| font_size_body | 11pt | 10pt | User requirement |
| margin_* | 0.75in | 0.5in | User requirement |
| line_spacing | 1.4 | 1.1 | Keep current |
| section_spacing | 16px | 8px | Keep current |
| entry_spacing | 8px | 4px | Keep current |

## Phase Overview

| Phase | Description | Files |
| ----- | ----------- | ----- |
| 1 | Backend - Page Count & Fit Endpoint | [070326_phase-1-backend-fit-endpoint.md](./070326_phase-1-backend-fit-endpoint.md) |
| 2 | Backend - Wire Styles to Export | [070326_phase-2-backend-wire-styles.md](./070326_phase-2-backend-wire-styles.md) |
| 3 | Backend - A4 Support | [070326_phase-3-backend-a4-support.md](./070326_phase-3-backend-a4-support.md) |
| 4 | Frontend - Server Validation | [070326_phase-4-frontend-validation.md](./070326_phase-4-frontend-validation.md) |
| 5 | Frontend - A4 Support & UI | [070326_phase-5-frontend-a4-ui.md](./070326_phase-5-frontend-a4-ui.md) |

## Critical Files Summary

### Backend

| File | Changes |
| ---- | ------- |
| `/backend/app/services/export/html_to_document.py` | Add `render_page_count()`, parameterize page size |
| `/backend/app/services/export/fit_to_page.py` | New file - compression algorithm |
| `/backend/app/schemas/export.py` | Add `PageSize`, `FitToPageRequest/Response` |
| `/backend/app/api/routes/export.py` | Add `/fit-to-page` endpoint, wire styles to existing export |

### Frontend

| File | Changes |
| ---- | ------- |
| `/frontend/src/components/workshop/panels/style/useAutoFit.ts` | Server validation, new minimums, new reduction order |
| `/frontend/src/components/workshop/ResumePreview/types.ts` | Add A4 dimensions |
| `/frontend/src/lib/api/client.ts` | Add `fitToPage()`, update `export()` |

## API Contract

### POST /api/export/fit-to-page

**Request:**

```json
{
  "html_content": "<html>...</html>",
  "font_size": 11,
  "margin_top": 0.75,
  "margin_bottom": 0.75,
  "margin_left": 0.75,
  "margin_right": 0.75,
  "line_spacing": 1.4,
  "section_spacing": 16,
  "page_size": "letter"
}
```

**Response:**

```json
{
  "page_count": 1,
  "adjusted_style": { ... },
  "reductions_applied": ["margins: 0.75in -> 0.5in", "line_spacing: 1.4 -> 1.25"],
  "warning": null
}
```

## Verification Plan

1. **Unit tests** for `FitToPageService` compression algorithm
2. **Integration test**: Send oversized content, verify page_count=1 in response
3. **E2E test**: Toggle fit-to-page in UI, export PDF, verify single page
4. **Edge cases**:
   - Content that can't fit even at minimums (should return warning)
   - Content that already fits (no reductions)
   - A4 vs Letter differences

**Test commands:**

```bash
# Backend
cd backend && poetry run pytest tests/services/test_fit_to_page.py -v

# Frontend
cd frontend && bun test useAutoFit
```
