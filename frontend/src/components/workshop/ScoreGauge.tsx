"use client";

import { useAnimatedNumber } from "./hooks/useAnimatedNumber";
import { useReducedMotion } from "./hooks/useReducedMotion";

export interface ScoreGaugeProps {
  score: number;
  previousScore?: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  showDelta?: boolean;
  animate?: boolean;
}

const sizeClasses = {
  sm: { container: "h-2", text: "text-lg", delta: "text-xs" },
  md: { container: "h-3", text: "text-2xl", delta: "text-sm" },
  lg: { container: "h-4", text: "text-4xl", delta: "text-base" },
};

function getScoreColor(score: number): string {
  if (score >= 85) return "bg-green-500";
  if (score >= 70) return "bg-yellow-500";
  if (score >= 50) return "bg-orange-500";
  return "bg-red-500";
}

function getScoreTextColor(score: number): string {
  if (score >= 85) return "text-green-600";
  if (score >= 70) return "text-yellow-600";
  if (score >= 50) return "text-orange-600";
  return "text-red-600";
}

function getScoreLabel(score: number): string {
  if (score >= 85) return "Excellent match";
  if (score >= 70) return "Good match";
  if (score >= 50) return "Fair match";
  return "Needs improvement";
}

/**
 * Animated score gauge component with number counting and bar fill animation.
 * Displays score percentage with optional delta indicator.
 * Respects prefers-reduced-motion.
 */
export function ScoreGauge({
  score,
  previousScore,
  size = "md",
  showLabel = true,
  showDelta = true,
  animate = true,
}: ScoreGaugeProps) {
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = animate && !prefersReducedMotion;

  const displayScore = useAnimatedNumber(score, {
    duration: shouldAnimate ? 600 : 0,
    decimals: 0,
  });

  const delta = previousScore !== undefined ? score - previousScore : 0;
  const classes = sizeClasses[size];

  return (
    <div className="space-y-2">
      {/* Score Number + Delta */}
      <div className="flex items-baseline gap-2">
        <span
          className={`font-bold ${classes.text} ${getScoreTextColor(displayScore)}`}
        >
          {displayScore}%
        </span>
        {showDelta && delta !== 0 && (
          <span
            className={`font-medium ${classes.delta} ${
              delta > 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {delta > 0 ? "+" : ""}
            {delta}
          </span>
        )}
      </div>

      {/* Progress Bar */}
      <div
        className={`w-full bg-muted rounded-full overflow-hidden ${classes.container}`}
        role="progressbar"
        aria-valuenow={displayScore}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Match score: ${displayScore}%`}
      >
        <div
          className={`h-full rounded-full ${getScoreColor(displayScore)}`}
          style={{
            width: `${displayScore}%`,
            transitionProperty: shouldAnimate ? "width, background-color" : "none",
            transitionDuration: shouldAnimate ? "600ms" : "0ms",
            transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </div>

      {/* Label */}
      {showLabel && (
        <p className="text-sm text-muted-foreground">{getScoreLabel(displayScore)}</p>
      )}
    </div>
  );
}

/**
 * Compact score badge for use in headers and tight spaces.
 */
export interface ScoreBadgeProps {
  score: number;
  showDelta?: boolean;
  previousScore?: number;
  animate?: boolean;
  className?: string;
}

export function ScoreBadge({
  score,
  showDelta = false,
  previousScore,
  animate = true,
  className = "",
}: ScoreBadgeProps) {
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = animate && !prefersReducedMotion;

  const displayScore = useAnimatedNumber(score, {
    duration: shouldAnimate ? 400 : 0,
    decimals: 0,
  });

  const delta = previousScore !== undefined ? score - previousScore : 0;

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className={`px-2.5 py-1 rounded-full text-sm font-semibold ${getScoreTextColor(displayScore)} bg-opacity-10`}
        style={{
          backgroundColor:
            displayScore >= 85
              ? "rgba(34, 197, 94, 0.1)"
              : displayScore >= 70
                ? "rgba(234, 179, 8, 0.1)"
                : displayScore >= 50
                  ? "rgba(249, 115, 22, 0.1)"
                  : "rgba(239, 68, 68, 0.1)",
        }}
      >
        {displayScore}%
      </span>
      {showDelta && delta !== 0 && (
        <span
          className={`text-xs font-medium ${
            delta > 0 ? "text-green-600" : "text-red-600"
          }`}
        >
          {delta > 0 ? "+" : ""}
          {delta}
        </span>
      )}
    </div>
  );
}
