/**
 * Block Editor Components
 *
 * Exports for the block-based resume editor.
 */

// Context and hooks
export {
  BlockEditorContext,
  useBlockEditor,
  useBlocks,
  useActiveBlock,
  useBlockEditorStyle,
  useHasUnsavedChanges,
  type BlockEditorContextValue,
} from "./BlockEditorContext";

// Provider
export {
  BlockEditorProvider,
  type BlockEditorProviderProps,
} from "./BlockEditorProvider";

// Reducer and actions
export { blockEditorReducer, blockEditorActions } from "./blockEditorReducer";

// Block list components (Phase 3)
export { BlockList } from "./BlockList";
export { BlockItem } from "./BlockItem";
export { BlockTypeMenu } from "./BlockTypeMenu";
export { BlockDragOverlay } from "./BlockDragOverlay";
export { BlockIcon } from "./BlockIcon";
