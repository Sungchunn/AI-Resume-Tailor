# Phase A: PDF Preview Component

**Created**: February 25, 2026
**Status**: Ready for Implementation
**Dependencies**: None
**Priority**: P0 (MVP)

---

## Overview

Create a live, paginated PDF-like preview of the resume that updates in real-time as content changes or styles are adjusted.

---

## Technical Decision: CSS-Based Rendering

**Approach**: Pure CSS/HTML rendering with pagination calculation

**Rationale**:

- **Performance**: CSS rendering is fast and integrates naturally with React's rendering cycle
- **Real-time updates**: No canvas redrawing or PDF regeneration overhead
- **Style sync**: Style settings (font, spacing, margins) map directly to CSS properties
- **Complexity**: Simpler than canvas or react-pdf for a live-updating preview
- **Print fidelity**: CSS `@page` rules ensure export matches preview

**Alternatives Rejected**:

- `react-pdf` / `@react-pdf/renderer`: Good for static PDF generation but heavy for live preview
- `jspdf` / Canvas: Requires manual text layout, poor performance for real-time editing
- Backend PDF preview API: Added latency, not suitable for instant feedback

---

## Component Architecture

```text
frontend/src/components/workshop/
└── ResumePreview/
    ├── index.ts                     # Barrel export
    ├── ResumePreview.tsx            # Main preview component
    ├── PreviewPage.tsx              # Single page container
    ├── PreviewSection.tsx           # Section renderer
    ├── PreviewHeader.tsx            # Name, contact info section
    ├── PreviewPagination.tsx        # Page navigation controls
    ├── usePageBreaks.ts             # Hook for calculating page breaks
    ├── previewStyles.ts             # Style constants and calculations
    └── types.ts                     # TypeScript interfaces
```

---

## Interfaces

```typescript
// frontend/src/components/workshop/ResumePreview/types.ts

import type { TailoredContent, ResumeStyle } from "@/lib/api/types";

export interface ResumePreviewProps {
  content: TailoredContent;
  style: ResumeStyle;
  sectionOrder: string[];
  activeSection?: string;
  onSectionClick?: (section: string) => void;
  fitToOnePage?: boolean;
  highlightedKeywords?: string[];
  className?: string;
}

export interface PreviewPageProps {
  children: React.ReactNode;
  pageNumber: number;
  totalPages: number;
  style: ResumeStyle;
  scale: number;
}

export interface PreviewSectionProps {
  section: string;
  content: TailoredContent;
  style: ComputedPreviewStyle;
  isActive: boolean;
  slice?: SectionSlice;
  highlightedKeywords?: string[];
  onHover?: () => void;
  onLeave?: () => void;
  onClick?: () => void;
}

// Page dimension constants (in pixels at 96 DPI)
export const PAGE_DIMENSIONS = {
  WIDTH: 816,   // 8.5 inches
  HEIGHT: 1056, // 11 inches
  DPI: 96,
} as const;

// Style-to-CSS mapping
export interface ComputedPreviewStyle {
  fontFamily: string;
  bodyFontSize: string;
  headingFontSize: string;
  subheadingFontSize: string;
  lineHeight: number;
  sectionGap: string;
  paddingTop: string;
  paddingBottom: string;
  paddingLeft: string;
  paddingRight: string;
}

// Page break calculation types
export interface PageContent {
  pageNumber: number;
  sections: SectionSlice[];
}

export interface SectionSlice {
  section: string;
  startIndex?: number;  // For experience items
  endIndex?: number;
  isPartial: boolean;
}

export interface PageBreakResult {
  pages: PageContent[];
  totalPages: number;
  currentContentHeight: number;
  exceedsOnePage: boolean;
}
```

---

## Implementation Details

### 1. ResumePreview.tsx (Main Component)

```typescript
"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { ResumePreviewProps, ComputedPreviewStyle } from "./types";
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
  const { pages, totalPages, exceedsOnePage, currentContentHeight } = usePageBreaks({
    content,
    style,
    sectionOrder,
    containerRef,
  });

  // Compute CSS styles from ResumeStyle
  const computedStyles = useMemo(() => computePreviewStyles(style), [style]);

  // Auto-scale to fit container width
  useEffect(() => {
    if (!containerRef.current) return;

    const updateScale = () => {
      const containerWidth = containerRef.current?.clientWidth ?? PAGE_DIMENSIONS.WIDTH;
      const newScale = Math.min(1, (containerWidth - 40) / PAGE_DIMENSIONS.WIDTH);
      setScale(newScale);
    };

    updateScale();
    const resizeObserver = new ResizeObserver(updateScale);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  // Fit-to-one-page logic: reduce font sizes proportionally
  const adjustedStyles = fitToOnePage && exceedsOnePage
    ? calculateFitToPageStyles(style, currentContentHeight)
    : computedStyles;

  // Get sections for current page
  const currentPageSections = pages[currentPage - 1]?.sections ?? [];

  return (
    <div
      ref={containerRef}
      className={cn("resume-preview-container flex flex-col items-center", className)}
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
```

### 2. PreviewPage.tsx (Page Container)

```typescript
"use client";

import { cn } from "@/lib/utils";
import type { PreviewPageProps } from "./types";
import { PAGE_DIMENSIONS } from "./types";

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
      className="preview-page bg-white shadow-lg"
      style={{
        width: PAGE_DIMENSIONS.WIDTH,
        minHeight: PAGE_DIMENSIONS.HEIGHT,
        transform: `scale(${scale})`,
        transformOrigin: "top center",
        paddingTop: marginTop,
        paddingBottom: marginBottom,
        paddingLeft: marginLeft,
        paddingRight: marginRight,
      }}
    >
      {children}
    </div>
  );
}
```

### 3. PreviewSection.tsx (Section Renderer)

```typescript
"use client";

import { cn } from "@/lib/utils";
import type { PreviewSectionProps } from "./types";
import type { TailoredContent } from "@/lib/api/types";

export function PreviewSection({
  section,
  content,
  style,
  isActive,
  slice,
  highlightedKeywords = [],
  onClick,
}: PreviewSectionProps) {
  const sectionClasses = cn(
    "preview-section transition-all duration-200 rounded-sm",
    {
      "ring-2 ring-blue-400 ring-offset-2 bg-blue-50/30": isActive,
      "hover:bg-gray-50/50 cursor-pointer": !isActive && onClick,
    }
  );

  // Render based on section type
  const renderSectionContent = () => {
    switch (section) {
      case "summary":
        return <SummarySection content={content.summary} style={style} />;
      case "experience":
        return (
          <ExperienceSection
            items={content.experience}
            style={style}
            startIndex={slice?.startIndex}
            endIndex={slice?.endIndex}
            highlightedKeywords={highlightedKeywords}
          />
        );
      case "skills":
        return <SkillsSection skills={content.skills} style={style} />;
      case "highlights":
        return <HighlightsSection highlights={content.highlights} style={style} />;
      // Add more section types as needed
      default:
        return null;
    }
  };

  return (
    <div className={sectionClasses} onClick={onClick}>
      <h2
        className="font-semibold uppercase tracking-wide border-b border-gray-300 pb-1 mb-2"
        style={{ fontSize: style.subheadingFontSize }}
      >
        {getSectionTitle(section)}
      </h2>
      {renderSectionContent()}
    </div>
  );
}

function getSectionTitle(section: string): string {
  const titles: Record<string, string> = {
    summary: "Professional Summary",
    experience: "Work Experience",
    skills: "Skills",
    highlights: "Key Highlights",
    education: "Education",
    projects: "Projects",
    certifications: "Certifications",
  };
  return titles[section] ?? section;
}

// Sub-components for each section type
function SummarySection({ content, style }: { content: string; style: any }) {
  return (
    <p style={{ fontSize: style.bodyFontSize, lineHeight: style.lineHeight }}>
      {content}
    </p>
  );
}

function ExperienceSection({
  items,
  style,
  startIndex = 0,
  endIndex,
  highlightedKeywords,
}: {
  items: TailoredContent["experience"];
  style: any;
  startIndex?: number;
  endIndex?: number;
  highlightedKeywords: string[];
}) {
  const visibleItems = items.slice(startIndex, endIndex ?? items.length);

  return (
    <div className="space-y-4">
      {visibleItems.map((exp, idx) => (
        <div key={idx}>
          <div className="flex justify-between items-baseline">
            <span className="font-medium">{exp.title}</span>
            <span className="text-sm text-gray-600">
              {exp.start_date} - {exp.end_date}
            </span>
          </div>
          <div className="text-gray-700">{exp.company}</div>
          <ul className="list-disc list-inside mt-1 space-y-1">
            {exp.bullets.map((bullet, bulletIdx) => (
              <li
                key={bulletIdx}
                style={{ fontSize: style.bodyFontSize, lineHeight: style.lineHeight }}
              >
                {highlightKeywords(bullet, highlightedKeywords)}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function SkillsSection({ skills, style }: { skills: string[]; style: any }) {
  return (
    <div
      className="flex flex-wrap gap-2"
      style={{ fontSize: style.bodyFontSize }}
    >
      {skills.map((skill, idx) => (
        <span key={idx} className="bg-gray-100 px-2 py-1 rounded">
          {skill}
        </span>
      ))}
    </div>
  );
}

function HighlightsSection({ highlights, style }: { highlights: string[]; style: any }) {
  return (
    <ul className="list-disc list-inside space-y-1">
      {highlights.map((highlight, idx) => (
        <li
          key={idx}
          style={{ fontSize: style.bodyFontSize, lineHeight: style.lineHeight }}
        >
          {highlight}
        </li>
      ))}
    </ul>
  );
}

// Helper to highlight keywords in text
function highlightKeywords(text: string, keywords: string[]): React.ReactNode {
  if (keywords.length === 0) return text;

  const pattern = new RegExp(`(${keywords.join("|")})`, "gi");
  const parts = text.split(pattern);

  return parts.map((part, idx) =>
    keywords.some((kw) => kw.toLowerCase() === part.toLowerCase()) ? (
      <mark key={idx} className="bg-yellow-200 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}
```

### 4. usePageBreaks.ts (Pagination Hook)

```typescript
"use client";

import { useState, useLayoutEffect, useRef } from "react";
import type { TailoredContent, ResumeStyle } from "@/lib/api/types";
import type { PageContent, PageBreakResult, SectionSlice } from "./types";
import { PAGE_DIMENSIONS } from "./types";

interface UsePageBreaksOptions {
  content: TailoredContent;
  style: ResumeStyle;
  sectionOrder: string[];
  containerRef: React.RefObject<HTMLDivElement>;
}

export function usePageBreaks({
  content,
  style,
  sectionOrder,
  containerRef,
}: UsePageBreaksOptions): PageBreakResult {
  const [result, setResult] = useState<PageBreakResult>({
    pages: [{ pageNumber: 1, sections: sectionOrder.map((s) => ({ section: s, isPartial: false })) }],
    totalPages: 1,
    currentContentHeight: 0,
    exceedsOnePage: false,
  });

  const measureRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    // Calculate available content height per page
    const pageHeight = PAGE_DIMENSIONS.HEIGHT;
    const marginTop = (style.margin_top ?? 0.75) * PAGE_DIMENSIONS.DPI;
    const marginBottom = (style.margin_bottom ?? 0.75) * PAGE_DIMENSIONS.DPI;
    const availableHeight = pageHeight - marginTop - marginBottom;

    // For MVP: Simple estimation based on content
    // TODO: Implement proper measurement with hidden render container
    const estimatedHeights: Record<string, number> = {
      summary: 100,
      experience: content.experience.length * 150,
      skills: Math.ceil(content.skills.length / 5) * 30,
      highlights: content.highlights.length * 25,
      education: 100,
      projects: 150,
    };

    let currentHeight = 0;
    const pages: PageContent[] = [];
    let currentPage: SectionSlice[] = [];

    for (const section of sectionOrder) {
      const sectionHeight = estimatedHeights[section] ?? 100;

      if (currentHeight + sectionHeight > availableHeight && currentPage.length > 0) {
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

    const totalHeight = Object.values(estimatedHeights).reduce((a, b) => a + b, 0);

    setResult({
      pages: pages.length > 0 ? pages : [{ pageNumber: 1, sections: [] }],
      totalPages: pages.length || 1,
      currentContentHeight: totalHeight,
      exceedsOnePage: totalHeight > availableHeight,
    });
  }, [content, style, sectionOrder]);

  return result;
}
```

### 5. previewStyles.ts (Style Calculations)

```typescript
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
    sectionGap: `${(style.section_spacing ?? 16)}px`,
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
    PAGE_DIMENSIONS.HEIGHT -
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
          bodyFontSize = Math.max(FIT_MINIMUMS.bodyFontSize, bodyFontSize * REDUCTION_FACTOR);
          // Scale heading/subheading proportionally
          headingFontSize = Math.max(FIT_MINIMUMS.headingFontSize, headingFontSize * REDUCTION_FACTOR);
          subheadingFontSize = Math.max(FIT_MINIMUMS.subheadingFontSize, subheadingFontSize * REDUCTION_FACTOR);
        } else {
          phase = 1; // Move to next phase
        }
        break;

      case 1: // Reduce entry spacing
        if (entrySpacing > FIT_MINIMUMS.entrySpacing) {
          entrySpacing = Math.max(FIT_MINIMUMS.entrySpacing, entrySpacing * REDUCTION_FACTOR);
        } else {
          phase = 2;
        }
        break;

      case 2: // Reduce section spacing
        if (sectionSpacing > FIT_MINIMUMS.sectionSpacing) {
          sectionSpacing = Math.max(FIT_MINIMUMS.sectionSpacing, sectionSpacing * REDUCTION_FACTOR);
        } else {
          phase = 3;
        }
        break;

      case 3: // Reduce line height (last resort)
        if (lineHeight > FIT_MINIMUMS.lineHeight) {
          lineHeight = Math.max(FIT_MINIMUMS.lineHeight, lineHeight * REDUCTION_FACTOR);
        } else {
          break; // All minimums reached, exit loop
        }
        break;
    }

    // Estimate new height (simple ratio-based estimation)
    // In production, use measureFn for accurate DOM measurement
    const fontRatio = bodyFontSize / (style.font_size_body ?? 11);
    const spacingRatio = (sectionSpacing + entrySpacing) / ((style.section_spacing ?? 16) + (style.entry_spacing ?? 8));
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
    paddingTop: `${(style.margin_top ?? 0.75) * PAGE_DIMENSIONS.DPI}px`,
    paddingBottom: `${(style.margin_bottom ?? 0.75) * PAGE_DIMENSIONS.DPI}px`,
    paddingLeft: `${(style.margin_left ?? 0.75) * PAGE_DIMENSIONS.DPI}px`,
    paddingRight: `${(style.margin_right ?? 0.75) * PAGE_DIMENSIONS.DPI}px`,
  };
}
```

### 6. PreviewPagination.tsx

```typescript
"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

interface PreviewPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function PreviewPagination({
  currentPage,
  totalPages,
  onPageChange,
}: PreviewPaginationProps) {
  return (
    <div className="flex items-center gap-2 mt-4 bg-white rounded-lg shadow px-3 py-2">
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Previous page"
      >
        <ChevronLeftIcon className="w-4 h-4" />
      </button>

      <span className="text-sm text-gray-600 min-w-15 text-center">
        {currentPage} / {totalPages}
      </span>

      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Next page"
      >
        <ChevronRightIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
```

---

## Edge Cases to Handle

| Edge Case | Solution |
| --------- | -------- |
| Content overflow (>2 pages) | Show warning, offer "Fit to One Page" toggle |
| Empty sections | Gracefully hide sections with no content |
| Long bullet points | Wrap text properly, avoid mid-word breaks |
| Font loading | Show skeleton until web fonts load (font-display: swap) |
| Window resize | Debounce scale recalculation with ResizeObserver |
| Print styles | Ensure preview matches actual PDF export |
| Missing contact info | Handle partial header data gracefully |

---

## Dependencies

- No new npm packages required
- Uses existing Tailwind CSS
- Uses ResizeObserver API (native browser support)
- Uses `@heroicons/react` for icons (already installed)

---

## Acceptance Criteria

- [ ] Resume renders in document-like format (white page, proper margins)
- [ ] Page breaks calculated correctly based on content height
- [ ] Pagination controls show and work when >1 page
- [ ] "Fit to one page" toggle reduces font sizes proportionally
- [ ] Style changes (font, spacing) reflect immediately in preview
- [ ] Section hover/click highlights corresponding content
- [ ] Responsive scaling based on container width
- [ ] Keywords can be highlighted in yellow

---

## Testing Strategy

### Unit Tests

- `computePreviewStyles()` returns correct CSS values
- `calculateFitToPageStyles()` progressive reduction works correctly
- `calculateFitToPageStyles()` respects all minimums
- `calculateFitToPageStyles()` terminates within MAX_FIT_ITERATIONS
- `usePageBreaks` calculates pagination correctly

### Component Tests

- `ResumePreview` renders all sections
- `PreviewPagination` navigates correctly
- Section highlighting works on click/hover

### Visual Regression (Critical)

**PDF Export vs Preview Comparison:**

The HTML/CSS preview must match the PDF export exactly. Any mismatch breaks "what you see is what you get."

| Test | Description |
| ---- | ----------- |
| Font rendering | Same fonts render identically in preview and export |
| Spacing | Section/line spacing matches between preview and PDF |
| Page breaks | Content breaks at same points in preview and export |
| Margins | Margin settings produce identical results |
| Long content | Multi-page documents paginate identically |

**Implementation:**

```typescript
// tests/visual-regression/preview-export.spec.ts
import { test, expect } from "@playwright/test";
import { comparePdfToScreenshot } from "./utils/pdf-compare";

test("preview matches PDF export", async ({ page }) => {
  // 1. Navigate to workshop with test resume
  await page.goto("/dashboard/workshop/test-resume-id");

  // 2. Take screenshot of preview
  const previewScreenshot = await page.locator(".resume-preview").screenshot();

  // 3. Export to PDF
  const pdfBuffer = await exportResumePdf(page);

  // 4. Render PDF first page to image
  const pdfImage = await renderPdfToImage(pdfBuffer, { page: 1 });

  // 5. Compare with tolerance for anti-aliasing
  const diff = await comparePdfToScreenshot(previewScreenshot, pdfImage);
  expect(diff.percentage).toBeLessThan(0.5); // <0.5% difference
});
```

### Auto-Fit Convergence Tests

```typescript
// tests/unit/auto-fit.spec.ts
test("auto-fit terminates within iteration limit", () => {
  const extremeContent = generateLongResume(50); // 50 experience items
  const styles = calculateFitToPageStyles(defaultStyle, 5000); // 5x page height

  // Should not throw or hang
  expect(styles.bodyFontSize).toBe(`${FIT_MINIMUMS.bodyFontSize}pt`);
});

test("auto-fit reduces in correct order", () => {
  // Track which properties are reduced first
  const reductionOrder = trackReductionOrder(defaultStyle, 1500);
  expect(reductionOrder).toEqual(["bodyFontSize", "entrySpacing", "sectionSpacing", "lineHeight"]);
});
```
