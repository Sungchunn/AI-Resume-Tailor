/**
 * Resume Diff Utilities
 *
 * Computes differences between original and AI-proposed resume blocks.
 * Used to drive the diff UI rendering - computed once when session initializes.
 */

import type {
  AnyResumeBlock,
  ResumeBlock,
  ResumeBlockType,
  ExperienceEntry,
  EducationEntry,
  CertificationEntry,
  ProjectEntry,
  LanguageEntry,
  VolunteerEntry,
  PublicationEntry,
  AwardEntry,
  ReferenceEntry,
  CourseEntry,
  MembershipEntry,
  ContactContent,
} from "../resume/types";

import type {
  BlockDiff,
  EntryDiff,
  BulletDiff,
  TextDiff,
  SkillsDiff,
} from "./types";

// ============================================================================
// Main Diff Function
// ============================================================================

/**
 * Computes all differences between original and AI-proposed resume blocks.
 * Matches blocks by ID, then deep-compares content.
 *
 * @param original - The original resume blocks
 * @param aiProposed - The AI-proposed resume blocks
 * @returns Array of block diffs
 */
export function computeDiff(
  original: AnyResumeBlock[],
  aiProposed: AnyResumeBlock[]
): BlockDiff[] {
  const diffs: BlockDiff[] = [];
  const originalMap = new Map(original.map((b) => [b.id, b]));
  const aiMap = new Map(aiProposed.map((b) => [b.id, b]));
  const processedIds = new Set<string>();

  // Process blocks that exist in AI proposal
  for (const aiBlock of aiProposed) {
    processedIds.add(aiBlock.id);
    const originalBlock = originalMap.get(aiBlock.id);

    if (!originalBlock) {
      // New block added by AI
      diffs.push({
        blockId: aiBlock.id,
        blockType: aiBlock.type,
        hasChanges: true,
        changeType: "added",
        ...computeBlockContent(undefined, aiBlock),
      });
    } else {
      // Block exists in both - compare content
      const blockDiff = computeBlockDiff(originalBlock, aiBlock);
      diffs.push(blockDiff);
    }
  }

  // Process blocks that only exist in original (removed by AI)
  for (const originalBlock of original) {
    if (!processedIds.has(originalBlock.id)) {
      diffs.push({
        blockId: originalBlock.id,
        blockType: originalBlock.type,
        hasChanges: true,
        changeType: "removed",
        ...computeBlockContent(originalBlock, undefined),
      });
    }
  }

  return diffs;
}

// ============================================================================
// Block-Level Diff
// ============================================================================

/**
 * Computes diff for a single block that exists in both original and AI proposal.
 */
function computeBlockDiff(
  original: AnyResumeBlock,
  aiProposed: AnyResumeBlock
): BlockDiff {
  const baseDiff: Omit<BlockDiff, "entryDiffs" | "textDiff" | "skillsDiff"> = {
    blockId: original.id,
    blockType: original.type,
    hasChanges: false,
    changeType: "unchanged",
  };

  // Dispatch based on block type
  switch (original.type) {
    case "summary":
    case "interests":
      return computeTextBlockDiff(
        original as ResumeBlock<"summary" | "interests">,
        aiProposed as ResumeBlock<"summary" | "interests">
      );

    case "skills":
      return computeSkillsBlockDiff(
        original as ResumeBlock<"skills">,
        aiProposed as ResumeBlock<"skills">
      );

    case "contact":
      return computeContactBlockDiff(
        original as ResumeBlock<"contact">,
        aiProposed as ResumeBlock<"contact">
      );

    case "experience":
      return computeEntryBlockDiff<ExperienceEntry>(
        original as ResumeBlock<"experience">,
        aiProposed as ResumeBlock<"experience">,
        compareExperienceEntry,
        true // has bullets
      );

    case "education":
      return computeEntryBlockDiff<EducationEntry>(
        original as ResumeBlock<"education">,
        aiProposed as ResumeBlock<"education">,
        compareEducationEntry,
        false
      );

    case "certifications":
      return computeEntryBlockDiff<CertificationEntry>(
        original as ResumeBlock<"certifications">,
        aiProposed as ResumeBlock<"certifications">,
        compareCertificationEntry,
        false
      );

    case "projects":
      return computeEntryBlockDiff<ProjectEntry>(
        original as ResumeBlock<"projects">,
        aiProposed as ResumeBlock<"projects">,
        compareProjectEntry,
        true // has optional bullets
      );

    case "languages":
      return computeEntryBlockDiff<LanguageEntry>(
        original as ResumeBlock<"languages">,
        aiProposed as ResumeBlock<"languages">,
        compareLanguageEntry,
        false
      );

    case "volunteer":
      return computeEntryBlockDiff<VolunteerEntry>(
        original as ResumeBlock<"volunteer">,
        aiProposed as ResumeBlock<"volunteer">,
        compareVolunteerEntry,
        true // has optional bullets
      );

    case "publications":
      return computeEntryBlockDiff<PublicationEntry>(
        original as ResumeBlock<"publications">,
        aiProposed as ResumeBlock<"publications">,
        comparePublicationEntry,
        false
      );

    case "awards":
      return computeEntryBlockDiff<AwardEntry>(
        original as ResumeBlock<"awards">,
        aiProposed as ResumeBlock<"awards">,
        compareAwardEntry,
        false
      );

    case "references":
      return computeEntryBlockDiff<ReferenceEntry>(
        original as ResumeBlock<"references">,
        aiProposed as ResumeBlock<"references">,
        compareReferenceEntry,
        false
      );

    case "courses":
      return computeEntryBlockDiff<CourseEntry>(
        original as ResumeBlock<"courses">,
        aiProposed as ResumeBlock<"courses">,
        compareCourseEntry,
        false
      );

    case "memberships":
      return computeEntryBlockDiff<MembershipEntry>(
        original as ResumeBlock<"memberships">,
        aiProposed as ResumeBlock<"memberships">,
        compareMembershipEntry,
        false
      );

    default:
      return { ...baseDiff, hasChanges: false, changeType: "unchanged" };
  }
}

/**
 * Computes content portion of a block diff for added/removed blocks.
 */
function computeBlockContent(
  original: AnyResumeBlock | undefined,
  aiProposed: AnyResumeBlock | undefined
): Partial<BlockDiff> {
  const block = aiProposed || original;
  if (!block) return {};

  switch (block.type) {
    case "summary":
    case "interests": {
      const typedBlock = block as ResumeBlock<"summary" | "interests">;
      return {
        textDiff: {
          originalText: original
            ? (original as ResumeBlock<"summary" | "interests">).content
            : "",
          tailoredText: aiProposed
            ? (aiProposed as ResumeBlock<"summary" | "interests">).content
            : "",
          hasChanges: true,
        },
      };
    }
    case "skills": {
      const origSkills = original
        ? (original as ResumeBlock<"skills">).content
        : [];
      const aiSkills = aiProposed
        ? (aiProposed as ResumeBlock<"skills">).content
        : [];
      return {
        skillsDiff: computeSkillsDiff(origSkills, aiSkills),
      };
    }
    default:
      return {};
  }
}

// ============================================================================
// Text Block Diff (summary, interests)
// ============================================================================

function computeTextBlockDiff(
  original: ResumeBlock<"summary" | "interests">,
  aiProposed: ResumeBlock<"summary" | "interests">
): BlockDiff {
  const hasChanges = original.content !== aiProposed.content;

  return {
    blockId: original.id,
    blockType: original.type,
    hasChanges,
    changeType: hasChanges ? "modified" : "unchanged",
    textDiff: {
      originalText: original.content,
      tailoredText: aiProposed.content,
      hasChanges,
    },
  };
}

// ============================================================================
// Skills Block Diff
// ============================================================================

function computeSkillsBlockDiff(
  original: ResumeBlock<"skills">,
  aiProposed: ResumeBlock<"skills">
): BlockDiff {
  const skillsDiff = computeSkillsDiff(original.content, aiProposed.content);

  return {
    blockId: original.id,
    blockType: original.type,
    hasChanges: skillsDiff.hasChanges,
    changeType: skillsDiff.hasChanges ? "modified" : "unchanged",
    skillsDiff,
  };
}

function computeSkillsDiff(
  original: string[],
  aiProposed: string[]
): SkillsDiff {
  const originalSet = new Set(original.map((s) => s.toLowerCase()));
  const aiSet = new Set(aiProposed.map((s) => s.toLowerCase()));

  const added: string[] = [];
  const removed: string[] = [];
  const unchanged: string[] = [];

  // Find added skills (in AI but not in original)
  for (const skill of aiProposed) {
    if (!originalSet.has(skill.toLowerCase())) {
      added.push(skill);
    } else {
      unchanged.push(skill);
    }
  }

  // Find removed skills (in original but not in AI)
  for (const skill of original) {
    if (!aiSet.has(skill.toLowerCase())) {
      removed.push(skill);
    }
  }

  return {
    added,
    removed,
    unchanged,
    hasChanges: added.length > 0 || removed.length > 0,
  };
}

// ============================================================================
// Contact Block Diff
// ============================================================================

function computeContactBlockDiff(
  original: ResumeBlock<"contact">,
  aiProposed: ResumeBlock<"contact">
): BlockDiff {
  const changedFields = compareContactContent(
    original.content,
    aiProposed.content
  );
  const hasChanges = changedFields.length > 0;

  return {
    blockId: original.id,
    blockType: original.type,
    hasChanges,
    changeType: hasChanges ? "modified" : "unchanged",
    // Contact doesn't have entry diffs - it's a single object
    entryDiffs: hasChanges
      ? [
          {
            entryId: "contact",
            hasChanges: true,
            changeType: "modified",
            changedFields,
          },
        ]
      : undefined,
  };
}

function compareContactContent(
  original: ContactContent,
  aiProposed: ContactContent
): string[] {
  const fields: (keyof ContactContent)[] = [
    "fullName",
    "email",
    "phone",
    "location",
    "linkedin",
    "website",
    "github",
  ];

  return fields.filter((field) => original[field] !== aiProposed[field]);
}

// ============================================================================
// Entry Block Diff (experience, education, projects, etc.)
// ============================================================================

type EntryWithId = { id: string };

function computeEntryBlockDiff<T extends EntryWithId>(
  original: ResumeBlock<ResumeBlockType>,
  aiProposed: ResumeBlock<ResumeBlockType>,
  compareEntry: (orig: T, ai: T) => string[],
  hasBullets: boolean
): BlockDiff {
  const originalEntries = original.content as unknown as T[];
  const aiEntries = aiProposed.content as unknown as T[];

  const originalMap = new Map(originalEntries.map((e) => [e.id, e]));
  const aiMap = new Map(aiEntries.map((e) => [e.id, e]));

  const entryDiffs: EntryDiff[] = [];
  const processedIds = new Set<string>();

  // Process entries in AI proposal
  for (const aiEntry of aiEntries) {
    processedIds.add(aiEntry.id);
    const originalEntry = originalMap.get(aiEntry.id);

    if (!originalEntry) {
      // New entry added by AI
      entryDiffs.push({
        entryId: aiEntry.id,
        hasChanges: true,
        changeType: "added",
        changedFields: Object.keys(aiEntry),
        bulletDiffs: hasBullets
          ? computeBulletDiffs([], getBullets(aiEntry))
          : undefined,
      });
    } else {
      // Entry exists in both - compare
      const changedFields = compareEntry(originalEntry, aiEntry);
      const bulletDiffs = hasBullets
        ? computeBulletDiffs(getBullets(originalEntry), getBullets(aiEntry))
        : undefined;

      const hasChanges =
        changedFields.length > 0 ||
        (bulletDiffs?.some(
          (b) => b.isNew || b.isRemoved || b.isModified
        ) ??
          false);

      entryDiffs.push({
        entryId: aiEntry.id,
        hasChanges,
        changeType: hasChanges ? "modified" : "unchanged",
        changedFields,
        bulletDiffs,
      });
    }
  }

  // Process entries only in original (removed by AI)
  for (const originalEntry of originalEntries) {
    if (!processedIds.has(originalEntry.id)) {
      entryDiffs.push({
        entryId: originalEntry.id,
        hasChanges: true,
        changeType: "removed",
        changedFields: Object.keys(originalEntry),
        bulletDiffs: hasBullets
          ? computeBulletDiffs(getBullets(originalEntry), [])
          : undefined,
      });
    }
  }

  const hasChanges = entryDiffs.some((d) => d.hasChanges);

  return {
    blockId: original.id,
    blockType: original.type,
    hasChanges,
    changeType: hasChanges ? "modified" : "unchanged",
    entryDiffs,
  };
}

// ============================================================================
// Bullet Diff
// ============================================================================

function getBullets(entry: unknown): string[] {
  if (
    typeof entry === "object" &&
    entry !== null &&
    "bullets" in entry &&
    Array.isArray((entry as { bullets: unknown }).bullets)
  ) {
    return (entry as { bullets: string[] }).bullets;
  }
  return [];
}

function computeBulletDiffs(
  original: string[],
  aiProposed: string[]
): BulletDiff[] {
  const diffs: BulletDiff[] = [];
  const maxLen = Math.max(original.length, aiProposed.length);

  for (let i = 0; i < maxLen; i++) {
    const origText = original[i] ?? "";
    const aiText = aiProposed[i] ?? "";

    if (i >= original.length) {
      // New bullet added by AI
      diffs.push({
        bulletIndex: i,
        originalText: "",
        tailoredText: aiText,
        isNew: true,
        isRemoved: false,
        isModified: false,
      });
    } else if (i >= aiProposed.length) {
      // Bullet removed by AI
      diffs.push({
        bulletIndex: i,
        originalText: origText,
        tailoredText: "",
        isNew: false,
        isRemoved: true,
        isModified: false,
      });
    } else if (origText !== aiText) {
      // Bullet modified
      diffs.push({
        bulletIndex: i,
        originalText: origText,
        tailoredText: aiText,
        isNew: false,
        isRemoved: false,
        isModified: true,
      });
    }
    // Unchanged bullets are not included in diffs
  }

  return diffs;
}

// ============================================================================
// Entry Comparison Functions
// ============================================================================

function compareExperienceEntry(
  orig: ExperienceEntry,
  ai: ExperienceEntry
): string[] {
  const fields: string[] = [];
  if (orig.title !== ai.title) fields.push("title");
  if (orig.company !== ai.company) fields.push("company");
  if (orig.location !== ai.location) fields.push("location");
  if (orig.startDate !== ai.startDate) fields.push("startDate");
  if (orig.endDate !== ai.endDate) fields.push("endDate");
  if (orig.current !== ai.current) fields.push("current");
  // Bullets are handled separately
  return fields;
}

function compareEducationEntry(
  orig: EducationEntry,
  ai: EducationEntry
): string[] {
  const fields: string[] = [];
  if (orig.degree !== ai.degree) fields.push("degree");
  if (orig.institution !== ai.institution) fields.push("institution");
  if (orig.location !== ai.location) fields.push("location");
  if (orig.graduationDate !== ai.graduationDate) fields.push("graduationDate");
  if (orig.gpa !== ai.gpa) fields.push("gpa");
  if (orig.honors !== ai.honors) fields.push("honors");
  if (
    JSON.stringify(orig.relevantCourses) !==
    JSON.stringify(ai.relevantCourses)
  ) {
    fields.push("relevantCourses");
  }
  return fields;
}

function compareCertificationEntry(
  orig: CertificationEntry,
  ai: CertificationEntry
): string[] {
  const fields: string[] = [];
  if (orig.name !== ai.name) fields.push("name");
  if (orig.issuer !== ai.issuer) fields.push("issuer");
  if (orig.date !== ai.date) fields.push("date");
  if (orig.expirationDate !== ai.expirationDate) fields.push("expirationDate");
  if (orig.credentialId !== ai.credentialId) fields.push("credentialId");
  if (orig.url !== ai.url) fields.push("url");
  return fields;
}

function compareProjectEntry(orig: ProjectEntry, ai: ProjectEntry): string[] {
  const fields: string[] = [];
  if (orig.name !== ai.name) fields.push("name");
  if (orig.description !== ai.description) fields.push("description");
  if (JSON.stringify(orig.technologies) !== JSON.stringify(ai.technologies)) {
    fields.push("technologies");
  }
  if (orig.url !== ai.url) fields.push("url");
  if (orig.startDate !== ai.startDate) fields.push("startDate");
  if (orig.endDate !== ai.endDate) fields.push("endDate");
  // Bullets are handled separately
  return fields;
}

function compareLanguageEntry(
  orig: LanguageEntry,
  ai: LanguageEntry
): string[] {
  const fields: string[] = [];
  if (orig.language !== ai.language) fields.push("language");
  if (orig.proficiency !== ai.proficiency) fields.push("proficiency");
  return fields;
}

function compareVolunteerEntry(
  orig: VolunteerEntry,
  ai: VolunteerEntry
): string[] {
  const fields: string[] = [];
  if (orig.role !== ai.role) fields.push("role");
  if (orig.organization !== ai.organization) fields.push("organization");
  if (orig.location !== ai.location) fields.push("location");
  if (orig.startDate !== ai.startDate) fields.push("startDate");
  if (orig.endDate !== ai.endDate) fields.push("endDate");
  if (orig.current !== ai.current) fields.push("current");
  if (orig.description !== ai.description) fields.push("description");
  // Bullets are handled separately
  return fields;
}

function comparePublicationEntry(
  orig: PublicationEntry,
  ai: PublicationEntry
): string[] {
  const fields: string[] = [];
  if (orig.title !== ai.title) fields.push("title");
  if (orig.publicationType !== ai.publicationType) {
    fields.push("publicationType");
  }
  if (orig.publisher !== ai.publisher) fields.push("publisher");
  if (orig.date !== ai.date) fields.push("date");
  if (orig.url !== ai.url) fields.push("url");
  if (orig.authors !== ai.authors) fields.push("authors");
  if (orig.description !== ai.description) fields.push("description");
  return fields;
}

function compareAwardEntry(orig: AwardEntry, ai: AwardEntry): string[] {
  const fields: string[] = [];
  if (orig.title !== ai.title) fields.push("title");
  if (orig.issuer !== ai.issuer) fields.push("issuer");
  if (orig.date !== ai.date) fields.push("date");
  if (orig.description !== ai.description) fields.push("description");
  return fields;
}

function compareReferenceEntry(
  orig: ReferenceEntry,
  ai: ReferenceEntry
): string[] {
  const fields: string[] = [];
  if (orig.name !== ai.name) fields.push("name");
  if (orig.title !== ai.title) fields.push("title");
  if (orig.company !== ai.company) fields.push("company");
  if (orig.email !== ai.email) fields.push("email");
  if (orig.phone !== ai.phone) fields.push("phone");
  if (orig.relationship !== ai.relationship) fields.push("relationship");
  return fields;
}

function compareCourseEntry(orig: CourseEntry, ai: CourseEntry): string[] {
  const fields: string[] = [];
  if (orig.name !== ai.name) fields.push("name");
  if (orig.provider !== ai.provider) fields.push("provider");
  if (orig.date !== ai.date) fields.push("date");
  if (orig.credentialUrl !== ai.credentialUrl) fields.push("credentialUrl");
  if (orig.description !== ai.description) fields.push("description");
  return fields;
}

function compareMembershipEntry(
  orig: MembershipEntry,
  ai: MembershipEntry
): string[] {
  const fields: string[] = [];
  if (orig.organization !== ai.organization) fields.push("organization");
  if (orig.role !== ai.role) fields.push("role");
  if (orig.startDate !== ai.startDate) fields.push("startDate");
  if (orig.endDate !== ai.endDate) fields.push("endDate");
  if (orig.current !== ai.current) fields.push("current");
  return fields;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Gets a summary of changes for display.
 */
export function getDiffSummary(diffs: BlockDiff[]): {
  totalChanges: number;
  modifiedBlocks: number;
  addedBlocks: number;
  removedBlocks: number;
} {
  let modifiedBlocks = 0;
  let addedBlocks = 0;
  let removedBlocks = 0;

  for (const diff of diffs) {
    if (diff.changeType === "modified") modifiedBlocks++;
    else if (diff.changeType === "added") addedBlocks++;
    else if (diff.changeType === "removed") removedBlocks++;
  }

  return {
    totalChanges: modifiedBlocks + addedBlocks + removedBlocks,
    modifiedBlocks,
    addedBlocks,
    removedBlocks,
  };
}

/**
 * Checks if any diffs have changes.
 */
export function hasAnyChanges(diffs: BlockDiff[]): boolean {
  return diffs.some((d) => d.hasChanges);
}

/**
 * Filters diffs to only those with changes.
 */
export function getChangedDiffs(diffs: BlockDiff[]): BlockDiff[] {
  return diffs.filter((d) => d.hasChanges);
}
