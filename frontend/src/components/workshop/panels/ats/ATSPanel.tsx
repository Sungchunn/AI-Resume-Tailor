"use client";

import { Play, Target } from "lucide-react";
import { useWorkshop } from "../../WorkshopContext";
import { useATSProgressiveAnalysis } from "../../hooks/useATSProgressiveAnalysis";
import { ATSScoreSummary } from "./ATSScoreSummary";
import { KnockoutAlerts } from "./KnockoutAlerts";
import { StageBreakdown } from "./StageBreakdown";
import { KeywordAnalysis } from "./KeywordAnalysis";

export function ATSPanel() {
  const { state } = useWorkshop();
  const { analyze, isAnalyzing, progress } = useATSProgressiveAnalysis();

  const hasScore = state.atsCompositeScore !== null;
  const hasKnockouts = state.atsKnockoutRisks.length > 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-4">
        <ATSScoreSummary
          score={state.atsCompositeScore?.final_score ?? null}
          isStale={state.atsIsStale}
          isAnalyzing={isAnalyzing}
          progress={progress}
          lastAnalyzed={state.atsLastAnalyzedAt}
          hasKnockouts={hasKnockouts}
          onReanalyze={analyze}
        />

        {hasKnockouts && (
          <KnockoutAlerts risks={state.atsKnockoutRisks} />
        )}

        {hasScore && state.atsCompositeScore && (
          <StageBreakdown
            breakdown={state.atsCompositeScore.stage_breakdown}
            weights={state.atsCompositeScore.weights_used}
            failedStages={state.atsCompositeScore.failed_stages}
          />
        )}

        {hasScore && (
          <KeywordAnalysis />
        )}

        {!hasScore && !isAnalyzing && (
          <EmptyState onAnalyze={analyze} />
        )}

        {state.atsFatalError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">
              <strong>Error:</strong> {state.atsFatalError}
            </p>
            <button
              onClick={analyze}
              className="mt-2 px-3 py-1.5 text-sm font-medium rounded-md border bg-muted hover:bg-accent transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onAnalyze }: { onAnalyze: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
        <Target className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="font-medium mb-2">No ATS Analysis Yet</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-xs">
        Run an ATS analysis to see how well your resume matches this job posting.
      </p>
      <button
        onClick={onAnalyze}
        className="inline-flex items-center px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        <Play className="w-4 h-4 mr-2" />
        Analyze Resume
      </button>
    </div>
  );
}
