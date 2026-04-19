/**
 * Inline Editing Components
 *
 * Provides infrastructure for inline editing within the resume preview.
 * Each inline component (InlinePlainText, InlineRichText, InlineSkillsList)
 * manages its own editor instance and commits on blur.
 *
 * Usage:
 * ```tsx
 * <InlinePlainText
 *   elementId="exp-1:entry-0:title"
 *   value={title}
 *   onCommit={(newValue) => updateTitle(newValue)}
 * />
 *
 * <InlineRichText
 *   elementId="exp-1:entry-0:bullet-0"
 *   value={bulletContent}
 *   onCommit={(newValue) => updateBullet(newValue)}
 *   showToolbar={true}
 * />
 * ```
 */

// Context and hooks (simplified - for coordination only)
export {
  InlineEditProvider,
  useInlineEdit,
  useInlineEditOptional,
} from "./InlineEditContext";
export type {
  InlineEditContextValue,
  InlineEditProviderProps,
} from "./InlineEditContext";

// Toolbar
export { FloatingToolbar } from "./FloatingToolbar";
export type { FloatingToolbarProps } from "./FloatingToolbar";

// Inline editor components
export { InlinePlainText } from "./InlinePlainText";
export type { InlinePlainTextProps } from "./InlinePlainText";

export { InlineRichText } from "./InlineRichText";
export type { InlineRichTextProps } from "./InlineRichText";

export { InlineSkillsList } from "./InlineSkillsList";
export type { InlineSkillsListProps } from "./InlineSkillsList";

export { RewritableBulletItem } from "./RewritableBulletItem";

export { InlineRewriteDropdown } from "./InlineRewriteDropdown";
