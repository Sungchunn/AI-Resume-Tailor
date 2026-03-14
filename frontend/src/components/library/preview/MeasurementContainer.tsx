"use client";

/**
 * MeasurementContainer - Hidden container for measuring block heights
 *
 * Renders blocks in an off-screen container to measure their actual rendered heights.
 * This is used by the pagination system to accurately distribute blocks across pages.
 */

import { useLayoutEffect, useRef, useCallback } from "react";
import type { AnyResumeBlock, BlockEditorStyle } from "@/lib/resume/types";
import { PAGE_DIMENSIONS, type ComputedPreviewStyle } from "./types";
import { computePreviewStyles } from "./previewStyles";
import { BlockRenderer } from "./BlockRenderer";

/**
 * Measurement result for a single block
 */
export interface BlockMeasurement {
  blockId: string;
  height: number; // offsetHeight in pixels
  marginBottom: number; // sectionGap from style (for spacing calculations)
}

interface MeasurementContainerProps {
  blocks: AnyResumeBlock[];
  style: BlockEditorStyle;
  onMeasurementsReady: (measurements: Map<string, BlockMeasurement>) => void;
}

/**
 * MeasurementContainer renders blocks off-screen to measure their heights.
 *
 * Implementation details:
 * 1. Positioned absolutely off-screen (left: -9999px)
 * 2. Matches exact page width (816px) and padding from computePreviewStyles
 * 3. Each block wrapped in a div with data-block-id for querying
 * 4. Uses useLayoutEffect to measure after paint, before browser display
 */
export function MeasurementContainer({
  blocks,
  style,
  onMeasurementsReady,
}: MeasurementContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const computedStyles = computePreviewStyles(style);

  // Measure all blocks after render
  const measureBlocks = useCallback(() => {
    if (!containerRef.current) return;

    const measurements = new Map<string, BlockMeasurement>();
    const blockElements = containerRef.current.querySelectorAll<HTMLDivElement>(
      "[data-block-id]"
    );

    // Parse sectionGap from style (e.g., "8px" -> 8)
    const marginBottom = parseInt(computedStyles.sectionGap, 10) || 0;

    blockElements.forEach((element) => {
      const blockId = element.dataset.blockId;
      if (blockId) {
        measurements.set(blockId, {
          blockId,
          height: element.offsetHeight,
          marginBottom,
        });
      }
    });

    onMeasurementsReady(measurements);
  }, [computedStyles.sectionGap, onMeasurementsReady]);

  // Measure after layout but before paint
  useLayoutEffect(() => {
    measureBlocks();
  }, [measureBlocks, blocks, style]);

  // Filter visible blocks and sort by order
  const visibleBlocks = blocks
    .filter((block) => !block.isHidden)
    .sort((a, b) => a.order - b.order);

  // If no visible blocks, still call onMeasurementsReady with empty map
  if (visibleBlocks.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "-9999px",
        top: "0",
        visibility: "hidden",
        // Match exact page dimensions
        width: PAGE_DIMENSIONS.WIDTH,
        // Apply same padding as the actual preview
        paddingTop: computedStyles.paddingTop,
        paddingBottom: computedStyles.paddingBottom,
        paddingLeft: computedStyles.paddingLeft,
        paddingRight: computedStyles.paddingRight,
        // Match font rendering
        fontFamily: computedStyles.fontFamily,
        // Ensure consistent rendering
        boxSizing: "border-box",
        // White background for accurate text rendering
        backgroundColor: "white",
      }}
    >
      {visibleBlocks.map((block) => (
        <div key={block.id} data-block-id={block.id}>
          <BlockRenderer
            block={block}
            style={computedStyles}
            // Non-interactive: no active state, no click handler
            isActive={false}
          />
        </div>
      ))}
    </div>
  );
}
