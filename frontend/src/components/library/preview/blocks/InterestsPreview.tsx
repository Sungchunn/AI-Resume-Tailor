"use client";

import type { BaseBlockPreviewProps } from "../types";

interface InterestsPreviewProps extends BaseBlockPreviewProps<string> {}

/**
 * InterestsPreview - Renders interests/hobbies text
 *
 * Displays freeform text content for personal interests.
 */
export function InterestsPreview({ content, style }: InterestsPreviewProps) {
  if (!content || content.trim() === "") {
    return null;
  }

  // Check if content contains HTML tags
  const isHtml = /<[^>]+>/.test(content);

  if (isHtml) {
    return (
      <div
        className="interests-content prose prose-sm max-w-none"
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
 * Check if interests block has meaningful content
 */
export function hasInterestsContent(content: string): boolean {
  return Boolean(content && content.trim().length > 0);
}
