"use client";

import { useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { useInlineEditOptional } from "./useInlineEdit";

/**
 * Props for EditableBullet
 */
export interface EditableBulletProps {
  /** Unique element ID for this bullet (e.g., "exp-1:entry-0:bullets:2") */
  elementId: string;
  /** Current bullet text/HTML value */
  value: string;
  /** Additional CSS classes */
  className?: string;
  /** Placeholder text when value is empty */
  placeholder?: string;
  /** Callback when edit is committed */
  onCommit: (newValue: string) => void;
  /** Callback when Enter is pressed to create new bullet */
  onEnter?: () => void;
  /** Callback when Backspace is pressed on empty bullet */
  onBackspaceEmpty?: () => void;
  /** Whether this field is currently active/selected */
  isActive?: boolean;
  /** Whether this field is currently hovered */
  isHovered?: boolean;
}

/**
 * EditableBullet
 *
 * Special wrapper for bullet points (experience bullets, education notes)
 * that supports Enter to create new bullets and Backspace to remove empty ones.
 *
 * Renders as rich text (supports bold, italic, underline) with floating toolbar.
 */
export function EditableBullet({
  elementId,
  value,
  className,
  placeholder = "Add accomplishment...",
  onCommit,
  onEnter,
  onBackspaceEmpty,
  isActive = false,
  isHovered = false,
}: EditableBulletProps) {
  const context = useInlineEditOptional();
  const lastKeyDownTimeRef = useRef<number>(0);

  const {
    editingElementId,
    startEdit,
    registerCommitHandler,
    unregisterCommitHandler,
    editor,
    commitEdit,
  } = context ?? {};

  const isCurrentlyEditing = editingElementId === elementId;

  // Register the commit handler
  useEffect(() => {
    if (!registerCommitHandler || !unregisterCommitHandler) return;

    // For bullets, pass HTML content (strip wrapping p tags)
    const handleCommit = (htmlValue: string) => {
      // Extract content from paragraph wrapper if present
      let content = htmlValue;
      const match = htmlValue.match(/^<p>([\s\S]*)<\/p>$/);
      if (match) {
        content = match[1];
      }
      // Clean up empty paragraph
      if (content === "<br>" || content === "<br/>" || content === "") {
        content = "";
      }
      onCommit(content);
    };

    registerCommitHandler(elementId, handleCommit);

    return () => {
      unregisterCommitHandler(elementId);
    };
  }, [elementId, onCommit, registerCommitHandler, unregisterCommitHandler]);

  // Handle special keys when editing this bullet
  useEffect(() => {
    if (!isCurrentlyEditing || !editor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Debounce to prevent double triggers
      const now = Date.now();
      if (now - lastKeyDownTimeRef.current < 50) return;
      lastKeyDownTimeRef.current = now;

      // Enter key: commit current content and create new bullet
      if (event.key === "Enter" && !event.shiftKey && onEnter) {
        event.preventDefault();
        event.stopPropagation();

        // Commit current content first
        const html = editor.getHTML();
        if (commitEdit) {
          commitEdit(html);
        }

        // Create new bullet (after a micro delay to let state update)
        setTimeout(() => {
          onEnter();
        }, 10);
      }

      // Backspace key: remove empty bullet
      if (event.key === "Backspace" && onBackspaceEmpty) {
        const text = editor.getText().trim();
        const { from, to } = editor.state.selection;

        // Only trigger if cursor at start of empty bullet
        if (text === "" || (from === 1 && to === 1 && text.length === 0)) {
          event.preventDefault();
          event.stopPropagation();

          // Cancel edit and remove bullet
          if (commitEdit) {
            commitEdit(""); // Commit empty value
          }

          setTimeout(() => {
            onBackspaceEmpty();
          }, 10);
        }
      }
    };

    // Use capture phase to catch events before TipTap
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [isCurrentlyEditing, editor, onEnter, onBackspaceEmpty, commitEdit]);

  // Handle click to start editing
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();

      if (!startEdit || isCurrentlyEditing) return;

      // Wrap value in a paragraph tag for TipTap
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
        <span
          className={className}
          dangerouslySetInnerHTML={{ __html: value }}
        />
      );
    }
    return (
      <span className={cn("text-muted-foreground", className)}>
        {placeholder}
      </span>
    );
  }

  // When editing, the InlineEditManager renders the editor overlay
  if (isCurrentlyEditing) {
    return (
      <span
        data-element-id={elementId}
        data-rich-text="true"
        data-show-toolbar="true"
        className={cn(
          "inline min-w-[20px]",
          // Hide content while editing
          "invisible",
          className
        )}
      >
        {value ? (
          <span dangerouslySetInnerHTML={{ __html: value }} />
        ) : (
          placeholder
        )}
      </span>
    );
  }

  // Render as clickable content
  return (
    <span
      data-element-id={elementId}
      data-rich-text="true"
      data-show-toolbar="true"
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "inline cursor-text transition-colors rounded-sm",
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
      {value ? (
        <span dangerouslySetInnerHTML={{ __html: value }} />
      ) : (
        placeholder
      )}
    </span>
  );
}
