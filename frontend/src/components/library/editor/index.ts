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
