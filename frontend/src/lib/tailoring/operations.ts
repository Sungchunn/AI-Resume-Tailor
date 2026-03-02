/**
 * Tailoring Session Operations
 *
 * Pure functions for accept/reject operations on the active draft.
 * Each operation returns a new TailoringSession with the mutation applied.
 * Uses structuredClone to ensure React detects state changes.
 */

import type { AnyResumeBlock, ResumeBlock, ResumeBlockType } from "../resume/types";
import type { TailoringSession, BlockDiff } from "./types";
import { createAcceptKey } from "./types";

// ============================================================================
// Session Initialization
// ============================================================================

/**
 * Initializes a new tailoring session with the three-state model.
 *
 * @param id - Session ID (matches backend tailored_resumes.id)
 * @param original - The user's original resume blocks
 * @param aiProposed - The AI's proposed resume blocks
 * @returns Initialized TailoringSession
 */
export function initializeTailoringSession(
  id: number,
  original: AnyResumeBlock[],
  aiProposed: AnyResumeBlock[]
): TailoringSession {
  return {
    id,
    originalResume: Object.freeze(original) as AnyResumeBlock[],
    aiProposedResume: Object.freeze(aiProposed) as AnyResumeBlock[],
    activeDraft: structuredClone(original),
    acceptedChanges: new Set(),
  };
}

// ============================================================================
// Block-Level Operations
// ============================================================================

/**
 * Accepts an entire block from the AI proposal.
 * Replaces the block in the active draft with the AI version.
 */
export function acceptBlock(
  session: TailoringSession,
  blockId: string
): TailoringSession {
  const draft = structuredClone(session.activeDraft);
  const accepted = new Set(session.acceptedChanges);

  const aiBlock = session.aiProposedResume.find((b) => b.id === blockId);
  const draftIndex = draft.findIndex((b) => b.id === blockId);

  if (aiBlock) {
    if (draftIndex !== -1) {
      // Replace existing block
      draft[draftIndex] = structuredClone(aiBlock);
    } else {
      // AI added a new block - append it (or insert at AI's position)
      const aiIndex = session.aiProposedResume.findIndex(
        (b) => b.id === blockId
      );
      draft.splice(aiIndex, 0, structuredClone(aiBlock));
    }

    accepted.add(blockId);

    // Mark all nested items as accepted (for entry-based blocks)
    markNestedItemsAccepted(aiBlock, blockId, accepted);
  }

  return { ...session, activeDraft: draft, acceptedChanges: accepted };
}

/**
 * Rejects a block, restoring it from the original resume.
 * If the block was added by AI, removes it from the draft.
 */
export function rejectBlock(
  session: TailoringSession,
  blockId: string
): TailoringSession {
  const draft = structuredClone(session.activeDraft);
  const accepted = new Set(session.acceptedChanges);

  const originalBlock = session.originalResume.find((b) => b.id === blockId);
  const draftIndex = draft.findIndex((b) => b.id === blockId);

  if (originalBlock && draftIndex !== -1) {
    // Restore from original
    draft[draftIndex] = structuredClone(originalBlock);
  } else if (!originalBlock && draftIndex !== -1) {
    // Block was added by AI and doesn't exist in original - remove it
    draft.splice(draftIndex, 1);
  }

  // Remove all acceptance markers for this block and its children
  accepted.delete(blockId);
  for (const key of accepted) {
    if (key.startsWith(`${blockId}.`)) {
      accepted.delete(key);
    }
  }

  return { ...session, activeDraft: draft, acceptedChanges: accepted };
}

// ============================================================================
// Entry-Level Operations
// ============================================================================

/**
 * Accepts a single entry within a block (e.g., one experience item).
 */
export function acceptEntry(
  session: TailoringSession,
  blockId: string,
  entryId: string
): TailoringSession {
  const draft = structuredClone(session.activeDraft);
  const accepted = new Set(session.acceptedChanges);

  const aiBlock = session.aiProposedResume.find((b) => b.id === blockId);
  const draftBlock = draft.find((b) => b.id === blockId);

  if (!aiBlock || !draftBlock || !isEntryBlock(aiBlock)) {
    return session;
  }

  const aiEntries = aiBlock.content as Array<{ id: string }>;
  const draftEntries = draftBlock.content as Array<{ id: string }>;

  const aiEntry = aiEntries.find((e) => e.id === entryId);
  const draftEntryIndex = draftEntries.findIndex((e) => e.id === entryId);

  if (aiEntry) {
    if (draftEntryIndex !== -1) {
      // Replace existing entry
      draftEntries[draftEntryIndex] = structuredClone(aiEntry);
    } else {
      // AI added a new entry - append it
      draftEntries.push(structuredClone(aiEntry));
    }

    const entryKey = createAcceptKey(blockId, entryId);
    accepted.add(entryKey);

    // Mark bullets as accepted if entry has them
    if ("bullets" in aiEntry && Array.isArray((aiEntry as { bullets: string[] }).bullets)) {
      const bullets = (aiEntry as { bullets: string[] }).bullets;
      for (let i = 0; i < bullets.length; i++) {
        accepted.add(createAcceptKey(blockId, entryId, i));
      }
    }
  }

  return { ...session, activeDraft: draft, acceptedChanges: accepted };
}

/**
 * Rejects a single entry, restoring it from original or removing if AI-added.
 */
export function rejectEntry(
  session: TailoringSession,
  blockId: string,
  entryId: string
): TailoringSession {
  const draft = structuredClone(session.activeDraft);
  const accepted = new Set(session.acceptedChanges);

  const originalBlock = session.originalResume.find((b) => b.id === blockId);
  const draftBlock = draft.find((b) => b.id === blockId);

  if (!draftBlock || !isEntryBlock(draftBlock)) {
    return session;
  }

  const draftEntries = draftBlock.content as Array<{ id: string }>;
  const draftEntryIndex = draftEntries.findIndex((e) => e.id === entryId);

  if (originalBlock && isEntryBlock(originalBlock)) {
    const originalEntries = originalBlock.content as Array<{ id: string }>;
    const originalEntry = originalEntries.find((e) => e.id === entryId);

    if (originalEntry && draftEntryIndex !== -1) {
      // Restore from original
      draftEntries[draftEntryIndex] = structuredClone(originalEntry);
    } else if (!originalEntry && draftEntryIndex !== -1) {
      // Entry was added by AI - remove it
      draftEntries.splice(draftEntryIndex, 1);
    }
  } else if (draftEntryIndex !== -1) {
    // No original block - remove the entry
    draftEntries.splice(draftEntryIndex, 1);
  }

  // Remove acceptance markers
  const entryKey = createAcceptKey(blockId, entryId);
  accepted.delete(entryKey);
  for (const key of accepted) {
    if (key.startsWith(`${entryKey}.`)) {
      accepted.delete(key);
    }
  }

  return { ...session, activeDraft: draft, acceptedChanges: accepted };
}

// ============================================================================
// Bullet-Level Operations
// ============================================================================

/**
 * Accepts a single bullet within an entry.
 */
export function acceptBullet(
  session: TailoringSession,
  blockId: string,
  entryId: string,
  bulletIndex: number
): TailoringSession {
  const draft = structuredClone(session.activeDraft);
  const accepted = new Set(session.acceptedChanges);

  const aiBlock = session.aiProposedResume.find((b) => b.id === blockId);
  const draftBlock = draft.find((b) => b.id === blockId);

  if (!aiBlock || !draftBlock || !isEntryBlock(aiBlock)) {
    return session;
  }

  const aiEntries = aiBlock.content as Array<{ id: string; bullets?: string[] }>;
  const draftEntries = draftBlock.content as Array<{ id: string; bullets?: string[] }>;

  const aiEntry = aiEntries.find((e) => e.id === entryId);
  const draftEntry = draftEntries.find((e) => e.id === entryId);

  if (!aiEntry?.bullets || !draftEntry) {
    return session;
  }

  const aiBullet = aiEntry.bullets[bulletIndex];
  if (aiBullet === undefined) {
    return session;
  }

  // Ensure bullets array exists
  if (!draftEntry.bullets) {
    draftEntry.bullets = [];
  }

  if (bulletIndex < draftEntry.bullets.length) {
    // Replace existing bullet
    draftEntry.bullets[bulletIndex] = aiBullet;
  } else {
    // New bullet - append it
    draftEntry.bullets.push(aiBullet);
  }

  accepted.add(createAcceptKey(blockId, entryId, bulletIndex));

  return { ...session, activeDraft: draft, acceptedChanges: accepted };
}

/**
 * Rejects a single bullet, restoring from original or removing if AI-added.
 */
export function rejectBullet(
  session: TailoringSession,
  blockId: string,
  entryId: string,
  bulletIndex: number
): TailoringSession {
  const draft = structuredClone(session.activeDraft);
  const accepted = new Set(session.acceptedChanges);

  const originalBlock = session.originalResume.find((b) => b.id === blockId);
  const draftBlock = draft.find((b) => b.id === blockId);

  if (!draftBlock || !isEntryBlock(draftBlock)) {
    return session;
  }

  const draftEntries = draftBlock.content as Array<{ id: string; bullets?: string[] }>;
  const draftEntry = draftEntries.find((e) => e.id === entryId);

  if (!draftEntry?.bullets) {
    return session;
  }

  let originalBullet: string | undefined;

  if (originalBlock && isEntryBlock(originalBlock)) {
    const originalEntries = originalBlock.content as Array<{ id: string; bullets?: string[] }>;
    const originalEntry = originalEntries.find((e) => e.id === entryId);
    originalBullet = originalEntry?.bullets?.[bulletIndex];
  }

  if (originalBullet !== undefined) {
    // Restore from original
    draftEntry.bullets[bulletIndex] = originalBullet;
  } else if (bulletIndex < draftEntry.bullets.length) {
    // Bullet was added by AI - remove it
    draftEntry.bullets.splice(bulletIndex, 1);
  }

  accepted.delete(createAcceptKey(blockId, entryId, bulletIndex));

  return { ...session, activeDraft: draft, acceptedChanges: accepted };
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Accepts all changes from all diffs.
 */
export function acceptAll(
  session: TailoringSession,
  diffs: BlockDiff[]
): TailoringSession {
  let updated = session;

  for (const diff of diffs) {
    if (diff.hasChanges) {
      updated = acceptBlock(updated, diff.blockId);
    }
  }

  return updated;
}

/**
 * Rejects all changes, restoring the draft to the original.
 */
export function rejectAll(session: TailoringSession): TailoringSession {
  return {
    ...session,
    activeDraft: structuredClone(session.originalResume),
    acceptedChanges: new Set(),
  };
}

/**
 * Accepts all changes within a specific block (all entries, all bullets).
 */
export function acceptAllInBlock(
  session: TailoringSession,
  blockId: string
): TailoringSession {
  // This is the same as acceptBlock - it replaces the entire block
  return acceptBlock(session, blockId);
}

/**
 * Rejects all changes within a specific block.
 */
export function rejectAllInBlock(
  session: TailoringSession,
  blockId: string
): TailoringSession {
  return rejectBlock(session, blockId);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Entry block types - blocks that contain arrays of entries with IDs.
 */
type EntryBlockType =
  | "experience"
  | "education"
  | "certifications"
  | "projects"
  | "languages"
  | "volunteer"
  | "publications"
  | "awards"
  | "references"
  | "courses"
  | "memberships";

const ENTRY_BLOCK_TYPES: EntryBlockType[] = [
  "experience",
  "education",
  "certifications",
  "projects",
  "languages",
  "volunteer",
  "publications",
  "awards",
  "references",
  "courses",
  "memberships",
];

/**
 * Checks if a block contains an array of entries with IDs.
 */
function isEntryBlock(block: AnyResumeBlock): boolean {
  return ENTRY_BLOCK_TYPES.includes(block.type as EntryBlockType) && Array.isArray(block.content);
}

/**
 * Marks all nested items in a block as accepted.
 */
function markNestedItemsAccepted(
  block: AnyResumeBlock,
  blockId: string,
  accepted: Set<string>
): void {
  if (!isEntryBlock(block)) {
    return;
  }

  const entries = block.content as Array<{ id: string; bullets?: string[] }>;

  for (const entry of entries) {
    accepted.add(createAcceptKey(blockId, entry.id));

    if (entry.bullets) {
      for (let i = 0; i < entry.bullets.length; i++) {
        accepted.add(createAcceptKey(blockId, entry.id, i));
      }
    }
  }
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Checks if a block has been accepted.
 */
export function isBlockAccepted(
  session: TailoringSession,
  blockId: string
): boolean {
  return session.acceptedChanges.has(blockId);
}

/**
 * Checks if an entry has been accepted.
 */
export function isEntryAccepted(
  session: TailoringSession,
  blockId: string,
  entryId: string
): boolean {
  return session.acceptedChanges.has(createAcceptKey(blockId, entryId));
}

/**
 * Checks if a bullet has been accepted.
 */
export function isBulletAccepted(
  session: TailoringSession,
  blockId: string,
  entryId: string,
  bulletIndex: number
): boolean {
  return session.acceptedChanges.has(
    createAcceptKey(blockId, entryId, bulletIndex)
  );
}

/**
 * Gets the count of accepted changes.
 */
export function getAcceptedCount(session: TailoringSession): number {
  return session.acceptedChanges.size;
}

/**
 * Checks if the draft has any accepted changes from the AI proposal.
 */
export function hasAcceptedChanges(session: TailoringSession): boolean {
  return session.acceptedChanges.size > 0;
}

/**
 * Checks if the draft differs from the original.
 */
export function isDraftModified(session: TailoringSession): boolean {
  // Quick check using accepted changes count
  if (session.acceptedChanges.size > 0) {
    return true;
  }
  // Deep comparison if no accepted changes (shouldn't normally differ)
  return (
    JSON.stringify(session.activeDraft) !==
    JSON.stringify(session.originalResume)
  );
}

// ============================================================================
// Bullet Count Tracking
// ============================================================================

export interface BulletAcceptanceState {
  /** Total number of changed bullets in the entry */
  totalBullets: number;
  /** Number of accepted bullets */
  acceptedBullets: number;
  /** Whether all bullets are accepted */
  allAccepted: boolean;
  /** Whether some but not all bullets are accepted */
  partiallyAccepted: boolean;
  /** Whether no bullets are accepted */
  noneAccepted: boolean;
}

/**
 * Gets the bullet acceptance state for an entry.
 * Used to show partial acceptance indicators in the UI.
 */
export function getEntryBulletAcceptanceState(
  session: TailoringSession,
  blockId: string,
  entryId: string,
  bulletCount: number
): BulletAcceptanceState {
  let acceptedBullets = 0;

  for (let i = 0; i < bulletCount; i++) {
    if (isBulletAccepted(session, blockId, entryId, i)) {
      acceptedBullets++;
    }
  }

  return {
    totalBullets: bulletCount,
    acceptedBullets,
    allAccepted: bulletCount > 0 && acceptedBullets === bulletCount,
    partiallyAccepted: acceptedBullets > 0 && acceptedBullets < bulletCount,
    noneAccepted: acceptedBullets === 0,
  };
}
