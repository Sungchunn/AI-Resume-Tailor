import type { ResumeStyle } from "@/lib/api/types";
import type { ComputedPreviewStyle } from "./types";
import { PAGE_DIMENSIONS } from "./types";

export function computePreviewStyles(style: ResumeStyle): ComputedPreviewStyle {
  return {
    fontFamily: style.font_family ?? "Arial, sans-serif",
    bodyFontSize: `${style.font_size_body ?? 11}pt`,
    headingFontSize: `${style.font_size_heading ?? 18}pt`,
    subheadingFontSize: `${style.font_size_subheading ?? 12}pt`,
    lineHeight: style.line_spacing ?? 1.4,
    sectionGap: `${style.section_spacing ?? 16}px`,
    paddingTop: `${(style.margin_top ?? 0.75) * PAGE_DIMENSIONS.DPI}px`,
    paddingBottom: `${(style.margin_bottom ?? 0.75) * PAGE_DIMENSIONS.DPI}px`,
    paddingLeft: `${(style.margin_left ?? 0.75) * PAGE_DIMENSIONS.DPI}px`,
    paddingRight: `${(style.margin_right ?? 0.75) * PAGE_DIMENSIONS.DPI}px`,
  };
}

export function calculateFitToPageStyles(
  style: ResumeStyle,
  currentHeight: number
): ComputedPreviewStyle {
  const targetHeight =
    PAGE_DIMENSIONS.HEIGHT -
    (style.margin_top ?? 0.75) * PAGE_DIMENSIONS.DPI -
    (style.margin_bottom ?? 0.75) * PAGE_DIMENSIONS.DPI;

  // Calculate scale factor needed to fit content
  const scaleFactor = Math.min(1, targetHeight / currentHeight);

  // Apply scale to font sizes (minimum 8pt)
  const scaledBodySize = Math.max(
    8,
    Math.floor((style.font_size_body ?? 11) * scaleFactor)
  );
  const scaledHeadingSize = Math.max(
    12,
    Math.floor((style.font_size_heading ?? 18) * scaleFactor)
  );
  const scaledSubheadingSize = Math.max(
    9,
    Math.floor((style.font_size_subheading ?? 12) * scaleFactor)
  );

  const baseStyles = computePreviewStyles(style);

  return {
    ...baseStyles,
    bodyFontSize: `${scaledBodySize}pt`,
    headingFontSize: `${scaledHeadingSize}pt`,
    subheadingFontSize: `${scaledSubheadingSize}pt`,
    lineHeight: Math.max(1.1, (style.line_spacing ?? 1.4) * scaleFactor),
    sectionGap: `${Math.max(8, (style.section_spacing ?? 16) * scaleFactor)}px`,
  };
}
