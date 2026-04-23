"use client";

import { useFitScoreMeta } from "@/lib/api/hooks";
import { formatRelativeTime } from "@/lib/utils/date";
import { cn } from "@/lib/utils";

interface FitScoreMetaHeaderProps {
  total: number | null;
  sortedByFit: boolean;
  className?: string;
}

/**
 * Subtitle for the /jobs page: "{total} jobs · sorted by Fit · Scores
 * refreshed {Xh ago} (daily batch)". Reads the latest batch-run row
 * from the backend via `useFitScoreMeta`.
 */
export function FitScoreMetaHeader({
  total,
  sortedByFit,
  className,
}: FitScoreMetaHeaderProps) {
  const { data: meta } = useFitScoreMeta();

  const parts: string[] = [];
  if (total !== null) {
    parts.push(`${total.toLocaleString()} jobs`);
  }
  if (sortedByFit) {
    parts.push("sorted by Fit");
  }
  if (meta?.last_run_at) {
    parts.push(`Scores refreshed ${formatRelativeTime(meta.last_run_at)} (daily batch)`);
  } else if (meta) {
    parts.push("Scores not yet computed");
  }

  return (
    <p
      className={cn(
        "text-xs text-muted-foreground dark:text-zinc-400",
        className,
      )}
    >
      {parts.join(" · ")}
    </p>
  );
}
