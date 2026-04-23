"use client";

import { cn } from "@/lib/utils";
import type { FitScoreBreakdown } from "@/lib/api/types";

interface FitScoreFormulaPanelProps {
  rawScore: number | null;
  breakdown: FitScoreBreakdown | null;
  className?: string;
}

/**
 * "HOW THIS SCORE WAS COMPUTED" panel. Shows SEMANTIC × 0.5 + KEYWORDS × 0.5
 * = total. Falls back to a "keyword-only" caption for v3 scores where the
 * semantic term is not available.
 */
export function FitScoreFormulaPanel({
  rawScore,
  breakdown,
  className,
}: FitScoreFormulaPanelProps) {
  if (!breakdown || rawScore === null) return null;

  const total = Math.max(0, Math.min(100, Math.round(rawScore)));
  const keywordTotalHit = breakdown.keyword_matched.length;
  const keywordTotalJob = breakdown.keyword_total;

  // v3 fallback — no embedding on one side. Show a one-liner instead of the
  // full formula so the UI does not falsely suggest the semantic term was used.
  if (breakdown.version === 3 || breakdown.semantic_sub === null) {
    return (
      <section
        className={cn(
          "bg-card dark:bg-zinc-800 rounded-lg border border-border dark:border-zinc-600 p-5",
          className,
        )}
      >
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          How this score was computed
        </h3>
        <p className="mt-3 text-sm text-foreground/80 dark:text-zinc-200">
          Keyword-only score — embeddings unavailable for your resume yet.
          Based on {keywordTotalHit}/{keywordTotalJob} job keywords matching
          your resume.
        </p>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "bg-card dark:bg-zinc-800 rounded-lg border border-border dark:border-zinc-600 p-5",
        className,
      )}
    >
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        How this score was computed
      </h3>

      <div className="mt-4 flex items-center gap-4 flex-wrap">
        <FormulaTerm
          label="Semantic"
          value={breakdown.semantic_sub}
          weight={0.5}
          footnote="embedding cosine, calibrated"
        />
        <span className="text-2xl text-muted-foreground">+</span>
        <FormulaTerm
          label="Keywords"
          value={breakdown.keyword_sub}
          weight={0.5}
          footnote={`${keywordTotalHit}/${keywordTotalJob} job keywords hit`}
        />
        <span className="text-2xl text-muted-foreground">=</span>
        <div className="flex flex-col items-center">
          <span className="text-3xl font-bold tabular-nums text-foreground dark:text-white">
            {total}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
            Total
          </span>
        </div>
      </div>
    </section>
  );
}

interface FormulaTermProps {
  label: string;
  value: number;
  weight: number;
  footnote: string;
}

function FormulaTerm({ label, value, weight, footnote }: FormulaTermProps) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-2xl font-bold tabular-nums text-foreground dark:text-white">
          {value}
        </span>
        <span className="text-sm text-muted-foreground">× {weight}</span>
      </div>
      <span className="text-[10px] text-muted-foreground/80 mt-1">{footnote}</span>
    </div>
  );
}
