"use client";

import { useCallback } from "react";
import { useBlockEditor } from "../BlockEditorContext";
import type { AnyResumeBlock, BlockContent } from "@/lib/resume/types";

// Import all block editors
import { ContactEditor } from "./ContactEditor";
import { SummaryEditor } from "./SummaryEditor";
import { ExperienceEditor } from "./ExperienceEditor";
import { EducationEditor } from "./EducationEditor";
import { SkillsEditor } from "./SkillsEditor";
import { CertificationsEditor } from "./CertificationsEditor";
import { ProjectsEditor } from "./ProjectsEditor";
import { LanguagesEditor } from "./LanguagesEditor";
import { VolunteerEditor } from "./VolunteerEditor";
import { PublicationsEditor } from "./PublicationsEditor";
import { AwardsEditor } from "./AwardsEditor";
import { InterestsEditor } from "./InterestsEditor";
import { ReferencesEditor } from "./ReferencesEditor";
import { CoursesEditor } from "./CoursesEditor";
import { MembershipsEditor } from "./MembershipsEditor";

interface BlockEditorDispatcherProps {
  block: AnyResumeBlock;
}

/**
 * BlockEditorDispatcher - Routes to the correct editor based on block type
 *
 * This component is passed as the renderBlockEditor prop to BlockList.
 * It dispatches to the appropriate editor component based on block.type.
 */
export function BlockEditorDispatcher({ block }: BlockEditorDispatcherProps) {
  const { updateBlock } = useBlockEditor();

  const handleChange = useCallback(
    (content: BlockContent) => {
      updateBlock(block.id, content);
    },
    [block.id, updateBlock]
  );

  switch (block.type) {
    case "contact":
      return (
        <ContactEditor
          content={block.content}
          onChange={handleChange}
        />
      );

    case "summary":
      return (
        <SummaryEditor
          content={block.content}
          onChange={handleChange}
        />
      );

    case "experience":
      return (
        <ExperienceEditor
          content={block.content}
          onChange={handleChange}
        />
      );

    case "education":
      return (
        <EducationEditor
          content={block.content}
          onChange={handleChange}
        />
      );

    case "skills":
      return (
        <SkillsEditor
          content={block.content}
          onChange={handleChange}
        />
      );

    case "certifications":
      return (
        <CertificationsEditor
          content={block.content}
          onChange={handleChange}
        />
      );

    case "projects":
      return (
        <ProjectsEditor
          content={block.content}
          onChange={handleChange}
        />
      );

    case "languages":
      return (
        <LanguagesEditor
          content={block.content}
          onChange={handleChange}
        />
      );

    case "volunteer":
      return (
        <VolunteerEditor
          content={block.content}
          onChange={handleChange}
        />
      );

    case "publications":
      return (
        <PublicationsEditor
          content={block.content}
          onChange={handleChange}
        />
      );

    case "awards":
      return (
        <AwardsEditor
          content={block.content}
          onChange={handleChange}
        />
      );

    case "interests":
      return (
        <InterestsEditor
          content={block.content}
          onChange={handleChange}
        />
      );

    case "references":
      return (
        <ReferencesEditor
          content={block.content}
          onChange={handleChange}
        />
      );

    case "courses":
      return (
        <CoursesEditor
          content={block.content}
          onChange={handleChange}
        />
      );

    case "memberships":
      return (
        <MembershipsEditor
          content={block.content}
          onChange={handleChange}
        />
      );

    default: {
      // Type-safe exhaustive check
      const _exhaustiveCheck: never = block;
      return (
        <div className="text-sm text-gray-500 italic">
          No editor available for this block type
        </div>
      );
    }
  }
}

/**
 * Helper function to create a renderBlockEditor function for BlockList
 *
 * Usage:
 * <BlockList renderBlockEditor={createBlockEditorRenderer()} />
 */
export function createBlockEditorRenderer() {
  return (block: AnyResumeBlock) => <BlockEditorDispatcher block={block} />;
}
