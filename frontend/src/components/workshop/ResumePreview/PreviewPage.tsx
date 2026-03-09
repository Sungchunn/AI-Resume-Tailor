"use client";

import type { PreviewPageProps } from "./types";
import { PAGE_DIMENSIONS } from "./types";

// Default to LETTER dimensions
const PAGE = PAGE_DIMENSIONS.LETTER;

export function PreviewPage({
  children,
  pageNumber,
  totalPages,
  style,
  scale,
}: PreviewPageProps) {
  const marginTop = (style.margin_top ?? 0.75) * PAGE_DIMENSIONS.DPI;
  const marginBottom = (style.margin_bottom ?? 0.75) * PAGE_DIMENSIONS.DPI;
  const marginLeft = (style.margin_left ?? 0.75) * PAGE_DIMENSIONS.DPI;
  const marginRight = (style.margin_right ?? 0.75) * PAGE_DIMENSIONS.DPI;

  return (
    <div
      className="preview-page bg-card shadow-lg rounded-sm"
      style={{
        width: PAGE.WIDTH,
        minHeight: PAGE.HEIGHT,
        transform: `scale(${scale})`,
        transformOrigin: "top center",
        paddingTop: marginTop,
        paddingBottom: marginBottom,
        paddingLeft: marginLeft,
        paddingRight: marginRight,
        fontFamily: style.font_family ?? "Arial, sans-serif",
      }}
    >
      {children}
    </div>
  );
}
