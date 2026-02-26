"use client";

import { TagInput } from "./shared";

interface SkillsEditorProps {
  content: string[];
  onChange: (content: string[]) => void;
}

/**
 * SkillsEditor - Edit skills list
 *
 * Simple tag input for adding/removing skills.
 */
export function SkillsEditor({ content, onChange }: SkillsEditorProps) {
  return (
    <div className="space-y-2">
      <TagInput
        label="Technical Skills & Competencies"
        tags={content}
        onChange={onChange}
        placeholder="Add a skill..."
        hint="Add relevant technical skills, tools, frameworks, and competencies. Order them by relevance."
        maxTags={30}
      />
    </div>
  );
}
