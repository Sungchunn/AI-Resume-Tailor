import { cn } from "@/lib/utils";

interface FitScoreGaugeProps {
  rawScore: number | null;
  isStale?: boolean;
  size?: "md" | "lg";
  className?: string;
}

const SIZES = {
  md: { barWidth: 84, barHeight: 8, fontSize: 14, labelSize: 9, gap: 8 },
  lg: { barWidth: 160, barHeight: 10, fontSize: 22, labelSize: 10, gap: 12 },
} as const;

type Tier = "strong" | "fair" | "low";

function resolveTier(display: number): Tier {
  if (display >= 75) return "strong";
  if (display >= 55) return "fair";
  return "low";
}

const TIER_STYLES: Record<
  Tier,
  { fill: string; text: string; glow: string }
> = {
  strong: {
    fill: "bg-gradient-to-r from-emerald-400 to-green-500 dark:from-emerald-400 dark:to-green-400",
    text: "text-green-700 dark:text-green-300",
    // Subtle tinted shadow so the green feels alive without being loud.
    glow: "shadow-[0_0_8px_rgba(34,197,94,0.35)]",
  },
  fair: {
    fill: "bg-gradient-to-r from-amber-400 to-orange-400 dark:from-amber-400 dark:to-orange-400",
    text: "text-amber-700 dark:text-amber-300",
    glow: "shadow-[0_0_6px_rgba(245,158,11,0.25)]",
  },
  low: {
    fill: "bg-gradient-to-r from-zinc-400 to-zinc-500 dark:from-zinc-500 dark:to-zinc-600",
    text: "text-zinc-600 dark:text-zinc-400",
    glow: "",
  },
};

/**
 * Compact horizontal fit-score bar. Raw score is 0-100 — no display skew;
 * the backend sqrt curve already lifts mid-range overlaps. Returns null
 * when the job hasn't been scored yet.
 */
export function FitScoreGauge({
  rawScore,
  isStale = false,
  size = "md",
  className,
}: FitScoreGaugeProps) {
  if (rawScore === null || rawScore === undefined) return null;

  const displayScore = Math.max(0, Math.min(100, Math.round(rawScore)));
  const tier = resolveTier(displayScore);
  const { fill, text, glow } = TIER_STYLES[tier];
  const { barWidth, barHeight, fontSize, labelSize, gap } = SIZES[size];

  return (
    <div
      className={cn(
        "inline-flex items-center leading-none",
        isStale && "opacity-60",
        className,
      )}
      style={{ gap }}
      title={
        isStale
          ? "Score will refresh on next daily update"
          : `Fit score: ${displayScore}/100`
      }
      aria-label={`Fit score ${displayScore} out of 100`}
    >
      <div
        className={cn(
          "relative rounded-full overflow-hidden",
          "bg-zinc-200/80 dark:bg-zinc-800",
          "ring-1 ring-inset ring-zinc-300/60 dark:ring-zinc-700/60",
          "shadow-inner",
        )}
        style={{ width: barWidth, height: barHeight }}
      >
        {/* Tier tick marks at 55 and 75 — subtle, only visible against the track */}
        <div
          className="absolute inset-y-0 w-px bg-zinc-300/80 dark:bg-zinc-700"
          style={{ left: "55%" }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-y-0 w-px bg-zinc-300/80 dark:bg-zinc-700"
          style={{ left: "75%" }}
          aria-hidden="true"
        />

        {/* Filled portion with gradient + soft tier glow */}
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-out",
            fill,
            glow,
          )}
          style={{ width: `${displayScore}%` }}
        />
      </div>

      <div className="flex items-baseline" style={{ gap: Math.max(2, gap - 6) }}>
        <span
          className={cn("font-semibold tabular-nums tracking-tight", text)}
          style={{ fontSize }}
        >
          {displayScore}
        </span>
        <span
          className={cn("font-medium opacity-60", text)}
          style={{ fontSize: labelSize }}
          aria-hidden="true"
        >
          / 100
        </span>
      </div>
    </div>
  );
}
