/**
 * Transform functions for converting between backend parsed_content and block array
 */

import { nanoid } from "nanoid";
import type {
  AnyResumeBlock,
  AwardEntry,
  AwardsBlock,
  BlockEditorStyle,
  CertificationEntry,
  CertificationsBlock,
  ContactBlock,
  ContactContent,
  CourseEntry,
  CoursesBlock,
  EducationBlock,
  EducationEntry,
  ExperienceBlock,
  ExperienceEntry,
  InterestsBlock,
  LanguageEntry,
  LanguageProficiency,
  LanguagesBlock,
  MembershipEntry,
  MembershipsBlock,
  ParsedResumeContent,
  ProjectEntry,
  ProjectsBlock,
  PublicationEntry,
  PublicationType,
  PublicationsBlock,
  ReferenceEntry,
  ReferencesBlock,
  ResumeBlockType,
  SkillsBlock,
  SummaryBlock,
  VolunteerBlock,
  VolunteerEntry,
} from "./types";
import { DEFAULT_STYLE, createDefaultBlock } from "./defaults";

/**
 * Convert backend parsed_content to block array
 */
export function parsedContentToBlocks(
  parsedContent: ParsedResumeContent | null | undefined
): AnyResumeBlock[] {
  if (!parsedContent) {
    return [];
  }

  const blocks: AnyResumeBlock[] = [];
  let order = 0;

  // Contact block (always first if present)
  if (parsedContent.contact) {
    const contact = parsedContent.contact;
    blocks.push({
      id: nanoid(),
      type: "contact",
      order: order++,
      content: {
        fullName: contact.name || "",
        email: contact.email || "",
        phone: contact.phone,
        location: contact.location,
        linkedin: contact.linkedin,
        website: contact.website,
        github: contact.github,
      },
    } as ContactBlock);
  }

  // Summary block
  if (parsedContent.summary) {
    blocks.push({
      id: nanoid(),
      type: "summary",
      order: order++,
      content: parsedContent.summary,
    } as SummaryBlock);
  }

  // Experience block
  if (parsedContent.experience && parsedContent.experience.length > 0) {
    const entries: ExperienceEntry[] = parsedContent.experience.map((exp) => ({
      id: nanoid(),
      title: exp.title || "",
      company: exp.company || "",
      location: exp.location,
      startDate: exp.start_date || "",
      endDate: exp.end_date || "",
      current: exp.end_date?.toLowerCase() === "present",
      bullets: exp.bullets || [],
    }));

    blocks.push({
      id: nanoid(),
      type: "experience",
      order: order++,
      content: entries,
    } as ExperienceBlock);
  }

  // Education block
  if (parsedContent.education && parsedContent.education.length > 0) {
    const entries: EducationEntry[] = parsedContent.education.map((edu) => ({
      id: nanoid(),
      degree: edu.degree || "",
      institution: edu.institution || "",
      location: edu.location,
      graduationDate: edu.graduation_date || "",
      gpa: edu.gpa,
      honors: edu.honors,
      relevantCourses: edu.relevant_courses,
    }));

    blocks.push({
      id: nanoid(),
      type: "education",
      order: order++,
      content: entries,
    } as EducationBlock);
  }

  // Skills block
  if (parsedContent.skills && parsedContent.skills.length > 0) {
    blocks.push({
      id: nanoid(),
      type: "skills",
      order: order++,
      content: parsedContent.skills,
    } as SkillsBlock);
  }

  // Certifications block
  if (parsedContent.certifications && parsedContent.certifications.length > 0) {
    const entries: CertificationEntry[] = parsedContent.certifications.map(
      (cert) => ({
        id: nanoid(),
        name: cert.name || "",
        issuer: cert.issuer || "",
        date: cert.date,
        expirationDate: cert.expiration_date,
        credentialId: cert.credential_id,
        url: cert.url,
      })
    );

    blocks.push({
      id: nanoid(),
      type: "certifications",
      order: order++,
      content: entries,
    } as CertificationsBlock);
  }

  // Projects block
  if (parsedContent.projects && parsedContent.projects.length > 0) {
    const entries: ProjectEntry[] = parsedContent.projects.map((proj) => ({
      id: nanoid(),
      name: proj.name || "",
      description: proj.description || "",
      technologies: proj.technologies,
      url: proj.url,
      startDate: proj.start_date,
      endDate: proj.end_date,
      bullets: proj.bullets,
    }));

    blocks.push({
      id: nanoid(),
      type: "projects",
      order: order++,
      content: entries,
    } as ProjectsBlock);
  }

  // Languages block
  if (parsedContent.languages && parsedContent.languages.length > 0) {
    const entries: LanguageEntry[] = parsedContent.languages.map((lang) => ({
      id: nanoid(),
      language: lang.language || "",
      proficiency: (lang.proficiency as LanguageProficiency) || "intermediate",
    }));

    blocks.push({
      id: nanoid(),
      type: "languages",
      order: order++,
      content: entries,
    } as LanguagesBlock);
  }

  // Volunteer block
  if (parsedContent.volunteer && parsedContent.volunteer.length > 0) {
    const entries: VolunteerEntry[] = parsedContent.volunteer.map((vol) => ({
      id: nanoid(),
      role: vol.role || "",
      organization: vol.organization || "",
      location: vol.location,
      startDate: vol.start_date || "",
      endDate: vol.end_date,
      current: vol.end_date?.toLowerCase() === "present",
      description: vol.description,
      bullets: vol.bullets,
    }));

    blocks.push({
      id: nanoid(),
      type: "volunteer",
      order: order++,
      content: entries,
    } as VolunteerBlock);
  }

  // Publications block
  if (parsedContent.publications && parsedContent.publications.length > 0) {
    const entries: PublicationEntry[] = parsedContent.publications.map(
      (pub) => ({
        id: nanoid(),
        title: pub.title || "",
        publicationType:
          (pub.publication_type as PublicationType) || "article",
        publisher: pub.publisher,
        date: pub.date,
        url: pub.url,
        authors: pub.authors,
        description: pub.description,
      })
    );

    blocks.push({
      id: nanoid(),
      type: "publications",
      order: order++,
      content: entries,
    } as PublicationsBlock);
  }

  // Awards block
  if (parsedContent.awards && parsedContent.awards.length > 0) {
    const entries: AwardEntry[] = parsedContent.awards.map((award) => ({
      id: nanoid(),
      title: award.title || "",
      issuer: award.issuer || "",
      date: award.date,
      description: award.description,
    }));

    blocks.push({
      id: nanoid(),
      type: "awards",
      order: order++,
      content: entries,
    } as AwardsBlock);
  }

  // Interests block
  if (parsedContent.interests) {
    blocks.push({
      id: nanoid(),
      type: "interests",
      order: order++,
      content: parsedContent.interests,
    } as InterestsBlock);
  }

  // References block
  if (parsedContent.references && parsedContent.references.length > 0) {
    const entries: ReferenceEntry[] = parsedContent.references.map((ref) => ({
      id: nanoid(),
      name: ref.name || "",
      title: ref.title || "",
      company: ref.company || "",
      email: ref.email,
      phone: ref.phone,
      relationship: ref.relationship,
    }));

    blocks.push({
      id: nanoid(),
      type: "references",
      order: order++,
      content: entries,
    } as ReferencesBlock);
  }

  // Courses block
  if (parsedContent.courses && parsedContent.courses.length > 0) {
    const entries: CourseEntry[] = parsedContent.courses.map((course) => ({
      id: nanoid(),
      name: course.name || "",
      provider: course.provider || "",
      date: course.date,
      credentialUrl: course.credential_url,
      description: course.description,
    }));

    blocks.push({
      id: nanoid(),
      type: "courses",
      order: order++,
      content: entries,
    } as CoursesBlock);
  }

  // Memberships block
  if (parsedContent.memberships && parsedContent.memberships.length > 0) {
    const entries: MembershipEntry[] = parsedContent.memberships.map(
      (mem) => ({
        id: nanoid(),
        organization: mem.organization || "",
        role: mem.role,
        startDate: mem.start_date,
        endDate: mem.end_date,
        current: mem.end_date?.toLowerCase() === "present",
      })
    );

    blocks.push({
      id: nanoid(),
      type: "memberships",
      order: order++,
      content: entries,
    } as MembershipsBlock);
  }

  return blocks;
}

/**
 * Convert block array back to parsed_content format for backend
 */
export function blocksToParsedContent(
  blocks: AnyResumeBlock[]
): ParsedResumeContent {
  const result: ParsedResumeContent = {};

  // Sort blocks by order
  const sortedBlocks = [...blocks].sort((a, b) => a.order - b.order);

  for (const block of sortedBlocks) {
    switch (block.type) {
      case "contact": {
        const content = block.content as ContactContent;
        result.contact = {
          name: content.fullName,
          email: content.email,
          phone: content.phone,
          location: content.location,
          linkedin: content.linkedin,
          website: content.website,
          github: content.github,
        };
        break;
      }

      case "summary": {
        result.summary = block.content as string;
        break;
      }

      case "experience": {
        const entries = block.content as ExperienceEntry[];
        result.experience = entries.map((entry) => ({
          title: entry.title,
          company: entry.company,
          location: entry.location,
          start_date: entry.startDate,
          end_date: entry.current ? "Present" : entry.endDate,
          bullets: entry.bullets,
        }));
        break;
      }

      case "education": {
        const entries = block.content as EducationEntry[];
        result.education = entries.map((entry) => ({
          degree: entry.degree,
          institution: entry.institution,
          location: entry.location,
          graduation_date: entry.graduationDate,
          gpa: entry.gpa,
          honors: entry.honors,
          relevant_courses: entry.relevantCourses,
        }));
        break;
      }

      case "skills": {
        result.skills = block.content as string[];
        break;
      }

      case "certifications": {
        const entries = block.content as CertificationEntry[];
        result.certifications = entries.map((entry) => ({
          name: entry.name,
          issuer: entry.issuer,
          date: entry.date,
          expiration_date: entry.expirationDate,
          credential_id: entry.credentialId,
          url: entry.url,
        }));
        break;
      }

      case "projects": {
        const entries = block.content as ProjectEntry[];
        result.projects = entries.map((entry) => ({
          name: entry.name,
          description: entry.description,
          technologies: entry.technologies,
          url: entry.url,
          start_date: entry.startDate,
          end_date: entry.endDate,
          bullets: entry.bullets,
        }));
        break;
      }

      case "languages": {
        const entries = block.content as LanguageEntry[];
        result.languages = entries.map((entry) => ({
          language: entry.language,
          proficiency: entry.proficiency,
        }));
        break;
      }

      case "volunteer": {
        const entries = block.content as VolunteerEntry[];
        result.volunteer = entries.map((entry) => ({
          role: entry.role,
          organization: entry.organization,
          location: entry.location,
          start_date: entry.startDate,
          end_date: entry.current ? "Present" : entry.endDate,
          description: entry.description,
          bullets: entry.bullets,
        }));
        break;
      }

      case "publications": {
        const entries = block.content as PublicationEntry[];
        result.publications = entries.map((entry) => ({
          title: entry.title,
          publication_type: entry.publicationType,
          publisher: entry.publisher,
          date: entry.date,
          url: entry.url,
          authors: entry.authors,
          description: entry.description,
        }));
        break;
      }

      case "awards": {
        const entries = block.content as AwardEntry[];
        result.awards = entries.map((entry) => ({
          title: entry.title,
          issuer: entry.issuer,
          date: entry.date,
          description: entry.description,
        }));
        break;
      }

      case "interests": {
        result.interests = block.content as string;
        break;
      }

      case "references": {
        const entries = block.content as ReferenceEntry[];
        result.references = entries.map((entry) => ({
          name: entry.name,
          title: entry.title,
          company: entry.company,
          email: entry.email,
          phone: entry.phone,
          relationship: entry.relationship,
        }));
        break;
      }

      case "courses": {
        const entries = block.content as CourseEntry[];
        result.courses = entries.map((entry) => ({
          name: entry.name,
          provider: entry.provider,
          date: entry.date,
          credential_url: entry.credentialUrl,
          description: entry.description,
        }));
        break;
      }

      case "memberships": {
        const entries = block.content as MembershipEntry[];
        result.memberships = entries.map((entry) => ({
          organization: entry.organization,
          role: entry.role,
          start_date: entry.startDate,
          end_date: entry.current ? "Present" : entry.endDate,
        }));
        break;
      }
    }
  }

  return result;
}

/**
 * Convert backend style settings to frontend BlockEditorStyle
 */
export function apiStyleToEditorStyle(
  apiStyle: Record<string, unknown> | null | undefined
): BlockEditorStyle {
  if (!apiStyle) {
    return { ...DEFAULT_STYLE };
  }

  return {
    fontFamily: (apiStyle.font_family as string) || DEFAULT_STYLE.fontFamily,
    fontSizeBody:
      (apiStyle.font_size_body as number) || DEFAULT_STYLE.fontSizeBody,
    fontSizeHeading:
      (apiStyle.font_size_heading as number) || DEFAULT_STYLE.fontSizeHeading,
    fontSizeSubheading:
      (apiStyle.font_size_subheading as number) ||
      DEFAULT_STYLE.fontSizeSubheading,
    marginTop: (apiStyle.margin_top as number) || DEFAULT_STYLE.marginTop,
    marginBottom:
      (apiStyle.margin_bottom as number) || DEFAULT_STYLE.marginBottom,
    marginLeft: (apiStyle.margin_left as number) || DEFAULT_STYLE.marginLeft,
    marginRight: (apiStyle.margin_right as number) || DEFAULT_STYLE.marginRight,
    lineSpacing: (apiStyle.line_spacing as number) || DEFAULT_STYLE.lineSpacing,
    sectionSpacing:
      (apiStyle.section_spacing as number) || DEFAULT_STYLE.sectionSpacing,
    entrySpacing:
      (apiStyle.entry_spacing as number) || DEFAULT_STYLE.entrySpacing,
  };
}

/**
 * Convert frontend BlockEditorStyle to API format
 */
export function editorStyleToApiStyle(
  style: BlockEditorStyle
): Record<string, unknown> {
  return {
    font_family: style.fontFamily,
    font_size_body: style.fontSizeBody,
    font_size_heading: style.fontSizeHeading,
    font_size_subheading: style.fontSizeSubheading,
    margin_top: style.marginTop,
    margin_bottom: style.marginBottom,
    margin_left: style.marginLeft,
    margin_right: style.marginRight,
    line_spacing: style.lineSpacing,
    section_spacing: style.sectionSpacing,
    entry_spacing: style.entrySpacing,
  };
}

/**
 * Insert a new block after a given block ID
 */
export function insertBlockAfter(
  blocks: AnyResumeBlock[],
  blockType: ResumeBlockType,
  afterId?: string
): AnyResumeBlock[] {
  const newBlock = createDefaultBlock(blockType);
  const result = [...blocks];

  if (!afterId) {
    // Insert at the beginning
    newBlock.order = 0;
    result.forEach((b) => b.order++);
    result.unshift(newBlock);
  } else {
    // Find the block to insert after
    const afterIndex = result.findIndex((b) => b.id === afterId);
    if (afterIndex === -1) {
      // If not found, append to end
      newBlock.order = result.length;
      result.push(newBlock);
    } else {
      // Insert after the found block
      newBlock.order = afterIndex + 1;
      result.splice(afterIndex + 1, 0, newBlock);
      // Update orders for subsequent blocks
      for (let i = afterIndex + 2; i < result.length; i++) {
        result[i].order = i;
      }
    }
  }

  return result;
}

/**
 * Remove a block by ID
 */
export function removeBlock(
  blocks: AnyResumeBlock[],
  blockId: string
): AnyResumeBlock[] {
  const result = blocks.filter((b) => b.id !== blockId);
  // Reorder remaining blocks
  result.forEach((b, index) => {
    b.order = index;
  });
  return result;
}

/**
 * Reorder blocks after drag and drop
 */
export function reorderBlocks(
  blocks: AnyResumeBlock[],
  activeId: string,
  overId: string
): AnyResumeBlock[] {
  const oldIndex = blocks.findIndex((b) => b.id === activeId);
  const newIndex = blocks.findIndex((b) => b.id === overId);

  if (oldIndex === -1 || newIndex === -1) {
    return blocks;
  }

  const result = [...blocks];
  const [movedBlock] = result.splice(oldIndex, 1);
  result.splice(newIndex, 0, movedBlock);

  // Update order values
  result.forEach((b, index) => {
    b.order = index;
  });

  return result;
}

/**
 * Update a block's content
 * Note: Caller is responsible for ensuring content type matches block type
 */
export function updateBlockContent<T extends AnyResumeBlock>(
  blocks: AnyResumeBlock[],
  blockId: string,
  content: T["content"]
): AnyResumeBlock[] {
  return blocks.map((block) =>
    block.id === blockId ? ({ ...block, content } as AnyResumeBlock) : block
  );
}

/**
 * Get block section order as string array (for compatibility)
 */
export function getBlockSectionOrder(blocks: AnyResumeBlock[]): string[] {
  return [...blocks]
    .sort((a, b) => a.order - b.order)
    .map((block) => block.type);
}

/**
 * Convert resume blocks to plain text for ATS analysis
 * Concatenates all textual content from visible blocks
 */
export function blocksToText(blocks: AnyResumeBlock[]): string {
  const lines: string[] = [];

  // Sort blocks by order and filter out hidden blocks
  const visibleBlocks = [...blocks]
    .filter((block) => !block.isHidden)
    .sort((a, b) => a.order - b.order);

  for (const block of visibleBlocks) {
    switch (block.type) {
      case "contact": {
        const content = block.content as ContactContent;
        if (content.fullName) lines.push(content.fullName);
        if (content.email) lines.push(content.email);
        if (content.phone) lines.push(content.phone);
        if (content.location) lines.push(content.location);
        break;
      }

      case "summary": {
        const summary = block.content as string;
        if (summary) lines.push(summary);
        break;
      }

      case "experience": {
        const entries = block.content as ExperienceEntry[];
        for (const entry of entries) {
          if (entry.title) lines.push(entry.title);
          if (entry.company) lines.push(entry.company);
          if (entry.location) lines.push(entry.location);
          if (entry.bullets) {
            lines.push(...entry.bullets);
          }
        }
        break;
      }

      case "education": {
        const entries = block.content as EducationEntry[];
        for (const entry of entries) {
          if (entry.degree) lines.push(entry.degree);
          if (entry.institution) lines.push(entry.institution);
          if (entry.location) lines.push(entry.location);
          if (entry.honors) lines.push(entry.honors);
          if (entry.relevantCourses) lines.push(...entry.relevantCourses);
        }
        break;
      }

      case "skills": {
        const skills = block.content as string[];
        lines.push(...skills);
        break;
      }

      case "certifications": {
        const entries = block.content as CertificationEntry[];
        for (const entry of entries) {
          if (entry.name) lines.push(entry.name);
          if (entry.issuer) lines.push(entry.issuer);
        }
        break;
      }

      case "projects": {
        const entries = block.content as ProjectEntry[];
        for (const entry of entries) {
          if (entry.name) lines.push(entry.name);
          if (entry.description) lines.push(entry.description);
          if (entry.technologies) lines.push(...entry.technologies);
          if (entry.bullets) lines.push(...entry.bullets);
        }
        break;
      }

      case "languages": {
        const entries = block.content as LanguageEntry[];
        for (const entry of entries) {
          if (entry.language) lines.push(`${entry.language} (${entry.proficiency})`);
        }
        break;
      }

      case "volunteer": {
        const entries = block.content as VolunteerEntry[];
        for (const entry of entries) {
          if (entry.role) lines.push(entry.role);
          if (entry.organization) lines.push(entry.organization);
          if (entry.description) lines.push(entry.description);
          if (entry.bullets) lines.push(...entry.bullets);
        }
        break;
      }

      case "publications": {
        const entries = block.content as PublicationEntry[];
        for (const entry of entries) {
          if (entry.title) lines.push(entry.title);
          if (entry.publisher) lines.push(entry.publisher);
          if (entry.description) lines.push(entry.description);
        }
        break;
      }

      case "awards": {
        const entries = block.content as AwardEntry[];
        for (const entry of entries) {
          if (entry.title) lines.push(entry.title);
          if (entry.issuer) lines.push(entry.issuer);
          if (entry.description) lines.push(entry.description);
        }
        break;
      }

      case "interests": {
        const interests = block.content as string;
        if (interests) lines.push(interests);
        break;
      }

      case "references": {
        const entries = block.content as ReferenceEntry[];
        for (const entry of entries) {
          if (entry.name) lines.push(entry.name);
          if (entry.title) lines.push(entry.title);
          if (entry.company) lines.push(entry.company);
        }
        break;
      }

      case "courses": {
        const entries = block.content as CourseEntry[];
        for (const entry of entries) {
          if (entry.name) lines.push(entry.name);
          if (entry.provider) lines.push(entry.provider);
          if (entry.description) lines.push(entry.description);
        }
        break;
      }

      case "memberships": {
        const entries = block.content as MembershipEntry[];
        for (const entry of entries) {
          if (entry.organization) lines.push(entry.organization);
          if (entry.role) lines.push(entry.role);
        }
        break;
      }
    }
  }

  return lines.join("\n");
}
