"use client";

import { FormTextarea } from "./shared";

interface SummaryEditorProps {
  content: string;
  onChange: (content: string) => void;
}

/**
 * SummaryEditor - Edit professional summary
 *
 * Single textarea with character count and recommendations.
 */
export function SummaryEditor({ content, onChange }: SummaryEditorProps) {
  return (
    <div className="space-y-2">
      <FormTextarea
        label="Professional Summary"
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder="A brief overview of your professional background, key achievements, and career goals..."
        showCharCount
        recommendedMin={100}
        recommendedMax={400}
        hint="Tip: Focus on your unique value proposition and most relevant accomplishments"
        rows={4}
      />
    </div>
  );
}
