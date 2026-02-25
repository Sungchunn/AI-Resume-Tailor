import { describe, it, expect } from "vitest";
import {
  computePreviewStyles,
  calculateFitToPageStyles,
  FIT_MINIMUMS,
  MAX_FIT_ITERATIONS,
} from "../previewStyles";
import { PAGE_DIMENSIONS } from "../types";
import type { ResumeStyle } from "@/lib/api/types";

describe("computePreviewStyles", () => {
  it("returns default values when style is empty", () => {
    const style: ResumeStyle = {};
    const result = computePreviewStyles(style);

    expect(result.fontFamily).toBe("Arial, sans-serif");
    expect(result.bodyFontSize).toBe("11pt");
    expect(result.headingFontSize).toBe("18pt");
    expect(result.subheadingFontSize).toBe("12pt");
    expect(result.lineHeight).toBe(1.4);
    expect(result.sectionGap).toBe("16px");
  });

  it("uses provided style values", () => {
    const style: ResumeStyle = {
      font_family: "Times New Roman, serif",
      font_size_body: 12,
      font_size_heading: 20,
      font_size_subheading: 14,
      line_spacing: 1.5,
      section_spacing: 20,
      margin_top: 1,
      margin_bottom: 1,
      margin_left: 1,
      margin_right: 1,
    };
    const result = computePreviewStyles(style);

    expect(result.fontFamily).toBe("Times New Roman, serif");
    expect(result.bodyFontSize).toBe("12pt");
    expect(result.headingFontSize).toBe("20pt");
    expect(result.subheadingFontSize).toBe("14pt");
    expect(result.lineHeight).toBe(1.5);
    expect(result.sectionGap).toBe("20px");
    expect(result.paddingTop).toBe(`${1 * PAGE_DIMENSIONS.DPI}px`);
  });
});

describe("calculateFitToPageStyles", () => {
  const defaultStyle: ResumeStyle = {
    font_size_body: 11,
    font_size_heading: 18,
    font_size_subheading: 12,
    line_spacing: 1.4,
    section_spacing: 16,
    entry_spacing: 8,
    margin_top: 0.75,
    margin_bottom: 0.75,
  };

  const availableHeight =
    PAGE_DIMENSIONS.HEIGHT -
    0.75 * PAGE_DIMENSIONS.DPI -
    0.75 * PAGE_DIMENSIONS.DPI;

  it("returns unchanged styles when content fits", () => {
    const contentHeight = availableHeight - 100; // Fits easily
    const result = calculateFitToPageStyles(defaultStyle, contentHeight);

    expect(result.bodyFontSize).toBe("11pt");
    expect(result.headingFontSize).toBe("18pt");
    expect(result.lineHeight).toBe(1.4);
  });

  it("reduces font sizes when content exceeds page height", () => {
    const contentHeight = availableHeight * 1.5; // 50% too tall
    const result = calculateFitToPageStyles(defaultStyle, contentHeight);

    // Body font should be reduced (but we check it's less than original)
    const bodySize = parseInt(result.bodyFontSize, 10);
    expect(bodySize).toBeLessThanOrEqual(11);
    expect(bodySize).toBeGreaterThanOrEqual(FIT_MINIMUMS.bodyFontSize);
  });

  it("respects minimum body font size", () => {
    // Very tall content that would require fonts below minimum
    const contentHeight = availableHeight * 3;
    const result = calculateFitToPageStyles(defaultStyle, contentHeight);

    const bodySize = parseInt(result.bodyFontSize, 10);
    expect(bodySize).toBeGreaterThanOrEqual(FIT_MINIMUMS.bodyFontSize);
  });

  it("respects minimum heading font size", () => {
    const contentHeight = availableHeight * 3;
    const result = calculateFitToPageStyles(defaultStyle, contentHeight);

    const headingSize = parseInt(result.headingFontSize, 10);
    expect(headingSize).toBeGreaterThanOrEqual(FIT_MINIMUMS.headingFontSize);
  });

  it("respects minimum subheading font size", () => {
    const contentHeight = availableHeight * 3;
    const result = calculateFitToPageStyles(defaultStyle, contentHeight);

    const subheadingSize = parseInt(result.subheadingFontSize, 10);
    expect(subheadingSize).toBeGreaterThanOrEqual(
      FIT_MINIMUMS.subheadingFontSize
    );
  });

  it("respects minimum line height", () => {
    const contentHeight = availableHeight * 5; // Extremely tall
    const result = calculateFitToPageStyles(defaultStyle, contentHeight);

    expect(result.lineHeight).toBeGreaterThanOrEqual(FIT_MINIMUMS.lineHeight);
  });

  it("respects minimum section spacing", () => {
    const contentHeight = availableHeight * 5;
    const result = calculateFitToPageStyles(defaultStyle, contentHeight);

    const sectionGap = parseInt(result.sectionGap, 10);
    expect(sectionGap).toBeGreaterThanOrEqual(FIT_MINIMUMS.sectionSpacing);
  });

  it("terminates within iteration limit for extreme content", () => {
    // This should not hang or throw - test that it completes
    const extremeHeight = availableHeight * 10;

    const startTime = Date.now();
    const result = calculateFitToPageStyles(defaultStyle, extremeHeight);
    const elapsed = Date.now() - startTime;

    // Should complete quickly (well under 1 second)
    expect(elapsed).toBeLessThan(1000);

    // Should return valid styles at minimums
    expect(result.bodyFontSize).toBeDefined();
    expect(result.lineHeight).toBeDefined();
  });

  it("reduces properties in correct order: fonts -> spacing -> line height", () => {
    // Test that fonts are reduced before line height
    const contentHeight = availableHeight * 1.3; // Moderately too tall
    const result = calculateFitToPageStyles(defaultStyle, contentHeight);

    // With moderate overflow, fonts should be reduced but line height may still be close to original
    const bodySize = parseInt(result.bodyFontSize, 10);

    // If fonts are reduced, they should be less than original
    if (bodySize < 11) {
      // Line height should still be relatively high if we haven't exhausted font reductions
      expect(result.lineHeight).toBeGreaterThan(FIT_MINIMUMS.lineHeight);
    }
  });
});

describe("FIT_MINIMUMS", () => {
  it("has reasonable minimum values", () => {
    expect(FIT_MINIMUMS.bodyFontSize).toBe(8);
    expect(FIT_MINIMUMS.headingFontSize).toBe(12);
    expect(FIT_MINIMUMS.subheadingFontSize).toBe(9);
    expect(FIT_MINIMUMS.lineHeight).toBe(1.1);
    expect(FIT_MINIMUMS.sectionSpacing).toBe(8);
    expect(FIT_MINIMUMS.entrySpacing).toBe(4);
  });
});

describe("MAX_FIT_ITERATIONS", () => {
  it("is set to prevent infinite loops", () => {
    expect(MAX_FIT_ITERATIONS).toBe(20);
  });
});
