"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
} from "@floating-ui/react";
import { Bold, Italic, Underline, RemoveFormatting } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Props for FloatingToolbar
 */
export interface FloatingToolbarProps {
  /** TipTap editor instance */
  editor: Editor;
  /** Optional callback for AI improvement request */
  onAIRequest?: (instruction: string) => void;
}

/**
 * FloatingToolbar
 *
 * A floating formatting toolbar that appears on text selection.
 * Provides bold, italic, underline, and clear formatting buttons.
 */
export function FloatingToolbar({ editor, onAIRequest }: FloatingToolbarProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [selectionRect, setSelectionRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Floating UI setup
  const { refs, floatingStyles } = useFloating({
    placement: "top",
    middleware: [
      offset(8), // 8px above selection
      flip({
        fallbackPlacements: ["bottom", "top-start", "top-end"],
      }),
      shift({ padding: 8 }),
    ],
    whileElementsMounted: autoUpdate,
  });

  // Update position and visibility based on selection
  const updateToolbar = useCallback(() => {
    const { selection } = editor.state;

    // Hide if selection is empty
    if (selection.empty) {
      setIsVisible(false);
      return;
    }

    // Get selection coordinates
    const { from, to } = selection;

    try {
      const start = editor.view.coordsAtPos(from);
      const end = editor.view.coordsAtPos(to);

      // Calculate center of selection
      const x = (start.left + end.right) / 2;
      const y = start.top;

      setSelectionRect({
        x,
        y,
        width: end.right - start.left,
        height: end.bottom - start.top,
      });
      setIsVisible(true);
    } catch {
      // Position calculation failed (e.g., invalid selection)
      setIsVisible(false);
    }
  }, [editor]);

  // Listen to selection changes
  useEffect(() => {
    const handleSelectionUpdate = () => {
      updateToolbar();
    };

    editor.on("selectionUpdate", handleSelectionUpdate);
    editor.on("focus", handleSelectionUpdate);

    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate);
      editor.off("focus", handleSelectionUpdate);
    };
  }, [editor, updateToolbar]);

  // Update virtual reference element for floating UI
  useEffect(() => {
    if (!selectionRect) return;

    refs.setReference({
      getBoundingClientRect: () => ({
        x: selectionRect.x,
        y: selectionRect.y,
        width: 0,
        height: 0,
        top: selectionRect.y,
        right: selectionRect.x,
        bottom: selectionRect.y + selectionRect.height,
        left: selectionRect.x,
      }),
    });
  }, [selectionRect, refs]);

  // Toolbar button handlers
  const handleBold = useCallback(() => {
    editor.chain().focus().toggleBold().run();
  }, [editor]);

  const handleItalic = useCallback(() => {
    editor.chain().focus().toggleItalic().run();
  }, [editor]);

  const handleUnderline = useCallback(() => {
    editor.chain().focus().toggleUnderline().run();
  }, [editor]);

  const handleClearFormatting = useCallback(() => {
    editor.chain().focus().unsetAllMarks().run();
  }, [editor]);

  // Don't render if not visible
  if (!isVisible || !selectionRect) {
    return null;
  }

  const toolbar = (
    <div
      ref={(el) => {
        refs.setFloating(el);
        (toolbarRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      }}
      style={floatingStyles}
      className="z-60 flex items-center gap-0.5 bg-zinc-900 rounded-md shadow-lg p-1"
      data-floating-toolbar
    >
      {/* Bold */}
      <ToolbarButton
        onClick={handleBold}
        isActive={editor.isActive("bold")}
        title="Bold (Ctrl+B)"
      >
        <Bold className="w-4 h-4" />
      </ToolbarButton>

      {/* Italic */}
      <ToolbarButton
        onClick={handleItalic}
        isActive={editor.isActive("italic")}
        title="Italic (Ctrl+I)"
      >
        <Italic className="w-4 h-4" />
      </ToolbarButton>

      {/* Underline */}
      <ToolbarButton
        onClick={handleUnderline}
        isActive={editor.isActive("underline")}
        title="Underline (Ctrl+U)"
      >
        <Underline className="w-4 h-4" />
      </ToolbarButton>

      {/* Separator */}
      <div className="w-px h-5 bg-zinc-700 mx-1" />

      {/* Clear Formatting */}
      <ToolbarButton
        onClick={handleClearFormatting}
        title="Clear formatting"
      >
        <RemoveFormatting className="w-4 h-4" />
      </ToolbarButton>
    </div>
  );

  return createPortal(toolbar, document.body);
}

/**
 * ToolbarButton - Individual button in the floating toolbar
 */
interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({
  onClick,
  isActive = false,
  title,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      onMouseDown={(e) => {
        // Prevent focus loss from editor
        e.preventDefault();
      }}
      className={cn(
        "p-1.5 rounded transition-colors",
        isActive
          ? "bg-blue-600 text-white"
          : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
      )}
      title={title}
    >
      {children}
    </button>
  );
}
