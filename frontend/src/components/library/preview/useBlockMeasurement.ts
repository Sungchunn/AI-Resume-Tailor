"use client";

/**
 * useBlockMeasurement - Hook for measuring block heights in a hidden container
 *
 * This hook manages the measurement infrastructure for the paginated preview.
 * It measures rendered block heights to enable accurate page distribution.
 */

import { useState, useCallback, useEffect } from "react";
import type { AnyResumeBlock, BlockEditorStyle } from "@/lib/resume/types";
import type { BlockMeasurement } from "./MeasurementContainer";

// Re-export for convenience
export type { BlockMeasurement };

/**
 * Result returned by the useBlockMeasurement hook
 */
export interface UseMeasurementResult {
  /** Map of blockId -> measurement data */
  measurements: Map<string, BlockMeasurement>;
  /** Whether all measurements are complete and ready to use */
  isReady: boolean;
  /** Callback to receive measurements from MeasurementContainer */
  onMeasurementsReady: (measurements: Map<string, BlockMeasurement>) => void;
}

/**
 * Hook that manages block height measurements for pagination.
 *
 * @param blocks - Array of resume blocks to measure
 * @param style - Editor style settings affecting block rendering
 * @returns Measurement results and container callback
 *
 * Implementation details:
 * 1. Stores measurements in a Map<blockId, BlockMeasurement>
 * 2. Sets isReady: true when measurements complete via onMeasurementsReady callback
 * 3. MeasurementContainer re-measures via useLayoutEffect when blocks/style change
 * 4. Handles edge cases: empty blocks, hidden blocks
 *
 * Note: No manual reset of isReady is needed because MeasurementContainer's
 * useLayoutEffect runs synchronously on block changes and immediately provides
 * updated measurements via onMeasurementsReady.
 *
 * Usage:
 * ```tsx
 * const { measurements, isReady, onMeasurementsReady } = useBlockMeasurement(blocks, style);
 *
 * return (
 *   <>
 *     <MeasurementContainer
 *       blocks={blocks}
 *       style={style}
 *       onMeasurementsReady={onMeasurementsReady}
 *     />
 *     {isReady && <PaginatedContent measurements={measurements} />}
 *   </>
 * );
 * ```
 */
export function useBlockMeasurement(
  blocks: AnyResumeBlock[],
  _style: BlockEditorStyle
): UseMeasurementResult {
  const [measurements, setMeasurements] = useState<Map<string, BlockMeasurement>>(
    new Map()
  );
  const [isReady, setIsReady] = useState(false);

  // Callback to receive measurements from MeasurementContainer
  // MeasurementContainer's useLayoutEffect calls this synchronously when blocks change
  const onMeasurementsReady = useCallback(
    (newMeasurements: Map<string, BlockMeasurement>) => {
      setMeasurements(newMeasurements);
      setIsReady(true);
    },
    []
  );

  // Handle empty blocks array - immediately ready with empty map
  useEffect(() => {
    const visibleBlocks = blocks.filter((b) => !b.isHidden);
    if (visibleBlocks.length === 0) {
      setMeasurements(new Map());
      setIsReady(true);
    }
  }, [blocks]);

  return {
    measurements,
    isReady,
    onMeasurementsReady,
  };
}

/**
 * Calculate content height for a page based on style padding
 *
 * @param style - Editor style settings
 * @param pageHeight - Total page height (default: 1056px)
 * @returns Available content height in pixels
 */
export function calculateContentHeight(
  style: BlockEditorStyle,
  pageHeight: number = 1056
): number {
  const paddingTop = style.marginTop * 96; // inches to pixels
  const paddingBottom = style.marginBottom * 96;
  return pageHeight - paddingTop - paddingBottom;
}

/**
 * Get total height of a block including its margin
 *
 * @param measurement - Block measurement data
 * @param isLastOnPage - Whether this is the last block on the page (no margin needed)
 * @returns Total height including margin
 */
export function getBlockTotalHeight(
  measurement: BlockMeasurement,
  isLastOnPage: boolean = false
): number {
  return measurement.height + (isLastOnPage ? 0 : measurement.marginBottom);
}
