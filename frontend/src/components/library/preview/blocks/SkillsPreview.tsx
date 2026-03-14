"use client";

import type { BaseBlockPreviewProps } from "../types";

interface SkillsPreviewProps extends BaseBlockPreviewProps<string[]> {}

/**
 * SkillsPreview - Renders skills as inline list items
 *
 * Uses semantic <ul>/<li> with display:inline for compactness while
 * maintaining proper HTML structure and future extensibility.
 */
export function SkillsPreview({ content, style }: SkillsPreviewProps) {
  if (!content || content.length === 0) {
    return null;
  }

  // Filter out empty skills
  const filteredSkills = content.filter((skill) => skill.trim());

  if (filteredSkills.length === 0) {
    return null;
  }

  return (
    <ul
      className="list-none p-0 m-0"
      style={{ fontSize: style.bodyFontSize }}
    >
      {filteredSkills.map((skill, idx) => (
        <li key={idx} className="inline">
          {skill}
          {idx < filteredSkills.length - 1 && ", "}
        </li>
      ))}
    </ul>
  );
}

/**
 * Check if skills block has meaningful content
 */
export function hasSkillsContent(content: string[]): boolean {
  return content.some((skill) => skill.trim());
}
