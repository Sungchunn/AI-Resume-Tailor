"use client";

import { useCallback } from "react";
import type { AwardEntry } from "@/lib/resume/types";
import type { BaseBlockPreviewProps } from "../types";
import { InlinePlainText } from "../../editor/inline";
import { createFieldElementId } from "@/lib/resume/elementPath";
import { useBlockEditorOptional } from "../../editor/BlockEditorContext";

interface AwardsPreviewProps extends BaseBlockPreviewProps<AwardEntry[]> {}

/**
 * AwardsPreview - Renders award and honor entries with inline editing
 *
 * Each entry displays:
 * - Award title and date
 * - Issuer
 * - Description (if provided)
 *
 * All text fields are inline-editable via InlinePlainText components.
 * Falls back to read-only display when rendered outside BlockEditorProvider.
 */
export function AwardsPreview({
  content,
  style,
  blockId,
}: AwardsPreviewProps) {
  const editorContext = useBlockEditorOptional();
  const isEditable = !!editorContext;

  if (!content || content.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2" style={{ gap: style.entryGap }}>
      {content.map((entry) => (
        <AwardEntryPreview
          key={entry.id}
          entry={entry}
          style={style}
          blockId={blockId}
          isEditable={isEditable}
        />
      ))}
    </div>
  );
}

interface AwardEntryPreviewProps {
  entry: AwardEntry;
  style: BaseBlockPreviewProps<unknown>["style"];
  blockId?: string;
  isEditable: boolean;
}

function AwardEntryPreview({ entry, style, blockId, isEditable }: AwardEntryPreviewProps) {
  const editorContext = useBlockEditorOptional();

  // Create handler for text fields
  const handleFieldChange = useCallback(
    (field: string) => (value: string) => {
      if (!blockId || !editorContext) return;
      const elementId = createFieldElementId(blockId, entry.id, field);
      editorContext.updateContentByPath(elementId, value);
    },
    [blockId, entry.id, editorContext]
  );

  // If not editable, render without inline editing capabilities
  if (!isEditable || !blockId) {
    return (
      <div>
        <div className="flex justify-between items-baseline">
          <span
            className="font-semibold"
            style={{ fontSize: style.bodyFontSize }}
          >
            {entry.title}
          </span>
          {entry.date && (
            <span
              className="text-muted-foreground flex-shrink-0 ml-4"
              style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
            >
              {entry.date}
            </span>
          )}
        </div>
        {entry.issuer && (
          <div
            className="text-foreground/80"
            style={{ fontSize: style.bodyFontSize }}
          >
            {entry.issuer}
          </div>
        )}
        {entry.description && (
          <div
            className="text-muted-foreground mt-0.5"
            style={{
              fontSize: style.bodyFontSize,
              lineHeight: style.lineHeight,
            }}
          >
            {entry.description}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Title and date row */}
      <div className="flex justify-between items-baseline">
        <InlinePlainText
          elementId={createFieldElementId(blockId, entry.id, "title")}
          value={entry.title}
          className="font-semibold"
          placeholder="Award Title"
          onCommit={handleFieldChange("title")}
        />
        <span
          className="flex-shrink-0 ml-4"
          style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
        >
          <InlinePlainText
            elementId={createFieldElementId(blockId, entry.id, "date")}
            value={entry.date || ""}
            className="text-muted-foreground"
            placeholder="Year"
            onCommit={handleFieldChange("date")}
          />
        </span>
      </div>

      {/* Issuer row */}
      <div
        className="text-foreground/80"
        style={{ fontSize: style.bodyFontSize }}
      >
        <InlinePlainText
          elementId={createFieldElementId(blockId, entry.id, "issuer")}
          value={entry.issuer}
          placeholder="Issuing Organization"
          onCommit={handleFieldChange("issuer")}
        />
      </div>

      {/* Description */}
      <div
        className="text-muted-foreground mt-0.5"
        style={{
          fontSize: style.bodyFontSize,
          lineHeight: style.lineHeight,
        }}
      >
        <InlinePlainText
          elementId={createFieldElementId(blockId, entry.id, "description")}
          value={entry.description || ""}
          placeholder="Description..."
          onCommit={handleFieldChange("description")}
        />
      </div>
    </div>
  );
}

/**
 * Check if awards block has meaningful content
 */
export function hasAwardsContent(content: AwardEntry[]): boolean {
  return content.some((entry) => entry.title);
}
