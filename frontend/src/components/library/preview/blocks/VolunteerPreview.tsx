"use client";

import type { VolunteerEntry } from "@/lib/resume/types";
import type { BaseBlockPreviewProps } from "../types";
import { formatDateRange } from "../previewStyles";

interface VolunteerPreviewProps extends BaseBlockPreviewProps<VolunteerEntry[]> {}

/**
 * VolunteerPreview - Renders volunteer experience entries
 *
 * Each entry displays:
 * - Role and date range
 * - Organization and location
 * - Description
 * - Bullet points (if provided)
 */
export function VolunteerPreview({ content, style }: VolunteerPreviewProps) {
  if (!content || content.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3" style={{ gap: style.entryGap }}>
      {content.map((entry) => (
        <VolunteerEntryPreview key={entry.id} entry={entry} style={style} />
      ))}
    </div>
  );
}

interface VolunteerEntryPreviewProps {
  entry: VolunteerEntry;
  style: BaseBlockPreviewProps<unknown>["style"];
}

function VolunteerEntryPreview({ entry, style }: VolunteerEntryPreviewProps) {
  const dateRange = formatDateRange(entry.startDate, entry.endDate, entry.current);

  return (
    <div>
      {/* Role and dates row */}
      <div className="flex justify-between items-baseline">
        <span
          className="font-semibold"
          style={{ fontSize: style.bodyFontSize }}
        >
          {entry.role}
        </span>
        {dateRange && (
          <span
            className="text-gray-600 flex-shrink-0 ml-4"
            style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
          >
            {dateRange}
          </span>
        )}
      </div>

      {/* Organization and location row */}
      {(entry.organization || entry.location) && (
        <div
          className="text-gray-700"
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
          className="text-gray-600 mt-0.5"
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
 * Check if volunteer block has meaningful content
 */
export function hasVolunteerContent(content: VolunteerEntry[]): boolean {
  return content.some((entry) => entry.role || entry.organization);
}
