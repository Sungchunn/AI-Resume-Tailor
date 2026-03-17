"use client";

import { useCallback } from "react";
import type { BaseBlockPreviewProps } from "../types";
import { sanitizeHtml } from "@/lib/utils/sanitize";
import { EditableRichText } from "../../editor/inline";
import { createFieldElementId } from "@/lib/resume/elementPath";
import { useBlockEditor } from "../../editor/BlockEditorContext";

interface InterestsPreviewProps extends BaseBlockPreviewProps<string> {}

/**
 * InterestsPreview - Renders interests/hobbies text with inline editing
 *
 * Displays freeform text content for personal interests.
 * Content is inline-editable via EditableRichText component.
 */
export function InterestsPreview({
  content,
  style,
  blockId,
}: InterestsPreviewProps) {
  const { updateContentByPath } = useBlockEditor();

  // Create handler for content changes
  const handleContentChange = useCallback(
    (value: string) => {
      if (!blockId) return;
      const elementId = createFieldElementId(blockId, undefined, "content");
      updateContentByPath(elementId, value);
    },
    [blockId, updateContentByPath]
  );

  // If no blockId, render without inline editing capabilities
  if (!blockId) {
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
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
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

  return (
    <div
      style={{
        fontSize: style.bodyFontSize,
        lineHeight: style.lineHeight,
      }}
    >
      <EditableRichText
        elementId={createFieldElementId(blockId, undefined, "content")}
        value={content || ""}
        placeholder="Add your interests and hobbies..."
        onCommit={handleContentChange}
      />
    </div>
  );
}

/**
 * Check if interests block has meaningful content
 */
export function hasInterestsContent(content: string): boolean {
  return Boolean(content && content.trim().length > 0);
}
