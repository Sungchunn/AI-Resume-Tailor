/**
 * Preview Style Utilities
 *
 * Functions to convert BlockEditorStyle to computed CSS styles for rendering.
 */

import type { BlockEditorStyle } from "@/lib/resume/types";
import type { ComputedPreviewStyle } from "./types";
import { PAGE_DIMENSIONS } from "./types";

/**
 * Map font names to CSS font-family strings.
 * Web fonts use CSS variables loaded via next/font/google.
 * System fonts use standard fallback stacks.
 */
const FONT_FAMILY_MAP: Record<string, string> = {
  Inter: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  Roboto: "var(--font-roboto), ui-sans-serif, system-ui, sans-serif",
  "Open Sans": "var(--font-open-sans), ui-sans-serif, system-ui, sans-serif",
  Lato: "var(--font-lato), ui-sans-serif, system-ui, sans-serif",
  Georgia: "Georgia, 'Times New Roman', ui-serif, serif",
  "Times New Roman": "'Times New Roman', Times, ui-serif, serif",
  Arial: "Arial, Helvetica, ui-sans-serif, sans-serif",
};

/**
 * Get CSS font-family string for a font name
 */
function getFontFamilyCSS(fontName: string): string {
  return FONT_FAMILY_MAP[fontName] ?? FONT_FAMILY_MAP.Inter;
}

/**
 * Convert BlockEditorStyle to CSS-ready computed styles
 */
export function computePreviewStyles(
  style: BlockEditorStyle
): ComputedPreviewStyle {
  return {
    fontFamily: getFontFamilyCSS(style.fontFamily),
    bodyFontSize: `${style.fontSizeBody}pt`,
    headingFontSize: `${style.fontSizeHeading}pt`,
    subheadingFontSize: `${style.fontSizeSubheading}pt`,
    lineHeight: style.lineSpacing,
    sectionGap: `${style.sectionSpacing}px`,
    entryGap: `${style.entrySpacing}px`,
    paddingTop: `${style.marginTop * PAGE_DIMENSIONS.DPI}px`,
    paddingBottom: `${style.marginBottom * PAGE_DIMENSIONS.DPI}px`,
    paddingLeft: `${style.marginLeft * PAGE_DIMENSIONS.DPI}px`,
    paddingRight: `${style.marginRight * PAGE_DIMENSIONS.DPI}px`,
  };
}

/**
 * Get section title for display
 */
export const SECTION_TITLES: Record<string, string> = {
  contact: "Contact",
  summary: "Professional Summary",
  experience: "Work Experience",
  education: "Education",
  skills: "Skills",
  certifications: "Certifications",
  projects: "Projects",
  languages: "Languages",
  volunteer: "Volunteer Experience",
  publications: "Publications",
  awards: "Awards & Honors",
  interests: "Interests",
  references: "References",
  courses: "Courses & Training",
  memberships: "Professional Memberships",
};

/**
 * Get the display title for a block type
 */
export function getSectionTitle(blockType: string): string {
  return SECTION_TITLES[blockType] ?? blockType;
}

/**
 * Format a date string for display
 */
export function formatDate(date: string | undefined): string {
  if (!date) return "";
  return date;
}

/**
 * Format a date range (start - end)
 */
export function formatDateRange(
  startDate: string | undefined,
  endDate: string | undefined
): string {
  const start = startDate || "";
  const end = formatDate(endDate);

  if (!start && !end) return "";
  if (!start) return end;
  if (!end) return start;

  return `${start} - ${end}`;
}

/**
 * Proficiency level labels for languages
 */
export const PROFICIENCY_LABELS: Record<string, string> = {
  native: "Native",
  fluent: "Fluent",
  advanced: "Advanced",
  intermediate: "Intermediate",
  basic: "Basic",
};

/**
 * Publication type labels
 */
export const PUBLICATION_TYPE_LABELS: Record<string, string> = {
  paper: "Paper",
  article: "Article",
  book: "Book",
  thesis: "Thesis",
  patent: "Patent",
  other: "Publication",
};
