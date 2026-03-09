import type { ResumeStyle } from "@/lib/api/types";
import type { ComputedPreviewStyle } from "./types";
import { PAGE_DIMENSIONS } from "./types";

// Default to LETTER dimensions
const PAGE = PAGE_DIMENSIONS.LETTER;

export function computePreviewStyles(style: ResumeStyle): ComputedPreviewStyle {
  return {
    fontFamily: style.font_family ?? "Arial, sans-serif",
    bodyFontSize: `${style.font_size_body ?? 11}pt`,
    headingFontSize: `${style.font_size_heading ?? 18}pt`,
    subheadingFontSize: `${style.font_size_subheading ?? 12}pt`,
    lineHeight: style.line_spacing ?? 1.4,
    sectionGap: `${style.section_spacing ?? 16}px`,
    entryGap: `${style.entry_spacing ?? 8}px`,
    paddingTop: `${(style.margin_top ?? 0.75) * PAGE_DIMENSIONS.DPI}px`,
    paddingBottom: `${(style.margin_bottom ?? 0.75) * PAGE_DIMENSIONS.DPI}px`,
    paddingLeft: `${(style.margin_left ?? 0.75) * PAGE_DIMENSIONS.DPI}px`,
    paddingRight: `${(style.margin_right ?? 0.75) * PAGE_DIMENSIONS.DPI}px`,
  };
}

// Minimum values for auto-fit
const FIT_MINIMUMS = {
  bodyFontSize: 8,
  headingFontSize: 12,
  subheadingFontSize: 9,
  lineHeight: 1.1,
  sectionSpacing: 8,
  entrySpacing: 4,
} as const;

// Maximum iterations to prevent infinite loops
const MAX_FIT_ITERATIONS = 20;

/**
 * Progressive auto-fit algorithm: reduces styles in priority order
 * to fit content to one page while maintaining readability.
 *
 * Order of reduction:
 * 1. Body font size (most impact on density)
 * 2. Entry spacing (space between items)
 * 3. Section spacing (space between sections)
 * 4. Line height (last resort - affects readability most)
 *
 * Each step reduces by ~5% until content fits or minimums reached.
 */
export function calculateFitToPageStyles(
  style: ResumeStyle,
  currentHeight: number,
  measureFn?: (styles: ComputedPreviewStyle) => number
): ComputedPreviewStyle {
  const targetHeight =
    PAGE.HEIGHT -
    (style.margin_top ?? 0.75) * PAGE_DIMENSIONS.DPI -
    (style.margin_bottom ?? 0.75) * PAGE_DIMENSIONS.DPI;

  // If already fits, return unchanged
  if (currentHeight <= targetHeight) {
    return computePreviewStyles(style);
  }

  // Working values
  let bodyFontSize = style.font_size_body ?? 11;
  let headingFontSize = style.font_size_heading ?? 18;
  let subheadingFontSize = style.font_size_subheading ?? 12;
  let sectionSpacing = style.section_spacing ?? 16;
  let entrySpacing = style.entry_spacing ?? 8;
  let lineHeight = style.line_spacing ?? 1.4;

  // Reduction step (5%)
  const REDUCTION_FACTOR = 0.95;

  let height = currentHeight;
  let iterations = 0;
  let phase = 0; // 0: fonts, 1: entry spacing, 2: section spacing, 3: line height

  while (height > targetHeight && iterations < MAX_FIT_ITERATIONS) {
    iterations++;

    switch (phase) {
      case 0: // Reduce body font size first
        if (bodyFontSize > FIT_MINIMUMS.bodyFontSize) {
          bodyFontSize = Math.max(
            FIT_MINIMUMS.bodyFontSize,
            bodyFontSize * REDUCTION_FACTOR
          );
          // Scale heading/subheading proportionally
          headingFontSize = Math.max(
            FIT_MINIMUMS.headingFontSize,
            headingFontSize * REDUCTION_FACTOR
          );
          subheadingFontSize = Math.max(
            FIT_MINIMUMS.subheadingFontSize,
            subheadingFontSize * REDUCTION_FACTOR
          );
        } else {
          phase = 1; // Move to next phase
        }
        break;

      case 1: // Reduce entry spacing
        if (entrySpacing > FIT_MINIMUMS.entrySpacing) {
          entrySpacing = Math.max(
            FIT_MINIMUMS.entrySpacing,
            entrySpacing * REDUCTION_FACTOR
          );
        } else {
          phase = 2;
        }
        break;

      case 2: // Reduce section spacing
        if (sectionSpacing > FIT_MINIMUMS.sectionSpacing) {
          sectionSpacing = Math.max(
            FIT_MINIMUMS.sectionSpacing,
            sectionSpacing * REDUCTION_FACTOR
          );
        } else {
          phase = 3;
        }
        break;

      case 3: // Reduce line height (last resort)
        if (lineHeight > FIT_MINIMUMS.lineHeight) {
          lineHeight = Math.max(
            FIT_MINIMUMS.lineHeight,
            lineHeight * REDUCTION_FACTOR
          );
        } else {
          break; // All minimums reached, exit loop
        }
        break;
    }

    // Estimate new height (simple ratio-based estimation)
    // In production, use measureFn for accurate DOM measurement
    const fontRatio = bodyFontSize / (style.font_size_body ?? 11);
    const spacingRatio =
      (sectionSpacing + entrySpacing) /
      ((style.section_spacing ?? 16) + (style.entry_spacing ?? 8));
    const lineRatio = lineHeight / (style.line_spacing ?? 1.4);
    height = currentHeight * fontRatio * Math.sqrt(spacingRatio) * lineRatio;

    // If all phases exhausted, exit
    if (phase > 3) break;
  }

  return {
    fontFamily: style.font_family ?? "Arial, sans-serif",
    bodyFontSize: `${Math.round(bodyFontSize)}pt`,
    headingFontSize: `${Math.round(headingFontSize)}pt`,
    subheadingFontSize: `${Math.round(subheadingFontSize)}pt`,
    lineHeight,
    sectionGap: `${Math.round(sectionSpacing)}px`,
    entryGap: `${Math.round(entrySpacing)}px`,
    paddingTop: `${(style.margin_top ?? 0.75) * PAGE_DIMENSIONS.DPI}px`,
    paddingBottom: `${(style.margin_bottom ?? 0.75) * PAGE_DIMENSIONS.DPI}px`,
    paddingLeft: `${(style.margin_left ?? 0.75) * PAGE_DIMENSIONS.DPI}px`,
    paddingRight: `${(style.margin_right ?? 0.75) * PAGE_DIMENSIONS.DPI}px`,
  };
}

// Export constants for testing
export { FIT_MINIMUMS, MAX_FIT_ITERATIONS };
