"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Target,
  AlertCircle,
  LinkIcon,
  RefreshCw,
  ChevronDown,
  Check,
  Plus,
  Briefcase,
  Building2,
} from "lucide-react";
import { useBlockEditor } from "../BlockEditorContext";
import { blocksToText } from "@/lib/resume/transforms";
import { useJob, useJobListing, useATSKeywordAnalysis } from "@/lib/api/hooks";
import type {
  ATSKeywordDetailedResponse,
  KeywordImportance,
} from "@/lib/api/types";

interface ATSEvaluationTabProps {
  /** User-created job ID for ATS analysis - null means no job context */
  jobId: number | null;
  /** Scraped job listing ID for ATS analysis - null means no job context */
  jobListingId: number | null;
}

// Importance level configuration for visual styling
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

/**
 * Coverage indicator with progress bar
 */
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

/**
 * Keyword chip showing found/missing status
 */
function KeywordChip({
  keyword,
  found,
  inVault,
  importance,
}: {
  keyword: string;
  found: boolean;
  inVault: boolean;
  importance: KeywordImportance;
}) {
  const config = IMPORTANCE_CONFIG[importance];

  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium
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
            ? "Available in your vault"
            : "Not found in your experience"
      }
    >
      {found && <Check className="w-3 h-3" />}
      {!found && inVault && <Plus className="w-3 h-3" />}
      {keyword}
    </span>
  );
}

/**
 * Collapsible keyword section by importance level
 */
function KeywordSection({
  title,
  importance,
  matched,
  missing,
  missingInVault,
}: {
  title: string;
  importance: KeywordImportance;
  matched: string[];
  missing: string[];
  missingInVault: string[];
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
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
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

/**
 * Main ATS score display
 */
function ATSScoreDisplay({ score }: { score: number }) {
  const percentage = Math.round(score * 100);
  const color =
    percentage >= 70
      ? "text-green-600 border-green-500"
      : percentage >= 40
        ? "text-yellow-600 border-yellow-500"
        : "text-red-600 border-red-500";
  const bgColor =
    percentage >= 70
      ? "bg-green-50"
      : percentage >= 40
        ? "bg-yellow-50"
        : "bg-red-50";

  return (
    <div className="flex flex-col items-center py-4">
      <div
        className={`w-20 h-20 rounded-full border-4 ${color} ${bgColor} flex items-center justify-center`}
      >
        <span className={`text-2xl font-bold ${color.split(" ")[0]}`}>
          {percentage}
        </span>
      </div>
      <p className="text-sm text-muted-foreground mt-2">ATS Score</p>
    </div>
  );
}

/**
 * Job context header showing which job is being analyzed
 */
function JobContextHeader({
  title,
  company,
  isJobListing,
}: {
  title: string;
  company?: string | null;
  isJobListing: boolean;
}) {
  return (
    <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
      <div className="flex items-center gap-2 text-sm text-primary font-medium">
        {isJobListing ? (
          <Briefcase className="w-4 h-4" />
        ) : (
          <Building2 className="w-4 h-4" />
        )}
        <span className="truncate">{title}</span>
      </div>
      {company && (
        <p className="text-xs text-muted-foreground mt-1 truncate">{company}</p>
      )}
    </div>
  );
}

/**
 * ATSEvaluationTab - ATS analysis and keyword coverage
 *
 * Shows keyword coverage analysis when a job context is provided.
 * Disabled state when no job is selected.
 */
export function ATSEvaluationTab({
  jobId,
  jobListingId,
}: ATSEvaluationTabProps) {
  const { state } = useBlockEditor();
  const { blocks } = state;

  // Determine which type of job we're fetching
  const isUserJob = jobId !== null;
  const isJobListing = jobListingId !== null;
  const hasJobContext = isUserJob || isJobListing;

  // Fetch job data based on which ID is provided
  const {
    data: userJob,
    isLoading: userJobLoading,
    error: userJobError,
  } = useJob(jobId ?? 0);
  const {
    data: jobListing,
    isLoading: jobListingLoading,
    error: jobListingError,
  } = useJobListing(jobListingId ?? 0);

  // Extract job description from whichever source is available
  const jobDescription = useMemo(() => {
    if (isUserJob && userJob) {
      return userJob.raw_content;
    }
    if (isJobListing && jobListing) {
      return jobListing.job_description;
    }
    return null;
  }, [isUserJob, isJobListing, userJob, jobListing]);

  // Extract job title and company for display
  const jobTitle = useMemo(() => {
    if (isUserJob && userJob) {
      return userJob.title;
    }
    if (isJobListing && jobListing) {
      return jobListing.job_title;
    }
    return null;
  }, [isUserJob, isJobListing, userJob, jobListing]);

  const jobCompany = useMemo(() => {
    if (isUserJob && userJob) {
      return userJob.company;
    }
    if (isJobListing && jobListing) {
      return jobListing.company_name;
    }
    return null;
  }, [isUserJob, isJobListing, userJob, jobListing]);

  // Convert blocks to text for ATS analysis
  const resumeContent = useMemo(() => blocksToText(blocks), [blocks]);

  // ATS analysis state
  const [analysis, setAnalysis] = useState<ATSKeywordDetailedResponse | null>(
    null
  );
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const analysisMutation = useATSKeywordAnalysis();

  // Run ATS analysis
  const runAnalysis = useCallback(() => {
    if (!jobDescription || jobDescription.length < 50) {
      setAnalysisError("Job description is too short for analysis");
      return;
    }

    setAnalysisError(null);
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
          setAnalysisError(
            err instanceof Error ? err.message : "Failed to analyze keywords"
          );
        },
      }
    );
  }, [jobDescription, resumeContent, analysisMutation]);

  // Auto-run analysis when job description is loaded or resume changes
  useEffect(() => {
    if (jobDescription && jobDescription.length >= 50) {
      const timeoutId = setTimeout(runAnalysis, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [jobDescription, resumeContent, runAnalysis]);

  // Loading states
  const isLoadingJob = isUserJob ? userJobLoading : jobListingLoading;
  const jobError = isUserJob ? userJobError : jobListingError;
  const isAnalyzing = analysisMutation.isPending;

  // No job context - show disabled state
  if (!hasJobContext) {
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

        {/* Disabled state content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6 text-muted-foreground/60" />
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              No Job Selected
            </p>
            <p className="text-xs text-muted-foreground/70 max-w-[220px] mb-4">
              ATS evaluation requires a job description. Navigate from a job
              posting to enable this feature.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
              <LinkIcon className="w-3 h-3" />
              <span>Jobs → Optimize Resume</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading job data
  if (isLoadingJob) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Target className="w-4 h-4" />
            ATS Evaluation
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Loading job details...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error loading job
  if (jobError) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Target className="w-4 h-4" />
            ATS Evaluation
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Failed to load job details
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {jobError instanceof Error
                ? jobError.message
                : "Unknown error occurred"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Target className="w-4 h-4" />
            ATS Evaluation
          </h3>
          {analysis && (
            <button
              onClick={runAnalysis}
              disabled={isAnalyzing}
              className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3 h-3 ${isAnalyzing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Job Context Header */}
        {jobTitle && (
          <JobContextHeader
            title={jobTitle}
            company={jobCompany}
            isJobListing={isJobListing}
          />
        )}

        {/* Analyzing state */}
        {isAnalyzing && !analysis && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin mb-3" />
            <p className="text-sm text-muted-foreground">
              Analyzing keywords...
            </p>
          </div>
        )}

        {/* Analysis error */}
        {analysisError && !isAnalyzing && (
          <div className="text-center py-8">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{analysisError}</p>
            <button
              onClick={runAnalysis}
              className="mt-3 text-sm text-primary hover:text-primary/80 font-medium"
            >
              Retry Analysis
            </button>
          </div>
        )}

        {/* Analysis Results */}
        {analysis && (
          <>
            {/* ATS Score */}
            <ATSScoreDisplay score={analysis.coverage_score} />

            {/* Coverage Indicators */}
            <div className="space-y-2">
              <CoverageIndicator
                score={analysis.coverage_score}
                label="Overall"
              />
              <CoverageIndicator
                score={analysis.required_coverage}
                label="Required"
              />
              <CoverageIndicator
                score={analysis.preferred_coverage}
                label="Preferred"
              />
            </div>

            {/* Warnings */}
            {analysis.warnings.length > 0 && (
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                {analysis.warnings.map((warning, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs">
                    <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <span className="text-yellow-800">{warning}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Keyword Sections */}
            <div className="space-y-3">
              <KeywordSection
                title="Required"
                importance="required"
                matched={analysis.required_matched}
                missing={analysis.required_missing}
                missingInVault={analysis.missing_available_in_vault}
              />

              <KeywordSection
                title="Preferred"
                importance="preferred"
                matched={analysis.preferred_matched}
                missing={analysis.preferred_missing}
                missingInVault={analysis.missing_available_in_vault}
              />

              <KeywordSection
                title="Nice to Have"
                importance="nice_to_have"
                matched={analysis.nice_to_have_matched}
                missing={analysis.nice_to_have_missing}
                missingInVault={analysis.missing_available_in_vault}
              />
            </div>

            {/* Suggestions */}
            {analysis.suggestions.length > 0 && (
              <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
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
          </>
        )}
      </div>
    </div>
  );
}
