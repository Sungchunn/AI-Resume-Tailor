"use client";

import { useCallback } from "react";
import type { VolunteerEntry, BulletItem } from "@/lib/resume/types";
import type { BaseBlockPreviewProps } from "../types";
import { formatDateRange } from "../previewStyles";
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

interface VolunteerPreviewProps extends BaseBlockPreviewProps<VolunteerEntry[]> {}

/**
 * VolunteerPreview - Renders volunteer experience entries with inline editing
 *
 * Each entry displays:
 * - Role and date range
 * - Organization and location
 * - Description
 * - Bullet points (if provided)
 *
 * All text fields are inline-editable via InlinePlainText and InlineRichText components.
 * Bullets support Enter to add new and Backspace to remove empty.
 * Falls back to read-only display when rendered outside BlockEditorProvider.
 */
export function VolunteerPreview({
  content,
  style,
  blockId,
}: VolunteerPreviewProps) {
  const editorContext = useBlockEditorOptional();
  const isEditable = !!editorContext;

  // Update a specific bullet's text in an entry (preserves ID)
  const updateBullet = useCallback(
    (entryIndex: number, bulletIndex: number, value: string) => {
      if (!blockId || !editorContext) return;

      const block = editorContext.state.blocks.find((b) => b.id === blockId);
      if (!block || block.type !== "volunteer") return;

      const entries = block.content as VolunteerEntry[];
      const entry = entries[entryIndex];
      if (!entry || !entry.bullets) return;

      const newBullets = updateBulletAt(entry.bullets, bulletIndex, value);
      const newEntries = entries.map((e, i) =>
        i === entryIndex ? { ...e, bullets: newBullets } : e
      );

      editorContext.dispatch({
        type: "UPDATE_BLOCK",
        payload: { id: blockId, content: newEntries },
      });
    },
    [blockId, editorContext]
  );

  // Add a new bullet after the specified index
  const addBullet = useCallback(
    (entryIndex: number, afterIndex: number) => {
      if (!blockId || !editorContext) return;

      const block = editorContext.state.blocks.find((b) => b.id === blockId);
      if (!block || block.type !== "volunteer") return;

      const entries = block.content as VolunteerEntry[];
      const entry = entries[entryIndex];
      if (!entry) return;

      const bullets = entry.bullets || [];
      const newBullets = insertBulletAfter(bullets, afterIndex, "");

      const newEntries = entries.map((e, i) =>
        i === entryIndex ? { ...e, bullets: newBullets } : e
      );

      editorContext.dispatch({
        type: "UPDATE_BLOCK",
        payload: { id: blockId, content: newEntries },
      });
    },
    [blockId, editorContext]
  );

  // Remove a bullet at the specified index
  const removeBullet = useCallback(
    (entryIndex: number, bulletIndex: number) => {
      if (!blockId || !editorContext) return;

      const block = editorContext.state.blocks.find((b) => b.id === blockId);
      if (!block || block.type !== "volunteer") return;

      const entries = block.content as VolunteerEntry[];
      const entry = entries[entryIndex];
      if (!entry || !entry.bullets || entry.bullets.length <= 1) return;

      const newBullets = removeBulletAt(entry.bullets, bulletIndex);

      const newEntries = entries.map((e, i) =>
        i === entryIndex ? { ...e, bullets: newBullets } : e
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
        <VolunteerEntryPreview
          key={entry.id}
          entry={entry}
          entryIndex={entryIndex}
          style={style}
          blockId={blockId}
          isEditable={isEditable}
          updateBullet={updateBullet}
          addBullet={addBullet}
          removeBullet={removeBullet}
        />
      ))}
    </div>
  );
}

interface VolunteerEntryPreviewProps {
  entry: VolunteerEntry;
  entryIndex: number;
  style: BaseBlockPreviewProps<unknown>["style"];
  blockId?: string;
  isEditable: boolean;
  updateBullet: (entryIndex: number, bulletIndex: number, value: string) => void;
  addBullet: (entryIndex: number, afterIndex: number) => void;
  removeBullet: (entryIndex: number, bulletIndex: number) => void;
}

function VolunteerEntryPreview({
  entry,
  entryIndex,
  style,
  blockId,
  isEditable,
  updateBullet,
  addBullet,
  removeBullet,
}: VolunteerEntryPreviewProps) {
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
    const dateRange = formatDateRange(entry.startDate, entry.endDate);
    return (
      <div>
        <div className="flex justify-between items-baseline">
          <span
            className="font-semibold"
            style={{ fontSize: style.bodyFontSize }}
          >
            {entry.role}
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
            {entry.bullets.map((bullet) => {
              if (!bullet.text?.trim()) return null;
              return (
                <li
                  key={bullet.id}
                  style={{
                    fontSize: style.bodyFontSize,
                    lineHeight: style.lineHeight,
                  }}
                >
                  {bullet.text}
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
      {/* Role and dates row */}
      <div className="flex justify-between items-baseline">
        <InlinePlainText
          elementId={createFieldElementId(blockId, entry.id, "role")}
          value={entry.role}
          className="font-semibold"
          placeholder="Role"
          onCommit={handleFieldChange("role")}
        />
        <span
          className="flex-shrink-0 ml-4 text-muted-foreground"
          style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
        >
          <InlinePlainText
            elementId={createFieldElementId(blockId, entry.id, "startDate")}
            value={entry.startDate || ""}
            placeholder="Start"
            onCommit={handleFieldChange("startDate")}
          />
          <span className="mx-1">-</span>
          <InlinePlainText
            elementId={createFieldElementId(blockId, entry.id, "endDate")}
            value={entry.endDate || ""}
            placeholder="End"
            onCommit={handleFieldChange("endDate")}
          />
        </span>
      </div>

      {/* Organization and location row */}
      <div
        className="flex justify-between text-foreground/80"
        style={{ fontSize: style.bodyFontSize }}
      >
        <InlinePlainText
          elementId={createFieldElementId(blockId, entry.id, "organization")}
          value={entry.organization}
          placeholder="Organization"
          onCommit={handleFieldChange("organization")}
        />
        <InlinePlainText
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
          <InlinePlainText
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
              key={bullet.id}
              style={{
                fontSize: style.bodyFontSize,
                lineHeight: style.lineHeight,
              }}
            >
              <InlineRichText
                elementId={createIndexedElementId(blockId, entry.id, "bullets", bulletIndex)}
                value={bullet.text}
                placeholder="Add accomplishment..."
                onCommit={(value) => updateBullet(entryIndex, bulletIndex, value)}
                onEnter={() => addBullet(entryIndex, bulletIndex)}
                onBackspaceEmpty={() => removeBullet(entryIndex, bulletIndex)}
                showToolbar={false}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Check if volunteer block has meaningful content
 */
export function hasVolunteerContent(content: VolunteerEntry[]): boolean {
  return content.some((entry) => entry.role || entry.organization);
}
