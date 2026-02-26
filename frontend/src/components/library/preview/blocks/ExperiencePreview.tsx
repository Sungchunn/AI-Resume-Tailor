"use client";

import type { ExperienceEntry } from "@/lib/resume/types";
import type { BaseBlockPreviewProps } from "../types";
import { formatDateRange } from "../previewStyles";

interface ExperiencePreviewProps extends BaseBlockPreviewProps<ExperienceEntry[]> {}

/**
 * ExperiencePreview - Renders work experience entries
 *
 * Each entry displays:
 * - Job title and date range (same line, flex justified)
 * - Company and location
 * - Bullet points for achievements
 */
export function ExperiencePreview({ content, style }: ExperiencePreviewProps) {
  if (!content || content.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3" style={{ gap: style.entryGap }}>
      {content.map((entry) => (
        <ExperienceEntryPreview key={entry.id} entry={entry} style={style} />
      ))}
    </div>
  );
}

interface ExperienceEntryPreviewProps {
  entry: ExperienceEntry;
  style: BaseBlockPreviewProps<unknown>["style"];
}

function ExperienceEntryPreview({ entry, style }: ExperienceEntryPreviewProps) {
  const dateRange = formatDateRange(entry.startDate, entry.endDate, entry.current);

  return (
    <div>
      {/* Title and dates row */}
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

      {/* Company and location row */}
      {(entry.company || entry.location) && (
        <div
          className="text-foreground/80"
          style={{ fontSize: style.bodyFontSize }}
        >
          {entry.company}
          {entry.company && entry.location && " | "}
          {entry.location}
        </div>
      )}

      {/* Bullets */}
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
