"use client";

import { cn } from "@/lib/utils";
import type { FitScoreBreakdown } from "@/lib/api/types";
import {
  TIER_STYLES,
  Track,
  resolveTier,
  type FitScoreTier,
} from "../FitScoreGauge";

interface FitScoreCellProps {
  rawScore: number | null;
  isStale: boolean;
  breakdown: FitScoreBreakdown | null;
  isCapped: boolean;
  variant?: "card" | "table";
  className?: string;
}

function tierLabel(tier: FitScoreTier, isCapped: boolean): string {
  if (isCapped) return "CAP 60";
  if (tier === "strong") return "STRONG FIT";
  if (tier === "fair") return "GOOD FIT";
  return "LOW FIT";
}

function requiredCaption(breakdown: FitScoreBreakdown | null): string | null {
  if (!breakdown || breakdown.required_total === 0) return null;
  const total = breakdown.required_total;
  const matched = breakdown.required_matched.length;
  if (breakdown.required_missing.length === 0) {
    return `Required ${matched}/${total}`;
  }
  const first = breakdown.required_missing[0];
  return `Required ${matched}/${total} · miss ${first}`;
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <rect x="4" y="9" width="12" height="8" rx="1.5" />
      <path strokeLinecap="round" d="M7 9V7a3 3 0 116 0v2" />
    </svg>
  );
}

interface MiniBarProps {
  label: string;
  value: number | null;
  fillClass: string;
}

function MiniBar({ label, value, fillClass }: MiniBarProps) {
  const hasValue = value !== null && value !== undefined;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <Track
        displayScore={hasValue ? value : 0}
        width={36}
        height={4}
        fill={fillClass}
        glow=""
        showTierMarks={false}
      />
      <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
        {hasValue ? value : "—"}
      </span>
    </div>
  );
}

/**
 * Per-row fit-score cell for list surfaces (table + card). Shows the tier
 * label, large score, `SEM` + `KW` mini-bars, and required-skill caption.
 * Returns null when unscored.
 */
export function FitScoreCell({
  rawScore,
  isStale,
  breakdown,
  isCapped,
  variant = "card",
  className,
}: FitScoreCellProps) {
  if (rawScore === null || rawScore === undefined) {
    return (
      <span
        className={cn("text-xs text-muted-foreground", className)}
        title="Score will populate on next daily batch"
      >
        —
      </span>
    );
  }

  const displayScore = Math.max(0, Math.min(100, Math.round(rawScore)));
  const tier = resolveTier(displayScore);
  const tierStyle = TIER_STYLES[tier];
  const label = tierLabel(tier, isCapped);
  const required = requiredCaption(breakdown);

  // Capped rows get the amber fair style for the label colour regardless of
  // the raw-score tier, so they read distinctly from STRONG/GOOD/LOW.
  const labelColor = isCapped ? TIER_STYLES.fair.text : tierStyle.text;

  const scoreSizeClass =
    variant === "table" ? "text-xl" : "text-2xl";

  return (
    <div
      className={cn(
        "flex flex-col gap-1 leading-tight",
        isStale && "opacity-60",
        className,
      )}
      title={
        isStale
          ? "Score will refresh on next daily update"
          : `Fit score: ${displayScore}/100`
      }
    >
      <div className="flex items-center gap-1">
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wider",
            labelColor,
          )}
        >
          {label}
        </span>
        {isCapped ? (
          <LockIcon className={cn("h-3 w-3", labelColor)} />
        ) : null}
      </div>
      <div
        className={cn(
          "font-bold tabular-nums tracking-tight",
          scoreSizeClass,
          tierStyle.text,
        )}
      >
        {displayScore}
      </div>
      {breakdown ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <MiniBar
            label="SEM"
            value={breakdown.semantic_sub}
            fillClass={tierStyle.fill}
          />
          <MiniBar
            label="KW"
            value={breakdown.keyword_sub}
            fillClass={tierStyle.fill}
          />
        </div>
      ) : null}
      {required ? (
        <div
          className={cn(
            "text-[10px]",
            isCapped ? labelColor : "text-muted-foreground",
          )}
        >
          {required}
        </div>
      ) : null}
    </div>
  );
}
