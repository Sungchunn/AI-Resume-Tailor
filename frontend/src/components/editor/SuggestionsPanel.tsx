"use client";

import { useState } from "react";
import type { Suggestion, TailoredContent } from "@/lib/api/types";

interface SuggestionsPanelProps {
  suggestions: Suggestion[];
  content: TailoredContent;
  onAccept: (suggestion: Suggestion) => void;
  onReject: (index: number) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}

const IMPACT_COLORS = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-gray-100 text-gray-700 border-gray-200",
};

const SECTION_LABELS: Record<string, string> = {
  summary: "Summary",
  experience: "Experience",
  skills: "Skills",
  education: "Education",
  highlights: "Highlights",
};

export function SuggestionsPanel({
  suggestions,
  content,
  onAccept,
  onReject,
  onAcceptAll,
  onRejectAll,
}: SuggestionsPanelProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const filteredSuggestions = suggestions.filter((s) => {
    if (filter === "all") return true;
    if (filter === "high") return s.impact === "high";
    if (filter === "medium") return s.impact === "medium";
    return s.section === filter;
  });

  const highImpactCount = suggestions.filter((s) => s.impact === "high").length;
  const mediumImpactCount = suggestions.filter((s) => s.impact === "medium").length;

  if (suggestions.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4">
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
            All suggestions applied
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            No pending suggestions remaining.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">
            AI Suggestions ({suggestions.length})
          </h3>
          <div className="flex gap-2">
            <button
              onClick={onAcceptAll}
              className="text-xs text-green-600 hover:text-green-700 font-medium"
            >
              Accept All
            </button>
            <button
              onClick={onRejectAll}
              className="text-xs text-red-600 hover:text-red-700 font-medium"
            >
              Reject All
            </button>
          </div>
        </div>

        {/* Impact summary */}
        <div className="flex gap-2 mb-3">
          <span className="inline-flex items-center px-2 py-1 text-xs rounded bg-red-50 text-red-700">
            {highImpactCount} High
          </span>
          <span className="inline-flex items-center px-2 py-1 text-xs rounded bg-yellow-50 text-yellow-700">
            {mediumImpactCount} Medium
          </span>
        </div>

        {/* Filter */}
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="all">All Suggestions</option>
          <option value="high">High Impact</option>
          <option value="medium">Medium Impact</option>
          <optgroup label="By Section">
            <option value="summary">Summary</option>
            <option value="experience">Experience</option>
            <option value="skills">Skills</option>
          </optgroup>
        </select>
      </div>

      {/* Suggestions list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredSuggestions.map((suggestion, index) => {
          const originalIndex = suggestions.indexOf(suggestion);
          const isExpanded = expandedIndex === originalIndex;

          return (
            <div
              key={originalIndex}
              className={`border rounded-lg overflow-hidden transition-all ${
                isExpanded ? "border-primary-300 shadow-sm" : "border-gray-200"
              }`}
            >
              {/* Header */}
              <button
                onClick={() =>
                  setExpandedIndex(isExpanded ? null : originalIndex)
                }
                className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-xs rounded bg-gray-200 text-gray-700 font-medium">
                    {SECTION_LABELS[suggestion.section] || suggestion.section}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-xs rounded border ${
                      IMPACT_COLORS[
                        suggestion.impact as keyof typeof IMPACT_COLORS
                      ] || IMPACT_COLORS.low
                    }`}
                  >
                    {suggestion.impact}
                  </span>
                </div>
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="p-3 space-y-3">
                  {suggestion.original && (
                    <div>
                      <div className="text-xs font-medium text-gray-500 mb-1">
                        Original
                      </div>
                      <p className="text-sm text-gray-600 bg-red-50 p-2 rounded border border-red-100">
                        {suggestion.original}
                      </p>
                    </div>
                  )}

                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-1">
                      Suggested
                    </div>
                    <p className="text-sm text-gray-900 bg-green-50 p-2 rounded border border-green-100">
                      {suggestion.suggested}
                    </p>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-1">
                      Reason
                    </div>
                    <p className="text-sm text-gray-600">{suggestion.reason}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => onAccept(suggestion)}
                      className="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => onReject(originalIndex)}
                      className="flex-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
