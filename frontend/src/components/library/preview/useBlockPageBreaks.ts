"use client";

import { useState, useLayoutEffect } from "react";
import type { AnyResumeBlock, BlockEditorStyle } from "@/lib/resume/types";
import { PAGE_DIMENSIONS } from "./types";

/**
 * Represents the content assignment for a single page
 */
export interface BlockPageContent {
  pageNumber: number;
  blockIds: string[];
}

/**
 * Result from the useBlockPageBreaks hook
 */
export interface BlockPageBreakResult {
  /** Array of pages with their assigned block IDs */
  pages: BlockPageContent[];
  /** Total number of pages */
  totalPages: number;
  /** Map from blockId to page number for quick lookup */
  blockPageMap: Map<string, number>;
  /** Whether content exceeds one page */
  exceedsOnePage: boolean;
  /** Estimated total content height in pixels */
  totalContentHeight: number;
}

interface UseBlockPageBreaksOptions {
  blocks: AnyResumeBlock[];
  style: BlockEditorStyle;
}

/**
 * Estimates the height of a block based on its type and content
 * Heights are in pixels, designed for 96 DPI rendering
 */
function estimateBlockHeight(
  block: AnyResumeBlock,
  style: BlockEditorStyle
): number {
  const lineHeight = style.lineSpacing * style.fontSizeBody;
  const sectionHeaderHeight = 32; // Section title + border
  const sectionSpacing = style.sectionSpacing;
  const entrySpacing = style.entrySpacing;

  switch (block.type) {
    case "contact": {
      // Contact block: name + single line of contact details
      // No section header for contact
      const content = block.content;
      let lines = 1; // Name line
      // Contact details line (email, phone, location, links)
      const hasDetails = content.email || content.phone || content.location ||
        content.linkedin || content.website || content.github;
      if (hasDetails) lines += 1;
      return lines * lineHeight * 1.5 + sectionSpacing;
    }

    case "summary": {
      // Summary: header + paragraph text
      const content = block.content;
      // Estimate lines based on character count (~80 chars per line)
      const estimatedLines = Math.max(1, Math.ceil(content.length / 80));
      return sectionHeaderHeight + estimatedLines * lineHeight + sectionSpacing;
    }

    case "experience": {
      // Experience: header + entries (title line + company line + bullets)
      const entries = block.content;
      let height = sectionHeaderHeight;
      for (const entry of entries) {
        height += 24; // Title line
        height += 18; // Company/location/dates line
        height += entry.bullets.length * lineHeight * 1.2; // Bullets
        height += entrySpacing;
      }
      return height + sectionSpacing;
    }

    case "education": {
      // Education: header + entries (degree line + institution line + details)
      const entries = block.content;
      let height = sectionHeaderHeight;
      for (const entry of entries) {
        height += 22; // Degree line
        height += 18; // Institution/dates line
        if (entry.gpa || entry.honors) height += 16; // Details line
        if (entry.relevantCourses && entry.relevantCourses.length > 0) {
          height += Math.ceil(entry.relevantCourses.length / 4) * 18;
        }
        height += entrySpacing;
      }
      return height + sectionSpacing;
    }

    case "skills": {
      // Skills: header + grid of skill badges
      const skills = block.content;
      // Estimate ~4 skills per row
      const rows = Math.max(1, Math.ceil(skills.length / 4));
      return sectionHeaderHeight + rows * 28 + sectionSpacing;
    }

    case "certifications": {
      // Certifications: header + entries
      const entries = block.content;
      let height = sectionHeaderHeight;
      for (const entry of entries) {
        height += 20; // Name line
        height += 16; // Issuer/date line
        height += entrySpacing;
      }
      return height + sectionSpacing;
    }

    case "projects": {
      // Projects: header + entries (name + description + technologies + bullets)
      const entries = block.content;
      let height = sectionHeaderHeight;
      for (const entry of entries) {
        height += 22; // Project name
        if (entry.description) {
          height += Math.ceil(entry.description.length / 80) * lineHeight;
        }
        if (entry.technologies && entry.technologies.length > 0) {
          height += 24; // Tech stack line
        }
        if (entry.bullets && entry.bullets.length > 0) {
          height += entry.bullets.length * lineHeight * 1.2;
        }
        height += entrySpacing;
      }
      return height + sectionSpacing;
    }

    case "languages": {
      // Languages: header + compact list
      const entries = block.content;
      // Estimate ~3 languages per row in compact view
      const rows = Math.max(1, Math.ceil(entries.length / 3));
      return sectionHeaderHeight + rows * 24 + sectionSpacing;
    }

    case "volunteer": {
      // Volunteer: similar to experience
      const entries = block.content;
      let height = sectionHeaderHeight;
      for (const entry of entries) {
        height += 22; // Role line
        height += 18; // Organization/dates line
        if (entry.description) {
          height += Math.ceil(entry.description.length / 80) * lineHeight;
        }
        if (entry.bullets && entry.bullets.length > 0) {
          height += entry.bullets.length * lineHeight * 1.2;
        }
        height += entrySpacing;
      }
      return height + sectionSpacing;
    }

    case "publications": {
      // Publications: header + entries
      const entries = block.content;
      let height = sectionHeaderHeight;
      for (const entry of entries) {
        height += 20; // Title line
        height += 16; // Publisher/date line
        if (entry.authors) height += 14;
        if (entry.description) {
          height += Math.ceil(entry.description.length / 80) * lineHeight;
        }
        height += entrySpacing;
      }
      return height + sectionSpacing;
    }

    case "awards": {
      // Awards: header + entries
      const entries = block.content;
      let height = sectionHeaderHeight;
      for (const entry of entries) {
        height += 20; // Title line
        height += 16; // Issuer/date line
        if (entry.description) {
          height += Math.ceil(entry.description.length / 80) * lineHeight;
        }
        height += entrySpacing;
      }
      return height + sectionSpacing;
    }

    case "interests": {
      // Interests: header + text
      const content = block.content;
      const estimatedLines = Math.max(1, Math.ceil(content.length / 80));
      return sectionHeaderHeight + estimatedLines * lineHeight + sectionSpacing;
    }

    case "references": {
      // References: header + entries
      const entries = block.content;
      let height = sectionHeaderHeight;
      for (const entry of entries) {
        height += 20; // Name/title line
        height += 16; // Company line
        if (entry.email || entry.phone) height += 14;
        height += entrySpacing;
      }
      return height + sectionSpacing;
    }

    case "courses": {
      // Courses: header + entries
      const entries = block.content;
      let height = sectionHeaderHeight;
      for (const entry of entries) {
        height += 20; // Name line
        height += 16; // Provider/date line
        if (entry.description) {
          height += Math.ceil(entry.description.length / 80) * lineHeight;
        }
        height += entrySpacing;
      }
      return height + sectionSpacing;
    }

    case "memberships": {
      // Memberships: header + compact entries
      const entries = block.content;
      let height = sectionHeaderHeight;
      for (const entry of entries) {
        height += 20; // Organization/role line
        height += 14; // Dates line
        height += entrySpacing;
      }
      return height + sectionSpacing;
    }

    default:
      // Fallback for unknown block types
      return 100 + sectionSpacing;
  }
}

/**
 * useBlockPageBreaks - Calculate page breaks for block-based resume content
 *
 * This hook estimates block heights and distributes blocks across pages
 * based on available content area (page height minus margins).
 *
 * @param options - Blocks array and style configuration
 * @returns Page break result with block-to-page mapping
 */
export function useBlockPageBreaks({
  blocks,
  style,
}: UseBlockPageBreaksOptions): BlockPageBreakResult {
  const [result, setResult] = useState<BlockPageBreakResult>({
    pages: [{ pageNumber: 1, blockIds: [] }],
    totalPages: 1,
    blockPageMap: new Map(),
    exceedsOnePage: false,
    totalContentHeight: 0,
  });

  useLayoutEffect(() => {
    // Filter hidden blocks and sort by order
    const visibleBlocks = blocks
      .filter((block) => !block.isHidden)
      .sort((a, b) => a.order - b.order);

    if (visibleBlocks.length === 0) {
      setResult({
        pages: [{ pageNumber: 1, blockIds: [] }],
        totalPages: 1,
        blockPageMap: new Map(),
        exceedsOnePage: false,
        totalContentHeight: 0,
      });
      return;
    }

    // Calculate available content height per page
    const pageHeight = PAGE_DIMENSIONS.HEIGHT;
    const marginTop = style.marginTop * PAGE_DIMENSIONS.DPI;
    const marginBottom = style.marginBottom * PAGE_DIMENSIONS.DPI;
    const availableHeight = pageHeight - marginTop - marginBottom;

    // Calculate heights for all blocks
    const blockHeights = new Map<string, number>();
    for (const block of visibleBlocks) {
      blockHeights.set(block.id, estimateBlockHeight(block, style));
    }

    // Distribute blocks across pages
    const pages: BlockPageContent[] = [];
    const blockPageMap = new Map<string, number>();
    let currentPage: string[] = [];
    let currentHeight = 0;
    let totalContentHeight = 0;

    for (const block of visibleBlocks) {
      const blockHeight = blockHeights.get(block.id) ?? 100;
      totalContentHeight += blockHeight;

      // Check if block fits on current page
      if (currentHeight + blockHeight > availableHeight && currentPage.length > 0) {
        // Save current page and start a new one
        pages.push({
          pageNumber: pages.length + 1,
          blockIds: currentPage,
        });
        currentPage = [];
        currentHeight = 0;
      }

      // Add block to current page
      currentPage.push(block.id);
      blockPageMap.set(block.id, pages.length + 1);
      currentHeight += blockHeight;
    }

    // Add remaining blocks to last page
    if (currentPage.length > 0) {
      pages.push({
        pageNumber: pages.length + 1,
        blockIds: currentPage,
      });
    }

    // Ensure at least one page exists
    const finalPages = pages.length > 0 ? pages : [{ pageNumber: 1, blockIds: [] }];

    setResult({
      pages: finalPages,
      totalPages: finalPages.length,
      blockPageMap,
      exceedsOnePage: finalPages.length > 1,
      totalContentHeight,
    });
  }, [blocks, style]);

  return result;
}
