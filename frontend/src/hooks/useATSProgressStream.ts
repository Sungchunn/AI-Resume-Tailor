/**
 * useATSProgressStream Hook
 *
 * A dedicated hook for the tailor flow that provides a clean interface
 * for ATS progressive analysis with SSE streaming.
 *
 * Features:
 * - Manages 5-stage ATS analysis with real-time updates
 * - Provides retry functionality on errors
 * - Tracks completion state and composite scores
 * - Automatic cleanup on unmount
 */

import { useCallback, useEffect, useMemo } from "react";
import { useATSProgressStore, type ATSCompositeScore } from "@/lib/stores/atsProgressStore";
import { useATSProgressiveAnalysis } from "@/lib/api";

// ============================================================================
// Types
// ============================================================================

export interface ATSStageState {
  stage: number;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: Record<string, unknown>;
  error?: string;
  elapsedMs?: number;
}

export interface UseATSProgressStreamOptions {
  /** Auto-start analysis when hook mounts */
  autoStart?: boolean;
  /** Callback when all stages complete successfully */
  onComplete?: (compositeScore: ATSCompositeScore) => void;
  /** Callback on fatal error */
  onError?: (error: string) => void;
  /** Callback for each stage completion */
  onStageComplete?: (stage: ATSStageState) => void;
}

export interface UseATSProgressStreamResult {
  /** Current state of all 5 stages */
  stages: ATSStageState[];
  /** Final composite score (available after completion) */
  compositeScore: ATSCompositeScore | null;
  /** Whether analysis is in progress */
  isAnalyzing: boolean;
  /** Whether analysis completed successfully */
  isComplete: boolean;
  /** Whether any stage has an error */
  hasError: boolean;
  /** Fatal error message if analysis aborted */
  fatalError: string | null;
  /** List of completed stage numbers */
  completedStages: number[];
  /** Overall progress percentage (0-100) */
  overallProgress: number;
  /** Total elapsed time across all stages */
  totalElapsedMs: number;
  /** Start analysis with resume ID and job options */
  start: (resumeId: string, options: { jobId?: number; jobListingId?: number; forceRefresh?: boolean }) => void;
  /** Retry the last analysis */
  retry: () => void;
  /** Abort current analysis */
  abort: () => void;
  /** Reset all state */
  reset: () => void;
}

// ============================================================================
// Stage Configuration
// ============================================================================

const STAGE_CONFIG = [
  { stage: 0, name: "Knockout Check" },
  { stage: 1, name: "Structure Analysis" },
  { stage: 2, name: "Keyword Matching" },
  { stage: 3, name: "Content Quality" },
  { stage: 4, name: "Role Proximity" },
] as const;

// ============================================================================
// Hook Implementation
// ============================================================================

export function useATSProgressStream(
  options: UseATSProgressStreamOptions = {}
): UseATSProgressStreamResult {
  const { onComplete, onError, onStageComplete } = options;

  const store = useATSProgressStore();
  const { startAnalysis } = useATSProgressiveAnalysis();

  // Track last analysis params for retry
  const lastResumeId = store.resumeId;
  const lastJobId = store.jobId;

  // Transform store stages to standardized format
  const stages = useMemo((): ATSStageState[] => {
    return STAGE_CONFIG.map(({ stage, name }) => {
      const stageData = store.stages[stage];
      return {
        stage,
        name,
        status: stageData?.status || "pending",
        result: stageData?.result,
        error: stageData?.error,
        elapsedMs: stageData?.elapsedMs,
      };
    });
  }, [store.stages]);

  // Computed state
  const completedStages = useMemo(
    () =>
      stages
        .filter((s) => s.status === "completed")
        .map((s) => s.stage),
    [stages]
  );

  const hasError = useMemo(
    () => stages.some((s) => s.status === "failed") || !!store.fatalError,
    [stages, store.fatalError]
  );

  const isComplete = useMemo(
    () => !store.isAnalyzing && completedStages.length === 5 && !!store.compositeScore,
    [store.isAnalyzing, completedStages.length, store.compositeScore]
  );

  // ============================================================================
  // Actions
  // ============================================================================

  const start = useCallback(
    (resumeId: string, options: { jobId?: number; jobListingId?: number; forceRefresh?: boolean }) => {
      startAnalysis(resumeId, options);
    },
    [startAnalysis]
  );

  const retry = useCallback(() => {
    // Retry not fully supported with new signature - would need to store resumeId as string
    console.warn("Retry not available - please restart analysis manually");
  }, []);

  const abort = useCallback(() => {
    store.closeConnection();
    store.setError("Analysis cancelled by user");
  }, [store]);

  const reset = useCallback(() => {
    store.resetAnalysis();
  }, [store]);

  // ============================================================================
  // Callbacks
  // ============================================================================

  // Call onComplete when analysis finishes successfully
  useEffect(() => {
    if (isComplete && store.compositeScore && onComplete) {
      onComplete(store.compositeScore);
    }
  }, [isComplete, store.compositeScore, onComplete]);

  // Call onError when fatal error occurs
  useEffect(() => {
    if (store.fatalError && onError) {
      onError(store.fatalError);
    }
  }, [store.fatalError, onError]);

  // Call onStageComplete for each completed stage
  useEffect(() => {
    if (onStageComplete) {
      const lastCompletedStage = stages.find(
        (s) => s.status === "completed" && s.stage === store.currentStage
      );
      if (lastCompletedStage) {
        onStageComplete(lastCompletedStage);
      }
    }
  }, [store.currentStage, stages, onStageComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Don't close connection on unmount - let it continue in background
      // The store persists and will maintain the connection
    };
  }, []);

  return {
    stages,
    compositeScore: store.compositeScore,
    isAnalyzing: store.isAnalyzing,
    isComplete,
    hasError,
    fatalError: store.fatalError,
    completedStages,
    overallProgress: store.overallProgress,
    totalElapsedMs: store.totalElapsedMs,
    start,
    retry,
    abort,
    reset,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format elapsed milliseconds to human-readable string
 */
export function formatElapsedTime(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}

/**
 * Get a summary string for a completed stage result
 */
export function getStageResultSummary(stage: number, result?: Record<string, unknown>): string | null {
  if (!result) return null;

  switch (stage) {
    case 0: // Knockout Check
      const passesAll = result.passes_all_checks as boolean;
      const riskCount = (result.risks as unknown[])?.length ?? 0;
      if (passesAll) return "All checks passed";
      return `${riskCount} issue${riskCount === 1 ? "" : "s"} found`;

    case 1: // Structure Analysis
      const formatScore = result.format_score as number;
      if (typeof formatScore === "number") {
        return `${Math.round(formatScore)}% format score`;
      }
      return null;

    case 2: // Keyword Matching
      const keywordScore = result.keyword_score as number;
      const coverage = result.coverage_score as number;
      const score = keywordScore ?? coverage;
      if (typeof score === "number") {
        return `${Math.round(score)}% keyword coverage`;
      }
      return null;

    case 3: // Content Quality
      const qualityScore = result.content_quality_score as number;
      if (typeof qualityScore === "number") {
        return `${Math.round(qualityScore)}% quality score`;
      }
      return null;

    case 4: // Role Proximity
      const proximityScore = result.role_proximity_score as number;
      if (typeof proximityScore === "number") {
        return `${Math.round(proximityScore)}% role match`;
      }
      return null;

    default:
      return null;
  }
}

export default useATSProgressStream;
