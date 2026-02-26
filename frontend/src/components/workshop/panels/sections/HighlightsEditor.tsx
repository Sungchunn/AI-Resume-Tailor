"use client";

import { useCallback } from "react";

interface HighlightsEditorProps {
  highlights: string[];
  onChange: (highlights: string[]) => void;
}

export function HighlightsEditor({ highlights, onChange }: HighlightsEditorProps) {
  const handleChange = useCallback(
    (index: number, value: string) => {
      const newHighlights = [...highlights];
      newHighlights[index] = value;
      onChange(newHighlights);
    },
    [highlights, onChange]
  );

  const handleRemove = useCallback(
    (index: number) => {
      const newHighlights = highlights.filter((_, i) => i !== index);
      onChange(newHighlights);
    },
    [highlights, onChange]
  );

  const handleAdd = useCallback(() => {
    onChange([...highlights, ""]);
  }, [highlights, onChange]);

  return (
    <div className="space-y-2">
      {highlights.map((highlight, index) => (
        <div key={index} className="flex items-start gap-2">
          <span className="text-primary-500 mt-2.5">•</span>
          <input
            type="text"
            value={highlight}
            onChange={(e) => handleChange(index, e.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="Enter a key highlight..."
          />
          <button
            onClick={() => handleRemove(index)}
            className="p-2 text-muted-foreground/60 hover:text-red-500 transition-colors"
            aria-label="Remove highlight"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}

      <button
        onClick={handleAdd}
        className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Highlight
      </button>
    </div>
  );
}
