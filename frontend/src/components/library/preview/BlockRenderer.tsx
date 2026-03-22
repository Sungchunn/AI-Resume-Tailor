"use client";

import type { AnyResumeBlock } from "@/lib/resume/types";
import type { BlockRendererProps, ComputedPreviewStyle, GranularInteractionProps } from "./types";
import { getSectionTitle } from "./previewStyles";

// Import all block preview components
import {
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
  LeadershipPreview,
  hasLeadershipContent,
} from "./blocks";

/**
 * BlockRenderer - Routes to the correct preview component based on block type
 *
 * This component renders a single block in preview mode with section header.
 * It handles active state styling and click events for block selection.
 * Supports granular highlighting for sub-block elements when granular props are provided.
 */
export function BlockRenderer({
  block,
  style,
  isActive = false,
  onClick,
  blockId,
  activeElementId,
  hoveredElementId,
  onElementClick,
  onElementHover,
}: BlockRendererProps) {
  // Check if block has content worth rendering
  if (!hasBlockContent(block)) {
    return null;
  }

  // Granular props to pass down to preview components
  const granularProps: Partial<GranularInteractionProps> = {
    blockId: blockId ?? block.id,
    activeElementId,
    hoveredElementId,
    onElementClick,
    onElementHover,
  };

  // Contact block is special - no section header, centered layout
  if (block.type === "contact") {
    return (
      <div
        className={getBlockWrapperClasses(isActive, onClick)}
        onClick={onClick}
        style={{ marginBottom: style.sectionGap }}
      >
        <ContactPreview content={block.content} style={style} {...granularProps} />
      </div>
    );
  }

  // All other blocks have section headers
  return (
    <div
      className={getBlockWrapperClasses(isActive, onClick)}
      onClick={onClick}
      style={{ marginBottom: style.sectionGap }}
    >
      {/* Section header */}
      <h2
        className="font-semibold uppercase tracking-wide border-b border-input pb-1 mb-2"
        style={{ fontSize: style.subheadingFontSize }}
      >
        {getSectionTitle(block.type)}
      </h2>

      {/* Block content */}
      {renderBlockContent(block, style, granularProps)}
    </div>
  );
}

/**
 * Get CSS classes for the block wrapper
 */
function getBlockWrapperClasses(isActive: boolean, onClick?: () => void): string {
  // No active/hover styling for blocks - cursor only
  return "preview-block transition-all duration-200 rounded-sm p-2 -mx-2";
}

/**
 * Check if a block has meaningful content to render
 */
function hasBlockContent(block: AnyResumeBlock): boolean {
  switch (block.type) {
    case "contact":
      return hasContactContent(block.content);
    case "summary":
      return hasSummaryContent(block.content);
    case "experience":
      return hasExperienceContent(block.content);
    case "education":
      return hasEducationContent(block.content);
    case "skills":
      return hasSkillsContent(block.content);
    case "certifications":
      return hasCertificationsContent(block.content);
    case "projects":
      return hasProjectsContent(block.content);
    case "languages":
      return hasLanguagesContent(block.content);
    case "volunteer":
      return hasVolunteerContent(block.content);
    case "publications":
      return hasPublicationsContent(block.content);
    case "awards":
      return hasAwardsContent(block.content);
    case "interests":
      return hasInterestsContent(block.content);
    case "references":
      return hasReferencesContent(block.content);
    case "courses":
      return hasCoursesContent(block.content);
    case "memberships":
      return hasMembershipsContent(block.content);
    case "leadership":
      return hasLeadershipContent(block.content);
    default: {
      // Type-safe exhaustive check
      const _exhaustiveCheck: never = block;
      return false;
    }
  }
}

/**
 * Render the appropriate preview component for a block
 */
function renderBlockContent(
  block: AnyResumeBlock,
  style: ComputedPreviewStyle,
  granularProps: Partial<GranularInteractionProps>
): React.ReactNode {
  switch (block.type) {
    case "contact":
      return <ContactPreview content={block.content} style={style} {...granularProps} />;
    case "summary":
      return <SummaryPreview content={block.content} style={style} {...granularProps} />;
    case "experience":
      return <ExperiencePreview content={block.content} style={style} {...granularProps} />;
    case "education":
      return <EducationPreview content={block.content} style={style} {...granularProps} />;
    case "skills":
      return <SkillsPreview content={block.content} style={style} {...granularProps} />;
    case "certifications":
      return <CertificationsPreview content={block.content} style={style} {...granularProps} />;
    case "projects":
      return <ProjectsPreview content={block.content} style={style} {...granularProps} />;
    case "languages":
      return <LanguagesPreview content={block.content} style={style} {...granularProps} />;
    case "volunteer":
      return <VolunteerPreview content={block.content} style={style} {...granularProps} />;
    case "publications":
      return <PublicationsPreview content={block.content} style={style} {...granularProps} />;
    case "awards":
      return <AwardsPreview content={block.content} style={style} {...granularProps} />;
    case "interests":
      return <InterestsPreview content={block.content} style={style} {...granularProps} />;
    case "references":
      return <ReferencesPreview content={block.content} style={style} {...granularProps} />;
    case "courses":
      return <CoursesPreview content={block.content} style={style} {...granularProps} />;
    case "memberships":
      return <MembershipsPreview content={block.content} style={style} {...granularProps} />;
    case "leadership":
      return <LeadershipPreview content={block.content} style={style} {...granularProps} />;
    default: {
      // Type-safe exhaustive check
      const _exhaustiveCheck: never = block;
      return (
        <div className="text-sm text-muted-foreground italic">
          No preview available for this block type
        </div>
      );
    }
  }
}

/**
 * Helper function to create a renderBlock function for external use
 *
 * Usage:
 * const renderBlock = createBlockRenderer(style);
 * blocks.map(block => renderBlock(block, block.id === activeId));
 */
export function createBlockRenderer(style: ComputedPreviewStyle) {
  return (
    block: AnyResumeBlock,
    isActive?: boolean,
    onClick?: () => void
  ) => (
    <BlockRenderer
      key={block.id}
      block={block}
      style={style}
      isActive={isActive}
      onClick={onClick}
    />
  );
}
