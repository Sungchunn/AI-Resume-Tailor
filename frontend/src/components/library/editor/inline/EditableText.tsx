"use client";

import { useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useInlineEditOptional } from "./useInlineEdit";

/**
 * Props for EditableText
 */
export interface EditableTextProps {
  /** Unique element ID for this editable field (e.g., "exp-1:entry-0:title") */
  elementId: string;
  /** Current text value */
  value: string;
  /** Additional CSS classes */
  className?: string;
  /** Placeholder text when value is empty */
  placeholder?: string;
  /** Callback when edit is committed */
  onCommit: (newValue: string) => void;
  /** Whether this field is currently active/selected */
  isActive?: boolean;
  /** Whether this field is currently hovered */
  isHovered?: boolean;
}

/**
 * EditableText
 *
 * Wrapper for plain text fields (job titles, company names, dates, etc.).
 * Renders as static text when not editing. On click, signals
 * InlineEditContext to start editing.
 *
 * For plain text fields, the TipTap editor is configured without
 * the floating toolbar (no formatting options).
 */
export function EditableText({
  elementId,
  value,
  className,
  placeholder = "Click to edit",
  onCommit,
  isActive = false,
  isHovered = false,
}: EditableTextProps) {
  const context = useInlineEditOptional();

  const {
    editingElementId,
    startEdit,
    registerCommitHandler,
    unregisterCommitHandler,
  } = context ?? {};

  const isCurrentlyEditing = editingElementId === elementId;

  // Register the commit handler
  useEffect(() => {
    if (!registerCommitHandler || !unregisterCommitHandler) return;

    // For plain text, strip HTML tags from the value
    const handleCommit = (htmlValue: string) => {
      // Strip HTML and get plain text
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = htmlValue;
      const plainText = tempDiv.textContent || tempDiv.innerText || "";
      onCommit(plainText.trim());
    };

    registerCommitHandler(elementId, handleCommit);

    return () => {
      unregisterCommitHandler(elementId);
    };
  }, [elementId, onCommit, registerCommitHandler, unregisterCommitHandler]);

  // Handle click to start editing
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();

      if (!startEdit || isCurrentlyEditing) return;

      // For plain text, wrap value in a paragraph tag
      const htmlValue = `<p>${value || ""}</p>`;
      startEdit(elementId, htmlValue);
    },
    [elementId, value, startEdit, isCurrentlyEditing]
  );

  // Handle keyboard activation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick(e as unknown as React.MouseEvent);
      }
    },
    [handleClick]
  );

  // If context is not available, render as non-editable
  if (!context) {
    return (
      <span className={className}>
        {value || <span className="text-muted-foreground">{placeholder}</span>}
      </span>
    );
  }

  // When editing, the InlineEditManager renders the editor overlay,
  // so we show a placeholder here to maintain layout
  if (isCurrentlyEditing) {
    return (
      <span
        data-element-id={elementId}
        className={cn(
          "inline-block min-w-[20px]",
          // Hide content while editing (editor overlay shows actual content)
          "invisible",
          className
        )}
      >
        {value || placeholder}
      </span>
    );
  }

  return (
    <span
      data-element-id={elementId}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "cursor-text transition-colors rounded-sm",
        // Hover state
        "hover:bg-blue-50 dark:hover:bg-blue-950/30",
        // Active/selected state
        isActive && "ring-2 ring-blue-500 ring-offset-1",
        // Hovered state (from parent hover)
        isHovered && !isActive && "bg-blue-50/50 dark:bg-blue-950/20",
        // Empty state
        !value && "text-muted-foreground",
        className
      )}
    >
      {value || placeholder}
    </span>
  );
}
