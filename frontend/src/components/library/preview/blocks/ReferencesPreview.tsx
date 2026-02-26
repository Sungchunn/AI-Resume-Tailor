"use client";

import type { ReferenceEntry } from "@/lib/resume/types";
import type { BaseBlockPreviewProps } from "../types";

interface ReferencesPreviewProps extends BaseBlockPreviewProps<ReferenceEntry[]> {}

/**
 * ReferencesPreview - Renders professional reference entries
 *
 * Each entry displays:
 * - Name and title
 * - Company
 * - Contact information (email/phone)
 * - Relationship (if provided)
 */
export function ReferencesPreview({ content, style }: ReferencesPreviewProps) {
  if (!content || content.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3" style={{ gap: style.entryGap }}>
      {content.map((entry) => (
        <ReferenceEntryPreview key={entry.id} entry={entry} style={style} />
      ))}
    </div>
  );
}

interface ReferenceEntryPreviewProps {
  entry: ReferenceEntry;
  style: BaseBlockPreviewProps<unknown>["style"];
}

function ReferenceEntryPreview({ entry, style }: ReferenceEntryPreviewProps) {
  const contactInfo = [entry.email, entry.phone].filter(Boolean).join(" | ");

  return (
    <div>
      {/* Name and title row */}
      <div className="flex justify-between items-baseline">
        <span
          className="font-semibold"
          style={{ fontSize: style.bodyFontSize }}
        >
          {entry.name}
        </span>
        {entry.relationship && (
          <span
            className="text-gray-600 flex-shrink-0 ml-4"
            style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
          >
            {entry.relationship}
          </span>
        )}
      </div>

      {/* Title and company row */}
      {(entry.title || entry.company) && (
        <div
          className="text-gray-700"
          style={{ fontSize: style.bodyFontSize }}
        >
          {entry.title}
          {entry.title && entry.company && ", "}
          {entry.company}
        </div>
      )}

      {/* Contact info */}
      {contactInfo && (
        <div
          className="text-gray-600"
          style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
        >
          {contactInfo}
        </div>
      )}
    </div>
  );
}

/**
 * Check if references block has meaningful content
 */
export function hasReferencesContent(content: ReferenceEntry[]): boolean {
  return content.some((entry) => entry.name);
}
