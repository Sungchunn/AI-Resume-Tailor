# Phase 3: StylePanel Refactor

**Parent:** [Master Plan](./060326_master-plan.md)

## Objective

Integrate `QuickStyleControls` and `AdvancedStyleControls` into `StylePanel.tsx`.

## Tasks

### 3.1 Update StylePanel.tsx

**File:** `/frontend/src/components/workshop/panels/style/StylePanel.tsx`

Replace the current structure that uses `StyleControlsPanel` with the new Quick/Advanced components:

```typescript
"use client";

import { useState } from "react";
import { useWorkshop } from "../../WorkshopContext";
import { TemplateSelector } from "./TemplateSelector";
import { AutoFitToggle } from "./AutoFitToggle";
import { QuickStyleControls } from "./QuickStyleControls";
import { AdvancedStyleControls } from "./AdvancedStyleControls";
import { useAutoFit } from "./useAutoFit";
import { TEMPLATE_PRESETS } from "./templatePresets";
import { DEFAULT_STYLE } from "@/lib/styles/defaultStyle";
import type { TemplatePreset } from "./types";
import type { ResumeStyle } from "@/lib/api/types";

export function StylePanel() {
  const { state, dispatch } = useWorkshop();
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Auto-fit hook
  const { status, adjustedStyle, reductions } = useAutoFit({
    content: state.content,
    style: state.styleSettings,
    targetHeight: 1056 - (state.styleSettings.margin_top ?? 0.75) * 96 * 2,
    enabled: state.fitToOnePage,
    onStyleChange: (style) => {
      dispatch({ type: "SET_STYLE", payload: style });
    },
  });

  const currentStyle = state.fitToOnePage ? adjustedStyle : state.styleSettings;

  const handlePresetSelect = (preset: TemplatePreset) => {
    setActivePreset(preset.id);
    dispatch({ type: "SET_STYLE", payload: preset.style });
  };

  const handleFitToggle = (enabled: boolean) => {
    dispatch({ type: "SET_FIT_TO_ONE_PAGE", payload: enabled });
  };

  const handleStyleChange = (style: ResumeStyle) => {
    setActivePreset(null);
    dispatch({ type: "SET_STYLE", payload: style });
  };

  const handleReset = () => {
    setActivePreset(null);
    dispatch({ type: "SET_STYLE", payload: DEFAULT_STYLE });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Template Selector Section */}
      <div className="border-b p-4">
        <h3 className="text-sm font-medium text-foreground/80 mb-3">
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
          <div className="mt-2 text-xs text-muted-foreground">
            <span className="font-medium">Adjustments made:</span>
            <ul className="mt-1 space-y-0.5">
              {reductions.map((r, idx) => (
                <li key={idx}>
                  {r.label}: {r.from.toFixed(1)} → {r.to.toFixed(1)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Show warning when minimum reached */}
        {status.state === "minimum_reached" && (
          <div className="mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
            {status.message}
          </div>
        )}
      </div>

      {/* Quick Access Section - Always Visible */}
      <div className="border-b p-4">
        <h3 className="text-sm font-medium text-foreground/80 mb-3">
          Quick Access
        </h3>
        {state.fitToOnePage && (
          <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded mb-3">
            Styles locked while Auto-Fit is enabled
          </div>
        )}
        <QuickStyleControls
          style={currentStyle}
          onChange={handleStyleChange}
          disabled={state.fitToOnePage}
        />
      </div>

      {/* Advanced Settings - Collapsed by Default */}
      <div className="flex-1 overflow-auto border-t">
        <AdvancedStyleControls
          style={currentStyle}
          onChange={handleStyleChange}
          onReset={handleReset}
          disabled={state.fitToOnePage}
          defaultExpanded={false}
        />
      </div>
    </div>
  );
}
```

### 3.2 Update Component Exports

**File:** `/frontend/src/components/workshop/panels/style/index.ts` (if exists)

Add exports for new components:

```typescript
export { StylePanel } from "./StylePanel";
export { QuickStyleControls } from "./QuickStyleControls";
export { AdvancedStyleControls } from "./AdvancedStyleControls";
// ... other exports
```

## Verification

- [ ] Template Presets section visible at top
- [ ] Auto-Fit toggle below presets with status indicators
- [ ] Quick Access section always visible with font, body size, line spacing
- [ ] "Styles locked" warning appears when Auto-Fit enabled
- [ ] Advanced Settings collapsed by default
- [ ] Clicking Advanced header expands to show typography, spacing, margins
- [ ] Entry spacing slider visible in Advanced > Spacing
- [ ] All style changes reflect in preview immediately
- [ ] Reset button in Advanced section works correctly
