# Phase 2: New Components

**Parent:** [Master Plan](./060326_master-plan.md)

## Objective

Create `QuickStyleControls` and `AdvancedStyleControls` components.

## Tasks

### 2.1 Create QuickStyleControls.tsx

**File:** `/frontend/src/components/workshop/panels/style/QuickStyleControls.tsx` (NEW)

```typescript
"use client";

import { useCallback } from "react";
import type { ResumeStyle } from "@/lib/api/types";
import { DEFAULT_STYLE, FONT_OPTIONS } from "@/lib/styles/defaultStyle";

interface QuickStyleControlsProps {
  style: ResumeStyle;
  onChange: (style: ResumeStyle) => void;
  disabled?: boolean;
}

export function QuickStyleControls({
  style,
  onChange,
  disabled = false,
}: QuickStyleControlsProps) {
  const handleChange = useCallback(
    (key: keyof ResumeStyle, value: string | number) => {
      onChange({ ...style, [key]: value });
    },
    [style, onChange]
  );

  return (
    <div className={`space-y-4 ${disabled ? "opacity-60 pointer-events-none" : ""}`}>
      {/* Font Family */}
      <div>
        <label className="block text-xs text-muted-foreground mb-1">
          Font Family
        </label>
        <select
          value={style.font_family || DEFAULT_STYLE.font_family}
          onChange={(e) => handleChange("font_family", e.target.value)}
          className="w-full px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {FONT_OPTIONS.map((font) => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>
      </div>

      {/* Body Font Size */}
      <div>
        <label className="block text-xs text-muted-foreground mb-1">
          Body Font Size: {style.font_size_body || DEFAULT_STYLE.font_size_body}pt
        </label>
        <input
          type="range"
          min={8}
          max={14}
          step={1}
          value={style.font_size_body || DEFAULT_STYLE.font_size_body}
          onChange={(e) => handleChange("font_size_body", parseInt(e.target.value))}
          className="w-full accent-primary"
        />
      </div>

      {/* Line Spacing */}
      <div>
        <label className="block text-xs text-muted-foreground mb-1">
          Line Spacing: {(style.line_spacing || DEFAULT_STYLE.line_spacing)?.toFixed(2)}
        </label>
        <input
          type="range"
          min={1}
          max={2}
          step={0.05}
          value={style.line_spacing || DEFAULT_STYLE.line_spacing}
          onChange={(e) => handleChange("line_spacing", parseFloat(e.target.value))}
          className="w-full accent-primary"
        />
      </div>
    </div>
  );
}
```

### 2.2 Create AdvancedStyleControls.tsx

**File:** `/frontend/src/components/workshop/panels/style/AdvancedStyleControls.tsx` (NEW)

```typescript
"use client";

import { useState, useCallback } from "react";
import type { ResumeStyle } from "@/lib/api/types";
import { DEFAULT_STYLE } from "@/lib/styles/defaultStyle";

interface AdvancedStyleControlsProps {
  style: ResumeStyle;
  onChange: (style: ResumeStyle) => void;
  onReset: () => void;
  disabled?: boolean;
  defaultExpanded?: boolean;
}

export function AdvancedStyleControls({
  style,
  onChange,
  onReset,
  disabled = false,
  defaultExpanded = false,
}: AdvancedStyleControlsProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const handleChange = useCallback(
    (key: keyof ResumeStyle, value: string | number) => {
      onChange({ ...style, [key]: value });
    },
    [style, onChange]
  );

  return (
    <div className={`${disabled ? "opacity-60 pointer-events-none" : ""}`}>
      {/* Accordion Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-accent"
      >
        <span className="text-sm font-medium text-foreground/80">
          Advanced Settings
        </span>
        <svg
          className={`w-4 h-4 text-muted-foreground transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Accordion Content */}
      {expanded && (
        <div className="p-4 pt-0 space-y-6">
          {/* Reset Button */}
          <div className="flex justify-end">
            <button
              onClick={onReset}
              disabled={disabled}
              className="text-xs text-muted-foreground hover:text-foreground/80 disabled:cursor-not-allowed"
            >
              Reset to Default
            </button>
          </div>

          {/* Typography Section */}
          <div>
            <h4 className="text-xs font-medium text-foreground/70 mb-3 uppercase tracking-wide">
              Typography
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Heading Size
                </label>
                <input
                  type="number"
                  min={12}
                  max={24}
                  value={style.font_size_heading || DEFAULT_STYLE.font_size_heading}
                  onChange={(e) => handleChange("font_size_heading", parseInt(e.target.value))}
                  className="w-full px-2 py-1.5 text-sm border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Subheading Size
                </label>
                <input
                  type="number"
                  min={10}
                  max={18}
                  value={style.font_size_subheading || DEFAULT_STYLE.font_size_subheading}
                  onChange={(e) => handleChange("font_size_subheading", parseInt(e.target.value))}
                  className="w-full px-2 py-1.5 text-sm border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          </div>

          {/* Spacing Section */}
          <div>
            <h4 className="text-xs font-medium text-foreground/70 mb-3 uppercase tracking-wide">
              Spacing
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Section Spacing: {style.section_spacing || DEFAULT_STYLE.section_spacing}
                </label>
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={style.section_spacing || DEFAULT_STYLE.section_spacing}
                  onChange={(e) => handleChange("section_spacing", parseFloat(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Entry Spacing: {style.entry_spacing || DEFAULT_STYLE.entry_spacing}px
                </label>
                <input
                  type="range"
                  min={4}
                  max={16}
                  step={1}
                  value={style.entry_spacing || DEFAULT_STYLE.entry_spacing}
                  onChange={(e) => handleChange("entry_spacing", parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </div>
          </div>

          {/* Margins Section */}
          <div>
            <h4 className="text-xs font-medium text-foreground/70 mb-3 uppercase tracking-wide">
              Margins (inches)
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Top</label>
                <input
                  type="number"
                  min={0.25}
                  max={1.5}
                  step={0.05}
                  value={style.margin_top || DEFAULT_STYLE.margin_top}
                  onChange={(e) => handleChange("margin_top", parseFloat(e.target.value))}
                  className="w-full px-2 py-1.5 text-sm border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Bottom</label>
                <input
                  type="number"
                  min={0.25}
                  max={1.5}
                  step={0.05}
                  value={style.margin_bottom || DEFAULT_STYLE.margin_bottom}
                  onChange={(e) => handleChange("margin_bottom", parseFloat(e.target.value))}
                  className="w-full px-2 py-1.5 text-sm border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Left</label>
                <input
                  type="number"
                  min={0.25}
                  max={1.5}
                  step={0.05}
                  value={style.margin_left || DEFAULT_STYLE.margin_left}
                  onChange={(e) => handleChange("margin_left", parseFloat(e.target.value))}
                  className="w-full px-2 py-1.5 text-sm border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Right</label>
                <input
                  type="number"
                  min={0.25}
                  max={1.5}
                  step={0.05}
                  value={style.margin_right || DEFAULT_STYLE.margin_right}
                  onChange={(e) => handleChange("margin_right", parseFloat(e.target.value))}
                  className="w-full px-2 py-1.5 text-sm border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

## Verification

- [ ] QuickStyleControls renders font dropdown, body size slider, line spacing slider
- [ ] AdvancedStyleControls renders collapsed by default
- [ ] Clicking Advanced header expands/collapses content
- [ ] Entry spacing slider appears with 4-16px range
- [ ] All controls call onChange with updated style object
- [ ] Disabled state applies opacity and pointer-events-none
