"use client";

import type { BaseBlockPreviewProps } from "../types";

interface SkillsPreviewProps extends BaseBlockPreviewProps<string[]> {}

/**
 * SkillsPreview - Renders skills as comma-separated inline text
 *
 * More space-efficient than flexbox layout with pipe separators.
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
    <p style={{ fontSize: style.bodyFontSize }}>
      {filteredSkills.join(", ")}
    </p>
  );
}

/**
 * Check if skills block has meaningful content
 */
export function hasSkillsContent(content: string[]): boolean {
  return content.some((skill) => skill.trim());
}
