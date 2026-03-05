/**
 * ATSStageCard Component
 *
 * Individual stage card for the ATS Progress Stepper.
 * Displays stage status, elapsed time, and result summary.
 *
 * States:
 * - pending: Gray circle with stage number
 * - running: Blue spinner with pulsing animation
 * - completed: Green checkmark with result summary
 * - failed: Red X with error message and retry option
 */

"use client";

import { motion } from "motion/react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Shield,
  LayoutTemplate,
  Tags,
  FileText,
  Target,
  RefreshCw,
} from "lucide-react";
import { formatElapsedTime, getStageResultSummary, type ATSStageState } from "@/hooks/useATSProgressStream";

// ============================================================================
// Types
// ============================================================================

interface ATSStageCardProps {
  /** Stage data */
  stage: ATSStageState;
  /** Whether this is the currently active stage */
  isActive?: boolean;
  /** Whether to show detailed result (expanded mode) */
  showDetails?: boolean;
  /** Callback to retry this stage (only shown on error) */
  onRetry?: () => void;
  /** Optional className */
  className?: string;
}

// ============================================================================
// Stage Icons
// ============================================================================

const STAGE_ICONS: Record<number, React.ElementType> = {
  0: Shield,        // Knockout Check
  1: LayoutTemplate, // Structure Analysis
  2: Tags,          // Keyword Matching
  3: FileText,      // Content Quality
  4: Target,        // Role Proximity
};

// ============================================================================
// Component
// ============================================================================

export function ATSStageCard({
  stage,
  isActive = false,
  showDetails = false,
  onRetry,
  className = "",
}: ATSStageCardProps) {
  const Icon = STAGE_ICONS[stage.stage] || FileText;
  const summary = getStageResultSummary(stage.stage, stage.result);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: stage.stage * 0.05 }}
      className={`relative ${className}`}
    >
      <div
        className={`
          flex items-start gap-3 p-3 rounded-lg transition-colors
          ${stage.status === "running" ? "bg-primary/5" : ""}
          ${stage.status === "completed" ? "bg-green-50 dark:bg-green-950/20" : ""}
          ${stage.status === "failed" ? "bg-red-50 dark:bg-red-950/20" : ""}
          ${isActive && stage.status === "pending" ? "bg-muted/50" : ""}
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
                stage.status === "completed"
                  ? "text-green-700 dark:text-green-400"
                  : stage.status === "failed"
                  ? "text-red-700 dark:text-red-400"
                  : stage.status === "running"
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              {stage.name}
            </span>

            {/* Elapsed Time */}
            {stage.elapsedMs !== undefined && stage.status === "completed" && (
              <span className="text-xs text-muted-foreground">
                {formatElapsedTime(stage.elapsedMs)}
              </span>
            )}
          </div>

          {/* Result Summary or Error */}
          {stage.status === "completed" && summary && (
            <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">
              {summary}
            </p>
          )}

          {stage.status === "failed" && stage.error && (
            <div className="mt-1">
              <p className="text-xs text-red-600 dark:text-red-400">
                {stage.error}
              </p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="
                    inline-flex items-center gap-1 mt-1.5
                    text-xs font-medium text-red-600 hover:text-red-700
                    dark:text-red-400 dark:hover:text-red-300
                    transition-colors
                  "
                >
                  <RefreshCw className="h-3 w-3" />
                  Retry
                </button>
              )}
            </div>
          )}

          {stage.status === "running" && (
            <p className="text-xs text-primary/70 mt-0.5">
              Analyzing...
            </p>
          )}

          {/* Detailed Results (expanded mode) */}
          {showDetails && stage.status === "completed" && stage.result && (
            <StageResultDetails stage={stage.stage} result={stage.result} />
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Status Icon
// ============================================================================

interface StageStatusIconProps {
  stage: ATSStageState;
  Icon: React.ElementType;
}

function StageStatusIcon({ stage, Icon }: StageStatusIconProps) {
  const baseClasses = "h-8 w-8 rounded-full flex items-center justify-center";

  switch (stage.status) {
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

// ============================================================================
// Result Details (for expanded mode)
// ============================================================================

interface StageResultDetailsProps {
  stage: number;
  result: Record<string, unknown>;
}

function StageResultDetails({ stage, result }: StageResultDetailsProps) {
  switch (stage) {
    case 0: // Knockout Check
      const risks = result.risks as Array<{ type: string; message: string }> | undefined;
      if (!risks?.length) return null;
      return (
        <div className="mt-2 space-y-1">
          {risks.slice(0, 3).map((risk, idx) => (
            <div
              key={idx}
              className="flex items-start gap-1.5 text-xs text-muted-foreground"
            >
              <AlertTriangle
                className={`h-3 w-3 mt-0.5 shrink-0 ${
                  risk.type === "critical" ? "text-red-500" :
                  risk.type === "warning" ? "text-amber-500" : "text-blue-500"
                }`}
              />
              <span>{risk.message}</span>
            </div>
          ))}
        </div>
      );

    case 2: // Keyword Matching
      const matched = result.required_matched as string[] | undefined;
      const missing = result.required_missing as string[] | undefined;
      if (!matched?.length && !missing?.length) return null;
      return (
        <div className="mt-2 space-y-1.5">
          {matched && matched.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {matched.slice(0, 5).map((kw, idx) => (
                <span
                  key={idx}
                  className="inline-flex px-1.5 py-0.5 text-[10px] font-medium
                    bg-green-100 text-green-700 rounded
                    dark:bg-green-900/30 dark:text-green-400"
                >
                  {kw}
                </span>
              ))}
              {matched.length > 5 && (
                <span className="text-[10px] text-muted-foreground">
                  +{matched.length - 5} more
                </span>
              )}
            </div>
          )}
        </div>
      );

    default:
      return null;
  }
}

export default ATSStageCard;
