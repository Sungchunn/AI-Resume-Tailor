/**
 * Tailoring Module
 *
 * Exports for the "Two Copies" resume tailoring architecture.
 */

// Types
export type {
  TailoringSession,
  SerializableTailoringSession,
  BlockDiff,
  EntryDiff,
  BulletDiff,
  TextDiff,
  SkillsDiff,
  EntryWithBullets,
} from "./types";

export {
  createAcceptKey,
  parseAcceptKey,
  hasRequiredBullets,
  hasOptionalBullets,
  serializeSession,
  deserializeSession,
} from "./types";

// Diff utilities
export {
  computeDiff,
  getDiffSummary,
  hasAnyChanges,
  getChangedDiffs,
} from "./diff";

// Session operations
export {
  initializeTailoringSession,
  acceptBlock,
  rejectBlock,
  acceptEntry,
  rejectEntry,
  acceptBullet,
  rejectBullet,
  acceptAll,
  rejectAll,
  acceptAllInBlock,
  rejectAllInBlock,
  isBlockAccepted,
  isEntryAccepted,
  isBulletAccepted,
  hasAcceptedChanges,
  isDraftModified,
  getAcceptedCount,
} from "./operations";
