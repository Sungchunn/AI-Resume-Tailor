"use client";

import type { ExperienceEntry } from "@/lib/resume/types";
import type { BaseBlockPreviewProps } from "../types";
import { formatDateRange } from "../previewStyles";
import { GranularElement } from "../GranularElement";
import {
  createEntryElementId,
  createFieldElementId,
  createIndexedElementId,
} from "@/lib/resume/elementPath";

interface ExperiencePreviewProps extends BaseBlockPreviewProps<ExperienceEntry[]> {}

/**
 * ExperiencePreview - Renders work experience entries
 *
 * Each entry displays:
 * - Job title and date range (same line, flex justified)
 * - Company and location
 * - Bullet points for achievements
 *
 * Supports granular highlighting for titles, dates, companies, and individual bullets.
 */
export function ExperiencePreview({
  content,
  style,
  blockId,
  activeElementId,
  hoveredElementId,
  onElementClick,
  onElementHover,
}: ExperiencePreviewProps) {
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
          activeElementId={activeElementId}
          hoveredElementId={hoveredElementId}
          onElementClick={onElementClick}
          onElementHover={onElementHover}
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
  activeElementId?: string | null;
  hoveredElementId?: string | null;
  onElementClick?: (elementId: string) => void;
  onElementHover?: (elementId: string | null) => void;
}

function ExperienceEntryPreview({
  entry,
  entryIndex,
  style,
  blockId,
  activeElementId,
  hoveredElementId,
  onElementClick,
  onElementHover,
}: ExperienceEntryPreviewProps) {
  const dateRange = formatDateRange(entry.startDate, entry.endDate, entry.current);

  // Check if granular interaction is enabled
  const hasGranularInteraction = blockId && (onElementClick || onElementHover);

  // Create element IDs for this entry
  const entryId = `entry-${entryIndex}`;
  const titleElementId = hasGranularInteraction
    ? createFieldElementId(blockId!, entryId, "title")
    : "";
  const datesElementId = hasGranularInteraction
    ? createFieldElementId(blockId!, entryId, "dates")
    : "";
  const companyElementId = hasGranularInteraction
    ? createFieldElementId(blockId!, entryId, "company")
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
      {/* Title and dates row */}
      <div className="flex justify-between items-baseline">
        {hasGranularInteraction ? (
          <GranularElement
            elementId={titleElementId}
            variant="inline"
            {...granularProps}
          >
            <span
              className="font-semibold"
              style={{ fontSize: style.bodyFontSize }}
            >
              {entry.title}
            </span>
          </GranularElement>
        ) : (
          <span
            className="font-semibold"
            style={{ fontSize: style.bodyFontSize }}
          >
            {entry.title}
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

      {/* Company and location row */}
      {(entry.company || entry.location) && (
        hasGranularInteraction ? (
          <GranularElement
            elementId={companyElementId}
            variant="inline"
            as="div"
            {...granularProps}
          >
            <span
              className="text-foreground/80"
              style={{ fontSize: style.bodyFontSize }}
            >
              {entry.company}
              {entry.company && entry.location && " | "}
              {entry.location}
            </span>
          </GranularElement>
        ) : (
          <div
            className="text-foreground/80"
            style={{ fontSize: style.bodyFontSize }}
          >
            {entry.company}
            {entry.company && entry.location && " | "}
            {entry.location}
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
