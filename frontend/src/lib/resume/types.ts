/**
 * Block-based Resume Types
 *
 * These types define the structure for block-based resume editing.
 * Each resume consists of an ordered array of typed blocks.
 */

// Block type identifiers - comprehensive set of predefined sections
export type ResumeBlockType =
  | "contact"
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "certifications"
  | "projects"
  | "languages"
  | "volunteer"
  | "publications"
  | "awards"
  | "interests"
  | "references"
  | "courses"
  | "memberships";

// Contact information content
export interface ContactContent {
  fullName: string;
  email: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  website?: string;
  github?: string;
}

// Experience entry content
export interface ExperienceEntry {
  id: string;
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate: string;
  current?: boolean;
  bullets: string[];
}

// Education entry content
export interface EducationEntry {
  id: string;
  degree: string;
  institution: string;
  location?: string;
  graduationDate: string;
  gpa?: string;
  honors?: string;
  relevantCourses?: string[];
}

// Certification entry content
export interface CertificationEntry {
  id: string;
  name: string;
  issuer: string;
  date?: string;
  expirationDate?: string;
  credentialId?: string;
  url?: string;
}

// Project entry content
export interface ProjectEntry {
  id: string;
  name: string;
  description: string;
  technologies?: string[];
  url?: string;
  startDate?: string;
  endDate?: string;
  bullets?: string[];
}

// Language proficiency entry
export type LanguageProficiency =
  | "native"
  | "fluent"
  | "advanced"
  | "intermediate"
  | "basic";

export interface LanguageEntry {
  id: string;
  language: string;
  proficiency: LanguageProficiency;
}

// Volunteer/community service entry
export interface VolunteerEntry {
  id: string;
  role: string;
  organization: string;
  location?: string;
  startDate: string;
  endDate?: string;
  current?: boolean;
  description?: string;
  bullets?: string[];
}

// Publication entry (papers, articles, books)
export type PublicationType = "paper" | "article" | "book" | "thesis" | "patent" | "other";

export interface PublicationEntry {
  id: string;
  title: string;
  publicationType: PublicationType;
  publisher?: string;
  date?: string;
  url?: string;
  authors?: string;
  description?: string;
}

// Award/honor entry
export interface AwardEntry {
  id: string;
  title: string;
  issuer: string;
  date?: string;
  description?: string;
}

// Reference entry
export interface ReferenceEntry {
  id: string;
  name: string;
  title: string;
  company: string;
  email?: string;
  phone?: string;
  relationship?: string;
}

// Course/training entry
export interface CourseEntry {
  id: string;
  name: string;
  provider: string;
  date?: string;
  credentialUrl?: string;
  description?: string;
}

// Professional membership entry
export interface MembershipEntry {
  id: string;
  organization: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
}

// Union type for all block content types
export type BlockContent =
  | ContactContent
  | string // summary, interests (rich text HTML)
  | ExperienceEntry[]
  | EducationEntry[]
  | string[] // skills
  | CertificationEntry[]
  | ProjectEntry[]
  | LanguageEntry[]
  | VolunteerEntry[]
  | PublicationEntry[]
  | AwardEntry[]
  | ReferenceEntry[]
  | CourseEntry[]
  | MembershipEntry[];

// Content type mapping for each block type
export type BlockContentMap = {
  contact: ContactContent;
  summary: string;
  experience: ExperienceEntry[];
  education: EducationEntry[];
  skills: string[];
  certifications: CertificationEntry[];
  projects: ProjectEntry[];
  languages: LanguageEntry[];
  volunteer: VolunteerEntry[];
  publications: PublicationEntry[];
  awards: AwardEntry[];
  interests: string; // Rich text for freeform interests
  references: ReferenceEntry[];
  courses: CourseEntry[];
  memberships: MembershipEntry[];
};

// Generic resume block interface
export interface ResumeBlock<T extends ResumeBlockType = ResumeBlockType> {
  id: string;
  type: T;
  content: BlockContentMap[T];
  order: number;
  isCollapsed?: boolean;
  isHidden?: boolean; // Controls visibility in preview/export
}

// Type-specific block interfaces for convenience
export type ContactBlock = ResumeBlock<"contact">;
export type SummaryBlock = ResumeBlock<"summary">;
export type ExperienceBlock = ResumeBlock<"experience">;
export type EducationBlock = ResumeBlock<"education">;
export type SkillsBlock = ResumeBlock<"skills">;
export type CertificationsBlock = ResumeBlock<"certifications">;
export type ProjectsBlock = ResumeBlock<"projects">;
export type LanguagesBlock = ResumeBlock<"languages">;
export type VolunteerBlock = ResumeBlock<"volunteer">;
export type PublicationsBlock = ResumeBlock<"publications">;
export type AwardsBlock = ResumeBlock<"awards">;
export type InterestsBlock = ResumeBlock<"interests">;
export type ReferencesBlock = ResumeBlock<"references">;
export type CoursesBlock = ResumeBlock<"courses">;
export type MembershipsBlock = ResumeBlock<"memberships">;

// Union of all specific block types
export type AnyResumeBlock =
  | ContactBlock
  | SummaryBlock
  | ExperienceBlock
  | EducationBlock
  | SkillsBlock
  | CertificationsBlock
  | ProjectsBlock
  | LanguagesBlock
  | VolunteerBlock
  | PublicationsBlock
  | AwardsBlock
  | InterestsBlock
  | ReferencesBlock
  | CoursesBlock
  | MembershipsBlock;

// Resume style settings (reuses existing ResumeStyle pattern)
export interface BlockEditorStyle {
  fontFamily: string;
  fontSizeBody: number;
  fontSizeHeading: number;
  fontSizeSubheading: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  lineSpacing: number;
  sectionSpacing: number;
  entrySpacing: number;
}

// Block editor state
export interface BlockEditorState {
  blocks: AnyResumeBlock[];
  activeBlockId: string | null;
  hoveredBlockId: string | null;
  style: BlockEditorStyle;
  isDirty: boolean;
  isLoading: boolean;
  error: string | null;
  fitToOnePage: boolean;
}

// Block editor actions
export type BlockEditorAction =
  | { type: "SET_BLOCKS"; payload: AnyResumeBlock[] }
  | { type: "ADD_BLOCK"; payload: { blockType: ResumeBlockType; afterId?: string } }
  | { type: "REMOVE_BLOCK"; payload: { id: string } }
  | { type: "REORDER_BLOCKS"; payload: { activeId: string; overId: string } }
  | { type: "UPDATE_BLOCK"; payload: { id: string; content: BlockContent } }
  | { type: "SET_ACTIVE_BLOCK"; payload: string | null }
  | { type: "SET_HOVERED_BLOCK"; payload: string | null }
  | { type: "MOVE_BLOCK_UP"; payload: string }
  | { type: "MOVE_BLOCK_DOWN"; payload: string }
  | { type: "TOGGLE_COLLAPSE"; payload: { id: string } }
  | { type: "TOGGLE_VISIBILITY"; payload: { id: string } }
  | { type: "SET_STYLE"; payload: Partial<BlockEditorStyle> }
  | { type: "SET_FIT_TO_ONE_PAGE"; payload: boolean }
  | { type: "SET_DIRTY"; payload: boolean }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "RESET"; payload: BlockEditorState };

// Block type metadata for UI
export interface BlockTypeInfo {
  type: ResumeBlockType;
  label: string;
  description: string;
  icon: string; // Lucide icon name
  allowMultiple: boolean;
  category: "core" | "professional" | "additional";
}

// Parsed content structure from backend
export interface ParsedResumeContent {
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    website?: string;
    github?: string;
  };
  summary?: string;
  experience?: Array<{
    title?: string;
    company?: string;
    location?: string;
    start_date?: string;
    end_date?: string;
    bullets?: string[];
  }>;
  education?: Array<{
    degree?: string;
    institution?: string;
    location?: string;
    graduation_date?: string;
    gpa?: string;
    honors?: string;
    relevant_courses?: string[];
  }>;
  skills?: string[];
  certifications?: Array<{
    name?: string;
    issuer?: string;
    date?: string;
    expiration_date?: string;
    credential_id?: string;
    url?: string;
  }>;
  projects?: Array<{
    name?: string;
    description?: string;
    technologies?: string[];
    url?: string;
    start_date?: string;
    end_date?: string;
    bullets?: string[];
  }>;
  languages?: Array<{
    language?: string;
    proficiency?: string;
  }>;
  volunteer?: Array<{
    role?: string;
    organization?: string;
    location?: string;
    start_date?: string;
    end_date?: string;
    description?: string;
    bullets?: string[];
  }>;
  publications?: Array<{
    title?: string;
    publication_type?: string;
    publisher?: string;
    date?: string;
    url?: string;
    authors?: string;
    description?: string;
  }>;
  awards?: Array<{
    title?: string;
    issuer?: string;
    date?: string;
    description?: string;
  }>;
  interests?: string;
  references?: Array<{
    name?: string;
    title?: string;
    company?: string;
    email?: string;
    phone?: string;
    relationship?: string;
  }>;
  courses?: Array<{
    name?: string;
    provider?: string;
    date?: string;
    credential_url?: string;
    description?: string;
  }>;
  memberships?: Array<{
    organization?: string;
    role?: string;
    start_date?: string;
    end_date?: string;
  }>;
}
