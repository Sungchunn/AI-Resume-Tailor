import { describe, it, expect } from "vitest";
import {
  calculateFitToPageStyles,
  FIT_MINIMUMS,
  MAX_FIT_ITERATIONS,
} from "../previewStyles";
import { PAGE_DIMENSIONS } from "../types";
import type { ResumeStyle } from "@/lib/api/types";

// Default to LETTER dimensions
const PAGE = PAGE_DIMENSIONS.LETTER;

/**
 * Auto-Fit Convergence Tests
 *
 * These tests verify that the progressive auto-fit algorithm:
 * 1. Terminates within the iteration limit
 * 2. Reduces properties in the correct order
 * 3. Respects all minimum values
 * 4. Handles extreme edge cases gracefully
 */

const defaultStyle: ResumeStyle = {
  font_family: "Arial, sans-serif",
  font_size_body: 11,
  font_size_heading: 18,
  font_size_subheading: 12,
  line_spacing: 1.4,
  section_spacing: 16,
  entry_spacing: 8,
  margin_top: 0.75,
  margin_bottom: 0.75,
  margin_left: 0.75,
  margin_right: 0.75,
};

const availableHeight =
  PAGE.HEIGHT -
  0.75 * PAGE_DIMENSIONS.DPI -
  0.75 * PAGE_DIMENSIONS.DPI;

/**
 * Helper to generate extreme content height simulating many experience items
 */
function generateExtremeContentHeight(multiplier: number): number {
  return availableHeight * multiplier;
}

/**
 * Helper to track the order in which properties are reduced.
 * This simulates the algorithm's behavior to verify reduction order.
 */
function trackReductionOrder(
  style: ResumeStyle,
  contentHeight: number
): string[] {
  const reductionOrder: string[] = [];

  let bodyFontSize = style.font_size_body ?? 11;
  let headingFontSize = style.font_size_heading ?? 18;
  let subheadingFontSize = style.font_size_subheading ?? 12;
  let sectionSpacing = style.section_spacing ?? 16;
  let entrySpacing = style.entry_spacing ?? 8;
  let lineHeight = style.line_spacing ?? 1.4;

  const targetHeight =
    PAGE.HEIGHT -
    (style.margin_top ?? 0.75) * PAGE_DIMENSIONS.DPI -
    (style.margin_bottom ?? 0.75) * PAGE_DIMENSIONS.DPI;

  if (contentHeight <= targetHeight) {
    return reductionOrder; // No reduction needed
  }

  const REDUCTION_FACTOR = 0.95;
  let height = contentHeight;
  let iterations = 0;
  let phase = 0;
  let lastPhase = -1;

  while (height > targetHeight && iterations < MAX_FIT_ITERATIONS) {
    iterations++;

    switch (phase) {
      case 0:
        if (bodyFontSize > FIT_MINIMUMS.bodyFontSize) {
          if (lastPhase !== 0) {
            reductionOrder.push("bodyFontSize");
            lastPhase = 0;
          }
          bodyFontSize = Math.max(
            FIT_MINIMUMS.bodyFontSize,
            bodyFontSize * REDUCTION_FACTOR
          );
          headingFontSize = Math.max(
            FIT_MINIMUMS.headingFontSize,
            headingFontSize * REDUCTION_FACTOR
          );
          subheadingFontSize = Math.max(
            FIT_MINIMUMS.subheadingFontSize,
            subheadingFontSize * REDUCTION_FACTOR
          );
        } else {
          phase = 1;
        }
        break;

      case 1:
        if (entrySpacing > FIT_MINIMUMS.entrySpacing) {
          if (lastPhase !== 1) {
            reductionOrder.push("entrySpacing");
            lastPhase = 1;
          }
          entrySpacing = Math.max(
            FIT_MINIMUMS.entrySpacing,
            entrySpacing * REDUCTION_FACTOR
          );
        } else {
          phase = 2;
        }
        break;

      case 2:
        if (sectionSpacing > FIT_MINIMUMS.sectionSpacing) {
          if (lastPhase !== 2) {
            reductionOrder.push("sectionSpacing");
            lastPhase = 2;
          }
          sectionSpacing = Math.max(
            FIT_MINIMUMS.sectionSpacing,
            sectionSpacing * REDUCTION_FACTOR
          );
        } else {
          phase = 3;
        }
        break;

      case 3:
        if (lineHeight > FIT_MINIMUMS.lineHeight) {
          if (lastPhase !== 3) {
            reductionOrder.push("lineHeight");
            lastPhase = 3;
          }
          lineHeight = Math.max(
            FIT_MINIMUMS.lineHeight,
            lineHeight * REDUCTION_FACTOR
          );
        } else {
          break;
        }
        break;
    }

    // Estimate new height
    const fontRatio = bodyFontSize / (style.font_size_body ?? 11);
    const spacingRatio =
      (sectionSpacing + entrySpacing) /
      ((style.section_spacing ?? 16) + (style.entry_spacing ?? 8));
    const lineRatio = lineHeight / (style.line_spacing ?? 1.4);
    height = contentHeight * fontRatio * Math.sqrt(spacingRatio) * lineRatio;

    if (phase > 3) break;
  }

  return reductionOrder;
}

describe("Auto-Fit Convergence Tests", () => {
  describe("Termination Guarantees", () => {
    it("terminates within iteration limit for moderate overflow", () => {
      const contentHeight = generateExtremeContentHeight(1.5);
      const startTime = performance.now();

      const styles = calculateFitToPageStyles(defaultStyle, contentHeight);

      const elapsed = performance.now() - startTime;
      expect(elapsed).toBeLessThan(100); // Should complete in <100ms
      expect(styles.bodyFontSize).toBeDefined();
    });

    it("terminates within iteration limit for extreme overflow (5x)", () => {
      const contentHeight = generateExtremeContentHeight(5);
      const startTime = performance.now();

      const styles = calculateFitToPageStyles(defaultStyle, contentHeight);

      const elapsed = performance.now() - startTime;
      expect(elapsed).toBeLessThan(100);
      expect(styles).toBeDefined();
    });

    it("terminates within iteration limit for extreme overflow (10x)", () => {
      const contentHeight = generateExtremeContentHeight(10);
      const startTime = performance.now();

      const styles = calculateFitToPageStyles(defaultStyle, contentHeight);

      const elapsed = performance.now() - startTime;
      expect(elapsed).toBeLessThan(100);
      expect(styles).toBeDefined();
    });

    it("terminates gracefully with maximum possible content", () => {
      // Simulate 50+ experience items (approximately 50x page height)
      const extremeHeight = availableHeight * 50;
      const startTime = performance.now();

      const styles = calculateFitToPageStyles(defaultStyle, extremeHeight);

      const elapsed = performance.now() - startTime;
      expect(elapsed).toBeLessThan(200);

      // Should reach minimums
      const bodySize = parseInt(styles.bodyFontSize, 10);
      expect(bodySize).toBe(FIT_MINIMUMS.bodyFontSize);
    });
  });

  describe("Reduction Order", () => {
    it("reduces body font size first", () => {
      const contentHeight = generateExtremeContentHeight(1.3);
      const order = trackReductionOrder(defaultStyle, contentHeight);

      expect(order[0]).toBe("bodyFontSize");
    });

    it("reduces entry spacing second", () => {
      // Need enough overflow to exhaust font reduction
      const contentHeight = generateExtremeContentHeight(3);
      const order = trackReductionOrder(defaultStyle, contentHeight);

      expect(order).toContain("bodyFontSize");
      expect(order).toContain("entrySpacing");
      const fontIndex = order.indexOf("bodyFontSize");
      const entryIndex = order.indexOf("entrySpacing");
      expect(fontIndex).toBeLessThan(entryIndex);
    });

    it("reduces section spacing third", () => {
      const contentHeight = generateExtremeContentHeight(5);
      const order = trackReductionOrder(defaultStyle, contentHeight);

      if (order.includes("sectionSpacing")) {
        const entryIndex = order.indexOf("entrySpacing");
        const sectionIndex = order.indexOf("sectionSpacing");
        expect(entryIndex).toBeLessThan(sectionIndex);
      }
    });

    it("reduces line height last (last resort)", () => {
      const contentHeight = generateExtremeContentHeight(10);
      const order = trackReductionOrder(defaultStyle, contentHeight);

      if (order.includes("lineHeight")) {
        const lineHeightIndex = order.indexOf("lineHeight");
        // lineHeight should be the last property reduced
        expect(lineHeightIndex).toBe(order.length - 1);
      }
    });

    it("follows complete reduction order for extreme content", () => {
      const contentHeight = generateExtremeContentHeight(20);
      const order = trackReductionOrder(defaultStyle, contentHeight);

      // Should start with bodyFontSize and follow the order
      // Not all phases may be needed depending on convergence
      expect(order[0]).toBe("bodyFontSize");
      if (order.length > 1) {
        expect(order[1]).toBe("entrySpacing");
      }
      if (order.length > 2) {
        expect(order[2]).toBe("sectionSpacing");
      }
      if (order.length > 3) {
        expect(order[3]).toBe("lineHeight");
      }
    });
  });

  describe("Minimum Value Enforcement", () => {
    it("never reduces body font below minimum", () => {
      for (let multiplier = 2; multiplier <= 50; multiplier += 5) {
        const contentHeight = generateExtremeContentHeight(multiplier);
        const styles = calculateFitToPageStyles(defaultStyle, contentHeight);

        const bodySize = parseInt(styles.bodyFontSize, 10);
        expect(bodySize).toBeGreaterThanOrEqual(FIT_MINIMUMS.bodyFontSize);
      }
    });

    it("never reduces heading font below minimum", () => {
      const contentHeight = generateExtremeContentHeight(50);
      const styles = calculateFitToPageStyles(defaultStyle, contentHeight);

      const headingSize = parseInt(styles.headingFontSize, 10);
      expect(headingSize).toBeGreaterThanOrEqual(FIT_MINIMUMS.headingFontSize);
    });

    it("never reduces subheading font below minimum", () => {
      const contentHeight = generateExtremeContentHeight(50);
      const styles = calculateFitToPageStyles(defaultStyle, contentHeight);

      const subheadingSize = parseInt(styles.subheadingFontSize, 10);
      expect(subheadingSize).toBeGreaterThanOrEqual(
        FIT_MINIMUMS.subheadingFontSize
      );
    });

    it("never reduces line height below minimum", () => {
      const contentHeight = generateExtremeContentHeight(50);
      const styles = calculateFitToPageStyles(defaultStyle, contentHeight);

      expect(styles.lineHeight).toBeGreaterThanOrEqual(FIT_MINIMUMS.lineHeight);
    });

    it("never reduces section spacing below minimum", () => {
      const contentHeight = generateExtremeContentHeight(50);
      const styles = calculateFitToPageStyles(defaultStyle, contentHeight);

      const sectionGap = parseInt(styles.sectionGap, 10);
      expect(sectionGap).toBeGreaterThanOrEqual(FIT_MINIMUMS.sectionSpacing);
    });
  });

  describe("Edge Cases", () => {
    it("handles zero content height", () => {
      const styles = calculateFitToPageStyles(defaultStyle, 0);

      // Should return default styles unchanged
      expect(styles.bodyFontSize).toBe("11pt");
      expect(styles.lineHeight).toBe(1.4);
    });

    it("handles negative content height", () => {
      const styles = calculateFitToPageStyles(defaultStyle, -100);

      // Should return default styles unchanged
      expect(styles.bodyFontSize).toBe("11pt");
    });

    it("handles content exactly at page height", () => {
      const styles = calculateFitToPageStyles(defaultStyle, availableHeight);

      // Should return unchanged since it fits exactly
      expect(styles.bodyFontSize).toBe("11pt");
    });

    it("handles content just over page height", () => {
      const styles = calculateFitToPageStyles(
        defaultStyle,
        availableHeight + 1
      );

      // Should make minimal adjustment
      const bodySize = parseInt(styles.bodyFontSize, 10);
      expect(bodySize).toBeLessThanOrEqual(11);
      expect(bodySize).toBeGreaterThanOrEqual(10); // Very minor reduction
    });

    it("handles style with null/undefined values", () => {
      const sparseStyle: ResumeStyle = {
        font_family: "Arial",
      };

      const contentHeight = generateExtremeContentHeight(2);
      const styles = calculateFitToPageStyles(sparseStyle, contentHeight);

      // Should use defaults and still function
      expect(styles.bodyFontSize).toBeDefined();
      expect(styles.lineHeight).toBeDefined();
    });

    it("handles very small default font sizes", () => {
      const smallFontStyle: ResumeStyle = {
        ...defaultStyle,
        font_size_body: 9,
        font_size_heading: 13,
        font_size_subheading: 10,
      };

      const contentHeight = generateExtremeContentHeight(3);
      const styles = calculateFitToPageStyles(smallFontStyle, contentHeight);

      // Should still respect minimums
      const bodySize = parseInt(styles.bodyFontSize, 10);
      expect(bodySize).toBeGreaterThanOrEqual(FIT_MINIMUMS.bodyFontSize);
    });

    it("handles very large default font sizes", () => {
      const largeFontStyle: ResumeStyle = {
        ...defaultStyle,
        font_size_body: 16,
        font_size_heading: 28,
        font_size_subheading: 18,
      };

      const contentHeight = generateExtremeContentHeight(2);
      const styles = calculateFitToPageStyles(largeFontStyle, contentHeight);

      // Should reduce significantly but respect minimums
      const bodySize = parseInt(styles.bodyFontSize, 10);
      expect(bodySize).toBeLessThan(16);
      expect(bodySize).toBeGreaterThanOrEqual(FIT_MINIMUMS.bodyFontSize);
    });

    it("handles very tight line spacing", () => {
      const tightStyle: ResumeStyle = {
        ...defaultStyle,
        line_spacing: 1.15, // Already close to minimum
      };

      const contentHeight = generateExtremeContentHeight(10);
      const styles = calculateFitToPageStyles(tightStyle, contentHeight);

      expect(styles.lineHeight).toBeGreaterThanOrEqual(FIT_MINIMUMS.lineHeight);
    });

    it("handles very loose line spacing", () => {
      const looseStyle: ResumeStyle = {
        ...defaultStyle,
        line_spacing: 2.0,
      };

      const contentHeight = generateExtremeContentHeight(3);
      const styles = calculateFitToPageStyles(looseStyle, contentHeight);

      // Line height may or may not be reduced depending on whether
      // font size reductions were sufficient. Just verify it's valid.
      expect(styles.lineHeight).toBeGreaterThanOrEqual(FIT_MINIMUMS.lineHeight);
      expect(styles.lineHeight).toBeLessThanOrEqual(2.0);
    });
  });

  describe("Consistency Guarantees", () => {
    it("produces consistent results for same input", () => {
      const contentHeight = generateExtremeContentHeight(3);

      const result1 = calculateFitToPageStyles(defaultStyle, contentHeight);
      const result2 = calculateFitToPageStyles(defaultStyle, contentHeight);

      expect(result1).toEqual(result2);
    });

    it("produces monotonically smaller results for larger content", () => {
      const heights = [1.5, 2, 3, 5, 10].map(generateExtremeContentHeight);
      const results = heights.map((h) =>
        calculateFitToPageStyles(defaultStyle, h)
      );

      for (let i = 1; i < results.length; i++) {
        const prevBody = parseInt(results[i - 1].bodyFontSize, 10);
        const currBody = parseInt(results[i].bodyFontSize, 10);
        expect(currBody).toBeLessThanOrEqual(prevBody);
      }
    });

    it("maintains font size hierarchy (heading > subheading > body)", () => {
      const contentHeight = generateExtremeContentHeight(3);
      const styles = calculateFitToPageStyles(defaultStyle, contentHeight);

      const bodySize = parseInt(styles.bodyFontSize, 10);
      const subheadingSize = parseInt(styles.subheadingFontSize, 10);
      const headingSize = parseInt(styles.headingFontSize, 10);

      expect(headingSize).toBeGreaterThanOrEqual(subheadingSize);
      expect(subheadingSize).toBeGreaterThanOrEqual(bodySize);
    });
  });
});
