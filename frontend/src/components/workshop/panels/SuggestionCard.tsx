"use client";

import { useState } from "react";
import type { Suggestion } from "@/lib/api/types";
import { ChevronDownIcon } from "@/components/icons/JobIcons";

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

interface SuggestionCardProps {
  suggestion: Suggestion;
  onAccept: () => void;
  onReject: () => void;
  defaultExpanded?: boolean;
}

export function SuggestionCard({
  suggestion,
  onAccept,
  onReject,
  defaultExpanded = false,
}: SuggestionCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-all ${
        isExpanded ? "border-primary-300 shadow-sm" : "border-gray-200"
      }`}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-xs rounded bg-gray-200 text-gray-700 font-medium">
            {SECTION_LABELS[suggestion.section] || suggestion.section}
          </span>
          <span
            className={`px-2 py-0.5 text-xs rounded border ${
              IMPACT_COLORS[suggestion.impact as keyof typeof IMPACT_COLORS] ||
              IMPACT_COLORS.low
            }`}
          >
            {suggestion.impact}
          </span>
        </div>
        <ChevronDownIcon
          className={`w-4 h-4 text-gray-500 transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="p-3 space-y-3">
          {suggestion.original && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">
                Original
              </div>
              <p className="text-sm text-gray-600 bg-red-50 p-2 rounded border border-red-100 line-through">
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
            <div className="text-xs font-medium text-gray-500 mb-1">Reason</div>
            <p className="text-sm text-gray-600">{suggestion.reason}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={onAccept}
              className="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
            >
              Accept
            </button>
            <button
              onClick={onReject}
              className="flex-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
