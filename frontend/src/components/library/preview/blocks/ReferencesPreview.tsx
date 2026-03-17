"use client";

import { useCallback } from "react";
import type { ReferenceEntry } from "@/lib/resume/types";
import type { BaseBlockPreviewProps } from "../types";
import { EditableText } from "../../editor/inline";
import { createFieldElementId } from "@/lib/resume/elementPath";
import { useBlockEditorOptional } from "../../editor/BlockEditorContext";

interface ReferencesPreviewProps extends BaseBlockPreviewProps<ReferenceEntry[]> {}

/**
 * ReferencesPreview - Renders professional reference entries with inline editing
 *
 * Each entry displays:
 * - Name and title
 * - Company
 * - Contact information (email/phone)
 * - Relationship (if provided)
 *
 * All text fields are inline-editable via EditableText components.
 * Falls back to read-only display when rendered outside BlockEditorProvider.
 */
export function ReferencesPreview({
  content,
  style,
  blockId,
}: ReferencesPreviewProps) {
  const editorContext = useBlockEditorOptional();
  const isEditable = !!editorContext;

  if (!content || content.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3" style={{ gap: style.entryGap }}>
      {content.map((entry) => (
        <ReferenceEntryPreview
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

interface ReferenceEntryPreviewProps {
  entry: ReferenceEntry;
  style: BaseBlockPreviewProps<unknown>["style"];
  blockId?: string;
  isEditable: boolean;
}

function ReferenceEntryPreview({
  entry,
  style,
  blockId,
  isEditable,
}: ReferenceEntryPreviewProps) {
  const editorContext = useBlockEditorOptional();
  const contactInfo = [entry.email, entry.phone].filter(Boolean).join(" | ");

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
            {entry.name}
          </span>
          {entry.relationship && (
            <span
              className="text-muted-foreground flex-shrink-0 ml-4"
              style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
            >
              {entry.relationship}
            </span>
          )}
        </div>
        {(entry.title || entry.company) && (
          <div
            className="text-foreground/80"
            style={{ fontSize: style.bodyFontSize }}
          >
            {entry.title}
            {entry.title && entry.company && ", "}
            {entry.company}
          </div>
        )}
        {contactInfo && (
          <div
            className="text-muted-foreground"
            style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
          >
            {contactInfo}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Name and relationship row */}
      <div className="flex justify-between items-baseline">
        <EditableText
          elementId={createFieldElementId(blockId, entry.id, "name")}
          value={entry.name}
          className="font-semibold"
          placeholder="Reference Name"
          onCommit={handleFieldChange("name")}
        />
        <span
          className="flex-shrink-0 ml-4"
          style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
        >
          <EditableText
            elementId={createFieldElementId(blockId, entry.id, "relationship")}
            value={entry.relationship || ""}
            className="text-muted-foreground"
            placeholder="Relationship"
            onCommit={handleFieldChange("relationship")}
          />
        </span>
      </div>

      {/* Title and company row */}
      <div
        className="text-foreground/80"
        style={{ fontSize: style.bodyFontSize }}
      >
        <EditableText
          elementId={createFieldElementId(blockId, entry.id, "title")}
          value={entry.title}
          placeholder="Title"
          onCommit={handleFieldChange("title")}
        />
        <span>, </span>
        <EditableText
          elementId={createFieldElementId(blockId, entry.id, "company")}
          value={entry.company}
          placeholder="Company"
          onCommit={handleFieldChange("company")}
        />
      </div>

      {/* Contact info */}
      <div
        className="text-muted-foreground"
        style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
      >
        <EditableText
          elementId={createFieldElementId(blockId, entry.id, "email")}
          value={entry.email || ""}
          placeholder="email@example.com"
          onCommit={handleFieldChange("email")}
        />
        <span> | </span>
        <EditableText
          elementId={createFieldElementId(blockId, entry.id, "phone")}
          value={entry.phone || ""}
          placeholder="(555) 123-4567"
          onCommit={handleFieldChange("phone")}
        />
      </div>
    </div>
  );
}

/**
 * Check if references block has meaningful content
 */
export function hasReferencesContent(content: ReferenceEntry[]): boolean {
  return content.some((entry) => entry.name);
}
