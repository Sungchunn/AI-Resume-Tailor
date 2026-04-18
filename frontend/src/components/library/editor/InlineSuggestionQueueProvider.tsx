"use client";

import { createContext, useContext, type ReactNode } from "react";

import { useInlineSuggestionQueue } from "@/hooks/useInlineSuggestionQueue";
import { useATSProgressStore } from "@/lib/stores/atsProgressStore";

type InlineSuggestionQueueContextValue = ReturnType<typeof useInlineSuggestionQueue>;

const InlineSuggestionQueueContext =
  createContext<InlineSuggestionQueueContextValue | null>(null);

interface InlineSuggestionQueueProviderProps {
  children: ReactNode;
  tailoredResumeId?: string;
  resumeId?: string;
  jobId?: string | null;
  jobListingId?: number | null;
}

export function InlineSuggestionQueueProvider({
  children,
  tailoredResumeId,
  resumeId,
  jobId,
  jobListingId,
}: InlineSuggestionQueueProviderProps) {
  const atsData = useATSProgressStore((s) => s.keywordAnalysisResult);

  const queue = useInlineSuggestionQueue({
    tailoredResumeId,
    resumeId,
    jobId,
    jobListingId,
    atsData,
  });

  return (
    <InlineSuggestionQueueContext.Provider value={queue}>
      {children}
    </InlineSuggestionQueueContext.Provider>
  );
}

export function useInlineSuggestionQueueContext() {
  const ctx = useContext(InlineSuggestionQueueContext);
  if (!ctx) {
    throw new Error(
      "useInlineSuggestionQueueContext must be used inside <InlineSuggestionQueueProvider>"
    );
  }
  return ctx;
}
