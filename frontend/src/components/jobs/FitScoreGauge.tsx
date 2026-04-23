/**
 * Fit-score primitives shared by the new transparency surfaces
 * (FitScoreCell, FitScoreHero, etc.). The previous default `FitScoreGauge`
 * component — horizontal bar in card view, circular ring in page header —
 * has been superseded by those surfaces (see
 * docs/features/ats/260424_fit-score-v4-transparency/master-plan.md). The
 * file kept the old name so as not to thrash import paths for the
 * primitives; rename to `fit-score-primitives.tsx` in a follow-up if
 * needed.
 */
import { cn } from "@/lib/utils";

export type FitScoreTier = "strong" | "fair" | "low";

export function resolveTier(display: number): FitScoreTier {
  if (display >= 75) return "strong";
  if (display >= 55) return "fair";
  return "low";
}

export const TIER_STYLES: Record<
  FitScoreTier,
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
  /** Show 55%/75% tier boundary ticks. Default true — turn off for mini-bars. */
  showTierMarks?: boolean;
}

export function Track({
  displayScore,
  width,
  height,
  fill,
  glow,
  showTierMarks = true,
}: TrackProps) {
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
      {showTierMarks ? (
        <>
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
        </>
      ) : null}
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-out",
          fill,
          glow,
        )}
        style={{ width: `${Math.max(0, Math.min(100, displayScore))}%` }}
      />
    </div>
  );
}

