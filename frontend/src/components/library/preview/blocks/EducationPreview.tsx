"use client";

import { useCallback } from "react";
import type { EducationEntry, BulletItem } from "@/lib/resume/types";
import type { BaseBlockPreviewProps } from "../types";
import { InlinePlainText, InlineRichText } from "../../editor/inline";
import {
  createFieldElementId,
  createIndexedElementId,
} from "@/lib/resume/elementPath";
import { useBlockEditorOptional } from "../../editor/BlockEditorContext";
import {
  insertBulletAfter,
  removeBulletAt,
  updateBulletAt,
} from "@/lib/resume/bulletHelpers";

interface EducationPreviewProps extends BaseBlockPreviewProps<EducationEntry[]> {}

/**
 * EducationPreview - Renders education entries with inline editing
 *
 * Each entry displays:
 * - Degree and graduation date
 * - Institution and location
 * - GPA and honors (if provided)
 * - Relevant courses (if provided)
 *
 * All text fields are inline-editable via InlinePlainText and InlineRichText components.
 * Relevant courses support Enter to add new and Backspace to remove empty.
 * Falls back to read-only display when rendered outside BlockEditorProvider.
 */
export function EducationPreview({
  content,
  style,
  blockId,
}: EducationPreviewProps) {
  const editorContext = useBlockEditorOptional();
  const isEditable = !!editorContext;

  // Update a specific course's text in an entry (preserves ID)
  const updateCourse = useCallback(
    (entryIndex: number, courseIndex: number, value: string) => {
      if (!blockId || !editorContext) return;

      const block = editorContext.state.blocks.find((b) => b.id === blockId);
      if (!block || block.type !== "education") return;

      const entries = block.content as EducationEntry[];
      const entry = entries[entryIndex];
      if (!entry || !entry.relevantCourses) return;

      const newCourses = updateBulletAt(entry.relevantCourses, courseIndex, value);
      const newEntries = entries.map((e, i) =>
        i === entryIndex ? { ...e, relevantCourses: newCourses } : e
      );

      editorContext.dispatch({
        type: "UPDATE_BLOCK",
        payload: { id: blockId, content: newEntries },
      });
    },
    [blockId, editorContext]
  );

  // Add a new course after the specified index
  const addCourse = useCallback(
    (entryIndex: number, afterIndex: number) => {
      if (!blockId || !editorContext) return;

      const block = editorContext.state.blocks.find((b) => b.id === blockId);
      if (!block || block.type !== "education") return;

      const entries = block.content as EducationEntry[];
      const entry = entries[entryIndex];
      if (!entry) return;

      const courses = entry.relevantCourses || [];
      const newCourses = insertBulletAfter(courses, afterIndex, "");

      const newEntries = entries.map((e, i) =>
        i === entryIndex ? { ...e, relevantCourses: newCourses } : e
      );

      editorContext.dispatch({
        type: "UPDATE_BLOCK",
        payload: { id: blockId, content: newEntries },
      });
    },
    [blockId, editorContext]
  );

  // Remove a course at the specified index
  const removeCourse = useCallback(
    (entryIndex: number, courseIndex: number) => {
      if (!blockId || !editorContext) return;

      const block = editorContext.state.blocks.find((b) => b.id === blockId);
      if (!block || block.type !== "education") return;

      const entries = block.content as EducationEntry[];
      const entry = entries[entryIndex];
      if (!entry || !entry.relevantCourses || entry.relevantCourses.length <= 1) return;

      const newCourses = removeBulletAt(entry.relevantCourses, courseIndex);

      const newEntries = entries.map((e, i) =>
        i === entryIndex ? { ...e, relevantCourses: newCourses } : e
      );

      editorContext.dispatch({
        type: "UPDATE_BLOCK",
        payload: { id: blockId, content: newEntries },
      });
    },
    [blockId, editorContext]
  );

  if (!content || content.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3" style={{ gap: style.entryGap }}>
      {content.map((entry, entryIndex) => (
        <EducationEntryPreview
          key={entry.id}
          entry={entry}
          entryIndex={entryIndex}
          style={style}
          blockId={blockId}
          isEditable={isEditable}
          updateCourse={updateCourse}
          addCourse={addCourse}
          removeCourse={removeCourse}
        />
      ))}
    </div>
  );
}

interface EducationEntryPreviewProps {
  entry: EducationEntry;
  entryIndex: number;
  style: BaseBlockPreviewProps<unknown>["style"];
  blockId?: string;
  isEditable: boolean;
  updateCourse: (entryIndex: number, courseIndex: number, value: string) => void;
  addCourse: (entryIndex: number, afterIndex: number) => void;
  removeCourse: (entryIndex: number, courseIndex: number) => void;
}

function EducationEntryPreview({
  entry,
  entryIndex,
  style,
  blockId,
  isEditable,
  updateCourse,
  addCourse,
  removeCourse,
}: EducationEntryPreviewProps) {
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
          <span className="font-semibold" style={{ fontSize: style.bodyFontSize }}>
            {entry.degree}
          </span>
          {entry.graduationDate && (
            <span
              className="text-muted-foreground shrink-0 ml-4"
              style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
            >
              {entry.graduationDate}
            </span>
          )}
        </div>
        {(entry.institution || entry.location) && (
          <div className="text-foreground/80" style={{ fontSize: style.bodyFontSize }}>
            {entry.institution}
            {entry.institution && entry.location && " | "}
            {entry.location}
          </div>
        )}
        {(entry.gpa || entry.honors) && (
          <div
            className="text-muted-foreground mt-0.5"
            style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
          >
            {entry.gpa && <span>GPA: {entry.gpa}</span>}
            {entry.gpa && entry.honors && " | "}
            {entry.honors && <span>{entry.honors}</span>}
          </div>
        )}
        {entry.relevantCourses && entry.relevantCourses.length > 0 && (
          <div
            className="text-muted-foreground mt-1"
            style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
          >
            <span className="font-medium">Relevant Courses: </span>
            {entry.relevantCourses.map((c) => c.text).join(", ")}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Degree and date row */}
      <div className="flex justify-between items-baseline">
        <InlinePlainText
          elementId={createFieldElementId(blockId, entry.id, "degree")}
          value={entry.degree}
          className="font-semibold"
          placeholder="Degree"
          onCommit={handleFieldChange("degree")}
        />
        <span
          className="shrink-0 ml-4"
          style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
        >
          <InlinePlainText
            elementId={createFieldElementId(blockId, entry.id, "graduationDate")}
            value={entry.graduationDate || ""}
            className="text-muted-foreground"
            placeholder="Expected 2026"
            onCommit={handleFieldChange("graduationDate")}
          />
        </span>
      </div>

      {/* Institution and location row */}
      <div
        className="flex justify-between text-foreground/80"
        style={{ fontSize: style.bodyFontSize }}
      >
        <InlinePlainText
          elementId={createFieldElementId(blockId, entry.id, "institution")}
          value={entry.institution}
          placeholder="University Name"
          onCommit={handleFieldChange("institution")}
        />
        <InlinePlainText
          elementId={createFieldElementId(blockId, entry.id, "location")}
          value={entry.location || ""}
          className="shrink-0 ml-4 text-muted-foreground"
          placeholder="City, State"
          onCommit={handleFieldChange("location")}
        />
      </div>

      {/* GPA and honors row - only show if either has content */}
      {(() => {
        const gpaStr = typeof entry.gpa === 'string' ? entry.gpa.trim() : '';
        const honorsStr = typeof entry.honors === 'string' ? entry.honors.trim() : '';
        if (!gpaStr && !honorsStr) return null;
        return (
          <div
            className="flex flex-wrap gap-x-2 mt-0.5"
            style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
          >
            {gpaStr && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <span>GPA:</span>
                <InlinePlainText
                  elementId={createFieldElementId(blockId, entry.id, "gpa")}
                  value={entry.gpa || ""}
                  className="text-muted-foreground"
                  placeholder="3.9"
                  onCommit={handleFieldChange("gpa")}
                />
              </span>
            )}
            {gpaStr && honorsStr && (
              <span className="text-muted-foreground">|</span>
            )}
            {honorsStr && (
              <InlinePlainText
                elementId={createFieldElementId(blockId, entry.id, "honors")}
                value={entry.honors || ""}
                className="text-muted-foreground"
                placeholder="Honors (e.g., Magna Cum Laude)"
                onCommit={handleFieldChange("honors")}
              />
            )}
          </div>
        );
      })()}

      {/* Relevant courses */}
      {entry.relevantCourses && entry.relevantCourses.length > 0 && (
        <div
          className="mt-1"
          style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
        >
          <span className="font-medium text-muted-foreground">Relevant Courses: </span>
          <ul className="list-disc ml-4 mt-0.5 space-y-0.5">
            {entry.relevantCourses.map((course, courseIndex) => (
              <li key={course.id} className="text-muted-foreground">
                <InlineRichText
                  elementId={createIndexedElementId(blockId, entry.id, "relevantCourses", courseIndex)}
                  value={course.text}
                  placeholder="Course name..."
                  onCommit={(value) => updateCourse(entryIndex, courseIndex, value)}
                  onEnter={() => addCourse(entryIndex, courseIndex)}
                  onBackspaceEmpty={() => removeCourse(entryIndex, courseIndex)}
                  showToolbar={false}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Check if education block has meaningful content
 */
export function hasEducationContent(content: EducationEntry[]): boolean {
  return content.some((entry) => entry.degree || entry.institution);
}
