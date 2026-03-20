/**
 * ImportanceSelector Component
 *
 * Dropdown for selecting keyword importance level.
 * Shows color-coded badges for each importance tier.
 */

"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { KeywordImportanceEnhanced } from "@/lib/api/types";

interface ImportanceSelectorProps {
  value: KeywordImportanceEnhanced;
  onChange: (value: KeywordImportanceEnhanced) => void;
  disabled?: boolean;
  size?: "sm" | "default";
}

const IMPORTANCE_CONFIG: Record<
  KeywordImportanceEnhanced,
  { label: string; color: string; bgColor: string }
> = {
  required: {
    label: "Required",
    color: "text-red-700 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
  strongly_preferred: {
    label: "Strongly Preferred",
    color: "text-orange-700 dark:text-orange-400",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
  },
  preferred: {
    label: "Preferred",
    color: "text-blue-700 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  nice_to_have: {
    label: "Nice to Have",
    color: "text-gray-700 dark:text-gray-400",
    bgColor: "bg-gray-100 dark:bg-gray-800/50",
  },
};

export function ImportanceSelector({
  value,
  onChange,
  disabled = false,
  size = "default",
}: ImportanceSelectorProps) {
  const config = IMPORTANCE_CONFIG[value];

  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as KeywordImportanceEnhanced)}
      disabled={disabled}
    >
      <SelectTrigger
        className={`
          ${size === "sm" ? "h-7 text-xs px-2" : "h-8 text-sm px-3"}
          w-auto min-w-[120px] border-0
          ${config.bgColor} ${config.color}
          focus:ring-1 focus:ring-primary/50
        `}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(
          Object.entries(IMPORTANCE_CONFIG) as [
            KeywordImportanceEnhanced,
            (typeof IMPORTANCE_CONFIG)[KeywordImportanceEnhanced],
          ][]
        ).map(([importance, cfg]) => (
          <SelectItem
            key={importance}
            value={importance}
            className={`${cfg.color} focus:${cfg.bgColor}`}
          >
            <span className={`px-2 py-0.5 rounded ${cfg.bgColor}`}>
              {cfg.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ImportanceBadge({
  importance,
  size = "default",
}: {
  importance: KeywordImportanceEnhanced;
  size?: "sm" | "default";
}) {
  const config = IMPORTANCE_CONFIG[importance];

  return (
    <span
      className={`
        inline-flex items-center rounded-md font-medium
        ${config.bgColor} ${config.color}
        ${size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-sm"}
      `}
    >
      {config.label}
    </span>
  );
}

export default ImportanceSelector;
