"use client";

/**
 * PaginatedResumePreview - Paginated preview with multiple page containers
 *
 * Features:
 * - Renders distinct page containers (each 1056px tall) with gaps
 * - True WYSIWYG: what you see matches PDF output
 * - Auto-scaling to fit container width
 * - Interactive block editing with hover controls
 * - Page refs exposed for PDF export
 *
 * Usage:
 * ```tsx
 * const previewRef = useRef<PaginatedResumePreviewHandle>(null);
 *
 * <PaginatedResumePreview
 *   ref={previewRef}
 *   blocks={blocks}
 *   style={style}
 *   interactive={true}
 *   pageGap={24}
 * />
 *
 * // For export:
 * const pages = previewRef.current?.getPageElements();
 * ```
 */

import {
  useRef,
  useState,
  useMemo,
  useEffect,
  forwardRef,
  useImperativeHandle,
  Fragment,
} from "react";
import type { ResumePreviewProps } from "./types";
import { PAGE_DIMENSIONS } from "./types";
import { computePreviewStyles } from "./previewStyles";
import { useBlockMeasurement } from "./useBlockMeasurement";
import { useBlockPagination } from "./useBlockPagination";
import { MeasurementContainer } from "./MeasurementContainer";
import { PreviewPage } from "./PreviewPage";

/**
 * Ref handle exposed by PaginatedResumePreview for external access
 */
export interface PaginatedResumePreviewHandle {
  /** Get all page elements for PDF export */
  getPageElements: () => HTMLDivElement[];
  /** Get current scale factor being applied */
  getScale: () => number;
  /** Get total page count */
  getPageCount: () => number;
  /** Check if measurements are ready and pagination is complete */
  isReady: () => boolean;
}

export interface PaginatedResumePreviewProps extends ResumePreviewProps {
  /** Gap between pages in pixels (default: 24) */
  pageGap?: number;
}

/**
 * PaginatedResumePreview renders multiple page containers with accurate
 * pagination based on measured block heights.
 */
export const PaginatedResumePreview = forwardRef<
  PaginatedResumePreviewHandle,
  PaginatedResumePreviewProps
>(function PaginatedResumePreview(
  {
    blocks,
    style,
    activeBlockId,
    onBlockClick,
    className,
    scale: externalScale,
    showPageBorder = true,
    hoveredBlockId,
    onBlockHover,
    onMoveBlockUp,
    onMoveBlockDown,
    interactive = false,
    pageGap = 24,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [autoScale, setAutoScale] = useState(1);

  // Use external scale if provided, otherwise auto-scale
  const scale = externalScale ?? autoScale;

  // 1. Compute CSS styles from BlockEditorStyle
  const computedStyles = useMemo(() => computePreviewStyles(style), [style]);

  // 2. Sort and filter blocks
  const sortedBlocks = useMemo(
    () =>
      [...blocks]
        .filter((block) => !block.isHidden)
        .sort((a, b) => a.order - b.order),
    [blocks]
  );

  // Create sorted index map for determining move capabilities
  const sortedIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    sortedBlocks.forEach((block, index) => {
      map.set(block.id, index);
    });
    return map;
  }, [sortedBlocks]);

  // 3. Measure blocks using the measurement hook
  const { measurements, isReady: measurementsReady, onMeasurementsReady } =
    useBlockMeasurement(blocks, style);

  // 4. Calculate pagination based on measurements
  const { pages, totalPages, isReady, oversizedBlocks } = useBlockPagination(
    blocks,
    style,
    measurements,
    measurementsReady
  );

  // 5. Cleanup stale page refs when page count decreases
  useEffect(() => {
    const currentCount = pages.length;
    for (const [pageNum] of pageRefs.current) {
      if (pageNum > currentCount) {
        pageRefs.current.delete(pageNum);
      }
    }
  }, [pages.length]);

  // 6. Auto-scale calculation
  useEffect(() => {
    if (externalScale !== undefined) return;
    if (!containerRef.current) return;

    const updateScale = () => {
      const containerWidth =
        containerRef.current?.clientWidth ?? PAGE_DIMENSIONS.WIDTH;
      // Leave some padding (20px on each side)
      const newScale = Math.min(1, (containerWidth - 40) / PAGE_DIMENSIONS.WIDTH);
      setAutoScale(newScale);
    };

    updateScale();
    const resizeObserver = new ResizeObserver(updateScale);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, [externalScale]);

  // 7. Expose handle via useImperativeHandle
  useImperativeHandle(ref, () => ({
    getPageElements: () => {
      // Return pages in order
      const elements: HTMLDivElement[] = [];
      for (let i = 1; i <= totalPages; i++) {
        const el = pageRefs.current.get(i);
        if (el) elements.push(el);
      }
      return elements;
    },
    getScale: () => scale,
    getPageCount: () => totalPages,
    isReady: () => isReady,
  }));

  // Movement constraint callbacks for PreviewPage
  const canMoveUp = (blockId: string): boolean => {
    const index = sortedIndexMap.get(blockId);
    return index !== undefined && index > 0;
  };

  const canMoveDown = (blockId: string): boolean => {
    const index = sortedIndexMap.get(blockId);
    return index !== undefined && index < sortedBlocks.length - 1;
  };

  // Calculate total scaled height for container
  const scaledPageHeight = PAGE_DIMENSIONS.HEIGHT * scale;
  const scaledGap = pageGap * scale;
  const totalHeight = isReady
    ? scaledPageHeight * totalPages + scaledGap * Math.max(0, totalPages - 1)
    : scaledPageHeight; // Single skeleton page height when loading

  return (
    <div
      ref={containerRef}
      className={`paginated-preview-container flex flex-col items-center ${className ?? ""}`}
      style={{ minHeight: totalHeight }}
    >
      {/* Hidden measurement container */}
      <MeasurementContainer
        blocks={blocks}
        style={style}
        onMeasurementsReady={onMeasurementsReady}
      />

      {/* Loading state while measuring */}
      {!isReady && (
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top center",
          }}
        >
          <PageSkeleton showPageBorder={showPageBorder} />
        </div>
      )}

      {/* Render pages with gaps */}
      {isReady && (
        <div
          className="pages-wrapper flex flex-col items-center"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top center",
            gap: `${pageGap}px`,
          }}
        >
          {pages.map((page) => (
            <PreviewPage
              key={page.pageNumber}
              ref={(el) => {
                if (el) {
                  pageRefs.current.set(page.pageNumber, el);
                } else {
                  pageRefs.current.delete(page.pageNumber);
                }
              }}
              pageNumber={page.pageNumber}
              blocks={page.blocks}
              computedStyles={computedStyles}
              isOversized={page.blocks.some((b) =>
                oversizedBlocks.includes(b.id)
              )}
              showPageBorder={showPageBorder}
              activeBlockId={activeBlockId}
              hoveredBlockId={hoveredBlockId}
              onBlockClick={onBlockClick}
              onBlockHover={onBlockHover}
              onMoveBlockUp={onMoveBlockUp}
              onMoveBlockDown={onMoveBlockDown}
              interactive={interactive}
              canMoveUp={canMoveUp}
              canMoveDown={canMoveDown}
            />
          ))}
        </div>
      )}
    </div>
  );
});

/**
 * PageSkeleton - Loading state shown while measuring blocks
 */
function PageSkeleton({ showPageBorder = true }: { showPageBorder?: boolean }) {
  return (
    <div
      className={`bg-white ${showPageBorder ? "shadow-lg rounded-sm border border-border" : ""} animate-pulse`}
      style={{
        width: PAGE_DIMENSIONS.WIDTH,
        height: PAGE_DIMENSIONS.HEIGHT,
      }}
      data-testid="page-skeleton"
    >
      <div className="p-8 space-y-4">
        {/* Header skeleton */}
        <div className="h-8 bg-muted rounded w-1/3" />

        {/* Content line skeletons */}
        <div className="h-4 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-5/6" />
        <div className="h-4 bg-muted rounded w-4/6" />

        {/* Section gap */}
        <div className="h-6" />

        {/* Second section */}
        <div className="h-6 bg-muted rounded w-1/4" />
        <div className="h-4 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-4 bg-muted rounded w-5/6" />

        {/* Section gap */}
        <div className="h-6" />

        {/* Third section */}
        <div className="h-6 bg-muted rounded w-1/5" />
        <div className="h-4 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-2/3" />
      </div>
    </div>
  );
}
