"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useDebouncedCallback } from "use-debounce";
import type { TailoredContent, ATSKeywordDetailedResponse } from "@/lib/api/types";
import { atsApi } from "@/lib/api/client";
import { useQuickMatch } from "@/lib/api/hooks";
import type {
  UseScoreCalculationOptions,
  UseScoreCalculationResult,
  ScoreCalculationStatus,
} from "../ScoreDisplay/types";

const DEFAULT_DEBOUNCE_MS = 1500;

export function useScoreCalculation({
  content,
  resumeId,
  jobId,
  jobListingId,
  jobDescription,
  jobContent,
  enabled = true,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseScoreCalculationOptions): UseScoreCalculationResult {
  const [score, setScore] = useState<number>(0);
  const [previousScore, setPreviousScore] = useState<number | null>(null);
  const [status, setStatus] = useState<ScoreCalculationStatus>({ state: "idle" });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [keywordAnalysis, setKeywordAnalysis] = useState<ATSKeywordDetailedResponse | null>(null);

  // Track content hash to detect changes
  const contentHashRef = useRef<string>("");
  const initialLoadRef = useRef(true);
  const currentScoreRef = useRef<number>(0);

  // Fallback to quick match for when job description is not available
  const quickMatchMutation = useQuickMatch();

  // Keep currentScoreRef in sync with score state
  useEffect(() => {
    currentScoreRef.current = score;
  }, [score]);

  const calculateScore = useCallback(async () => {
    if ((!jobId && !jobListingId) || !enabled || !resumeId) return;

    setStatus({ state: "calculating" });

    try {
      let newScore: number;
      let newKeywordAnalysis: ATSKeywordDetailedResponse | null = null;

      // Use new content-based endpoint if job description is available
      // This enables live scoring of unsaved edits with consistent 5-stage scoring
      if (jobDescription) {
        const response = await atsApi.analyzeContent({
          resume_content: content,
          job_description: jobDescription,
          job_content: jobContent,
        });

        newScore = response.final_score;
        newKeywordAnalysis = response.keyword_analysis;
      } else {
        // Fallback to quick-match (fetches from DB, different scoring algorithm)
        const request = jobListingId
          ? { resume_id: resumeId, job_listing_id: jobListingId }
          : { resume_id: resumeId, job_id: jobId! };

        const response = await quickMatchMutation.mutateAsync(request);
        newScore = response.match_score;
      }

      // Track previous score for comparison (not on initial load)
      if (!initialLoadRef.current) {
        setPreviousScore(currentScoreRef.current);
      }
      initialLoadRef.current = false;

      setScore(newScore);
      setKeywordAnalysis(newKeywordAnalysis);
      setStatus({ state: "success", score: newScore });
      setLastUpdated(new Date());
    } catch (error) {
      setStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Failed to calculate score",
      });
    }
  }, [resumeId, jobId, jobListingId, jobDescription, jobContent, content, enabled, quickMatchMutation]);

  // Debounced calculation
  const debouncedCalculate = useDebouncedCallback(calculateScore, debounceMs);

  // Generate content hash for change detection
  const getContentHash = useCallback((c: TailoredContent): string => {
    return JSON.stringify({
      summary: c.summary,
      experience: (c.experience ?? []).map((e) => ({
        title: e.title,
        bullets: e.bullets,
      })),
      education: (c.education ?? []).map((e) => ({
        degree: e.degree,
        institution: e.institution,
      })),
      skills: c.skills,
      certifications: (c.certifications ?? []).map((c) => c.name),
      projects: (c.projects ?? []).map((p) => ({
        name: p.name,
        description: p.description,
      })),
    });
  }, []);

  // Watch for content changes
  useEffect(() => {
    if (!enabled || (!jobId && !jobListingId)) return;

    const newHash = getContentHash(content);

    if (newHash !== contentHashRef.current) {
      contentHashRef.current = newHash;

      // Skip debounce on initial load
      if (status.state === "idle" && initialLoadRef.current) {
        calculateScore();
      } else {
        setStatus({ state: "pending" });
        debouncedCalculate();
      }
    }
  }, [content, getContentHash, debouncedCalculate, calculateScore, status.state, enabled, jobId, jobListingId]);

  const triggerRecalculation = useCallback(() => {
    debouncedCalculate.cancel();
    calculateScore();
  }, [debouncedCalculate, calculateScore]);

  return {
    score,
    previousScore,
    status,
    isUpdating: status.state === "pending" || status.state === "calculating",
    lastUpdated,
    triggerRecalculation,
    keywordAnalysis,
  };
}
