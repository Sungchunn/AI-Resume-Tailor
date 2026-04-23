"use client";

import { cn } from "@/lib/utils";
import type { FitScoreBreakdown, FitScoreMetaResponse } from "@/lib/api/types";
import { useFitScoreMeta } from "@/lib/api/hooks";
import { formatRelativeTime } from "@/lib/utils/date";
import { TIER_STYLES, resolveTier, type FitScoreTier } from "../FitScoreGauge";

interface FitScoreHeroProps {
  rawScore: number | null;
  isStale: boolean;
  breakdown: FitScoreBreakdown | null;
  isCapped: boolean;
  className?: string;
}

function tierLabel(tier: FitScoreTier, isCapped: boolean): string {
  if (isCapped) return "Capped at 60";
  if (tier === "strong") return "Strong fit";
  if (tier === "fair") return "Good fit";
  return "Low fit";
}

function explanation(breakdown: FitScoreBreakdown | null, isCapped: boolean): string {
  if (!breakdown) return "This score will populate on the next daily batch.";
  if (isCapped) {
    const missing = breakdown.required_missing.join(", ");
    return `A required skill is missing (${missing}), so the score is capped at ${breakdown.cap_value}. Add it to your resume to unlock the hybrid score.`;
  }
  if (breakdown.version === 3) {
    return "Keyword-only score — semantic embedding not available for your resume yet. The score reflects job-keyword overlap only.";
  }
  if (breakdown.required_missing.length === 0 && breakdown.required_total > 0) {
    return "All required skills are present, and your resume embedding is close to the job description. For a bullet-by-bullet audit and rewrite suggestions, run the deep analysis.";
  }
  return "Hybrid score combining semantic embedding similarity and job-keyword overlap. For a bullet-by-bullet audit and rewrite suggestions, run the deep analysis.";
}

function relativeMeta(meta: FitScoreMetaResponse | undefined): string {
  if (!meta?.last_run_at) return "Score pending first batch";
  return `Updated ${formatRelativeTime(meta.last_run_at)} · not pre-processed beyond your resume keywords + embedding`;
}

/**
 * Hero block for /jobs/{id}. Shows the tier chip, the 87/100 number,
 * the "Fit estimate · batch" sub-chip, a meta-line with freshness, and
 * a one-sentence explanation derived from the breakdown.
 */
export function FitScoreHero({
  rawScore,
  isStale,
  breakdown,
  isCapped,
  className,
}: FitScoreHeroProps) {
  const { data: meta } = useFitScoreMeta();

  if (rawScore === null || rawScore === undefined) {
    return (
      <section
        className={cn(
          "bg-card dark:bg-zinc-800 rounded-lg border border-border dark:border-zinc-600 p-6",
          className,
        )}
      >
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Fit estimate
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This job has not been scored yet. The daily batch will score it on its
          next run.
        </p>
      </section>
    );
  }

  const displayScore = Math.max(0, Math.min(100, Math.round(rawScore)));
  const tier = resolveTier(displayScore);
  const tierStyle = TIER_STYLES[tier];
  const label = tierLabel(tier, isCapped);
  const labelColor = isCapped ? TIER_STYLES.fair.text : tierStyle.text;
  const labelBg = isCapped
    ? "bg-amber-500/10 dark:bg-amber-500/15"
    : tier === "strong"
      ? "bg-green-500/10 dark:bg-green-500/15"
      : tier === "fair"
        ? "bg-amber-500/10 dark:bg-amber-500/15"
        : "bg-zinc-500/10 dark:bg-zinc-500/15";

  return (
    <section
      className={cn(
        "bg-card dark:bg-zinc-800 rounded-lg border border-border dark:border-zinc-600 p-6",
        isStale && "opacity-75",
        className,
      )}
    >
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <span
          className={cn(
            "px-2.5 py-0.5 rounded-full text-xs font-semibold",
            labelBg,
            labelColor,
          )}
        >
          {label}
        </span>
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-muted dark:bg-zinc-700 text-muted-foreground">
          Fit estimate · batch
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <span className={cn("text-5xl font-bold tabular-nums", tierStyle.text)}>
          {displayScore}
        </span>
        <span className="text-lg text-muted-foreground">/100</span>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">{relativeMeta(meta)}</p>

      <p className="mt-4 text-sm text-foreground/80 dark:text-zinc-200 leading-relaxed">
        {explanation(breakdown, isCapped)}
      </p>
    </section>
  );
}
