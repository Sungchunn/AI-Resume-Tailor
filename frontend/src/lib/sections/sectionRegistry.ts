/**
 * Section Registry - Centralized configuration for all resume sections
 *
 * This registry eliminates hardcoded section mappings throughout the codebase
 * and provides a single source of truth for section metadata.
 */

import type { TailoredContent } from "@/lib/api/types";

export type SectionCategory = "core" | "professional" | "additional";

export interface SectionDefinition {
  key: string;
  defaultLabel: string;
  category: SectionCategory;
  icon: string; // Lucide icon name
  description: string;
  getCount: (content: TailoredContent) => number | null;
  isEmpty: (content: TailoredContent) => boolean;
}

/**
 * Registry of all predefined resume section types.
 * Custom sections are stored separately in content.custom_sections.
 */
export const SECTION_REGISTRY: Record<string, SectionDefinition> = {
  summary: {
    key: "summary",
    defaultLabel: "Professional Summary",
    category: "core",
    icon: "FileText",
    description: "Brief overview of your professional background and goals",
    getCount: () => null,
    isEmpty: (content) => !content.summary?.trim(),
  },
  experience: {
    key: "experience",
    defaultLabel: "Work Experience",
    category: "core",
    icon: "Briefcase",
    description: "Your professional work history",
    getCount: (content) => content.experience?.length ?? 0,
    isEmpty: (content) => (content.experience?.length ?? 0) === 0,
  },
  education: {
    key: "education",
    defaultLabel: "Education",
    category: "core",
    icon: "GraduationCap",
    description: "Academic background and degrees",
    getCount: (content) => content.education?.length ?? 0,
    isEmpty: (content) => (content.education?.length ?? 0) === 0,
  },
  skills: {
    key: "skills",
    defaultLabel: "Skills",
    category: "core",
    icon: "Wrench",
    description: "Technical and professional skills",
    getCount: (content) => content.skills?.length ?? 0,
    isEmpty: (content) => (content.skills?.length ?? 0) === 0,
  },
  projects: {
    key: "projects",
    defaultLabel: "Projects",
    category: "professional",
    icon: "FolderKanban",
    description: "Personal or professional projects",
    getCount: (content) => content.projects?.length ?? 0,
    isEmpty: (content) => (content.projects?.length ?? 0) === 0,
  },
  certifications: {
    key: "certifications",
    defaultLabel: "Certifications",
    category: "professional",
    icon: "Award",
    description: "Professional certifications and licenses",
    getCount: (content) => content.certifications?.length ?? 0,
    isEmpty: (content) => (content.certifications?.length ?? 0) === 0,
  },
  volunteer: {
    key: "volunteer",
    defaultLabel: "Volunteer Experience",
    category: "professional",
    icon: "Heart",
    description: "Community service and volunteer work",
    getCount: (content) => content.volunteer?.length ?? 0,
    isEmpty: (content) => (content.volunteer?.length ?? 0) === 0,
  },
  publications: {
    key: "publications",
    defaultLabel: "Publications",
    category: "professional",
    icon: "BookOpen",
    description: "Papers, articles, books, and patents",
    getCount: (content) => content.publications?.length ?? 0,
    isEmpty: (content) => (content.publications?.length ?? 0) === 0,
  },
  awards: {
    key: "awards",
    defaultLabel: "Awards & Honors",
    category: "professional",
    icon: "Trophy",
    description: "Recognition and achievements",
    getCount: (content) => content.awards?.length ?? 0,
    isEmpty: (content) => (content.awards?.length ?? 0) === 0,
  },
  leadership: {
    key: "leadership",
    defaultLabel: "Leadership & Extracurriculars",
    category: "professional",
    icon: "Users",
    description: "Leadership roles and extracurricular activities",
    getCount: (content) => content.leadership?.length ?? 0,
    isEmpty: (content) => (content.leadership?.length ?? 0) === 0,
  },
  languages: {
    key: "languages",
    defaultLabel: "Languages",
    category: "additional",
    icon: "Globe",
    description: "Language proficiencies",
    getCount: (content) => content.languages?.length ?? 0,
    isEmpty: (content) => (content.languages?.length ?? 0) === 0,
  },
  interests: {
    key: "interests",
    defaultLabel: "Interests",
    category: "additional",
    icon: "Sparkles",
    description: "Personal interests and hobbies",
    getCount: () => null,
    isEmpty: (content) => !content.interests?.trim(),
  },
  memberships: {
    key: "memberships",
    defaultLabel: "Memberships",
    category: "additional",
    icon: "Users",
    description: "Professional organizations and associations",
    getCount: (content) => content.memberships?.length ?? 0,
    isEmpty: (content) => (content.memberships?.length ?? 0) === 0,
  },
  courses: {
    key: "courses",
    defaultLabel: "Courses",
    category: "additional",
    icon: "BookMarked",
    description: "Online courses and training programs",
    getCount: (content) => content.courses?.length ?? 0,
    isEmpty: (content) => (content.courses?.length ?? 0) === 0,
  },
  references: {
    key: "references",
    defaultLabel: "References",
    category: "additional",
    icon: "Contact",
    description: "Professional references",
    getCount: (content) => content.references?.length ?? 0,
    isEmpty: (content) => (content.references?.length ?? 0) === 0,
  },
};

/**
 * Get the display label for a section.
 * Checks custom labels first, then falls back to registry default.
 */
export function getSectionLabel(
  key: string,
  customLabels?: Record<string, string>
): string {
  // Check custom labels first
  if (customLabels?.[key]) {
    return customLabels[key];
  }

  // Check registry
  if (SECTION_REGISTRY[key]) {
    return SECTION_REGISTRY[key].defaultLabel;
  }

  // Fallback: capitalize the key
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * Get all sections belonging to a specific category.
 */
export function getSectionsByCategory(
  category: SectionCategory
): SectionDefinition[] {
  return Object.values(SECTION_REGISTRY).filter(
    (section) => section.category === category
  );
}

/**
 * Get all available section keys.
 */
export function getAllSectionKeys(): string[] {
  return Object.keys(SECTION_REGISTRY);
}

/**
 * Get a section definition by key.
 */
export function getSectionDefinition(key: string): SectionDefinition | undefined {
  return SECTION_REGISTRY[key];
}

/**
 * Check if a section key is a predefined section.
 */
export function isPredefinedSection(key: string): boolean {
  return key in SECTION_REGISTRY;
}

/**
 * Check if a section key is a custom section.
 */
export function isCustomSection(key: string): boolean {
  return key.startsWith("custom_");
}

/**
 * Get section count for display purposes.
 */
export function getSectionCount(
  key: string,
  content: TailoredContent
): number | null {
  const definition = SECTION_REGISTRY[key];
  if (definition) {
    return definition.getCount(content);
  }

  // For custom sections
  const customSection = content.custom_sections?.[key];
  if (customSection) {
    if (customSection.type === "entries" && Array.isArray(customSection.content)) {
      return customSection.content.length;
    }
  }

  return null;
}

/**
 * Check if a section has content.
 */
export function sectionHasContent(
  key: string,
  content: TailoredContent
): boolean {
  const definition = SECTION_REGISTRY[key];
  if (definition) {
    return !definition.isEmpty(content);
  }

  // For custom sections
  const customSection = content.custom_sections?.[key];
  if (customSection) {
    if (customSection.type === "text") {
      return typeof customSection.content === "string" && customSection.content.trim().length > 0;
    }
    if (customSection.type === "entries" && Array.isArray(customSection.content)) {
      return customSection.content.length > 0;
    }
  }

  return false;
}

/**
 * Section groups for the Add Section menu.
 */
export const SECTION_GROUPS: { label: string; category: SectionCategory }[] = [
  { label: "Core", category: "core" },
  { label: "Professional", category: "professional" },
  { label: "Additional", category: "additional" },
];

/**
 * Get sections grouped by category for menus.
 */
export function getGroupedSections(): {
  label: string;
  category: SectionCategory;
  sections: SectionDefinition[];
}[] {
  return SECTION_GROUPS.map((group) => ({
    ...group,
    sections: getSectionsByCategory(group.category),
  }));
}
