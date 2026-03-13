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
  useHasConflict,
  useCurrentVersion,
  type BlockEditorContextValue,
} from "./BlockEditorContext";

// Conflict resolution
export { ConflictModal } from "./ConflictModal";

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

// Block editors (Phase 4)
export {
  // Dispatcher
  BlockEditorDispatcher,
  createBlockEditorRenderer,
  // Individual editors
  ContactEditor,
  SummaryEditor,
  ExperienceEditor,
  EducationEditor,
  SkillsEditor,
  CertificationsEditor,
  ProjectsEditor,
  LanguagesEditor,
  VolunteerEditor,
  PublicationsEditor,
  AwardsEditor,
  InterestsEditor,
  ReferencesEditor,
  CoursesEditor,
  MembershipsEditor,
  // Shared form components
  FormInput,
  FormTextarea,
  FormSelect,
  DateInput,
  TagInput,
  BulletList,
  EntryList,
} from "./blocks";

// Editor layout components (Phase 6)
export { EditorLayout } from "./EditorLayout";
export { EditorHeader } from "./EditorHeader";
export { EditorToolbar } from "./EditorToolbar";
export { ControlPanel } from "./ControlPanel";
export { ParseResumeButton } from "./ParseResumeButton";

// Tab components
export {
  AIChatTab,
  ATSEvaluationTab,
  FormattingTab,
  SectionDraggerTab,
} from "./tabs";

// Style panel components (Phase 7)
export {
  AutoFitToggle,
  useAutoFitBlocks,
  type AutoFitToggleProps,
  type AutoFitStatus,
  type AutoFitState,
  type AutoFitReduction,
  type UseAutoFitBlocksOptions,
  type UseAutoFitBlocksResult,
} from "./style";
