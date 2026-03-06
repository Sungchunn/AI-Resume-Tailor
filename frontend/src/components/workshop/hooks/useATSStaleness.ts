"use client";

import { useMemo } from "react";
import { formatDistanceToNow } from "@/lib/utils/date";
import { useWorkshop } from "../WorkshopContext";

export interface ATSStalenessInfo {
  hasScore: boolean;
  isStale: boolean;
  lastAnalyzed: Date | null;
  staleSince: string | null;
  score: number | null;
  hasKnockouts: boolean;
  knockoutCount: number;
  hasHardKnockouts: boolean;
}

export function useATSStaleness(): ATSStalenessInfo {
  const { state } = useWorkshop();

  const staleness = useMemo(() => {
    const hasScore = state.atsCompositeScore !== null;
    const isStale = state.atsIsStale;
    const lastAnalyzed = state.atsLastAnalyzedAt;

    let staleSince: string | null = null;
    if (lastAnalyzed) {
      staleSince = formatDistanceToNow(lastAnalyzed, { addSuffix: true });
    }

    const hasHardKnockouts = state.atsKnockoutRisks.some(
      (risk) => risk.severity === "hard"
    );

    return {
      hasScore,
      isStale,
      lastAnalyzed,
      staleSince,
      score: state.atsCompositeScore?.final_score ?? null,
      hasKnockouts: state.atsKnockoutRisks.length > 0,
      knockoutCount: state.atsKnockoutRisks.length,
      hasHardKnockouts,
    };
  }, [
    state.atsCompositeScore,
    state.atsIsStale,
    state.atsLastAnalyzedAt,
    state.atsKnockoutRisks,
  ]);

  return staleness;
}
