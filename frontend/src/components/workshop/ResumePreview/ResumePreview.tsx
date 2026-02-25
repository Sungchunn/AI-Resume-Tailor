"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import type { ResumePreviewProps } from "./types";
import { PAGE_DIMENSIONS } from "./types";
import { PreviewPage } from "./PreviewPage";
import { PreviewSection } from "./PreviewSection";
import { PreviewPagination } from "./PreviewPagination";
import { usePageBreaks } from "./usePageBreaks";
import { computePreviewStyles, calculateFitToPageStyles } from "./previewStyles";

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
  const { pages, totalPages, exceedsOnePage, currentContentHeight } =
    usePageBreaks({
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
        containerRef.current?.clientWidth ?? PAGE_DIMENSIONS.WIDTH;
      const newScale = Math.min(1, (containerWidth - 40) / PAGE_DIMENSIONS.WIDTH);
      setScale(newScale);
    };

    updateScale();
    const resizeObserver = new ResizeObserver(updateScale);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  // Fit-to-one-page logic: reduce font sizes proportionally
  const adjustedStyles =
    fitToOnePage && exceedsOnePage
      ? calculateFitToPageStyles(style, currentContentHeight)
      : computedStyles;

  // Get sections for current page
  const currentPageSections = pages[currentPage - 1]?.sections ?? [];

  return (
    <div
      ref={containerRef}
      className={`resume-preview-container flex flex-col items-center ${className ?? ""}`}
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
