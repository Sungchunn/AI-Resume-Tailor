"use client";

import type { WizardProgressProps, WizardStep } from "./types";
import { STEP_CONFIG, STEPS } from "./types";

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

export function WizardProgress({
  currentStep,
  completedSteps,
}: WizardProgressProps) {
  return (
    <nav aria-label="Progress" className="flex items-center justify-center py-6">
      <ol className="flex items-center">
        {STEPS.map((step, index) => {
          const config = STEP_CONFIG[step];
          const isCompleted = completedSteps.includes(step);
          const isCurrent = step === currentStep;
          const currentIndex = STEPS.indexOf(currentStep);
          const isPast = index < currentIndex;

          return (
            <li key={step} className="flex items-center">
              {/* Step Circle */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    isCompleted || isCurrent
                      ? "bg-blue-600 text-white"
                      : isPast
                        ? "bg-blue-100 text-blue-600"
                        : "bg-gray-200 text-gray-500"
                  }`}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {isCompleted ? (
                    <CheckIcon className="w-5 h-5" />
                  ) : (
                    config.number
                  )}
                </div>
                <span
                  className={`mt-2 text-xs font-medium ${
                    isCurrent ? "text-blue-600" : "text-gray-500"
                  }`}
                >
                  {config.label}
                </span>
              </div>

              {/* Connector Line */}
              {index < STEPS.length - 1 && (
                <div
                  className={`w-16 h-0.5 mx-2 ${
                    isPast || isCompleted ? "bg-blue-600" : "bg-gray-200"
                  }`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
