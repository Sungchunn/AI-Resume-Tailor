"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import type { ResumePreviewProps } from "./types";
import { PAGE_DIMENSIONS } from "./types";
import { computePreviewStyles } from "./previewStyles";
import { BlockRenderer } from "./BlockRenderer";

/**
 * ResumePreview - Main preview component for block-based resumes
 *
 * Features:
 * - Page dimensions (8.5" x 11" letter size)
 * - Live updates from blocks array
 * - Click-to-select blocks (for editor integration)
 * - Auto-scaling to fit container width
 * - Style settings applied (font family, sizes, spacing)
 */
export function ResumePreview({
  blocks,
  style,
  activeBlockId,
  onBlockClick,
  className,
  scale: externalScale,
  showPageBorder = true,
}: ResumePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScale, setAutoScale] = useState(1);

  // Use external scale if provided, otherwise auto-scale
  const scale = externalScale ?? autoScale;

  // Compute CSS styles from BlockEditorStyle
  const computedStyles = useMemo(() => computePreviewStyles(style), [style]);

  // Sort blocks by order
  const sortedBlocks = useMemo(
    () => [...blocks].sort((a, b) => a.order - b.order),
    [blocks]
  );

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

  // Empty state
  if (blocks.length === 0) {
    return (
      <div
        ref={containerRef}
        className={`resume-preview-container flex flex-col items-center ${className ?? ""}`}
      >
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
    );
  }

  return (
    <div
      ref={containerRef}
      className={`resume-preview-container flex flex-col items-center ${className ?? ""}`}
    >
      <div
        className={`preview-page bg-card ${showPageBorder ? "shadow-lg rounded-sm border border-border" : ""}`}
        style={{
          width: PAGE_DIMENSIONS.WIDTH,
          minHeight: PAGE_DIMENSIONS.HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top center",
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
            isActive={activeBlockId === block.id}
            onClick={onBlockClick ? () => onBlockClick(block.id) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

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
    () => [...blocks].sort((a, b) => a.order - b.order),
    [blocks]
  );

  return (
    <div
      className={`preview-page bg-card ${className ?? ""}`}
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
