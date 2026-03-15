"use client";

/**
 * PreviewPage - Individual page container for paginated resume preview
 *
 * Features:
 * - Fixed 1056px height (not minHeight) for accurate WYSIWYG
 * - Page number indicator (hidden during print/export)
 * - Oversized content warning
 * - Interactive block rendering with reorder controls
 */

import { forwardRef, useMemo } from "react";
import type { AnyResumeBlock } from "@/lib/resume/types";
import type { ComputedPreviewStyle } from "./types";
import { PAGE_DIMENSIONS } from "./types";
import { BlockRenderer } from "./BlockRenderer";
import { InteractiveBlockRenderer } from "./InteractiveBlockRenderer";

export interface PreviewPageProps {
  /** 1-indexed page number */
  pageNumber: number;
  /** Blocks assigned to this page */
  blocks: AnyResumeBlock[];
  /** Computed CSS styles from BlockEditorStyle */
  computedStyles: ComputedPreviewStyle;
  /** Whether this page contains oversized content */
  isOversized?: boolean;
  /** Show page border and shadow */
  showPageBorder?: boolean;
  /** Additional CSS class names */
  className?: string;

  // Interactive props
  /** Currently active/selected block ID */
  activeBlockId?: string | null;
  /** Currently hovered block ID */
  hoveredBlockId?: string | null;
  /** Callback when block is clicked */
  onBlockClick?: (blockId: string) => void;
  /** Callback when block hover state changes */
  onBlockHover?: (blockId: string | null) => void;
  /** Callback to move block up in order */
  onMoveBlockUp?: (blockId: string) => void;
  /** Callback to move block down in order */
  onMoveBlockDown?: (blockId: string) => void;
  /** Enable interactive mode with hover controls */
  interactive?: boolean;

  // Movement constraints (across all pages)
  /** Check if a block can be moved up (considers global order) */
  canMoveUp: (blockId: string) => boolean;
  /** Check if a block can be moved down (considers global order) */
  canMoveDown: (blockId: string) => boolean;
}

/**
 * PreviewPage renders a single page container with fixed dimensions
 * and its assigned blocks.
 */
export const PreviewPage = forwardRef<HTMLDivElement, PreviewPageProps>(
  function PreviewPage(
    {
      pageNumber,
      blocks,
      computedStyles,
      isOversized = false,
      showPageBorder = true,
      className,
      activeBlockId,
      hoveredBlockId,
      onBlockClick,
      onBlockHover,
      onMoveBlockUp,
      onMoveBlockDown,
      interactive = false,
      canMoveUp,
      canMoveDown,
    },
    ref
  ) {
    // Use standard left padding - interactive controls are absolutely positioned
    // and don't require extra padding space
    const leftPadding = computedStyles.paddingLeft;

    // Page container styles
    const pageStyles = useMemo(
      () => ({
        width: PAGE_DIMENSIONS.WIDTH,
        height: PAGE_DIMENSIONS.HEIGHT, // Fixed height, NOT minHeight
        overflow: "hidden" as const,
        position: "relative" as const,
      }),
      []
    );

    // Content area styles
    const contentStyles = useMemo(
      () => ({
        paddingTop: computedStyles.paddingTop,
        paddingBottom: computedStyles.paddingBottom,
        paddingLeft: leftPadding,
        paddingRight: computedStyles.paddingRight,
        fontFamily: computedStyles.fontFamily,
        height: "100%",
      }),
      [computedStyles, leftPadding]
    );

    // Visual treatment classes
    const pageClasses = [
      "preview-page bg-white",
      showPageBorder ? "shadow-lg rounded-sm border border-border" : "",
      className ?? "",
    ]
      .filter(Boolean)
      .join(" ");

    // Empty page state
    if (blocks.length === 0) {
      return (
        <div
          ref={ref}
          data-testid={`resume-page-${pageNumber}`}
          data-page-number={pageNumber}
          className={pageClasses}
          style={pageStyles}
        >
          <div style={contentStyles}>
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground/60">
              <p className="text-lg">
                {pageNumber === 1 ? "All sections hidden" : "Empty page"}
              </p>
              {pageNumber === 1 && (
                <p className="text-sm mt-1">
                  Toggle visibility in the Sections tab
                </p>
              )}
            </div>
          </div>

          {/* Page number indicator - hidden during print/export */}
          <PageNumberIndicator pageNumber={pageNumber} />
        </div>
      );
    }

    return (
      <div
        ref={ref}
        data-testid={`resume-page-${pageNumber}`}
        data-page-number={pageNumber}
        className={pageClasses}
        style={pageStyles}
      >
        <div style={contentStyles}>
          {blocks.map((block) => {
            const blockCanMoveUp = canMoveUp(block.id);
            const blockCanMoveDown = canMoveDown(block.id);

            if (interactive) {
              return (
                <InteractiveBlockRenderer
                  key={block.id}
                  block={block}
                  style={computedStyles}
                  isActive={activeBlockId === block.id}
                  isHovered={hoveredBlockId === block.id}
                  canMoveUp={blockCanMoveUp}
                  canMoveDown={blockCanMoveDown}
                  onSelect={
                    onBlockClick ? () => onBlockClick(block.id) : undefined
                  }
                  onHover={(isHovered) =>
                    onBlockHover?.(isHovered ? block.id : null)
                  }
                  onMoveUp={
                    onMoveBlockUp ? () => onMoveBlockUp(block.id) : undefined
                  }
                  onMoveDown={
                    onMoveBlockDown ? () => onMoveBlockDown(block.id) : undefined
                  }
                />
              );
            }

            return (
              <BlockRenderer
                key={block.id}
                block={block}
                style={computedStyles}
                isActive={activeBlockId === block.id}
                onClick={
                  onBlockClick ? () => onBlockClick(block.id) : undefined
                }
              />
            );
          })}
        </div>

        {/* Page number indicator - hidden during print/export */}
        <PageNumberIndicator pageNumber={pageNumber} />

        {/* Oversized content warning */}
        {isOversized && <OversizedWarning />}
      </div>
    );
  }
);

/**
 * Page number indicator displayed in the top-right corner
 * Hidden during print/export via data-print-hidden attribute
 */
function PageNumberIndicator({ pageNumber }: { pageNumber: number }) {
  return (
    <div
      data-print-hidden="true"
      className="absolute top-2 right-2 text-xs text-zinc-100 bg-zinc-700 border border-zinc-600 px-2 py-1 rounded-md shadow-sm"
    >
      Page {pageNumber}
    </div>
  );
}

/**
 * Warning banner shown when page content exceeds page height
 */
function OversizedWarning() {
  return (
    <div
      data-print-hidden="true"
      className="absolute bottom-0 left-0 right-0 bg-amber-100 border-t border-amber-300 text-amber-800 text-xs px-2 py-1 flex items-center gap-1"
    >
      <span className="text-amber-600">⚠️</span>
      <span>Content exceeds page height</span>
    </div>
  );
}
