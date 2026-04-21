import { cn } from "@/lib/utils";

interface FitScoreGaugeProps {
  rawScore: number | null;
  isStale?: boolean;
  size?: "md" | "lg";
  className?: string;
}

const SIZES = {
  md: { barWidth: 72, barHeight: 6, fontSize: 14, gap: 6 },
  lg: { barWidth: 140, barHeight: 8, fontSize: 20, gap: 10 },
} as const;

function tierColor(display: number): { fill: string; text: string } {
  if (display >= 75) {
    return { fill: "bg-green-500 dark:bg-green-400", text: "text-green-700 dark:text-green-300" };
  }
  if (display >= 55) {
    return { fill: "bg-amber-500 dark:bg-amber-400", text: "text-amber-700 dark:text-amber-300" };
  }
  return { fill: "bg-zinc-400 dark:bg-zinc-500", text: "text-zinc-600 dark:text-zinc-400" };
}

/**
 * Compact horizontal fit-score bar. Raw score is already 0-100 — no skew
 * applied, the backend sqrt curve already reads generously. Returns null
 * when the job hasn't been scored yet.
 */
export function FitScoreGauge({ rawScore, isStale = false, size = "md", className }: FitScoreGaugeProps) {
  if (rawScore === null || rawScore === undefined) return null;

  const displayScore = Math.round(rawScore);
  const { fill, text } = tierColor(displayScore);
  const { barWidth, barHeight, fontSize, gap } = SIZES[size];
  const clampedPct = Math.max(0, Math.min(100, displayScore));

  return (
    <div
      className={cn(
        "inline-flex items-center leading-none",
        isStale && "opacity-60",
        className,
      )}
      style={{ gap }}
      title={isStale ? "Score will refresh on next daily update" : `Fit score: ${displayScore}`}
      aria-label={`Fit score ${displayScore} out of 100`}
    >
      <div
        className="relative rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-700"
        style={{ width: barWidth, height: barHeight }}
      >
        <div
          className={cn("h-full rounded-full transition-[width]", fill)}
          style={{ width: `${clampedPct}%` }}
        />
      </div>
      <span className={cn("font-semibold tabular-nums", text)} style={{ fontSize }}>
        {displayScore}
      </span>
      <span
        className={cn("font-medium uppercase tracking-wider text-muted-foreground", text)}
        style={{ fontSize: Math.max(9, fontSize - 6) }}
      >
        Match
      </span>
    </div>
  );
}
