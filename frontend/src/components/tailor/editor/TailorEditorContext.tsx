"use client";

import { createContext, useContext, type ReactNode } from "react";

// ============================================================================
// Type Definitions
// ============================================================================

export interface KeywordGapItem {
  keyword: string;
  importance: "required" | "strongly_preferred" | "preferred" | "nice_to_have";
  inVault: boolean;
  suggestion?: string;
}

export interface ContentQualityHints {
  bulletsNeedingMetrics: string[];
  bulletsWithWeakVerbs: string[];
  quantificationScore: number;
  actionVerbScore: number;
  achievementRatio: number;
}

export interface ATSContext {
  keywordGaps: KeywordGapItem[];
  contentQualityHints: ContentQualityHints;
  analysisComplete: boolean;
  compositeScore: number | null;
}

export interface TailorEditorContextValue {
  // Feature flag - always true in tailor editor
  aiAssistantEnabled: boolean;

  // Job reference (one will be set based on tailored resume source)
  jobId: number | null;
  jobListingId: number | null;

  // Fetched job data (resolved from jobId or jobListingId)
  jobDescription: string | null;
  jobTitle: string | null;
  companyName: string | null;

  // ATS data from atsProgressStore (when analysis complete)
  atsContext: ATSContext | null;
}

// ============================================================================
// Context
// ============================================================================

const TailorEditorContext = createContext<TailorEditorContextValue | null>(
  null
);

// ============================================================================
// Provider
// ============================================================================

interface TailorEditorProviderProps {
  value: TailorEditorContextValue;
  children: ReactNode;
}

export function TailorEditorProvider({
  value,
  children,
}: TailorEditorProviderProps) {
  return (
    <TailorEditorContext.Provider value={value}>
      {children}
    </TailorEditorContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Access the tailor editor context.
 * Must be used within a TailorEditorProvider.
 */
export function useTailorEditorContext(): TailorEditorContextValue {
  const context = useContext(TailorEditorContext);
  if (!context) {
    throw new Error(
      "useTailorEditorContext must be used within TailorEditorProvider"
    );
  }
  return context;
}

/**
 * Safe version that returns null when outside tailor editor.
 * Use this in shared components that need to work in both contexts.
 */
export function useTailorEditorContextSafe(): TailorEditorContextValue | null {
  return useContext(TailorEditorContext);
}

/**
 * Convenience hook for checking ATS readiness.
 * Returns isReady: false and score: null when outside tailor editor context.
 */
export function useATSReadiness(): { isReady: boolean; score: number | null } {
  const context = useContext(TailorEditorContext);
  return {
    isReady: context?.atsContext?.analysisComplete ?? false,
    score: context?.atsContext?.compositeScore ?? null,
  };
}
