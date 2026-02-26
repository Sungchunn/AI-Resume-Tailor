/**
 * Default values and templates for block-based resume editing
 */

import { nanoid } from "nanoid";
import type {
  AnyResumeBlock,
  AwardEntry,
  BlockContentMap,
  BlockEditorState,
  BlockEditorStyle,
  BlockTypeInfo,
  CertificationEntry,
  ContactContent,
  CourseEntry,
  EducationEntry,
  ExperienceEntry,
  LanguageEntry,
  MembershipEntry,
  ProjectEntry,
  PublicationEntry,
  ReferenceEntry,
  ResumeBlockType,
  VolunteerEntry,
} from "./types";

/**
 * Default style settings
 */
export const DEFAULT_STYLE: BlockEditorStyle = {
  fontFamily: "Inter",
  fontSizeBody: 10,
  fontSizeHeading: 14,
  fontSizeSubheading: 11,
  marginTop: 0.5,
  marginBottom: 0.5,
  marginLeft: 0.5,
  marginRight: 0.5,
  lineSpacing: 1.15,
  sectionSpacing: 12,
  entrySpacing: 8,
};

/**
 * Block type metadata - comprehensive set organized by category
 */
export const BLOCK_TYPE_INFO: Record<ResumeBlockType, BlockTypeInfo> = {
  // Core sections - essential for most resumes
  contact: {
    type: "contact",
    label: "Contact Information",
    description: "Name, email, phone, location, and professional links",
    icon: "User",
    allowMultiple: false,
    category: "core",
  },
  summary: {
    type: "summary",
    label: "Professional Summary",
    description: "Brief overview of your career, goals, and key qualifications",
    icon: "FileText",
    allowMultiple: false,
    category: "core",
  },
  experience: {
    type: "experience",
    label: "Work Experience",
    description: "Employment history with achievements and responsibilities",
    icon: "Briefcase",
    allowMultiple: false,
    category: "core",
  },
  education: {
    type: "education",
    label: "Education",
    description: "Degrees, institutions, and academic achievements",
    icon: "GraduationCap",
    allowMultiple: false,
    category: "core",
  },
  skills: {
    type: "skills",
    label: "Skills",
    description: "Technical skills, tools, and competencies",
    icon: "Wrench",
    allowMultiple: false,
    category: "core",
  },

  // Professional sections - common in professional resumes
  certifications: {
    type: "certifications",
    label: "Certifications",
    description: "Professional certifications, licenses, and credentials",
    icon: "Award",
    allowMultiple: false,
    category: "professional",
  },
  projects: {
    type: "projects",
    label: "Projects",
    description: "Notable personal, academic, or professional projects",
    icon: "FolderGit2",
    allowMultiple: false,
    category: "professional",
  },
  publications: {
    type: "publications",
    label: "Publications",
    description: "Research papers, articles, books, patents, or other published work",
    icon: "BookOpen",
    allowMultiple: false,
    category: "professional",
  },
  awards: {
    type: "awards",
    label: "Awards & Honors",
    description: "Recognition, awards, scholarships, and honors received",
    icon: "Trophy",
    allowMultiple: false,
    category: "professional",
  },
  courses: {
    type: "courses",
    label: "Courses & Training",
    description: "Professional development, online courses, and training programs",
    icon: "BookMarked",
    allowMultiple: false,
    category: "professional",
  },
  memberships: {
    type: "memberships",
    label: "Professional Memberships",
    description: "Industry associations, societies, and professional organizations",
    icon: "Users",
    allowMultiple: false,
    category: "professional",
  },

  // Additional sections - supplementary information
  languages: {
    type: "languages",
    label: "Languages",
    description: "Languages spoken with proficiency levels",
    icon: "Globe",
    allowMultiple: false,
    category: "additional",
  },
  volunteer: {
    type: "volunteer",
    label: "Volunteer Experience",
    description: "Community service, volunteer work, and charitable activities",
    icon: "Heart",
    allowMultiple: false,
    category: "additional",
  },
  interests: {
    type: "interests",
    label: "Interests & Hobbies",
    description: "Personal interests that demonstrate character or relevant skills",
    icon: "Sparkles",
    allowMultiple: false,
    category: "additional",
  },
  references: {
    type: "references",
    label: "References",
    description: "Professional references with contact information",
    icon: "MessageSquare",
    allowMultiple: false,
    category: "additional",
  },
};

/**
 * Get block types grouped by category for UI display
 */
export function getBlockTypesByCategory(): Record<
  "core" | "professional" | "additional",
  BlockTypeInfo[]
> {
  const types = Object.values(BLOCK_TYPE_INFO);
  return {
    core: types.filter((t) => t.category === "core"),
    professional: types.filter((t) => t.category === "professional"),
    additional: types.filter((t) => t.category === "additional"),
  };
}

/**
 * Category labels for UI
 */
export const CATEGORY_LABELS = {
  core: "Essential Sections",
  professional: "Professional Sections",
  additional: "Additional Sections",
} as const;

/**
 * Default block order
 */
export const DEFAULT_BLOCK_ORDER: ResumeBlockType[] = [
  "contact",
  "summary",
  "experience",
  "education",
  "skills",
  "certifications",
  "projects",
  "languages",
  "volunteer",
  "publications",
  "awards",
  "courses",
  "memberships",
  "interests",
  "references",
];

/**
 * Create default content for each block type
 */
export function createDefaultContent<T extends ResumeBlockType>(
  type: T
): BlockContentMap[T] {
  switch (type) {
    case "contact":
      return {
        fullName: "",
        email: "",
        phone: "",
        location: "",
        linkedin: "",
        website: "",
        github: "",
      } as unknown as BlockContentMap[T];

    case "summary":
      return "" as unknown as BlockContentMap[T];

    case "experience":
      return [
        {
          id: nanoid(),
          title: "",
          company: "",
          location: "",
          startDate: "",
          endDate: "",
          current: false,
          bullets: [""],
        },
      ] as unknown as BlockContentMap[T];

    case "education":
      return [
        {
          id: nanoid(),
          degree: "",
          institution: "",
          location: "",
          graduationDate: "",
          gpa: "",
          honors: "",
          relevantCourses: [],
        },
      ] as unknown as BlockContentMap[T];

    case "skills":
      return [] as unknown as BlockContentMap[T];

    case "certifications":
      return [
        {
          id: nanoid(),
          name: "",
          issuer: "",
          date: "",
          expirationDate: "",
          credentialId: "",
          url: "",
        },
      ] as unknown as BlockContentMap[T];

    case "projects":
      return [
        {
          id: nanoid(),
          name: "",
          description: "",
          technologies: [],
          url: "",
          startDate: "",
          endDate: "",
          bullets: [],
        },
      ] as unknown as BlockContentMap[T];

    case "languages":
      return [
        {
          id: nanoid(),
          language: "",
          proficiency: "intermediate",
        },
      ] as unknown as BlockContentMap[T];

    case "volunteer":
      return [
        {
          id: nanoid(),
          role: "",
          organization: "",
          location: "",
          startDate: "",
          endDate: "",
          current: false,
          description: "",
          bullets: [],
        },
      ] as unknown as BlockContentMap[T];

    case "publications":
      return [
        {
          id: nanoid(),
          title: "",
          publicationType: "article",
          publisher: "",
          date: "",
          url: "",
          authors: "",
          description: "",
        },
      ] as unknown as BlockContentMap[T];

    case "awards":
      return [
        {
          id: nanoid(),
          title: "",
          issuer: "",
          date: "",
          description: "",
        },
      ] as unknown as BlockContentMap[T];

    case "interests":
      return "" as unknown as BlockContentMap[T];

    case "references":
      return [
        {
          id: nanoid(),
          name: "",
          title: "",
          company: "",
          email: "",
          phone: "",
          relationship: "",
        },
      ] as unknown as BlockContentMap[T];

    case "courses":
      return [
        {
          id: nanoid(),
          name: "",
          provider: "",
          date: "",
          credentialUrl: "",
          description: "",
        },
      ] as unknown as BlockContentMap[T];

    case "memberships":
      return [
        {
          id: nanoid(),
          organization: "",
          role: "",
          startDate: "",
          endDate: "",
          current: false,
        },
      ] as unknown as BlockContentMap[T];

    default:
      return "" as unknown as BlockContentMap[T];
  }
}

/**
 * Create a new block with default content
 */
export function createDefaultBlock(
  type: ResumeBlockType,
  order: number = 0
): AnyResumeBlock {
  return {
    id: nanoid(),
    type,
    order,
    content: createDefaultContent(type),
    isCollapsed: false,
  } as AnyResumeBlock;
}

/**
 * Create a starter resume with core sections
 */
export function createStarterBlocks(): AnyResumeBlock[] {
  return [
    createDefaultBlock("contact", 0),
    createDefaultBlock("summary", 1),
    createDefaultBlock("experience", 2),
    createDefaultBlock("education", 3),
    createDefaultBlock("skills", 4),
  ];
}

/**
 * Create an empty block editor state
 */
export function createEmptyState(): BlockEditorState {
  return {
    blocks: [],
    activeBlockId: null,
    hoveredBlockId: null,
    style: { ...DEFAULT_STYLE },
    isDirty: false,
    isLoading: false,
    error: null,
    fitToOnePage: false,
  };
}

/**
 * Create initial state with starter blocks
 */
export function createInitialState(): BlockEditorState {
  return {
    blocks: createStarterBlocks(),
    activeBlockId: null,
    hoveredBlockId: null,
    style: { ...DEFAULT_STYLE },
    isDirty: false,
    isLoading: false,
    error: null,
    fitToOnePage: false,
  };
}

/**
 * Font family options
 */
export const FONT_FAMILIES = [
  { value: "Inter", label: "Inter" },
  { value: "Roboto", label: "Roboto" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Lato", label: "Lato" },
  { value: "Georgia", label: "Georgia" },
  { value: "Times New Roman", label: "Times New Roman" },
] as const;

/**
 * Style presets (templates)
 */
export const STYLE_PRESETS = {
  classic: {
    fontFamily: "Times New Roman",
    fontSizeBody: 11,
    fontSizeHeading: 14,
    fontSizeSubheading: 12,
    marginTop: 0.75,
    marginBottom: 0.75,
    marginLeft: 0.75,
    marginRight: 0.75,
    lineSpacing: 1.15,
    sectionSpacing: 14,
    entrySpacing: 10,
  } as BlockEditorStyle,

  modern: {
    fontFamily: "Inter",
    fontSizeBody: 10,
    fontSizeHeading: 14,
    fontSizeSubheading: 11,
    marginTop: 0.5,
    marginBottom: 0.5,
    marginLeft: 0.5,
    marginRight: 0.5,
    lineSpacing: 1.15,
    sectionSpacing: 12,
    entrySpacing: 8,
  } as BlockEditorStyle,

  minimal: {
    fontFamily: "Open Sans",
    fontSizeBody: 10,
    fontSizeHeading: 12,
    fontSizeSubheading: 10,
    marginTop: 0.4,
    marginBottom: 0.4,
    marginLeft: 0.4,
    marginRight: 0.4,
    lineSpacing: 1.1,
    sectionSpacing: 10,
    entrySpacing: 6,
  } as BlockEditorStyle,

  executive: {
    fontFamily: "Georgia",
    fontSizeBody: 11,
    fontSizeHeading: 16,
    fontSizeSubheading: 13,
    marginTop: 0.75,
    marginBottom: 0.75,
    marginLeft: 0.75,
    marginRight: 0.75,
    lineSpacing: 1.3,
    sectionSpacing: 16,
    entrySpacing: 10,
  } as BlockEditorStyle,
} as const;

export type StylePresetName = keyof typeof STYLE_PRESETS;
