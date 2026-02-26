"use client";

import { useWorkshop } from "../../WorkshopContext";
import { WizardNavigation } from "../WizardNavigation";
import type { ReviewStepProps, ChangeSummary } from "../types";

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

export function ReviewStep({
  onBack,
  onOpenWorkshop,
  onExport,
}: ReviewStepProps) {
  const { state } = useWorkshop();
  const finalScore = state.matchScore;
  const suggestions = state.suggestions;

  // Build changes summary from suggestions
  const changesSummary: ChangeSummary[] = [];

  const summaryChanges = suggestions.filter((s) => s.section === "summary");
  if (summaryChanges.length > 0) {
    changesSummary.push({ section: "Summary", changeType: "rewritten" });
  }

  const experienceChanges = suggestions.filter(
    (s) => s.section === "experience"
  );
  if (experienceChanges.length > 0) {
    changesSummary.push({
      section: "Experience",
      changeType: "enhanced",
      count: experienceChanges.length,
    });
  }

  const skillsChanges = suggestions.filter((s) => s.section === "skills");
  if (skillsChanges.length > 0) {
    changesSummary.push({
      section: "Skills",
      changeType: "added",
      count: skillsChanges.length,
    });
  }

  const highlightsChanges = suggestions.filter(
    (s) => s.section === "highlights"
  );
  if (highlightsChanges.length > 0) {
    changesSummary.push({
      section: "Highlights",
      changeType: "added",
      count: highlightsChanges.length,
    });
  }

  // If no suggestions yet, show default message
  const hasChanges = changesSummary.length > 0;

  return (
    <div className="space-y-6">
      {/* Intro Text */}
      <div className="text-center">
        <h3 className="text-xl font-semibold text-foreground">
          Your Tailored Resume is Ready
        </h3>
        <p className="mt-2 text-muted-foreground">
          Review your changes and export when you're satisfied
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Mini Preview Placeholder */}
        <div className="border rounded-lg p-4 bg-card">
          <h4 className="font-medium text-foreground mb-3">Preview</h4>
          <div className="bg-muted rounded border aspect-[8.5/11] flex items-center justify-center text-muted-foreground/60 text-sm p-4">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-3 bg-muted rounded-lg flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-muted-foreground/60"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <p>Your tailored resume</p>
              <p className="text-xs mt-1">Ready for export</p>
            </div>
          </div>
        </div>

        {/* Changes Summary */}
        <div className="space-y-4">
          <div className="border rounded-lg p-4">
            <h4 className="font-medium text-foreground mb-3">
              {hasChanges ? "Suggestions Ready" : "Next Steps"}
            </h4>
            {hasChanges ? (
              <ul className="space-y-2">
                {changesSummary.map((change, index) => (
                  <li
                    key={index}
                    className="flex items-center text-sm text-foreground/80"
                  >
                    <CheckIcon className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                    <span>
                      {change.section}{" "}
                      {change.changeType === "rewritten" && "suggestions ready"}
                      {change.changeType === "enhanced" &&
                        `(${change.count} bullet suggestions)`}
                      {change.changeType === "added" &&
                        `(${change.count} suggestions)`}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Open the workshop to generate AI suggestions and fine-tune your
                resume content.
              </p>
            )}
          </div>

          {/* Final Score */}
          <div
            className={`border rounded-lg p-4 ${
              finalScore >= 80
                ? "bg-green-50 border-green-200"
                : finalScore >= 60
                  ? "bg-yellow-50 border-yellow-200"
                  : "bg-muted border-gray-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-sm font-medium ${
                  finalScore >= 80
                    ? "text-green-800"
                    : finalScore >= 60
                      ? "text-yellow-800"
                      : "text-foreground/80"
                }`}
              >
                Current Match Score
              </span>
              <span
                className={`text-2xl font-bold ${
                  finalScore >= 80
                    ? "text-green-600"
                    : finalScore >= 60
                      ? "text-yellow-600"
                      : "text-muted-foreground"
                }`}
              >
                {finalScore}%
              </span>
            </div>
          </div>

          {/* Tip */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            <strong>Tip:</strong> Open the full workshop to review AI
            suggestions, make manual edits, or adjust styling before exporting.
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-6">
        <button
          onClick={onBack}
          className="px-4 py-2 text-muted-foreground font-medium hover:text-foreground transition-colors"
        >
          Back
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenWorkshop}
            className="px-4 py-2 border border-gray-300 text-foreground/80 font-medium rounded-lg hover:bg-muted transition-colors"
          >
            Open Workshop
          </button>
          <button
            onClick={onExport}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Export PDF
          </button>
        </div>
      </div>
    </div>
  );
}
