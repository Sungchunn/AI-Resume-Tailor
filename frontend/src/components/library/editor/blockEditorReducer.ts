/**
 * Block Editor Reducer
 *
 * Handles state mutations for the block-based resume editor.
 * All block operations maintain ordering and update the isDirty flag.
 */

import type {
  AnyResumeBlock,
  BlockContent,
  BlockEditorAction,
  BlockEditorState,
  BlockEditorStyle,
  ResumeBlockType,
} from "@/lib/resume/types";
import {
  insertBlockAfter,
  removeBlock,
  reorderBlocks,
  updateBlockContent,
} from "@/lib/resume/transforms";
import { createDefaultBlock } from "@/lib/resume/defaults";

/**
 * Block editor reducer
 * Handles all state transitions for the block editor
 */
export function blockEditorReducer(
  state: BlockEditorState,
  action: BlockEditorAction
): BlockEditorState {
  switch (action.type) {
    case "SET_BLOCKS":
      return {
        ...state,
        blocks: action.payload,
        isDirty: true,
      };

    case "ADD_BLOCK": {
      const { blockType, afterId } = action.payload;
      const newBlocks = insertBlockAfter(state.blocks, blockType, afterId);
      // Find the newly added block to set it as active
      const newBlock = newBlocks.find(
        (b) => !state.blocks.some((existing) => existing.id === b.id)
      );
      return {
        ...state,
        blocks: newBlocks,
        activeBlockId: newBlock?.id ?? state.activeBlockId,
        isDirty: true,
      };
    }

    case "REMOVE_BLOCK": {
      const { id } = action.payload;
      const newBlocks = removeBlock(state.blocks, id);
      // Clear active block if it was removed
      const newActiveId =
        state.activeBlockId === id ? null : state.activeBlockId;
      return {
        ...state,
        blocks: newBlocks,
        activeBlockId: newActiveId,
        isDirty: true,
      };
    }

    case "REORDER_BLOCKS": {
      const { activeId, overId } = action.payload;
      if (activeId === overId) {
        return state;
      }
      const newBlocks = reorderBlocks(state.blocks, activeId, overId);
      return {
        ...state,
        blocks: newBlocks,
        isDirty: true,
      };
    }

    case "UPDATE_BLOCK": {
      const { id, content } = action.payload;
      const newBlocks = updateBlockContent(state.blocks, id, content);
      return {
        ...state,
        blocks: newBlocks,
        isDirty: true,
      };
    }

    case "SET_ACTIVE_BLOCK":
      return {
        ...state,
        activeBlockId: action.payload,
      };

    case "SET_HOVERED_BLOCK":
      return {
        ...state,
        hoveredBlockId: action.payload,
      };

    case "MOVE_BLOCK_UP": {
      const blockId = action.payload;
      const blockIndex = state.blocks.findIndex((b) => b.id === blockId);
      if (blockIndex <= 0) return state; // Can't move up if first or not found

      // Get the block above (by order, not array index)
      const sortedBlocks = [...state.blocks].sort((a, b) => a.order - b.order);
      const sortedIndex = sortedBlocks.findIndex((b) => b.id === blockId);
      if (sortedIndex <= 0) return state;

      const blockAbove = sortedBlocks[sortedIndex - 1];
      const newBlocks = reorderBlocks(state.blocks, blockId, blockAbove.id);
      return {
        ...state,
        blocks: newBlocks,
        isDirty: true,
      };
    }

    case "MOVE_BLOCK_DOWN": {
      const blockId = action.payload;
      const sortedBlocks = [...state.blocks].sort((a, b) => a.order - b.order);
      const sortedIndex = sortedBlocks.findIndex((b) => b.id === blockId);
      if (sortedIndex === -1 || sortedIndex >= sortedBlocks.length - 1)
        return state; // Can't move down if last or not found

      const blockBelow = sortedBlocks[sortedIndex + 1];
      const newBlocks = reorderBlocks(state.blocks, blockId, blockBelow.id);
      return {
        ...state,
        blocks: newBlocks,
        isDirty: true,
      };
    }

    case "TOGGLE_COLLAPSE": {
      const { id } = action.payload;
      const newBlocks = state.blocks.map((block) =>
        block.id === id
          ? ({ ...block, isCollapsed: !block.isCollapsed } as AnyResumeBlock)
          : block
      );
      return {
        ...state,
        blocks: newBlocks,
      };
    }

    case "TOGGLE_VISIBILITY": {
      const { id } = action.payload;
      const newBlocks = state.blocks.map((block) =>
        block.id === id
          ? ({ ...block, isHidden: !block.isHidden } as AnyResumeBlock)
          : block
      );
      return {
        ...state,
        blocks: newBlocks,
        isDirty: true,
      };
    }

    case "SET_STYLE":
      return {
        ...state,
        style: { ...state.style, ...action.payload },
        isDirty: true,
      };

    case "SET_FIT_TO_ONE_PAGE": {
      const enabled = action.payload;
      if (enabled && !state.fitToOnePage) {
        // Enabling: capture current style BEFORE any adjustments
        return {
          ...state,
          fitToOnePage: true,
          preAutoFitStyle: { ...state.style },
        };
      } else if (!enabled && state.fitToOnePage) {
        // Disabling: restore original style
        return {
          ...state,
          fitToOnePage: false,
          style: state.preAutoFitStyle ?? state.style,
          preAutoFitStyle: null,
          isDirty: true,
        };
      }
      return { ...state, fitToOnePage: enabled };
    }

    case "SET_DIRTY":
      return {
        ...state,
        isDirty: action.payload,
      };

    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.payload,
      };

    case "SET_ERROR":
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };

    case "RESET":
      return {
        ...action.payload,
        preAutoFitStyle: null,
      };

    default:
      return state;
  }
}

/**
 * Action creators for cleaner dispatch calls
 */
export const blockEditorActions = {
  setBlocks: (blocks: AnyResumeBlock[]): BlockEditorAction => ({
    type: "SET_BLOCKS",
    payload: blocks,
  }),

  addBlock: (
    blockType: ResumeBlockType,
    afterId?: string
  ): BlockEditorAction => ({
    type: "ADD_BLOCK",
    payload: { blockType, afterId },
  }),

  removeBlock: (id: string): BlockEditorAction => ({
    type: "REMOVE_BLOCK",
    payload: { id },
  }),

  reorderBlocks: (activeId: string, overId: string): BlockEditorAction => ({
    type: "REORDER_BLOCKS",
    payload: { activeId, overId },
  }),

  updateBlock: (id: string, content: BlockContent): BlockEditorAction => ({
    type: "UPDATE_BLOCK",
    payload: { id, content },
  }),

  setActiveBlock: (id: string | null): BlockEditorAction => ({
    type: "SET_ACTIVE_BLOCK",
    payload: id,
  }),

  setHoveredBlock: (id: string | null): BlockEditorAction => ({
    type: "SET_HOVERED_BLOCK",
    payload: id,
  }),

  moveBlockUp: (id: string): BlockEditorAction => ({
    type: "MOVE_BLOCK_UP",
    payload: id,
  }),

  moveBlockDown: (id: string): BlockEditorAction => ({
    type: "MOVE_BLOCK_DOWN",
    payload: id,
  }),

  toggleCollapse: (id: string): BlockEditorAction => ({
    type: "TOGGLE_COLLAPSE",
    payload: { id },
  }),

  toggleVisibility: (id: string): BlockEditorAction => ({
    type: "TOGGLE_VISIBILITY",
    payload: { id },
  }),

  setStyle: (style: Partial<BlockEditorStyle>): BlockEditorAction => ({
    type: "SET_STYLE",
    payload: style,
  }),

  setFitToOnePage: (enabled: boolean): BlockEditorAction => ({
    type: "SET_FIT_TO_ONE_PAGE",
    payload: enabled,
  }),

  setDirty: (isDirty: boolean): BlockEditorAction => ({
    type: "SET_DIRTY",
    payload: isDirty,
  }),

  setLoading: (isLoading: boolean): BlockEditorAction => ({
    type: "SET_LOADING",
    payload: isLoading,
  }),

  setError: (error: string | null): BlockEditorAction => ({
    type: "SET_ERROR",
    payload: error,
  }),

  reset: (state: BlockEditorState): BlockEditorAction => ({
    type: "RESET",
    payload: state,
  }),
};
