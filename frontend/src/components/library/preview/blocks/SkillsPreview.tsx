"use client";

import type { BaseBlockPreviewProps } from "../types";

interface SkillsPreviewProps extends BaseBlockPreviewProps<string[]> {}

/**
 * SkillsPreview - Renders skills as a horizontal list
 *
 * Skills displayed with pipe separators for compact, readable layout.
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
    <div
      className="flex flex-wrap gap-x-2 gap-y-1"
      style={{ fontSize: style.bodyFontSize }}
    >
      {filteredSkills.map((skill, idx) => (
        <span key={idx}>
          {skill}
          {idx < filteredSkills.length - 1 && (
            <span className="text-muted-foreground/60 ml-2">|</span>
          )}
        </span>
      ))}
    </div>
  );
}

/**
 * Check if skills block has meaningful content
 */
export function hasSkillsContent(content: string[]): boolean {
  return content.some((skill) => skill.trim());
}
