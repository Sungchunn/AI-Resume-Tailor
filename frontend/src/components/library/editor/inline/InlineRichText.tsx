"use client";

import { useEffect, useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { cn } from "@/lib/utils";
import { FloatingToolbar } from "./FloatingToolbar";

const EXTENSIONS = [
  StarterKit.configure({
    heading: false, // Disable headings for inline use
    bulletList: false,
    orderedList: false,
    blockquote: false,
    codeBlock: false,
    horizontalRule: false,
  }),
  Underline,
];

/**
 * Props for InlineRichText component
 */
export interface InlineRichTextProps {
  /** Unique identifier for the editable element */
  elementId: string;
  /** Current HTML value */
  value: string;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
  /** Callback when value is committed (on blur) */
  onCommit: (value: string) => void;
  /** Whether to show the floating formatting toolbar */
  showToolbar?: boolean;
  /** Callback when Enter is pressed (for bullet behavior) */
  onEnter?: () => void;
  /** Callback when Backspace is pressed on empty content (for bullet behavior) */
  onBackspaceEmpty?: () => void;
}

/**
 * InlineRichText
 *
 * A TipTap-based component for editing rich text fields with formatting.
 * Used for summaries and bullet points.
 *
 * Key features:
 * - Each instance has its own TipTap editor
 * - Renders EditorContent directly in place (no overlay)
 * - Supports bold, italic, underline formatting via FloatingToolbar
 * - Optional Enter/Backspace handlers for bullet behavior
 *
 * @example
 * ```tsx
 * <InlineRichText
 *   elementId="exp-1:entry-0:bullet-0"
 *   value={bulletContent}
 *   onCommit={(value) => updateBullet(value)}
 *   onEnter={() => addNewBullet()}
 *   onBackspaceEmpty={() => deleteBullet()}
 * />
 * ```
 */
export function InlineRichText({
  elementId,
  value,
  placeholder = "Click to edit",
  className,
  onCommit,
  showToolbar = true,
  onEnter,
  onBackspaceEmpty,
}: InlineRichTextProps) {
  const committedRef = useRef(false);
  const valueRef = useRef(value);
  const onCommitRef = useRef(onCommit);

  // Keep refs in sync
  useEffect(() => {
    valueRef.current = value;
    onCommitRef.current = onCommit;
  }, [value, onCommit]);

  const handleCommit = useCallback(() => {
    if (committedRef.current) return;
    committedRef.current = true;

    // Access editor via the editorRef set in useEditor
    const editorEl = document.querySelector(
      `[data-element-id="${elementId}"]`
    ) as HTMLElement;
    if (!editorEl) {
      committedRef.current = false;
      return;
    }

    // Get the ProseMirror instance from the editor element
    const html =
      editorEl.closest(".tiptap")?.innerHTML ||
      editorEl.querySelector(".tiptap")?.innerHTML ||
      "";

    // The actual commit logic will be handled via editor.getHTML()
    // This is a fallback - the real commit happens in onBlur

    // Reset committed flag after a tick
    setTimeout(() => {
      committedRef.current = false;
    }, 0);
  }, [elementId]);

  const editor = useEditor({
    extensions: EXTENSIONS,
    content: normalizeContent(value),
    editorProps: {
      attributes: {
        class: cn(
          "outline-none min-h-[1em]",
          "focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded-sm"
        ),
        "data-element-id": elementId,
      },
      handleKeyDown: (view, event) => {
        // Handle Enter for bullets
        if (event.key === "Enter" && onEnter) {
          event.preventDefault();
          // Commit current value first
          const html = view.dom.closest(".ProseMirror")
            ? cleanupHtml(
                (view.dom as HTMLElement).innerHTML || ""
              )
            : "";
          if (html !== valueRef.current) {
            onCommitRef.current(html);
          }
          onEnter();
          return true;
        }
        // Handle Backspace on empty for bullets
        if (event.key === "Backspace" && onBackspaceEmpty) {
          const isEmpty = view.state.doc.textContent.trim() === "";
          if (isEmpty) {
            event.preventDefault();
            onBackspaceEmpty();
            return true;
          }
        }
        return false;
      },
    },
    onBlur: ({ editor: ed }) => {
      if (committedRef.current) return;
      committedRef.current = true;

      const html = ed.getHTML();
      const cleaned = cleanupHtml(html);

      if (cleaned !== valueRef.current) {
        onCommitRef.current(cleaned);
      }

      setTimeout(() => {
        committedRef.current = false;
      }, 0);
    },
  });

  // Sync external value changes
  useEffect(() => {
    if (editor && !editor.isFocused) {
      const currentContent = editor.getHTML();
      if (cleanupHtml(currentContent) !== value) {
        editor.commands.setContent(normalizeContent(value));
      }
    }
  }, [editor, value]);

  if (!editor) {
    return (
      <span className={cn("text-muted-foreground", className)}>
        {value || placeholder}
      </span>
    );
  }

  return (
    <>
      <EditorContent editor={editor} className={className} />
      {showToolbar && <FloatingToolbar editor={editor} />}
    </>
  );
}

/**
 * Ensure content has a block wrapper for TipTap
 */
function normalizeContent(html: string): string {
  if (!html) return "<p></p>";
  const trimmed = html.trim();
  if (!trimmed.match(/^<(p|div|h[1-6]|ul|ol|blockquote)/i)) {
    return `<p>${trimmed}</p>`;
  }
  return trimmed;
}

/**
 * Remove wrapper paragraph for cleaner storage
 */
function cleanupHtml(html: string): string {
  const match = html.match(/^<p>([\s\S]*)<\/p>$/);
  if (match) {
    return match[1];
  }
  return html;
}
