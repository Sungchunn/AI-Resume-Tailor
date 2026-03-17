"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

/**
 * Props for InlinePlainText component
 */
export interface InlinePlainTextProps {
  /** Unique identifier for the editable element */
  elementId: string;
  /** Current text value */
  value: string;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
  /** Callback when value is committed (on blur) */
  onCommit: (value: string) => void;
}

/**
 * InlinePlainText
 *
 * A native contentEditable component for editing plain text fields.
 * Used for titles, company names, dates, and individual skills.
 *
 * Key features:
 * - No TipTap, no <p> tag wrapping
 * - Commits value on blur
 * - Prevents Enter/Tab from creating newlines
 *
 * @example
 * ```tsx
 * <InlinePlainText
 *   elementId="exp-1:entry-0:title"
 *   value={jobTitle}
 *   placeholder="Job Title"
 *   onCommit={(value) => updateJobTitle(value)}
 * />
 * ```
 */
export function InlinePlainText({
  elementId,
  value,
  placeholder = "Click to edit",
  className,
  onCommit,
}: InlinePlainTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Sync value to DOM when not focused
  useEffect(() => {
    if (!isFocused && ref.current) {
      ref.current.textContent = value;
    }
  }, [value, isFocused]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    const newValue = ref.current?.textContent?.trim() || "";
    if (newValue !== value) {
      onCommit(newValue);
    }
  }, [value, onCommit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Prevent newlines in plain text
    if (e.key === "Enter") {
      e.preventDefault();
      ref.current?.blur();
    }
    // Prevent tabs
    if (e.key === "Tab") {
      e.preventDefault();
      ref.current?.blur();
    }
  }, []);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  return (
    <span
      ref={ref}
      data-element-id={elementId}
      contentEditable
      suppressContentEditableWarning
      onBlur={handleBlur}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      className={cn(
        "cursor-text outline-none rounded-sm transition-colors",
        "focus:ring-2 focus:ring-blue-500 focus:ring-offset-1",
        "hover:bg-blue-50 dark:hover:bg-blue-950/30",
        !value && "text-muted-foreground",
        className
      )}
    >
      {value || placeholder}
    </span>
  );
}
