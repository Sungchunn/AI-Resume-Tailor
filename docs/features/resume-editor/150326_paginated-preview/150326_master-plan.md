# Paginated Resume Preview - Master Plan

## Overview

Two related issues affecting the resume editor and PDF export:

1. **Page boundaries not visible during editing** - Users can't see exactly where content will break across pages
2. **PDF export has white borders** - Exported PDFs have unwanted white space around content

**Status:** Planning

## Issues

| Issue | Document | Priority | Phases |
| ----- | -------- | -------- | ------ |
| Paginated Editor Preview | [150326_issue-1-paginated-preview.md](./150326_issue-1-paginated-preview.md) | Primary | 6 phases |
| PDF Export White Borders | [150326_issue-2-pdf-white-borders.md](./150326_issue-2-pdf-white-borders.md) | Secondary | 4 phases |

## Issue 1: Implementation Phases Summary

| Phase | Goal | Key Deliverables |
| ----- | ---- | ---------------- |
| **Phase 1** | Block Height Measurement | `useBlockMeasurement.ts`, `MeasurementContainer.tsx` |
| **Phase 2** | Page Assignment Algorithm | `useBlockPagination.ts` with keep-together logic |
| **Phase 3** | Page Container Component | `PreviewPage.tsx` with fixed 1056px height |
| **Phase 4** | Paginated Preview Component | `PaginatedResumePreview.tsx` orchestrating all pieces |
| **Phase 5** | EditorLayout Integration | Replace `ResumePreview` + `PageBreakRuler` |
| **Phase 6** | Cleanup | Delete `PageBreakRuler.tsx`, update exports |

See [150326_issue-1-paginated-preview.md](./150326_issue-1-paginated-preview.md) for detailed step-by-step implementation.

## Issue 2: Implementation Phases Summary

| Phase | Goal | Key Deliverables |
| ----- | ---- | ---------------- |
| **Phase 1** | Update pdf-export.ts API | New `exportToPdfFromPages` function |
| **Phase 2** | Update ExportDialog | Accept `pageElements[]`, progress UI |
| **Phase 3** | Integration | Connect to PaginatedResumePreview |
| **Phase 4** | Backward Compatibility | Deprecate old function gracefully |

See [150326_issue-2-pdf-white-borders.md](./150326_issue-2-pdf-white-borders.md) for detailed step-by-step implementation.

## Dependencies

Issue 2 (PDF white borders) is partially solved by Issue 1 (paginated preview). Once the preview renders multiple distinct page containers, PDF export can render each page individually instead of slicing a large image.

However, Issue 2 can also be partially addressed independently if needed.

**Implementation order:**

```text
Issue 1 (Phases 1-4) → Issue 1 (Phase 5) → Issue 2 → Issue 1 (Phase 6)
                                            ↑
                                   Can work on concurrently
```

## Affected Pages

- `/library/resumes/[id]` - Resume detail/view page
- `/library/resumes/[id]/edit` - Resume edit page (primary)
- `/tailor/editor/[id]` - Tailor editor page (shares EditorLayout)

## Files Overview

| File | Current State | After Implementation |
| ---- | ------------- | -------------------- |
| `ResumePreview.tsx` | Main preview component | Keep for static previews |
| `PageBreakRuler.tsx` | Cosmetic page break indicator | Delete (replaced by page gaps) |
| `EditorLayout.tsx` | Uses ResumePreview + PageBreakRuler | Uses PaginatedResumePreview |
| `PaginatedResumePreview.tsx` | Does not exist | New main editor preview |
| `PreviewPage.tsx` | Does not exist | New single page container |
| `useBlockMeasurement.ts` | Does not exist | New measurement hook |
| `useBlockPagination.ts` | Does not exist | New pagination hook |
