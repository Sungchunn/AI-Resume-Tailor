"use client";

import { useCallback } from "react";
import type { ExperienceEntry } from "@/lib/resume/types";
import type { BaseBlockPreviewProps } from "../types";
import { formatDateRange } from "../previewStyles";
import { EditableText, EditableBullet } from "../../editor/inline";
import {
  createFieldElementId,
  createIndexedElementId,
} from "@/lib/resume/elementPath";
import { useBlockEditor } from "../../editor/BlockEditorContext";
import { insertAfter, removeAt } from "@/lib/resume/arrayHelpers";

interface ExperiencePreviewProps extends BaseBlockPreviewProps<ExperienceEntry[]> {}

/**
 * ExperiencePreview - Renders work experience entries with inline editing
 *
 * Each entry displays:
 * - Job title and date range (same line, flex justified)
 * - Company and location
 * - Bullet points for achievements
 *
 * All text fields are inline-editable via EditableText components.
 * Bullets support Enter to add new and Backspace to remove empty.
 */
export function ExperiencePreview({
  content,
  style,
  blockId,
}: ExperiencePreviewProps) {
  const { updateContentByPath, state, dispatch } = useBlockEditor();

  // Update a specific bullet in an entry
  const updateBullet = useCallback(
    (entryId: string, bulletIndex: number, value: string) => {
      if (!blockId) return;
      const elementId = createIndexedElementId(blockId, entryId, "bullets", bulletIndex);
      updateContentByPath(elementId, value);
    },
    [blockId, updateContentByPath]
  );

  // Add a new bullet after the specified index
  const addBullet = useCallback(
    (entryIndex: number, afterIndex: number) => {
      if (!blockId) return;

      // Find the block and update its content
      const block = state.blocks.find((b) => b.id === blockId);
      if (!block || block.type !== "experience") return;

      const entries = block.content as ExperienceEntry[];
      const entry = entries[entryIndex];
      if (!entry) return;

      // Insert new empty bullet after the current index
      const newBullets = insertAfter(entry.bullets, afterIndex, "");

      // Create new entries array
      const newEntries = entries.map((e, i) =>
        i === entryIndex ? { ...e, bullets: newBullets } : e
      );

      // Dispatch the update via reducer
      dispatch({
        type: "UPDATE_BLOCK",
        payload: { id: blockId, content: newEntries },
      });
    },
    [blockId, state.blocks, dispatch]
  );

  // Remove a bullet at the specified index
  const removeBullet = useCallback(
    (entryIndex: number, bulletIndex: number) => {
      if (!blockId) return;

      // Find the block and update its content
      const block = state.blocks.find((b) => b.id === blockId);
      if (!block || block.type !== "experience") return;

      const entries = block.content as ExperienceEntry[];
      const entry = entries[entryIndex];
      if (!entry || entry.bullets.length <= 1) return; // Keep at least one bullet

      // Remove bullet at index
      const newBullets = removeAt(entry.bullets, bulletIndex);

      // Create new entries array
      const newEntries = entries.map((e, i) =>
        i === entryIndex ? { ...e, bullets: newBullets } : e
      );

      // Dispatch the update via reducer
      dispatch({
        type: "UPDATE_BLOCK",
        payload: { id: blockId, content: newEntries },
      });
    },
    [blockId, state.blocks, dispatch]
  );

  if (!content || content.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3" style={{ gap: style.entryGap }}>
      {content.map((entry, entryIndex) => (
        <ExperienceEntryPreview
          key={entry.id}
          entry={entry}
          entryIndex={entryIndex}
          style={style}
          blockId={blockId}
          updateBullet={updateBullet}
          addBullet={addBullet}
          removeBullet={removeBullet}
        />
      ))}
    </div>
  );
}

interface ExperienceEntryPreviewProps {
  entry: ExperienceEntry;
  entryIndex: number;
  style: BaseBlockPreviewProps<unknown>["style"];
  blockId?: string;
  updateBullet: (entryId: string, bulletIndex: number, value: string) => void;
  addBullet: (entryIndex: number, afterIndex: number) => void;
  removeBullet: (entryIndex: number, bulletIndex: number) => void;
}

function ExperienceEntryPreview({
  entry,
  entryIndex,
  style,
  blockId,
  updateBullet,
  addBullet,
  removeBullet,
}: ExperienceEntryPreviewProps) {
  const { updateContentByPath } = useBlockEditor();
  const dateRange = formatDateRange(entry.startDate, entry.endDate, entry.current);

  // Create handler for text fields (title, company, location, dates)
  const handleFieldChange = useCallback(
    (field: string) => (value: string) => {
      if (!blockId) return;
      const elementId = createFieldElementId(blockId, entry.id, field);
      updateContentByPath(elementId, value);
    },
    [blockId, entry.id, updateContentByPath]
  );

  // Handler for date changes - we need to handle both startDate and endDate
  const handleDateRangeChange = useCallback(
    (value: string) => {
      if (!blockId) return;
      // For simplicity, we store the formatted date range in a combined field
      // The user edits the display value directly
      // A more complex implementation would parse this back to startDate/endDate
      // For now, we'll update the startDate field with the full range text
      // and clear endDate to indicate manual override
      const elementId = createFieldElementId(blockId, entry.id, "startDate");
      updateContentByPath(elementId, value);
    },
    [blockId, entry.id, updateContentByPath]
  );

  // If no blockId, render without inline editing capabilities
  if (!blockId) {
    return (
      <div>
        <div className="flex justify-between items-baseline">
          <span className="font-semibold" style={{ fontSize: style.bodyFontSize }}>
            {entry.title}
          </span>
          {dateRange && (
            <span
              className="text-muted-foreground flex-shrink-0 ml-4"
              style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
            >
              {dateRange}
            </span>
          )}
        </div>
        {(entry.company || entry.location) && (
          <div className="text-foreground/80" style={{ fontSize: style.bodyFontSize }}>
            {entry.company}
            {entry.company && entry.location && " | "}
            {entry.location}
          </div>
        )}
        {entry.bullets && entry.bullets.length > 0 && (
          <ul className="list-disc ml-4 mt-1 space-y-0.5">
            {entry.bullets.map((bullet, idx) => {
              if (!bullet.trim()) return null;
              return (
                <li
                  key={idx}
                  style={{
                    fontSize: style.bodyFontSize,
                    lineHeight: style.lineHeight,
                  }}
                >
                  {bullet}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Title and dates row */}
      <div className="flex justify-between items-baseline">
        <EditableText
          elementId={createFieldElementId(blockId, entry.id, "title")}
          value={entry.title}
          className="font-semibold"
          placeholder="Job Title"
          onCommit={handleFieldChange("title")}
        />
        {(dateRange || !entry.startDate) && (
          <span
            className="flex-shrink-0 ml-4"
            style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
          >
            <EditableText
              elementId={createFieldElementId(blockId, entry.id, "dateRange")}
              value={dateRange || ""}
              className="text-muted-foreground"
              placeholder="Jan 2020 - Present"
              onCommit={handleDateRangeChange}
            />
          </span>
        )}
      </div>

      {/* Company and location row */}
      <div
        className="flex justify-between text-foreground/80"
        style={{ fontSize: style.bodyFontSize }}
      >
        <EditableText
          elementId={createFieldElementId(blockId, entry.id, "company")}
          value={entry.company}
          placeholder="Company Name"
          onCommit={handleFieldChange("company")}
        />
        <EditableText
          elementId={createFieldElementId(blockId, entry.id, "location")}
          value={entry.location || ""}
          className="flex-shrink-0 ml-4 text-muted-foreground"
          placeholder="City, State"
          onCommit={handleFieldChange("location")}
        />
      </div>

      {/* Bullets */}
      {entry.bullets && entry.bullets.length > 0 && (
        <ul className="list-disc ml-4 mt-1 space-y-0.5">
          {entry.bullets.map((bullet, bulletIndex) => (
            <li
              key={bulletIndex}
              style={{
                fontSize: style.bodyFontSize,
                lineHeight: style.lineHeight,
              }}
            >
              <EditableBullet
                elementId={createIndexedElementId(blockId, entry.id, "bullets", bulletIndex)}
                value={bullet}
                placeholder="Add accomplishment..."
                onCommit={(value) => updateBullet(entry.id, bulletIndex, value)}
                onEnter={() => addBullet(entryIndex, bulletIndex)}
                onBackspaceEmpty={() => removeBullet(entryIndex, bulletIndex)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Check if experience block has meaningful content
 */
export function hasExperienceContent(content: ExperienceEntry[]): boolean {
  return content.some(
    (entry) =>
      entry.title ||
      entry.company ||
      (entry.bullets && entry.bullets.some((b) => b.trim()))
  );
}
