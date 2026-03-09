"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useDebouncedCallback } from "use-debounce";
import type { TailoredContent } from "@/lib/api/types";
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
  enabled = true,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseScoreCalculationOptions): UseScoreCalculationResult {
  const [score, setScore] = useState<number>(0);
  const [previousScore, setPreviousScore] = useState<number | null>(null);
  const [status, setStatus] = useState<ScoreCalculationStatus>({ state: "idle" });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Track content hash to detect changes
  const contentHashRef = useRef<string>("");
  const initialLoadRef = useRef(true);
  const currentScoreRef = useRef<number>(0);

  // Use the existing quick match mutation
  const quickMatchMutation = useQuickMatch();

  // Keep currentScoreRef in sync with score state
  useEffect(() => {
    currentScoreRef.current = score;
  }, [score]);

  const calculateScore = useCallback(async () => {
    if ((!jobId && !jobListingId) || !enabled || !resumeId) return;

    setStatus({ state: "calculating" });

    try {
      const request = jobListingId
        ? { resume_id: resumeId, job_listing_id: jobListingId }
        : { resume_id: resumeId, job_id: jobId! };

      const response = await quickMatchMutation.mutateAsync(request);

      const newScore = response.match_score;

      // Track previous score for comparison (not on initial load)
      if (!initialLoadRef.current) {
        setPreviousScore(currentScoreRef.current);
      }
      initialLoadRef.current = false;

      setScore(newScore);
      setStatus({ state: "success", score: newScore });
      setLastUpdated(new Date());
    } catch (error) {
      setStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Failed to calculate score",
      });
    }
  }, [resumeId, jobId, jobListingId, enabled, quickMatchMutation]);

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
  };
}
