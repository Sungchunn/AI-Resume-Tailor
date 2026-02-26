"use client";

import type { BaseBlockPreviewProps } from "../types";

interface SummaryPreviewProps extends BaseBlockPreviewProps<string> {}

/**
 * SummaryPreview - Renders professional summary text
 *
 * Displays rich text content (may contain HTML from TipTap editor).
 */
export function SummaryPreview({ content, style }: SummaryPreviewProps) {
  if (!content || content.trim() === "") {
    return null;
  }

  // Check if content contains HTML tags
  const isHtml = /<[^>]+>/.test(content);

  if (isHtml) {
    return (
      <div
        className="summary-content prose prose-sm max-w-none"
        style={{
          fontSize: style.bodyFontSize,
          lineHeight: style.lineHeight,
        }}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  return (
    <p
      style={{
        fontSize: style.bodyFontSize,
        lineHeight: style.lineHeight,
      }}
    >
      {content}
    </p>
  );
}

/**
 * Check if summary has meaningful content
 */
export function hasSummaryContent(content: string): boolean {
  return Boolean(content && content.trim().length > 0);
}
