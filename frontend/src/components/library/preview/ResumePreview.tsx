"use client";

import { useRef, useState, useMemo, useEffect, forwardRef, useImperativeHandle } from "react";
import type { ResumePreviewProps } from "./types";
import { PAGE_DIMENSIONS } from "./types";
import { computePreviewStyles } from "./previewStyles";
import { BlockRenderer } from "./BlockRenderer";
import { InteractiveBlockRenderer } from "./InteractiveBlockRenderer";

/**
 * Ref handle exposed by ResumePreview for external access to internal elements
 */
export interface ResumePreviewHandle {
  /** Reference to the page container element for height measurement */
  getPageElement: () => HTMLDivElement | null;
  /** Current scale factor being applied */
  getScale: () => number;
}

/**
 * ResumePreview - Main preview component for block-based resumes
 *
 * Features:
 * - Page dimensions (8.5" x 11" letter size)
 * - Live updates from blocks array
 * - Click-to-select blocks (for editor integration)
 * - Auto-scaling to fit container width
 * - Style settings applied (font family, sizes, spacing)
 * - Interactive mode with hover controls for reordering
 */
export const ResumePreview = forwardRef<ResumePreviewHandle, ResumePreviewProps>(
  function ResumePreview(
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
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const pageRef = useRef<HTMLDivElement>(null);
    const [autoScale, setAutoScale] = useState(1);

    // Use external scale if provided, otherwise auto-scale
    const scale = externalScale ?? autoScale;

    // Expose refs via useImperativeHandle
    useImperativeHandle(ref, () => ({
      getPageElement: () => pageRef.current,
      getScale: () => scale,
    }));

    // Compute CSS styles from BlockEditorStyle
    const computedStyles = useMemo(() => computePreviewStyles(style), [style]);

    // Sort blocks by order and filter out hidden blocks
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

    // Auto-scale to fit container width
    useEffect(() => {
      if (externalScale !== undefined) return; // Skip if external scale provided
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

    // Calculate padding - add extra left padding for interactive controls
    const leftPadding = interactive
      ? `calc(${computedStyles.paddingLeft} + 32px)`
      : computedStyles.paddingLeft;

    // Empty state - no blocks at all
    if (blocks.length === 0) {
      return (
        <div
          ref={containerRef}
          className={`resume-preview-container flex flex-col items-center ${className ?? ""}`}
        >
          <div
            ref={pageRef}
            data-testid="resume-page"
            className={`preview-page bg-white ${showPageBorder ? "shadow-lg rounded-sm border border-border" : ""}`}
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
      );
    }

    // All sections hidden state
    if (sortedBlocks.length === 0) {
      return (
        <div
          ref={containerRef}
          className={`resume-preview-container flex flex-col items-center ${className ?? ""}`}
        >
          <div
            ref={pageRef}
            data-testid="resume-page"
            className={`preview-page bg-white ${showPageBorder ? "shadow-lg rounded-sm border border-border" : ""}`}
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
      );
    }

    return (
      <div
        ref={containerRef}
        className={`resume-preview-container flex flex-col items-center ${className ?? ""}`}
      >
        <div
          ref={pageRef}
          data-testid="resume-page"
          className={`preview-page bg-white ${showPageBorder ? "shadow-lg rounded-sm border border-border" : ""}`}
          style={{
            width: PAGE_DIMENSIONS.WIDTH,
            minHeight: PAGE_DIMENSIONS.HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: "top center",
            paddingTop: computedStyles.paddingTop,
            paddingBottom: computedStyles.paddingBottom,
            paddingLeft: leftPadding,
            paddingRight: computedStyles.paddingRight,
            fontFamily: computedStyles.fontFamily,
          }}
        >
          {sortedBlocks.map((block) => {
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
);

/**
 * ResumePreviewStandalone - Preview without auto-scaling
 *
 * Useful for print/export scenarios where exact dimensions matter.
 */
export function ResumePreviewStandalone({
  blocks,
  style,
  className,
}: Omit<ResumePreviewProps, "activeBlockId" | "onBlockClick" | "scale" | "showPageBorder">) {
  const computedStyles = useMemo(() => computePreviewStyles(style), [style]);

  const sortedBlocks = useMemo(
    () =>
      [...blocks]
        .filter((block) => !block.isHidden)
        .sort((a, b) => a.order - b.order),
    [blocks]
  );

  return (
    <div
      className={`preview-page bg-white ${className ?? ""}`}
      style={{
        width: PAGE_DIMENSIONS.WIDTH,
        minHeight: PAGE_DIMENSIONS.HEIGHT,
        paddingTop: computedStyles.paddingTop,
        paddingBottom: computedStyles.paddingBottom,
        paddingLeft: computedStyles.paddingLeft,
        paddingRight: computedStyles.paddingRight,
        fontFamily: computedStyles.fontFamily,
      }}
    >
      {sortedBlocks.map((block) => (
        <BlockRenderer
          key={block.id}
          block={block}
          style={computedStyles}
        />
      ))}
    </div>
  );
}
