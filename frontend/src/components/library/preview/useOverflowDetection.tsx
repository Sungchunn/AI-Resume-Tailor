"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { PAGE_DIMENSIONS } from "./types";

interface UseOverflowDetectionOptions {
  /** Reference to the container element to monitor */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Debounce delay in milliseconds (default: 500) */
  debounceMs?: number;
}

interface OverflowDetectionResult {
  /** Whether content overflows the first page */
  overflows: boolean;
  /** Estimated number of pages based on content height */
  estimatedPageCount: number;
  /** Current content height in pixels */
  contentHeight: number;
}

/**
 * useOverflowDetection - Detect when resume content overflows page boundaries
 *
 * Uses ResizeObserver + MutationObserver with debouncing to efficiently
 * detect content changes and calculate overflow state.
 *
 * @param options - Container ref and optional debounce delay
 * @returns Overflow detection result with page count estimation
 */
export function useOverflowDetection({
  containerRef,
  debounceMs = 500,
}: UseOverflowDetectionOptions): OverflowDetectionResult {
  const [result, setResult] = useState<OverflowDetectionResult>({
    overflows: false,
    estimatedPageCount: 1,
    contentHeight: 0,
  });

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const calculateOverflow = useCallback(() => {
    const element = containerRef.current;
    if (!element) return;

    const scrollHeight = element.scrollHeight;
    const pageHeight = PAGE_DIMENSIONS.HEIGHT;

    // Calculate page count
    const pageCount = Math.ceil(scrollHeight / pageHeight);
    const overflows = scrollHeight > pageHeight;

    setResult({
      overflows,
      estimatedPageCount: Math.max(1, pageCount),
      contentHeight: scrollHeight,
    });
  }, [containerRef]);

  const debouncedCalculate = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      calculateOverflow();
    }, debounceMs);
  }, [calculateOverflow, debounceMs]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    // Initial calculation
    calculateOverflow();

    // ResizeObserver for size changes
    const resizeObserver = new ResizeObserver(() => {
      debouncedCalculate();
    });
    resizeObserver.observe(element);

    // MutationObserver for content changes
    const mutationObserver = new MutationObserver(() => {
      debouncedCalculate();
    });
    mutationObserver.observe(element, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [containerRef, calculateOverflow, debouncedCalculate]);

  return result;
}
