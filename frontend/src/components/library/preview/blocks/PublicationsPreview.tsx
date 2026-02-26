"use client";

import type { PublicationEntry } from "@/lib/resume/types";
import type { BaseBlockPreviewProps } from "../types";
import { PUBLICATION_TYPE_LABELS } from "../previewStyles";

interface PublicationsPreviewProps extends BaseBlockPreviewProps<PublicationEntry[]> {}

/**
 * PublicationsPreview - Renders publication entries
 *
 * Each entry displays:
 * - Title and date
 * - Publication type and publisher
 * - Authors (if provided)
 * - Description (if provided)
 */
export function PublicationsPreview({ content, style }: PublicationsPreviewProps) {
  if (!content || content.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3" style={{ gap: style.entryGap }}>
      {content.map((entry) => (
        <PublicationEntryPreview key={entry.id} entry={entry} style={style} />
      ))}
    </div>
  );
}

interface PublicationEntryPreviewProps {
  entry: PublicationEntry;
  style: BaseBlockPreviewProps<unknown>["style"];
}

function PublicationEntryPreview({ entry, style }: PublicationEntryPreviewProps) {
  const typeLabel =
    PUBLICATION_TYPE_LABELS[entry.publicationType] || entry.publicationType;

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
            className="text-gray-600 flex-shrink-0 ml-4"
            style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
          >
            {entry.date}
          </span>
        )}
      </div>

      {/* Type and publisher row */}
      {(entry.publicationType || entry.publisher) && (
        <div
          className="text-gray-700"
          style={{ fontSize: style.bodyFontSize }}
        >
          {typeLabel}
          {entry.publicationType && entry.publisher && " | "}
          {entry.publisher}
        </div>
      )}

      {/* Authors */}
      {entry.authors && (
        <div
          className="text-gray-600"
          style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
        >
          {entry.authors}
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
    </div>
  );
}

/**
 * Check if publications block has meaningful content
 */
export function hasPublicationsContent(content: PublicationEntry[]): boolean {
  return content.some((entry) => entry.title);
}
