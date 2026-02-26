"use client";

import type { AwardEntry } from "@/lib/resume/types";
import type { BaseBlockPreviewProps } from "../types";

interface AwardsPreviewProps extends BaseBlockPreviewProps<AwardEntry[]> {}

/**
 * AwardsPreview - Renders award and honor entries
 *
 * Each entry displays:
 * - Award title and date
 * - Issuer
 * - Description (if provided)
 */
export function AwardsPreview({ content, style }: AwardsPreviewProps) {
  if (!content || content.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2" style={{ gap: style.entryGap }}>
      {content.map((entry) => (
        <AwardEntryPreview key={entry.id} entry={entry} style={style} />
      ))}
    </div>
  );
}

interface AwardEntryPreviewProps {
  entry: AwardEntry;
  style: BaseBlockPreviewProps<unknown>["style"];
}

function AwardEntryPreview({ entry, style }: AwardEntryPreviewProps) {
  return (
    <div>
      {/* Title and date row */}
      <div className="flex justify-between items-baseline">
        <span
          className="font-semibold"
          style={{ fontSize: style.bodyFontSize }}
        >
          {entry.title}
        </span>
        {entry.date && (
          <span
            className="text-muted-foreground flex-shrink-0 ml-4"
            style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
          >
            {entry.date}
          </span>
        )}
      </div>

      {/* Issuer row */}
      {entry.issuer && (
        <div
          className="text-foreground/80"
          style={{ fontSize: style.bodyFontSize }}
        >
          {entry.issuer}
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
    </div>
  );
}

/**
 * Check if awards block has meaningful content
 */
export function hasAwardsContent(content: AwardEntry[]): boolean {
  return content.some((entry) => entry.title);
}
