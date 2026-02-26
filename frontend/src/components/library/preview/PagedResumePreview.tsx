"use client";

import { useRef, useState, useMemo, useEffect, useCallback } from "react";
import type { AnyResumeBlock, BlockEditorStyle } from "@/lib/resume/types";
import { PAGE_DIMENSIONS } from "./types";
import { computePreviewStyles } from "./previewStyles";
import { BlockRenderer } from "./BlockRenderer";
import { InteractiveBlockRenderer } from "./InteractiveBlockRenderer";
import { useBlockPageBreaks } from "./useBlockPageBreaks";

interface PagedResumePreviewProps {
  /** Blocks to render */
  blocks: AnyResumeBlock[];
  /** Style configuration */
  style: BlockEditorStyle;
  /** Currently active/selected block ID */
  activeBlockId?: string | null;
  /** Currently hovered block ID (for interactive mode) */
  hoveredBlockId?: string | null;
  /** Callback when a block is clicked */
  onBlockClick?: (blockId: string) => void;
  /** Callback when a block hover state changes */
  onBlockHover?: (blockId: string | null) => void;
  /** Callback to move block up */
  onMoveBlockUp?: (blockId: string) => void;
  /** Callback to move block down */
  onMoveBlockDown?: (blockId: string) => void;
  /** Enable interactive mode with hover controls */
  interactive?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Override auto-scale with fixed scale */
  scale?: number;
  /** Whether to show page border/shadow */
  showPageBorder?: boolean;
}

/**
 * PreviewPage - Renders a single page of the resume
 */
function PreviewPage({
  pageNumber,
  blockIds,
  allBlocks,
  sortedBlocks,
  computedStyles,
  activeBlockId,
  hoveredBlockId,
  onBlockClick,
  onBlockHover,
  onMoveBlockUp,
  onMoveBlockDown,
  interactive,
  showPageBorder,
  scale,
}: {
  pageNumber: number;
  blockIds: string[];
  allBlocks: AnyResumeBlock[];
  sortedBlocks: AnyResumeBlock[];
  computedStyles: ReturnType<typeof computePreviewStyles>;
  activeBlockId?: string | null;
  hoveredBlockId?: string | null;
  onBlockClick?: (blockId: string) => void;
  onBlockHover?: (blockId: string | null) => void;
  onMoveBlockUp?: (blockId: string) => void;
  onMoveBlockDown?: (blockId: string) => void;
  interactive?: boolean;
  showPageBorder: boolean;
  scale: number;
}) {
  // Create a map for quick block lookup
  const blockMap = useMemo(() => {
    const map = new Map<string, AnyResumeBlock>();
    for (const block of allBlocks) {
      map.set(block.id, block);
    }
    return map;
  }, [allBlocks]);

  // Get blocks for this page in order
  const pageBlocks = useMemo(() => {
    return blockIds
      .map((id) => blockMap.get(id))
      .filter((block): block is AnyResumeBlock => block !== undefined);
  }, [blockIds, blockMap]);

  // Create a sorted index map for determining move capabilities
  const sortedIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    sortedBlocks.forEach((block, index) => {
      map.set(block.id, index);
    });
    return map;
  }, [sortedBlocks]);

  return (
    <div className="relative">
      {/* Page number indicator */}
      <div className="absolute -top-6 left-0 right-0 flex justify-center">
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
          Page {pageNumber}
        </span>
      </div>

      {/* Page content */}
      <div
        className={`preview-page bg-card ${showPageBorder ? "shadow-lg rounded-sm border border-border" : ""}`}
        style={{
          width: PAGE_DIMENSIONS.WIDTH,
          minHeight: PAGE_DIMENSIONS.HEIGHT,
          height: PAGE_DIMENSIONS.HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top center",
          paddingTop: computedStyles.paddingTop,
          paddingBottom: computedStyles.paddingBottom,
          paddingLeft: interactive ? `calc(${computedStyles.paddingLeft} + 32px)` : computedStyles.paddingLeft,
          paddingRight: computedStyles.paddingRight,
          fontFamily: computedStyles.fontFamily,
          overflow: "hidden",
        }}
      >
        {pageBlocks.map((block) => {
          const sortedIndex = sortedIndexMap.get(block.id) ?? -1;
          const canMoveUp = sortedIndex > 0;
          const canMoveDown = sortedIndex < sortedBlocks.length - 1;

          if (interactive) {
            return (
              <InteractiveBlockRenderer
                key={block.id}
                block={block}
                style={computedStyles}
                isActive={activeBlockId === block.id}
                isHovered={hoveredBlockId === block.id}
                canMoveUp={canMoveUp}
                canMoveDown={canMoveDown}
                onSelect={onBlockClick ? () => onBlockClick(block.id) : undefined}
                onHover={(isHovered) => onBlockHover?.(isHovered ? block.id : null)}
                onMoveUp={onMoveBlockUp ? () => onMoveBlockUp(block.id) : undefined}
                onMoveDown={onMoveBlockDown ? () => onMoveBlockDown(block.id) : undefined}
              />
            );
          }

          return (
            <BlockRenderer
              key={block.id}
              block={block}
              style={computedStyles}
              isActive={activeBlockId === block.id}
              onClick={onBlockClick ? () => onBlockClick(block.id) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * PagedResumePreview - Multi-page A4 preview for block-based resumes
 *
 * Features:
 * - Calculates page breaks based on content height
 * - Renders multiple pages with visual separators
 * - Page number indicators
 * - Auto-scaling to fit container width
 * - Click-to-select blocks (for editor integration)
 * - Interactive mode with hover controls for reordering
 */
export function PagedResumePreview({
  blocks,
  style,
  activeBlockId,
  hoveredBlockId,
  onBlockClick,
  onBlockHover,
  onMoveBlockUp,
  onMoveBlockDown,
  interactive = false,
  className,
  scale: externalScale,
  showPageBorder = true,
}: PagedResumePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScale, setAutoScale] = useState(1);

  // Use external scale if provided, otherwise auto-scale
  const scale = externalScale ?? autoScale;

  // Compute CSS styles from BlockEditorStyle
  const computedStyles = useMemo(() => computePreviewStyles(style), [style]);

  // Sort blocks by order and filter out hidden blocks (for move capability checks)
  const sortedBlocks = useMemo(
    () =>
      [...blocks]
        .filter((block) => !block.isHidden)
        .sort((a, b) => a.order - b.order),
    [blocks]
  );

  // Calculate page breaks
  const { pages, totalPages, exceedsOnePage } = useBlockPageBreaks({
    blocks,
    style,
  });

  // Auto-scale to fit container width
  useEffect(() => {
    if (externalScale !== undefined) return;
    if (!containerRef.current) return;

    const updateScale = () => {
      const containerWidth = containerRef.current?.clientWidth ?? PAGE_DIMENSIONS.WIDTH;
      // Leave some padding (40px total)
      const newScale = Math.min(1, (containerWidth - 40) / PAGE_DIMENSIONS.WIDTH);
      setAutoScale(newScale);
    };

    updateScale();
    const resizeObserver = new ResizeObserver(updateScale);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, [externalScale]);

  // Empty state - no blocks at all
  if (blocks.length === 0) {
    return (
      <div
        ref={containerRef}
        className={`paged-resume-preview flex flex-col items-center ${className ?? ""}`}
      >
        <div className="relative mt-6">
          <div className="absolute -top-6 left-0 right-0 flex justify-center">
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
              Page 1
            </span>
          </div>
          <div
            className={`bg-card ${showPageBorder ? "shadow-lg rounded-sm border border-border" : ""}`}
            style={{
              width: PAGE_DIMENSIONS.WIDTH,
              minHeight: PAGE_DIMENSIONS.HEIGHT,
              transform: `scale(${scale})`,
              transformOrigin: "top center",
              padding: computedStyles.paddingTop,
            }}
          >
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground/60">
              <p className="text-lg">No content yet</p>
              <p className="text-sm mt-1">Add sections to build your resume</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // All sections hidden state (sortedBlocks already filters hidden blocks)
  if (sortedBlocks.length === 0) {
    return (
      <div
        ref={containerRef}
        className={`paged-resume-preview flex flex-col items-center ${className ?? ""}`}
      >
        <div className="relative mt-6">
          <div className="absolute -top-6 left-0 right-0 flex justify-center">
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
              Page 1
            </span>
          </div>
          <div
            className={`bg-card ${showPageBorder ? "shadow-lg rounded-sm border border-border" : ""}`}
            style={{
              width: PAGE_DIMENSIONS.WIDTH,
              minHeight: PAGE_DIMENSIONS.HEIGHT,
              transform: `scale(${scale})`,
              transformOrigin: "top center",
              padding: computedStyles.paddingTop,
            }}
          >
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground/60">
              <p className="text-lg">All sections hidden</p>
              <p className="text-sm mt-1">Toggle visibility in the Sections tab</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Calculate scaled dimensions for spacing
  const scaledPageHeight = PAGE_DIMENSIONS.HEIGHT * scale;
  const pageGap = 32; // Gap between pages in pixels

  return (
    <div
      ref={containerRef}
      className={`paged-resume-preview flex flex-col items-center ${className ?? ""}`}
    >
      {/* Page count indicator */}
      {exceedsOnePage && (
        <div className="mb-2 text-xs text-muted-foreground">
          {totalPages} pages
        </div>
      )}

      {/* Pages */}
      <div
        className="flex flex-col items-center"
        style={{ gap: `${pageGap}px` }}
      >
        {pages.map((page) => (
          <div
            key={page.pageNumber}
            className="mt-6"
            style={{
              height: scaledPageHeight,
              marginBottom: page.pageNumber < totalPages ? 0 : undefined,
            }}
          >
            <PreviewPage
              pageNumber={page.pageNumber}
              blockIds={page.blockIds}
              allBlocks={blocks}
              sortedBlocks={sortedBlocks}
              computedStyles={computedStyles}
              activeBlockId={activeBlockId}
              hoveredBlockId={hoveredBlockId}
              onBlockClick={onBlockClick}
              onBlockHover={onBlockHover}
              onMoveBlockUp={onMoveBlockUp}
              onMoveBlockDown={onMoveBlockDown}
              interactive={interactive}
              showPageBorder={showPageBorder}
              scale={scale}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
