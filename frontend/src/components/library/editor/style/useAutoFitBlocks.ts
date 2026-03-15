"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type {
  AnyResumeBlock,
  BlockEditorStyle,
  ExperienceEntry,
  EducationEntry,
  ProjectEntry,
  VolunteerEntry,
} from "@/lib/resume/types";

/**
 * Auto-fit status states
 */
export type AutoFitState = "idle" | "fitting" | "fitted" | "minimum_reached";

export interface AutoFitStatus {
  state: AutoFitState;
  message?: string;
  reductions?: string[];
  compactnessLevel?: number;
}

export interface AutoFitReduction {
  property: string;
  from: number;
  to: number;
  label: string;
}

export interface UseAutoFitBlocksOptions {
  blocks: AnyResumeBlock[];
  style: BlockEditorStyle;
  enabled: boolean;
  onStyleChange: (style: Partial<BlockEditorStyle>) => void;
  /** Optional DOM-based measurement function. If provided, uses binary search with DOM measurement. */
  measureFn?: () => number;
}

export interface UseAutoFitBlocksResult {
  status: AutoFitStatus;
  adjustedStyle: BlockEditorStyle;
  reductions: AutoFitReduction[];
}

// Minimum values to preserve readability
export const MINIMUMS = {
  fontSizeBody: 7,
  fontSizeHeading: 12,
  fontSizeSubheading: 9,
  lineSpacing: 1.05,
  sectionSpacing: 6,
  entrySpacing: 4,
} as const;

// Page height in pixels (11 inches at 96 DPI)
export const PAGE_HEIGHT = 11 * 96; // 1056px

// Progressive reduction phases (order matters - least impactful first)
const REDUCTION_PHASES = [
  { property: "sectionSpacing", label: "Section spacing", min: MINIMUMS.sectionSpacing },
  { property: "entrySpacing", label: "Entry spacing", min: MINIMUMS.entrySpacing },
  { property: "lineSpacing", label: "Line height", min: MINIMUMS.lineSpacing },
  { property: "fontSizeBody", label: "Body font", min: MINIMUMS.fontSizeBody },
] as const;

// ============================================================================
// COMPACTNESS SCALE UTILITIES
// ============================================================================

/**
 * Convert compactness level (0-100) to style values.
 * Level 0 = most spacious (original styles), Level 100 = most compact (all minimums).
 *
 * The scale preserves "least impactful first" ordering:
 * - Levels 0-25:   sectionSpacing reduced (max → min)
 * - Levels 25-50:  entrySpacing reduced (max → min)
 * - Levels 50-75:  lineSpacing reduced (max → min)
 * - Levels 75-100: fontSizeBody reduced (max → min) + proportional heading/subheading
 */
export function compactnessToStyle(
  level: number,
  originalStyle: BlockEditorStyle
): BlockEditorStyle {
  const style = { ...originalStyle };

  // Clamp level to valid range
  const clampedLevel = Math.max(0, Math.min(100, level));

  // Phase 1: sectionSpacing (levels 0-25)
  if (clampedLevel > 0) {
    const phaseProgress = Math.min(clampedLevel / 25, 1);
    const range = originalStyle.sectionSpacing - MINIMUMS.sectionSpacing;
    style.sectionSpacing = originalStyle.sectionSpacing - range * phaseProgress;
  }

  // Phase 2: entrySpacing (levels 25-50)
  if (clampedLevel > 25) {
    const phaseProgress = Math.min((clampedLevel - 25) / 25, 1);
    const range = originalStyle.entrySpacing - MINIMUMS.entrySpacing;
    style.entrySpacing = originalStyle.entrySpacing - range * phaseProgress;
  }

  // Phase 3: lineSpacing (levels 50-75)
  if (clampedLevel > 50) {
    const phaseProgress = Math.min((clampedLevel - 50) / 25, 1);
    const range = originalStyle.lineSpacing - MINIMUMS.lineSpacing;
    style.lineSpacing = originalStyle.lineSpacing - range * phaseProgress;
  }

  // Phase 4: fontSizeBody (levels 75-100) + proportional heading/subheading
  if (clampedLevel > 75) {
    const phaseProgress = Math.min((clampedLevel - 75) / 25, 1);
    const bodyRange = originalStyle.fontSizeBody - MINIMUMS.fontSizeBody;
    const newBody = originalStyle.fontSizeBody - bodyRange * phaseProgress;
    const ratio = newBody / originalStyle.fontSizeBody;

    style.fontSizeBody = newBody;
    style.fontSizeHeading = Math.max(MINIMUMS.fontSizeHeading, originalStyle.fontSizeHeading * ratio);
    style.fontSizeSubheading = Math.max(MINIMUMS.fontSizeSubheading, originalStyle.fontSizeSubheading * ratio);
  }

  return style;
}

/**
 * Calculate which style properties have been reduced and by how much.
 * Returns an array of reductions for UI display.
 */
export function calculateReductions(
  compactnessLevel: number,
  originalStyle: BlockEditorStyle
): AutoFitReduction[] {
  const reductions: AutoFitReduction[] = [];
  const adjustedStyle = compactnessToStyle(compactnessLevel, originalStyle);

  // Check each phase for reductions
  if (compactnessLevel > 0 && adjustedStyle.sectionSpacing < originalStyle.sectionSpacing) {
    reductions.push({
      property: "sectionSpacing",
      from: originalStyle.sectionSpacing,
      to: adjustedStyle.sectionSpacing,
      label: "Section spacing",
    });
  }

  if (compactnessLevel > 25 && adjustedStyle.entrySpacing < originalStyle.entrySpacing) {
    reductions.push({
      property: "entrySpacing",
      from: originalStyle.entrySpacing,
      to: adjustedStyle.entrySpacing,
      label: "Entry spacing",
    });
  }

  if (compactnessLevel > 50 && adjustedStyle.lineSpacing < originalStyle.lineSpacing) {
    reductions.push({
      property: "lineSpacing",
      from: originalStyle.lineSpacing,
      to: adjustedStyle.lineSpacing,
      label: "Line height",
    });
  }

  if (compactnessLevel > 75 && adjustedStyle.fontSizeBody < originalStyle.fontSizeBody) {
    reductions.push({
      property: "fontSizeBody",
      from: originalStyle.fontSizeBody,
      to: adjustedStyle.fontSizeBody,
      label: "Body font",
    });
  }

  return reductions;
}

// ============================================================================
// MEASUREMENT UTILITIES
// ============================================================================

/**
 * Threshold for considering height changes as "stable" (measurement noise).
 * If the height difference is less than this, the algorithm considers it converged.
 */
export const STABILITY_THRESHOLD_PX = 2;

/**
 * Warning threshold for timing anomalies (ms).
 * If double RAF takes longer than this, it may indicate concurrent mode interference.
 */
const TIMING_WARNING_THRESHOLD_MS = 100;

/**
 * Wrap a measurement function with double RAF to ensure DOM has settled.
 * This prevents reading stale layout values after style changes.
 *
 * Why double RAF?
 * - First RAF: Wait for current frame's paint
 * - Second RAF: Wait for next frame, after React commit
 *
 * This pattern ensures:
 * 1. React has committed DOM changes
 * 2. Browser has calculated layout
 * 3. scrollHeight reflects new styles
 *
 * @see /docs/features/fit-to-one-page/130326_tradeoff-5-synchronous-measurement.md
 */
export function measureWithRAF(measureFn: () => number): Promise<number> {
  return new Promise((resolve) => {
    const startTime = performance.now();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const elapsed = performance.now() - startTime;

        // Flag if timing is suspiciously long (concurrent mode interference?)
        if (elapsed > TIMING_WARNING_THRESHOLD_MS) {
          console.warn(
            `[Auto-fit] Measurement delayed: ${elapsed.toFixed(1)}ms. ` +
            `This may indicate React concurrent mode interference or heavy rendering.`
          );
        }

        resolve(measureFn());
      });
    });
  });
}

// ============================================================================
// BINARY SEARCH ALGORITHM
// ============================================================================

export interface BinarySearchResult {
  level: number;
  style: BlockEditorStyle;
  fits: boolean;
}

/**
 * Binary search to find minimum compactness level that fits content on one page.
 * Complexity: O(log n) where n = 100 levels = max 7 iterations.
 *
 * The algorithm relies on the monotonicity of the height function:
 * - If content fits at compactness level c, it will fit at all levels > c
 * - This allows binary search to efficiently find the optimal level
 *
 * Safeguards (per tradeoff-5):
 * - Max 7 iterations (log₂ 100)
 * - Stability threshold: stops if height change < 2px (measurement noise)
 * - Early exit if original style fits
 *
 * @param measureHeight - Async function that applies style and returns content height
 * @param targetHeight - Maximum allowed height (page height minus margins)
 * @param originalStyle - The user's original style settings
 * @returns The minimum compactness level that fits, the resulting style, and whether it fits
 *
 * @see /docs/features/fit-to-one-page/130326_tradeoff-5-synchronous-measurement.md
 */
export async function findOptimalCompactness(
  measureHeight: (style: BlockEditorStyle) => Promise<number>,
  targetHeight: number,
  originalStyle: BlockEditorStyle
): Promise<BinarySearchResult> {
  // First check: does original style fit?
  const originalHeight = await measureHeight(originalStyle);
  if (originalHeight <= targetHeight) {
    return { level: 0, style: originalStyle, fits: true };
  }

  let low = 0;
  let high = 100;
  let result = 100; // Default to maximum compactness
  let lastHeight = originalHeight;
  let iterationCount = 0;
  const maxIterations = 10; // Safety cap (slightly above theoretical max of 7)

  // Binary search for minimum compactness
  while (low <= high && iterationCount < maxIterations) {
    iterationCount++;
    const mid = Math.floor((low + high) / 2);
    const testStyle = compactnessToStyle(mid, originalStyle);
    const height = await measureHeight(testStyle);

    // Stability threshold: if height barely changed, consider it converged
    // This handles measurement noise and prevents unnecessary iterations
    if (Math.abs(height - lastHeight) < STABILITY_THRESHOLD_PX && height <= targetHeight) {
      result = mid;
      break;
    }

    lastHeight = height;

    if (height <= targetHeight) {
      result = mid; // This level fits, try less compact
      high = mid - 1;
    } else {
      low = mid + 1; // Need more compact
    }
  }

  // Check if result actually fits
  const finalStyle = compactnessToStyle(result, originalStyle);
  const finalHeight = await measureHeight(finalStyle);
  const fits = finalHeight <= targetHeight;

  // Log iteration count in development for monitoring
  if (process.env.NODE_ENV === "development") {
    console.log(
      `[Auto-fit] Binary search completed in ${iterationCount} iterations. ` +
      `Level: ${result}, Fits: ${fits}`
    );
  }

  return { level: result, style: finalStyle, fits };
}

// ============================================================================
// LEGACY: ESTIMATION-BASED HEIGHT CALCULATION
// ============================================================================

// Maximum iterations for linear algorithm (legacy fallback)
const MAX_ITERATIONS = 25;

// Reduction step for linear algorithm (5% per iteration)
const REDUCTION_FACTOR = 0.95;

/**
 * Estimate content height based on blocks and style
 * This is a rough approximation - actual rendering may differ
 */
function estimateContentHeight(
  blocks: AnyResumeBlock[],
  style: BlockEditorStyle
): number {
  // Base metrics
  const bodyLineHeight = style.fontSizeBody * style.lineSpacing;
  const headingHeight = style.fontSizeHeading * 1.2;
  const subheadingHeight = style.fontSizeSubheading * 1.2;

  let totalHeight = 0;

  // Add margins (converted from inches to pixels at 96 DPI)
  totalHeight += (style.marginTop + style.marginBottom) * 96;

  for (const block of blocks) {
    // Add section heading height
    totalHeight += headingHeight + style.sectionSpacing;

    switch (block.type) {
      case "contact": {
        // Contact is typically 2-3 lines
        totalHeight += bodyLineHeight * 3;
        break;
      }

      case "summary": {
        // Estimate based on character count (approximately 80 chars per line)
        const summary = block.content as string;
        const lines = Math.ceil(summary.length / 80) || 1;
        totalHeight += bodyLineHeight * lines;
        break;
      }

      case "experience": {
        const entries = block.content as ExperienceEntry[];
        for (const entry of entries) {
          // Entry header (title, company, dates)
          totalHeight += subheadingHeight;
          totalHeight += bodyLineHeight; // Company/location line
          // Bullets (each bullet is ~1-2 lines)
          const bulletLines = entry.bullets.reduce((sum, bullet) => {
            return sum + Math.max(1, Math.ceil(bullet.length / 70));
          }, 0);
          totalHeight += bodyLineHeight * bulletLines;
          totalHeight += style.entrySpacing;
        }
        break;
      }

      case "education": {
        const entries = block.content as EducationEntry[];
        for (const entry of entries) {
          totalHeight += subheadingHeight; // Degree
          totalHeight += bodyLineHeight * 2; // Institution, dates, GPA
          if (entry.relevantCourses && entry.relevantCourses.length > 0) {
            totalHeight += bodyLineHeight; // Courses line
          }
          totalHeight += style.entrySpacing;
        }
        break;
      }

      case "skills": {
        const skills = block.content as string[];
        // Estimate skills wrap to ~5-6 per line
        const lines = Math.ceil(skills.length / 5) || 1;
        totalHeight += bodyLineHeight * lines;
        break;
      }

      case "projects": {
        const entries = block.content as ProjectEntry[];
        for (const entry of entries) {
          totalHeight += subheadingHeight; // Project name
          totalHeight += bodyLineHeight * 2; // Description
          if (entry.bullets && entry.bullets.length > 0) {
            const bulletLines = entry.bullets.reduce((sum, bullet) => {
              return sum + Math.max(1, Math.ceil(bullet.length / 70));
            }, 0);
            totalHeight += bodyLineHeight * bulletLines;
          }
          totalHeight += style.entrySpacing;
        }
        break;
      }

      case "volunteer": {
        const entries = block.content as VolunteerEntry[];
        for (const entry of entries) {
          totalHeight += subheadingHeight;
          totalHeight += bodyLineHeight * 2;
          if (entry.bullets && entry.bullets.length > 0) {
            totalHeight += bodyLineHeight * entry.bullets.length;
          }
          totalHeight += style.entrySpacing;
        }
        break;
      }

      case "certifications":
      case "awards":
      case "publications":
      case "courses":
      case "memberships":
      case "references": {
        // Array-based entries: estimate 2 lines each
        const entries = block.content as unknown[];
        totalHeight += bodyLineHeight * 2 * (entries?.length || 1);
        totalHeight += style.entrySpacing * (entries?.length || 1);
        break;
      }

      case "languages": {
        const entries = block.content as unknown[];
        // Languages are compact: ~3-4 per line
        const lines = Math.ceil((entries?.length || 1) / 3);
        totalHeight += bodyLineHeight * lines;
        break;
      }

      case "interests": {
        const content = block.content as string;
        const lines = Math.ceil(content.length / 80) || 1;
        totalHeight += bodyLineHeight * lines;
        break;
      }

      default:
        totalHeight += bodyLineHeight * 2;
    }

    // Add section spacing after each block
    totalHeight += style.sectionSpacing;
  }

  return totalHeight;
}

/**
 * Hook to automatically adjust styles to fit content on one page.
 *
 * Two modes of operation:
 * 1. DOM-based (recommended): When `measureFn` is provided, uses binary search O(log n)
 *    with actual DOM measurements for maximum accuracy.
 * 2. Estimation-based (legacy): When `measureFn` is not provided, uses linear O(n)
 *    algorithm with mathematical height estimation.
 */
export function useAutoFitBlocks({
  blocks,
  style,
  enabled,
  onStyleChange,
  measureFn,
}: UseAutoFitBlocksOptions): UseAutoFitBlocksResult {
  const [status, setStatus] = useState<AutoFitStatus>({ state: "idle" });
  const [reductions, setReductions] = useState<AutoFitReduction[]>([]);
  const [adjustedStyle, setAdjustedStyle] = useState<BlockEditorStyle>(style);
  const isProcessingRef = useRef(false);
  const originalStyleRef = useRef<BlockEditorStyle>(style);

  // Track if we've already determined content can't fit (prevents infinite loop)
  // This is set when minimum_reached is hit and reset when blocks change
  const minimumReachedRef = useRef(false);

  // Hash of block IDs to detect when content actually changes
  const blocksHash = useMemo(
    () => JSON.stringify(blocks.map((b) => b.id)),
    [blocks]
  );

  // Store original style when auto-fit is enabled
  useEffect(() => {
    if (enabled && !isProcessingRef.current) {
      originalStyleRef.current = style;
    }
  }, [enabled, style]);

  // Reset minimum_reached flag when blocks change (user edited content)
  // This allows re-trying the fit algorithm with new content
  useEffect(() => {
    minimumReachedRef.current = false;
  }, [blocksHash]);

  // Calculate target height (page minus margins)
  const getTargetHeight = useCallback((s: BlockEditorStyle) => {
    return PAGE_HEIGHT - (s.marginTop + s.marginBottom) * 96;
  }, []);

  // Run auto-fit algorithm (binary search with DOM or linear with estimation)
  useEffect(() => {
    if (!enabled) {
      minimumReachedRef.current = false; // Reset when disabled
      setStatus({ state: "idle" });
      setReductions([]);
      setAdjustedStyle(style);
      return;
    }

    // Skip if we already know content can't fit (prevents infinite loop)
    // This flag is reset when blocks change, allowing retry with new content
    if (minimumReachedRef.current) {
      return;
    }

    // Prevent re-entrancy
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    const targetHeight = getTargetHeight(style);

    // Choose algorithm based on whether measureFn is provided
    if (measureFn) {
      // DOM-based binary search algorithm (O(log n))
      runBinarySearchAutoFit(measureFn, targetHeight, style);
    } else {
      // No measureFn - measurements not ready yet
      // Set status to "fitting" to show user we're waiting
      // Don't run estimation algorithm, as DOM-based measurement will be used once ready
      // See /docs/features/fit-to-one-page/150326_fit-to-one-page-timing-bug.md
      setStatus({ state: "fitting" });
      isProcessingRef.current = false; // Allow re-run when measureFn becomes available
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, blocks, style, getTargetHeight, measureFn]);

  /**
   * Binary search algorithm with DOM measurement.
   * Max 7 iterations for 100 compactness levels.
   */
  const runBinarySearchAutoFit = useCallback(
    async (measure: () => number, targetHeight: number, currentStyle: BlockEditorStyle) => {
      setStatus({ state: "fitting" });

      try {
        // Create measurement function that waits for RAF
        const measureHeight = async (testStyle: BlockEditorStyle): Promise<number> => {
          // Apply the test style temporarily
          onStyleChange(testStyle);
          // Wait for double RAF to ensure DOM has settled
          return measureWithRAF(measure);
        };

        // Pre-check: verify measurements are ready before running binary search
        // If measureFn returns Infinity, measurements aren't ready yet
        const preCheck = await measureWithRAF(measure);
        if (preCheck === Infinity) {
          // Measurements not ready - keep "fitting" status and wait for re-run
          // The effect will re-run when measureFn becomes valid
          isProcessingRef.current = false;
          return;
        }

        const result = await findOptimalCompactness(
          measureHeight,
          targetHeight,
          currentStyle
        );

        const appliedReductions = calculateReductions(result.level, currentStyle);

        // Apply final style
        setAdjustedStyle(result.style);
        setReductions(appliedReductions);

        // Only call onStyleChange if style actually changed (prevents re-render loop)
        if (result.level > 0) {
          const currentStyleHash = JSON.stringify(currentStyle);
          const resultStyleHash = JSON.stringify(result.style);

          if (currentStyleHash !== resultStyleHash) {
            onStyleChange(result.style);
          }
        }

        if (result.fits) {
          minimumReachedRef.current = false; // Reset on successful fit
          setStatus({
            state: "fitted",
            reductions: appliedReductions.map((r) => r.label),
            compactnessLevel: result.level,
          });
        } else {
          minimumReachedRef.current = true; // Set flag to prevent re-runs
          setStatus({
            state: "minimum_reached",
            message: "Content still exceeds one page at minimum settings. Consider removing or condensing content.",
            compactnessLevel: result.level,
          });
        }
      } finally {
        isProcessingRef.current = false;
      }
    },
    [onStyleChange]
  );

  /**
   * Linear algorithm with estimation (legacy fallback).
   * O(n) with max 25 iterations.
   */
  const runLinearAutoFit = useCallback(
    (targetHeight: number, currentStyle: BlockEditorStyle) => {
      const currentHeight = estimateContentHeight(blocks, currentStyle);

      if (currentHeight <= targetHeight) {
        setStatus({ state: "fitted", reductions: [] });
        setReductions([]);
        setAdjustedStyle(currentStyle);
        isProcessingRef.current = false;
        return;
      }

      setStatus({ state: "fitting" });

      // Working copy of style
      const workingStyle = { ...currentStyle };
      const appliedReductions: AutoFitReduction[] = [];
      let height = currentHeight;
      let iterations = 0;
      let phaseIndex = 0;

      while (height > targetHeight && iterations < MAX_ITERATIONS) {
        iterations++;

        const currentPhase = REDUCTION_PHASES[phaseIndex];
        if (!currentPhase) break;

        const propKey = currentPhase.property as keyof BlockEditorStyle;
        const currentValue = workingStyle[propKey] as number;

        if (currentValue > currentPhase.min) {
          const newValue = Math.max(
            currentPhase.min,
            Number((currentValue * REDUCTION_FACTOR).toFixed(2))
          );

          // Track reduction
          const existingReduction = appliedReductions.find(
            (r) => r.property === currentPhase.property
          );
          if (existingReduction) {
            existingReduction.to = newValue;
          } else {
            appliedReductions.push({
              property: currentPhase.property,
              from: currentValue,
              to: newValue,
              label: currentPhase.label,
            });
          }

          (workingStyle as unknown as Record<string, number>)[propKey] = newValue;

          // Scale related font sizes when body font changes
          if (currentPhase.property === "fontSizeBody") {
            const ratio = newValue / currentValue;
            workingStyle.fontSizeHeading = Math.max(
              MINIMUMS.fontSizeHeading,
              Math.round(workingStyle.fontSizeHeading * ratio)
            );
            workingStyle.fontSizeSubheading = Math.max(
              MINIMUMS.fontSizeSubheading,
              Math.round(workingStyle.fontSizeSubheading * ratio)
            );
          }
        } else {
          // Move to next phase when current is at minimum
          phaseIndex++;
        }

        height = estimateContentHeight(blocks, workingStyle);
      }

      // Apply final adjusted style
      setAdjustedStyle(workingStyle);
      setReductions(appliedReductions);

      // Notify parent of style change
      if (appliedReductions.length > 0) {
        onStyleChange(workingStyle);
      }

      if (height <= targetHeight) {
        minimumReachedRef.current = false; // Reset on successful fit
        setStatus({
          state: "fitted",
          reductions: appliedReductions.map((r) => r.label),
        });
      } else {
        minimumReachedRef.current = true; // Set flag to prevent re-runs
        setStatus({
          state: "minimum_reached",
          message: "Content still exceeds one page at minimum settings. Consider removing or condensing content.",
        });
      }

      isProcessingRef.current = false;
    },
    [blocks, onStyleChange]
  );

  // When style changes externally while not enabled, sync adjusted style
  useEffect(() => {
    if (!enabled) {
      setAdjustedStyle(style);
    }
  }, [style, enabled]);

  return {
    status,
    adjustedStyle: enabled ? adjustedStyle : style,
    reductions,
  };
}
