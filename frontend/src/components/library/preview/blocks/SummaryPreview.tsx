"use client";

import { useCallback } from "react";
import type { BaseBlockPreviewProps } from "../types";
import { EditableRichText } from "../../editor/inline";
import { createFieldElementId } from "@/lib/resume/elementPath";
import { useBlockEditor } from "../../editor/BlockEditorContext";

interface SummaryPreviewProps extends BaseBlockPreviewProps<string> {}

/**
 * SummaryPreview - Renders professional summary with inline editing
 *
 * Displays rich text content using EditableRichText component.
 * Supports formatting via floating toolbar on text selection.
 */
export function SummaryPreview({ content, style, blockId }: SummaryPreviewProps) {
  const { updateContentByPath } = useBlockEditor();

  // Handle content change
  const handleContentChange = useCallback(
    (newValue: string) => {
      if (!blockId) return;
      const elementId = createFieldElementId(blockId, undefined, "content");
      updateContentByPath(elementId, newValue);
    },
    [blockId, updateContentByPath]
  );

  return (
    <div
      style={{
        fontSize: style.bodyFontSize,
        lineHeight: style.lineHeight,
      }}
    >
      <EditableRichText
        elementId={blockId ? createFieldElementId(blockId, undefined, "content") : ""}
        value={content || ""}
        className="summary-content"
        placeholder="Write a brief professional summary..."
        onCommit={handleContentChange}
        showToolbar={true}
      />
    </div>
  );
}

/**
 * Check if summary has meaningful content
 */
export function hasSummaryContent(content: string): boolean {
  return Boolean(content && content.trim().length > 0);
}
