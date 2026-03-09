"use client";

import { useState, useLayoutEffect } from "react";
import type { TailoredContent, ResumeStyle } from "@/lib/api/types";
import type { PageContent, PageBreakResult, SectionSlice } from "./types";
import { PAGE_DIMENSIONS } from "./types";

// Default to LETTER dimensions
const PAGE = PAGE_DIMENSIONS.LETTER;

interface UsePageBreaksOptions {
  content: TailoredContent;
  style: ResumeStyle;
  sectionOrder: string[];
}

export function usePageBreaks({
  content,
  style,
  sectionOrder,
}: UsePageBreaksOptions): PageBreakResult {
  const [result, setResult] = useState<PageBreakResult>({
    pages: [
      {
        pageNumber: 1,
        sections: sectionOrder.map((s) => ({ section: s, isPartial: false })),
      },
    ],
    totalPages: 1,
    currentContentHeight: 0,
    exceedsOnePage: false,
  });

  useLayoutEffect(() => {
    // Calculate available content height per page
    const pageHeight = PAGE.HEIGHT;
    const marginTop = (style.margin_top ?? 0.75) * PAGE_DIMENSIONS.DPI;
    const marginBottom = (style.margin_bottom ?? 0.75) * PAGE_DIMENSIONS.DPI;
    const availableHeight = pageHeight - marginTop - marginBottom;

    // Estimate heights based on content (simplified calculation)
    // These are rough estimates that work well for typical resume content
    const lineHeight = (style.line_spacing ?? 1.4) * (style.font_size_body ?? 11);
    const sectionHeaderHeight = 40;
    const sectionSpacing = style.section_spacing ?? 16;

    const estimatedHeights: Record<string, number> = {
      summary: sectionHeaderHeight + Math.ceil(content.summary.length / 80) * lineHeight + sectionSpacing,
      experience:
        sectionHeaderHeight +
        content.experience.reduce((acc, exp) => {
          // Title + company line + bullets
          return acc + 50 + exp.bullets.length * lineHeight * 1.2 + 20;
        }, 0) +
        sectionSpacing,
      skills:
        sectionHeaderHeight +
        Math.ceil(content.skills.length / 4) * 35 +
        sectionSpacing,
      highlights:
        sectionHeaderHeight +
        content.highlights.length * lineHeight * 1.3 +
        sectionSpacing,
      education: sectionHeaderHeight + 100 + sectionSpacing,
      projects: sectionHeaderHeight + 150 + sectionSpacing,
    };

    let currentHeight = 0;
    const pages: PageContent[] = [];
    let currentPage: SectionSlice[] = [];

    for (const section of sectionOrder) {
      const sectionHeight = estimatedHeights[section] ?? 100;

      if (
        currentHeight + sectionHeight > availableHeight &&
        currentPage.length > 0
      ) {
        // Start new page
        pages.push({ pageNumber: pages.length + 1, sections: currentPage });
        currentPage = [];
        currentHeight = 0;
      }

      currentPage.push({ section, isPartial: false });
      currentHeight += sectionHeight;
    }

    // Add remaining sections to last page
    if (currentPage.length > 0) {
      pages.push({ pageNumber: pages.length + 1, sections: currentPage });
    }

    const totalHeight = sectionOrder.reduce(
      (acc, section) => acc + (estimatedHeights[section] ?? 100),
      0
    );

    setResult({
      pages: pages.length > 0 ? pages : [{ pageNumber: 1, sections: [] }],
      totalPages: pages.length || 1,
      currentContentHeight: totalHeight,
      exceedsOnePage: totalHeight > availableHeight,
    });
  }, [content, style, sectionOrder]);

  return result;
}
