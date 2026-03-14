"use client";

/**
 * useBlockPagination - Hook for assigning blocks to pages based on measurements
 *
 * Implements the keep-together algorithm that distributes blocks across pages
 * without splitting any single block across page boundaries.
 */

import { useMemo } from "react";
import type { AnyResumeBlock, BlockEditorStyle } from "@/lib/resume/types";
import type { BlockMeasurement } from "./MeasurementContainer";
import { calculateContentHeight, getBlockTotalHeight } from "./useBlockMeasurement";

/**
 * Represents a single page with its assigned blocks
 */
export interface PageAssignment {
  /** 1-indexed page number */
  pageNumber: number;
  /** Blocks assigned to this page */
  blocks: AnyResumeBlock[];
  /** Total height used on this page (in pixels) */
  usedHeight: number;
  /** Space remaining on this page (in pixels) */
  remainingHeight: number;
}

/**
 * Result of the pagination calculation
 */
export interface PaginationResult {
  /** Array of page assignments */
  pages: PageAssignment[];
  /** Total number of pages */
  totalPages: number;
  /** Whether pagination calculation is complete */
  isReady: boolean;
  /** Block IDs that exceed a single page height */
  oversizedBlocks: string[];
}

/**
 * Hook that assigns blocks to pages based on their measured heights.
 *
 * Uses a keep-together algorithm: if a block doesn't fit on the current page,
 * it starts a new page rather than splitting the block.
 *
 * @param blocks - Array of resume blocks to paginate
 * @param style - Editor style settings (for calculating content height)
 * @param measurements - Map of block measurements from useBlockMeasurement
 * @param measurementsReady - Whether measurements are complete
 * @returns Pagination result with page assignments
 *
 * Edge cases handled:
 * - Empty blocks array → 1 empty page
 * - All blocks hidden → 1 empty page
 * - Oversized blocks → placed on own page, marked in oversizedBlocks
 * - Block exactly fits → added to current page
 */
export function useBlockPagination(
  blocks: AnyResumeBlock[],
  style: BlockEditorStyle,
  measurements: Map<string, BlockMeasurement>,
  measurementsReady: boolean
): PaginationResult {
  return useMemo(() => {
    // Not ready yet - return loading state
    if (!measurementsReady) {
      return {
        pages: [],
        totalPages: 0,
        isReady: false,
        oversizedBlocks: [],
      };
    }

    // Filter and sort blocks
    const visibleBlocks = blocks
      .filter((block) => !block.isHidden)
      .sort((a, b) => a.order - b.order);

    // Handle empty/all-hidden case
    if (visibleBlocks.length === 0) {
      return {
        pages: [createEmptyPage(1, style)],
        totalPages: 1,
        isReady: true,
        oversizedBlocks: [],
      };
    }

    // Calculate available content height per page
    const contentHeight = calculateContentHeight(style);

    // Run the keep-together algorithm
    const { pages, oversizedBlocks } = assignBlocksToPages(
      visibleBlocks,
      measurements,
      contentHeight
    );

    return {
      pages,
      totalPages: pages.length,
      isReady: true,
      oversizedBlocks,
    };
  }, [blocks, style, measurements, measurementsReady]);
}

/**
 * Creates an empty page assignment
 */
function createEmptyPage(pageNumber: number, style: BlockEditorStyle): PageAssignment {
  const contentHeight = calculateContentHeight(style);
  return {
    pageNumber,
    blocks: [],
    usedHeight: 0,
    remainingHeight: contentHeight,
  };
}

/**
 * Keep-together algorithm for assigning blocks to pages.
 *
 * Algorithm:
 * 1. For each block, check if it fits on the current page
 * 2. If it fits, add to current page
 * 3. If it doesn't fit but page has content, start new page
 * 4. If block exceeds page height entirely, place on own page and mark as oversized
 */
function assignBlocksToPages(
  blocks: AnyResumeBlock[],
  measurements: Map<string, BlockMeasurement>,
  contentHeight: number
): { pages: PageAssignment[]; oversizedBlocks: string[] } {
  const pages: PageAssignment[] = [];
  const oversizedBlocks: string[] = [];

  // Initialize first page
  let currentPage: PageAssignment = {
    pageNumber: 1,
    blocks: [],
    usedHeight: 0,
    remainingHeight: contentHeight,
  };

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const measurement = measurements.get(block.id);

    // Skip blocks without measurements (shouldn't happen, but be safe)
    if (!measurement) {
      console.warn(`No measurement found for block ${block.id}`);
      continue;
    }

    // Calculate block height including margin (unless it's the last block on page)
    // For now, assume it won't be last - we'll adjust at the end
    const isLastBlock = i === blocks.length - 1;
    const blockHeight = getBlockTotalHeight(measurement, isLastBlock);

    // Case 1: Block fits on current page
    if (currentPage.usedHeight + blockHeight <= contentHeight) {
      currentPage.blocks.push(block);
      currentPage.usedHeight += blockHeight;
      currentPage.remainingHeight = contentHeight - currentPage.usedHeight;
    }
    // Case 2: Block doesn't fit, but current page has content → start new page
    else if (currentPage.blocks.length > 0) {
      // Finalize current page
      pages.push(currentPage);

      // Start new page with this block
      currentPage = {
        pageNumber: pages.length + 1,
        blocks: [block],
        usedHeight: blockHeight,
        remainingHeight: contentHeight - blockHeight,
      };

      // Check if block is oversized (exceeds full page height)
      if (blockHeight > contentHeight) {
        oversizedBlocks.push(block.id);
      }
    }
    // Case 3: Block doesn't fit and page is empty → oversized block
    else {
      currentPage.blocks.push(block);
      currentPage.usedHeight = blockHeight;
      currentPage.remainingHeight = contentHeight - blockHeight;
      oversizedBlocks.push(block.id);
    }
  }

  // Don't forget the last page
  if (currentPage.blocks.length > 0) {
    pages.push(currentPage);
  }

  // Ensure at least one page exists
  if (pages.length === 0) {
    pages.push({
      pageNumber: 1,
      blocks: [],
      usedHeight: 0,
      remainingHeight: contentHeight,
    });
  }

  return { pages, oversizedBlocks };
}

/**
 * Utility to check if a block would fit on a page with given remaining height
 */
export function wouldBlockFit(
  blockId: string,
  measurements: Map<string, BlockMeasurement>,
  remainingHeight: number,
  isLastOnPage: boolean = false
): boolean {
  const measurement = measurements.get(blockId);
  if (!measurement) return false;
  const blockHeight = getBlockTotalHeight(measurement, isLastOnPage);
  return blockHeight <= remainingHeight;
}

/**
 * Get the page number where a specific block is located
 */
export function getBlockPageNumber(
  blockId: string,
  pages: PageAssignment[]
): number | null {
  for (const page of pages) {
    if (page.blocks.some((block) => block.id === blockId)) {
      return page.pageNumber;
    }
  }
  return null;
}
