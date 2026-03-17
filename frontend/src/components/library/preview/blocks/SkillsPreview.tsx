"use client";

import { useCallback } from "react";
import type { BaseBlockPreviewProps } from "../types";
import { EditableText } from "../../editor/inline";
import { createIndexedElementId } from "@/lib/resume/elementPath";
import { useBlockEditor } from "../../editor/BlockEditorContext";

interface SkillsPreviewProps extends BaseBlockPreviewProps<string[]> {}

/**
 * SkillsPreview - Renders skills as inline list items with inline editing
 *
 * Uses semantic <ul>/<li> with display:inline for compactness while
 * maintaining proper HTML structure.
 * All skills are inline-editable via EditableText components.
 */
export function SkillsPreview({
  content,
  style,
  blockId,
}: SkillsPreviewProps) {
  const { updateContentByPath } = useBlockEditor();

  // Update a skill at the given index
  const updateSkill = useCallback(
    (index: number, value: string) => {
      if (!blockId) return;
      const elementId = createIndexedElementId(blockId, undefined, "skills", index);
      updateContentByPath(elementId, value);
    },
    [blockId, updateContentByPath]
  );

  if (!content || content.length === 0) {
    return null;
  }

  // Filter out empty skills
  const filteredSkills = content.filter((skill) => skill.trim());

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
        {filteredSkills.map((skill, idx) => {
          const isLast = idx === filteredSkills.length - 1;
          return (
            <li key={idx} className="inline">
              {skill}
              {!isLast && ", "}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul
      className="list-none p-0 m-0"
      style={{ fontSize: style.bodyFontSize }}
    >
      {filteredSkills.map((skill, idx) => {
        const isLast = idx === filteredSkills.length - 1;
        const elementId = createIndexedElementId(blockId, undefined, "skills", idx);

        return (
          <li key={idx} className="inline">
            <EditableText
              elementId={elementId}
              value={skill}
              placeholder="Skill"
              onCommit={(value) => updateSkill(idx, value)}
            />
            {!isLast && ", "}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Check if skills block has meaningful content
 */
export function hasSkillsContent(content: string[]): boolean {
  return content.some((skill) => skill.trim());
}
