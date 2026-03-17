"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { EditorContent } from "@tiptap/react";
import { useInlineEditOptional } from "./useInlineEdit";
import { FloatingToolbar } from "./FloatingToolbar";

/**
 * Props for InlineEditManager
 */
export interface InlineEditManagerProps {
  /** Reference to the container element to find editable elements within */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Whether to show the floating toolbar on text selection */
  showToolbar?: boolean;
  /** Whether this is a rich text edit (shows toolbar) or plain text */
  isRichText?: boolean;
}

/**
 * InlineEditManager
 *
 * Renders the floating TipTap editor at the position of the currently
 * editing element. Uses createPortal to render outside normal flow.
 */
export function InlineEditManager({
  containerRef,
  showToolbar = true,
}: InlineEditManagerProps) {
  const context = useInlineEditOptional();
  const [position, setPosition] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const editorWrapperRef = useRef<HTMLDivElement>(null);

  // Ensure we only render portal on client
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const { editingElementId, editor, commitEdit, cancelEdit } = context ?? {};

  // Find and position editor over the target element
  useEffect(() => {
    if (!editingElementId || !containerRef.current) {
      setPosition(null);
      return;
    }

    const element = containerRef.current.querySelector(
      `[data-element-id="${editingElementId}"]`
    );

    if (element) {
      const rect = element.getBoundingClientRect();
      setPosition(rect);

      // Add a class to the element to indicate it's being edited
      element.classList.add("inline-editing");

      return () => {
        element.classList.remove("inline-editing");
      };
    }
  }, [editingElementId, containerRef]);

  // Handle click outside to commit
  useEffect(() => {
    if (!editingElementId || !editor) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Don't commit if clicking within the editor wrapper or toolbar
      if (editorWrapperRef.current?.contains(target)) {
        return;
      }

      // Check if clicking within a floating toolbar
      const toolbar = document.querySelector("[data-floating-toolbar]");
      if (toolbar?.contains(target)) {
        return;
      }

      // Check if clicking on another editable element (startEdit handles commit)
      const editableElement = (target as Element).closest?.("[data-element-id]");
      if (editableElement) {
        return;
      }

      // Commit the edit
      const newValue = editor.getHTML();
      commitEdit?.(newValue);
    };

    // Use mousedown for better UX (before focus changes)
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [editingElementId, editor, commitEdit]);

  // Handle Escape key to cancel
  useEffect(() => {
    if (!editingElementId) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        cancelEdit?.();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editingElementId, cancelEdit]);

  // Don't render if not editing or not mounted
  if (!mounted || !editingElementId || !position || !editor || !context) {
    return null;
  }

  // Create the floating editor overlay
  const editorOverlay = (
    <div
      ref={editorWrapperRef}
      className="fixed z-50"
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
        minHeight: position.height,
      }}
    >
      {/* Editor content positioned exactly over the element */}
      <div
        className="bg-white border-2 border-blue-500 rounded shadow-lg"
        style={{
          minHeight: position.height,
        }}
      >
        <EditorContent
          editor={editor}
          className="[&_.ProseMirror]:p-1 [&_.ProseMirror]:min-h-[inherit] [&_.ProseMirror]:focus:outline-none [&_.ProseMirror]:text-inherit"
        />
      </div>

      {/* Floating toolbar for rich text */}
      {showToolbar && <FloatingToolbar editor={editor} />}
    </div>
  );

  // Use portal to render at document root
  return createPortal(editorOverlay, document.body);
}
