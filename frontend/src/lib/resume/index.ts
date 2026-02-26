/**
 * Resume block-based editing utilities
 */

// Types
export type {
  ResumeBlockType,
  ContactContent,
  ExperienceEntry,
  EducationEntry,
  CertificationEntry,
  ProjectEntry,
  LanguageProficiency,
  LanguageEntry,
  VolunteerEntry,
  PublicationType,
  PublicationEntry,
  AwardEntry,
  ReferenceEntry,
  CourseEntry,
  MembershipEntry,
  BlockContent,
  BlockContentMap,
  ResumeBlock,
  ContactBlock,
  SummaryBlock,
  ExperienceBlock,
  EducationBlock,
  SkillsBlock,
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
  AnyResumeBlock,
  BlockEditorStyle,
  BlockEditorState,
  BlockEditorAction,
  BlockTypeInfo,
  ParsedResumeContent,
} from "./types";

// Transforms
export {
  parsedContentToBlocks,
  blocksToParsedContent,
  apiStyleToEditorStyle,
  editorStyleToApiStyle,
  insertBlockAfter,
  removeBlock,
  reorderBlocks,
  updateBlockContent,
  getBlockSectionOrder,
} from "./transforms";

// Defaults
export {
  DEFAULT_STYLE,
  BLOCK_TYPE_INFO,
  DEFAULT_BLOCK_ORDER,
  CATEGORY_LABELS,
  getBlockTypesByCategory,
  createDefaultContent,
  createDefaultBlock,
  createStarterBlocks,
  createEmptyState,
  createInitialState,
  FONT_FAMILIES,
  STYLE_PRESETS,
} from "./defaults";

export type { StylePresetName } from "./defaults";
