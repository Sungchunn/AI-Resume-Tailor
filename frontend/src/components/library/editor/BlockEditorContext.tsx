"use client";

import { createContext, useContext } from "react";
import type {
  AnyResumeBlock,
  BlockContent,
  BlockEditorAction,
  BlockEditorState,
  BlockEditorStyle,
  ResumeBlockType,
} from "@/lib/resume/types";
import type { AutoFitStatus, AutoFitReduction } from "./style/useAutoFitBlocks";

/**
 * Block Editor Context Value
 *
 * Provides state, dispatch, and convenience methods for the block editor.
 */
export interface BlockEditorContextValue {
  // State
  state: BlockEditorState;
  dispatch: React.Dispatch<BlockEditorAction>;

  // Block operations
  addBlock: (blockType: ResumeBlockType, afterId?: string) => void;
  removeBlock: (id: string) => void;
  updateBlock: (id: string, content: BlockContent) => void;
  reorderBlocks: (activeId: string, overId: string) => void;
  setActiveBlock: (id: string | null) => void;
  toggleBlockCollapse: (id: string) => void;
  toggleBlockVisibility: (id: string) => void;

  // Style operations
  updateStyle: (style: Partial<BlockEditorStyle>) => void;
  applyStylePreset: (presetName: "classic" | "modern" | "minimal" | "executive") => void;

  // Auto-fit operations
  setFitToOnePage: (enabled: boolean) => void;
  autoFitStatus: AutoFitStatus;
  autoFitReductions: AutoFitReduction[];

  // Persistence
  save: () => Promise<void>;
  isSaving: boolean;

  // Undo/Redo
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;

  // Utilities
  getBlockById: (id: string) => AnyResumeBlock | undefined;
  getBlocksByType: (type: ResumeBlockType) => AnyResumeBlock[];
  hasBlockType: (type: ResumeBlockType) => boolean;
}

/**
 * Block Editor Context
 */
export const BlockEditorContext = createContext<BlockEditorContextValue | null>(
  null
);

/**
 * Hook to access the block editor context
 * @throws Error if used outside of BlockEditorProvider
 */
export function useBlockEditor(): BlockEditorContextValue {
  const context = useContext(BlockEditorContext);
  if (!context) {
    throw new Error("useBlockEditor must be used within a BlockEditorProvider");
  }
  return context;
}

/**
 * Hook to access just the blocks array
 * Useful for components that only need to read blocks
 */
export function useBlocks(): AnyResumeBlock[] {
  const { state } = useBlockEditor();
  return state.blocks;
}

/**
 * Hook to access the active block
 */
export function useActiveBlock(): AnyResumeBlock | undefined {
  const { state, getBlockById } = useBlockEditor();
  if (!state.activeBlockId) return undefined;
  return getBlockById(state.activeBlockId);
}

/**
 * Hook to access the style settings
 */
export function useBlockEditorStyle(): BlockEditorStyle {
  const { state } = useBlockEditor();
  return state.style;
}

/**
 * Hook to check if there are unsaved changes
 */
export function useHasUnsavedChanges(): boolean {
  const { state } = useBlockEditor();
  return state.isDirty;
}
