"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";

/**
 * Memoized TipTap extensions configuration.
 * Defined outside the component to ensure stable reference across renders.
 * This prevents TipTap from re-resolving extensions and avoids
 * "Duplicate extension names found" warnings during React StrictMode double-renders.
 */
const INLINE_EDIT_EXTENSIONS = [
  StarterKit.configure({
    heading: {
      levels: [1, 2, 3],
    },
    bulletList: {
      keepMarks: true,
      keepAttributes: false,
    },
    orderedList: {
      keepMarks: true,
      keepAttributes: false,
    },
  }),
  Underline,
];

/**
 * Inline Edit Context Value
 *
 * Provides state and actions for inline editing within the preview.
 * Uses a single TipTap editor instance that repositions to the active element.
 */
export interface InlineEditContextValue {
  /** Currently editing element ID (e.g., "exp-1:entry-0:title") */
  editingElementId: string | null;
  /** Original value before editing (for cancel/undo) */
  originalValue: string | null;

  /** Start editing an element */
  startEdit: (elementId: string, initialValue: string) => void;
  /** Commit the current edit with the new value */
  commitEdit: (newValue: string) => void;
  /** Cancel the current edit and restore original value */
  cancelEdit: () => void;

  /** Shared TipTap editor instance */
  editor: Editor | null;

  /** Whether currently in edit mode */
  isEditing: boolean;
  /** Whether the current edit has uncommitted changes */
  isDirty: boolean;

  /** Register a commit handler for an element */
  registerCommitHandler: (elementId: string, handler: (value: string) => void) => void;
  /** Unregister a commit handler */
  unregisterCommitHandler: (elementId: string) => void;
}

const InlineEditContext = createContext<InlineEditContextValue | null>(null);

/**
 * Props for InlineEditProvider
 */
export interface InlineEditProviderProps {
  /** Children to render */
  children: ReactNode;
  /** Global callback when any edit is committed */
  onCommit?: (elementId: string, value: string) => void;
}

/**
 * InlineEditProvider
 *
 * Provides inline editing state and a shared TipTap editor instance
 * for all editable elements within the preview.
 */
export function InlineEditProvider({
  children,
  onCommit,
}: InlineEditProviderProps) {
  // Editing state
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const [originalValue, setOriginalValue] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Commit handlers registry
  const commitHandlersRef = useRef<Map<string, (value: string) => void>>(new Map());

  // Create a single TipTap editor instance
  // Uses stable INLINE_EDIT_EXTENSIONS constant to prevent duplicate extension warnings
  const editor = useEditor({
    extensions: INLINE_EDIT_EXTENSIONS,
    content: "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "focus:outline-none",
      },
    },
    onUpdate: () => {
      setIsDirty(true);
    },
  });

  // Register/unregister commit handlers
  const registerCommitHandler = useCallback(
    (elementId: string, handler: (value: string) => void) => {
      commitHandlersRef.current.set(elementId, handler);
    },
    []
  );

  const unregisterCommitHandler = useCallback((elementId: string) => {
    commitHandlersRef.current.delete(elementId);
  }, []);

  // Start editing an element
  const startEdit = useCallback(
    (elementId: string, initialValue: string) => {
      if (!editor) return;

      // If switching from another element, commit first
      if (editingElementId && editingElementId !== elementId && isDirty) {
        const currentValue = editor.getHTML();
        const handler = commitHandlersRef.current.get(editingElementId);
        if (handler) {
          handler(currentValue);
        }
        onCommit?.(editingElementId, currentValue);
      }

      // Set new editing state
      setEditingElementId(elementId);
      setOriginalValue(initialValue);
      setIsDirty(false);

      // Update editor content
      editor.commands.setContent(initialValue);
      editor.commands.focus("end");
    },
    [editor, editingElementId, isDirty, onCommit]
  );

  // Commit the current edit
  const commitEdit = useCallback(
    (newValue: string) => {
      if (!editingElementId) return;

      // Call element-specific handler
      const handler = commitHandlersRef.current.get(editingElementId);
      if (handler) {
        handler(newValue);
      }

      // Call global handler
      onCommit?.(editingElementId, newValue);

      // Reset state
      setEditingElementId(null);
      setOriginalValue(null);
      setIsDirty(false);
    },
    [editingElementId, onCommit]
  );

  // Cancel the current edit
  const cancelEdit = useCallback(() => {
    if (!editor || !editingElementId) return;

    // Restore original value in editor (for visual feedback)
    if (originalValue !== null) {
      editor.commands.setContent(originalValue);
    }

    // Reset state
    setEditingElementId(null);
    setOriginalValue(null);
    setIsDirty(false);
  }, [editor, editingElementId, originalValue]);

  // Computed state
  const isEditing = editingElementId !== null;

  // Context value
  const contextValue: InlineEditContextValue = useMemo(
    () => ({
      editingElementId,
      originalValue,
      startEdit,
      commitEdit,
      cancelEdit,
      editor,
      isEditing,
      isDirty,
      registerCommitHandler,
      unregisterCommitHandler,
    }),
    [
      editingElementId,
      originalValue,
      startEdit,
      commitEdit,
      cancelEdit,
      editor,
      isEditing,
      isDirty,
      registerCommitHandler,
      unregisterCommitHandler,
    ]
  );

  return (
    <InlineEditContext.Provider value={contextValue}>
      {children}
    </InlineEditContext.Provider>
  );
}

/**
 * Hook to access the inline edit context
 * @throws Error if used outside of InlineEditProvider
 */
export function useInlineEdit(): InlineEditContextValue {
  const context = useContext(InlineEditContext);
  if (!context) {
    throw new Error("useInlineEdit must be used within InlineEditProvider");
  }
  return context;
}

/**
 * Hook to check if inline editing context is available
 * Returns null if not within a provider (useful for optional usage)
 */
export function useInlineEditOptional(): InlineEditContextValue | null {
  return useContext(InlineEditContext);
}
