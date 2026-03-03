/**
 * useTailoringSession Hook
 *
 * Manages the three-state tailoring session with undo history support.
 * Provides all operations for accepting/rejecting AI suggestions at
 * block, entry, and bullet levels.
 */

import { useState, useMemo, useCallback } from "react";
import type { AnyResumeBlock } from "@/lib/resume/types";
import type { TailoringSession, BlockDiff } from "@/lib/tailoring/types";
import { computeDiff, getDiffSummary, hasAnyChanges } from "@/lib/tailoring/diff";
import {
  initializeTailoringSession,
  acceptBlock,
  rejectBlock,
  acceptEntry,
  rejectEntry,
  acceptBullet,
  rejectBullet,
  acceptAll,
  rejectAll,
  isBlockAccepted,
  isEntryAccepted,
  isBulletAccepted,
  hasAcceptedChanges,
  isDraftModified,
  getAcceptedCount,
} from "@/lib/tailoring/operations";

// ============================================================================
// Types
// ============================================================================

/** Snapshot of session state for undo history */
interface SessionSnapshot {
  activeDraft: AnyResumeBlock[];
  acceptedChanges: string[];
}

export interface UseTailoringSessionOptions {
  /** Maximum number of undo states to keep */
  maxHistorySize?: number;
  /** Callback when session changes */
  onSessionChange?: (session: TailoringSession) => void;
}

export interface UseTailoringSessionReturn {
  /** Current session state */
  session: TailoringSession;

  /** Computed diffs between original and AI proposal */
  diffs: BlockDiff[];

  /** Summary of changes */
  diffSummary: {
    totalChanges: number;
    modifiedBlocks: number;
    addedBlocks: number;
    removedBlocks: number;
  };

  /** Whether there are any differences */
  hasChanges: boolean;

  /** Whether the draft has been modified from original */
  isModified: boolean;

  /** Number of accepted changes */
  acceptedCount: number;

  /** Whether undo is available */
  canUndo: boolean;

  /** Number of undo states available */
  undoDepth: number;

  // Block-level operations
  onAcceptBlock: (blockId: string) => void;
  onRejectBlock: (blockId: string) => void;

  // Entry-level operations
  onAcceptEntry: (blockId: string, entryId: string) => void;
  onRejectEntry: (blockId: string, entryId: string) => void;

  // Bullet-level operations
  onAcceptBullet: (blockId: string, entryId: string, bulletIndex: number) => void;
  onRejectBullet: (blockId: string, entryId: string, bulletIndex: number) => void;

  // Bulk operations
  onAcceptAll: () => void;
  onRejectAll: () => void;

  // Undo operation
  undo: () => void;

  // Query functions
  isBlockAccepted: (blockId: string) => boolean;
  isEntryAccepted: (blockId: string, entryId: string) => boolean;
  isBulletAccepted: (blockId: string, entryId: string, bulletIndex: number) => boolean;

  // Get the finalized draft for submission
  getActiveDraft: () => AnyResumeBlock[];

  // Reset session to initial state
  reset: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Main hook for managing the tailoring session.
 *
 * @param sessionId - ID from backend tailored_resumes table
 * @param originalResume - The user's original resume blocks
 * @param aiProposedResume - The AI's proposed resume blocks
 * @param options - Configuration options
 */
export function useTailoringSession(
  sessionId: string,
  originalResume: AnyResumeBlock[],
  aiProposedResume: AnyResumeBlock[],
  options: UseTailoringSessionOptions = {}
): UseTailoringSessionReturn {
  const { maxHistorySize = 50, onSessionChange } = options;

  // Initialize session state
  const [session, setSession] = useState<TailoringSession>(() =>
    initializeTailoringSession(sessionId, originalResume, aiProposedResume)
  );

  // Undo history stack - stores full session snapshots
  const [history, setHistory] = useState<SessionSnapshot[]>([]);

  // Compute diffs once (original vs AI - these don't change)
  const diffs = useMemo(
    () => computeDiff(originalResume, aiProposedResume),
    [originalResume, aiProposedResume]
  );

  const diffSummary = useMemo(() => getDiffSummary(diffs), [diffs]);
  const hasChanges = useMemo(() => hasAnyChanges(diffs), [diffs]);

  // ============================================================================
  // History Management
  // ============================================================================

  const pushHistory = useCallback(
    (currentSession: TailoringSession) => {
      const snapshot: SessionSnapshot = {
        activeDraft: structuredClone(currentSession.activeDraft),
        acceptedChanges: Array.from(currentSession.acceptedChanges),
      };
      setHistory((prev) => {
        const newHistory = [...prev, snapshot];
        // Limit history size
        if (newHistory.length > maxHistorySize) {
          return newHistory.slice(newHistory.length - maxHistorySize);
        }
        return newHistory;
      });
    },
    [maxHistorySize]
  );

  const undo = useCallback(() => {
    if (history.length === 0) return;

    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setSession((prev) => {
      const newSession = {
        ...prev,
        activeDraft: previous.activeDraft,
        acceptedChanges: new Set(previous.acceptedChanges),
      };
      onSessionChange?.(newSession);
      return newSession;
    });
  }, [history, onSessionChange]);

  // ============================================================================
  // Session Update Helper
  // ============================================================================

  const updateSession = useCallback(
    (updater: (prev: TailoringSession) => TailoringSession) => {
      setSession((prev) => {
        pushHistory(prev);
        const newSession = updater(prev);
        onSessionChange?.(newSession);
        return newSession;
      });
    },
    [pushHistory, onSessionChange]
  );

  // ============================================================================
  // Block-Level Operations
  // ============================================================================

  const handleAcceptBlock = useCallback(
    (blockId: string) => {
      updateSession((prev) => acceptBlock(prev, blockId));
    },
    [updateSession]
  );

  const handleRejectBlock = useCallback(
    (blockId: string) => {
      updateSession((prev) => rejectBlock(prev, blockId));
    },
    [updateSession]
  );

  // ============================================================================
  // Entry-Level Operations
  // ============================================================================

  const handleAcceptEntry = useCallback(
    (blockId: string, entryId: string) => {
      updateSession((prev) => acceptEntry(prev, blockId, entryId));
    },
    [updateSession]
  );

  const handleRejectEntry = useCallback(
    (blockId: string, entryId: string) => {
      updateSession((prev) => rejectEntry(prev, blockId, entryId));
    },
    [updateSession]
  );

  // ============================================================================
  // Bullet-Level Operations
  // ============================================================================

  const handleAcceptBullet = useCallback(
    (blockId: string, entryId: string, bulletIndex: number) => {
      updateSession((prev) => acceptBullet(prev, blockId, entryId, bulletIndex));
    },
    [updateSession]
  );

  const handleRejectBullet = useCallback(
    (blockId: string, entryId: string, bulletIndex: number) => {
      updateSession((prev) => rejectBullet(prev, blockId, entryId, bulletIndex));
    },
    [updateSession]
  );

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  const handleAcceptAll = useCallback(() => {
    updateSession((prev) => acceptAll(prev, diffs));
  }, [updateSession, diffs]);

  const handleRejectAll = useCallback(() => {
    updateSession((prev) => rejectAll(prev));
  }, [updateSession]);

  // ============================================================================
  // Query Functions
  // ============================================================================

  const checkBlockAccepted = useCallback(
    (blockId: string) => isBlockAccepted(session, blockId),
    [session]
  );

  const checkEntryAccepted = useCallback(
    (blockId: string, entryId: string) => isEntryAccepted(session, blockId, entryId),
    [session]
  );

  const checkBulletAccepted = useCallback(
    (blockId: string, entryId: string, bulletIndex: number) =>
      isBulletAccepted(session, blockId, entryId, bulletIndex),
    [session]
  );

  const getActiveDraft = useCallback(() => {
    return structuredClone(session.activeDraft);
  }, [session.activeDraft]);

  // ============================================================================
  // Reset
  // ============================================================================

  const reset = useCallback(() => {
    setHistory([]);
    setSession(initializeTailoringSession(sessionId, originalResume, aiProposedResume));
  }, [sessionId, originalResume, aiProposedResume]);

  // ============================================================================
  // Computed Values
  // ============================================================================

  const isModified = useMemo(() => isDraftModified(session), [session]);
  const acceptedCount = useMemo(() => getAcceptedCount(session), [session]);

  return {
    session,
    diffs,
    diffSummary,
    hasChanges,
    isModified,
    acceptedCount,
    canUndo: history.length > 0,
    undoDepth: history.length,

    onAcceptBlock: handleAcceptBlock,
    onRejectBlock: handleRejectBlock,
    onAcceptEntry: handleAcceptEntry,
    onRejectEntry: handleRejectEntry,
    onAcceptBullet: handleAcceptBullet,
    onRejectBullet: handleRejectBullet,
    onAcceptAll: handleAcceptAll,
    onRejectAll: handleRejectAll,

    undo,

    isBlockAccepted: checkBlockAccepted,
    isEntryAccepted: checkEntryAccepted,
    isBulletAccepted: checkBulletAccepted,

    getActiveDraft,
    reset,
  };
}

// ============================================================================
// Additional Utility Hooks
// ============================================================================

/**
 * Hook for tracking block-level acceptance state.
 * Useful for rendering acceptance indicators in the UI.
 */
export function useBlockAcceptanceState(
  session: TailoringSession,
  blockId: string
) {
  return useMemo(
    () => ({
      isAccepted: isBlockAccepted(session, blockId),
      hasAcceptedChanges: Array.from(session.acceptedChanges).some(
        (key) => key === blockId || key.startsWith(`${blockId}.`)
      ),
    }),
    [session, blockId]
  );
}

/**
 * Hook for computing which sections need user attention.
 * Returns blocks that have changes but haven't been fully reviewed.
 */
export function usePendingReviewBlocks(
  session: TailoringSession,
  diffs: BlockDiff[]
) {
  return useMemo(() => {
    return diffs.filter((diff) => {
      if (!diff.hasChanges) return false;
      // Block needs review if it has changes and hasn't been accepted
      return !isBlockAccepted(session, diff.blockId);
    });
  }, [session, diffs]);
}
