"use client";

import { useState, useCallback } from "react";

interface SkillsEditorProps {
  skills: string[];
  onChange: (skills: string[]) => void;
}

export function SkillsEditor({ skills, onChange }: SkillsEditorProps) {
  const [inputValue, setInputValue] = useState("");

  const handleRemove = useCallback(
    (index: number) => {
      const newSkills = skills.filter((_, i) => i !== index);
      onChange(newSkills);
    },
    [skills, onChange]
  );

  const handleAdd = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (trimmed && !skills.includes(trimmed)) {
        onChange([...skills, trimmed]);
        setInputValue("");
      }
    },
    [inputValue, skills, onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const trimmed = inputValue.trim();
        if (trimmed && !skills.includes(trimmed)) {
          onChange([...skills, trimmed]);
          setInputValue("");
        }
      }
    },
    [inputValue, skills, onChange]
  );

  return (
    <div className="space-y-3">
      {/* Skill Tags */}
      <div className="flex flex-wrap gap-2">
        {skills.map((skill, index) => (
          <span
            key={index}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted text-foreground/80 text-sm rounded-full group"
          >
            {skill}
            <button
              onClick={() => handleRemove(index)}
              className="text-muted-foreground/60 hover:text-red-500 transition-colors"
              aria-label={`Remove ${skill}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
      </div>

      {/* Add Skill Input */}
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a skill..."
          className="flex-1 px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <button
          type="submit"
          disabled={!inputValue.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed rounded-md transition-colors"
        >
          Add
        </button>
      </form>

      {/* Count */}
      <p className="text-xs text-muted-foreground">
        {skills.length} skill{skills.length !== 1 ? "s" : ""} added
      </p>
    </div>
  );
}
