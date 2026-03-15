"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import type { ResumePreviewProps } from "./types";
import { PAGE_DIMENSIONS } from "./types";
import { PreviewPage } from "./PreviewPage";
import { PreviewSection } from "./PreviewSection";
import { PreviewPagination } from "./PreviewPagination";
import { usePageBreaks } from "./usePageBreaks";
import { computePreviewStyles } from "./previewStyles";

// Default to LETTER dimensions
const PAGE = PAGE_DIMENSIONS.LETTER;

export function ResumePreview({
  content,
  style,
  sectionOrder,
  activeSection,
  onSectionClick,
  fitToOnePage = false,
  highlightedKeywords = [],
  className,
}: ResumePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  // Calculate pagination
  const { pages, totalPages } = usePageBreaks({
    content,
    style,
    sectionOrder,
  });

  // Compute CSS styles from ResumeStyle
  const computedStyles = useMemo(() => computePreviewStyles(style), [style]);

  // Auto-scale to fit container width
  useEffect(() => {
    if (!containerRef.current) return;

    const updateScale = () => {
      const containerWidth =
        containerRef.current?.clientWidth ?? PAGE.WIDTH;
      const newScale = Math.min(1, (containerWidth - 40) / PAGE.WIDTH);
      setScale(newScale);
    };

    updateScale();
    const resizeObserver = new ResizeObserver(updateScale);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  // When fitToOnePage is enabled, useAutoFit has already adjusted the style.
  // We only need to compute CSS values, NOT reduce further.
  const adjustedStyles = computedStyles;

  // Get sections for current page
  const currentPageSections = pages[currentPage - 1]?.sections ?? [];

  return (
    <div
      ref={containerRef}
      className={`resume-preview-container flex flex-col items-center w-full ${className ?? ""}`}
    >
      <PreviewPage
        pageNumber={currentPage}
        totalPages={totalPages}
        style={style}
        scale={scale}
      >
        {currentPageSections.map((slice) => (
          <PreviewSection
            key={`${slice.section}-${slice.startIndex ?? 0}`}
            section={slice.section}
            content={content}
            style={adjustedStyles}
            isActive={activeSection === slice.section}
            slice={slice}
            highlightedKeywords={highlightedKeywords}
            onClick={() => onSectionClick?.(slice.section)}
          />
        ))}
      </PreviewPage>

      {totalPages > 1 && (
        <PreviewPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}
