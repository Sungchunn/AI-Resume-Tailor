# Issue 2: PDF Export White Borders

## Problem

When exporting resumes to PDF, white borders appear around the A4 content. The gray UI background is visible around the white page edges.

**Root Causes:**

1. **Image slicing approach**: Current export captures a single large image of the entire content, then slices it into pages
2. **Height misalignment**: If `scrollHeight` isn't a perfect multiple of 1056px (page height), the last page has empty space
3. **Canvas white fill**: The code fills the entire canvas with white before drawing content, creating borders where content doesn't fill

**Current Implementation (`pdf-export.ts`):**

```typescript
// Captures full scrollHeight (may not align with page boundaries)
const dataUrl = await toPng(element, {
  height: element.scrollHeight,  // e.g., 2200px (not multiple of 1056)
});

// For each page, creates canvas and fills with white
ctx.fillStyle = "#ffffff";
ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

// Draws slice of image (may not fill entire canvas)
ctx.drawImage(img, 0, sourceY, img.width, sourceHeight, ...);
```

If content is 2200px tall:

- Page 1: 0-1056px ✓
- Page 2: 1056-2112px (only 1144px of actual content, rest is white fill)

## Solution

Render each page container independently at exact page dimensions (no slicing).

---

## Implementation Phases

### Phase 1: Update pdf-export.ts API

**Goal:** Modify the export function to accept an array of page elements.

#### Step 1.1: Define New Function Signature

**File:** `frontend/src/lib/pdf-export.ts`

```typescript
// Current signature (deprecated)
export async function exportToPdf(
  element: HTMLElement,
  filename: string
): Promise<void>;

// New signature
export async function exportToPdfFromPages(
  pageElements: HTMLElement[],
  filename: string,
  options?: PdfExportOptions
): Promise<void>;

interface PdfExportOptions {
  /** Pixel ratio for rendering (default: 2 for retina) */
  pixelRatio?: number;
  /** Paper format (default: "letter") */
  format?: "letter" | "a4";
  /** Show progress callback */
  onProgress?: (current: number, total: number) => void;
}
```

#### Step 1.2: Implement Page-by-Page Export

**Algorithm:**

1. Create jsPDF document with correct paper format
2. For each page element:
   a. Convert to PNG using `html-to-image`
   b. Add page to PDF (except for first page)
   c. Insert image at full page dimensions
3. Save PDF

```typescript
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";

const PAGE_DIMENSIONS = {
  letter: {
    pixels: { width: 816, height: 1056 },
    points: { width: 612, height: 792 },
  },
  a4: {
    pixels: { width: 794, height: 1123 },
    points: { width: 595, height: 842 },
  },
};

export async function exportToPdfFromPages(
  pageElements: HTMLElement[],
  filename: string,
  options: PdfExportOptions = {}
): Promise<void> {
  const { pixelRatio = 2, format = "letter", onProgress } = options;
  const dims = PAGE_DIMENSIONS[format];

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: format,
  });

  for (let i = 0; i < pageElements.length; i++) {
    if (i > 0) {
      pdf.addPage();
    }

    // Report progress
    onProgress?.(i + 1, pageElements.length);

    // Capture page as PNG at exact dimensions
    const dataUrl = await toPng(pageElements[i], {
      pixelRatio,
      backgroundColor: "#ffffff",
      width: dims.pixels.width,
      height: dims.pixels.height,
      // Exclude print-hidden elements
      filter: (node) => {
        if (node instanceof HTMLElement) {
          return node.dataset.printHidden !== "true";
        }
        return true;
      },
    });

    // Add image to PDF at full page size
    pdf.addImage(dataUrl, "PNG", 0, 0, dims.points.width, dims.points.height);
  }

  pdf.save(`${filename}.pdf`);
}
```

#### Step 1.3: Handle Edge Cases

| Scenario | Handling |
| -------- | -------- |
| Empty page array | Throw error: "No pages to export" |
| Single page | Export as single-page PDF |
| Page element null | Skip with warning in console |
| Export fails mid-way | Clean up, throw with page number |

```typescript
// Error handling
if (!pageElements || pageElements.length === 0) {
  throw new Error("No pages to export");
}

// Validate elements
const validPages = pageElements.filter((el) => {
  if (!el) {
    console.warn("Null page element skipped during PDF export");
    return false;
  }
  return true;
});

if (validPages.length === 0) {
  throw new Error("All page elements were invalid");
}
```

---

### Phase 2: Update ExportDialog Component

**Goal:** Modify the export dialog to accept and use page elements array.

#### Step 2.1: Update Props Interface

**File:** `frontend/src/components/export/ExportDialog.tsx`

```diff
  interface ExportDialogProps {
    resumeTitle: string;
    onClose: () => void;
-   previewElement?: HTMLElement;
+   pageElements?: HTMLElement[];
  }
```

#### Step 2.2: Update Export Handler

```typescript
const handleExport = async () => {
  if (!pageElements || pageElements.length === 0) {
    toast.error("No pages available to export");
    return;
  }

  setIsExporting(true);
  setExportProgress({ current: 0, total: pageElements.length });

  try {
    await exportToPdfFromPages(pageElements, resumeTitle, {
      pixelRatio: 2,
      format: "letter",
      onProgress: (current, total) => {
        setExportProgress({ current, total });
      },
    });

    toast.success("PDF exported successfully");
    onClose();
  } catch (error) {
    console.error("Export failed:", error);
    toast.error("Failed to export PDF. Please try again.");
  } finally {
    setIsExporting(false);
    setExportProgress(null);
  }
};
```

#### Step 2.3: Add Export Progress UI

```tsx
{isExporting && exportProgress && (
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    <Loader2 className="h-4 w-4 animate-spin" />
    <span>
      Exporting page {exportProgress.current} of {exportProgress.total}...
    </span>
  </div>
)}
```

---

### Phase 3: Integration with PaginatedResumePreview

**Goal:** Connect the new export flow to the paginated preview.

#### Step 3.1: Update EditorLayout Export Call

**File:** `frontend/src/components/library/editor/EditorLayout.tsx`

```diff
  {showExportDialog && (
    <ExportDialog
      resumeTitle={title}
      onClose={() => setShowExportDialog(false)}
-     previewElement={previewRef.current?.getPageElement()}
+     pageElements={previewRef.current?.getPageElements()}
    />
  )}
```

#### Step 3.2: Ensure Page Elements Are Export-Ready

Before export, page elements need preparation:

1. **Remove interactive controls**: Hide move buttons, hover states
2. **Remove page indicators**: Hide page number badges
3. **Apply print styles**: Ensure fonts are embedded

The `data-print-hidden="true"` attribute handles most of this via the `filter` option in `toPng()`.

```typescript
// In PreviewPage.tsx - ensure indicators have data-print-hidden
<div data-print-hidden="true" className="page-number-indicator">
  Page {pageNumber}
</div>

<div data-print-hidden="true" className="move-controls">
  {/* Move up/down buttons */}
</div>
```

---

### Phase 4: Backward Compatibility (Optional)

**Goal:** Maintain the old `exportToPdf` function for non-paginated uses.

#### Step 4.1: Keep Legacy Function

```typescript
/**
 * @deprecated Use exportToPdfFromPages with PaginatedResumePreview instead.
 * This function will be removed in a future release.
 */
export async function exportToPdf(
  element: HTMLElement,
  filename: string
): Promise<void> {
  console.warn(
    "exportToPdf is deprecated. Use exportToPdfFromPages with page elements array."
  );

  // Fallback: treat single element as single page
  return exportToPdfFromPages([element], filename);
}
```

#### Step 4.2: Update Other Usages

Search for other usages of the old export function:

```bash
grep -r "exportToPdf" frontend/src --include="*.ts" --include="*.tsx"
```

Update each to use the new function or ensure backward compatibility works.

---

## File Summary

| File | Action | Phase |
| ---- | ------ | ----- |
| `frontend/src/lib/pdf-export.ts` | Modify (add new function) | 1 |
| `frontend/src/components/export/ExportDialog.tsx` | Modify (new props) | 2 |
| `frontend/src/components/library/editor/EditorLayout.tsx` | Modify (pass array) | 3 |
| `frontend/src/components/library/preview/PreviewPage.tsx` | Ensure `data-print-hidden` | 3 |

---

## Dependency on Issue 1

This issue depends on Issue 1 (Paginated Preview) being at least partially complete:

| Issue 1 Phase | Required for Issue 2? |
| ------------- | --------------------- |
| Phase 1 (Measurement) | No |
| Phase 2 (Pagination) | No |
| Phase 3 (PreviewPage) | Yes - provides page elements |
| Phase 4 (PaginatedResumePreview) | Yes - provides `getPageElements()` |
| Phase 5 (EditorLayout) | Yes - integration point |
| Phase 6 (Cleanup) | No |

**Recommended implementation order:**

1. Complete Issue 1 Phases 1-4
2. Begin Issue 2 Phase 1 (can work in parallel)
3. Complete Issue 1 Phase 5
4. Complete Issue 2 Phases 2-3
5. Complete Issue 1 Phase 6

---

## Standalone Fix (If Issue 1 Not Implemented)

If paginated preview is not implemented, can partially fix by:

### Option A: Crop Last Page

```typescript
// Instead of filling entire canvas with white, only fill content area
const contentHeightOnPage = Math.min(PAGE_HEIGHT_PX * 2, img.height - sourceY);

// Draw only the content portion
ctx.drawImage(img, 0, sourceY, img.width, contentHeightOnPage, ...);

// For last page, resize canvas to actual content
if (page === pageCount - 1) {
  const croppedCanvas = cropCanvas(pageCanvas, contentHeightOnPage);
  // Use cropped canvas for PDF
}
```

### Option B: Calculate Exact Page Boundaries

```typescript
// Round total height to exact page multiple
const exactHeight = Math.ceil(element.scrollHeight / PAGE_HEIGHT_PX) * PAGE_HEIGHT_PX;

// Render at exact height
const dataUrl = await toPng(element, {
  height: exactHeight,
  backgroundColor: "#ffffff",
});
```

**Note:** These standalone fixes are workarounds. The proper solution is Issue 1's paginated preview.

---

## Verification Checklist

**Phase 1 Complete:**

- [ ] New `exportToPdfFromPages` function implemented
- [ ] Function handles empty/null inputs gracefully
- [ ] Progress callback works correctly

**Phase 2 Complete:**

- [ ] ExportDialog accepts `pageElements` prop
- [ ] Progress UI shows during export
- [ ] Error handling shows toast messages

**Phase 3 Complete:**

- [ ] EditorLayout passes page elements to ExportDialog
- [ ] `data-print-hidden` elements filtered from export
- [ ] Export produces correct PDF

**Final Verification:**

- [ ] Export 1-page resume - no white borders
- [ ] Export 2-page resume - pages separated correctly
- [ ] Export 3-page resume - all pages correct
- [ ] Test with different margin settings
- [ ] Test with different font sizes
- [ ] PDF opens correctly in multiple viewers (Preview, Chrome, Adobe)

---

## Testing Strategy

### Manual Testing

| Test | Expected Result |
| ---- | --------------- |
| Export 1-page resume | Single page PDF, no borders |
| Export 2-page resume | Two pages, content aligned |
| Export 3-page resume | Three pages, no white borders |
| Export with large margins | Content respects margins |
| Export with small font | More content per page |
| Cancel during export | No PDF saved, no errors |

### Automated Tests

```typescript
// pdf-export.test.ts
describe("exportToPdfFromPages", () => {
  it("exports single page correctly", async () => {
    const mockElement = createMockPageElement();
    await expect(
      exportToPdfFromPages([mockElement], "test")
    ).resolves.not.toThrow();
  });

  it("exports multiple pages correctly", async () => {
    const mockElements = [createMockPageElement(), createMockPageElement()];
    await expect(
      exportToPdfFromPages(mockElements, "test")
    ).resolves.not.toThrow();
  });

  it("throws on empty array", async () => {
    await expect(exportToPdfFromPages([], "test")).rejects.toThrow(
      "No pages to export"
    );
  });

  it("calls progress callback", async () => {
    const onProgress = jest.fn();
    const mockElements = [createMockPageElement(), createMockPageElement()];
    await exportToPdfFromPages(mockElements, "test", { onProgress });
    expect(onProgress).toHaveBeenCalledWith(1, 2);
    expect(onProgress).toHaveBeenCalledWith(2, 2);
  });
});
```
