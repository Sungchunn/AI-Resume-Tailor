"use client";

import { useCallback, useState, useMemo } from "react";
import { useWorkshop } from "../WorkshopContext";
import { SuggestionCard } from "./SuggestionCard";
import { ChangeSummary } from "./ChangeSummary";
import { AIPromptInput } from "./AIPromptInput";
import { BulkActions } from "./BulkActions";
import { ScoreSummary } from "../ScoreSummary";
import type { Suggestion } from "@/lib/api/types";

const SECTION_ORDER = ["summary", "experience", "skills", "education", "highlights"];

const SECTION_LABELS: Record<string, string> = {
  summary: "Summary",
  experience: "Experience",
  skills: "Skills",
  education: "Education",
  highlights: "Highlights",
};

export function AIRewritePanel() {
  const { state, acceptSuggestion, rejectSuggestion, generateAISuggestions } = useWorkshop();
  const [filter, setFilter] = useState<string>("all");
  const [isGenerating, setIsGenerating] = useState(false);

  // Filter suggestions
  const filteredSuggestions = useMemo(() => {
    return state.suggestions.filter((s) => {
      if (filter === "all") return true;
      if (filter === "high" || filter === "medium" || filter === "low") {
        return s.impact === filter;
      }
      return s.section === filter;
    });
  }, [state.suggestions, filter]);

  // Group suggestions by section
  const groupedSuggestions = useMemo(() => {
    const groups: Record<string, Suggestion[]> = {};

    for (const section of SECTION_ORDER) {
      const sectionSuggestions = filteredSuggestions.filter((s) => s.section === section);
      if (sectionSuggestions.length > 0) {
        groups[section] = sectionSuggestions;
      }
    }

    // Add any remaining sections not in our order
    for (const suggestion of filteredSuggestions) {
      if (!SECTION_ORDER.includes(suggestion.section)) {
        if (!groups[suggestion.section]) {
          groups[suggestion.section] = [];
        }
        if (!groups[suggestion.section].includes(suggestion)) {
          groups[suggestion.section].push(suggestion);
        }
      }
    }

    return groups;
  }, [filteredSuggestions]);

  // Handlers
  const handleAccept = useCallback(
    (suggestion: Suggestion) => {
      const index = state.suggestions.indexOf(suggestion);
      if (index !== -1) {
        acceptSuggestion(index, suggestion);
      }
    },
    [state.suggestions, acceptSuggestion]
  );

  const handleReject = useCallback(
    (suggestion: Suggestion) => {
      const index = state.suggestions.indexOf(suggestion);
      if (index !== -1) {
        rejectSuggestion(index);
      }
    },
    [state.suggestions, rejectSuggestion]
  );

  const handleAcceptAll = useCallback(() => {
    [...state.suggestions].reverse().forEach((suggestion, reverseIndex) => {
      const originalIndex = state.suggestions.length - 1 - reverseIndex;
      acceptSuggestion(originalIndex, suggestion);
    });
  }, [state.suggestions, acceptSuggestion]);

  const handleRejectAll = useCallback(() => {
    for (let i = state.suggestions.length - 1; i >= 0; i--) {
      rejectSuggestion(i);
    }
  }, [state.suggestions.length, rejectSuggestion]);

  const handleAIPrompt = useCallback(
    async (prompt: string) => {
      setIsGenerating(true);
      try {
        await generateAISuggestions(prompt);
      } finally {
        setIsGenerating(false);
      }
    },
    [generateAISuggestions]
  );

  // Show score summary if we have match data
  const tailored = state.tailoredResume;
  const showScoreSummary = tailored && tailored.match_score > 0;

  // Track accepted suggestions (from original count minus current)
  const originalSuggestionCount = tailored?.suggestions?.length ?? 0;
  const acceptedCount = Math.max(0, originalSuggestionCount - state.suggestions.length);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Score Summary */}
      {showScoreSummary && (
        <div className="flex-shrink-0 p-4 border-b border-gray-200">
          <ScoreSummary
            matchScore={tailored.match_score}
            skillMatches={tailored.skill_matches || []}
            skillGaps={tailored.skill_gaps || []}
            keywordCoverage={tailored.keyword_coverage || 0}
          />
        </div>
      )}

      {/* Change Summary */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200">
        <ChangeSummary
          suggestions={state.suggestions}
          acceptedCount={acceptedCount}
          totalOriginal={originalSuggestionCount}
        />
      </div>

      {/* Filter & Bulk Actions */}
      {state.suggestions.length > 0 && (
        <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 space-y-2">
          {/* Filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="all">All Suggestions ({state.suggestions.length})</option>
            <optgroup label="By Impact">
              <option value="high">
                High Impact ({state.suggestions.filter((s) => s.impact === "high").length})
              </option>
              <option value="medium">
                Medium Impact ({state.suggestions.filter((s) => s.impact === "medium").length})
              </option>
              <option value="low">
                Low Impact ({state.suggestions.filter((s) => s.impact === "low").length})
              </option>
            </optgroup>
            <optgroup label="By Section">
              {SECTION_ORDER.filter((section) =>
                state.suggestions.some((s) => s.section === section)
              ).map((section) => (
                <option key={section} value={section}>
                  {SECTION_LABELS[section]} (
                  {state.suggestions.filter((s) => s.section === section).length})
                </option>
              ))}
            </optgroup>
          </select>

          {/* Bulk Actions */}
          <BulkActions
            suggestionCount={filteredSuggestions.length}
            onAcceptAll={handleAcceptAll}
            onRejectAll={handleRejectAll}
          />
        </div>
      )}

      {/* Suggestions List - Grouped by Section */}
      <div className="flex-1 overflow-y-auto p-4">
        {state.suggestions.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                {acceptedCount > 0 ? "All suggestions applied!" : "No suggestions yet"}
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                {acceptedCount > 0
                  ? "Use the AI prompt below to generate more suggestions."
                  : "Use the AI prompt below to get started."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedSuggestions).map(([section, suggestions]) => (
              <div key={section} className="space-y-3">
                {/* Section Header */}
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-gray-700">
                    {SECTION_LABELS[section] || section}
                  </h4>
                  <span className="text-xs text-gray-400">
                    ({suggestions.length})
                  </span>
                </div>

                {/* Section Suggestions */}
                <div className="space-y-2">
                  {suggestions.map((suggestion, idx) => (
                    <SuggestionCard
                      key={`${section}-${idx}`}
                      suggestion={suggestion}
                      onAccept={() => handleAccept(suggestion)}
                      onReject={() => handleReject(suggestion)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Prompt Input */}
      <AIPromptInput onSubmit={handleAIPrompt} isLoading={isGenerating} />
    </div>
  );
}
