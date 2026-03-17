"use client";

import { useCallback } from "react";
import type { LeadershipEntry } from "@/lib/resume/types";
import type { BaseBlockPreviewProps } from "../types";
import { formatDateRange } from "../previewStyles";
import { EditableText, EditableBullet } from "../../editor/inline";
import {
  createFieldElementId,
  createIndexedElementId,
} from "@/lib/resume/elementPath";
import { useBlockEditor } from "../../editor/BlockEditorContext";
import { insertAfter, removeAt } from "@/lib/resume/arrayHelpers";

interface LeadershipPreviewProps extends BaseBlockPreviewProps<LeadershipEntry[]> {}

/**
 * LeadershipPreview - Renders leadership and extracurricular entries with inline editing
 *
 * Each entry displays:
 * - Title/role and date range
 * - Organization and location
 * - Description
 * - Bullet points (if provided)
 *
 * All text fields are inline-editable via EditableText components.
 * Bullets support Enter to add new and Backspace to remove empty.
 */
export function LeadershipPreview({
  content,
  style,
  blockId,
}: LeadershipPreviewProps) {
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

      const block = state.blocks.find((b) => b.id === blockId);
      if (!block || block.type !== "leadership") return;

      const entries = block.content as LeadershipEntry[];
      const entry = entries[entryIndex];
      if (!entry) return;

      const bullets = entry.bullets || [];
      const newBullets = insertAfter(bullets, afterIndex, "");

      const newEntries = entries.map((e, i) =>
        i === entryIndex ? { ...e, bullets: newBullets } : e
      );

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

      const block = state.blocks.find((b) => b.id === blockId);
      if (!block || block.type !== "leadership") return;

      const entries = block.content as LeadershipEntry[];
      const entry = entries[entryIndex];
      if (!entry || !entry.bullets || entry.bullets.length <= 1) return;

      const newBullets = removeAt(entry.bullets, bulletIndex);

      const newEntries = entries.map((e, i) =>
        i === entryIndex ? { ...e, bullets: newBullets } : e
      );

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
        <LeadershipEntryPreview
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

interface LeadershipEntryPreviewProps {
  entry: LeadershipEntry;
  entryIndex: number;
  style: BaseBlockPreviewProps<unknown>["style"];
  blockId?: string;
  updateBullet: (entryId: string, bulletIndex: number, value: string) => void;
  addBullet: (entryIndex: number, afterIndex: number) => void;
  removeBullet: (entryIndex: number, bulletIndex: number) => void;
}

function LeadershipEntryPreview({
  entry,
  entryIndex,
  style,
  blockId,
  updateBullet,
  addBullet,
  removeBullet,
}: LeadershipEntryPreviewProps) {
  const { updateContentByPath } = useBlockEditor();
  const dateRange = formatDateRange(entry.startDate, entry.endDate, entry.current);

  // Create handler for text fields
  const handleFieldChange = useCallback(
    (field: string) => (value: string) => {
      if (!blockId) return;
      const elementId = createFieldElementId(blockId, entry.id, field);
      updateContentByPath(elementId, value);
    },
    [blockId, entry.id, updateContentByPath]
  );

  // Handler for date range changes
  const handleDateRangeChange = useCallback(
    (value: string) => {
      if (!blockId) return;
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
          <span
            className="font-semibold"
            style={{ fontSize: style.bodyFontSize }}
          >
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
        {(entry.organization || entry.location) && (
          <div
            className="text-foreground/80"
            style={{ fontSize: style.bodyFontSize }}
          >
            {entry.organization}
            {entry.organization && entry.location && " | "}
            {entry.location}
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
        {entry.bullets && entry.bullets.length > 0 && (
          <ul className="list-disc ml-4 mt-1 space-y-0.5">
            {entry.bullets.map(
              (bullet, idx) =>
                bullet.trim() && (
                  <li
                    key={idx}
                    style={{
                      fontSize: style.bodyFontSize,
                      lineHeight: style.lineHeight,
                    }}
                  >
                    {bullet}
                  </li>
                )
            )}
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
          placeholder="Title"
          onCommit={handleFieldChange("title")}
        />
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
      </div>

      {/* Organization and location row */}
      <div
        className="flex justify-between text-foreground/80"
        style={{ fontSize: style.bodyFontSize }}
      >
        <EditableText
          elementId={createFieldElementId(blockId, entry.id, "organization")}
          value={entry.organization}
          placeholder="Organization"
          onCommit={handleFieldChange("organization")}
        />
        <EditableText
          elementId={createFieldElementId(blockId, entry.id, "location")}
          value={entry.location || ""}
          className="flex-shrink-0 ml-4 text-muted-foreground"
          placeholder="City, State"
          onCommit={handleFieldChange("location")}
        />
      </div>

      {/* Description */}
      {(entry.description || blockId) && (
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
      )}

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
 * Check if leadership block has meaningful content
 */
export function hasLeadershipContent(content: LeadershipEntry[]): boolean {
  return content.some((entry) => entry.title || entry.organization);
}
