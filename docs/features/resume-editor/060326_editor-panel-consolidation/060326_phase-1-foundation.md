# Phase 1: Foundation

**Parent:** [Master Plan](./060326_master-plan.md)

## Objective

Create centralized `DEFAULT_STYLE` source and add `entry_spacing` to the type system.

## Tasks

### 1.1 Create defaultStyle.ts

**File:** `/frontend/src/lib/styles/defaultStyle.ts` (NEW)

```typescript
import type { ResumeStyle } from "@/lib/api/types";

export const DEFAULT_STYLE: ResumeStyle = {
  font_family: "Inter",
  font_size_body: 11,
  font_size_heading: 16,
  font_size_subheading: 13,
  margin_top: 0.75,
  margin_bottom: 0.75,
  margin_left: 0.75,
  margin_right: 0.75,
  line_spacing: 1.15,
  section_spacing: 1.0,
  entry_spacing: 8,
};

export const FONT_OPTIONS = [
  { value: "Inter", label: "Inter" },
  { value: "Roboto", label: "Roboto" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Lato", label: "Lato" },
  { value: "Georgia", label: "Georgia" },
  { value: "Times New Roman", label: "Times New Roman" },
] as const;
```

### 1.2 Add entry_spacing to ResumeStyle

**File:** `/frontend/src/lib/api/types.ts`

Add to `ResumeStyle` interface:

```typescript
export interface ResumeStyle {
  font_family?: string;
  font_size_body?: number;
  font_size_heading?: number;
  font_size_subheading?: number;
  margin_top?: number;
  margin_bottom?: number;
  margin_left?: number;
  margin_right?: number;
  line_spacing?: number;
  section_spacing?: number;
  entry_spacing?: number;  // ADD THIS - Space between list items (px), 4-16 range
}
```

### 1.3 Update WorkshopContext.tsx

**File:** `/frontend/src/components/workshop/WorkshopContext.tsx`

Replace local DEFAULT_STYLE with import:

```typescript
// Remove local DEFAULT_STYLE definition
// Add import:
import { DEFAULT_STYLE } from "@/lib/styles/defaultStyle";
```

### 1.4 Update StyleControlsPanel.tsx

**File:** `/frontend/src/components/editor/StyleControlsPanel.tsx`

Replace local definitions with imports:

```typescript
// Remove local DEFAULT_STYLE and FONT_OPTIONS definitions (lines 13-33)
// Add import:
import { DEFAULT_STYLE, FONT_OPTIONS } from "@/lib/styles/defaultStyle";
```

## Verification

- [ ] `DEFAULT_STYLE` imported correctly in WorkshopContext
- [ ] `DEFAULT_STYLE` imported correctly in StyleControlsPanel
- [ ] `entry_spacing` field available on ResumeStyle type
- [ ] No TypeScript errors
- [ ] Workshop still functions (styles apply to preview)
