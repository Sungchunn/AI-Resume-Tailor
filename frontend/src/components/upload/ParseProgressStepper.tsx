/**
 * ParseProgressStepper Component
 *
 * A vertical 3-stage progress stepper for resume parsing visualization.
 * Modeled after ATSProgressStepper.
 *
 * Features:
 * - 3-stage vertical progress display (Extracting, AI Parsing, Finalizing)
 * - Stage states with appropriate icons:
 *   - Pending: gray circle with number
 *   - Running: blue spinner with pulse animation
 *   - Completed: green checkmark
 *   - Failed: red X
 * - Elapsed time per completed stage
 * - Overall progress bar (0-100%)
 * - Error message display with retry button
 */

"use client";

import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  FileSearch,
  Brain,
  Database,
  RefreshCw,
} from "lucide-react";
import { useParseProgress, formatElapsedTime, type ParseStageState } from "@/hooks/useParseProgress";

// ============================================================================
// Types
// ============================================================================

export interface ParseProgressStepperProps {
  /** Resume ID being parsed */
  resumeId: string;
  /** Task ID from parse trigger */
  taskId: string;
  /** Called when parsing completes */
  onComplete?: (resumeId: string, warning?: string | null) => void;
  /** Called on error */
  onError?: (error: string) => void;
  /** Optional className */
  className?: string;
}

// ============================================================================
// Stage Icons
// ============================================================================

const STAGE_ICONS = {
  extracting: FileSearch,
  parsing: Brain,
  storing: Database,
} as const;

// ============================================================================
// Component
// ============================================================================

export function ParseProgressStepper({
  resumeId,
  taskId,
  onComplete,
  onError,
  className = "",
}: ParseProgressStepperProps) {
  const {
    stages,
    isComplete,
    hasError,
    error,
    warning,
    overallProgress,
    retry,
  } = useParseProgress({
    resumeId,
    taskId,
    onComplete,
    onError,
  });

  // Find the current active stage
  const currentStageIndex = stages.findIndex((s) => s.state === "running");

  return (
    <div className={`parse-progress-stepper ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            Processing Resume
          </h3>
          {!isComplete && !hasError && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">
              <Loader2 className="h-3 w-3 animate-spin" />
              In Progress
            </span>
          )}
          {isComplete && !warning && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
              <CheckCircle2 className="h-3 w-3" />
              Complete
            </span>
          )}
          {isComplete && warning && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">
              <AlertCircle className="h-3 w-3" />
              Partial
            </span>
          )}
        </div>

        {/* Progress Percentage */}
        <div className="text-xs text-muted-foreground">
          {overallProgress}%
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative w-full h-1.5 bg-muted rounded-full overflow-hidden mb-6">
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-full ${
            hasError
              ? "bg-destructive"
              : warning
              ? "bg-amber-500"
              : "bg-primary"
          }`}
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
            height: `${Math.min(100, (stages.filter(s => s.state === "completed").length / 3) * 100)}%`,
          }}
          transition={{ duration: 0.3 }}
          aria-hidden="true"
        />

        {/* Stages */}
        <div className="relative space-y-1">
          {stages.map((stage, index) => (
            <ParseStageCard
              key={stage.id}
              stage={stage}
              isActive={index === currentStageIndex}
            />
          ))}
        </div>
      </div>

      {/* Error Banner */}
      <AnimatePresence>
        {hasError && error && (
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
                  Processing Failed
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                  {error}
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
                  Retry
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Warning Banner */}
      <AnimatePresence>
        {isComplete && warning && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  Completed with Warning
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  {warning}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Stage Card Component
// ============================================================================

interface ParseStageCardProps {
  stage: ParseStageState;
  isActive?: boolean;
}

function ParseStageCard({ stage, isActive = false }: ParseStageCardProps) {
  const Icon = STAGE_ICONS[stage.id];

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="relative"
    >
      <div
        className={`
          flex items-start gap-3 p-3 rounded-lg transition-colors
          ${stage.state === "running" ? "bg-primary/5" : ""}
          ${stage.state === "completed" ? "bg-green-50 dark:bg-green-950/20" : ""}
          ${stage.state === "failed" ? "bg-red-50 dark:bg-red-950/20" : ""}
          ${isActive && stage.state === "pending" ? "bg-muted/50" : ""}
        `}
      >
        {/* Status Icon */}
        <div className="shrink-0 mt-0.5">
          <StageStatusIcon stage={stage} Icon={Icon} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Stage Name */}
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-medium ${
                stage.state === "completed"
                  ? "text-green-700 dark:text-green-400"
                  : stage.state === "failed"
                  ? "text-red-700 dark:text-red-400"
                  : stage.state === "running"
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              {stage.label}
            </span>

            {/* Elapsed Time */}
            {stage.elapsedMs !== undefined && stage.state === "completed" && (
              <span className="text-xs text-muted-foreground">
                {formatElapsedTime(stage.elapsedMs)}
              </span>
            )}
          </div>

          {/* Status Text */}
          {stage.state === "running" && (
            <p className="text-xs text-primary/70 mt-0.5">
              Processing...
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Status Icon Component
// ============================================================================

interface StageStatusIconProps {
  stage: ParseStageState;
  Icon: React.ElementType;
}

function StageStatusIcon({ stage, Icon }: StageStatusIconProps) {
  const baseClasses = "h-8 w-8 rounded-full flex items-center justify-center";

  switch (stage.state) {
    case "completed":
      return (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 25 }}
          className={`${baseClasses} bg-green-100 dark:bg-green-900/30`}
        >
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
        </motion.div>
      );

    case "failed":
      return (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 25 }}
          className={`${baseClasses} bg-red-100 dark:bg-red-900/30`}
        >
          <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
        </motion.div>
      );

    case "running":
      return (
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className={`${baseClasses} bg-primary/10`}
        >
          <Loader2 className="h-5 w-5 text-primary animate-spin" />
        </motion.div>
      );

    default: // pending
      return (
        <div className={`${baseClasses} bg-muted`}>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      );
  }
}

export default ParseProgressStepper;
