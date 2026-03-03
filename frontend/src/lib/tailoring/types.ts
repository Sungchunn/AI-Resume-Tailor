/**
 * Tailoring Session Types
 *
 * Types for the "Two Copies" resume tailoring architecture.
 * The frontend maintains three documents: original (read-only),
 * AI proposal (read-only), and active draft (mutable).
 */

import type {
  AnyResumeBlock,
  ResumeBlockType,
  ExperienceEntry,
  ProjectEntry,
  VolunteerEntry,
} from "../resume/types";

// ============================================================================
// Core Session Types
// ============================================================================

/**
 * The main tailoring session state.
 * Holds three versions of the resume and tracks accepted changes.
 */
export interface TailoringSession {
  /** Session identifier (matches backend tailored_resumes.id) */
  id: string;

  /** READ-ONLY: The user's original resume blocks, never mutated. */
  originalResume: AnyResumeBlock[];

  /** READ-ONLY: The AI's complete proposed resume blocks, never mutated. */
  aiProposedResume: AnyResumeBlock[];

  /** MUTABLE: The working document the user is building. */
  activeDraft: AnyResumeBlock[];

  /**
   * Tracks which sections/entries/bullets have been accepted from the AI proposal.
   * Used for UI state (highlight accepted sections, enable "Reject" button).
   * Keys are hierarchical: "blockId", "blockId.entryId", "blockId.entryId.bulletIndex"
   */
  acceptedChanges: Set<string>;
}

/**
 * Serializable version of TailoringSession for storage/transfer.
 * Set<string> is converted to string[] for JSON compatibility.
 */
export interface SerializableTailoringSession {
  id: string;
  originalResume: AnyResumeBlock[];
  aiProposedResume: AnyResumeBlock[];
  activeDraft: AnyResumeBlock[];
  acceptedChanges: string[];
}

// ============================================================================
// Diff Types
// ============================================================================

/**
 * Represents a difference detected between original and AI-proposed resume.
 * Computed once when the session initializes - drives the diff UI rendering.
 */
export interface BlockDiff {
  /** Block ID (matches ResumeBlock.id) */
  blockId: string;

  /** Block type for UI rendering */
  blockType: ResumeBlockType;

  /** Whether any differences exist in this block */
  hasChanges: boolean;

  /** Type of change at block level */
  changeType: "modified" | "added" | "removed" | "unchanged";

  /** For blocks with entries (experience, projects, etc.) */
  entryDiffs?: EntryDiff[];

  /** For simple text blocks (summary, interests) */
  textDiff?: TextDiff;

  /** For skills block (string array) */
  skillsDiff?: SkillsDiff;
}

/**
 * Difference within an entry (e.g., one experience item, one project).
 */
export interface EntryDiff {
  /** Entry ID (matches ExperienceEntry.id, ProjectEntry.id, etc.) */
  entryId: string;

  /** Whether this entry has changes */
  hasChanges: boolean;

  /** Type of change */
  changeType: "modified" | "added" | "removed" | "unchanged";

  /** Fields that changed (e.g., ["title", "bullets"]) */
  changedFields: string[];

  /** For entries with bullets (experience, projects, volunteer) */
  bulletDiffs?: BulletDiff[];
}

/**
 * Difference for a single bullet point.
 */
export interface BulletDiff {
  /** Index in the bullets array */
  bulletIndex: number;

  /** Original text (empty string if new) */
  originalText: string;

  /** AI-proposed text (empty string if removed) */
  tailoredText: string;

  /** Bullet exists only in AI proposal */
  isNew: boolean;

  /** Bullet exists only in original */
  isRemoved: boolean;

  /** Bullet text was modified */
  isModified: boolean;
}

/**
 * Text difference for simple text blocks.
 */
export interface TextDiff {
  originalText: string;
  tailoredText: string;
  hasChanges: boolean;
}

/**
 * Skills array difference.
 */
export interface SkillsDiff {
  added: string[];
  removed: string[];
  unchanged: string[];
  hasChanges: boolean;
}

// ============================================================================
// Accept/Reject Key Utilities
// ============================================================================

/**
 * Creates a key for tracking accepted changes.
 */
export function createAcceptKey(
  blockId: string,
  entryId?: string,
  bulletIndex?: number
): string {
  if (entryId !== undefined && bulletIndex !== undefined) {
    return `${blockId}.${entryId}.${bulletIndex}`;
  }
  if (entryId !== undefined) {
    return `${blockId}.${entryId}`;
  }
  return blockId;
}

/**
 * Parses an accept key into its components.
 */
export function parseAcceptKey(key: string): {
  blockId: string;
  entryId?: string;
  bulletIndex?: number;
} {
  const parts = key.split(".");
  return {
    blockId: parts[0],
    entryId: parts[1],
    bulletIndex: parts[2] !== undefined ? parseInt(parts[2], 10) : undefined,
  };
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for entries that have bullets.
 */
export type EntryWithBullets = ExperienceEntry | ProjectEntry | VolunteerEntry;

export function hasRequiredBullets(
  entry: unknown
): entry is { id: string; bullets: string[] } {
  return (
    typeof entry === "object" &&
    entry !== null &&
    "id" in entry &&
    "bullets" in entry &&
    Array.isArray((entry as { bullets: unknown }).bullets)
  );
}

export function hasOptionalBullets(
  entry: unknown
): entry is { id: string; bullets?: string[] } {
  return (
    typeof entry === "object" &&
    entry !== null &&
    "id" in entry &&
    (!("bullets" in entry) ||
      (entry as { bullets: unknown }).bullets === undefined ||
      Array.isArray((entry as { bullets: unknown }).bullets))
  );
}

// ============================================================================
// Session Serialization
// ============================================================================

/**
 * Converts a TailoringSession to a serializable format.
 */
export function serializeSession(
  session: TailoringSession
): SerializableTailoringSession {
  return {
    ...session,
    acceptedChanges: Array.from(session.acceptedChanges),
  };
}

/**
 * Restores a TailoringSession from serialized format.
 */
export function deserializeSession(
  data: SerializableTailoringSession
): TailoringSession {
  return {
    ...data,
    acceptedChanges: new Set(data.acceptedChanges),
  };
}
