"use client";

import { useCallback } from "react";
import type { BaseBlockPreviewProps } from "../types";
import { InlineRichText, InlineRewriteDropdown } from "../../editor/inline";
import { createFieldElementId } from "@/lib/resume/elementPath";
import { useBlockEditorOptional } from "../../editor/BlockEditorContext";
import { useRewriteSummary } from "@/lib/stores/rewriteDiffStore";

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
  const summaryRewrite = useRewriteSummary();

  const elementId = blockId ? createFieldElementId(blockId, undefined, "content") : "";

  const handleContentChange = useCallback(
    (newValue: string) => {
      if (!elementId || !editorContext) return;
      editorContext.updateContentByPath(elementId, newValue);
    },
    [elementId, editorContext]
  );

  const noopHandler = useCallback(() => {}, []);

  const showDropdown =
    summaryRewrite && summaryRewrite.status !== "rejected" && elementId;

  return (
    <div
      style={{
        fontSize: style.bodyFontSize,
        lineHeight: style.lineHeight,
      }}
    >
      <InlineRichText
        elementId={elementId}
        value={content || ""}
        className="summary-content"
        placeholder="Write a brief professional summary..."
        onCommit={isEditable ? handleContentChange : noopHandler}
        showToolbar={true}
      />
      {showDropdown && (
        <InlineRewriteDropdown
          variant="summary"
          elementId={elementId}
          entry={summaryRewrite}
        />
      )}
    </div>
  );
}

/**
 * Check if summary has meaningful content
 */
export function hasSummaryContent(content: string): boolean {
  return typeof content === 'string' && content.trim().length > 0;
}
