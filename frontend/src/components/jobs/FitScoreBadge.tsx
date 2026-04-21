import { cn } from "@/lib/utils";

interface FitScoreBadgeProps {
  rawScore: number | null;
  isStale?: boolean;
  compact?: boolean;
}

// Raw 0-100 → display 20-100 (matches FitScoreGauge's softer floor).
function toDisplayScore(raw: number): number {
  return Math.round(20 + raw * 0.8);
}

/**
 * Compact inline fit-score chip. Used in table view and other dense contexts
 * where the semi-circle FitScoreGauge is too large. Returns null if the job
 * has not been scored yet.
 */
export function FitScoreBadge({ rawScore, isStale = false, compact = false }: FitScoreBadgeProps) {
  if (rawScore === null || rawScore === undefined) return null;

  const displayScore = toDisplayScore(rawScore);
  const tone =
    displayScore >= 75
      ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800"
      : displayScore >= 55
        ? "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800"
        : "bg-gray-100 text-gray-600 border-gray-200 dark:bg-zinc-700 dark:text-zinc-300 dark:border-zinc-600";

  // Filled mini-arc glyph signals "gauge" visually in a small space.
  const glyph = displayScore >= 75 ? "◕" : displayScore >= 55 ? "◑" : "◔";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium tabular-nums",
        compact ? "px-1.5 py-0 text-xs" : "px-2 py-0.5 text-xs",
        tone,
        isStale && "opacity-60",
      )}
      title={isStale ? "Score will refresh on next daily update" : undefined}
    >
      <span aria-hidden="true">{glyph}</span>
      {displayScore}
      {!compact && <span className="text-[10px] uppercase tracking-wide opacity-75">Match</span>}
    </span>
  );
}
