"use client";

import { useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useInlineEditOptional } from "./useInlineEdit";

/**
 * Props for EditableRichText
 */
export interface EditableRichTextProps {
  /** Unique element ID for this editable field (e.g., "summary-1::content") */
  elementId: string;
  /** Current HTML content */
  value: string;
  /** Additional CSS classes */
  className?: string;
  /** Placeholder text when value is empty */
  placeholder?: string;
  /** Callback when edit is committed */
  onCommit: (newHtml: string) => void;
  /** Whether to show the floating toolbar on text selection */
  showToolbar?: boolean;
  /** Whether this field is currently active/selected */
  isActive?: boolean;
  /** Whether this field is currently hovered */
  isHovered?: boolean;
}

/**
 * EditableRichText
 *
 * Wrapper for rich text fields (summary, bullets) that need formatting.
 * Renders HTML content when not editing. On click, signals
 * InlineEditContext to start editing with full TipTap support.
 */
export function EditableRichText({
  elementId,
  value,
  className,
  placeholder = "Click to edit",
  onCommit,
  showToolbar = true,
  isActive = false,
  isHovered = false,
}: EditableRichTextProps) {
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

    // For rich text, pass HTML directly
    registerCommitHandler(elementId, onCommit);

    return () => {
      unregisterCommitHandler(elementId);
    };
  }, [elementId, onCommit, registerCommitHandler, unregisterCommitHandler]);

  // Handle click to start editing
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();

      if (!startEdit || isCurrentlyEditing) return;

      // Ensure value is wrapped in a block element if not already
      let htmlValue = value || "";
      if (htmlValue && !htmlValue.match(/^<(p|h[1-6]|ul|ol|blockquote|pre|div)/i)) {
        htmlValue = `<p>${htmlValue}</p>`;
      }
      if (!htmlValue) {
        htmlValue = `<p></p>`;
      }

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
    if (value) {
      return (
        <div
          className={cn("prose prose-sm max-w-none", className)}
          dangerouslySetInnerHTML={{ __html: value }}
        />
      );
    }
    return (
      <div className={cn("text-muted-foreground", className)}>
        {placeholder}
      </div>
    );
  }

  // When editing, the InlineEditManager renders the editor overlay,
  // so we show a placeholder here to maintain layout
  if (isCurrentlyEditing) {
    return (
      <div
        data-element-id={elementId}
        data-rich-text="true"
        data-show-toolbar={showToolbar ? "true" : "false"}
        className={cn(
          "min-h-[1.5em]",
          // Hide content while editing (editor overlay shows actual content)
          "invisible",
          className
        )}
      >
        {value ? (
          <div dangerouslySetInnerHTML={{ __html: value }} />
        ) : (
          placeholder
        )}
      </div>
    );
  }

  // Render as clickable content
  return (
    <div
      data-element-id={elementId}
      data-rich-text="true"
      data-show-toolbar={showToolbar ? "true" : "false"}
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
        // Prose styles for rich content
        value && "prose prose-sm max-w-none",
        // Empty state
        !value && "text-muted-foreground",
        className
      )}
    >
      {value ? (
        <div dangerouslySetInnerHTML={{ __html: value }} />
      ) : (
        placeholder
      )}
    </div>
  );
}
