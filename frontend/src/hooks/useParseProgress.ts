/**
 * useParseProgress Hook
 *
 * Wraps useParseStatus with UI-friendly state for the ParseProgressStepper.
 *
 * Features:
 * - Maps backend stage to UI stage states
 * - Tracks elapsed time per completed stage
 * - Provides overall progress percentage
 * - Handles completion and error callbacks
 */

import { useMemo, useEffect, useRef, useCallback } from "react";
import { useParseStatus } from "@/lib/api";
import type { ParseStage, ParseStatusResponse } from "@/lib/api/types";

// ============================================================================
// Types
// ============================================================================

export type StageState = "pending" | "running" | "completed" | "failed";

export interface ParseStageState {
  id: ParseStage;
  label: string;
  state: StageState;
  progress: number; // 0-100 within stage
  elapsedMs?: number;
}

export interface UseParseProgressOptions {
  resumeId: string;
  taskId: string | null;
  onComplete?: (resumeId: string, warning?: string | null) => void;
  onError?: (error: string) => void;
}

export interface UseParseProgressResult {
  /** Current state of all 3 stages */
  stages: ParseStageState[];
  /** Whether parsing is complete */
  isComplete: boolean;
  /** Whether parsing has an error */
  hasError: boolean;
  /** Error message if any */
  error: string | null;
  /** Warning message for partial success */
  warning: string | null;
  /** Overall progress 0-100 */
  overallProgress: number;
  /** Retry parsing (triggers new parse request) */
  retry: () => void;
  /** Raw status response */
  status: ParseStatusResponse | null;
}

// ============================================================================
// Stage Configuration
// ============================================================================

const PARSE_STAGES: readonly { id: ParseStage; label: string }[] = [
  { id: "extracting", label: "Extracting" },
  { id: "parsing", label: "AI Parsing" },
  { id: "storing", label: "Finalizing" },
] as const;

// ============================================================================
// Hook Implementation
// ============================================================================

export function useParseProgress(options: UseParseProgressOptions): UseParseProgressResult {
  const { resumeId, taskId, onComplete, onError } = options;

  // Track stage start times for elapsed calculation
  const stageStartTimes = useRef<Map<ParseStage, number>>(new Map());
  // Note: stageElapsedTimes is a ref (not state) for performance - mutating it
  // won't trigger re-renders. This is acceptable since elapsed times are primarily
  // for logging/debugging. If reactive display is needed, convert to useState.
  const stageElapsedTimes = useRef<Map<ParseStage, number>>(new Map());
  const lastStage = useRef<ParseStage | null>(null);

  // Poll for status
  const { data: status, refetch } = useParseStatus(resumeId, taskId);

  // Track stage transitions and update elapsed times
  useEffect(() => {
    if (!status?.stage) return;

    const currentStage = status.stage;

    // New stage started
    if (currentStage !== lastStage.current) {
      // Record elapsed time for completed stage
      if (lastStage.current && stageStartTimes.current.has(lastStage.current)) {
        const startTime = stageStartTimes.current.get(lastStage.current)!;
        stageElapsedTimes.current.set(lastStage.current, Date.now() - startTime);
      }

      // Start timer for new stage
      stageStartTimes.current.set(currentStage, Date.now());
      lastStage.current = currentStage;
    }

    // On completion, record final stage elapsed time
    if (status.status === "completed" && currentStage) {
      const startTime = stageStartTimes.current.get(currentStage);
      if (startTime) {
        stageElapsedTimes.current.set(currentStage, Date.now() - startTime);
      }
    }
  }, [status?.stage, status?.status]);

  // Call callbacks on completion/error
  useEffect(() => {
    if (status?.status === "completed") {
      onComplete?.(resumeId, status.warning);
    } else if (status?.status === "failed" && status.error) {
      onError?.(status.error);
    }
  }, [status?.status, status?.error, status?.warning, resumeId, onComplete, onError]);

  // Map backend stage to UI stage states
  const stages = useMemo((): ParseStageState[] => {
    const currentStage = status?.stage;
    const stageProgress = status?.stage_progress ?? 0;
    const taskStatus = status?.status;

    return PARSE_STAGES.map((stage, index) => {
      const currentIndex = currentStage
        ? PARSE_STAGES.findIndex((s) => s.id === currentStage)
        : -1;

      let state: StageState;
      let progress: number;

      if (taskStatus === "failed" && index === currentIndex) {
        state = "failed";
        progress = stageProgress;
      } else if (index < currentIndex) {
        state = "completed";
        progress = 100;
      } else if (index === currentIndex) {
        state = taskStatus === "completed" ? "completed" : "running";
        progress = stageProgress;
      } else {
        state = "pending";
        progress = 0;
      }

      return {
        id: stage.id,
        label: stage.label,
        state,
        progress,
        elapsedMs: stageElapsedTimes.current.get(stage.id),
      };
    });
  }, [status]);

  // Calculate overall progress (0-100)
  const overallProgress = useMemo(() => {
    const currentStage = status?.stage;
    const stageProgress = status?.stage_progress ?? 0;

    if (status?.status === "completed") return 100;
    if (!currentStage) return 0;

    const currentIndex = PARSE_STAGES.findIndex((s) => s.id === currentStage);
    if (currentIndex === -1) return 0;

    // Each stage is worth 33.3%
    const stageWeight = 100 / PARSE_STAGES.length;
    const completedProgress = currentIndex * stageWeight;
    const currentProgress = (stageProgress / 100) * stageWeight;

    return Math.round(completedProgress + currentProgress);
  }, [status]);

  // Retry function - just refetch to trigger re-poll
  const retry = useCallback(() => {
    refetch();
  }, [refetch]);

  return {
    stages,
    isComplete: status?.status === "completed",
    hasError: status?.status === "failed",
    error: status?.error ?? null,
    warning: status?.warning ?? null,
    overallProgress,
    retry,
    status: status ?? null,
  };
}

/**
 * Format elapsed time to human-readable string.
 */
export function formatElapsedTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}

export default useParseProgress;
