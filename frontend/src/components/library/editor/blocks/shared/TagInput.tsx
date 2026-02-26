"use client";

import { useState, useCallback, type KeyboardEvent } from "react";
import { X, Plus } from "lucide-react";

interface TagInputProps {
  label?: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  hint?: string;
}

/**
 * TagInput - Tag pills with add/remove functionality
 */
export function TagInput({
  label,
  tags,
  onChange,
  placeholder = "Add a tag...",
  maxTags,
  hint,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("");

  const addTag = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    if (tags.includes(trimmed)) return;
    if (maxTags && tags.length >= maxTags) return;

    onChange([...tags, trimmed]);
    setInputValue("");
  }, [inputValue, tags, onChange, maxTags]);

  const removeTag = useCallback(
    (index: number) => {
      onChange(tags.filter((_, i) => i !== index));
    },
    [tags, onChange]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addTag();
      } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
        removeTag(tags.length - 1);
      }
    },
    [addTag, inputValue, tags.length, removeTag]
  );

  const canAddMore = !maxTags || tags.length < maxTags;

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-xs font-medium text-gray-700">
          {label}
        </label>
      )}

      {/* Tag Pills */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag, index) => (
            <span
              key={`${tag}-${index}`}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 text-primary-700
                text-sm rounded-full border border-primary-200"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(index)}
                className="p-0.5 hover:bg-primary-200 rounded-full transition-colors"
                aria-label={`Remove ${tag}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input Row */}
      {canAddMore && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <button
            type="button"
            onClick={addTag}
            disabled={!inputValue.trim()}
            className="p-2 text-primary-600 hover:bg-primary-50 rounded-md
              disabled:text-gray-400 disabled:hover:bg-transparent transition-colors"
            aria-label="Add tag"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Hint */}
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
      {maxTags && (
        <p className="text-xs text-gray-400">
          {tags.length} / {maxTags} tags
        </p>
      )}
    </div>
  );
}
