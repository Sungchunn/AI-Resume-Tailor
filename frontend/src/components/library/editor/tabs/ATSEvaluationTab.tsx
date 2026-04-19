"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Target,
  AlertCircle,
  AlertTriangle,
  LinkIcon,
  RefreshCw,
  ChevronDown,
  Check,
  Plus,
  Briefcase,
  Building2,
  ShieldAlert,
} from "lucide-react";
import { useDebouncedCallback } from "use-debounce";
import { useBlockEditor } from "../BlockEditorContext";
import { blocksToContent } from "@/lib/tailoring/blocksToContent";
import {
  useJob,
  useJobListing,
  useATSContentAnalysis,
  useATSProgressiveAnalysis,
} from "@/lib/api/hooks";
import { useATSProgressStore } from "@/lib/stores/atsProgressStore";
import { useBulletSuggestionsStore } from "@/lib/stores/bulletSuggestionsStore";
import { useRewriteIsActive, useRewriteIsLoading } from "@/lib/stores/rewriteDiffStore";
import { useIsInlineReviewActive } from "@/lib/stores/inlineSuggestionQueueStore";
import { useRewriteResume } from "@/hooks/useRewriteResume";
import { Wand2 } from "lucide-react";
import { generateContentHash } from "@/lib/utils/contentHash";
import { transformEnhancedToDetailedFormat } from "@/lib/ats/transformKeywordAnalysis";
import type {
  ATSContentAnalysisResponse,
  ATSKeywordDetailedResponse,
  ATSKeywordEnhancedAnalysis,
  KeywordImportance,
  KnockoutRiskItem,
} from "@/lib/api/types";

const LIVE_DEBOUNCE_MS = 1500;

// Stage key → label (matches backend helpers.py composite keys)
const STAGE_LABELS: Record<string, string> = {
  structure: "Structure",
  "keywords-enhanced": "Keywords",
  "content-quality": "Content Quality",
  "role-proximity": "Role Proximity",
};

interface ATSEvaluationTabProps {
  /** Resume MongoDB ObjectId - required for the progressive SSE flow */
  resumeId: string;
  /** User-created job ID for ATS analysis - UUID, null means no job context */
  jobId: string | null;
  /** Scraped job listing ID for ATS analysis - integer, null means no job context */
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
 * Main ATS score display (score is 0–100 composite final_score)
 */
function ATSScoreDisplay({ score }: { score: number }) {
  const percentage = Math.round(score);
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
 * Composite breakdown — shows each stage's raw score, its weight,
 * and its weighted contribution to the composite. Fed by either the
 * live /analyze-content response or the persisted SSE composite.
 */
function CompositeBreakdown({
  stageBreakdown,
  weightsUsed,
  failedStages,
}: {
  stageBreakdown: Record<string, number>;
  weightsUsed: Record<string, number>;
  failedStages: string[];
}) {
  const rows = Object.entries(weightsUsed)
    .filter(([, weight]) => weight > 0)
    .map(([key, weight]) => {
      const contribution = stageBreakdown[key] ?? 0;
      const rawScore = weight > 0 ? contribution / weight : 0;
      return {
        key,
        label: STAGE_LABELS[key] ?? key,
        weight,
        contribution,
        rawScore,
      };
    });

  if (rows.length === 0) return null;

  return (
    <div className="p-3 bg-muted/30 rounded-lg border border-border space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Score breakdown
        </span>
        <span className="text-[10px] text-muted-foreground/70">
          score × weight = contribution
        </span>
      </div>
      <div className="space-y-1">
        {rows.map((r) => (
          <div
            key={r.key}
            className="flex items-center gap-2 text-xs tabular-nums"
          >
            <span className="w-24 text-muted-foreground truncate">
              {r.label}
            </span>
            <span className="w-10 text-right">{Math.round(r.rawScore)}</span>
            <span className="text-muted-foreground/60">×</span>
            <span className="w-10 text-right">
              {Math.round(r.weight * 100)}%
            </span>
            <span className="text-muted-foreground/60">=</span>
            <span className="flex-1 text-right font-medium">
              {r.contribution.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
      {failedStages.length > 0 && (
        <div className="text-[11px] text-yellow-800 bg-yellow-50 border border-yellow-200 rounded p-2 mt-1 flex items-start gap-1.5">
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
          <span>
            Some stages failed and weights were renormalized:{" "}
            {failedStages.join(", ")}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Knockout risk banner — surfaces critical disqualifiers from Stage 0.
 */
function KnockoutBanner({ risks }: { risks: KnockoutRiskItem[] }) {
  if (risks.length === 0) return null;
  return (
    <div className="space-y-2">
      {risks.map((risk, idx) => {
        const isCritical = risk.severity === "critical";
        const wrapper = isCritical
          ? "bg-red-50 border-red-300"
          : "bg-yellow-50 border-yellow-300";
        const text = isCritical ? "text-red-800" : "text-yellow-800";
        return (
          <div key={idx} className={`p-3 rounded-lg border ${wrapper}`}>
            <div className={`flex items-start gap-2 ${text}`}>
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{risk.description}</p>
                <p className="text-xs mt-1 opacity-80">
                  Job requires: {risk.job_requires}
                </p>
                {risk.user_has && (
                  <p className="text-xs opacity-80">
                    Your resume: {risk.user_has}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
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
 * ATSEvaluationTab — editor sidebar ATS score.
 *
 * Uses the SAME 5-stage composite pipeline as /tailor/analyze so the numbers
 * match bit-for-bit on a cache hit. Two-mode scoring:
 *
 *  1. Cache-hit mode: if `useATSProgressStore` already has a composite for
 *     this (resumeId, jobId), render it immediately. Otherwise kick off the
 *     progressive SSE flow (same as /tailor/analyze) so Redis can answer fast.
 *
 *  2. Live mode: after any resume edit, debounce 1500ms then POST
 *     /analyze-content with the in-memory buffer. Same 5 stages, no Redis —
 *     correct score for unsaved content.
 */
export function ATSEvaluationTab({
  resumeId,
  jobId,
  jobListingId,
}: ATSEvaluationTabProps) {
  const { state } = useBlockEditor();
  const { blocks } = state;

  // Store selectors
  const storeResumeId = useATSProgressStore((s) => s.resumeId);
  const storeJobId = useATSProgressStore((s) => s.jobId);
  const compositeScore = useATSProgressStore((s) => s.compositeScore);
  const storeStages = useATSProgressStore((s) => s.stages);
  const storeIsAnalyzing = useATSProgressStore((s) => s.isAnalyzing);
  const analyzedContentHash = useATSProgressStore((s) => s.analyzedContentHash);
  const contentStale = useATSProgressStore((s) => s.contentStale);
  const setAnalyzedContentHash = useATSProgressStore(
    (s) => s.setAnalyzedContentHash
  );
  const setKeywordAnalysisResult = useATSProgressStore(
    (s) => s.setKeywordAnalysisResult
  );
  const markContentStale = useATSProgressStore((s) => s.markContentStale);
  const clearStaleFlag = useATSProgressStore((s) => s.clearStaleFlag);

  const clearBulletSuggestions = useBulletSuggestionsStore(
    (s) => s.clearSuggestions
  );

  // Job context
  const isUserJob = jobId !== null;
  const isJobListing = jobListingId !== null;
  const hasJobContext = isUserJob || isJobListing;
  // Mirror the store's encoding of the job id (always a string, "0" if none)
  const effectiveJobId =
    jobId ?? (jobListingId !== null ? jobListingId.toString() : "0");

  const {
    data: userJob,
    isLoading: userJobLoading,
    error: userJobError,
  } = useJob(jobId ?? "");
  const {
    data: jobListing,
    isLoading: jobListingLoading,
    error: jobListingError,
  } = useJobListing(jobListingId ?? 0);

  const jobDescription = useMemo(() => {
    if (isUserJob && userJob) return userJob.raw_content;
    if (isJobListing && jobListing) return jobListing.job_description;
    return null;
  }, [isUserJob, isJobListing, userJob, jobListing]);

  const jobTitle = useMemo(() => {
    if (isUserJob && userJob) return userJob.title;
    if (isJobListing && jobListing) return jobListing.job_title;
    return null;
  }, [isUserJob, isJobListing, userJob, jobListing]);

  const jobCompany = useMemo(() => {
    if (isUserJob && userJob) return userJob.company;
    if (isJobListing && jobListing) return jobListing.company_name;
    return null;
  }, [isUserJob, isJobListing, userJob, jobListing]);

  // Parsed job metadata (title, company, seniority, industry, etc.) for
  // Stage 4 Role Proximity. Without this, role_proximity_score is 0 and the
  // composite drops ~20 points vs /tailor/analyze. Mirrors the shape that
  // /analyze-progressive builds in progressive.py lines 148–176.
  const jobContent = useMemo<Record<string, unknown> | null>(() => {
    if (isJobListing && jobListing) {
      return {
        title: jobListing.job_title,
        company: jobListing.company_name,
        location: jobListing.location,
        seniority: jobListing.seniority,
        job_function: jobListing.job_function,
        industry: jobListing.industry,
        description: jobListing.job_description,
      };
    }
    if (isUserJob && userJob) {
      if (userJob.parsed_content) return userJob.parsed_content;
      return {
        title: userJob.title,
        company: userJob.company,
        description: userJob.raw_content,
      };
    }
    return null;
  }, [isUserJob, isJobListing, userJob, jobListing]);

  // Live scoring via /analyze-content
  const contentMutation = useATSContentAnalysis();
  const [analysis, setAnalysis] = useState<ATSContentAnalysisResponse | null>(
    null
  );
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Progressive SSE (same flow /tailor/analyze uses)
  const { startAnalysis } = useATSProgressiveAnalysis();

  // The store's compositeScore matches our (resumeId, jobId)?
  const storeMatches =
    storeResumeId === resumeId &&
    storeJobId === effectiveJobId &&
    compositeScore !== null;

  // Preferred source for the displayed score — live analysis takes priority
  const displayScore = useMemo(() => {
    if (analysis) return analysis.final_score;
    if (storeMatches && compositeScore) return compositeScore.finalScore;
    return null;
  }, [analysis, storeMatches, compositeScore]);

  const stageBreakdown = useMemo(() => {
    if (analysis) return analysis.stage_breakdown;
    if (storeMatches && compositeScore) return compositeScore.stageBreakdown;
    return null;
  }, [analysis, storeMatches, compositeScore]);

  const weightsUsed = useMemo(() => {
    if (analysis) return analysis.weights_used;
    if (storeMatches && compositeScore) return compositeScore.weightsUsed;
    return null;
  }, [analysis, storeMatches, compositeScore]);

  const failedStages = useMemo(() => {
    if (analysis) return analysis.failed_stages;
    if (storeMatches && compositeScore) return compositeScore.failedStages;
    return [];
  }, [analysis, storeMatches, compositeScore]);

  const knockoutRisks = useMemo<KnockoutRiskItem[]>(() => {
    if (analysis?.knockout_risks?.length) return analysis.knockout_risks;
    if (storeMatches) {
      const stage0 = storeStages[0]?.result as
        | { risks?: KnockoutRiskItem[] }
        | undefined;
      return stage0?.risks ?? [];
    }
    return [];
  }, [analysis, storeMatches, storeStages]);

  // Collapse enhanced → detailed 3-tier for keyword UI
  const detailedKeywordAnalysis = useMemo<ATSKeywordDetailedResponse | null>(
    () => {
      if (analysis?.keyword_analysis) {
        return transformEnhancedToDetailedFormat(analysis.keyword_analysis);
      }
      if (storeMatches) {
        const stage2 = storeStages[2]?.result as
          | ATSKeywordEnhancedAnalysis
          | undefined;
        if (stage2) return transformEnhancedToDetailedFormat(stage2);
      }
      return null;
    },
    [analysis, storeMatches, storeStages]
  );

  // Keep the shared store's keyword analysis in sync so the inline suggestion
  // queue (which reads `keywordAnalysisResult` globally) stays current.
  useEffect(() => {
    setKeywordAnalysisResult(detailedKeywordAnalysis);
  }, [detailedKeywordAnalysis, setKeywordAnalysisResult]);

  // Reset local analysis state when the target resume or job changes
  useEffect(() => {
    setAnalysis(null);
    setAnalysisError(null);
  }, [resumeId, effectiveJobId]);

  // Live scoring call
  const runLiveAnalysis = useCallback(() => {
    if (!jobDescription || jobDescription.length < 50) {
      setAnalysisError("Job description is too short for analysis");
      return;
    }
    const content = blocksToContent(blocks);
    const currentHash = generateContentHash(blocks);
    setAnalysisError(null);
    contentMutation.mutate(
      {
        resume_content: content,
        job_description: jobDescription,
        job_content: jobContent,
      },
      {
        onSuccess: (response) => {
          setAnalysis(response);
          setAnalyzedContentHash(currentHash);
          clearStaleFlag();
        },
        onError: (err) => {
          setAnalysisError(
            err instanceof Error ? err.message : "Failed to analyze content"
          );
        },
      }
    );
  }, [
    blocks,
    jobDescription,
    jobContent,
    contentMutation,
    setAnalyzedContentHash,
    clearStaleFlag,
  ]);

  const debouncedLive = useDebouncedCallback(runLiveAnalysis, LIVE_DEBOUNCE_MS);
  useEffect(() => () => debouncedLive.cancel(), [debouncedLive]);

  // Kick progressive SSE once per (resume, job) pair. Mirrors /tailor/analyze
  // so the Redis cache answers instantly when the pair was already analyzed.
  const initialKickedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!hasJobContext || !jobDescription || jobDescription.length < 50) return;
    const pairKey = `${resumeId}::${effectiveJobId}`;
    if (initialKickedKeyRef.current === pairKey) return;
    initialKickedKeyRef.current = pairKey;
    if (storeMatches) return; // store already has the answer
    startAnalysis(resumeId, {
      jobId: jobId ?? undefined,
      jobListingId: jobListingId ?? undefined,
    });
  }, [
    hasJobContext,
    jobDescription,
    storeMatches,
    resumeId,
    effectiveJobId,
    jobId,
    jobListingId,
    startAnalysis,
  ]);

  // When progressive SSE writes a new composite to the store, record the
  // buffer hash so later edits can detect staleness against a known baseline.
  const lastSeenCompositeRef = useRef<number | null>(null);
  useEffect(() => {
    if (!storeMatches || !compositeScore) return;
    if (compositeScore.finalScore === lastSeenCompositeRef.current) return;
    lastSeenCompositeRef.current = compositeScore.finalScore;
    setAnalyzedContentHash(generateContentHash(blocks));
  }, [storeMatches, compositeScore, blocks, setAnalyzedContentHash]);

  // Re-score on edits (debounced). Staleness banner fires until the response
  // returns and clearStaleFlag runs.
  useEffect(() => {
    if (!jobDescription || jobDescription.length < 50) return;
    if (!analyzedContentHash) return;
    const currentHash = generateContentHash(blocks);
    if (currentHash === analyzedContentHash) return;
    if (!contentStale) markContentStale();
    debouncedLive();
  }, [
    blocks,
    jobDescription,
    analyzedContentHash,
    contentStale,
    markContentStale,
    debouncedLive,
  ]);

  // Force a full re-run via progressive SSE (skips Redis cache). Used by the
  // "Full re-analyze" header button.
  const handleForceRefresh = useCallback(() => {
    debouncedLive.cancel();
    clearBulletSuggestions();
    clearStaleFlag();
    startAnalysis(resumeId, {
      jobId: jobId ?? undefined,
      jobListingId: jobListingId ?? undefined,
      forceRefresh: true,
    });
  }, [
    debouncedLive,
    clearBulletSuggestions,
    clearStaleFlag,
    startAnalysis,
    resumeId,
    jobId,
    jobListingId,
  ]);

  // Stale-banner button: re-score the live buffer now (no debounce).
  const handleLiveReanalyze = useCallback(() => {
    debouncedLive.cancel();
    clearBulletSuggestions();
    runLiveAnalysis();
  }, [debouncedLive, clearBulletSuggestions, runLiveAnalysis]);

  // Loading states
  const isLoadingJob = isUserJob ? userJobLoading : jobListingLoading;
  const jobError = isUserJob ? userJobError : jobListingError;
  const isAnalyzing = contentMutation.isPending || storeIsAnalyzing;
  const hasScore = displayScore !== null;

  // Rewrite feature
  const isRewriteActive = useRewriteIsActive();
  const isRewriteLoading = useRewriteIsLoading();
  const isBatchReviewActive = useIsInlineReviewActive();
  const { triggerRewrite, error: rewriteError } = useRewriteResume({
    resumeId,
    jobId: effectiveJobId,
    jobDescription: jobDescription ?? "",
    preRewriteScore: displayScore,
  });
  const canRewrite =
    hasScore &&
    hasJobContext &&
    !!jobDescription &&
    !isAnalyzing &&
    !isRewriteActive &&
    !isRewriteLoading &&
    !isBatchReviewActive;

  // No job context - show disabled state
  if (!hasJobContext) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Target className="w-4 h-4" />
            ATS Evaluation
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Analyze keyword coverage and ATS compatibility
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6 text-muted-foreground/60" />
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              No Job Selected
            </p>
            <p className="text-xs text-muted-foreground/70 max-w-55 mb-4">
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
      <div className="shrink-0 px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Target className="w-4 h-4" />
            ATS Evaluation
          </h3>
          <div className="flex items-center gap-2">
            {hasScore && (
              <button
                onClick={handleForceRefresh}
                disabled={isAnalyzing}
                className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 disabled:opacity-50"
                title="Skip cache and re-run all 5 stages"
              >
                <RefreshCw
                  className={`w-3 h-3 ${isAnalyzing ? "animate-spin" : ""}`}
                />
                Full re-analyze
              </button>
            )}
            {hasScore && (
              <button
                onClick={triggerRewrite}
                disabled={!canRewrite}
                className="text-xs bg-teal-600 hover:bg-teal-700 text-white font-medium flex items-center gap-1 px-2 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  isRewriteActive
                    ? "Rewrite review in progress"
                    : "AI-rewrite all bullets for this job"
                }
              >
                <Wand2 className={`w-3 h-3 ${isRewriteLoading ? "animate-pulse" : ""}`} />
                {isRewriteLoading ? "Rewriting…" : "Rewrite for this job"}
              </button>
            )}
          </div>
        </div>
        {rewriteError && (
          <p className="text-xs text-destructive mt-1">{rewriteError}</p>
        )}
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

        {/* Stale content warning */}
        {contentStale && hasScore && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                    Content has changed
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    Your resume was modified since the last analysis
                  </p>
                </div>
              </div>
              <button
                onClick={handleLiveReanalyze}
                disabled={isAnalyzing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-700 dark:text-yellow-400 rounded-md transition-colors shrink-0 disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isAnalyzing ? "animate-spin" : ""}`}
                />
                Re-analyze
              </button>
            </div>
          </div>
        )}

        {/* First-load spinner */}
        {isAnalyzing && !hasScore && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin mb-3" />
            <p className="text-sm text-muted-foreground">Analyzing resume...</p>
          </div>
        )}

        {/* Fatal error (live analysis) */}
        {analysisError && !isAnalyzing && (
          <div className="text-center py-8">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{analysisError}</p>
            <button
              onClick={runLiveAnalysis}
              className="mt-3 text-sm text-primary hover:text-primary/80 font-medium"
            >
              Retry Analysis
            </button>
          </div>
        )}

        {/* Results */}
        {hasScore && (
          <>
            <KnockoutBanner risks={knockoutRisks} />

            <ATSScoreDisplay score={displayScore!} />

            {stageBreakdown && weightsUsed && (
              <CompositeBreakdown
                stageBreakdown={stageBreakdown}
                weightsUsed={weightsUsed}
                failedStages={failedStages}
              />
            )}

            {detailedKeywordAnalysis && (
              <>
                <div className="space-y-2">
                  <CoverageIndicator
                    score={detailedKeywordAnalysis.required_coverage}
                    label="Required"
                  />
                  <CoverageIndicator
                    score={detailedKeywordAnalysis.preferred_coverage}
                    label="Preferred"
                  />
                </div>

                {detailedKeywordAnalysis.warnings.length > 0 && (
                  <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100 space-y-1">
                    {detailedKeywordAnalysis.warnings.map((warning, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 text-xs"
                      >
                        <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
                        <span className="text-yellow-800">{warning}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-3">
                  <KeywordSection
                    title="Required"
                    importance="required"
                    matched={detailedKeywordAnalysis.required_matched}
                    missing={detailedKeywordAnalysis.required_missing}
                    missingInVault={
                      detailedKeywordAnalysis.missing_available_in_vault
                    }
                  />
                  <KeywordSection
                    title="Preferred"
                    importance="preferred"
                    matched={detailedKeywordAnalysis.preferred_matched}
                    missing={detailedKeywordAnalysis.preferred_missing}
                    missingInVault={
                      detailedKeywordAnalysis.missing_available_in_vault
                    }
                  />
                  <KeywordSection
                    title="Nice to Have"
                    importance="nice_to_have"
                    matched={detailedKeywordAnalysis.nice_to_have_matched}
                    missing={detailedKeywordAnalysis.nice_to_have_missing}
                    missingInVault={
                      detailedKeywordAnalysis.missing_available_in_vault
                    }
                  />
                </div>

                {detailedKeywordAnalysis.suggestions.length > 0 && (
                  <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <h4 className="text-sm font-medium text-foreground mb-2">
                      Suggestions
                    </h4>
                    <ul className="space-y-1">
                      {detailedKeywordAnalysis.suggestions.map(
                        (suggestion, idx) => (
                          <li
                            key={idx}
                            className="text-xs text-foreground/80 flex items-start gap-2"
                          >
                            <span className="text-primary">•</span>
                            {suggestion}
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
