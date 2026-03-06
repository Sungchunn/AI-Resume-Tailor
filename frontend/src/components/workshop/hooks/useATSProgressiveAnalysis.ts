"use client";

import { useCallback, useRef } from "react";
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

interface SSECacheHitEvent {
  composite_score: ATSCompositeScore;
  stage_results: Record<string, ATSStageResult>;
  knockout_risks?: KnockoutRisk[];
  cached_at: string;
  content_hash: string;
}

interface SSECompleteEvent {
  composite_score: ATSCompositeScore;
  knockout_risks?: KnockoutRisk[];
  content_hash: string;
}

export function useATSProgressiveAnalysis(options?: UseATSProgressiveAnalysisOptions) {
  const { state, dispatch } = useWorkshop();
  const eventSourceRef = useRef<EventSource | null>(null);

  const analyze = useCallback(async () => {
    if (!state.tailoredId || !state.tailoredResume?.job_id) {
      console.error("Missing resume or job ID for ATS analysis");
      return;
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    dispatch({ type: "ATS_ANALYSIS_START" });

    const url = new URL("/api/v1/ats/analyze-progressive", window.location.origin);
    url.searchParams.set("resume_id", state.tailoredId);
    url.searchParams.set("job_id", state.tailoredResume.job_id.toString());

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
                knockouts: payload.knockout_risks ?? [],
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
                knockouts: payload.knockout_risks ?? [],
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
  }, [state.tailoredId, state.tailoredResume?.job_id, dispatch, options]);

  const cancel = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  return {
    analyze,
    cancel,
    isAnalyzing: state.atsIsAnalyzing,
    currentStage: state.atsCurrentStage,
    progress: state.atsOverallProgress,
  };
}
