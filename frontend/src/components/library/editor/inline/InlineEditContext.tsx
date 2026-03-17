"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";

/**
 * Simplified Inline Edit Context Value
 *
 * After phase 3, this context only tracks:
 * - Currently focused element (for UI highlighting)
 * - Currently active editor (for FloatingToolbar coordination if needed)
 *
 * Individual InlineRichText/InlinePlainText components manage their own
 * editing state and commit handlers directly.
 */
export interface InlineEditContextValue {
  /** Currently focused element ID (for UI highlighting) */
  focusedElementId: string | null;
  setFocusedElementId: (id: string | null) => void;

  /** Currently active editor (for FloatingToolbar coordination) */
  currentEditor: Editor | null;
  setCurrentEditor: (editor: Editor | null) => void;
}

const InlineEditContext = createContext<InlineEditContextValue | null>(null);

/**
 * Props for InlineEditProvider
 */
export interface InlineEditProviderProps {
  /** Children to render */
  children: ReactNode;
  /** Global callback when any edit is committed (optional, for coordination) */
  onCommit?: (elementId: string, value: string) => void;
}

/**
 * InlineEditProvider
 *
 * Provides minimal coordination state for inline editing.
 * Individual editor components (InlinePlainText, InlineRichText) manage
 * their own TipTap instances and commit handlers.
 */
export function InlineEditProvider({
  children,
}: InlineEditProviderProps) {
  const [focusedElementId, setFocusedElementId] = useState<string | null>(null);
  const [currentEditor, setCurrentEditor] = useState<Editor | null>(null);

  return (
    <InlineEditContext.Provider
      value={{
        focusedElementId,
        setFocusedElementId,
        currentEditor,
        setCurrentEditor,
      }}
    >
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
