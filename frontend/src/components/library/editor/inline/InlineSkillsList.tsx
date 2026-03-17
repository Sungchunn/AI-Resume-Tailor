"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

/**
 * Props for InlineSkillsList component
 */
export interface InlineSkillsListProps {
  /** Array of skill strings */
  skills: string[];
  /** Block ID for the skills section */
  blockId: string;
  /** Additional CSS classes */
  className?: string;
  /** Callback when skills are committed (on blur) */
  onCommit: (skills: string[]) => void;
}

/**
 * InlineSkillsList
 *
 * A native contentEditable component for editing skills as a comma-separated list.
 * Renders skills as "Skill 1, Skill 2, Skill 3" and parses back to array on blur.
 *
 * Key features:
 * - Single editable span for entire skills list
 * - Displays comma-separated on render
 * - Parses comma-separated text back to array on blur
 * - No per-skill popups
 *
 * @example
 * ```tsx
 * <InlineSkillsList
 *   skills={["JavaScript", "TypeScript", "React"]}
 *   blockId="skills-1"
 *   onCommit={(skills) => updateSkills(skills)}
 * />
 * ```
 */
export function InlineSkillsList({
  skills,
  blockId,
  className,
  onCommit,
}: InlineSkillsListProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Display value: comma-separated
  const displayValue = skills.filter((s) => s.trim()).join(", ");

  // Sync value to DOM when not focused
  useEffect(() => {
    if (!isFocused && ref.current) {
      ref.current.textContent = displayValue;
    }
  }, [displayValue, isFocused]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    const text = ref.current?.textContent || "";

    // Parse comma-separated text back to array
    const newSkills = text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Only commit if changed
    const oldJoined = skills.filter((s) => s.trim()).join(",");
    const newJoined = newSkills.join(",");

    if (oldJoined !== newJoined) {
      onCommit(newSkills);
    }
  }, [skills, onCommit]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Prevent newlines
    if (e.key === "Enter") {
      e.preventDefault();
      ref.current?.blur();
    }
  }, []);

  return (
    <span
      ref={ref}
      data-element-id={`${blockId}::skills`}
      contentEditable
      suppressContentEditableWarning
      onBlur={handleBlur}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      className={cn(
        "cursor-text outline-none rounded-sm transition-colors inline",
        "focus:ring-2 focus:ring-blue-500 focus:ring-offset-1",
        "hover:bg-blue-50 dark:hover:bg-blue-950/30",
        !displayValue && "text-muted-foreground",
        className
      )}
    >
      {displayValue || "Add skills..."}
    </span>
  );
}
