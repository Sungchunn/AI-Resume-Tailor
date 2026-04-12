# Client-Side PDF Export

## Problem

The current PDF export uses WeasyPrint on the backend, which requires system dependencies (`pango`, etc.). Users get the error:

> "PDF export requires WeasyPrint system dependencies. Install with: brew install pango..."

Additionally, the backend renders HTML via Jinja2 templates which may not match the frontend React preview exactly.

## Solution

Implement **client-side PDF generation** using `html2canvas` + `jsPDF`. This ensures:

1. No system dependencies required
2. **Exact visual match** - same browser rendering engine for both preview and export
3. Works in any environment (local, deployed, etc.)

## Implementation

### 1. Install dependencies

```bash
cd frontend
bun add html2canvas jspdf
bun add -D @types/html2canvas
```

### 2. Create PDF export utility

**File:** `frontend/src/lib/pdf-export.ts`

```typescript
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const PAGE_WIDTH_PX = 816;  // 8.5" at 96 DPI
const PAGE_HEIGHT_PX = 1056; // 11" at 96 DPI

export async function exportToPdf(
  element: HTMLElement,
  filename: string
): Promise<{ pageCount: number }> {
  // Render DOM to canvas at 2x for crisp text
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    width: PAGE_WIDTH_PX,
  });

  // Letter size in points (72 DPI)
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter', // 612 x 792 points
  });

  const pdfWidth = 612;
  const pdfHeight = 792;

  // Calculate how many pages we need
  const contentHeight = element.scrollHeight;
  const pageCount = Math.ceil(contentHeight / PAGE_HEIGHT_PX);

  // Slice canvas into pages
  for (let page = 0; page < pageCount; page++) {
    if (page > 0) pdf.addPage();

    const sourceY = page * PAGE_HEIGHT_PX * 2; // 2x scale
    const sourceHeight = Math.min(PAGE_HEIGHT_PX * 2, canvas.height - sourceY);

    // Create a temporary canvas for this page
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = PAGE_WIDTH_PX * 2;
    pageCanvas.height = PAGE_HEIGHT_PX * 2;
    const ctx = pageCanvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.drawImage(
      canvas,
      0, sourceY, canvas.width, sourceHeight,
      0, 0, pageCanvas.width, sourceHeight
    );

    const imgData = pageCanvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  }

  pdf.save(filename);
  return { pageCount };
}
```

### 3. Update ExportDialog props

**File:** `frontend/src/components/export/ExportDialog.tsx`

Add new props for client-side rendering:

```typescript
interface ExportDialogProps {
  resumeId: string;
  resumeTitle: string;
  onClose: () => void;
  // NEW: For client-side PDF export
  blocks?: Block[];
  style?: BlockEditorStyle;
}
```

### 4. Add hidden preview and client-side export logic

**File:** `frontend/src/components/export/ExportDialog.tsx`

- Import `ResumePreviewStandalone` (already exists - no scaling)
- Render it in a hidden container when PDF format selected
- Use `exportToPdf()` to capture and download
- Fall back to backend API for DOCX

### 5. Update ExportDialog call sites to pass blocks/style

| File | Change |
| ---- | ------ |
| `frontend/src/components/library/editor/EditorLayout.tsx` | Pass `blocks={blocks}` and `style={style}` |
| `frontend/src/app/(protected)/library/resumes/[id]/page.tsx` | Fetch blocks data, pass to dialog |
| `frontend/src/components/workshop/WorkshopHeader.tsx` | Pass blocks from workshop state |

### 6. Files to create/modify

| File | Change |
| ---- | ------ |
| `frontend/package.json` | Add `html2canvas`, `jspdf` |
| `frontend/src/lib/pdf-export.ts` | **New** - PDF generation utility |
| `frontend/src/components/export/ExportDialog.tsx` | Add blocks/style props, hidden preview, client-side export |
| `frontend/src/components/library/editor/EditorLayout.tsx` | Pass blocks/style to ExportDialog |
| `frontend/src/app/(protected)/library/resumes/[id]/page.tsx` | Pass blocks/style to ExportDialog |
| `frontend/src/components/workshop/WorkshopHeader.tsx` | Pass blocks/style to ExportDialog |

## Verification

1. Open the resume editor with some content
2. Click "Export" button
3. Select PDF format and click Export
4. PDF downloads without errors (no WeasyPrint error)
5. Open PDF and compare to screen preview - should match exactly
