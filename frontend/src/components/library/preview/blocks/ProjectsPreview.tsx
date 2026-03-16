"use client";

import type { ProjectEntry } from "@/lib/resume/types";
import type { BaseBlockPreviewProps } from "../types";
import { formatDateRange } from "../previewStyles";
import { GranularElement } from "../GranularElement";
import {
  createFieldElementId,
  createIndexedElementId,
} from "@/lib/resume/elementPath";

interface ProjectsPreviewProps extends BaseBlockPreviewProps<ProjectEntry[]> {}

/**
 * ProjectsPreview - Renders project entries
 *
 * Each entry displays:
 * - Project name and date range
 * - Description
 * - Technologies used
 * - Bullet points (if provided)
 *
 * Supports granular highlighting for name, dates, description, and bullets.
 */
export function ProjectsPreview({
  content,
  style,
  blockId,
  activeElementId,
  hoveredElementId,
  onElementClick,
  onElementHover,
}: ProjectsPreviewProps) {
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
          activeElementId={activeElementId}
          hoveredElementId={hoveredElementId}
          onElementClick={onElementClick}
          onElementHover={onElementHover}
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
  activeElementId?: string | null;
  hoveredElementId?: string | null;
  onElementClick?: (elementId: string) => void;
  onElementHover?: (elementId: string | null) => void;
}

function ProjectEntryPreview({
  entry,
  entryIndex,
  style,
  blockId,
  activeElementId,
  hoveredElementId,
  onElementClick,
  onElementHover,
}: ProjectEntryPreviewProps) {
  const dateRange = formatDateRange(entry.startDate, entry.endDate);

  // Check if granular interaction is enabled
  const hasGranularInteraction = blockId && (onElementClick || onElementHover);

  // Create element IDs for this entry
  const entryId = `entry-${entryIndex}`;
  const nameElementId = hasGranularInteraction
    ? createFieldElementId(blockId!, entryId, "name")
    : "";
  const datesElementId = hasGranularInteraction
    ? createFieldElementId(blockId!, entryId, "dates")
    : "";
  const descriptionElementId = hasGranularInteraction
    ? createFieldElementId(blockId!, entryId, "description")
    : "";
  const techElementId = hasGranularInteraction
    ? createFieldElementId(blockId!, entryId, "technologies")
    : "";

  // Shared granular props
  const granularProps = {
    activeElementId,
    hoveredElementId,
    onElementClick,
    onElementHover,
  };

  return (
    <div>
      {/* Name and date row */}
      <div className="flex justify-between items-baseline">
        {hasGranularInteraction ? (
          <GranularElement
            elementId={nameElementId}
            variant="inline"
            {...granularProps}
          >
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
          </GranularElement>
        ) : (
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
        )}
        {dateRange && (
          hasGranularInteraction ? (
            <GranularElement
              elementId={datesElementId}
              variant="inline"
              {...granularProps}
            >
              <span
                className="text-muted-foreground flex-shrink-0 ml-4"
                style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
              >
                {dateRange}
              </span>
            </GranularElement>
          ) : (
            <span
              className="text-muted-foreground flex-shrink-0 ml-4"
              style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
            >
              {dateRange}
            </span>
          )
        )}
      </div>

      {/* Description */}
      {entry.description && (
        hasGranularInteraction ? (
          <GranularElement
            elementId={descriptionElementId}
            variant="inline"
            as="div"
            className="mt-0.5"
            {...granularProps}
          >
            <span
              className="text-foreground/80"
              style={{
                fontSize: style.bodyFontSize,
                lineHeight: style.lineHeight,
              }}
            >
              {entry.description}
            </span>
          </GranularElement>
        ) : (
          <div
            className="text-foreground/80 mt-0.5"
            style={{
              fontSize: style.bodyFontSize,
              lineHeight: style.lineHeight,
            }}
          >
            {entry.description}
          </div>
        )
      )}

      {/* Technologies */}
      {entry.technologies && entry.technologies.length > 0 && (
        hasGranularInteraction ? (
          <GranularElement
            elementId={techElementId}
            variant="inline"
            as="div"
            className="mt-1"
            {...granularProps}
          >
            <span
              className="text-muted-foreground"
              style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
            >
              <span className="font-medium">Technologies: </span>
              {entry.technologies.join(", ")}
            </span>
          </GranularElement>
        ) : (
          <div
            className="text-muted-foreground mt-1"
            style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
          >
            <span className="font-medium">Technologies: </span>
            {entry.technologies.join(", ")}
          </div>
        )
      )}

      {/* Bullets */}
      {entry.bullets && entry.bullets.length > 0 && (
        <ul className="list-disc ml-4 mt-1 space-y-0.5">
          {entry.bullets.map((bullet, idx) => {
            if (!bullet.trim()) return null;

            if (hasGranularInteraction) {
              const bulletElementId = createIndexedElementId(
                blockId!,
                entryId,
                "bullets",
                idx
              );
              return (
                <GranularElement
                  key={idx}
                  elementId={bulletElementId}
                  variant="item"
                  as="li"
                  {...granularProps}
                >
                  <span
                    style={{
                      fontSize: style.bodyFontSize,
                      lineHeight: style.lineHeight,
                    }}
                  >
                    {bullet}
                  </span>
                </GranularElement>
              );
            }

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
