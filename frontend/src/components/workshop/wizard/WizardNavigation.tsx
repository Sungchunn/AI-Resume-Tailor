"use client";

import type { WizardNavigationProps } from "./types";

export function WizardNavigation({
  onBack,
  onNext,
  onSkip,
  nextLabel = "Continue",
  backLabel = "Back",
  showBack = true,
  showSkip = false,
  nextDisabled = false,
}: WizardNavigationProps) {
  return (
    <div className="flex items-center justify-between pt-6">
      <div>
        {showBack && onBack && (
          <button
            onClick={onBack}
            className="px-4 py-2 text-muted-foreground font-medium hover:text-foreground transition-colors"
          >
            {backLabel}
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        {showSkip && onSkip && (
          <button
            onClick={onSkip}
            className="px-4 py-2 text-muted-foreground text-sm hover:text-foreground/80 transition-colors"
          >
            Skip
          </button>
        )}
        <button
          onClick={onNext}
          disabled={nextDisabled}
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
