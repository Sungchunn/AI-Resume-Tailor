"use client";

import {
  useState,
  useEffect,
  useCallback,
  useReducer,
  useRef,
  useMemo,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
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
import { useAutoFitBlocks, type AutoFitStatus, type AutoFitReduction } from "./style/useAutoFitBlocks";
import { useSaveCoordinator } from "@/hooks/useSaveCoordinator";
import { useResumeBroadcast } from "./hooks/useResumeBroadcast";
import { ConflictModal } from "./ConflictModal";

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
  resumeId: string;
  /** Initial parsed content from the backend */
  initialParsedContent?: ParsedResumeContent | null;
  /** Initial style settings from the backend */
  initialStyle?: Record<string, unknown> | null;
  /** Initial document version from the backend (for OCC) */
  initialVersion?: number;
  /** Callback when save is triggered */
  onSave?: (data: {
    parsedContent: ParsedResumeContent;
    style: Record<string, unknown>;
    version: number;
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
  initialVersion = 1,
  onSave,
  children,
}: BlockEditorProviderProps) {
  const router = useRouter();

  // Track current document version (for OCC)
  const [currentVersion, setCurrentVersion] = useState(initialVersion);

  // Track if conflict came from BroadcastChannel (vs HTTP 409)
  const [hasExternalConflict, setHasExternalConflict] = useState(false);

  // Initialize state with error handling
  const initialBlocks = useMemo(() => {
    try {
      return parsedContentToBlocks(initialParsedContent);
    } catch (err) {
      console.error("Failed to parse resume content:", err);
      // Return empty blocks array if parsing fails
      return [];
    }
    // Only compute on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initialEditorStyle = useMemo(() => {
    try {
      return apiStyleToEditorStyle(initialStyle);
    } catch (err) {
      console.error("Failed to parse style settings:", err);
      // Return default style if parsing fails
      return apiStyleToEditorStyle(null);
    }
    // Only compute on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const toggleBlockVisibility = useCallback((id: string) => {
    dispatch(blockEditorActions.toggleVisibility(id));
  }, []);

  // Hover interactions for preview
  const setHoveredBlock = useCallback((id: string | null) => {
    dispatch(blockEditorActions.setHoveredBlock(id));
  }, []);

  const moveBlockUp = useCallback((id: string) => {
    dispatch(blockEditorActions.moveBlockUp(id));
  }, []);

  const moveBlockDown = useCallback((id: string) => {
    dispatch(blockEditorActions.moveBlockDown(id));
  }, []);

  // Style operations
  const updateStyle = useCallback((style: Partial<BlockEditorStyle>) => {
    dispatch(blockEditorActions.setStyle(style));
  }, []);

  const applyStylePreset = useCallback((presetName: StylePresetName) => {
    const preset = STYLE_PRESETS[presetName];
    dispatch(blockEditorActions.setStyle(preset));
  }, []);

  // Auto-fit operations
  const setFitToOnePage = useCallback((enabled: boolean) => {
    dispatch(blockEditorActions.setFitToOnePage(enabled));
  }, []);

  // Auto-fit hook
  const { status: autoFitStatus, reductions: autoFitReductions } = useAutoFitBlocks({
    blocks: state.blocks,
    style: state.style,
    enabled: state.fitToOnePage,
    onStyleChange: updateStyle,
  });

  // BroadcastChannel for cross-tab sync
  const { broadcast } = useResumeBroadcast({
    resumeId,
    onSaveFromOtherTab: (message) => {
      // Another tab saved successfully
      if (message.version && message.version > currentVersion) {
        console.log(
          `[BlockEditor] Stale version detected: local=${currentVersion}, remote=${message.version}`
        );
        // Trigger conflict state
        setHasExternalConflict(true);
      }
    },
  });

  // Save coordinator with OCC
  const {
    executeSave,
    hasConflict: hasSaveConflict,
    isSaving: coordinatorIsSaving,
    clearConflict,
  } = useSaveCoordinator({
    resumeId,
    onSaveSuccess: (newVersion) => {
      setCurrentVersion(newVersion);
      dispatch(blockEditorActions.setDirty(false));
      // Notify other tabs
      broadcast("SAVE_COMPLETED", newVersion);
    },
    onConflict: () => {
      // Notify other tabs (informational)
      broadcast("VERSION_CONFLICT");
    },
  });

  // Combined conflict state
  const hasConflict = hasSaveConflict || hasExternalConflict;

  // Save handler with version tracking
  const save = useCallback(async () => {
    if (isSavingRef.current || hasConflict) return;

    isSavingRef.current = true;
    dispatch(blockEditorActions.setLoading(true));

    try {
      broadcast("SAVE_STARTED");

      const parsedContent = blocksToParsedContent(state.blocks);
      const apiStyle = editorStyleToApiStyle(state.style);

      // Call executeSave which handles OCC
      const newVersion = await executeSave({
        version: currentVersion,
        parsed_content: parsedContent as Record<string, unknown>,
        style: apiStyle,
      });

      if (newVersion) {
        dispatch(blockEditorActions.setError(null));
        // Call optional onSave callback for custom behavior
        if (onSave) {
          await onSave({ parsedContent, style: apiStyle, version: newVersion });
        }
      }
    } catch (err) {
      broadcast("SAVE_FAILED");
      const errorMessage =
        err instanceof Error ? err.message : "Failed to save";
      dispatch(blockEditorActions.setError(errorMessage));
    } finally {
      dispatch(blockEditorActions.setLoading(false));
      isSavingRef.current = false;
    }
  }, [state.blocks, state.style, currentVersion, hasConflict, onSave, executeSave, broadcast]);

  // Handle refresh after conflict
  const handleConflictRefresh = useCallback(() => {
    clearConflict();
    setHasExternalConflict(false);
    router.refresh();
  }, [clearConflict, router]);

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
      toggleBlockVisibility,
      setHoveredBlock,
      moveBlockUp,
      moveBlockDown,
      updateStyle,
      applyStylePreset,
      setFitToOnePage,
      autoFitStatus,
      autoFitReductions,
      save,
      isSaving: coordinatorIsSaving || (state.isLoading && isSavingRef.current),
      hasConflict,
      currentVersion,
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
      toggleBlockVisibility,
      setHoveredBlock,
      moveBlockUp,
      moveBlockDown,
      updateStyle,
      applyStylePreset,
      setFitToOnePage,
      autoFitStatus,
      autoFitReductions,
      save,
      coordinatorIsSaving,
      hasConflict,
      currentVersion,
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

      {/* Conflict Modal - blocks interaction when conflict detected */}
      <ConflictModal isOpen={hasConflict} onRefresh={handleConflictRefresh} />
    </BlockEditorContext.Provider>
  );
}
