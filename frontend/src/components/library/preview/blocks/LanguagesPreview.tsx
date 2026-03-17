"use client";

import { useCallback } from "react";
import type { LanguageEntry } from "@/lib/resume/types";
import type { BaseBlockPreviewProps } from "../types";
import { PROFICIENCY_LABELS } from "../previewStyles";
import { InlinePlainText } from "../../editor/inline";
import { createFieldElementId } from "@/lib/resume/elementPath";
import { useBlockEditorOptional } from "../../editor/BlockEditorContext";

interface LanguagesPreviewProps extends BaseBlockPreviewProps<LanguageEntry[]> {}

/**
 * LanguagesPreview - Renders language proficiency entries with inline editing
 *
 * Displays languages with their proficiency levels in a compact format.
 * All fields are inline-editable via InlinePlainText components.
 * Falls back to read-only display when rendered outside BlockEditorProvider.
 */
export function LanguagesPreview({
  content,
  style,
  blockId,
}: LanguagesPreviewProps) {
  const editorContext = useBlockEditorOptional();

  // Create handler for field changes
  const handleFieldChange = useCallback(
    (entryId: string, field: string) => (value: string) => {
      if (!blockId || !editorContext) return;
      const elementId = createFieldElementId(blockId, entryId, field);
      editorContext.updateContentByPath(elementId, value);
    },
    [blockId, editorContext]
  );

  if (!content || content.length === 0) {
    return null;
  }

  // Filter out empty entries
  const filteredLanguages = content.filter((entry) => entry.language.trim());

  if (filteredLanguages.length === 0) {
    return null;
  }

  // If no blockId, render without inline editing capabilities
  if (!blockId) {
    return (
      <div
        className="flex flex-wrap gap-x-4 gap-y-1"
        style={{ fontSize: style.bodyFontSize }}
      >
        {filteredLanguages.map((entry) => (
          <span key={entry.id}>
            <span className="font-medium">{entry.language}</span>
            {entry.proficiency && (
              <span className="text-muted-foreground">
                {" "}
                ({PROFICIENCY_LABELS[entry.proficiency] || entry.proficiency})
              </span>
            )}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div
      className="flex flex-wrap gap-x-4 gap-y-1"
      style={{ fontSize: style.bodyFontSize }}
    >
      {filteredLanguages.map((entry) => (
        <span key={entry.id} className="inline-flex items-center gap-1">
          <InlinePlainText
            elementId={createFieldElementId(blockId, entry.id, "language")}
            value={entry.language}
            className="font-medium"
            placeholder="Language"
            onCommit={handleFieldChange(entry.id, "language")}
          />
          <span className="text-muted-foreground">(</span>
          <InlinePlainText
            elementId={createFieldElementId(blockId, entry.id, "proficiency")}
            value={PROFICIENCY_LABELS[entry.proficiency] || entry.proficiency}
            className="text-muted-foreground"
            placeholder="Proficiency"
            onCommit={handleFieldChange(entry.id, "proficiency")}
          />
          <span className="text-muted-foreground">)</span>
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
