import { cn } from "@/lib/utils";

interface FitScoreBadgeProps {
  rawScore: number | null;
  isStale?: boolean;
  compact?: boolean;
}

type Tier = "strong" | "fair" | "low";

function resolveTier(display: number): Tier {
  if (display >= 75) return "strong";
  if (display >= 55) return "fair";
  return "low";
}

const TIER_STYLES: Record<
  Tier,
  { chip: string; dot: string }
> = {
  strong: {
    chip:
      "bg-gradient-to-r from-emerald-50 to-green-50 text-green-800 ring-green-200 " +
      "dark:from-green-900/40 dark:to-emerald-900/40 dark:text-green-300 dark:ring-green-800/70",
    dot: "bg-gradient-to-br from-emerald-400 to-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]",
  },
  fair: {
    chip:
      "bg-gradient-to-r from-amber-50 to-orange-50 text-amber-800 ring-amber-200 " +
      "dark:from-amber-900/40 dark:to-orange-900/40 dark:text-amber-300 dark:ring-amber-800/70",
    dot: "bg-gradient-to-br from-amber-400 to-orange-400 shadow-[0_0_5px_rgba(245,158,11,0.35)]",
  },
  low: {
    chip:
      "bg-zinc-100 text-zinc-600 ring-zinc-200 " +
      "dark:bg-zinc-800/80 dark:text-zinc-400 dark:ring-zinc-700",
    dot: "bg-gradient-to-br from-zinc-400 to-zinc-500",
  },
};

/**
 * Compact inline fit-score chip. Used in table view and other dense contexts
 * where the horizontal FitScoreGauge is too wide. Returns null if the job
 * has not been scored yet.
 */
export function FitScoreBadge({
  rawScore,
  isStale = false,
  compact = false,
}: FitScoreBadgeProps) {
  if (rawScore === null || rawScore === undefined) return null;

  const displayScore = Math.max(0, Math.min(100, Math.round(rawScore)));
  const tier = resolveTier(displayScore);
  const { chip, dot } = TIER_STYLES[tier];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium tabular-nums",
        "ring-1 ring-inset transition-colors",
        compact ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
        chip,
        isStale && "opacity-60",
      )}
      title={
        isStale
          ? "Score will refresh on next daily update"
          : `Fit score: ${displayScore}/100`
      }
      aria-label={`Fit score ${displayScore} out of 100`}
    >
      <span
        className={cn("h-2 w-2 rounded-full shrink-0", dot)}
        aria-hidden="true"
      />
      {displayScore}
      {!compact && (
        <span className="text-[10px] uppercase tracking-wide opacity-60">
          Match
        </span>
      )}
    </span>
  );
}
