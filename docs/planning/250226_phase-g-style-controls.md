# Phase G: Style Controls Panel

**Created**: February 25, 2026
**Status**: Ready for Implementation
**Dependencies**: Phase D (Three-Tab Control Panel)
**Priority**: P1
**Next Phase**: Phase H (Real-Time Score Updates)

---

## Overview

Enhance the Style tab with template presets with visual thumbnails and progressive auto-fit algorithm. The base `StyleControlsPanel` already exists - this phase adds template selection with previews and intelligent one-page fitting.

---

## Key Features

1. **Template Presets with Visual Thumbnails** - Users see mini previews before selecting
2. **Progressive Auto-Fit Algorithm** - Intelligent reduction order (fonts → spacing → line height)
3. **Live Preview Integration** - All style changes reflect immediately in preview

---

## Component Architecture

```text
frontend/src/components/workshop/panels/
├── StylePanel.tsx             # Main wrapper (extends existing StyleControlsPanel)
├── TemplateSelector.tsx       # Template grid with thumbnails
├── TemplateThumbnail.tsx      # Individual template preview card
├── AutoFitToggle.tsx          # Fit to one page toggle with status
└── useAutoFit.ts              # Progressive auto-fit hook
```

---

## Interfaces

```typescript
// frontend/src/components/workshop/panels/types.ts

export interface TemplatePreset {
  id: string;
  name: string;
  description: string;
  style: ResumeStyle;
  thumbnail?: string; // Base64 or URL for static preview
}

export interface TemplateSelectorProps {
  presets: TemplatePreset[];
  activePreset: string | null;
  onSelect: (preset: TemplatePreset) => void;
}

export interface TemplateThumbnailProps {
  preset: TemplatePreset;
  isActive: boolean;
  onClick: () => void;
}

export interface AutoFitToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  status: AutoFitStatus;
}

export type AutoFitStatus =
  | { state: "idle" }
  | { state: "fitting"; iteration: number }
  | { state: "fitted"; reductions: string[] }
  | { state: "minimum_reached"; message: string };

export interface UseAutoFitOptions {
  content: TailoredContent;
  style: ResumeStyle;
  targetHeight: number;
  enabled: boolean;
  onStyleChange: (style: ResumeStyle) => void;
}

export interface UseAutoFitResult {
  status: AutoFitStatus;
  adjustedStyle: ResumeStyle;
  reductions: AutoFitReduction[];
}

export interface AutoFitReduction {
  property: string;
  from: number;
  to: number;
  label: string;
}
```

---

## Template Presets

```typescript
// frontend/src/components/workshop/panels/templatePresets.ts

import type { TemplatePreset } from "./types";

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    id: "classic",
    name: "Classic",
    description: "Traditional serif font, generous spacing",
    style: {
      font_family: "Times New Roman",
      font_size_body: 11,
      font_size_heading: 18,
      font_size_subheading: 12,
      line_spacing: 1.4,
      section_spacing: 16,
      entry_spacing: 8,
      margin_top: 0.75,
      margin_bottom: 0.75,
      margin_left: 0.75,
      margin_right: 0.75,
    },
  },
  {
    id: "modern",
    name: "Modern",
    description: "Clean sans-serif, compact layout",
    style: {
      font_family: "Inter",
      font_size_body: 10,
      font_size_heading: 16,
      font_size_subheading: 11,
      line_spacing: 1.3,
      section_spacing: 14,
      entry_spacing: 6,
      margin_top: 0.6,
      margin_bottom: 0.6,
      margin_left: 0.6,
      margin_right: 0.6,
    },
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Maximum content density",
    style: {
      font_family: "Arial",
      font_size_body: 10,
      font_size_heading: 14,
      font_size_subheading: 10,
      line_spacing: 1.2,
      section_spacing: 10,
      entry_spacing: 4,
      margin_top: 0.5,
      margin_bottom: 0.5,
      margin_left: 0.5,
      margin_right: 0.5,
    },
  },
  {
    id: "executive",
    name: "Executive",
    description: "Professional, spacious layout",
    style: {
      font_family: "Georgia",
      font_size_body: 11,
      font_size_heading: 20,
      font_size_subheading: 13,
      line_spacing: 1.5,
      section_spacing: 18,
      entry_spacing: 10,
      margin_top: 1.0,
      margin_bottom: 1.0,
      margin_left: 1.0,
      margin_right: 1.0,
    },
  },
];
```

---

## Implementation Details

### 1. StylePanel.tsx (Main Wrapper)

```typescript
"use client";

import { useState } from "react";
import { useWorkshop } from "../WorkshopContext";
import { StyleControlsPanel } from "@/components/editor/StyleControlsPanel";
import { TemplateSelector } from "./TemplateSelector";
import { AutoFitToggle } from "./AutoFitToggle";
import { useAutoFit } from "./useAutoFit";
import { TEMPLATE_PRESETS } from "./templatePresets";
import type { TemplatePreset, AutoFitStatus } from "./types";

export function StylePanel() {
  const { state, dispatch, updateStyle } = useWorkshop();
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Auto-fit hook
  const { status, adjustedStyle, reductions } = useAutoFit({
    content: state.content,
    style: state.styleSettings,
    targetHeight: 1056 - (state.styleSettings.margin_top ?? 0.75) * 96 * 2,
    enabled: state.fitToOnePage,
    onStyleChange: updateStyle,
  });

  const handlePresetSelect = (preset: TemplatePreset) => {
    setActivePreset(preset.id);
    updateStyle(preset.style);
  };

  const handleFitToggle = (enabled: boolean) => {
    dispatch({ type: "SET_FIT_TO_ONE_PAGE", payload: enabled });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Template Selector Section */}
      <div className="border-b p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          Template Presets
        </h3>
        <TemplateSelector
          presets={TEMPLATE_PRESETS}
          activePreset={activePreset}
          onSelect={handlePresetSelect}
        />
      </div>

      {/* Auto-Fit Toggle */}
      <div className="border-b p-4">
        <AutoFitToggle
          enabled={state.fitToOnePage}
          onToggle={handleFitToggle}
          status={status}
        />

        {/* Show reductions when fitted */}
        {status.state === "fitted" && reductions.length > 0 && (
          <div className="mt-2 text-xs text-gray-500">
            <span className="font-medium">Adjustments made:</span>
            <ul className="mt-1 space-y-0.5">
              {reductions.map((r, idx) => (
                <li key={idx}>
                  {r.label}: {r.from} → {r.to}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Existing Style Controls */}
      <div className="flex-1 overflow-auto">
        <StyleControlsPanel
          style={state.fitToOnePage ? adjustedStyle : state.styleSettings}
          onChange={updateStyle}
          disabled={state.fitToOnePage}
        />
      </div>
    </div>
  );
}
```

### 2. TemplateSelector.tsx

```typescript
"use client";

import { TemplateThumbnail } from "./TemplateThumbnail";
import type { TemplateSelectorProps } from "./types";

export function TemplateSelector({
  presets,
  activePreset,
  onSelect,
}: TemplateSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {presets.map((preset) => (
        <TemplateThumbnail
          key={preset.id}
          preset={preset}
          isActive={activePreset === preset.id}
          onClick={() => onSelect(preset)}
        />
      ))}
    </div>
  );
}
```

### 3. TemplateThumbnail.tsx

```typescript
"use client";

import { cn } from "@/lib/utils";
import type { TemplateThumbnailProps } from "./types";

export function TemplateThumbnail({
  preset,
  isActive,
  onClick,
}: TemplateThumbnailProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-start p-3 rounded-lg border-2 transition-all text-left",
        "hover:border-blue-300 hover:bg-blue-50/50",
        isActive
          ? "border-blue-500 bg-blue-50"
          : "border-gray-200 bg-white"
      )}
    >
      {/* Mini Preview */}
      <div
        className="w-full h-20 bg-white border rounded mb-2 overflow-hidden"
        style={{ fontFamily: preset.style.font_family }}
      >
        <MiniPreview preset={preset} />
      </div>

      {/* Name and Description */}
      <span className="text-sm font-medium text-gray-900">{preset.name}</span>
      <span className="text-xs text-gray-500 mt-0.5">{preset.description}</span>
    </button>
  );
}

function MiniPreview({ preset }: { preset: TemplatePreset }) {
  const { style } = preset;
  const scale = 0.15; // Scale down for thumbnail

  return (
    <div
      className="p-2 origin-top-left"
      style={{
        transform: `scale(${scale})`,
        width: `${100 / scale}%`,
        height: `${100 / scale}%`,
      }}
    >
      {/* Simulated resume structure */}
      <div
        style={{
          fontFamily: style.font_family,
          fontSize: `${style.font_size_heading}pt`,
          fontWeight: 600,
          marginBottom: `${style.section_spacing}px`,
        }}
      >
        John Smith
      </div>

      <div
        style={{
          fontSize: `${style.font_size_subheading}pt`,
          fontWeight: 500,
          borderBottom: "1px solid #ccc",
          paddingBottom: "4px",
          marginBottom: `${style.entry_spacing}px`,
        }}
      >
        Experience
      </div>

      <div
        style={{
          fontSize: `${style.font_size_body}pt`,
          lineHeight: style.line_spacing,
        }}
      >
        <div style={{ fontWeight: 500 }}>Software Engineer</div>
        <div style={{ color: "#666" }}>Tech Company</div>
        <ul style={{ paddingLeft: "16px", margin: `${style.entry_spacing}px 0` }}>
          <li>Built scalable systems</li>
          <li>Led team of 5 engineers</li>
        </ul>
      </div>
    </div>
  );
}
```

### 4. AutoFitToggle.tsx

```typescript
"use client";

import { cn } from "@/lib/utils";
import type { AutoFitToggleProps } from "./types";

export function AutoFitToggle({
  enabled,
  onToggle,
  status,
}: AutoFitToggleProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <label className="text-sm font-medium text-gray-700">
          Fit to One Page
        </label>
        <p className="text-xs text-gray-500 mt-0.5">
          Automatically adjust styles to fit content on one page
        </p>
      </div>

      <div className="flex items-center gap-2">
        {/* Status Indicator */}
        {status.state !== "idle" && (
          <StatusBadge status={status} />
        )}

        {/* Toggle Switch */}
        <button
          role="switch"
          aria-checked={enabled}
          onClick={() => onToggle(!enabled)}
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
            enabled ? "bg-blue-600" : "bg-gray-200"
          )}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
              enabled ? "translate-x-6" : "translate-x-1"
            )}
          />
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: AutoFitToggleProps["status"] }) {
  switch (status.state) {
    case "fitting":
      return (
        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded animate-pulse">
          Fitting...
        </span>
      );
    case "fitted":
      return (
        <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
          Fitted
        </span>
      );
    case "minimum_reached":
      return (
        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
          At minimum
        </span>
      );
    default:
      return null;
  }
}
```

### 5. useAutoFit.ts (Progressive Auto-Fit Hook)

```typescript
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { ResumeStyle, TailoredContent } from "@/lib/api/types";
import type {
  UseAutoFitOptions,
  UseAutoFitResult,
  AutoFitStatus,
  AutoFitReduction,
} from "./types";
import { PAGE_DIMENSIONS } from "../ResumePreview/types";

// Minimum values to preserve readability
const MINIMUMS = {
  font_size_body: 8,
  font_size_heading: 12,
  font_size_subheading: 9,
  line_spacing: 1.1,
  section_spacing: 8,
  entry_spacing: 4,
} as const;

// Maximum iterations to prevent infinite loops
const MAX_ITERATIONS = 20;

// Reduction step (5% per iteration)
const REDUCTION_FACTOR = 0.95;

export function useAutoFit({
  content,
  style,
  targetHeight,
  enabled,
  onStyleChange,
}: UseAutoFitOptions): UseAutoFitResult {
  const [status, setStatus] = useState<AutoFitStatus>({ state: "idle" });
  const [reductions, setReductions] = useState<AutoFitReduction[]>([]);

  // Estimate content height based on style and content
  const estimateHeight = useCallback(
    (s: ResumeStyle): number => {
      const baseHeight = 100; // Header
      const summaryHeight = content.summary ? 80 : 0;
      const expHeight = content.experience.length * (60 + 20 * 3); // entries * (header + bullets)
      const skillsHeight = Math.ceil(content.skills.length / 5) * 30;
      const highlightsHeight = content.highlights.length * 25;

      const total = baseHeight + summaryHeight + expHeight + skillsHeight + highlightsHeight;

      // Scale by font and spacing factors
      const fontScale = (s.font_size_body ?? 11) / 11;
      const lineScale = (s.line_spacing ?? 1.4) / 1.4;
      const spacingScale =
        ((s.section_spacing ?? 16) + (s.entry_spacing ?? 8)) / 24;

      return total * fontScale * lineScale * Math.sqrt(spacingScale);
    },
    [content]
  );

  // Run progressive auto-fit algorithm
  useEffect(() => {
    if (!enabled) {
      setStatus({ state: "idle" });
      setReductions([]);
      return;
    }

    const currentHeight = estimateHeight(style);

    if (currentHeight <= targetHeight) {
      setStatus({ state: "fitted", reductions: [] });
      setReductions([]);
      return;
    }

    setStatus({ state: "fitting", iteration: 0 });

    // Working copy of style
    const adjustedStyle = { ...style };
    const appliedReductions: AutoFitReduction[] = [];
    let height = currentHeight;
    let iterations = 0;
    let phase = 0;

    const phases = [
      { property: "font_size_body", label: "Body font", min: MINIMUMS.font_size_body },
      { property: "entry_spacing", label: "Entry spacing", min: MINIMUMS.entry_spacing },
      { property: "section_spacing", label: "Section spacing", min: MINIMUMS.section_spacing },
      { property: "line_spacing", label: "Line height", min: MINIMUMS.line_spacing },
    ] as const;

    while (height > targetHeight && iterations < MAX_ITERATIONS) {
      iterations++;

      const currentPhase = phases[phase];
      if (!currentPhase) break;

      const currentValue = (adjustedStyle[currentPhase.property] as number) ??
        (currentPhase.property === "line_spacing" ? 1.4 :
         currentPhase.property === "font_size_body" ? 11 : 8);

      if (currentValue > currentPhase.min) {
        const newValue = Math.max(
          currentPhase.min,
          currentValue * REDUCTION_FACTOR
        );

        // Track reduction
        if (appliedReductions.length === 0 ||
            appliedReductions[appliedReductions.length - 1].property !== currentPhase.property) {
          appliedReductions.push({
            property: currentPhase.property,
            from: currentValue,
            to: newValue,
            label: currentPhase.label,
          });
        } else {
          appliedReductions[appliedReductions.length - 1].to = newValue;
        }

        (adjustedStyle as Record<string, number>)[currentPhase.property] = newValue;

        // Scale related font sizes when body changes
        if (currentPhase.property === "font_size_body") {
          const ratio = newValue / currentValue;
          adjustedStyle.font_size_heading = Math.max(
            MINIMUMS.font_size_heading,
            (adjustedStyle.font_size_heading ?? 18) * ratio
          );
          adjustedStyle.font_size_subheading = Math.max(
            MINIMUMS.font_size_subheading,
            (adjustedStyle.font_size_subheading ?? 12) * ratio
          );
        }
      } else {
        // Move to next phase
        phase++;
      }

      height = estimateHeight(adjustedStyle);
      setStatus({ state: "fitting", iteration: iterations });
    }

    // Apply final style
    onStyleChange(adjustedStyle);
    setReductions(appliedReductions);

    if (height <= targetHeight) {
      setStatus({ state: "fitted", reductions: appliedReductions.map((r) => r.label) });
    } else {
      setStatus({
        state: "minimum_reached",
        message: "Content still exceeds one page at minimum settings",
      });
    }
  }, [enabled, style, content, targetHeight, estimateHeight, onStyleChange]);

  const adjustedStyle = useMemo(() => {
    if (!enabled) return style;
    // Return the current style (already adjusted by effect)
    return style;
  }, [enabled, style]);

  return {
    status,
    adjustedStyle,
    reductions,
  };
}
```

---

## Integration Point

**File**: `WorkshopControlPanel.tsx`

**Current** (StyleTab function):

```typescript
function StyleTab() {
  const { state, updateStyle } = useWorkshop();
  return (
    <StyleControlsPanel
      style={state.styleSettings}
      onChange={updateStyle}
    />
  );
}
```

**Replace with**:

```typescript
import { StylePanel } from "./panels/StylePanel";

// In renderTabContent():
case "style":
  return <StylePanel />;
```

---

## State Management Updates

### WorkshopContext.tsx - Already has required state

```typescript
// Existing state (no changes needed)
fitToOnePage: boolean;

// Existing action (no changes needed)
| { type: "SET_FIT_TO_ONE_PAGE"; payload: boolean }
```

### Optional: Add template tracking

```typescript
// Add to WorkshopState
activeTemplateId: string | null;

// Add action
| { type: "SET_ACTIVE_TEMPLATE"; payload: string | null }
```

---

## Style Controls Panel Integration

The existing `StyleControlsPanel` accepts a `disabled` prop to lock controls when auto-fit is enabled:

```typescript
interface StyleControlsPanelProps {
  style: ResumeStyle;
  onChange: (style: Partial<ResumeStyle>) => void;
  disabled?: boolean; // Add this prop if not present
}
```

When `disabled={true}`:
- Show subtle overlay or reduced opacity
- Prevent user changes
- Display message: "Styles locked while Auto-Fit is enabled"

---

## Edge Cases

| Edge Case | Solution |
|-----------|----------|
| Content already fits | Skip auto-fit, show "Already fits" status |
| Content way too long | Hit minimums, show warning with suggestions |
| Template change during auto-fit | Cancel auto-fit, apply new template |
| Rapid style changes | Debounce height estimation |
| Custom font not loaded | Fall back to system font in estimation |
| PDF export mismatch | Use same algorithm in export backend |

---

## Testing Strategy

### Unit Tests

```typescript
// tests/unit/auto-fit.spec.ts

describe("useAutoFit", () => {
  test("returns idle when disabled", () => {
    const { result } = renderHook(() =>
      useAutoFit({ enabled: false, ... })
    );
    expect(result.current.status.state).toBe("idle");
  });

  test("progressive reduction order", () => {
    // Track which properties are reduced first
    const reductionOrder = trackReductionOrder(longContent);
    expect(reductionOrder.map(r => r.property)).toEqual([
      "font_size_body",
      "entry_spacing",
      "section_spacing",
      "line_spacing",
    ]);
  });

  test("respects all minimums", () => {
    const result = fitToOnePage(extremelyLongContent);
    expect(result.font_size_body).toBeGreaterThanOrEqual(MINIMUMS.font_size_body);
    expect(result.line_spacing).toBeGreaterThanOrEqual(MINIMUMS.line_spacing);
  });

  test("terminates within iteration limit", () => {
    const startTime = Date.now();
    fitToOnePage(infiniteContent);
    expect(Date.now() - startTime).toBeLessThan(1000);
  });
});
```

### Component Tests

```typescript
// tests/components/StylePanel.spec.tsx

test("template selection applies style", async () => {
  render(<StylePanel />);

  await userEvent.click(screen.getByText("Modern"));

  expect(mockUpdateStyle).toHaveBeenCalledWith(
    expect.objectContaining({ font_family: "Inter" })
  );
});

test("auto-fit toggle shows status", async () => {
  render(<StylePanel />);

  await userEvent.click(screen.getByRole("switch"));

  expect(screen.getByText(/Fitting/)).toBeInTheDocument();
});
```

### Visual Regression

- Template thumbnails render correctly
- Auto-fit status badges display properly
- Disabled state styling visible

---

## Acceptance Criteria

- [ ] Template grid shows 4 presets with mini previews
- [ ] Clicking template applies its style immediately
- [ ] Active template has visual indicator (blue border)
- [ ] Auto-fit toggle enables progressive reduction
- [ ] Auto-fit shows status badge (Fitting/Fitted/At minimum)
- [ ] Auto-fit shows list of adjustments made
- [ ] Style controls locked when auto-fit enabled
- [ ] Progressive reduction follows correct order
- [ ] All minimums respected
- [ ] Algorithm terminates within 20 iterations
- [ ] Preview updates in real-time

---

## Handoff Notes

**Files to reference:**
- `StyleControlsPanel.tsx` at `/frontend/src/components/editor/StyleControlsPanel.tsx` - existing controls to wrap
- `WorkshopControlPanel.tsx` at `/frontend/src/components/workshop/WorkshopControlPanel.tsx` - integration point
- `previewStyles.ts` at `/frontend/src/components/workshop/ResumePreview/previewStyles.ts` - has `calculateFitToPageStyles` reference implementation

**Context patterns:**
```typescript
const { state, dispatch, updateStyle } = useWorkshop();
dispatch({ type: "SET_FIT_TO_ONE_PAGE", payload: enabled });
updateStyle({ font_family: "Inter", font_size_body: 10 });
```

**Dependencies:**
- No new npm packages required
- Uses existing Tailwind CSS
- Uses existing HeadlessUI components

---

## Evaluation Notes

Per `250226_resume-editor-recommendation-evaluation.md`:

### Progressive Auto-Fit (Adopted)

The progressive reduction algorithm maintains document readability by:
1. Reducing fonts first (most visual impact with least readability loss)
2. Then entry spacing (space between items)
3. Then section spacing (space between sections)
4. Finally line height (last resort, affects readability most)

This is superior to uniform scaling which makes everything equally smaller.

### Template Thumbnails (Adopted - Elevated Priority)

Live mini-previews help users understand style differences before committing. This was elevated from "nice to have" to P1 based on user experience considerations.
