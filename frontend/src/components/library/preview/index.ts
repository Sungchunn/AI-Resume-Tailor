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

// Page break rulers and overflow detection
export { PageBreakRuler } from "./PageBreakRuler";
export { OverflowWarning } from "./OverflowWarning";
export { useOverflowDetection } from "./useOverflowDetection";

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
