/**
 * Inline Editing Components
 *
 * Provides infrastructure for inline editing within the resume preview.
 * Uses a single TipTap editor instance that repositions to the active element.
 *
 * Usage:
 * ```tsx
 * <InlineEditProvider onCommit={handleCommit}>
 *   <div ref={containerRef}>
 *     <EditableText
 *       elementId="exp-1:entry-0:title"
 *       value={title}
 *       onCommit={(newValue) => updateTitle(newValue)}
 *     />
 *   </div>
 *   <InlineEditManager containerRef={containerRef} />
 * </InlineEditProvider>
 * ```
 */

// Context and hooks
export {
  InlineEditProvider,
  useInlineEdit,
  useInlineEditOptional,
} from "./InlineEditContext";
export type {
  InlineEditContextValue,
  InlineEditProviderProps,
} from "./InlineEditContext";

// Manager (floating editor)
export { InlineEditManager } from "./InlineEditManager";
export type { InlineEditManagerProps } from "./InlineEditManager";

// Toolbar
export { FloatingToolbar } from "./FloatingToolbar";
export type { FloatingToolbarProps } from "./FloatingToolbar";

// Editable components (legacy - to be removed in phase 4)
export { EditableText } from "./EditableText";
export type { EditableTextProps } from "./EditableText";

export { EditableRichText } from "./EditableRichText";
export type { EditableRichTextProps } from "./EditableRichText";

export { EditableBullet } from "./EditableBullet";
export type { EditableBulletProps } from "./EditableBullet";

// Inline editor components (new - phase 1)
export { InlinePlainText } from "./InlinePlainText";
export type { InlinePlainTextProps } from "./InlinePlainText";

export { InlineRichText } from "./InlineRichText";
export type { InlineRichTextProps } from "./InlineRichText";

export { InlineSkillsList } from "./InlineSkillsList";
export type { InlineSkillsListProps } from "./InlineSkillsList";
