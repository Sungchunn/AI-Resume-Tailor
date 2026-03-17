"use client";

import { useCallback } from "react";
import type { CourseEntry } from "@/lib/resume/types";
import type { BaseBlockPreviewProps } from "../types";
import { EditableText } from "../../editor/inline";
import { createFieldElementId } from "@/lib/resume/elementPath";
import { useBlockEditorOptional } from "../../editor/BlockEditorContext";

interface CoursesPreviewProps extends BaseBlockPreviewProps<CourseEntry[]> {}

/**
 * CoursesPreview - Renders course and training entries with inline editing
 *
 * Each entry displays:
 * - Course name and date
 * - Provider
 * - Description (if provided)
 *
 * All text fields are inline-editable via EditableText components.
 * Falls back to read-only display when rendered outside BlockEditorProvider.
 */
export function CoursesPreview({
  content,
  style,
  blockId,
}: CoursesPreviewProps) {
  const editorContext = useBlockEditorOptional();
  const isEditable = !!editorContext;

  if (!content || content.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2" style={{ gap: style.entryGap }}>
      {content.map((entry) => (
        <CourseEntryPreview
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

interface CourseEntryPreviewProps {
  entry: CourseEntry;
  style: BaseBlockPreviewProps<unknown>["style"];
  blockId?: string;
  isEditable: boolean;
}

function CourseEntryPreview({
  entry,
  style,
  blockId,
  isEditable,
}: CourseEntryPreviewProps) {
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
            {entry.name}
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
        {entry.provider && (
          <div
            className="text-foreground/80"
            style={{ fontSize: style.bodyFontSize }}
          >
            {entry.provider}
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
      {/* Name and date row */}
      <div className="flex justify-between items-baseline">
        <EditableText
          elementId={createFieldElementId(blockId, entry.id, "name")}
          value={entry.name}
          className="font-semibold"
          placeholder="Course Name"
          onCommit={handleFieldChange("name")}
        />
        <span
          className="flex-shrink-0 ml-4"
          style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
        >
          <EditableText
            elementId={createFieldElementId(blockId, entry.id, "date")}
            value={entry.date || ""}
            className="text-muted-foreground"
            placeholder="Year"
            onCommit={handleFieldChange("date")}
          />
        </span>
      </div>

      {/* Provider row */}
      <div
        className="text-foreground/80"
        style={{ fontSize: style.bodyFontSize }}
      >
        <EditableText
          elementId={createFieldElementId(blockId, entry.id, "provider")}
          value={entry.provider}
          placeholder="Provider (e.g., Coursera, Udemy)"
          onCommit={handleFieldChange("provider")}
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
        <EditableText
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
 * Check if courses block has meaningful content
 */
export function hasCoursesContent(content: CourseEntry[]): boolean {
  return content.some((entry) => entry.name);
}
