"use client";

import type { MembershipEntry } from "@/lib/resume/types";
import type { BaseBlockPreviewProps } from "../types";
import { formatDateRange } from "../previewStyles";

interface MembershipsPreviewProps extends BaseBlockPreviewProps<MembershipEntry[]> {}

/**
 * MembershipsPreview - Renders professional membership entries
 *
 * Each entry displays:
 * - Organization and date range
 * - Role (if provided)
 */
export function MembershipsPreview({ content, style }: MembershipsPreviewProps) {
  if (!content || content.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2" style={{ gap: style.entryGap }}>
      {content.map((entry) => (
        <MembershipEntryPreview key={entry.id} entry={entry} style={style} />
      ))}
    </div>
  );
}

interface MembershipEntryPreviewProps {
  entry: MembershipEntry;
  style: BaseBlockPreviewProps<unknown>["style"];
}

function MembershipEntryPreview({ entry, style }: MembershipEntryPreviewProps) {
  const dateRange = formatDateRange(entry.startDate, entry.endDate, entry.current);

  return (
    <div>
      {/* Organization and dates row */}
      <div className="flex justify-between items-baseline">
        <span
          className="font-semibold"
          style={{ fontSize: style.bodyFontSize }}
        >
          {entry.organization}
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

      {/* Role row */}
      {entry.role && (
        <div
          className="text-gray-700"
          style={{ fontSize: style.bodyFontSize }}
        >
          {entry.role}
        </div>
      )}
    </div>
  );
}

/**
 * Check if memberships block has meaningful content
 */
export function hasMembershipsContent(content: MembershipEntry[]): boolean {
  return content.some((entry) => entry.organization);
}
