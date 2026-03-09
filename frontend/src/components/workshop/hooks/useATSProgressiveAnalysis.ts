"use client";

import { useCallback, useEffect, useRef } from "react";
import { tokenManager } from "@/lib/api/client";
import { useWorkshop, type ATSCompositeScore, type KnockoutRisk, type ATSStageResult } from "../WorkshopContext";

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

    // Add auth token as query param (EventSource doesn't support headers)
    const accessToken = tokenManager.getAccessToken();
    if (accessToken) {
      url.searchParams.set("token", accessToken);
    }

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
