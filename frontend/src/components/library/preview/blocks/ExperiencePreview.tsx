"use client";

import { useCallback } from "react";
import type { ExperienceEntry, BulletItem } from "@/lib/resume/types";
import type { BaseBlockPreviewProps } from "../types";
import { formatDateRange } from "../previewStyles";
import { InlinePlainText, InlineRichText } from "../../editor/inline";
import {
  createFieldElementId,
  createIndexedElementId,
} from "@/lib/resume/elementPath";
import { useBlockEditorOptional } from "../../editor/BlockEditorContext";
import { RewritableBulletItem } from "../../editor/inline/RewritableBulletItem";
import {
  insertBulletAfter,
  removeBulletAt,
  updateBulletAt,
} from "@/lib/resume/bulletHelpers";

interface ExperiencePreviewProps extends BaseBlockPreviewProps<ExperienceEntry[]> {}

/**
 * ExperiencePreview - Renders work experience entries with inline editing
 *
 * Each entry displays:
 * - Job title and date range (same line, flex justified)
 * - Company and location
 * - Bullet points for achievements
 *
 * All text fields are inline-editable via InlinePlainText and InlineRichText components.
 * Bullets support Enter to add new and Backspace to remove empty.
 *
 * Bullets use BulletItem with stable IDs for proper React key handling.
 */
export function ExperiencePreview({
  content,
  style,
  blockId,
}: ExperiencePreviewProps) {
  const editorContext = useBlockEditorOptional();
  const isEditable = !!editorContext;

  // Update a specific bullet's text in an entry (preserves ID)
  const updateBullet = useCallback(
    (entryIndex: number, bulletIndex: number, value: string) => {
      if (!blockId || !editorContext) return;

      const block = editorContext.state.blocks.find((b) => b.id === blockId);
      if (!block || block.type !== "experience") return;

      const entries = block.content as ExperienceEntry[];
      const entry = entries[entryIndex];
      if (!entry) return;

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
      if (!block || block.type !== "experience") return;

      const entries = block.content as ExperienceEntry[];
      const entry = entries[entryIndex];
      if (!entry) return;

      // Insert new bullet with unique ID
      const newBullets = insertBulletAfter(entry.bullets, afterIndex, "");
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
      if (!block || block.type !== "experience") return;

      const entries = block.content as ExperienceEntry[];
      const entry = entries[entryIndex];
      if (!entry || entry.bullets.length <= 1) return; // Keep at least one bullet

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
        <ExperienceEntryPreview
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

interface ExperienceEntryPreviewProps {
  entry: ExperienceEntry;
  entryIndex: number;
  style: BaseBlockPreviewProps<unknown>["style"];
  blockId?: string;
  isEditable: boolean;
  updateBullet: (entryIndex: number, bulletIndex: number, value: string) => void;
  addBullet: (entryIndex: number, afterIndex: number) => void;
  removeBullet: (entryIndex: number, bulletIndex: number) => void;
}

function ExperienceEntryPreview({
  entry,
  entryIndex,
  style,
  blockId,
  isEditable,
  updateBullet,
  addBullet,
  removeBullet,
}: ExperienceEntryPreviewProps) {
  const editorContext = useBlockEditorOptional();

  // Create handler for text fields (title, company, location, dates)
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
          <span className="font-semibold" style={{ fontSize: style.bodyFontSize }}>
            {entry.title}
          </span>
          {dateRange && (
            <span
              className="text-muted-foreground shrink-0 ml-4"
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
            {entry.bullets.map((bullet, bulletIndex) => {
              if (!bullet.text?.trim()) return null;
              const elementId = blockId
                ? createIndexedElementId(blockId, entry.id, "bullets", bulletIndex)
                : undefined;
              return elementId ? (
                <RewritableBulletItem
                  key={bullet.id}
                  elementId={elementId}
                  liStyle={{
                    fontSize: style.bodyFontSize,
                    lineHeight: style.lineHeight,
                  }}
                >
                  {bullet.text}
                </RewritableBulletItem>
              ) : (
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
      {/* Title and dates row */}
      <div className="flex justify-between items-baseline">
        <InlinePlainText
          elementId={createFieldElementId(blockId, entry.id, "title")}
          value={entry.title}
          className="font-semibold"
          placeholder="Job Title"
          onCommit={handleFieldChange("title")}
        />
        <span
          className="shrink-0 ml-4 text-muted-foreground"
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

      {/* Company and location row */}
      <div
        className="flex justify-between text-foreground/80"
        style={{ fontSize: style.bodyFontSize }}
      >
        <InlinePlainText
          elementId={createFieldElementId(blockId, entry.id, "company")}
          value={entry.company}
          placeholder="Company Name"
          onCommit={handleFieldChange("company")}
        />
        <InlinePlainText
          elementId={createFieldElementId(blockId, entry.id, "location")}
          value={entry.location || ""}
          className="shrink-0 ml-4 text-muted-foreground"
          placeholder="City, State"
          onCommit={handleFieldChange("location")}
        />
      </div>

      {/* Bullets */}
      {entry.bullets && entry.bullets.length > 0 && (
        <ul className="list-disc ml-4 mt-1 space-y-0.5">
          {entry.bullets.map((bullet, bulletIndex) => {
            const elementId = createIndexedElementId(blockId, entry.id, "bullets", bulletIndex);
            return (
              <RewritableBulletItem
                key={bullet.id}
                elementId={elementId}
                liStyle={{
                  fontSize: style.bodyFontSize,
                  lineHeight: style.lineHeight,
                }}
              >
                <InlineRichText
                  elementId={elementId}
                  value={bullet.text}
                  placeholder="Add accomplishment..."
                  onCommit={(value) => updateBullet(entryIndex, bulletIndex, value)}
                  onEnter={() => addBullet(entryIndex, bulletIndex)}
                  onBackspaceEmpty={() => removeBullet(entryIndex, bulletIndex)}
                  showToolbar={false}
                />
              </RewritableBulletItem>
            );
          })}
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
      (entry.bullets && entry.bullets.some((b) => b.text?.trim()))
  );
}
