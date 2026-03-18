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
import type { StylePresetName } from "@/lib/resume/defaults";
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

  // Hover interactions for preview
  setHoveredBlock: (id: string | null) => void;
  moveBlockUp: (id: string) => void;
  moveBlockDown: (id: string) => void;

  // Granular element interactions (sub-block level)
  setActiveElement: (elementId: string | null) => void;
  setHoveredElement: (elementId: string | null) => void;

  // Inline editing: update content by element path
  updateContentByPath: (elementId: string, value: string) => void;

  // Style operations
  updateStyle: (style: Partial<BlockEditorStyle>) => void;

  // Auto-fit operations
  setFitToOnePage: (enabled: boolean) => void;
  autoFitStatus: AutoFitStatus;
  autoFitReductions: AutoFitReduction[];
  /**
   * Set the DOM measurement function for accurate auto-fit.
   * Called from EditorLayout once the preview ref is available.
   * When set, the auto-fit algorithm uses DOM-based binary search (O(log n))
   * instead of estimation-based linear search (O(n)).
   */
  setAutoFitMeasureFn: (fn: (() => number) | null) => void;
  /** Set user-defined minimum font size for fit-to-page (7-10pt) */
  setMinFontSize: (size: number) => void;
  /** Set user-defined minimum margin for fit-to-page (0.25-0.5 inches) */
  setMinMargin: (margin: number) => void;
  /** Set user-defined minimum line spacing for fit-to-page (1.0-1.15) */
  setMinLineSpacing: (spacing: number) => void;

  // Style presets
  /** Apply a preset style template */
  applyStylePreset: (preset: StylePresetName) => void;

  // Persistence
  save: () => Promise<void>;
  isSaving: boolean;

  // Conflict state (OCC)
  /** Whether a version conflict has been detected */
  hasConflict: boolean;
  /** Current document version */
  currentVersion: number;

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
 * Hook to optionally access the block editor context
 * Returns null if used outside of BlockEditorProvider (e.g., in read-only preview)
 */
export function useBlockEditorOptional(): BlockEditorContextValue | null {
  return useContext(BlockEditorContext);
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

/**
 * Hook to check if there's a version conflict
 */
export function useHasConflict(): boolean {
  const { hasConflict } = useBlockEditor();
  return hasConflict;
}

/**
 * Hook to get the current document version
 */
export function useCurrentVersion(): number {
  const { currentVersion } = useBlockEditor();
  return currentVersion;
}
