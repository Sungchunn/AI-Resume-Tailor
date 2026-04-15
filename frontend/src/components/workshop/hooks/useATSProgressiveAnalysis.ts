"use client";

import { useCallback, useEffect, useRef } from "react";
import { authApi } from "@/lib/api/client";
import { useWorkshop, type ATSCompositeScore, type KnockoutRisk, type ATSStageResult } from "../WorkshopContext";
import type { ATSKeywordDetailedResponse, KeywordDetail } from "@/lib/api/types";

interface UseATSProgressiveAnalysisOptions {
  onComplete?: () => void;
  onError?: (error: string) => void;
}

interface SSEStageCompleteEvent {
  stage: number;
  name: string;
  score: number;
  details: Record<string, unknown>;
  elapsed_ms: number;
}

// Enhanced keyword detail from backend (4-layer weighted scoring)
interface EnhancedKeywordDetail {
  keyword: string;
  importance: string;
  found_in_resume: boolean;
  found_in_vault: boolean;
  frequency_in_job: number;
  context: string | null;
  occurrence_count: number;
  base_score: number;
  placement_score: number;
  density_score: number;
  recency_score: number;
  importance_weight: number;
  weighted_score: number;
}

// Enhanced keyword analysis from progressive endpoint Stage 2
interface EnhancedKeywordAnalysis {
  // Overall scores (0-100)
  keyword_score: number;
  raw_coverage: number;

  // Coverage by tier (0-1)
  required_coverage: number;
  strongly_preferred_coverage: number;
  preferred_coverage: number;
  nice_to_have_coverage: number;

  // Score contributions
  placement_contribution: number;
  density_contribution: number;
  recency_contribution: number;

  // Grouped keywords
  required_matched: string[];
  required_missing: string[];
  strongly_preferred_matched: string[];
  strongly_preferred_missing: string[];
  preferred_matched: string[];
  preferred_missing: string[];
  nice_to_have_matched: string[];
  nice_to_have_missing: string[];

  // Vault availability
  missing_available_in_vault: string[];
  missing_not_in_vault: string[];

  // Gap analysis
  gap_list: Array<{ keyword: string; importance: string; in_vault: boolean }>;

  // Detailed keywords
  all_keywords: EnhancedKeywordDetail[];

  // Suggestions
  suggestions: string[];
  warnings: string[];
}

/**
 * Transform enhanced keyword analysis (4-tier) to detailed format (3-tier).
 * Merges strongly_preferred into preferred tier since frontend uses 3 tiers.
 */
function transformEnhancedToDetailedFormat(
  enhanced: EnhancedKeywordAnalysis
): ATSKeywordDetailedResponse {
  // Merge strongly_preferred into preferred (frontend type has 3 tiers, backend has 4)
  const preferredMatched = [
    ...(enhanced.strongly_preferred_matched ?? []),
    ...(enhanced.preferred_matched ?? []),
  ];
  const preferredMissing = [
    ...(enhanced.strongly_preferred_missing ?? []),
    ...(enhanced.preferred_missing ?? []),
  ];

  // Convert EnhancedKeywordDetail to simpler KeywordDetail
  const allKeywords: KeywordDetail[] = (enhanced.all_keywords ?? []).map((kw) => ({
    keyword: kw.keyword,
    importance: kw.importance === "strongly_preferred" ? "preferred" : kw.importance as KeywordDetail["importance"],
    found_in_resume: kw.found_in_resume,
    found_in_vault: kw.found_in_vault,
    frequency_in_job: kw.frequency_in_job,
    context: kw.context,
  }));

  // Calculate merged preferred coverage (average of strongly_preferred and preferred)
  const mergedPreferredCoverage =
    (enhanced.strongly_preferred_coverage ?? 0) > 0 && (enhanced.preferred_coverage ?? 0) > 0
      ? ((enhanced.strongly_preferred_coverage ?? 0) + (enhanced.preferred_coverage ?? 0)) / 2
      : Math.max(enhanced.strongly_preferred_coverage ?? 0, enhanced.preferred_coverage ?? 0);

  return {
    coverage_score: enhanced.raw_coverage / 100, // Convert 0-100 to 0-1
    required_coverage: enhanced.required_coverage,
    preferred_coverage: mergedPreferredCoverage,
    required_matched: enhanced.required_matched ?? [],
    required_missing: enhanced.required_missing ?? [],
    preferred_matched: preferredMatched,
    preferred_missing: preferredMissing,
    nice_to_have_matched: enhanced.nice_to_have_matched ?? [],
    nice_to_have_missing: enhanced.nice_to_have_missing ?? [],
    missing_available_in_vault: enhanced.missing_available_in_vault ?? [],
    missing_not_in_vault: enhanced.missing_not_in_vault ?? [],
    all_keywords: allKeywords,
    suggestions: enhanced.suggestions ?? [],
    warnings: enhanced.warnings ?? [],
  };
}

// Backend knockout risk format (from API)
interface BackendKnockoutRisk {
  risk_type: "experience_years" | "education_level" | "certification" | "location" | "work_authorization";
  severity: "critical" | "warning" | "info";
  description: string;
  job_requires: string;
  user_has: string | null;
}

interface SSECacheHitEvent {
  composite_score: ATSCompositeScore;
  stage_results: Record<string, ATSStageResult>;
  knockout_risks?: BackendKnockoutRisk[];
  cached_at: string;
  content_hash: string;
}

interface SSECompleteEvent {
  composite_score: ATSCompositeScore;
  knockout_risks?: BackendKnockoutRisk[];
  content_hash: string;
}

/**
 * Transform backend knockout risk format to frontend format.
 * Maps field names and normalizes severity/category values.
 */
function transformKnockoutRisks(backendRisks: BackendKnockoutRisk[]): KnockoutRisk[] {
  return backendRisks.map((risk) => {
    // Map risk_type to category
    let category: KnockoutRisk["category"];
    switch (risk.risk_type) {
      case "experience_years":
        category = "experience";
        break;
      case "education_level":
        category = "education";
        break;
      case "certification":
        category = "certification";
        break;
      case "location":
      case "work_authorization":
        category = "location";
        break;
      default:
        category = "experience"; // Fallback
    }

    // Map severity: critical -> hard, warning/info -> soft
    const severity: KnockoutRisk["severity"] = risk.severity === "critical" ? "hard" : "soft";

    return {
      category,
      severity,
      message: risk.description,
      job_requirement: risk.job_requires,
      resume_value: risk.user_has ?? "Not specified",
    };
  });
}

export function useATSProgressiveAnalysis(options?: UseATSProgressiveAnalysisOptions) {
  const { state, dispatch } = useWorkshop();
  const eventSourceRef = useRef<EventSource | null>(null);

  const analyze = useCallback(async () => {
    // Need source resume_id and either job_id or job_listing_id
    const sourceResumeId = state.tailoredResume?.resume_id;
    const jobId = state.tailoredResume?.job_id;
    const jobListingId = state.tailoredResume?.job_listing_id;

    if (!sourceResumeId || (!jobId && !jobListingId)) {
      console.error("Missing resume or job ID for ATS analysis");
      return;
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    dispatch({ type: "ATS_ANALYSIS_START" });

    const url = new URL("/api/v1/ats/analyze-progressive", window.location.origin);
    url.searchParams.set("resume_id", sourceResumeId);
    if (jobListingId) {
      url.searchParams.set("job_listing_id", jobListingId.toString());
    } else if (jobId) {
      url.searchParams.set("job_id", jobId.toString());
    }

    // Exchange JWT for a one-time SSE ticket
    let ticket: string;
    try {
      ({ ticket } = await authApi.sseTicket());
    } catch {
      dispatch({ type: "ATS_ANALYSIS_ERROR", payload: "Failed to obtain SSE ticket" });
      options?.onError?.("Failed to obtain SSE ticket");
      return;
    }
    url.searchParams.set("ticket", ticket);

    const eventSource = new EventSource(url.toString());
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "cache_hit": {
            const payload = data as SSECacheHitEvent;
            dispatch({
              type: "ATS_CACHE_HIT",
              payload: {
                score: payload.composite_score,
                stageResults: payload.stage_results,
                knockouts: transformKnockoutRisks(payload.knockout_risks ?? []),
                cachedAt: new Date(payload.cached_at),
                hash: payload.content_hash,
              },
            });

            // Extract keyword analysis from cached stage results
            const keywordStage = payload.stage_results?.["Keyword Matching"];
            if (keywordStage?.details) {
              dispatch({
                type: "SET_ATS_ANALYSIS",
                payload: transformEnhancedToDetailedFormat(keywordStage.details as unknown as EnhancedKeywordAnalysis),
              });
            }

            eventSource.close();
            options?.onComplete?.();
            break;
          }

          case "stage_start":
            dispatch({
              type: "ATS_STAGE_START",
              payload: { stage: data.stage, name: data.name },
            });
            break;

          case "stage_complete": {
            const result = data.result as SSEStageCompleteEvent;
            dispatch({
              type: "ATS_STAGE_COMPLETE",
              payload: {
                stage: result.stage,
                name: result.name,
                score: result.score,
                details: result.details,
                elapsed_ms: result.elapsed_ms,
              },
            });

            // If Stage 2 (Keyword Matching), also populate atsAnalysis
            if (result.stage === 2 && result.details) {
              dispatch({
                type: "SET_ATS_ANALYSIS",
                payload: transformEnhancedToDetailedFormat(result.details as unknown as EnhancedKeywordAnalysis),
              });
            }
            break;
          }

          case "stage_error":
            dispatch({
              type: "ATS_STAGE_ERROR",
              payload: { stage: data.stage, error: data.error },
            });
            break;

          case "complete": {
            const payload = data as SSECompleteEvent;
            dispatch({
              type: "ATS_ANALYSIS_COMPLETE",
              payload: {
                score: payload.composite_score,
                knockouts: transformKnockoutRisks(payload.knockout_risks ?? []),
                hash: payload.content_hash,
                timestamp: new Date(),
              },
            });
            eventSource.close();
            options?.onComplete?.();
            break;
          }
        }
      } catch (err) {
        console.error("Error parsing SSE event:", err);
      }
    };

    eventSource.onerror = () => {
      dispatch({ type: "ATS_ANALYSIS_ERROR", payload: "Connection failed" });
      eventSource.close();
      options?.onError?.("Connection failed");
    };
  }, [state.tailoredResume?.resume_id, state.tailoredResume?.job_id, state.tailoredResume?.job_listing_id, dispatch, options]);

  const cancel = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  // Cleanup EventSource on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  return {
    analyze,
    cancel,
    isAnalyzing: state.atsIsAnalyzing,
    currentStage: state.atsCurrentStage,
    progress: state.atsOverallProgress,
  };
}
