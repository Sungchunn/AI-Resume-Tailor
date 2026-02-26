"use client";

import { Target, AlertCircle, LinkIcon } from "lucide-react";

interface ATSEvaluationTabProps {
  /** Job ID for ATS analysis - null means no job context */
  jobId: number | null;
}

/**
 * ATSEvaluationTab - ATS analysis and keyword coverage
 *
 * Phase 1: Placeholder component
 * Future: Full ATS analysis with keyword matching when job context is present
 */
export function ATSEvaluationTab({ jobId }: ATSEvaluationTabProps) {
  const hasJobContext = jobId !== null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Target className="w-4 h-4" />
          ATS Evaluation
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Analyze keyword coverage and ATS compatibility
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {hasJobContext ? (
          // Has job context - show placeholder for analysis
          <div className="space-y-4">
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <p className="text-sm text-primary font-medium">Job #{jobId}</p>
              <p className="text-xs text-muted-foreground mt-1">
                ATS analysis will appear here
              </p>
            </div>

            {/* Placeholder score */}
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted border-4 border-muted-foreground/20">
                <span className="text-2xl font-bold text-muted-foreground">--</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">ATS Score</p>
            </div>

            {/* Placeholder keywords section */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-foreground/80">Keywords</h4>
              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">
                  Keyword analysis coming soon
                </p>
              </div>
            </div>
          </div>
        ) : (
          // No job context - show disabled state
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6 text-muted-foreground/60" />
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              No Job Selected
            </p>
            <p className="text-xs text-muted-foreground/70 max-w-[220px] mb-4">
              ATS evaluation requires a job description. Navigate from a job posting to enable this feature.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
              <LinkIcon className="w-3 h-3" />
              <span>Jobs → Optimize Resume</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
