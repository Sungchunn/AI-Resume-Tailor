"use client";

import type { LanguageEntry } from "@/lib/resume/types";
import type { BaseBlockPreviewProps } from "../types";
import { PROFICIENCY_LABELS } from "../previewStyles";

interface LanguagesPreviewProps extends BaseBlockPreviewProps<LanguageEntry[]> {}

/**
 * LanguagesPreview - Renders language proficiency entries
 *
 * Displays languages with their proficiency levels in a compact format.
 */
export function LanguagesPreview({ content, style }: LanguagesPreviewProps) {
  if (!content || content.length === 0) {
    return null;
  }

  // Filter out empty entries
  const filteredLanguages = content.filter((entry) => entry.language.trim());

  if (filteredLanguages.length === 0) {
    return null;
  }

  return (
    <div
      className="flex flex-wrap gap-x-4 gap-y-1"
      style={{ fontSize: style.bodyFontSize }}
    >
      {filteredLanguages.map((entry) => (
        <span key={entry.id}>
          <span className="font-medium">{entry.language}</span>
          {entry.proficiency && (
            <span className="text-gray-600">
              {" "}
              ({PROFICIENCY_LABELS[entry.proficiency] || entry.proficiency})
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

/**
 * Check if languages block has meaningful content
 */
export function hasLanguagesContent(content: LanguageEntry[]): boolean {
  return content.some((entry) => entry.language.trim());
}
