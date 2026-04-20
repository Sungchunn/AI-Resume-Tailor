import { cn } from "@/lib/utils";

interface FitScoreBadgeProps {
  rawScore: number | null;
  isStale?: boolean;
}

/**
 * Displays the pre-computed keyword-overlap fit score as a pill badge on
 * job list cards. Raw scores are skewed into a 40-95 display range so a
 * first-time user never sees a demoralizing single-digit match. Rendered
 * nothing if the job hasn't been scored yet (fit_score_raw is null).
 */
export function FitScoreBadge({ rawScore, isStale = false }: FitScoreBadgeProps) {
  if (rawScore === null || rawScore === undefined) return null;

  const displayScore = Math.round(40 + (rawScore * 55) / 100);
  const tone =
    displayScore >= 75
      ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800"
      : displayScore >= 60
        ? "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800"
        : "bg-gray-100 text-gray-600 border-gray-200 dark:bg-zinc-700 dark:text-zinc-300 dark:border-zinc-600";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        tone,
        isStale && "opacity-60",
      )}
      title={isStale ? "Score will refresh on next daily update" : undefined}
    >
      {displayScore}% Match
    </span>
  );
}
