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
  LanguagesBlock,
  VolunteerBlock,
  PublicationsBlock,
  AwardsBlock,
  InterestsBlock,
  ReferencesBlock,
  CoursesBlock,
  MembershipsBlock,
  LeadershipBlock,
} from "@/lib/resume/types";
import { bulletsToStrings } from "@/lib/resume/bulletHelpers";

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
            end_date: exp.endDate || "",
            bullets: bulletsToStrings(exp.bullets),
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
            start_date: proj.startDate,
            end_date: proj.endDate,
            bullets: bulletsToStrings(proj.bullets),
          })
        );
        break;

      case "languages":
        content.languages = ((block as LanguagesBlock).content || []).map(
          (lang) => ({
            language: lang.language || "",
            proficiency: lang.proficiency || "",
          })
        );
        break;

      case "volunteer":
        content.volunteer = ((block as VolunteerBlock).content || []).map(
          (vol) => ({
            role: vol.role || "",
            organization: vol.organization || "",
            location: vol.location,
            start_date: vol.startDate || "",
            end_date: vol.endDate,
            description: vol.description,
            bullets: bulletsToStrings(vol.bullets),
          })
        );
        break;

      case "publications":
        content.publications = ((block as PublicationsBlock).content || []).map(
          (pub) => ({
            title: pub.title || "",
            publication_type: pub.publicationType,
            publisher: pub.publisher,
            date: pub.date,
            url: pub.url,
            authors: pub.authors,
            description: pub.description,
          })
        );
        break;

      case "awards":
        content.awards = ((block as AwardsBlock).content || []).map(
          (award) => ({
            title: award.title || "",
            issuer: award.issuer || "",
            date: award.date,
            description: award.description,
          })
        );
        break;

      case "interests":
        content.interests = (block as InterestsBlock).content || "";
        break;

      case "references":
        content.references = ((block as ReferencesBlock).content || []).map(
          (ref) => ({
            name: ref.name || "",
            title: ref.title || "",
            company: ref.company || "",
            email: ref.email,
            phone: ref.phone,
            relationship: ref.relationship,
          })
        );
        break;

      case "courses":
        content.courses = ((block as CoursesBlock).content || []).map(
          (course) => ({
            name: course.name || "",
            provider: course.provider || "",
            date: course.date,
            credential_url: course.credentialUrl,
            description: course.description,
          })
        );
        break;

      case "memberships":
        content.memberships = ((block as MembershipsBlock).content || []).map(
          (mem) => ({
            organization: mem.organization || "",
            role: mem.role,
            start_date: mem.startDate,
            end_date: mem.endDate,
          })
        );
        break;

      case "leadership":
        content.leadership = ((block as LeadershipBlock).content || []).map(
          (lead) => ({
            title: lead.title || "",
            organization: lead.organization || "",
            location: lead.location,
            start_date: lead.startDate,
            end_date: lead.endDate,
            description: lead.description,
            bullets: bulletsToStrings(lead.bullets),
          })
        );
        break;

      default:
        // Custom or unhandled block types
        break;
    }
  }

  return content;
}
