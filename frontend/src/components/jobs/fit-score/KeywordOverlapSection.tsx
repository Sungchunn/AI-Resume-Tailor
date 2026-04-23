"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { FitScoreBreakdown } from "@/lib/api/types";

interface KeywordOverlapSectionProps {
  breakdown: FitScoreBreakdown | null;
  className?: string;
}

const INITIAL_VISIBLE = 12;

/**
 * "KEYWORD OVERLAP" section on /jobs/{id}. Matched keywords render as solid
 * green chips; missed nice-to-haves render as dashed amber chips under a
 * "Nice to have, still missing" sub-header. Matched keywords that were
 * already flagged as required are excluded here — those live in
 * RequiredSkillsRow.
 */
export function KeywordOverlapSection({
  breakdown,
  className,
}: KeywordOverlapSectionProps) {
  const [showAllMatched, setShowAllMatched] = useState(false);
  const [showAllMissing, setShowAllMissing] = useState(false);

  if (!breakdown || breakdown.keyword_total === 0) return null;

  // Exclude required from the matched/missing lists so the UI doesn't
  // double-show them (they are already in RequiredSkillsRow).
  const requiredSet = new Set([
    ...breakdown.required_matched,
    ...breakdown.required_missing,
  ]);
  const matched = breakdown.keyword_matched.filter((k) => !requiredSet.has(k));
  const missing = breakdown.keyword_missing.filter((k) => !requiredSet.has(k));

  const matchedCount = breakdown.keyword_matched.length;
  const missingCount = breakdown.keyword_missing.length;
  const total = breakdown.keyword_total;

  const visibleMatched = showAllMatched ? matched : matched.slice(0, INITIAL_VISIBLE);
  const visibleMissing = showAllMissing ? missing : missing.slice(0, INITIAL_VISIBLE);

  return (
    <section
      className={cn(
        "bg-card dark:bg-zinc-800 rounded-lg border border-border dark:border-zinc-600 p-5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Keyword overlap
        </h3>
        <span className="text-xs text-muted-foreground">
          {matchedCount}/{total} matched
        </span>
      </div>

      {matched.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {visibleMatched.map((kw) => (
            <span
              key={`m-${kw}`}
              className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-700 dark:text-green-300 border border-green-500/30"
            >
              {kw}
            </span>
          ))}
          {matched.length > INITIAL_VISIBLE && (
            <button
              onClick={() => setShowAllMatched((v) => !v)}
              className="px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showAllMatched ? "Show less" : `+${matched.length - INITIAL_VISIBLE} more`}
            </button>
          )}
        </div>
      )}

      {missing.length > 0 && (
        <>
          <p className="mt-4 text-xs text-muted-foreground">
            Nice to have, still missing
            {missingCount > missing.length
              ? ` (${missing.length} of ${missingCount})`
              : ""}
            :
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {visibleMissing.map((kw) => (
              <span
                key={`x-${kw}`}
                className="px-2 py-0.5 rounded-full text-xs font-medium text-amber-700 dark:text-amber-300 border border-dashed border-amber-500/60 bg-amber-500/5"
              >
                {kw}
              </span>
            ))}
            {missing.length > INITIAL_VISIBLE && (
              <button
                onClick={() => setShowAllMissing((v) => !v)}
                className="px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showAllMissing ? "Show less" : `+${missing.length - INITIAL_VISIBLE} more`}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
