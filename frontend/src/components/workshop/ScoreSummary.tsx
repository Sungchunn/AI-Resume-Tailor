"use client";

import { useState } from "react";
import { MatchScoreGauge } from "./MatchScoreGauge";
import { SkillBreakdown } from "./ScoreBreakdown";
import { ChevronDownIcon, ChevronUpIcon } from "@/components/icons";

interface ScoreSummaryProps {
  matchScore: number;
  previousScore?: number;
  skillMatches: string[];
  skillGaps: string[];
  keywordCoverage: number;
  isLoading?: boolean;
  className?: string;
}

export function ScoreSummary({
  matchScore,
  previousScore,
  skillMatches,
  skillGaps,
  keywordCoverage,
  isLoading = false,
  className = "",
}: ScoreSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const delta = previousScore !== undefined ? matchScore - previousScore : undefined;
  const deltaPositive = delta !== undefined && delta > 0;

  if (isLoading) {
    return (
      <div className={`bg-card rounded-lg border border-border p-4 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-full bg-muted animate-pulse" />
            <div className="w-20 h-4 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-card rounded-lg border border-border ${className}`}>
      {/* Compact header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-accent transition-colors"
      >
        <div className="flex items-center gap-4">
          <MatchScoreGauge score={matchScore} size="sm" showLabel={false} />
          <div className="text-left">
            <div className="text-sm font-medium text-foreground">
              Match Score: {Math.round(matchScore)}%
            </div>
            {delta !== undefined && delta !== 0 && (
              <div
                className={`text-xs ${
                  deltaPositive ? "text-green-600" : "text-red-600"
                }`}
              >
                {deltaPositive ? "+" : ""}
                {delta.toFixed(1)} from original
              </div>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUpIcon className="w-5 h-5 text-muted-foreground/60" />
        ) : (
          <ChevronDownIcon className="w-5 h-5 text-muted-foreground/60" />
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-border">
          <div className="pt-4">
            <SkillBreakdown
              skillMatches={skillMatches}
              skillGaps={skillGaps}
              keywordCoverage={keywordCoverage}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Full expanded version for dedicated panel
interface ScoreDetailPanelProps {
  matchScore: number;
  previousScore?: number;
  skillMatches: string[];
  skillGaps: string[];
  keywordCoverage: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  className?: string;
}

export function ScoreDetailPanel({
  matchScore,
  previousScore,
  skillMatches,
  skillGaps,
  keywordCoverage,
  onRefresh,
  isRefreshing = false,
  className = "",
}: ScoreDetailPanelProps) {
  const delta = previousScore !== undefined ? matchScore - previousScore : undefined;
  const deltaPositive = delta !== undefined && delta > 0;

  return (
    <div className={`bg-card rounded-lg border border-border p-6 ${className}`}>
      {/* Header with gauge */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <MatchScoreGauge score={matchScore} size="lg" showLabel={false} />
          <div>
            <h3 className="text-lg font-semibold text-foreground">Match Score</h3>
            {delta !== undefined && delta !== 0 && (
              <div
                className={`text-sm font-medium ${
                  deltaPositive ? "text-green-600" : "text-red-600"
                }`}
              >
                {deltaPositive ? "+" : ""}
                {delta.toFixed(1)}% from original
              </div>
            )}
          </div>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="text-sm text-muted-foreground hover:text-foreground/80 disabled:opacity-50"
          >
            {isRefreshing ? "Updating..." : "Refresh"}
          </button>
        )}
      </div>

      {/* Detailed breakdown */}
      <SkillBreakdown
        skillMatches={skillMatches}
        skillGaps={skillGaps}
        keywordCoverage={keywordCoverage}
      />
    </div>
  );
}
