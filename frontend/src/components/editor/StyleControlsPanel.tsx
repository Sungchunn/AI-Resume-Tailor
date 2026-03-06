"use client";

import { useState, useCallback } from "react";
import type { ResumeStyle } from "@/lib/api/types";
import { DEFAULT_STYLE, FONT_OPTIONS } from "@/lib/styles/defaultStyle";

interface StyleControlsPanelProps {
  style: ResumeStyle;
  onChange: (style: ResumeStyle) => void;
  onReset: () => void;
  disabled?: boolean;
}

export function StyleControlsPanel({
  style,
  onChange,
  onReset,
  disabled = false,
}: StyleControlsPanelProps) {
  const [expanded, setExpanded] = useState({
    typography: true,
    spacing: true,
    margins: false,
  });

  const handleChange = useCallback(
    (key: keyof ResumeStyle, value: string | number) => {
      onChange({ ...style, [key]: value });
    },
    [style, onChange]
  );

  const toggleSection = (section: keyof typeof expanded) => {
    setExpanded((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className={`h-full overflow-y-auto p-4 space-y-4 ${disabled ? "opacity-60 pointer-events-none" : ""}`}>
      {disabled && (
        <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded mb-2">
          Styles locked while Auto-Fit is enabled
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Style Settings</h3>
        <button
          onClick={onReset}
          disabled={disabled}
          className="text-xs text-muted-foreground hover:text-foreground/80 disabled:cursor-not-allowed"
        >
          Reset to Default
        </button>
      </div>

      {/* Typography Section */}
      <div className="border rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection("typography")}
          className="w-full flex items-center justify-between p-3 bg-muted hover:bg-accent"
        >
          <span className="text-sm font-medium text-foreground/80">Typography</span>
          <svg
            className={`w-4 h-4 text-muted-foreground transition-transform ${
              expanded.typography ? "rotate-180" : ""
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
        {expanded.typography && (
          <div className="p-3 space-y-4">
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

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Body Size
                </label>
                <input
                  type="number"
                  min={8}
                  max={14}
                  value={style.font_size_body || DEFAULT_STYLE.font_size_body}
                  onChange={(e) =>
                    handleChange("font_size_body", parseInt(e.target.value))
                  }
                  className="w-full px-2 py-1.5 text-sm border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Heading
                </label>
                <input
                  type="number"
                  min={12}
                  max={24}
                  value={
                    style.font_size_heading || DEFAULT_STYLE.font_size_heading
                  }
                  onChange={(e) =>
                    handleChange("font_size_heading", parseInt(e.target.value))
                  }
                  className="w-full px-2 py-1.5 text-sm border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Subhead
                </label>
                <input
                  type="number"
                  min={10}
                  max={18}
                  value={
                    style.font_size_subheading ||
                    DEFAULT_STYLE.font_size_subheading
                  }
                  onChange={(e) =>
                    handleChange(
                      "font_size_subheading",
                      parseInt(e.target.value)
                    )
                  }
                  className="w-full px-2 py-1.5 text-sm border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Spacing Section */}
      <div className="border rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection("spacing")}
          className="w-full flex items-center justify-between p-3 bg-muted hover:bg-accent"
        >
          <span className="text-sm font-medium text-foreground/80">Spacing</span>
          <svg
            className={`w-4 h-4 text-muted-foreground transition-transform ${
              expanded.spacing ? "rotate-180" : ""
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
        {expanded.spacing && (
          <div className="p-3 space-y-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Line Spacing: {style.line_spacing || DEFAULT_STYLE.line_spacing}
              </label>
              <input
                type="range"
                min={1}
                max={2}
                step={0.05}
                value={style.line_spacing || DEFAULT_STYLE.line_spacing}
                onChange={(e) =>
                  handleChange("line_spacing", parseFloat(e.target.value))
                }
                className="w-full accent-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Section Spacing:{" "}
                {style.section_spacing || DEFAULT_STYLE.section_spacing}
              </label>
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.1}
                value={style.section_spacing || DEFAULT_STYLE.section_spacing}
                onChange={(e) =>
                  handleChange("section_spacing", parseFloat(e.target.value))
                }
                className="w-full accent-primary"
              />
            </div>
          </div>
        )}
      </div>

      {/* Margins Section */}
      <div className="border rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection("margins")}
          className="w-full flex items-center justify-between p-3 bg-muted hover:bg-accent"
        >
          <span className="text-sm font-medium text-foreground/80">
            Margins (inches)
          </span>
          <svg
            className={`w-4 h-4 text-muted-foreground transition-transform ${
              expanded.margins ? "rotate-180" : ""
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
        {expanded.margins && (
          <div className="p-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Top</label>
                <input
                  type="number"
                  min={0.25}
                  max={1.5}
                  step={0.05}
                  value={style.margin_top || DEFAULT_STYLE.margin_top}
                  onChange={(e) =>
                    handleChange("margin_top", parseFloat(e.target.value))
                  }
                  className="w-full px-2 py-1.5 text-sm border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Bottom
                </label>
                <input
                  type="number"
                  min={0.25}
                  max={1.5}
                  step={0.05}
                  value={style.margin_bottom || DEFAULT_STYLE.margin_bottom}
                  onChange={(e) =>
                    handleChange("margin_bottom", parseFloat(e.target.value))
                  }
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
                  onChange={(e) =>
                    handleChange("margin_left", parseFloat(e.target.value))
                  }
                  className="w-full px-2 py-1.5 text-sm border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Right
                </label>
                <input
                  type="number"
                  min={0.25}
                  max={1.5}
                  step={0.05}
                  value={style.margin_right || DEFAULT_STYLE.margin_right}
                  onChange={(e) =>
                    handleChange("margin_right", parseFloat(e.target.value))
                  }
                  className="w-full px-2 py-1.5 text-sm border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { DEFAULT_STYLE };
