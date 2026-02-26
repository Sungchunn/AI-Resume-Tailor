"use client";

import type { TemplateThumbnailProps, TemplatePreset } from "./types";

export function TemplateThumbnail({
  preset,
  isActive,
  onClick,
}: TemplateThumbnailProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start p-3 rounded-lg border-2 transition-all text-left hover:border-blue-300 hover:bg-blue-50/50 ${
        isActive
          ? "border-blue-500 bg-blue-50"
          : "border-border bg-card"
      }`}
    >
      {/* Mini Preview */}
      <div
        className="w-full h-20 bg-card border rounded mb-2 overflow-hidden"
        style={{ fontFamily: preset.style.font_family }}
      >
        <MiniPreview preset={preset} />
      </div>

      {/* Name and Description */}
      <span className="text-sm font-medium text-foreground">{preset.name}</span>
      <span className="text-xs text-muted-foreground mt-0.5">{preset.description}</span>
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
          marginBottom: "8px",
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
        <ul style={{ paddingLeft: "16px", margin: "8px 0" }}>
          <li>Built scalable systems</li>
          <li>Led team of 5 engineers</li>
        </ul>
      </div>
    </div>
  );
}
