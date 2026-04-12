# Phase 5: Frontend - A4 Support & UI

**Status:** Not Started
**Dependencies:** Phase 3, Phase 4

## Overview

Add A4 page size support to the frontend preview and UI, including page size selector and proper dimension calculations.

## Tasks

### 5.1 Add A4 dimensions

**File:** `/frontend/src/components/workshop/ResumePreview/types.ts`

Update PAGE_DIMENSIONS to support both sizes:

```typescript
// Before
export const PAGE_DIMENSIONS = {
  WIDTH: 816,   // 8.5 inches
  HEIGHT: 1056, // 11 inches
  DPI: 96,
} as const;

// After
export const PAGE_DIMENSIONS = {
  LETTER: {
    WIDTH: 816,   // 8.5 inches @ 96 DPI
    HEIGHT: 1056, // 11 inches @ 96 DPI
  },
  A4: {
    WIDTH: 794,   // 210mm @ 96 DPI (210 / 25.4 * 96)
    HEIGHT: 1123, // 297mm @ 96 DPI (297 / 25.4 * 96)
  },
  DPI: 96,
} as const;

export type PageSize = "letter" | "a4";
```

### 5.2 Update preview components for dynamic page size

**File:** `/frontend/src/components/workshop/ResumePreview/PreviewPage.tsx`

Update to accept page size and use correct dimensions:

```typescript
interface PreviewPageProps {
  // ... existing props
  pageSize?: PageSize;
}

export function PreviewPage({
  pageSize = "letter",
  // ... other props
}: PreviewPageProps) {
  const dimensions = PAGE_DIMENSIONS[pageSize.toUpperCase() as "LETTER" | "A4"];

  return (
    <div
      style={{
        width: dimensions.WIDTH,
        minHeight: dimensions.HEIGHT,
        // ... rest of styles
      }}
    >
      {children}
    </div>
  );
}
```

### 5.3 Update usePageBreaks hook

**File:** `/frontend/src/components/workshop/ResumePreview/usePageBreaks.ts`

Update to use dynamic page height:

```typescript
export function usePageBreaks(
  content: TailoredContent,
  style: ResumeStyle,
  pageSize: PageSize = "letter",
): PageBreakResult {
  const dimensions = PAGE_DIMENSIONS[pageSize.toUpperCase() as "LETTER" | "A4"];
  const pageHeight = dimensions.HEIGHT;

  // ... rest uses pageHeight instead of hardcoded value
}
```

### 5.4 Add page size selector to StylePanel

**File:** `/frontend/src/components/workshop/panels/style/StylePanel.tsx`

Add page size dropdown in the style panel:

```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// In the component
<div className="flex items-center gap-2">
  <Label htmlFor="page-size">Page Size</Label>
  <Select
    value={style.page_size ?? "letter"}
    onValueChange={(value) => onStyleChange({ page_size: value as PageSize })}
  >
    <SelectTrigger id="page-size" className="w-32">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="letter">Letter (US)</SelectItem>
      <SelectItem value="a4">A4 (International)</SelectItem>
    </SelectContent>
  </Select>
</div>
```

### 5.5 Add page_size to ResumeStyle type

**File:** `/frontend/src/lib/api/types.ts`

Add page_size field:

```typescript
export interface ResumeStyle {
  // ... existing fields
  page_size?: "letter" | "a4";
}
```

### 5.6 Update API client

**File:** `/frontend/src/lib/api/client.ts`

Add `fitToPage` method and update `export` to include styles:

```typescript
export interface FitToPageRequest {
  html_content: string;
  font_size: number;
  margin_top: number;
  margin_bottom: number;
  margin_left: number;
  margin_right: number;
  line_spacing: number;
  section_spacing: number;
  entry_spacing: number;
  page_size: "letter" | "a4";
}

export interface FitToPageResponse {
  page_count: number;
  adjusted_style: Record<string, number>;
  reductions_applied: Array<{
    property: string;
    from_value: number;
    to_value: number;
    label: string;
  }>;
  warning: string | null;
}

export async function fitToPage(request: FitToPageRequest): Promise<FitToPageResponse> {
  const response = await fetch("/api/export/fit-to-page", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Fit-to-page failed: ${response.statusText}`);
  }

  return response.json();
}

// Update export function
export async function exportResume(
  tailoredId: string,
  format: "pdf" | "docx" | "txt",
  style?: ResumeStyle,
): Promise<Blob> {
  const params = new URLSearchParams({ format });

  if (style) {
    if (style.font_size_body) params.append("font_size", String(style.font_size_body));
    if (style.margin_top) params.append("margin_top", String(style.margin_top));
    if (style.margin_bottom) params.append("margin_bottom", String(style.margin_bottom));
    if (style.margin_left) params.append("margin_left", String(style.margin_left));
    if (style.margin_right) params.append("margin_right", String(style.margin_right));
    if (style.line_spacing) params.append("line_spacing", String(style.line_spacing));
    if (style.page_size) params.append("page_size", style.page_size);
  }

  const response = await fetch(`/api/export/${tailoredId}?${params}`);

  if (!response.ok) {
    throw new Error(`Export failed: ${response.statusText}`);
  }

  return response.blob();
}
```

### 5.7 Update export button to pass styles

**File:** `/frontend/src/components/workshop/ExportButton.tsx` (or equivalent)

Ensure export button passes current style settings:

```tsx
const handleExport = async (format: "pdf" | "docx") => {
  const blob = await exportResume(tailoredId, format, styleSettings);
  // ... download logic
};
```

## Tests

1. Preview renders correctly with A4 dimensions
2. Page size selector updates state
3. Export passes style parameters
4. Fit-to-page API call includes page_size
5. A4 preview has correct aspect ratio

## Acceptance Criteria

- [ ] A4 page size option in style panel
- [ ] Preview shows correct A4 dimensions
- [ ] Page breaks calculated correctly for A4
- [ ] Export uses selected page size
- [ ] Fit-to-page works with A4
- [ ] Page size persists with style settings
