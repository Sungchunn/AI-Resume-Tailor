"use client";

import { formatDistanceToNow } from "@/lib/utils/date";
import { RefreshCw, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ATSScoreSummaryProps {
  score: number | null;
  isStale: boolean;
  isAnalyzing: boolean;
  progress: number;
  lastAnalyzed: Date | null;
  hasKnockouts?: boolean;
  onReanalyze: () => void;
}

export function ATSScoreSummary({
  score,
  isStale,
  isAnalyzing,
  progress,
  lastAnalyzed,
  hasKnockouts,
  onReanalyze,
}: ATSScoreSummaryProps) {
  const scoreColor = score !== null
    ? score >= 80 ? "text-green-600"
    : score >= 60 ? "text-amber-600"
    : "text-red-600"
    : "text-muted-foreground";

  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="flex items-center gap-4">
        <div className="relative w-20 h-20 flex-shrink-0">
          <ScoreGauge
            score={score}
            isAnalyzing={isAnalyzing}
            progress={progress}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("text-2xl font-bold", scoreColor)}>
              {score !== null ? score : "--"}
            </span>
            {isStale && !isAnalyzing && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
                <Clock className="w-3 h-3" />
                Outdated
              </span>
            )}
            {hasKnockouts && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                <AlertTriangle className="w-3 h-3" />
                Risks
              </span>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            {isAnalyzing
              ? `Analyzing... ${progress}%`
              : lastAnalyzed
                ? `Analyzed ${formatDistanceToNow(lastAnalyzed, { addSuffix: true })}`
                : "Not yet analyzed"
            }
          </p>
        </div>

        <button
          onClick={onReanalyze}
          disabled={isAnalyzing}
          className={cn(
            "inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
            isStale
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-muted hover:bg-accent border",
            isAnalyzing && "opacity-50 cursor-not-allowed"
          )}
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", isAnalyzing && "animate-spin")} />
          {isAnalyzing ? "Analyzing" : isStale ? "Re-analyze" : "Refresh"}
        </button>
      </div>
    </div>
  );
}

function ScoreGauge({
  score,
  isAnalyzing,
  progress,
}: {
  score: number | null;
  isAnalyzing: boolean;
  progress: number;
}) {
  const displayValue = isAnalyzing ? progress : (score ?? 0);
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (displayValue / 100) * circumference;

  const strokeColor = isAnalyzing
    ? "stroke-blue-500"
    : score !== null
      ? score >= 80 ? "stroke-green-500"
      : score >= 60 ? "stroke-amber-500"
      : "stroke-red-500"
    : "stroke-muted";

  return (
    <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
      <circle
        cx="40"
        cy="40"
        r="36"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        className="text-muted"
      />
      <circle
        cx="40"
        cy="40"
        r="36"
        fill="none"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        className={cn(strokeColor, isAnalyzing && "animate-pulse")}
        style={{ transition: "stroke-dashoffset 0.5s ease-out" }}
      />
    </svg>
  );
}
