/**
 * Shared utility to convert AnyResumeBlock[] to TailoredContent.
 * Used by both PreviewDiffLayout and the Editor page.
 */

import type { TailoredContent } from "@/lib/api/types";
import type {
  AnyResumeBlock,
  ContactBlock,
  ExperienceBlock,
  EducationBlock,
  SkillsBlock,
  SummaryBlock,
  CertificationsBlock,
  ProjectsBlock,
} from "@/lib/resume/types";

/**
 * Converts AnyResumeBlock[] to TailoredContent for preview/editor rendering.
 */
export function blocksToContent(blocks: AnyResumeBlock[]): TailoredContent {
  const content: TailoredContent = {
    summary: "",
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    projects: [],
  };

  for (const block of blocks) {
    switch (block.type) {
      case "contact":
        const contactBlock = block as ContactBlock;
        if (contactBlock.content) {
          content.contact = {
            name: contactBlock.content.fullName,
            email: contactBlock.content.email,
            phone: contactBlock.content.phone,
            location: contactBlock.content.location,
            linkedin: contactBlock.content.linkedin,
            github: contactBlock.content.github,
            website: contactBlock.content.website,
          };
        }
        break;

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

      case "education":
        content.education = ((block as EducationBlock).content || []).map(
          (edu) => ({
            degree: edu.degree || "",
            institution: edu.institution || "",
            location: edu.location,
            graduation_date: edu.graduationDate,
            gpa: edu.gpa,
            honors: edu.honors,
          })
        );
        break;

      case "skills":
        content.skills = (block as SkillsBlock).content || [];
        break;

      case "certifications":
        content.certifications = ((block as CertificationsBlock).content || []).map(
          (cert) => ({
            name: cert.name || "",
            issuer: cert.issuer,
            date: cert.date,
          })
        );
        break;

      case "projects":
        content.projects = ((block as ProjectsBlock).content || []).map(
          (proj) => ({
            name: proj.name || "",
            description: proj.description,
            technologies: proj.technologies,
            url: proj.url,
            bullets: proj.bullets,
          })
        );
        break;

      default:
        // Other block types can be added as needed
        break;
    }
  }

  return content;
}
