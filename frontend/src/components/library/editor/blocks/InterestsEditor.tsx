"use client";

import { FormTextarea } from "./shared";

interface InterestsEditorProps {
  content: string;
  onChange: (content: string) => void;
}

/**
 * InterestsEditor - Edit interests and hobbies
 *
 * Freeform text area for personal interests.
 */
export function InterestsEditor({ content, onChange }: InterestsEditorProps) {
  return (
    <div className="space-y-2">
      <FormTextarea
        label="Interests & Hobbies"
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Photography, hiking, open-source contributing, playing chess, learning new languages..."
        showCharCount
        recommendedMax={200}
        hint="Optional - Include interests that demonstrate relevant skills, character traits, or conversation starters"
        rows={3}
      />
    </div>
  );
}
