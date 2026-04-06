"use client";

import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

import { useBulletAnalysis } from "@/hooks/useBulletAnalysis";
import { useATSReadiness } from "@/components/tailor/editor/TailorEditorContext";
import { BulletSuggestionCard } from "./BulletSuggestionCard";

// ============================================================================
// Types
// ============================================================================

interface BulletSuggestionsPanelProps {
  tailoredResumeId: string;
}

// ============================================================================
// Skeleton Component
// ============================================================================

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

// ============================================================================
// Component
// ============================================================================

export function BulletSuggestionsPanel({
  tailoredResumeId,
}: BulletSuggestionsPanelProps) {
  const { isReady: atsReady } = useATSReadiness();

  const {
    pendingSuggestions,
    suggestionsByEntry,
    isAnalyzing,
    error,
    lastAnalyzedAt,
    hasAnySuggestions,
    analyze,
    acceptSuggestion,
    rejectSuggestion,
    acceptAll,
    rejectAll,
  } = useBulletAnalysis({ tailoredResumeId });

  // State 1: ATS Required
  if (!atsReady) {
    return (
      <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm font-medium">ATS Analysis Required</p>
            <p className="text-sm text-muted-foreground">
              Run ATS analysis first to enable AI bullet suggestions.
            </p>
            <button
              type="button"
              onClick={() => {
                // Switch to ATS tab
                const atsTab = document.querySelector(
                  '[data-tab="ats"]'
                ) as HTMLElement;
                atsTab?.click();
              }}
              className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors"
            >
              Go to ATS Tab
            </button>
          </div>
        </div>
      </div>
    );
  }

  // State 2: Ready (no analysis run yet)
  if (!lastAnalyzedAt && !isAnalyzing) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-500" />
          <span className="font-medium">AI Bullet Suggestions</span>
        </div>
        <p className="text-sm text-muted-foreground">
          AI will analyze your bullet points and suggest improvements based on
          the job requirements and ATS analysis.
        </p>
        <button
          type="button"
          onClick={analyze}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          <Sparkles className="h-4 w-4" />
          Analyze Bullets
        </button>
      </div>
    );
  }

  // State 3: Analyzing
  if (isAnalyzing) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          <span className="font-medium">Analyzing bullets...</span>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  // State 4: Error
  if (error) {
    return (
      <div className="rounded-lg border border-red-500/50 bg-card p-6 space-y-4">
        <div className="flex items-center gap-2 text-red-500">
          <AlertTriangle className="h-5 w-5" />
          <span className="font-medium">Analysis Failed</span>
        </div>
        <p className="text-sm text-muted-foreground">{error}</p>
        <button
          type="button"
          onClick={analyze}
          className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // State 5: No suggestions needed
  if (!hasAnySuggestions && lastAnalyzedAt) {
    return (
      <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-6 space-y-4">
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">Your bullets look great!</span>
        </div>
        <p className="text-sm text-muted-foreground">
          No improvements needed. Your bullets are well-optimized for this job.
        </p>
        <button
          type="button"
          onClick={analyze}
          className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors"
        >
          Analyze Again
        </button>
      </div>
    );
  }

  // State 6: Results
  // Convert Map to array for rendering
  const entriesArray = Array.from(suggestionsByEntry.entries());

  // Track if we've shown the first suggestion
  let firstSuggestionShown = false;

  return (
    <div className="space-y-4">
      {/* Header with summary and bulk actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-500" />
          <span className="font-medium">
            {pendingSuggestions.length} suggestion
            {pendingSuggestions.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={rejectAll}
            className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors"
          >
            Reject All
          </button>
          <button
            type="button"
            onClick={acceptAll}
            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Accept All
          </button>
        </div>
      </div>

      {/* Suggestions grouped by entry */}
      {entriesArray.map(([entryKey, entrySuggestions]) => (
        <div key={entryKey} className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {entrySuggestions[0]?.entryContext.title}
            {entrySuggestions[0]?.entryContext.company &&
              ` @ ${entrySuggestions[0]?.entryContext.company}`}
          </h4>
          {entrySuggestions.map((suggestion) => {
            const isFirst = !firstSuggestionShown;
            if (isFirst) firstSuggestionShown = true;

            return (
              <BulletSuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onAccept={() => acceptSuggestion(suggestion.id)}
                onReject={() => rejectSuggestion(suggestion.id)}
                isFirst={isFirst}
              />
            );
          })}
        </div>
      ))}

      {/* Analyze again button */}
      <button
        type="button"
        onClick={analyze}
        className="w-full px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
      >
        Analyze Again
      </button>
    </div>
  );
}
