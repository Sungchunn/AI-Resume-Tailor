/**
 * Library Resume Preview Components
 *
 * Phase 5: Preview Component
 *
 * This module provides WYSIWYG preview rendering for block-based resumes.
 *
 * Main components:
 * - ResumePreview: Full preview with auto-scaling and click-to-select
 * - ResumePreviewStandalone: Fixed-size preview for print/export
 * - BlockRenderer: Individual block rendering with section headers
 *
 * Usage:
 * ```tsx
 * import { ResumePreview } from "@/components/library/preview";
 *
 * <ResumePreview
 *   blocks={blocks}
 *   style={style}
 *   activeBlockId={activeId}
 *   onBlockClick={(id) => setActiveBlock(id)}
 * />
 * ```
 */

// Main preview components
export { ResumePreview, ResumePreviewStandalone } from "./ResumePreview";
export type { ResumePreviewHandle } from "./ResumePreview";

// Paginated preview (renders multiple distinct page containers)
export { PaginatedResumePreview } from "./PaginatedResumePreview";
export type {
  PaginatedResumePreviewHandle,
  PaginatedResumePreviewProps,
} from "./PaginatedResumePreview";

// Overflow detection and warnings
export { OverflowWarning } from "./OverflowWarning";
export { MinimumReachedWarning } from "./MinimumReachedWarning";
export { useOverflowDetection } from "./useOverflowDetection";

// Block measurement infrastructure (for paginated preview)
export { MeasurementContainer } from "./MeasurementContainer";
export type { BlockMeasurement } from "./MeasurementContainer";
export {
  useBlockMeasurement,
  calculateContentHeight,
  getBlockTotalHeight,
} from "./useBlockMeasurement";
export type { UseMeasurementResult } from "./useBlockMeasurement";

// Page assignment algorithm (for paginated preview)
export {
  useBlockPagination,
  wouldBlockFit,
  getBlockPageNumber,
} from "./useBlockPagination";
export type { PageAssignment, PaginationResult } from "./useBlockPagination";

// Page container component (for paginated preview)
export { PreviewPage } from "./PreviewPage";
export type { PreviewPageProps } from "./PreviewPage";

// Block renderer
export { BlockRenderer, createBlockRenderer } from "./BlockRenderer";
export { InteractiveBlockRenderer } from "./InteractiveBlockRenderer";

// Types
export type {
  ResumePreviewProps,
  BlockRendererProps,
  ComputedPreviewStyle,
  BaseBlockPreviewProps,
} from "./types";
export { PAGE_DIMENSIONS } from "./types";

// Style utilities
export {
  computePreviewStyles,
  getSectionTitle,
  formatDate,
  formatDateRange,
  SECTION_TITLES,
  PROFICIENCY_LABELS,
  PUBLICATION_TYPE_LABELS,
} from "./previewStyles";

// Individual block previews (for custom rendering needs)
export {
  ContactPreview,
  hasContactContent,
  SummaryPreview,
  hasSummaryContent,
  ExperiencePreview,
  hasExperienceContent,
  EducationPreview,
  hasEducationContent,
  SkillsPreview,
  hasSkillsContent,
  CertificationsPreview,
  hasCertificationsContent,
  ProjectsPreview,
  hasProjectsContent,
  LanguagesPreview,
  hasLanguagesContent,
  VolunteerPreview,
  hasVolunteerContent,
  PublicationsPreview,
  hasPublicationsContent,
  AwardsPreview,
  hasAwardsContent,
  InterestsPreview,
  hasInterestsContent,
  ReferencesPreview,
  hasReferencesContent,
  CoursesPreview,
  hasCoursesContent,
  MembershipsPreview,
  hasMembershipsContent,
} from "./blocks";
