/**
 * Shared utility to convert AnyResumeBlock[] to TailoredContent.
 * Used by both PreviewDiffLayout and the Editor page.
 */

import type { TailoredContent } from "@/lib/api/types";
import type {
  AnyResumeBlock,
  ExperienceBlock,
  SkillsBlock,
  SummaryBlock,
  ProjectsBlock,
} from "@/lib/resume/types";

/**
 * Converts AnyResumeBlock[] to TailoredContent for preview/editor rendering.
 */
export function blocksToContent(blocks: AnyResumeBlock[]): TailoredContent {
  const content: TailoredContent = {
    summary: "",
    experience: [],
    skills: [],
    highlights: [],
  };

  for (const block of blocks) {
    switch (block.type) {
      case "summary":
        content.summary = (block as SummaryBlock).content || "";
        break;

      case "experience":
        content.experience = ((block as ExperienceBlock).content || []).map(
          (exp) => ({
            title: exp.title || "",
            company: exp.company || "",
            location: exp.location || "",
            start_date: exp.startDate || "",
            end_date: exp.current ? "Present" : exp.endDate || "",
            bullets: exp.bullets || [],
          })
        );
        break;

      case "skills":
        content.skills = (block as SkillsBlock).content || [];
        break;

      case "projects":
        const projectBlock = block as ProjectsBlock;
        if (projectBlock.content) {
          content.highlights = projectBlock.content.map(
            (p) => p.name + (p.description ? `: ${p.description}` : "")
          );
        }
        break;

      default:
        // Other block types can be added as needed
        break;
    }
  }

  return content;
}
