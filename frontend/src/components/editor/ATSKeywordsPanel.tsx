"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  ATSKeywordDetailedResponse,
  KeywordDetail,
  KeywordImportance,
} from "@/lib/api/types";
import { useATSKeywordAnalysis } from "@/lib/api/hooks";

interface ATSKeywordsPanelProps {
  jobDescription: string;
  resumeContent: string;
  onKeywordClick?: (keyword: string, importance: KeywordImportance) => void;
}

const IMPORTANCE_CONFIG = {
  required: {
    label: "Required",
    bgColor: "bg-red-50",
    textColor: "text-red-700",
    borderColor: "border-red-200",
    badgeBg: "bg-red-100",
    icon: "!",
  },
  preferred: {
    label: "Preferred",
    bgColor: "bg-yellow-50",
    textColor: "text-yellow-700",
    borderColor: "border-yellow-200",
    badgeBg: "bg-yellow-100",
    icon: "+",
  },
  nice_to_have: {
    label: "Nice to Have",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    borderColor: "border-blue-200",
    badgeBg: "bg-blue-100",
    icon: "~",
  },
};

function CoverageIndicator({
  score,
  label,
}: {
  score: number;
  label: string;
}) {
  const percentage = Math.round(score * 100);
  const color =
    percentage >= 70
      ? "text-green-600"
      : percentage >= 40
      ? "text-yellow-600"
      : "text-red-600";
  const bgColor =
    percentage >= 70
      ? "bg-green-500"
      : percentage >= 40
      ? "bg-yellow-500"
      : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-16">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${bgColor} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className={`text-xs font-medium ${color} w-10 text-right`}>
        {percentage}%
      </span>
    </div>
  );
}

function KeywordChip({
  keyword,
  found,
  inVault,
  importance,
  onClick,
}: {
  keyword: string;
  found: boolean;
  inVault: boolean;
  importance: KeywordImportance;
  onClick?: () => void;
}) {
  const config = IMPORTANCE_CONFIG[importance];

  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium
        transition-all hover:shadow-sm
        ${
          found
            ? "bg-green-100 text-green-700 border border-green-200"
            : inVault
            ? `${config.bgColor} ${config.textColor} border ${config.borderColor} opacity-90`
            : `${config.bgColor} ${config.textColor} border ${config.borderColor} opacity-70`
        }
      `}
      title={
        found
          ? "Found in your resume"
          : inVault
          ? "Available in your vault - click to add"
          : "Not found in your experience"
      }
    >
      {found && (
        <svg
          className="w-3 h-3"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      )}
      {!found && inVault && (
        <svg
          className="w-3 h-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
      )}
      {keyword}
    </button>
  );
}

function KeywordSection({
  title,
  importance,
  matched,
  missing,
  missingInVault,
  onKeywordClick,
}: {
  title: string;
  importance: KeywordImportance;
  matched: string[];
  missing: string[];
  missingInVault: string[];
  onKeywordClick?: (keyword: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const config = IMPORTANCE_CONFIG[importance];
  const total = matched.length + missing.length;

  if (total === 0) return null;

  return (
    <div className={`rounded-lg border ${config.borderColor} overflow-hidden`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between p-3 ${config.bgColor}`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`w-5 h-5 rounded-full ${config.badgeBg} ${config.textColor} flex items-center justify-center text-xs font-bold`}
          >
            {config.icon}
          </span>
          <span className={`text-sm font-medium ${config.textColor}`}>
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {matched.length}/{total} matched
          </span>
          <svg
            className={`w-4 h-4 text-muted-foreground transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="p-3 bg-card space-y-2">
          {matched.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Matched</div>
              <div className="flex flex-wrap gap-1">
                {matched.map((kw) => (
                  <KeywordChip
                    key={kw}
                    keyword={kw}
                    found={true}
                    inVault={true}
                    importance={importance}
                  />
                ))}
              </div>
            </div>
          )}

          {missing.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Missing</div>
              <div className="flex flex-wrap gap-1">
                {missing.map((kw) => (
                  <KeywordChip
                    key={kw}
                    keyword={kw}
                    found={false}
                    inVault={missingInVault.includes(kw)}
                    importance={importance}
                    onClick={() => onKeywordClick?.(kw)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ATSKeywordsPanel({
  jobDescription,
  resumeContent,
  onKeywordClick,
}: ATSKeywordsPanelProps) {
  const [analysis, setAnalysis] = useState<ATSKeywordDetailedResponse | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const analysisMutation = useATSKeywordAnalysis();

  const runAnalysis = useCallback(() => {
    if (!jobDescription || jobDescription.length < 50) {
      setError("Job description is too short for analysis");
      return;
    }

    setError(null);
    analysisMutation.mutate(
      {
        job_description: jobDescription,
        resume_content: resumeContent || undefined,
      },
      {
        onSuccess: (data) => {
          setAnalysis(data);
        },
        onError: (err) => {
          setError(
            err instanceof Error ? err.message : "Failed to analyze keywords"
          );
        },
      }
    );
  }, [jobDescription, resumeContent, analysisMutation]);

  // Auto-run analysis when job description changes
  useEffect(() => {
    if (jobDescription && jobDescription.length >= 50) {
      const timeoutId = setTimeout(runAnalysis, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [jobDescription, runAnalysis]);

  const handleKeywordClick = (
    keyword: string,
    importance: KeywordImportance
  ) => {
    onKeywordClick?.(keyword, importance);
  };

  // Loading state
  if (analysisMutation.isPending) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4">
        <svg
          className="animate-spin h-8 w-8 text-primary"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <p className="mt-2 text-sm text-muted-foreground">Analyzing keywords...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4">
        <svg
          className="h-8 w-8 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <button
          onClick={runAnalysis}
          className="mt-3 text-sm text-primary hover:text-primary"
        >
          Retry
        </button>
      </div>
    );
  }

  // No job description state
  if (!jobDescription || jobDescription.length < 50) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center">
        <svg
          className="h-12 w-12 text-muted-foreground/60"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-foreground">
          No Job Description
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Add a job description to see keyword analysis
        </p>
      </div>
    );
  }

  // No analysis yet
  if (!analysis) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center">
        <button
          onClick={runAnalysis}
          className="btn-primary"
        >
          Analyze Keywords
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">ATS Keywords</h3>
          <button
            onClick={runAnalysis}
            className="text-xs text-primary hover:text-primary font-medium"
          >
            Refresh
          </button>
        </div>

        {/* Coverage indicators */}
        <div className="space-y-2">
          <CoverageIndicator score={analysis.coverage_score} label="Overall" />
          <CoverageIndicator
            score={analysis.required_coverage}
            label="Required"
          />
          <CoverageIndicator
            score={analysis.preferred_coverage}
            label="Preferred"
          />
        </div>
      </div>

      {/* Warnings */}
      {analysis.warnings.length > 0 && (
        <div className="shrink-0 p-3 bg-yellow-50 border-b border-yellow-100">
          {analysis.warnings.map((warning, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs">
              <svg
                className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-yellow-800">{warning}</span>
            </div>
          ))}
        </div>
      )}

      {/* Keyword sections */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <KeywordSection
          title="Required"
          importance="required"
          matched={analysis.required_matched}
          missing={analysis.required_missing}
          missingInVault={analysis.missing_available_in_vault}
          onKeywordClick={(kw) => handleKeywordClick(kw, "required")}
        />

        <KeywordSection
          title="Preferred"
          importance="preferred"
          matched={analysis.preferred_matched}
          missing={analysis.preferred_missing}
          missingInVault={analysis.missing_available_in_vault}
          onKeywordClick={(kw) => handleKeywordClick(kw, "preferred")}
        />

        <KeywordSection
          title="Nice to Have"
          importance="nice_to_have"
          matched={analysis.nice_to_have_matched}
          missing={analysis.nice_to_have_missing}
          missingInVault={analysis.missing_available_in_vault}
          onKeywordClick={(kw) => handleKeywordClick(kw, "nice_to_have")}
        />

        {/* Suggestions */}
        {analysis.suggestions.length > 0 && (
          <div className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
            <h4 className="text-sm font-medium text-foreground mb-2">
              Suggestions
            </h4>
            <ul className="space-y-1">
              {analysis.suggestions.map((suggestion, idx) => (
                <li
                  key={idx}
                  className="text-xs text-foreground/80 flex items-start gap-2"
                >
                  <span className="text-primary">•</span>
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
