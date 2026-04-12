# Phase 4: Frontend - Server Validation

**Status:** Not Started
**Dependencies:** Phase 1, Phase 2

## Overview

Refactor the `useAutoFit` hook to use server-side validation for accurate fit-to-page results, while maintaining responsive client-side estimation.

## Tasks

### 4.1 Update minimums to match backend

**File:** `/frontend/src/components/workshop/panels/style/useAutoFit.ts`

Update the MINIMUMS constant (line 13-19):

```typescript
// Before
const MINIMUMS = {
  font_size_body: 8,
  font_size_heading: 12,
  font_size_subheading: 9,
  line_spacing: 1.1,
  section_spacing: 8,
} as const;

// After
const MINIMUMS = {
  font_size_body: 10,      // Was 8 - user requirement
  font_size_heading: 12,
  font_size_subheading: 9,
  line_spacing: 1.1,
  section_spacing: 8,
  entry_spacing: 4,
  margin: 0.5,             // New - user requirement
} as const;
```

### 4.2 Update reduction order

**File:** `/frontend/src/components/workshop/panels/style/useAutoFit.ts`

Update REDUCTION_PHASES (line 28-32):

```typescript
// Before - font first
const REDUCTION_PHASES = [
  { property: "font_size_body", label: "Body font", min: MINIMUMS.font_size_body },
  { property: "section_spacing", label: "Section spacing", min: MINIMUMS.section_spacing },
  { property: "line_spacing", label: "Line height", min: MINIMUMS.line_spacing },
] as const;

// After - margins first, font last
const REDUCTION_PHASES = [
  { property: "margin_top", label: "Top margin", min: MINIMUMS.margin },
  { property: "margin_bottom", label: "Bottom margin", min: MINIMUMS.margin },
  { property: "margin_left", label: "Left margin", min: MINIMUMS.margin },
  { property: "margin_right", label: "Right margin", min: MINIMUMS.margin },
  { property: "section_spacing", label: "Section spacing", min: MINIMUMS.section_spacing },
  { property: "entry_spacing", label: "Entry spacing", min: MINIMUMS.entry_spacing },
  { property: "line_spacing", label: "Line height", min: MINIMUMS.line_spacing },
  { property: "font_size_body", label: "Body font", min: MINIMUMS.font_size_body },
] as const;
```

### 4.3 Add server validation

**File:** `/frontend/src/components/workshop/panels/style/useAutoFit.ts`

Add debounced server validation after client estimation:

```typescript
import { useDebouncedCallback } from "use-debounce";
import { fitToPage } from "@/lib/api/client";

export function useAutoFit({
  content,
  style,
  targetHeight,
  enabled,
  onStyleChange,
  pageSize = "letter",  // Add this parameter
}: UseAutoFitOptions): UseAutoFitResult {
  // ... existing state

  // Server validation state
  const [serverPageCount, setServerPageCount] = useState<number | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Debounced server validation (500ms)
  const validateWithServer = useDebouncedCallback(
    async (adjustedStyle: ResumeStyle) => {
      if (!enabled) return;

      setIsValidating(true);
      try {
        const htmlContent = renderContentToHtml(content);
        const result = await fitToPage({
          html_content: htmlContent,
          font_size: adjustedStyle.font_size_body ?? 11,
          margin_top: adjustedStyle.margin_top ?? 0.75,
          margin_bottom: adjustedStyle.margin_bottom ?? 0.75,
          margin_left: adjustedStyle.margin_left ?? 0.75,
          margin_right: adjustedStyle.margin_right ?? 0.75,
          line_spacing: adjustedStyle.line_spacing ?? 1.4,
          section_spacing: adjustedStyle.section_spacing ?? 16,
          entry_spacing: adjustedStyle.entry_spacing ?? 8,
          page_size: pageSize,
        });

        setServerPageCount(result.page_count);

        // If server made additional adjustments, apply them
        if (result.page_count === 1 && result.reductions_applied.length > 0) {
          const serverStyle = { ...adjustedStyle, ...result.adjusted_style };
          setAdjustedStyle(serverStyle);
          onStyleChange(serverStyle);
        }

        // Update status based on server result
        if (result.page_count === 1) {
          setStatus({
            state: "fitted",
            reductions: result.reductions_applied.map((r) => r.label),
          });
        } else if (result.warning) {
          setStatus({
            state: "minimum_reached",
            message: result.warning,
          });
        }
      } catch (error) {
        console.error("Server validation failed:", error);
        // Fall back to client-only estimation
      } finally {
        setIsValidating(false);
      }
    },
    500
  );

  // Trigger server validation after client estimation
  useEffect(() => {
    if (enabled && adjustedStyle) {
      validateWithServer(adjustedStyle);
    }
  }, [adjustedStyle, enabled]);

  return {
    status: isValidating ? { state: "validating" } : status,
    adjustedStyle: enabled ? adjustedStyle : style,
    reductions,
    serverPageCount,  // New - expose server-verified page count
  };
}
```

### 4.4 Update types

**File:** `/frontend/src/components/workshop/panels/style/types.ts`

Update interface to include new options:

```typescript
export interface UseAutoFitOptions {
  content: TailoredContent;
  style: ResumeStyle;
  targetHeight: number;
  enabled: boolean;
  onStyleChange: (style: ResumeStyle) => void;
  pageSize?: "letter" | "a4";  // Add this
}

export interface UseAutoFitResult {
  status: AutoFitStatus;
  adjustedStyle: ResumeStyle;
  reductions: AutoFitReduction[];
  serverPageCount: number | null;  // Add this
}

export type AutoFitState = "idle" | "fitting" | "validating" | "fitted" | "minimum_reached";

export interface AutoFitStatus {
  state: AutoFitState;
  reductions?: string[];
  message?: string;
}
```

### 4.5 Add HTML rendering utility

**File:** `/frontend/src/components/workshop/utils/renderContentToHtml.ts` (new)

Create a utility to convert `TailoredContent` to HTML for server validation:

```typescript
import type { TailoredContent } from "@/lib/api/types";

export function renderContentToHtml(content: TailoredContent): string {
  // Generate HTML matching the preview structure
  // This should match the backend's expected format
  const sections: string[] = [];

  if (content.contact) {
    sections.push(`<header>
      <h1>${escapeHtml(content.contact.name)}</h1>
      <p>${escapeHtml(content.contact.email)} | ${escapeHtml(content.contact.phone)}</p>
    </header>`);
  }

  if (content.summary) {
    sections.push(`<section class="summary">
      <h2>Summary</h2>
      <p>${escapeHtml(content.summary)}</p>
    </section>`);
  }

  // ... experience, skills, highlights sections

  return `<!DOCTYPE html><html><body>${sections.join("\n")}</body></html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
```

## Tests

Update `useAutoFit.test.ts`:

1. Mock server API calls
2. Test that server validation is triggered after client estimation
3. Test that server-adjusted styles are applied
4. Test fallback to client-only when server fails
5. Test debouncing (500ms)

## Acceptance Criteria

- [ ] Minimums updated: 10pt font, 0.5in margins
- [ ] Reduction order: margins → spacing → line-height → font
- [ ] Server validation triggers 500ms after client estimation
- [ ] Server-adjusted styles are applied to preview
- [ ] Status shows "validating" during server call
- [ ] Graceful fallback when server unavailable
