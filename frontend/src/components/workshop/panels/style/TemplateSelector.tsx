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
