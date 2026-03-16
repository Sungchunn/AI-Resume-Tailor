"use client";

import { useBlockEditor } from "../BlockEditorContext";
import { FONT_FAMILIES } from "@/lib/resume/defaults";
import { AutoFitToggle } from "../style";
import type { BlockEditorStyle } from "@/lib/resume/types";

/**
 * FormattingTab - Unified style controls for the resume editor
 *
 * Features:
 * - Auto-fit to one page toggle
 * - Font family and size controls
 * - Margin and spacing controls
 */
export function FormattingTab() {
  const {
    state,
    updateStyle,
    setFitToOnePage,
    autoFitStatus,
    autoFitReductions,
  } = useBlockEditor();
  const { style, fitToOnePage } = state;

  const disabled = fitToOnePage;

  const inputClass = `w-full px-3 py-2 text-sm border border-input rounded-md focus:ring-2 focus:ring-ring focus:border-transparent bg-background ${
    disabled ? "bg-muted opacity-60 cursor-not-allowed" : ""
  }`;

  const inputClassSm = `w-full px-2 py-1.5 text-sm border border-input rounded focus:ring-2 focus:ring-ring focus:border-transparent bg-background ${
    disabled ? "bg-muted opacity-60 cursor-not-allowed" : ""
  }`;

  return (
    <div className="h-full flex flex-col overflow-auto">
      <div className="p-4 space-y-6">
        {/* Auto-fit Toggle */}
        <div className="pb-4 border-b border-border">
          <AutoFitToggle
            enabled={fitToOnePage}
            onToggle={setFitToOnePage}
            status={autoFitStatus}
            reductions={autoFitReductions}
          />
        </div>

        {disabled && (
          <p className="text-xs text-muted-foreground/60 italic">
            Style settings are managed by auto-fit when enabled
          </p>
        )}

        {/* Font Settings */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
            Font
          </h3>

          {/* Font Family */}
          <div>
            <label className="block text-xs font-medium text-foreground/80 mb-1.5">
              Family
            </label>
            <select
              value={style.fontFamily}
              onChange={(e) => updateStyle({ fontFamily: e.target.value })}
              disabled={disabled}
              className={inputClass}
            >
              {FONT_FAMILIES.map((font) => (
                <option key={font.value} value={font.value}>
                  {font.label}
                </option>
              ))}
            </select>
          </div>

          {/* Font Sizes */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-foreground/80 mb-1.5">
                Body
              </label>
              <input
                type="number"
                min={8}
                max={14}
                value={style.fontSizeBody}
                onChange={(e) => updateStyle({ fontSizeBody: Number(e.target.value) })}
                disabled={disabled}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground/80 mb-1.5">
                Heading
              </label>
              <input
                type="number"
                min={12}
                max={24}
                value={style.fontSizeHeading}
                onChange={(e) => updateStyle({ fontSizeHeading: Number(e.target.value) })}
                disabled={disabled}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground/80 mb-1.5">
                Subheading
              </label>
              <input
                type="number"
                min={10}
                max={18}
                value={style.fontSizeSubheading}
                onChange={(e) => updateStyle({ fontSizeSubheading: Number(e.target.value) })}
                disabled={disabled}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Spacing Settings */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
            Spacing
          </h3>

          {/* Line and Section Spacing */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-foreground/80 mb-1.5">
                Line Height
              </label>
              <input
                type="number"
                min={1}
                max={2}
                step={0.05}
                value={style.lineSpacing}
                onChange={(e) => updateStyle({ lineSpacing: Number(e.target.value) })}
                disabled={disabled}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground/80 mb-1.5">
                Section Gap
              </label>
              <input
                type="number"
                min={4}
                max={40}
                step={2}
                value={style.sectionSpacing}
                onChange={(e) => updateStyle({ sectionSpacing: Number(e.target.value) })}
                disabled={disabled}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground/80 mb-1.5">
                Entry Gap
              </label>
              <input
                type="number"
                min={2}
                max={24}
                step={2}
                value={style.entrySpacing}
                onChange={(e) => updateStyle({ entrySpacing: Number(e.target.value) })}
                disabled={disabled}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Margin Settings */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
            Margins (inches)
          </h3>

          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">Top</label>
              <input
                type="number"
                min={0.25}
                max={1.5}
                step={0.05}
                value={style.marginTop}
                onChange={(e) => updateStyle({ marginTop: Number(e.target.value) })}
                disabled={disabled}
                className={inputClassSm}
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">Bottom</label>
              <input
                type="number"
                min={0.25}
                max={1.5}
                step={0.05}
                value={style.marginBottom}
                onChange={(e) => updateStyle({ marginBottom: Number(e.target.value) })}
                disabled={disabled}
                className={inputClassSm}
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">Left</label>
              <input
                type="number"
                min={0.25}
                max={1.5}
                step={0.05}
                value={style.marginLeft}
                onChange={(e) => updateStyle({ marginLeft: Number(e.target.value) })}
                disabled={disabled}
                className={inputClassSm}
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">Right</label>
              <input
                type="number"
                min={0.25}
                max={1.5}
                step={0.05}
                value={style.marginRight}
                onChange={(e) => updateStyle({ marginRight: Number(e.target.value) })}
                disabled={disabled}
                className={inputClassSm}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
