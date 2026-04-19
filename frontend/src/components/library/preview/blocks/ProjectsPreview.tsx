"use client";

import { useCallback } from "react";
import type { ProjectEntry, BulletItem } from "@/lib/resume/types";
import type { BaseBlockPreviewProps } from "../types";
import { formatDateRange } from "../previewStyles";
import { InlinePlainText, InlineRichText } from "../../editor/inline";
import { RewritableBulletItem } from "../../editor/inline/RewritableBulletItem";
import {
  createFieldElementId,
  createIndexedElementId,
} from "@/lib/resume/elementPath";
import { useBlockEditorOptional } from "../../editor/BlockEditorContext";
import {
  insertBulletAfter,
  removeBulletAt,
  updateBulletAt,
  createBullet,
} from "@/lib/resume/bulletHelpers";

interface ProjectsPreviewProps extends BaseBlockPreviewProps<ProjectEntry[]> {}

/**
 * ProjectsPreview - Renders project entries with inline editing
 *
 * Bullets use BulletItem with stable IDs for proper React key handling.
 */
export function ProjectsPreview({
  content,
  style,
  blockId,
}: ProjectsPreviewProps) {
  const editorContext = useBlockEditorOptional();
  const isEditable = !!editorContext;

  // Update a specific bullet's text in an entry (preserves ID)
  const updateBullet = useCallback(
    (entryIndex: number, bulletIndex: number, value: string) => {
      if (!blockId || !editorContext) return;

      const block = editorContext.state.blocks.find((b) => b.id === blockId);
      if (!block || block.type !== "projects") return;

      const entries = block.content as ProjectEntry[];
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
      if (!block || block.type !== "projects") return;

      const entries = block.content as ProjectEntry[];
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
      if (!block || block.type !== "projects") return;

      const entries = block.content as ProjectEntry[];
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
        <ProjectEntryPreview
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

interface ProjectEntryPreviewProps {
  entry: ProjectEntry;
  entryIndex: number;
  style: BaseBlockPreviewProps<unknown>["style"];
  blockId?: string;
  isEditable: boolean;
  updateBullet: (entryIndex: number, bulletIndex: number, value: string) => void;
  addBullet: (entryIndex: number, afterIndex: number) => void;
  removeBullet: (entryIndex: number, bulletIndex: number) => void;
}

function ProjectEntryPreview({
  entry,
  entryIndex,
  style,
  blockId,
  isEditable,
  updateBullet,
  addBullet,
  removeBullet,
}: ProjectEntryPreviewProps) {
  const editorContext = useBlockEditorOptional();
  const dateRange = formatDateRange(entry.startDate, entry.endDate);

  // Create handler for text fields
  const handleFieldChange = useCallback(
    (field: string) => (value: string) => {
      if (!blockId || !editorContext) return;
      const elementId = createFieldElementId(blockId, entry.id, field);
      editorContext.updateContentByPath(elementId, value);
    },
    [blockId, entry.id, editorContext]
  );

  // Handler for date range changes
  const handleDateRangeChange = useCallback(
    (value: string) => {
      if (!blockId || !editorContext) return;
      const elementId = createFieldElementId(blockId, entry.id, "startDate");
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
            {entry.url && (
              <span className="text-muted-foreground font-normal ml-2">
                ({entry.url})
              </span>
            )}
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
        {entry.description && (
          <div
            className="text-foreground/80 mt-0.5"
            style={{
              fontSize: style.bodyFontSize,
              lineHeight: style.lineHeight,
            }}
          >
            {entry.description}
          </div>
        )}
        {entry.technologies && entry.technologies.length > 0 && (
          <div
            className="text-muted-foreground mt-1"
            style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
          >
            <span className="font-medium">Technologies: </span>
            {entry.technologies.join(", ")}
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
      {/* Name and date row */}
      <div className="flex justify-between items-baseline">
        <span className="font-semibold" style={{ fontSize: style.bodyFontSize }}>
          <InlinePlainText
            elementId={createFieldElementId(blockId, entry.id, "name")}
            value={entry.name}
            placeholder="Project Name"
            onCommit={handleFieldChange("name")}
          />
          {entry.url && (
            <span className="text-muted-foreground font-normal ml-2">
              (
              <InlinePlainText
                elementId={createFieldElementId(blockId, entry.id, "url")}
                value={entry.url}
                placeholder="project-url.com"
                onCommit={handleFieldChange("url")}
              />
              )
            </span>
          )}
        </span>
        <span
          className="shrink-0 ml-4"
          style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
        >
          <InlinePlainText
            elementId={createFieldElementId(blockId, entry.id, "dateRange")}
            value={dateRange || ""}
            className="text-muted-foreground"
            placeholder="Jan 2024 - Present"
            onCommit={handleDateRangeChange}
          />
        </span>
      </div>

      {/* Description */}
      <div
        className="text-foreground/80 mt-0.5"
        style={{
          fontSize: style.bodyFontSize,
          lineHeight: style.lineHeight,
        }}
      >
        <InlinePlainText
          elementId={createFieldElementId(blockId, entry.id, "description")}
          value={entry.description || ""}
          placeholder="Project description..."
          onCommit={handleFieldChange("description")}
        />
      </div>

      {/* Technologies */}
      {entry.technologies &&
        entry.technologies.length > 0 &&
        entry.technologies.some((t) => typeof t === 'string' && t.trim()) && (
          <div
            className="text-muted-foreground mt-1"
            style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
          >
            <span className="font-medium">Technologies: </span>
            <InlinePlainText
              elementId={createFieldElementId(blockId, entry.id, "technologies")}
              value={entry.technologies?.join(", ") || ""}
              placeholder="React, TypeScript, ..."
              onCommit={(value) => {
                const technologies = value
                  .split(",")
                  .map((t) => typeof t === 'string' ? t.trim() : '')
                  .filter((t) => t.length > 0);
                if (!blockId || !editorContext) return;
                const block = editorContext.state.blocks.find((b) => b.id === blockId);
                if (!block || block.type !== "projects") return;
                const entries = block.content as ProjectEntry[];
                const newEntries = entries.map((e) =>
                  e.id === entry.id ? { ...e, technologies } : e
                );
                editorContext.dispatch({
                  type: "UPDATE_BLOCK",
                  payload: { id: blockId, content: newEntries },
                });
              }}
            />
          </div>
        )}

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
 * Check if projects block has meaningful content
 */
export function hasProjectsContent(content: ProjectEntry[]): boolean {
  return content.some(
    (entry) =>
      entry.name ||
      entry.description ||
      (entry.technologies && entry.technologies.length > 0)
  );
}
