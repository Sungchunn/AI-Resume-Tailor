"use client";

import {
  useEffect,
  useCallback,
  useReducer,
  useRef,
  useMemo,
  type ReactNode,
} from "react";
import { BlockEditorContext, type BlockEditorContextValue } from "./BlockEditorContext";
import { blockEditorReducer, blockEditorActions } from "./blockEditorReducer";
import type {
  AnyResumeBlock,
  BlockContent,
  BlockEditorState,
  BlockEditorStyle,
  ParsedResumeContent,
  ResumeBlockType,
} from "@/lib/resume/types";
import {
  createEmptyState,
  STYLE_PRESETS,
  type StylePresetName,
} from "@/lib/resume/defaults";
import {
  parsedContentToBlocks,
  blocksToParsedContent,
  apiStyleToEditorStyle,
  editorStyleToApiStyle,
} from "@/lib/resume/transforms";
import { useUndoRedo } from "@/components/workshop/hooks/useUndoRedo";

/**
 * State subset that is tracked for undo/redo
 */
interface UndoableState {
  blocks: AnyResumeBlock[];
  style: BlockEditorStyle;
}

function getUndoableState(state: BlockEditorState): UndoableState {
  return {
    blocks: state.blocks,
    style: state.style,
  };
}

/**
 * Props for the BlockEditorProvider
 */
export interface BlockEditorProviderProps {
  /** Resume ID for save operations */
  resumeId: number;
  /** Initial parsed content from the backend */
  initialParsedContent?: ParsedResumeContent | null;
  /** Initial style settings from the backend */
  initialStyle?: Record<string, unknown> | null;
  /** Callback when save is triggered */
  onSave?: (data: {
    parsedContent: ParsedResumeContent;
    style: Record<string, unknown>;
  }) => Promise<void>;
  /** Children to render */
  children: ReactNode;
}

/**
 * Block Editor Provider
 *
 * Provides state management for the block-based resume editor.
 * Handles:
 * - Block CRUD operations (add, remove, update, reorder)
 * - Style management
 * - Undo/Redo history
 * - Save persistence
 */
export function BlockEditorProvider({
  resumeId,
  initialParsedContent,
  initialStyle,
  onSave,
  children,
}: BlockEditorProviderProps) {
  // Initialize state
  const initialBlocks = useMemo(
    () => parsedContentToBlocks(initialParsedContent),
    // Only compute on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const initialEditorStyle = useMemo(
    () => apiStyleToEditorStyle(initialStyle),
    // Only compute on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const initialState: BlockEditorState = useMemo(
    () => ({
      ...createEmptyState(),
      blocks: initialBlocks,
      style: initialEditorStyle,
      isLoading: false,
    }),
    [initialBlocks, initialEditorStyle]
  );

  const [state, dispatch] = useReducer(blockEditorReducer, initialState);

  // Track saving state separately (not in reducer to avoid re-renders)
  const isSavingRef = useRef(false);

  // Undo/Redo history management
  const undoRedoInitialState: UndoableState = useMemo(
    () => ({
      blocks: initialBlocks,
      style: initialEditorStyle,
    }),
    [initialBlocks, initialEditorStyle]
  );

  const {
    canUndo,
    canRedo,
    pushState: pushHistoryState,
    undo: undoHistory,
    redo: redoHistory,
  } = useUndoRedo<UndoableState>(undoRedoInitialState);

  // Track if we're currently applying an undo/redo to prevent pushing to history
  const isApplyingHistoryRef = useRef(false);

  // Push state to history when blocks or style changes (debounced)
  const lastPushedStateRef = useRef<string>("");
  useEffect(() => {
    if (state.isLoading || isApplyingHistoryRef.current) return;

    const currentState = getUndoableState(state);
    const stateHash = JSON.stringify(currentState);

    // Only push if state actually changed
    if (stateHash !== lastPushedStateRef.current) {
      const timer = setTimeout(() => {
        lastPushedStateRef.current = stateHash;
        pushHistoryState(currentState, "Edit");
      }, 500); // Debounce to avoid excessive history entries

      return () => clearTimeout(timer);
    }
  }, [state.blocks, state.style, state.isLoading, pushHistoryState]);

  // Initialize history when data loads
  useEffect(() => {
    const initialUndoableState = getUndoableState(state);
    lastPushedStateRef.current = JSON.stringify(initialUndoableState);
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Undo handler
  const undo = useCallback(() => {
    const previousState = undoHistory();
    if (previousState) {
      isApplyingHistoryRef.current = true;
      dispatch(blockEditorActions.setBlocks(previousState.blocks));
      dispatch(blockEditorActions.setStyle(previousState.style));
      // Reset flag after a short delay to allow state to settle
      setTimeout(() => {
        isApplyingHistoryRef.current = false;
      }, 100);
    }
  }, [undoHistory]);

  // Redo handler
  const redo = useCallback(() => {
    const nextState = redoHistory();
    if (nextState) {
      isApplyingHistoryRef.current = true;
      dispatch(blockEditorActions.setBlocks(nextState.blocks));
      dispatch(blockEditorActions.setStyle(nextState.style));
      // Reset flag after a short delay to allow state to settle
      setTimeout(() => {
        isApplyingHistoryRef.current = false;
      }, 100);
    }
  }, [redoHistory]);

  // Block operations
  const addBlock = useCallback(
    (blockType: ResumeBlockType, afterId?: string) => {
      dispatch(blockEditorActions.addBlock(blockType, afterId));
    },
    []
  );

  const removeBlock = useCallback((id: string) => {
    dispatch(blockEditorActions.removeBlock(id));
  }, []);

  const updateBlock = useCallback((id: string, content: BlockContent) => {
    dispatch(blockEditorActions.updateBlock(id, content));
  }, []);

  const reorderBlocks = useCallback((activeId: string, overId: string) => {
    dispatch(blockEditorActions.reorderBlocks(activeId, overId));
  }, []);

  const setActiveBlock = useCallback((id: string | null) => {
    dispatch(blockEditorActions.setActiveBlock(id));
  }, []);

  const toggleBlockCollapse = useCallback((id: string) => {
    dispatch(blockEditorActions.toggleCollapse(id));
  }, []);

  // Style operations
  const updateStyle = useCallback((style: Partial<BlockEditorStyle>) => {
    dispatch(blockEditorActions.setStyle(style));
  }, []);

  const applyStylePreset = useCallback((presetName: StylePresetName) => {
    const preset = STYLE_PRESETS[presetName];
    dispatch(blockEditorActions.setStyle(preset));
  }, []);

  // Save handler
  const save = useCallback(async () => {
    if (!onSave || isSavingRef.current) return;

    isSavingRef.current = true;
    dispatch(blockEditorActions.setLoading(true));

    try {
      const parsedContent = blocksToParsedContent(state.blocks);
      const apiStyle = editorStyleToApiStyle(state.style);

      await onSave({
        parsedContent,
        style: apiStyle,
      });

      dispatch(blockEditorActions.setDirty(false));
      dispatch(blockEditorActions.setError(null));
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to save";
      dispatch(blockEditorActions.setError(errorMessage));
    } finally {
      dispatch(blockEditorActions.setLoading(false));
      isSavingRef.current = false;
    }
  }, [state.blocks, state.style, onSave]);

  // Utility functions
  const getBlockById = useCallback(
    (id: string): AnyResumeBlock | undefined => {
      return state.blocks.find((block) => block.id === id);
    },
    [state.blocks]
  );

  const getBlocksByType = useCallback(
    (type: ResumeBlockType): AnyResumeBlock[] => {
      return state.blocks.filter((block) => block.type === type);
    },
    [state.blocks]
  );

  const hasBlockType = useCallback(
    (type: ResumeBlockType): boolean => {
      return state.blocks.some((block) => block.type === type);
    },
    [state.blocks]
  );

  // Context value
  const contextValue: BlockEditorContextValue = useMemo(
    () => ({
      state,
      dispatch,
      addBlock,
      removeBlock,
      updateBlock,
      reorderBlocks,
      setActiveBlock,
      toggleBlockCollapse,
      updateStyle,
      applyStylePreset,
      save,
      isSaving: state.isLoading && isSavingRef.current,
      canUndo,
      canRedo,
      undo,
      redo,
      getBlockById,
      getBlocksByType,
      hasBlockType,
    }),
    [
      state,
      addBlock,
      removeBlock,
      updateBlock,
      reorderBlocks,
      setActiveBlock,
      toggleBlockCollapse,
      updateStyle,
      applyStylePreset,
      save,
      canUndo,
      canRedo,
      undo,
      redo,
      getBlockById,
      getBlocksByType,
      hasBlockType,
    ]
  );

  return (
    <BlockEditorContext.Provider value={contextValue}>
      {children}
    </BlockEditorContext.Provider>
  );
}
