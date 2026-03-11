/**
 * Preview Component Types
 *
 * Type definitions for the library resume preview components.
 */

import type { AnyResumeBlock, BlockEditorStyle } from "@/lib/resume/types";

/**
 * Page dimension constants (in pixels at 96 DPI)
 * Standard US Letter size: 8.5" x 11"
 */
export const PAGE_DIMENSIONS = {
  WIDTH: 816, // 8.5 inches * 96 DPI
  HEIGHT: 1056, // 11 inches * 96 DPI
  DPI: 96,
} as const;

/**
 * Computed CSS styles derived from BlockEditorStyle
 */
export interface ComputedPreviewStyle {
  fontFamily: string;
  bodyFontSize: string;
  headingFontSize: string;
  subheadingFontSize: string;
  lineHeight: number;
  sectionGap: string;
  entryGap: string;
  paddingTop: string;
  paddingBottom: string;
  paddingLeft: string;
  paddingRight: string;
}

/**
 * ResumePreview component props
 */
export interface ResumePreviewProps {
  blocks: AnyResumeBlock[];
  style: BlockEditorStyle;
  activeBlockId?: string | null;
  onBlockClick?: (blockId: string) => void;
  className?: string;
  scale?: number;
  showPageBorder?: boolean;
  /** Currently hovered block ID (for interactive mode) */
  hoveredBlockId?: string | null;
  /** Callback when block hover state changes */
  onBlockHover?: (blockId: string | null) => void;
  /** Callback to move block up in order */
  onMoveBlockUp?: (blockId: string) => void;
  /** Callback to move block down in order */
  onMoveBlockDown?: (blockId: string) => void;
  /** Enable interactive mode with hover controls for reordering */
  interactive?: boolean;
}

/**
 * BlockRenderer component props
 */
export interface BlockRendererProps {
  block: AnyResumeBlock;
  style: ComputedPreviewStyle;
  isActive?: boolean;
  onClick?: () => void;
}

/**
 * Individual block preview props (base interface)
 */
export interface BaseBlockPreviewProps<T> {
  content: T;
  style: ComputedPreviewStyle;
}
