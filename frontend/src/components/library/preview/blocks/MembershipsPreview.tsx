"use client";

import { useCallback } from "react";
import type { MembershipEntry } from "@/lib/resume/types";
import type { BaseBlockPreviewProps } from "../types";
import { formatDateRange } from "../previewStyles";
import { InlinePlainText } from "../../editor/inline";
import { createFieldElementId } from "@/lib/resume/elementPath";
import { useBlockEditorOptional } from "../../editor/BlockEditorContext";

interface MembershipsPreviewProps extends BaseBlockPreviewProps<MembershipEntry[]> {}

/**
 * MembershipsPreview - Renders professional membership entries with inline editing
 *
 * Each entry displays:
 * - Organization and date range
 * - Role (if provided)
 *
 * All text fields are inline-editable via InlinePlainText components.
 * Falls back to read-only display when rendered outside BlockEditorProvider.
 */
export function MembershipsPreview({
  content,
  style,
  blockId,
}: MembershipsPreviewProps) {
  const editorContext = useBlockEditorOptional();
  const isEditable = !!editorContext;

  if (!content || content.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2" style={{ gap: style.entryGap }}>
      {content.map((entry) => (
        <MembershipEntryPreview
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

interface MembershipEntryPreviewProps {
  entry: MembershipEntry;
  style: BaseBlockPreviewProps<unknown>["style"];
  blockId?: string;
  isEditable: boolean;
}

function MembershipEntryPreview({
  entry,
  style,
  blockId,
  isEditable,
}: MembershipEntryPreviewProps) {
  const editorContext = useBlockEditorOptional();

  // Create handler for text fields
  const handleFieldChange = useCallback(
    (field: string) => (value: string) => {
      if (!blockId || !editorContext) return;
      const elementId = createFieldElementId(blockId, entry.id, field);
      editorContext.updateContentByPath(elementId, value);
    },
    [blockId, entry.id, editorContext]
  );

  // If not editable, render without inline editing capabilities
  if (!isEditable || !blockId) {
    const dateRange = formatDateRange(entry.startDate, entry.endDate);
    return (
      <div>
        <div className="flex justify-between items-baseline">
          <span
            className="font-semibold"
            style={{ fontSize: style.bodyFontSize }}
          >
            {entry.organization}
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
        {entry.role && (
          <div
            className="text-foreground/80"
            style={{ fontSize: style.bodyFontSize }}
          >
            {entry.role}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Organization and dates row */}
      <div className="flex justify-between items-baseline">
        <InlinePlainText
          elementId={createFieldElementId(blockId, entry.id, "organization")}
          value={entry.organization}
          className="font-semibold"
          placeholder="Organization"
          onCommit={handleFieldChange("organization")}
        />
        <span
          className="flex-shrink-0 ml-4 text-muted-foreground"
          style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
        >
          <InlinePlainText
            elementId={createFieldElementId(blockId, entry.id, "startDate")}
            value={entry.startDate || ""}
            placeholder="Start"
            onCommit={handleFieldChange("startDate")}
          />
          <span className="mx-1">-</span>
          <InlinePlainText
            elementId={createFieldElementId(blockId, entry.id, "endDate")}
            value={entry.endDate || ""}
            placeholder="End"
            onCommit={handleFieldChange("endDate")}
          />
        </span>
      </div>

      {/* Role row */}
      <div
        className="text-foreground/80"
        style={{ fontSize: style.bodyFontSize }}
      >
        <InlinePlainText
          elementId={createFieldElementId(blockId, entry.id, "role")}
          value={entry.role || ""}
          placeholder="Member Role"
          onCommit={handleFieldChange("role")}
        />
      </div>
    </div>
  );
}

/**
 * Check if memberships block has meaningful content
 */
export function hasMembershipsContent(content: MembershipEntry[]): boolean {
  return content.some((entry) => entry.organization);
}
