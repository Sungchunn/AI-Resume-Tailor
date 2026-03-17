# Inline Editing E2E Test Selector Fix

**Date:** 2026-03-17
**Status:** Implementation Plan

## Problem Summary

The Playwright E2E tests for inline-editing timeout in the `beforeEach` hook while waiting for `[data-testid="resume-page"]` to become visible.

**Error:**

```text
Error: locator.waitFor: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('[data-testid="resume-page"]') to be visible
```

## Root Cause Analysis

**Selector mismatch between test and actual component.**

| Component | Location | Selector Used |
| --------- | -------- | ------------- |
| `ResumeEditorPage.ts` (test) | `e2e/fixtures/page-objects/` | `[data-testid="resume-page"]` |
| `PreviewPage.tsx` (actual) | `src/components/library/preview/` | `[data-testid="resume-page-${pageNumber}"]` |
| `ResumePreview.tsx` (legacy) | `src/components/library/preview/` | `[data-testid="resume-page"]` |

**Key Finding:** The editor page (`/library/resumes/[id]/edit`) uses `EditorLayout.tsx` which renders `PaginatedResumePreview`. This component renders pages with numbered test IDs like `resume-page-1`, `resume-page-2`, etc.

The test page object was written expecting the legacy `ResumePreview` component selector, which is not used in the editor.

## Solution

Update the `ResumeEditorPage` page object to use a CSS "starts-with" selector that matches paginated pages.

### File to Modify

**`/frontend/e2e/fixtures/page-objects/ResumeEditorPage.ts` (line 19)**

**Before:**

```typescript
this.previewPage = page.locator('[data-testid="resume-page"]');
```

**After:**

```typescript
this.previewPage = page.locator('[data-testid^="resume-page-"]').first();
```

### Why This Works

- `^=` is the CSS "attribute starts with" selector
- Matches `resume-page-1`, `resume-page-2`, etc.
- `.first()` returns the first matching element (page 1)
- Handles both single and multi-page resumes

## Verification

```bash
cd frontend
bun run test:e2e e2e/inline-editing/basic-editing.spec.ts
```

**Expected result:** Tests proceed past `beforeEach` hook and execute test assertions.

## Related Files

| File | Purpose |
| ---- | ------- |
| `e2e/inline-editing/basic-editing.spec.ts` | Main test file |
| `e2e/fixtures/page-objects/ResumeEditorPage.ts` | Page object with selector (fix here) |
| `e2e/fixtures/test-data/inline-editing.fixture.ts` | Test data factory |
| `e2e/helpers/auth.ts` | Authentication setup |
| `src/components/library/preview/PreviewPage.tsx` | Actual component with `resume-page-N` |
| `src/components/library/editor/EditorLayout.tsx` | Uses `PaginatedResumePreview` |
