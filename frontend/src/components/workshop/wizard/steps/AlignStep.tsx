"use client";

import { useMemo } from "react";
import { useWorkshop } from "../../WorkshopContext";
import { WizardNavigation } from "../WizardNavigation";
import type { AlignStepProps } from "../types";
import { SECTION_OPTIONS } from "../types";

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
        strokeWidth={3}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

export function AlignStep({
  selectedSections,
  onToggle,
  onBack,
  onApply,
}: AlignStepProps) {
  const { state } = useWorkshop();
  const currentScore = state.matchScore;

  // Calculate projected improvement based on selected sections
  const projectedImprovement = useMemo(() => {
    return SECTION_OPTIONS.filter((opt) =>
      selectedSections.includes(opt.id)
    ).reduce((sum, opt) => sum + opt.projectedImprovement, 0);
  }, [selectedSections]);

  const projectedScore = Math.min(100, currentScore + projectedImprovement);

  return (
    <div className="space-y-6">
      {/* Intro Text */}
      <div className="text-center">
        <h3 className="text-xl font-semibold text-foreground">
          Choose Sections to Enhance
        </h3>
        <p className="mt-2 text-muted-foreground">
          Select the sections you'd like AI to improve for this job
        </p>
      </div>

      {/* Section Selection */}
      <div className="space-y-3">
        {SECTION_OPTIONS.map((section) => {
          const isSelected = selectedSections.includes(section.id);

          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onToggle(section.id)}
              className={`w-full flex items-center justify-between p-4 rounded-lg border-2 text-left transition-colors ${
                isSelected
                  ? "border-blue-500 bg-blue-50"
                  : "border-border hover:border-input"
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Checkbox */}
                <div
                  className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                    isSelected ? "bg-blue-600" : "border-2 border-input"
                  }`}
                >
                  {isSelected && <CheckIcon className="w-3 h-3 text-white" />}
                </div>

                {/* Section Info */}
                <div>
                  <div className="font-medium text-foreground flex items-center gap-2">
                    {section.name}
                    {section.isRecommended && (
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                        Recommended
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {section.description}
                  </div>
                </div>
              </div>

              {/* Score Impact */}
              <div
                className={`text-sm font-medium flex-shrink-0 ${
                  isSelected ? "text-green-600" : "text-muted-foreground/60"
                }`}
              >
                +{section.projectedImprovement} pts
              </div>
            </button>
          );
        })}
      </div>

      {/* Projected Score */}
      <div className="bg-muted rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground/80">
            Projected Score
          </span>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-foreground">
              {projectedScore}%
            </span>
            {projectedImprovement > 0 && (
              <span className="text-sm text-green-600 font-medium">
                (+{projectedImprovement})
              </span>
            )}
          </div>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden relative">
          {/* Current score (darker) */}
          <div
            className="absolute inset-y-0 left-0 bg-blue-600 rounded-l-full"
            style={{ width: `${currentScore}%` }}
          />
          {/* Projected gain (lighter) */}
          {projectedImprovement > 0 && (
            <div
              className="absolute inset-y-0 bg-blue-300 rounded-r-full"
              style={{
                left: `${currentScore}%`,
                width: `${projectedImprovement}%`,
              }}
            />
          )}
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>Current: {currentScore}%</span>
          <span>Target: {projectedScore}%</span>
        </div>
      </div>

      {/* Navigation */}
      <WizardNavigation
        onBack={onBack}
        onNext={onApply}
        nextLabel="Apply & Continue"
        nextDisabled={selectedSections.length === 0}
      />
    </div>
  );
}
