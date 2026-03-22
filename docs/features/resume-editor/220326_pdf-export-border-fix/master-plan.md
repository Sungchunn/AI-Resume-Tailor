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

Temporarily override border/shadow styles during PDF export by applying inline styles before capture and removing them after.

### Implementation

**File:** `frontend/src/lib/pdf-export.ts`

Add inline style override before each `toPng()` call:

```typescript
// Before capture: store original styles and apply export overrides
const originalStyle = validPages[i].getAttribute('style') || '';
const originalClass = validPages[i].className;

// Add inline styles to override shadow/border/border-radius
validPages[i].style.boxShadow = 'none';
validPages[i].style.border = 'none';
validPages[i].style.borderRadius = '0';

try {
  const dataUrl = await toPng(validPages[i], {
    // ... existing options
  });
  // ... existing addImage code
} finally {
  // Restore original styles
  validPages[i].setAttribute('style', originalStyle);
  validPages[i].className = originalClass;
}
```

### Files to Modify

| File | Change |
| ---- | ------ |
| `frontend/src/lib/pdf-export.ts` | Add inline style overrides before `toPng()` capture |

## Verification

1. **Start dev server:** `cd frontend && bun dev`
2. **Navigate to editor:** Open a resume in the editor
3. **Export PDF:** Click Export > Download PDF
4. **Verify output:** Open the PDF and confirm:
   - No gray border around pages
   - No shadow effect
   - Content fills to edge of page margins
   - Multi-page PDFs have clean page breaks
