"use client";

import { FileText, Type, Lock, Check } from "lucide-react";
import { useBlockEditor } from "../BlockEditorContext";
import { STYLE_PRESETS, type StylePresetName } from "@/lib/resume/defaults";
import type { AutoFitStatus, AutoFitReduction } from "../style/useAutoFitBlocks";

/**
 * Font preset info - categorized by type
 */
const FONT_PRESETS: {
  preset: StylePresetName;
  label: string;
  category: "sans" | "serif";
}[] = [
  { preset: "inter", label: "Inter", category: "sans" },
  { preset: "roboto", label: "Roboto", category: "sans" },
  { preset: "openSans", label: "Open Sans", category: "sans" },
  { preset: "lato", label: "Lato", category: "sans" },
  { preset: "arial", label: "Arial", category: "sans" },
  { preset: "georgia", label: "Georgia", category: "serif" },
  { preset: "timesNewRoman", label: "Times New Roman", category: "serif" },
];

/**
 * FormattingTab - Clean, organized style controls
 *
 * Layout:
 * 1. Page Fitting card - toggle + min font slider (grouped together)
 * 2. Typography section - font grid with current style info
 */
export function FormattingTab() {
  const {
    state,
    applyStylePreset,
    setFitToOnePage,
    setMinFontSize,
    autoFitStatus,
    autoFitReductions,
  } = useBlockEditor();
  const { style, fitToOnePage, minFontSize } = state;

  // Determine which preset is currently active (if any)
  const activePreset = (Object.keys(STYLE_PRESETS) as StylePresetName[]).find(
    (key) => STYLE_PRESETS[key].fontFamily === style.fontFamily
  );

  return (
    <div className="h-full flex flex-col overflow-auto">
      <div className="p-4 space-y-5">
        {/* Page Fitting Card */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {/* Card Header with Toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/30">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                Fit to One Page
              </span>
            </div>
            <div className="flex items-center gap-2">
              <FitStatusBadge status={autoFitStatus} />
              <button
                role="switch"
                aria-checked={fitToOnePage}
                data-testid="fit-to-page-toggle"
                onClick={() => setFitToOnePage(!fitToOnePage)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 ${
                  fitToOnePage ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                    fitToOnePage ? "translate-x-[18px]" : "translate-x-[3px]"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Expanded Content when enabled */}
          <div
            className={`transition-all duration-200 ${
              fitToOnePage
                ? "max-h-48 opacity-100"
                : "max-h-0 opacity-0 overflow-hidden"
            }`}
          >
            <div className="p-3 pt-0 space-y-3">
              {/* Min Font Size Slider */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">
                    Minimum font size
                  </span>
                  <span className="text-xs font-medium text-foreground tabular-nums">
                    {minFontSize}pt
                  </span>
                </div>
                <input
                  type="range"
                  min={7}
                  max={10}
                  step={1}
                  value={minFontSize}
                  onChange={(e) => setMinFontSize(Number(e.target.value))}
                  className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>Compact</span>
                  <span>Readable</span>
                </div>
              </div>

              {/* Adjustments Made */}
              {autoFitStatus.state === "fitted" &&
                autoFitReductions.length > 0 && (
                  <AdjustmentsList reductions={autoFitReductions} />
                )}

              {/* Warning */}
              {autoFitStatus.state === "minimum_reached" &&
                autoFitStatus.message && (
                  <div
                    data-testid="fit-minimum-warning"
                    className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2"
                  >
                    {autoFitStatus.message}
                  </div>
                )}
            </div>
          </div>
        </div>

        {/* Typography Section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Type className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              Typography
            </span>
            {fitToOnePage && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
                <Lock className="w-3 h-3" />
                Locked
              </span>
            )}
          </div>

          {/* Current Font Display */}
          <div
            data-testid="current-font-display"
            className="flex items-center justify-between px-3 py-2 mb-3 rounded-md bg-muted/50 border border-border"
          >
            <span className="text-sm text-foreground font-medium">
              {style.fontFamily}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {style.fontSizeBody}pt / {style.lineSpacing.toFixed(2)} height
            </span>
          </div>

          {/* Font Grid - 2 columns */}
          <div
            data-testid="font-preset-grid"
            className={`grid grid-cols-2 gap-1.5 ${
              fitToOnePage ? "opacity-40 pointer-events-none" : ""
            }`}
          >
            {FONT_PRESETS.map(({ preset, label, category }) => {
              const isActive = activePreset === preset;
              return (
                <button
                  key={preset}
                  data-testid={`font-preset-${preset}`}
                  onClick={() => applyStylePreset(preset)}
                  disabled={fitToOnePage}
                  className={`relative px-2.5 py-2 rounded-md border text-left transition-all ${
                    isActive
                      ? "border-primary bg-primary/10 ring-1 ring-primary/50"
                      : "border-border bg-card hover:border-primary/40 hover:bg-accent/30"
                  }`}
                >
                  <span className="text-sm font-medium text-foreground block truncate">
                    {label}
                  </span>
                  <span className="text-[10px] text-muted-foreground capitalize">
                    {category}
                  </span>
                  {isActive && (
                    <Check className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Status badge for fit-to-page
 */
function FitStatusBadge({ status }: { status: AutoFitStatus }) {
  if (status.state === "idle") return null;

  const styles = {
    fitting: "text-primary bg-primary/10 animate-pulse",
    fitted: "text-green-600 bg-green-50",
    minimum_reached: "text-amber-600 bg-amber-50",
  };

  const labels = {
    fitting: "Fitting...",
    fitted: "Fitted",
    minimum_reached: "Limit",
  };

  return (
    <span
      data-testid="fit-status-badge"
      className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${styles[status.state]}`}
    >
      {labels[status.state]}
    </span>
  );
}

/**
 * List of adjustments made by auto-fit
 */
function AdjustmentsList({ reductions }: { reductions: AutoFitReduction[] }) {
  return (
    <div
      className="text-xs bg-green-50 border border-green-100 rounded p-2"
      data-testid="fit-adjustments-list"
    >
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-green-700">
        {reductions.map((r, idx) => (
          <span key={idx} className="whitespace-nowrap">
            {r.label}: {r.from.toFixed(1)} &rarr; {r.to.toFixed(1)}
          </span>
        ))}
      </div>
    </div>
  );
}
