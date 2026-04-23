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
  { fill: string; text: string; glow: string; stroke: string; gradId: string }
> = {
  strong: {
    fill: "bg-gradient-to-r from-emerald-400 to-green-500 dark:from-emerald-400 dark:to-green-400",
    text: "text-green-700 dark:text-green-300",
    glow: "shadow-[0_0_8px_rgba(34,197,94,0.35)]",
    stroke: "url(#fitscore-grad-strong)",
    gradId: "fitscore-grad-strong",
  },
  fair: {
    fill: "bg-gradient-to-r from-amber-400 to-orange-400 dark:from-amber-400 dark:to-orange-400",
    text: "text-amber-700 dark:text-amber-300",
    glow: "shadow-[0_0_6px_rgba(245,158,11,0.25)]",
    stroke: "url(#fitscore-grad-fair)",
    gradId: "fitscore-grad-fair",
  },
  low: {
    fill: "bg-gradient-to-r from-zinc-400 to-zinc-500 dark:from-zinc-500 dark:to-zinc-600",
    text: "text-zinc-600 dark:text-zinc-400",
    glow: "",
    stroke: "url(#fitscore-grad-low)",
    gradId: "fitscore-grad-low",
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

interface RingProps {
  displayScore: number;
  tier: Tier;
  textClass: string;
  isStale: boolean;
}

function Ring({ displayScore, tier, textClass, isStale }: RingProps) {
  const size = 56;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - displayScore / 100);

  const gradients = {
    strong: { from: "#34d399", to: "#22c55e" },
    fair: { from: "#fbbf24", to: "#fb923c" },
    low: { from: "#a1a1aa", to: "#71717a" },
  } as const;
  const { from, to } = gradients[tier];

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        isStale && "opacity-60",
      )}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <defs>
          <linearGradient id={TIER_STYLES[tier].gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-zinc-200 dark:stroke-zinc-700"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={TIER_STYLES[tier].stroke}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center text-base font-bold tabular-nums tracking-tight",
          textClass,
        )}
      >
        {displayScore}
      </span>
    </div>
  );
}

/**
 * Fit-score gauge. Returns null when unscored.
 *
 * - ``md``: inline horizontal bar for card lists.
 * - ``lg``: compact circular ring gauge for page headers.
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
        className={cn("inline-flex items-center gap-2", className)}
        title={title}
        aria-label={ariaLabel}
      >
        <Ring
          displayScore={displayScore}
          tier={tier}
          textClass={text}
          isStale={isStale}
        />
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-[0.14em]",
            isStale ? "text-muted-foreground opacity-60" : "text-muted-foreground",
          )}
        >
          Fit
        </span>
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
