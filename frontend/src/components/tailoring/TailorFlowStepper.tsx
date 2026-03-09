/**
 * TailorFlowStepper Component
 *
 * A horizontal 3-step progress indicator for the tailor flow wizard.
 * Shows the user's progress through: Select Resume → Analyze Match → Editor
 *
 * Features:
 * - Horizontal layout with circles connected by lines
 * - States: completed (blue + check), current (blue filled), future (gray)
 * - Responsive sizing
 */

"use client";

// ============================================================================
// Types
// ============================================================================

export type TailorFlowStep = "select" | "analyze" | "verify" | "editor";

interface TailorFlowStepConfig {
  step: TailorFlowStep;
  label: string;
  number: number;
}

interface TailorFlowStepperProps {
  /** The current active step */
  currentStep: TailorFlowStep;
  /** Steps that have been completed */
  completedSteps?: TailorFlowStep[];
  /** Optional className */
  className?: string;
}

// ============================================================================
// Configuration
// ============================================================================

const TAILOR_STEPS: TailorFlowStepConfig[] = [
  { step: "select", label: "Select Resume", number: 1 },
  { step: "analyze", label: "Analyze Match", number: 2 },
  { step: "verify", label: "Verify Sections", number: 3 },
  { step: "editor", label: "Editor", number: 4 },
];

// ============================================================================
// Helper Components
// ============================================================================

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

// ============================================================================
// Main Component
// ============================================================================

export function TailorFlowStepper({
  currentStep,
  completedSteps = [],
  className = "",
}: TailorFlowStepperProps) {
  const currentIndex = TAILOR_STEPS.findIndex((s) => s.step === currentStep);

  return (
    <nav
      aria-label="Tailor flow progress"
      className={`flex items-center justify-center py-4 ${className}`}
    >
      <ol className="flex items-center">
        {TAILOR_STEPS.map((stepConfig, index) => {
          const isCompleted = completedSteps.includes(stepConfig.step);
          const isCurrent = stepConfig.step === currentStep;
          const isPast = index < currentIndex;

          return (
            <li key={stepConfig.step} className="flex items-center">
              {/* Step Circle */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    isCompleted || isCurrent
                      ? "bg-primary text-primary-foreground"
                      : isPast
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {isCompleted ? (
                    <CheckIcon className="w-5 h-5" />
                  ) : (
                    stepConfig.number
                  )}
                </div>
                <span
                  className={`mt-2 text-xs font-medium whitespace-nowrap ${
                    isCurrent
                      ? "text-primary"
                      : isCompleted
                        ? "text-foreground"
                        : "text-muted-foreground"
                  }`}
                >
                  {stepConfig.label}
                </span>
              </div>

              {/* Connector Line */}
              {index < TAILOR_STEPS.length - 1 && (
                <div
                  className={`w-12 sm:w-16 h-0.5 mx-2 sm:mx-3 ${
                    isPast || isCompleted ? "bg-primary" : "bg-muted"
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

export default TailorFlowStepper;
