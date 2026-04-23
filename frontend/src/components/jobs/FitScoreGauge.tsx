import { cn } from "@/lib/utils";

interface FitScoreGaugeProps {
  rawScore: number | null;
  isStale?: boolean;
  size?: "md" | "lg";
  className?: string;
}

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

interface TrackProps {
  displayScore: number;
  width: number;
  height: number;
  fill: string;
  glow: string;
}

function Track({ displayScore, width, height, fill, glow }: TrackProps) {
  return (
    <div
      className={cn(
        "relative rounded-full overflow-hidden",
        "bg-zinc-200/80 dark:bg-zinc-800",
        "ring-1 ring-inset ring-zinc-300/60 dark:ring-zinc-700/60",
        "shadow-inner",
      )}
      style={{ width, height }}
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
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-out",
          fill,
          glow,
        )}
        style={{ width: `${displayScore}%` }}
      />
    </div>
  );
}

/**
 * Fit-score gauge. Returns null when unscored.
 *
 * - ``md``: inline horizontal layout for card lists (bar + number side-by-side).
 * - ``lg``: compact vertical stat for page headers (label + number over bar).
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
  const title = isStale
    ? "Score will refresh on next daily update"
    : `Fit score: ${displayScore}/100`;
  const ariaLabel = `Fit score ${displayScore} out of 100`;

  if (size === "lg") {
    return (
      <div
        className={cn(
          "inline-flex flex-col items-end gap-1.5 leading-none",
          isStale && "opacity-60",
          className,
        )}
        title={title}
        aria-label={ariaLabel}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Fit
          </span>
          <div className="flex items-baseline gap-0.5">
            <span className={cn("text-2xl font-bold tabular-nums tracking-tight", text)}>
              {displayScore}
            </span>
            <span className={cn("text-[11px] font-medium opacity-60", text)}>
              /100
            </span>
          </div>
        </div>
        <Track
          displayScore={displayScore}
          width={132}
          height={6}
          fill={fill}
          glow={glow}
        />
      </div>
    );
  }

  // md — inline horizontal
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 leading-none",
        isStale && "opacity-60",
        className,
      )}
      title={title}
      aria-label={ariaLabel}
    >
      <Track
        displayScore={displayScore}
        width={84}
        height={8}
        fill={fill}
        glow={glow}
      />
      <div className="flex items-baseline gap-0.5">
        <span className={cn("text-sm font-semibold tabular-nums tracking-tight", text)}>
          {displayScore}
        </span>
        <span className={cn("text-[9px] font-medium opacity-60", text)}>
          /100
        </span>
      </div>
    </div>
  );
}
