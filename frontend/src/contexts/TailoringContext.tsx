/**
 * TailoringContext
 *
 * Provides shared state for the tailoring session across pages.
 * Enables seamless handoff from review page to editor with:
 * - Active draft preservation
 * - Accepted changes tracking
 * - Undo history carryover (optional)
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { AnyResumeBlock } from "@/lib/resume/types";
import type {
  TailoringSession,
  SerializableTailoringSession,
  BlockDiff,
} from "@/lib/tailoring/types";
import {
  serializeSession,
  deserializeSession,
} from "@/lib/tailoring/types";
import { computeDiff, getDiffSummary } from "@/lib/tailoring/diff";

// ============================================================================
// Types
// ============================================================================

/**
 * Session snapshot for undo history (matches useTailoringSession)
 */
interface SessionSnapshot {
  activeDraft: AnyResumeBlock[];
  acceptedChanges: string[];
}

/**
 * Extended session data that includes metadata and history
 */
export interface TailoringSessionData {
  /** The core session state */
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
  /** Undo history stack */
  history: SessionSnapshot[];
  /** Job context */
  jobTitle: string | null;
  companyName: string | null;
  matchScore: number | null;
  /** Timestamp when session was created */
  createdAt: number;
}

interface TailoringContextValue {
  /** Current session data, null if no active session */
  sessionData: TailoringSessionData | null;

  /** Initialize a new tailoring session */
  initializeSession: (
    sessionId: number,
    originalResume: AnyResumeBlock[],
    aiProposedResume: AnyResumeBlock[],
    metadata?: {
      jobTitle?: string | null;
      companyName?: string | null;
      matchScore?: number | null;
    }
  ) => void;

  /** Update the session state (for use with useTailoringSession) */
  updateSession: (
    session: TailoringSession,
    history?: SessionSnapshot[]
  ) => void;

  /** Clear the current session */
  clearSession: () => void;

  /** Check if we have an active session for a given ID */
  hasSessionForId: (sessionId: number) => boolean;

  /** Get the active draft for editor initialization */
  getActiveDraft: () => AnyResumeBlock[] | null;
}

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEY = "tailoring_session_data";
const STORAGE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

// ============================================================================
// Context
// ============================================================================

const TailoringContext = createContext<TailoringContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface TailoringProviderProps {
  children: ReactNode;
}

export function TailoringProvider({ children }: TailoringProviderProps) {
  const [sessionData, setSessionData] = useState<TailoringSessionData | null>(
    null
  );

  // Restore session from storage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as {
          session: SerializableTailoringSession;
          diffs: BlockDiff[];
          diffSummary: TailoringSessionData["diffSummary"];
          history: SessionSnapshot[];
          jobTitle: string | null;
          companyName: string | null;
          matchScore: number | null;
          createdAt: number;
        };

        // Check if session has expired
        if (Date.now() - parsed.createdAt > STORAGE_EXPIRY_MS) {
          sessionStorage.removeItem(STORAGE_KEY);
          return;
        }

        // Restore session
        setSessionData({
          session: deserializeSession(parsed.session),
          diffs: parsed.diffs,
          diffSummary: parsed.diffSummary,
          history: parsed.history,
          jobTitle: parsed.jobTitle,
          companyName: parsed.companyName,
          matchScore: parsed.matchScore,
          createdAt: parsed.createdAt,
        });
      }
    } catch (e) {
      console.error("Failed to restore tailoring session:", e);
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Persist session to storage on change
  useEffect(() => {
    if (sessionData) {
      try {
        const serialized = {
          session: serializeSession(sessionData.session),
          diffs: sessionData.diffs,
          diffSummary: sessionData.diffSummary,
          history: sessionData.history,
          jobTitle: sessionData.jobTitle,
          companyName: sessionData.companyName,
          matchScore: sessionData.matchScore,
          createdAt: sessionData.createdAt,
        };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
      } catch (e) {
        console.error("Failed to persist tailoring session:", e);
      }
    }
  }, [sessionData]);

  const initializeSession = useCallback(
    (
      sessionId: number,
      originalResume: AnyResumeBlock[],
      aiProposedResume: AnyResumeBlock[],
      metadata?: {
        jobTitle?: string | null;
        companyName?: string | null;
        matchScore?: number | null;
      }
    ) => {
      // Compute diffs
      const diffs = computeDiff(originalResume, aiProposedResume);
      const diffSummary = getDiffSummary(diffs);

      // Create session
      const session: TailoringSession = {
        id: sessionId,
        originalResume: Object.freeze(originalResume) as AnyResumeBlock[],
        aiProposedResume: Object.freeze(aiProposedResume) as AnyResumeBlock[],
        activeDraft: structuredClone(originalResume),
        acceptedChanges: new Set<string>(),
      };

      setSessionData({
        session,
        diffs,
        diffSummary,
        history: [],
        jobTitle: metadata?.jobTitle ?? null,
        companyName: metadata?.companyName ?? null,
        matchScore: metadata?.matchScore ?? null,
        createdAt: Date.now(),
      });
    },
    []
  );

  const updateSession = useCallback(
    (session: TailoringSession, history?: SessionSnapshot[]) => {
      setSessionData((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          session,
          history: history ?? prev.history,
        };
      });
    },
    []
  );

  const clearSession = useCallback(() => {
    setSessionData(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const hasSessionForId = useCallback(
    (sessionId: number) => {
      return sessionData?.session.id === sessionId;
    },
    [sessionData]
  );

  const getActiveDraft = useCallback(() => {
    if (!sessionData) return null;
    return structuredClone(sessionData.session.activeDraft);
  }, [sessionData]);

  const value: TailoringContextValue = {
    sessionData,
    initializeSession,
    updateSession,
    clearSession,
    hasSessionForId,
    getActiveDraft,
  };

  return (
    <TailoringContext.Provider value={value}>
      {children}
    </TailoringContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useTailoringContext() {
  const context = useContext(TailoringContext);
  if (!context) {
    throw new Error(
      "useTailoringContext must be used within a TailoringProvider"
    );
  }
  return context;
}

/**
 * Optional hook that doesn't throw if context is missing.
 * Useful for components that can work with or without tailoring context.
 */
export function useTailoringContextOptional() {
  return useContext(TailoringContext);
}
