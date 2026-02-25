"use client";

import { useState } from "react";
import { useWorkshop } from "../../WorkshopContext";
import { StyleControlsPanel, DEFAULT_STYLE } from "@/components/editor/StyleControlsPanel";
import { TemplateSelector } from "./TemplateSelector";
import { AutoFitToggle } from "./AutoFitToggle";
import { useAutoFit } from "./useAutoFit";
import { TEMPLATE_PRESETS } from "./templatePresets";
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

  const handlePresetSelect = (preset: TemplatePreset) => {
    setActivePreset(preset.id);
    dispatch({ type: "SET_STYLE", payload: preset.style });
  };

  const handleFitToggle = (enabled: boolean) => {
    dispatch({ type: "SET_FIT_TO_ONE_PAGE", payload: enabled });
  };

  const handleStyleChange = (style: ResumeStyle) => {
    // Clear active preset when user manually changes style
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

      {/* Existing Style Controls */}
      <div className="flex-1 overflow-auto">
        <StyleControlsPanel
          style={state.fitToOnePage ? adjustedStyle : state.styleSettings}
          onChange={handleStyleChange}
          onReset={handleReset}
          disabled={state.fitToOnePage}
        />
      </div>
    </div>
  );
}
