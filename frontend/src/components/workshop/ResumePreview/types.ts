import type { TailoredContent, ResumeStyle } from "@/lib/api/types";

// Page size type
export type PageSize = "letter" | "a4";

// Page dimension constants (in pixels at 96 DPI)
export const PAGE_DIMENSIONS = {
  LETTER: {
    WIDTH: 816, // 8.5 inches @ 96 DPI
    HEIGHT: 1056, // 11 inches @ 96 DPI
  },
  A4: {
    WIDTH: 794, // 210mm @ 96 DPI (210 / 25.4 * 96)
    HEIGHT: 1123, // 297mm @ 96 DPI (297 / 25.4 * 96)
  },
  DPI: 96,
} as const;

// Helper to get dimensions for a page size
export function getPageDimensions(pageSize: PageSize = "letter"): { WIDTH: number; HEIGHT: number } {
  return pageSize === "a4" ? PAGE_DIMENSIONS.A4 : PAGE_DIMENSIONS.LETTER;
}

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

// Style-to-CSS mapping
export interface ComputedPreviewStyle {
  fontFamily: string;
  bodyFontSize: string;
  headingFontSize: string;
  subheadingFontSize: string;
  lineHeight: number;
  sectionGap: string;
  entryGap: string;
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
  startIndex?: number;
  endIndex?: number;
  isPartial: boolean;
}

export interface PageBreakResult {
  pages: PageContent[];
  totalPages: number;
  currentContentHeight: number;
  exceedsOnePage: boolean;
}
