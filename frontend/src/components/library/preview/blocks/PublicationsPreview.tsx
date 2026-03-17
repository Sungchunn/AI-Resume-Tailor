"use client";

import { useCallback } from "react";
import type { PublicationEntry } from "@/lib/resume/types";
import type { BaseBlockPreviewProps } from "../types";
import { PUBLICATION_TYPE_LABELS } from "../previewStyles";
import { InlinePlainText } from "../../editor/inline";
import { createFieldElementId } from "@/lib/resume/elementPath";
import { useBlockEditorOptional } from "../../editor/BlockEditorContext";

interface PublicationsPreviewProps extends BaseBlockPreviewProps<PublicationEntry[]> {}

/**
 * PublicationsPreview - Renders publication entries with inline editing
 *
 * Each entry displays:
 * - Title and date
 * - Publication type and publisher
 * - Authors (if provided)
 * - Description (if provided)
 *
 * All text fields are inline-editable via InlinePlainText components.
 * Falls back to read-only display when rendered outside BlockEditorProvider.
 */
export function PublicationsPreview({
  content,
  style,
  blockId,
}: PublicationsPreviewProps) {
  const editorContext = useBlockEditorOptional();
  const isEditable = !!editorContext;

  if (!content || content.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3" style={{ gap: style.entryGap }}>
      {content.map((entry) => (
        <PublicationEntryPreview
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

interface PublicationEntryPreviewProps {
  entry: PublicationEntry;
  style: BaseBlockPreviewProps<unknown>["style"];
  blockId?: string;
  isEditable: boolean;
}

function PublicationEntryPreview({
  entry,
  style,
  blockId,
  isEditable,
}: PublicationEntryPreviewProps) {
  const editorContext = useBlockEditorOptional();
  const typeLabel =
    PUBLICATION_TYPE_LABELS[entry.publicationType] || entry.publicationType;

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
        {(entry.publicationType || entry.publisher) && (
          <div
            className="text-foreground/80"
            style={{ fontSize: style.bodyFontSize }}
          >
            {typeLabel}
            {entry.publicationType && entry.publisher && " | "}
            {entry.publisher}
          </div>
        )}
        {entry.authors && (
          <div
            className="text-muted-foreground"
            style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
          >
            {entry.authors}
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
          placeholder="Publication Title"
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

      {/* Type and publisher row */}
      <div
        className="text-foreground/80"
        style={{ fontSize: style.bodyFontSize }}
      >
        <InlinePlainText
          elementId={createFieldElementId(blockId, entry.id, "publicationType")}
          value={typeLabel}
          placeholder="Type"
          onCommit={handleFieldChange("publicationType")}
        />
        <span> | </span>
        <InlinePlainText
          elementId={createFieldElementId(blockId, entry.id, "publisher")}
          value={entry.publisher || ""}
          placeholder="Publisher"
          onCommit={handleFieldChange("publisher")}
        />
      </div>

      {/* Authors */}
      <div
        className="text-muted-foreground"
        style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
      >
        <InlinePlainText
          elementId={createFieldElementId(blockId, entry.id, "authors")}
          value={entry.authors || ""}
          placeholder="Co-authors..."
          onCommit={handleFieldChange("authors")}
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
 * Check if publications block has meaningful content
 */
export function hasPublicationsContent(content: PublicationEntry[]): boolean {
  return content.some((entry) => entry.title);
}
