"use client";

import { useState } from "react";
import { ChevronDownIcon } from "@/components/icons/JobIcons";
import type { Suggestion } from "@/lib/api/types";

interface ChangeSummaryProps {
  suggestions: Suggestion[];
  acceptedCount: number;
  totalOriginal: number;
}

export function ChangeSummary({
  suggestions,
  acceptedCount,
  totalOriginal,
}: ChangeSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Group suggestions by impact
  const highImpact = suggestions.filter((s) => s.impact === "high");
  const mediumImpact = suggestions.filter((s) => s.impact === "medium");
  const lowImpact = suggestions.filter((s) => s.impact === "low");

  // Group by section for summary
  const bySectionCount = suggestions.reduce((acc, s) => {
    acc[s.section] = (acc[s.section] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const SECTION_LABELS: Record<string, string> = {
    summary: "Summary",
    experience: "Experience",
    skills: "Skills",
    education: "Education",
    highlights: "Highlights",
  };

  const hasChanges = acceptedCount > 0 || suggestions.length > 0;

  if (!hasChanges && totalOriginal === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
      {/* Collapsed Summary */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100">
            <svg
              className="w-4 h-4 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </div>
          <div>
            <div className="text-sm font-medium text-foreground">
              See What's Changed
            </div>
            <div className="text-xs text-muted-foreground">
              {acceptedCount > 0 && (
                <span className="text-green-600">
                  {acceptedCount} applied
                  {suggestions.length > 0 && " • "}
                </span>
              )}
              {suggestions.length > 0 && (
                <span>{suggestions.length} pending</span>
              )}
              {acceptedCount === 0 && suggestions.length === 0 && (
                <span>No AI changes yet</span>
              )}
            </div>
          </div>
        </div>
        <ChevronDownIcon
          className={`w-5 h-5 text-muted-foreground/60 transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3">
          <div className="border-t border-blue-100 pt-3" />

          {/* Impact Breakdown */}
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Pending Changes by Impact
              </div>
              <div className="flex gap-2">
                {highImpact.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-red-100 text-red-700">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    {highImpact.length} High
                  </span>
                )}
                {mediumImpact.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-700">
                    <span className="w-2 h-2 rounded-full bg-yellow-500" />
                    {mediumImpact.length} Medium
                  </span>
                )}
                {lowImpact.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-muted text-muted-foreground">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/60" />
                    {lowImpact.length} Low
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Section Breakdown */}
          {Object.keys(bySectionCount).length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Sections Affected
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(bySectionCount).map(([section, count]) => (
                  <span
                    key={section}
                    className="inline-flex items-center px-2 py-1 text-xs rounded bg-card border border-border text-foreground/80"
                  >
                    {SECTION_LABELS[section] || section}
                    <span className="ml-1 text-muted-foreground/60">({count})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Accepted Changes */}
          {acceptedCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>
                You've applied {acceptedCount} AI suggestion
                {acceptedCount !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
