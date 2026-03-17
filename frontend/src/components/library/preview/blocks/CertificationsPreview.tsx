"use client";

import { useCallback } from "react";
import type { CertificationEntry } from "@/lib/resume/types";
import type { BaseBlockPreviewProps } from "../types";
import { formatDateRange } from "../previewStyles";
import { InlinePlainText } from "../../editor/inline";
import { createFieldElementId } from "@/lib/resume/elementPath";
import { useBlockEditorOptional } from "../../editor/BlockEditorContext";

interface CertificationsPreviewProps extends BaseBlockPreviewProps<CertificationEntry[]> {}

/**
 * CertificationsPreview - Renders certification entries with inline editing
 *
 * Each entry displays:
 * - Certification name and date
 * - Issuer
 * - Credential ID (if provided)
 *
 * All text fields are inline-editable via InlinePlainText components.
 * Falls back to read-only display when rendered outside BlockEditorProvider.
 */
export function CertificationsPreview({
  content,
  style,
  blockId,
}: CertificationsPreviewProps) {
  const editorContext = useBlockEditorOptional();
  const isEditable = !!editorContext;

  if (!content || content.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2" style={{ gap: style.entryGap }}>
      {content.map((entry) => (
        <CertificationEntryPreview
          key={entry.id}
          entry={entry}
          style={style}
          blockId={blockId}
          isEditable={isEditable}
        />
      ))}
    </div>
  );
}

interface CertificationEntryPreviewProps {
  entry: CertificationEntry;
  style: BaseBlockPreviewProps<unknown>["style"];
  blockId?: string;
  isEditable: boolean;
}

function CertificationEntryPreview({
  entry,
  style,
  blockId,
  isEditable,
}: CertificationEntryPreviewProps) {
  const editorContext = useBlockEditorOptional();
  const dateInfo = formatDateRange(entry.date, entry.expirationDate);

  // Create handler for text fields
  const handleFieldChange = useCallback(
    (field: string) => (value: string) => {
      if (!blockId || !editorContext) return;
      const elementId = createFieldElementId(blockId, entry.id, field);
      editorContext.updateContentByPath(elementId, value);
    },
    [blockId, entry.id, editorContext]
  );

  // Handler for date range changes
  const handleDateRangeChange = useCallback(
    (value: string) => {
      if (!blockId || !editorContext) return;
      const elementId = createFieldElementId(blockId, entry.id, "date");
      editorContext.updateContentByPath(elementId, value);
    },
    [blockId, entry.id, editorContext]
  );

  // If not editable, render without inline editing capabilities
  if (!isEditable || !blockId) {
    return (
      <div>
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
        {entry.issuer && (
          <div
            className="text-foreground/80"
            style={{ fontSize: style.bodyFontSize }}
          >
            {entry.issuer}
          </div>
        )}
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

  return (
    <div>
      {/* Name and date row */}
      <div className="flex justify-between items-baseline">
        <InlinePlainText
          elementId={createFieldElementId(blockId, entry.id, "name")}
          value={entry.name}
          className="font-semibold"
          placeholder="Certification Name"
          onCommit={handleFieldChange("name")}
        />
        <span
          className="flex-shrink-0 ml-4"
          style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
        >
          <InlinePlainText
            elementId={createFieldElementId(blockId, entry.id, "dateRange")}
            value={dateInfo || ""}
            className="text-muted-foreground"
            placeholder="Issue Date"
            onCommit={handleDateRangeChange}
          />
        </span>
      </div>

      {/* Issuer row */}
      <div
        className="text-foreground/80"
        style={{ fontSize: style.bodyFontSize }}
      >
        <InlinePlainText
          elementId={createFieldElementId(blockId, entry.id, "issuer")}
          value={entry.issuer}
          placeholder="Issuing Organization"
          onCommit={handleFieldChange("issuer")}
        />
      </div>

      {/* Credential ID */}
      <div
        className="text-muted-foreground"
        style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
      >
        <span>Credential ID: </span>
        <InlinePlainText
          elementId={createFieldElementId(blockId, entry.id, "credentialId")}
          value={entry.credentialId || ""}
          placeholder="ABC123..."
          onCommit={handleFieldChange("credentialId")}
        />
      </div>
    </div>
  );
}

/**
 * Check if certifications block has meaningful content
 */
export function hasCertificationsContent(content: CertificationEntry[]): boolean {
  return content.some((entry) => entry.name || entry.issuer);
}
