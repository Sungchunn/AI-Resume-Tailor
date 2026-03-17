"use client";

import { useCallback } from "react";
import type { BaseBlockPreviewProps } from "../types";
import { InlineRichText } from "../../editor/inline";
import { createFieldElementId } from "@/lib/resume/elementPath";
import { useBlockEditorOptional } from "../../editor/BlockEditorContext";

interface SummaryPreviewProps extends BaseBlockPreviewProps<string> {}

/**
 * SummaryPreview - Renders professional summary with inline editing
 *
 * Displays rich text content using InlineRichText component.
 * Supports formatting via floating toolbar on text selection.
 * Falls back to read-only display when rendered outside BlockEditorProvider.
 */
export function SummaryPreview({ content, style, blockId }: SummaryPreviewProps) {
  const editorContext = useBlockEditorOptional();
  const isEditable = !!editorContext;

  // Handle content change
  const handleContentChange = useCallback(
    (newValue: string) => {
      if (!blockId || !editorContext) return;
      const elementId = createFieldElementId(blockId, undefined, "content");
      editorContext.updateContentByPath(elementId, newValue);
    },
    [blockId, editorContext]
  );

  // No-op handler for read-only mode
  const noopHandler = useCallback(() => {}, []);

  return (
    <div
      style={{
        fontSize: style.bodyFontSize,
        lineHeight: style.lineHeight,
      }}
    >
      <InlineRichText
        elementId={blockId ? createFieldElementId(blockId, undefined, "content") : ""}
        value={content || ""}
        className="summary-content"
        placeholder="Write a brief professional summary..."
        onCommit={isEditable ? handleContentChange : noopHandler}
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
