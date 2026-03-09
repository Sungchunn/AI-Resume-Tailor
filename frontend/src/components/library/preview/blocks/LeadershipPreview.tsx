"use client";

import type { LeadershipEntry } from "@/lib/resume/types";
import type { BaseBlockPreviewProps } from "../types";
import { formatDateRange } from "../previewStyles";

interface LeadershipPreviewProps extends BaseBlockPreviewProps<LeadershipEntry[]> {}

/**
 * LeadershipPreview - Renders leadership and extracurricular entries
 *
 * Each entry displays:
 * - Title/role and date range
 * - Organization and location
 * - Description
 * - Bullet points (if provided)
 */
export function LeadershipPreview({ content, style }: LeadershipPreviewProps) {
  if (!content || content.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3" style={{ gap: style.entryGap }}>
      {content.map((entry) => (
        <LeadershipEntryPreview key={entry.id} entry={entry} style={style} />
      ))}
    </div>
  );
}

interface LeadershipEntryPreviewProps {
  entry: LeadershipEntry;
  style: BaseBlockPreviewProps<unknown>["style"];
}

function LeadershipEntryPreview({ entry, style }: LeadershipEntryPreviewProps) {
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

      {/* Organization and location row */}
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

      {/* Description */}
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
 * Check if leadership block has meaningful content
 */
export function hasLeadershipContent(content: LeadershipEntry[]): boolean {
  return content.some((entry) => entry.title || entry.organization);
}
