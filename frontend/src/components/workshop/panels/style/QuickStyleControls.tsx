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
