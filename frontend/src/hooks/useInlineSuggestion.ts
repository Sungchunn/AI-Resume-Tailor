/**
 * useInlineSuggestion - Debounced AI suggestion fetching for bullet points
 *
 * Fetches AI suggestions for a focused bullet point with a 300ms debounce
 * to prevent API spam during fast navigation.
 */

import { useState, useEffect, useRef, useCallback } from "react";

export interface EntryContext {
  title: string;
  company: string;
  dateRange: string;
}

export interface BulletSuggestion {
  original: string;
  suggested: string;
  reason: string;
  impact: "high" | "medium" | "low";
}

interface UseInlineSuggestionOptions {
  bulletText: string | null;
  entryContext: EntryContext | null;
  jobDescription: string | null;
  resumeBuildId: string | null;
  enabled: boolean;
  debounceMs?: number;
}

interface UseInlineSuggestionReturn {
  suggestion: BulletSuggestion | null;
  isLoading: boolean;
  error: string | null;
  clearSuggestion: () => void;
  refetch: () => void;
}

export function useInlineSuggestion({
  bulletText,
  entryContext,
  jobDescription,
  resumeBuildId,
  enabled,
  debounceMs = 300,
}: UseInlineSuggestionOptions): UseInlineSuggestionReturn {
  const [suggestion, setSuggestion] = useState<BulletSuggestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const fetchIdRef = useRef(0);

  const clearSuggestion = useCallback(() => {
    setSuggestion(null);
    setError(null);
  }, []);

  const fetchSuggestion = useCallback(async () => {
    if (!bulletText || !entryContext || !jobDescription || !resumeBuildId) {
      return;
    }

    // Abort any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Track this fetch to handle race conditions
    const currentFetchId = ++fetchIdRef.current;
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/resume-builds/${resumeBuildId}/suggest-bullet`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            bullet_text: bulletText,
            entry_context: {
              title: entryContext.title,
              company: entryContext.company,
              date_range: entryContext.dateRange,
            },
            job_description: jobDescription,
          }),
          signal: abortControllerRef.current.signal,
        }
      );

      // Only process if this is still the latest request
      if (currentFetchId !== fetchIdRef.current) {
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to fetch suggestion");
      }

      const data = await response.json();
      setSuggestion({
        original: data.original,
        suggested: data.suggested,
        reason: data.reason,
        impact: data.impact,
      });
    } catch (err) {
      // Only set error if this is still the latest request and not aborted
      if (currentFetchId !== fetchIdRef.current) {
        return;
      }

      if (err instanceof Error) {
        if (err.name === "AbortError") {
          // Request was aborted, don't set error
          return;
        }
        setError(err.message);
      } else {
        setError("Failed to fetch suggestion");
      }
    } finally {
      // Only update loading state if this is still the latest request
      if (currentFetchId === fetchIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [bulletText, entryContext, jobDescription, resumeBuildId]);

  // Debounced fetch effect
  useEffect(() => {
    // Clear suggestion when disabled or no bullet text
    if (!enabled || !bulletText) {
      setSuggestion(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    // Skip fetch if missing required context
    if (!entryContext || !jobDescription || !resumeBuildId) {
      return;
    }

    // Skip very short bullet text
    if (bulletText.trim().length < 10) {
      setSuggestion(null);
      return;
    }

    setIsLoading(true);

    const timer = setTimeout(() => {
      fetchSuggestion();
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      // Abort any in-flight request when unmounting or dependencies change
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [bulletText, entryContext, jobDescription, resumeBuildId, enabled, debounceMs, fetchSuggestion]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    suggestion,
    isLoading,
    error,
    clearSuggestion,
    refetch: fetchSuggestion,
  };
}
