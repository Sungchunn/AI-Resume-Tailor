"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import { useBlockEditor } from "./BlockEditorContext";
import { STYLE_PRESETS, type StylePresetName } from "@/lib/resume/defaults";
import { AutoFitToggle } from "./style";

interface EditorToolbarProps {
  /** Whether the preview is in full-screen mode */
  isPreviewFullscreen?: boolean;
  /** Toggle preview full-screen mode */
  onTogglePreviewFullscreen?: () => void;
}

/**
 * Style preset descriptions for UI display
 */
const PRESET_INFO: Record<
  StylePresetName,
  { label: string; font: string }
> = {
  modern: { label: "Modern", font: "Inter" },
  classic: { label: "Classic", font: "Times New Roman" },
  minimal: { label: "Minimal", font: "Open Sans" },
  executive: { label: "Executive", font: "Georgia" },
};

/**
 * EditorToolbar - Simplified style controls panel for the block editor
 *
 * Features:
 * - Auto-fit to one page toggle
 * - Style presets (Classic/Modern/Minimal/Executive)
 * - Minimum font size slider
 * - Fullscreen preview toggle
 */
export function EditorToolbar({
  isPreviewFullscreen,
  onTogglePreviewFullscreen,
}: EditorToolbarProps) {
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
    <div className="bg-card border-b border-border">
      {/* Header with fullscreen toggle */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <h2 className="text-sm font-medium text-foreground">Formatting</h2>
        {onTogglePreviewFullscreen && (
          <button
            onClick={onTogglePreviewFullscreen}
            className="p-1.5 text-muted-foreground hover:text-foreground/80 hover:bg-accent rounded transition-colors"
            title={isPreviewFullscreen ? "Exit fullscreen" : "Fullscreen preview"}
          >
            {isPreviewFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-6 max-h-[calc(100vh-200px)] overflow-auto">
        {/* Auto-fit Toggle */}
        <div className="pb-4 border-b border-border">
          <AutoFitToggle
            enabled={fitToOnePage}
            onToggle={setFitToOnePage}
            status={autoFitStatus}
            reductions={autoFitReductions}
          />
        </div>

        {/* Minimum Font Size (only when fit-to-page is enabled) */}
        {fitToOnePage && (
          <div className="pb-4 border-b border-border">
            <label className="block text-sm font-medium text-foreground mb-2">
              Minimum Font Size
            </label>
            <p className="text-xs text-muted-foreground mb-3">
              The smallest font the algorithm can use.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={7}
                max={10}
                step={1}
                value={minFontSize}
                onChange={(e) => setMinFontSize(Number(e.target.value))}
                className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <span className="text-sm font-medium text-foreground w-12 text-right">
                {minFontSize}pt
              </span>
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-1">
              <span>Compact</span>
              <span>Readable</span>
            </div>
          </div>
        )}

        {/* Style Presets */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-3">
            Style
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(PRESET_INFO) as StylePresetName[]).map((preset) => {
              const info = PRESET_INFO[preset];
              const isActive = activePreset === preset;
              return (
                <button
                  key={preset}
                  onClick={() => applyStylePreset(preset)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    isActive
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-card hover:border-primary/50 hover:bg-accent/50"
                  }`}
                >
                  <div className="text-sm font-medium text-foreground">
                    {info.label}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {info.font}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Current Style Summary */}
        <div className="pt-2">
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>Font</span>
              <span className="text-foreground">{style.fontFamily}</span>
            </div>
            <div className="flex justify-between">
              <span>Body Size</span>
              <span className="text-foreground">{style.fontSizeBody}pt</span>
            </div>
            <div className="flex justify-between">
              <span>Line Height</span>
              <span className="text-foreground">{style.lineSpacing.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
