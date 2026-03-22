# Fix PDF Export Floating Border Issue

## Problem

The exported PDF has visible gray borders/shadows around each page, creating a "floating white page" effect. This is caused by the preview page styling (`shadow-lg rounded-sm border border-border`) being captured during the PNG screenshot for PDF export.

**Visual Example:** Both pages in the exported PDF show thin gray borders around the content area.

**ATS Impact:** This is primarily a visual issue. Since the PDF uses image-based rendering (html-to-image + jsPDF), the text is already embedded in the image. However:

- The border/shadow adds unnecessary visual artifacts
- Clean PDFs without decorative borders are preferred for professional documents
- No significant ATS parsing impact since modern ATS can OCR images

## Root Cause Analysis

1. `PreviewPage.tsx:127` applies visual styling when `showPageBorder={true}`:

   ```tsx
   showPageBorder ? "shadow-lg rounded-sm border border-border" : ""
   ```

2. `PaginatedResumePreview.tsx:268` passes `showPageBorder={showPageBorder}` to pages

3. `getPageElements()` returns references to the same DOM elements displayed in the UI

4. `pdf-export.ts` captures these elements with `toPng()`, including all CSS styling

5. The shadow and border are captured in the PNG images embedded in the PDF

## Solution

**Remove Tailwind classes entirely** before capture instead of trying to override them with inline styles.

Inline style overrides (even with `!important`) do not reliably override Tailwind CSS classes during `html-to-image` capture because the library snapshots computed styles before JavaScript property assignments complete.

### Implementation

**File:** `frontend/src/lib/pdf-export.ts`

Replace inline style overrides with className manipulation:

```typescript
const page = validPages[i];

// Store original className to restore after capture
const originalClassName = page.className;

// Remove visual preview classes that should not appear in PDF
page.className = page.className
  .replace(/\bshadow-lg\b/g, "")
  .replace(/\brounded-sm\b/g, "")
  .replace(/\bborder-border\b/g, "")
  .replace(/\bborder\b(?!-)/g, "")  // Remove 'border' but not 'border-*' variants
  .replace(/\s+/g, " ")  // Clean up extra whitespace
  .trim();

try {
  const dataUrl = await toPng(page, {
    // ... existing options
  });
  // ... existing addImage code
} finally {
  // Restore original className so preview remains unchanged
  page.className = originalClassName;
}
```

### Files to Modify

| File | Change |
| ---- | ------ |
| `frontend/src/lib/pdf-export.ts` | Replace inline style overrides with className removal |

## Verification

1. **Start dev server:** `cd frontend && bun dev`
2. **Navigate to editor:** Open a resume in the editor
3. **Export PDF:** Click Export > Download PDF
4. **Verify output:** Open the PDF and confirm:
   - No gray border around pages
   - No shadow effect
   - Content fills to edge of page margins
   - Multi-page PDFs have clean page breaks
