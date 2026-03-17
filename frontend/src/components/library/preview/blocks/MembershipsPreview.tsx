"use client";

import { useCallback } from "react";
import type { MembershipEntry } from "@/lib/resume/types";
import type { BaseBlockPreviewProps } from "../types";
import { formatDateRange } from "../previewStyles";
import { EditableText } from "../../editor/inline";
import { createFieldElementId } from "@/lib/resume/elementPath";
import { useBlockEditor } from "../../editor/BlockEditorContext";

interface MembershipsPreviewProps extends BaseBlockPreviewProps<MembershipEntry[]> {}

/**
 * MembershipsPreview - Renders professional membership entries with inline editing
 *
 * Each entry displays:
 * - Organization and date range
 * - Role (if provided)
 *
 * All text fields are inline-editable via EditableText components.
 */
export function MembershipsPreview({
  content,
  style,
  blockId,
}: MembershipsPreviewProps) {
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
        />
      ))}
    </div>
  );
}

interface MembershipEntryPreviewProps {
  entry: MembershipEntry;
  style: BaseBlockPreviewProps<unknown>["style"];
  blockId?: string;
}

function MembershipEntryPreview({
  entry,
  style,
  blockId,
}: MembershipEntryPreviewProps) {
  const { updateContentByPath } = useBlockEditor();
  const dateRange = formatDateRange(entry.startDate, entry.endDate, entry.current);

  // Create handler for text fields
  const handleFieldChange = useCallback(
    (field: string) => (value: string) => {
      if (!blockId) return;
      const elementId = createFieldElementId(blockId, entry.id, field);
      updateContentByPath(elementId, value);
    },
    [blockId, entry.id, updateContentByPath]
  );

  // Handler for date range changes
  const handleDateRangeChange = useCallback(
    (value: string) => {
      if (!blockId) return;
      const elementId = createFieldElementId(blockId, entry.id, "startDate");
      updateContentByPath(elementId, value);
    },
    [blockId, entry.id, updateContentByPath]
  );

  // If no blockId, render without inline editing capabilities
  if (!blockId) {
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
        <EditableText
          elementId={createFieldElementId(blockId, entry.id, "organization")}
          value={entry.organization}
          className="font-semibold"
          placeholder="Organization"
          onCommit={handleFieldChange("organization")}
        />
        <span
          className="flex-shrink-0 ml-4"
          style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
        >
          <EditableText
            elementId={createFieldElementId(blockId, entry.id, "dateRange")}
            value={dateRange || ""}
            className="text-muted-foreground"
            placeholder="2020 - Present"
            onCommit={handleDateRangeChange}
          />
        </span>
      </div>

      {/* Role row */}
      <div
        className="text-foreground/80"
        style={{ fontSize: style.bodyFontSize }}
      >
        <EditableText
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
