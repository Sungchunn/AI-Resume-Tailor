"use client";

import type { DiffSuggestion, SuggestionImpact } from "@/lib/api/types";

interface DiffViewerProps {
  diffs: DiffSuggestion[];
  onAccept: (index: number) => void;
  onReject: (index: number) => void;
  isProcessing?: boolean;
}

const impactColors: Record<SuggestionImpact, { bg: string; text: string; border: string }> = {
  high: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  medium: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
  low: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
};

const impactLabels: Record<SuggestionImpact, string> = {
  high: "High Impact",
  medium: "Medium Impact",
  low: "Low Impact",
};

export function DiffViewer({ diffs, onAccept, onReject, isProcessing }: DiffViewerProps) {
  if (diffs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <svg
          className="mx-auto h-12 w-12 text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="mt-2">No pending suggestions</p>
        <p className="text-sm">Generate suggestions to get AI-powered recommendations</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900">
          {diffs.length} Pending Suggestion{diffs.length !== 1 ? "s" : ""}
        </h3>
      </div>

      <div className="space-y-3">
        {diffs.map((diff, index) => {
          const impact = impactColors[diff.impact];
          return (
            <div
              key={index}
              className={`p-4 rounded-lg border ${impact.border} ${impact.bg}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${impact.text} bg-white`}
                    >
                      {impactLabels[diff.impact]}
                    </span>
                    <span className="text-xs text-gray-500 font-mono">
                      {diff.operation}: {diff.path}
                    </span>
                  </div>

                  {diff.original_value && (
                    <div className="mb-2">
                      <p className="text-xs text-gray-500 mb-1">Original:</p>
                      <p className="text-sm text-gray-600 line-through bg-white/50 p-2 rounded">
                        {String(diff.original_value)}
                      </p>
                    </div>
                  )}

                  <div className="mb-2">
                    <p className="text-xs text-gray-500 mb-1">Suggested:</p>
                    <p className="text-sm text-gray-900 bg-white p-2 rounded">
                      {typeof diff.value === "string"
                        ? diff.value
                        : JSON.stringify(diff.value, null, 2)}
                    </p>
                  </div>

                  <p className="text-sm text-gray-600 mt-2">
                    <span className="font-medium">Why: </span>
                    {diff.reason}
                  </p>

                  {diff.source_block_id && (
                    <p className="text-xs text-gray-500 mt-1">
                      Source: Block #{diff.source_block_id}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => onAccept(index)}
                    disabled={isProcessing}
                    className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => onReject(index)}
                    disabled={isProcessing}
                    className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
