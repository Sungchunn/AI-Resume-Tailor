/**
 * ATSProgressStepper Component
 *
 * A vertical 5-stage progress stepper for ATS analysis visualization.
 * Designed for the tailor flow with real-time SSE updates.
 *
 * Features:
 * - 5-stage vertical progress display with icons
 * - Real-time SSE connection to /v1/ats/analyze-progressive
 * - Stage states: pending (gray), running (blue spinner), complete (green check), error (red x)
 * - Elapsed time display per completed stage
 * - Stage-specific result summaries (e.g., "78% keyword coverage")
 * - Retry button on error
 * - Responsive: stacked on mobile, side labels on desktop
 */

"use client";

import { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Trophy,
} from "lucide-react";
import { ATSStageCard } from "./ATSStageCard";
import {
  useATSProgressStream,
  formatElapsedTime,
  type UseATSProgressStreamOptions,
} from "@/hooks/useATSProgressStream";
import type { ATSCompositeScore } from "@/lib/stores/atsProgressStore";

// ============================================================================
// Types
// ============================================================================

interface ATSProgressStepperProps {
  /** Resume ID for analysis (MongoDB ObjectId) */
  resumeId?: string;
  /** Job ID for user-created jobs */
  jobId?: number;
  /** Job listing ID for scraped jobs */
  jobListingId?: number;
  /** Auto-start analysis when mounted with valid IDs */
  autoStart?: boolean;
  /** Show detailed results for each stage */
  showDetails?: boolean;
  /** Callback when analysis completes */
  onComplete?: (compositeScore: ATSCompositeScore) => void;
  /** Callback on error */
  onError?: (error: string) => void;
  /** Optional className */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ATSProgressStepper({
  resumeId,
  jobId,
  jobListingId,
  autoStart = false,
  showDetails = false,
  onComplete,
  onError,
  className = "",
}: ATSProgressStepperProps) {
  const options: UseATSProgressStreamOptions = useMemo(
    () => ({ onComplete, onError }),
    [onComplete, onError]
  );

  const {
    stages,
    compositeScore,
    isAnalyzing,
    isComplete,
    fatalError,
    completedStages,
    overallProgress,
    totalElapsedMs,
    start,
    retry,
    reset,
  } = useATSProgressStream(options);

  // Check if we have valid job source
  const hasValidJobSource = !!(jobId || jobListingId);

  // Auto-start analysis if requested
  useEffect(() => {
    if (autoStart && resumeId && hasValidJobSource && !isAnalyzing && !isComplete) {
      start(resumeId, { jobId, jobListingId });
    }
  }, [autoStart, resumeId, jobId, jobListingId, hasValidJobSource, isAnalyzing, isComplete, start]);

  // Find the current active stage
  const currentStageIndex = useMemo(() => {
    const runningStage = stages.find((s) => s.status === "running");
    if (runningStage) return runningStage.stage;
    return completedStages.length;
  }, [stages, completedStages]);

  return (
    <div className={`ats-progress-stepper ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            ATS Analysis
          </h3>
          {isAnalyzing && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">
              <Loader2 className="h-3 w-3 animate-spin" />
              In Progress
            </span>
          )}
          {isComplete && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
              <CheckCircle2 className="h-3 w-3" />
              Complete
            </span>
          )}
        </div>

        {/* Progress & Time */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {isAnalyzing && (
            <span>{Math.round(overallProgress)}%</span>
          )}
          {totalElapsedMs > 0 && (
            <span>Total: {formatElapsedTime(totalElapsedMs)}</span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative w-full h-1.5 bg-muted rounded-full overflow-hidden mb-6">
        <motion.div
          className="absolute inset-y-0 left-0 bg-linear-to-r from-primary to-primary/80 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${overallProgress}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </div>

      {/* Vertical Stage List */}
      <div className="relative">
        {/* Vertical Line */}
        <div
          className="absolute left-4.75 top-4 bottom-4 w-0.5 bg-muted"
          aria-hidden="true"
        />

        {/* Completed Progress Line */}
        <motion.div
          className="absolute left-4.75 top-4 w-0.5 bg-primary rounded-full"
          initial={{ height: 0 }}
          animate={{
            height: `${Math.min(100, (completedStages.length / 5) * 100)}%`,
          }}
          transition={{ duration: 0.3 }}
          aria-hidden="true"
        />

        {/* Stages */}
        <div className="relative space-y-1">
          {stages.map((stage) => (
            <ATSStageCard
              key={stage.stage}
              stage={stage}
              isActive={stage.stage === currentStageIndex}
              showDetails={showDetails}
              onRetry={stage.status === "failed" ? retry : undefined}
            />
          ))}
        </div>
      </div>

      {/* Fatal Error Banner */}
      <AnimatePresence>
        {fatalError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800 dark:text-red-300">
                  Analysis Failed
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                  {fatalError}
                </p>
                <button
                  onClick={retry}
                  className="
                    inline-flex items-center gap-1.5 mt-2
                    px-3 py-1.5 text-xs font-medium
                    bg-red-600 text-white rounded-md
                    hover:bg-red-700 transition-colors
                  "
                >
                  <RefreshCw className="h-3 w-3" />
                  Retry Analysis
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Composite Score */}
      <AnimatePresence>
        {isComplete && compositeScore && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="mt-6"
          >
            <CompositeScoreDisplay score={compositeScore} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Start Button (when not auto-started) */}
      {!autoStart && !isAnalyzing && !isComplete && resumeId && hasValidJobSource && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => start(resumeId, { jobId, jobListingId })}
            className="
              inline-flex items-center gap-2 px-4 py-2
              text-sm font-medium bg-primary text-primary-foreground
              rounded-md hover:bg-primary/90 transition-colors
            "
          >
            <Loader2 className="h-4 w-4" />
            Start Analysis
          </button>
        </div>
      )}

      {/* Re-run Button (after successful completion) */}
      {isComplete && resumeId && hasValidJobSource && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => {
              reset();
              // Small delay to allow state to clear before restarting
              setTimeout(() => start(resumeId, { jobId, jobListingId }), 100);
            }}
            className="
              inline-flex items-center gap-2 px-3 py-1.5
              text-xs font-medium text-muted-foreground
              border border-border rounded-md
              hover:bg-muted hover:text-foreground transition-colors
            "
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Re-run Analysis
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Composite Score Display
// ============================================================================

interface CompositeScoreDisplayProps {
  score: ATSCompositeScore;
}

function CompositeScoreDisplay({ score }: CompositeScoreDisplayProps) {
  // Safely get the final score, defaulting to 0 if undefined/NaN
  const finalScore = typeof score.finalScore === 'number' && !Number.isNaN(score.finalScore)
    ? score.finalScore
    : 0;

  const scoreColor = useMemo(() => {
    if (finalScore >= 80) return "text-green-600 dark:text-green-400";
    if (finalScore >= 60) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  }, [finalScore]);

  const scoreBgColor = useMemo(() => {
    if (finalScore >= 80) return "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900";
    if (finalScore >= 60) return "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900";
    return "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900";
  }, [finalScore]);

  return (
    <div className={`p-4 rounded-lg border ${scoreBgColor}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className={`h-5 w-5 ${scoreColor}`} />
          <span className="text-sm font-semibold text-gray-800">
            Overall ATS Score
          </span>
        </div>
        <span className={`text-2xl font-bold ${scoreColor}`}>
          {Math.round(finalScore)}%
        </span>
      </div>

      {/* Stage Breakdown */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
        {Object.entries(score.stageBreakdown || {}).map(([stage, value]) => (
          <div
            key={stage}
            className="text-center p-2 bg-white/50 dark:bg-black/20 rounded"
          >
            <div className="text-xs text-gray-600 capitalize">
              {stage.replace(/_/g, " ")}
            </div>
            <div className="text-sm font-semibold mt-0.5 text-gray-800">
              {Math.round(typeof value === 'number' && !Number.isNaN(value) ? value : 0)}%
            </div>
          </div>
        ))}
      </div>

      {/* Warnings */}
      {(score.failedStages?.length ?? 0) > 0 && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>
            Some stages couldn&apos;t complete: {score.failedStages?.join(", ")}
          </span>
        </div>
      )}

      {score.normalizationApplied && (
        <div className="mt-1 text-xs text-muted-foreground">
          * Score normalized due to incomplete stages
        </div>
      )}
    </div>
  );
}

export default ATSProgressStepper;
