"use client";

import type { BaseBlockPreviewProps } from "../types";
import { InlineSkillsList } from "../../editor/inline";
import { useBlockEditorOptional } from "../../editor/BlockEditorContext";

interface SkillsPreviewProps extends BaseBlockPreviewProps<string[]> {}

/**
 * SkillsPreview - Renders skills as a single inline-editable comma-separated list
 *
 * Uses InlineSkillsList for editing all skills as a single field.
 * Falls back to read-only display when rendered outside BlockEditorProvider.
 */
export function SkillsPreview({
  content,
  style,
  blockId,
}: SkillsPreviewProps) {
  const editorContext = useBlockEditorOptional();

  if (!content || content.length === 0) {
    return null;
  }

  // Filter out empty skills
  const filteredSkills = content.filter((skill) => typeof skill === 'string' && skill.trim());

  if (filteredSkills.length === 0) {
    return null;
  }

  // If no blockId, render without inline editing capabilities
  if (!blockId) {
    return (
      <ul
        className="list-none p-0 m-0"
        style={{ fontSize: style.bodyFontSize }}
      >
        <li className="inline">
          {filteredSkills.join(", ")}
        </li>
      </ul>
    );
  }

  return (
    <ul
      className="list-none p-0 m-0"
      style={{ fontSize: style.bodyFontSize }}
    >
      <li className="inline">
        <InlineSkillsList
          skills={content}
          blockId={blockId}
          onCommit={(newSkills) => {
            editorContext?.dispatch({
              type: "UPDATE_BLOCK",
              payload: { id: blockId, content: newSkills },
            });
          }}
        />
      </li>
    </ul>
  );
}

/**
 * Check if skills block has meaningful content
 */
export function hasSkillsContent(content: string[]): boolean {
  return content.some((skill) => typeof skill === 'string' && skill.trim());
}
