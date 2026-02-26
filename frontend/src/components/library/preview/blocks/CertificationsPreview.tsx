"use client";

import type { CertificationEntry } from "@/lib/resume/types";
import type { BaseBlockPreviewProps } from "../types";
import { formatDateRange } from "../previewStyles";

interface CertificationsPreviewProps extends BaseBlockPreviewProps<CertificationEntry[]> {}

/**
 * CertificationsPreview - Renders certification entries
 *
 * Each entry displays:
 * - Certification name and date
 * - Issuer
 * - Credential ID (if provided)
 */
export function CertificationsPreview({ content, style }: CertificationsPreviewProps) {
  if (!content || content.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2" style={{ gap: style.entryGap }}>
      {content.map((entry) => (
        <CertificationEntryPreview key={entry.id} entry={entry} style={style} />
      ))}
    </div>
  );
}

interface CertificationEntryPreviewProps {
  entry: CertificationEntry;
  style: BaseBlockPreviewProps<unknown>["style"];
}

function CertificationEntryPreview({ entry, style }: CertificationEntryPreviewProps) {
  const dateInfo = formatDateRange(entry.date, entry.expirationDate);

  return (
    <div>
      {/* Name and date row */}
      <div className="flex justify-between items-baseline">
        <span
          className="font-semibold"
          style={{ fontSize: style.bodyFontSize }}
        >
          {entry.name}
        </span>
        {dateInfo && (
          <span
            className="text-muted-foreground flex-shrink-0 ml-4"
            style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
          >
            {dateInfo}
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

      {/* Credential ID */}
      {entry.credentialId && (
        <div
          className="text-muted-foreground"
          style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
        >
          Credential ID: {entry.credentialId}
        </div>
      )}
    </div>
  );
}

/**
 * Check if certifications block has meaningful content
 */
export function hasCertificationsContent(content: CertificationEntry[]): boolean {
  return content.some((entry) => entry.name || entry.issuer);
}
