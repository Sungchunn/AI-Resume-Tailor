"use client";

import type { BaseBlockPreviewProps } from "../types";
import { GranularElement } from "../GranularElement";
import { createIndexedElementId } from "@/lib/resume/elementPath";

interface SkillsPreviewProps extends BaseBlockPreviewProps<string[]> {}

/**
 * SkillsPreview - Renders skills as inline list items
 *
 * Uses semantic <ul>/<li> with display:inline for compactness while
 * maintaining proper HTML structure and future extensibility.
 * Supports granular highlighting for individual skills.
 */
export function SkillsPreview({
  content,
  style,
  blockId,
  activeElementId,
  hoveredElementId,
  onElementClick,
  onElementHover,
}: SkillsPreviewProps) {
  if (!content || content.length === 0) {
    return null;
  }

  // Filter out empty skills
  const filteredSkills = content.filter((skill) => skill.trim());

  if (filteredSkills.length === 0) {
    return null;
  }

  // Check if granular interaction is enabled
  const hasGranularInteraction = blockId && (onElementClick || onElementHover);

  return (
    <ul
      className="list-none p-0 m-0"
      style={{ fontSize: style.bodyFontSize }}
    >
      {filteredSkills.map((skill, idx) => {
        const isLast = idx === filteredSkills.length - 1;

        if (hasGranularInteraction) {
          const elementId = createIndexedElementId(blockId!, undefined, "skills", idx);
          return (
            <li key={idx} className="inline">
              <GranularElement
                elementId={elementId}
                variant="inline"
                activeElementId={activeElementId}
                hoveredElementId={hoveredElementId}
                onElementClick={onElementClick}
                onElementHover={onElementHover}
              >
                {skill}
              </GranularElement>
              {!isLast && ", "}
            </li>
          );
        }

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

/**
 * Check if skills block has meaningful content
 */
export function hasSkillsContent(content: string[]): boolean {
  return content.some((skill) => skill.trim());
}
