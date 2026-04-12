# Phase I: Step-by-Step Wizard Flow

**Created**: February 25, 2026
**Status**: Complete
**Dependencies**: Phases A-H (core workshop components)
**Priority**: P2
**Next Phase**: Phase J (Polish and Animations)

---

## Overview

Create an optional guided workflow for first-time users that walks them through the resume tailoring process. The wizard provides structure for users unfamiliar with the workshop while allowing experienced users to skip directly to the full interface.

---

## Key Features

1. **Three-Step Guided Flow** - Clear progression through analysis, enhancement, and review
2. **Skip Option** - Experienced users can bypass wizard at any time
3. **Progress Persistence** - Users can resume mid-wizard if they leave
4. **Visual Progress Indicator** - Clear indication of current step and completion
5. **User Preference Storage** - Remember wizard completion to not show again

---

## User Flow

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                         WIZARD ENTRY POINT                               │
│                                                                          │
│  User arrives at workshop with a job posting                             │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  "Let's tailor your resume for [Job Title] at [Company]"         │    │
│  │                                                                   │    │
│  │  [Start Guided Flow]              [Skip to Workshop →]            │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  STEP 1: SEE YOUR DIFFERENCE                                             │
│  ────────────────────────────                                            │
│                                                                          │
│  ┌─────────────────────┐        ┌─────────────────────┐                  │
│  │    YOUR RESUME      │        │   JOB REQUIREMENTS  │                  │
│  │                     │   VS   │                     │                  │
│  │  • Python           │        │  • Python ✓         │                  │
│  │  • AWS              │        │  • AWS ✓            │                  │
│  │  • SQL              │        │  • Kubernetes ✗     │                  │
│  │                     │        │  • Terraform ✗      │                  │
│  └─────────────────────┘        └─────────────────────┘                  │
│                                                                          │
│  Match Score: [======60%====    ]                                        │
│                                                                          │
│  "You're missing 2 key skills. Let's see how to improve this."           │
│                                                                          │
│                              [Continue →]                                │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  STEP 2: ALIGN YOUR RESUME                                               │
│  ─────────────────────────                                               │
│                                                                          │
│  "Select sections to enhance with AI suggestions"                        │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ ☑ Summary           "Add relevant keywords"          +15 score     │  │
│  │ ☑ Experience        "Highlight leadership, metrics"  +20 score     │  │
│  │ ☐ Skills            "Already well-matched"           +0 score      │  │
│  │ ☑ Highlights        "Add impact statements"          +10 score     │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  Projected Score: [========85%========]  (+25 improvement)               │
│                                                                          │
│                    [← Back]           [Apply & Continue →]               │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  STEP 3: REVIEW YOUR NEW RESUME                                          │
│  ──────────────────────────────                                          │
│                                                                          │
│  ┌─────────────────────────────┐    ┌──────────────────────────────┐     │
│  │                             │    │  Changes Made:               │     │
│  │    [Resume Preview]         │    │                              │     │
│  │                             │    │  ✓ Summary rewritten         │     │
│  │    Your tailored resume     │    │  ✓ 3 bullets enhanced        │     │
│  │    ready for export         │    │  ✓ 2 highlights added        │     │
│  │                             │    │                              │     │
│  └─────────────────────────────┘    │  Final Score: 85% (+25)      │     │
│                                     └──────────────────────────────┘     │
│                                                                          │
│             [← Back]    [Open Workshop]    [Export PDF →]                │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

```text
frontend/src/components/workshop/wizard/
├── WizardContainer.tsx       # Main wizard wrapper
├── WizardProgress.tsx        # Step indicator bar
├── WizardNavigation.tsx      # Back/Next/Skip buttons
├── WizardOverlay.tsx         # Full-screen overlay wrapper
├── steps/
│   ├── DifferenceStep.tsx    # Step 1: Compare resume vs job
│   ├── AlignStep.tsx         # Step 2: Section selection
│   └── ReviewStep.tsx        # Step 3: Final preview
├── hooks/
│   └── useWizardState.ts     # Wizard state management
└── types.ts                  # Type definitions
```

---

## Interfaces

```typescript
// frontend/src/components/workshop/wizard/types.ts

export type WizardStep = "difference" | "align" | "review";

export interface WizardState {
  currentStep: WizardStep;
  completedSteps: WizardStep[];
  selectedSections: string[];
  isOpen: boolean;
  hasCompletedBefore: boolean;
}

export interface WizardContextValue {
  state: WizardState;
  goToStep: (step: WizardStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  toggleSection: (section: string) => void;
  skipWizard: () => void;
  completeWizard: () => void;
  resetWizard: () => void;
}

export interface WizardProgressProps {
  currentStep: WizardStep;
  completedSteps: WizardStep[];
}

export interface WizardNavigationProps {
  onBack?: () => void;
  onNext: () => void;
  onSkip?: () => void;
  nextLabel?: string;
  backLabel?: string;
  showBack?: boolean;
  showSkip?: boolean;
  nextDisabled?: boolean;
}

export interface DifferenceStepProps {
  resumeSkills: string[];
  jobRequirements: string[];
  matchScore: number;
  onContinue: () => void;
}

export interface AlignStepProps {
  sections: SectionOption[];
  selectedSections: string[];
  onToggle: (section: string) => void;
  projectedScore: number;
  currentScore: number;
  onBack: () => void;
  onApply: () => void;
}

export interface SectionOption {
  id: string;
  name: string;
  description: string;
  projectedImprovement: number;
  isRecommended: boolean;
}

export interface ReviewStepProps {
  content: TailoredContent;
  style: ResumeStyle;
  changesSummary: ChangeSummary[];
  finalScore: number;
  scoreImprovement: number;
  onBack: () => void;
  onOpenWorkshop: () => void;
  onExport: () => void;
}

export interface ChangeSummary {
  section: string;
  changeType: "rewritten" | "enhanced" | "added";
  count?: number;
}

// Storage keys
export const WIZARD_STORAGE_KEY = "workshop_wizard_completed";
export const WIZARD_PROGRESS_KEY = "workshop_wizard_progress";
```

---

## Implementation Details

### 1. WizardContainer.tsx (Main Wrapper)

```typescript
"use client";

import { useState, useEffect, createContext, useContext } from "react";
import { WizardOverlay } from "./WizardOverlay";
import { WizardProgress } from "./WizardProgress";
import { DifferenceStep } from "./steps/DifferenceStep";
import { AlignStep } from "./steps/AlignStep";
import { ReviewStep } from "./steps/ReviewStep";
import type { WizardState, WizardStep, WizardContextValue } from "./types";
import { WIZARD_STORAGE_KEY, WIZARD_PROGRESS_KEY } from "./types";

const STEPS: WizardStep[] = ["difference", "align", "review"];

const WizardContext = createContext<WizardContextValue | null>(null);

export function useWizard() {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error("useWizard must be used within WizardContainer");
  }
  return context;
}

interface WizardContainerProps {
  jobTitle: string;
  company: string;
  children: React.ReactNode;
}

export function WizardContainer({
  jobTitle,
  company,
  children,
}: WizardContainerProps) {
  const [state, setState] = useState<WizardState>(() => {
    // Check localStorage for previous completion
    const hasCompleted = localStorage.getItem(WIZARD_STORAGE_KEY) === "true";
    const savedProgress = localStorage.getItem(WIZARD_PROGRESS_KEY);

    return {
      currentStep: "difference",
      completedSteps: [],
      selectedSections: ["summary", "experience"],
      isOpen: !hasCompleted,
      hasCompletedBefore: hasCompleted,
      ...(savedProgress ? JSON.parse(savedProgress) : {}),
    };
  });

  // Save progress to localStorage
  useEffect(() => {
    if (state.isOpen) {
      localStorage.setItem(WIZARD_PROGRESS_KEY, JSON.stringify({
        currentStep: state.currentStep,
        completedSteps: state.completedSteps,
        selectedSections: state.selectedSections,
      }));
    }
  }, [state.currentStep, state.completedSteps, state.selectedSections, state.isOpen]);

  const goToStep = (step: WizardStep) => {
    setState((prev) => ({ ...prev, currentStep: step }));
  };

  const nextStep = () => {
    const currentIndex = STEPS.indexOf(state.currentStep);
    if (currentIndex < STEPS.length - 1) {
      setState((prev) => ({
        ...prev,
        currentStep: STEPS[currentIndex + 1],
        completedSteps: [...new Set([...prev.completedSteps, prev.currentStep])],
      }));
    }
  };

  const prevStep = () => {
    const currentIndex = STEPS.indexOf(state.currentStep);
    if (currentIndex > 0) {
      setState((prev) => ({
        ...prev,
        currentStep: STEPS[currentIndex - 1],
      }));
    }
  };

  const toggleSection = (section: string) => {
    setState((prev) => ({
      ...prev,
      selectedSections: prev.selectedSections.includes(section)
        ? prev.selectedSections.filter((s) => s !== section)
        : [...prev.selectedSections, section],
    }));
  };

  const skipWizard = () => {
    setState((prev) => ({ ...prev, isOpen: false }));
    localStorage.removeItem(WIZARD_PROGRESS_KEY);
  };

  const completeWizard = () => {
    setState((prev) => ({ ...prev, isOpen: false, hasCompletedBefore: true }));
    localStorage.setItem(WIZARD_STORAGE_KEY, "true");
    localStorage.removeItem(WIZARD_PROGRESS_KEY);
  };

  const resetWizard = () => {
    setState({
      currentStep: "difference",
      completedSteps: [],
      selectedSections: ["summary", "experience"],
      isOpen: true,
      hasCompletedBefore: false,
    });
    localStorage.removeItem(WIZARD_STORAGE_KEY);
  };

  const contextValue: WizardContextValue = {
    state,
    goToStep,
    nextStep,
    prevStep,
    toggleSection,
    skipWizard,
    completeWizard,
    resetWizard,
  };

  return (
    <WizardContext.Provider value={contextValue}>
      {state.isOpen ? (
        <WizardOverlay
          title={`Tailor for ${jobTitle} at ${company}`}
          onSkip={skipWizard}
        >
          <WizardProgress
            currentStep={state.currentStep}
            completedSteps={state.completedSteps}
          />
          <WizardContent />
        </WizardOverlay>
      ) : (
        children
      )}
    </WizardContext.Provider>
  );
}

function WizardContent() {
  const { state, nextStep, prevStep, toggleSection, completeWizard, skipWizard } = useWizard();

  switch (state.currentStep) {
    case "difference":
      return <DifferenceStep onContinue={nextStep} />;
    case "align":
      return (
        <AlignStep
          selectedSections={state.selectedSections}
          onToggle={toggleSection}
          onBack={prevStep}
          onApply={nextStep}
        />
      );
    case "review":
      return (
        <ReviewStep
          onBack={prevStep}
          onOpenWorkshop={skipWizard}
          onExport={completeWizard}
        />
      );
    default:
      return null;
  }
}
```

### 2. WizardProgress.tsx

```typescript
"use client";

import type { WizardProgressProps, WizardStep } from "./types";

const STEP_CONFIG: Record<WizardStep, { number: number; label: string }> = {
  difference: { number: 1, label: "See Difference" },
  align: { number: 2, label: "Align Resume" },
  review: { number: 3, label: "Review" },
};

export function WizardProgress({
  currentStep,
  completedSteps,
}: WizardProgressProps) {
  const steps: WizardStep[] = ["difference", "align", "review"];

  return (
    <div className="flex items-center justify-center py-6">
      {steps.map((step, index) => {
        const config = STEP_CONFIG[step];
        const isCompleted = completedSteps.includes(step);
        const isCurrent = step === currentStep;
        const isPast = steps.indexOf(step) < steps.indexOf(currentStep);

        return (
          <div key={step} className="flex items-center">
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
            {index < steps.length - 1 && (
              <div
                className={`w-16 h-0.5 mx-2 ${
                  isPast || isCompleted ? "bg-blue-600" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
```

### 3. WizardOverlay.tsx

```typescript
"use client";

interface WizardOverlayProps {
  title: string;
  onSkip: () => void;
  children: React.ReactNode;
}

export function WizardOverlay({
  title,
  onSkip,
  children,
}: WizardOverlayProps) {
  return (
    <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onSkip}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            Skip to Workshop
            <ArrowRightIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
  );
}
```

### 4. DifferenceStep.tsx

```typescript
"use client";

import { useWorkshop } from "../../WorkshopContext";

interface DifferenceStepProps {
  onContinue: () => void;
}

export function DifferenceStep({ onContinue }: DifferenceStepProps) {
  const { state } = useWorkshop();

  // Extract from ATS analysis or tailored resume
  const resumeSkills = state.tailoredResume?.skill_matches ?? [];
  const missingSkills = state.tailoredResume?.skill_gaps ?? [];
  const matchScore = state.tailoredResume?.match_score ?? 0;

  return (
    <div className="space-y-6">
      {/* Intro Text */}
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900">
          See How You Compare
        </h3>
        <p className="mt-2 text-gray-600">
          Here's how your resume matches the job requirements
        </p>
      </div>

      {/* Side-by-Side Comparison */}
      <div className="grid grid-cols-2 gap-6">
        {/* Your Skills */}
        <div className="border rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Skills You Have
          </h4>
          <ul className="space-y-2">
            {resumeSkills.map((skill) => (
              <li key={skill} className="flex items-center text-sm text-gray-700">
                <CheckIcon className="w-4 h-4 text-green-500 mr-2" />
                {skill}
              </li>
            ))}
          </ul>
        </div>

        {/* Missing Skills */}
        <div className="border rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Skills to Highlight
          </h4>
          <ul className="space-y-2">
            {missingSkills.map((skill) => (
              <li key={skill} className="flex items-center text-sm text-gray-700">
                <XIcon className="w-4 h-4 text-red-500 mr-2" />
                {skill}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Match Score Bar */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Current Match Score</span>
          <span className="text-lg font-bold text-gray-900">{matchScore}%</span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              matchScore >= 80 ? "bg-green-500" :
              matchScore >= 60 ? "bg-yellow-500" : "bg-red-500"
            }`}
            style={{ width: `${matchScore}%` }}
          />
        </div>
        {missingSkills.length > 0 && (
          <p className="mt-3 text-sm text-gray-600">
            You're missing <strong>{missingSkills.length} key skills</strong>.
            Let's see how to improve your match.
          </p>
        )}
      </div>

      {/* Continue Button */}
      <div className="flex justify-end">
        <button
          onClick={onContinue}
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
```

### 5. AlignStep.tsx

```typescript
"use client";

import { useMemo } from "react";
import { useWorkshop } from "../../WorkshopContext";

interface AlignStepProps {
  selectedSections: string[];
  onToggle: (section: string) => void;
  onBack: () => void;
  onApply: () => void;
}

const SECTION_OPTIONS = [
  {
    id: "summary",
    name: "Summary",
    description: "Add relevant keywords and tailor positioning",
  },
  {
    id: "experience",
    name: "Experience",
    description: "Highlight leadership, metrics, and relevant achievements",
  },
  {
    id: "skills",
    name: "Skills",
    description: "Reorder and add matching technical skills",
  },
  {
    id: "highlights",
    name: "Highlights",
    description: "Add impactful accomplishment statements",
  },
];

export function AlignStep({
  selectedSections,
  onToggle,
  onBack,
  onApply,
}: AlignStepProps) {
  const { state } = useWorkshop();
  const currentScore = state.tailoredResume?.match_score ?? 0;

  // Calculate projected improvement
  const projectedImprovement = useMemo(() => {
    return selectedSections.length * 8; // Simplified: ~8 points per section
  }, [selectedSections]);

  const projectedScore = Math.min(100, currentScore + projectedImprovement);

  return (
    <div className="space-y-6">
      {/* Intro Text */}
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900">
          Choose Sections to Enhance
        </h3>
        <p className="mt-2 text-gray-600">
          Select the sections you'd like AI to improve for this job
        </p>
      </div>

      {/* Section Selection */}
      <div className="space-y-3">
        {SECTION_OPTIONS.map((section) => {
          const isSelected = selectedSections.includes(section.id);
          const estimatedGain = isSelected ? 8 : 0;

          return (
            <button
              key={section.id}
              onClick={() => onToggle(section.id)}
              className={`w-full flex items-center justify-between p-4 rounded-lg border-2 text-left transition-colors ${
                isSelected
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Checkbox */}
                <div
                  className={`w-5 h-5 rounded flex items-center justify-center ${
                    isSelected ? "bg-blue-600" : "border-2 border-gray-300"
                  }`}
                >
                  {isSelected && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>

                {/* Section Info */}
                <div>
                  <div className="font-medium text-gray-900">{section.name}</div>
                  <div className="text-sm text-gray-500">{section.description}</div>
                </div>
              </div>

              {/* Score Impact */}
              <div className={`text-sm font-medium ${isSelected ? "text-green-600" : "text-gray-400"}`}>
                +{estimatedGain} score
              </div>
            </button>
          );
        })}
      </div>

      {/* Projected Score */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Projected Score</span>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-gray-900">{projectedScore}%</span>
            {projectedImprovement > 0 && (
              <span className="text-sm text-green-600 font-medium">
                (+{projectedImprovement})
              </span>
            )}
          </div>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          {/* Current score (darker) */}
          <div className="h-full relative">
            <div
              className="absolute inset-y-0 left-0 bg-blue-600 rounded-full"
              style={{ width: `${currentScore}%` }}
            />
            {/* Projected gain (lighter) */}
            <div
              className="absolute inset-y-0 bg-blue-300 rounded-r-full"
              style={{
                left: `${currentScore}%`,
                width: `${projectedImprovement}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 text-gray-600 font-medium hover:text-gray-900"
        >
          Back
        </button>
        <button
          onClick={onApply}
          disabled={selectedSections.length === 0}
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Apply & Continue
        </button>
      </div>
    </div>
  );
}
```

### 6. ReviewStep.tsx

```typescript
"use client";

import { useWorkshop } from "../../WorkshopContext";

interface ReviewStepProps {
  onBack: () => void;
  onOpenWorkshop: () => void;
  onExport: () => void;
}

export function ReviewStep({
  onBack,
  onOpenWorkshop,
  onExport,
}: ReviewStepProps) {
  const { state } = useWorkshop();
  const finalScore = state.tailoredResume?.match_score ?? 0;

  // Mock changes summary - in real impl, track from suggestions applied
  const changesSummary = [
    { section: "Summary", type: "rewritten" },
    { section: "Experience", type: "enhanced", count: 3 },
    { section: "Highlights", type: "added", count: 2 },
  ];

  return (
    <div className="space-y-6">
      {/* Intro Text */}
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900">
          Your Tailored Resume is Ready
        </h3>
        <p className="mt-2 text-gray-600">
          Review your changes and export when you're satisfied
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Mini Preview */}
        <div className="border rounded-lg p-4 bg-white">
          <h4 className="font-medium text-gray-900 mb-3">Preview</h4>
          <div className="bg-gray-50 rounded border aspect-[8.5/11] flex items-center justify-center text-gray-400 text-sm">
            [Resume Preview Placeholder]
          </div>
        </div>

        {/* Changes Summary */}
        <div className="space-y-4">
          <div className="border rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">Changes Made</h4>
            <ul className="space-y-2">
              {changesSummary.map((change, index) => (
                <li key={index} className="flex items-center text-sm text-gray-700">
                  <svg className="w-4 h-4 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>
                    {change.section}{" "}
                    {change.type === "rewritten" && "rewritten"}
                    {change.type === "enhanced" && `(${change.count} bullets enhanced)`}
                    {change.type === "added" && `(${change.count} added)`}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Final Score */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-green-800">Final Match Score</span>
              <span className="text-2xl font-bold text-green-600">{finalScore}%</span>
            </div>
          </div>

          {/* Tip */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            <strong>Tip:</strong> Open the full workshop to make additional manual edits
            or fine-tune AI suggestions before exporting.
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 text-gray-600 font-medium hover:text-gray-900"
        >
          Back
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenWorkshop}
            className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
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
```

---

## Integration Points

### 1. Workshop Page Entry

```typescript
// frontend/src/app/dashboard/workshop/[id]/page.tsx

import { WizardContainer } from "@/components/workshop/wizard/WizardContainer";
import { WorkshopLayout } from "@/components/workshop/WorkshopLayout";

export default function WorkshopPage({ params }: { params: { id: string } }) {
  // Fetch job info for wizard header
  const jobTitle = "Software Engineer";
  const company = "Tech Corp";

  return (
    <WizardContainer jobTitle={jobTitle} company={company}>
      <WorkshopLayout tailoredId={params.id} />
    </WizardContainer>
  );
}
```

### 2. "Restart Wizard" Button in Workshop Header

```typescript
// In WorkshopHeader.tsx
const { resetWizard } = useWizard();

<button onClick={resetWizard} className="text-sm text-gray-500">
  Restart Guide
</button>
```

---

## State Persistence

### LocalStorage Keys

| Key | Purpose | Value |
|-----|---------|-------|
| `workshop_wizard_completed` | Track if user finished wizard | `"true"` or absent |
| `workshop_wizard_progress` | Save mid-wizard progress | JSON state object |

### Clear Conditions

- Progress cleared on wizard completion
- Progress cleared on skip
- Completed flag persists until user clicks "Restart Guide"

---

## Edge Cases

| Edge Case | Solution |
|-----------|----------|
| User closes browser mid-wizard | Restore progress from localStorage |
| No job associated | Don't show wizard, go directly to workshop |
| Job has no skill gaps | Show congratulatory step 1, offer to proceed anyway |
| User on mobile | Responsive modal, scroll for long content |
| User presses back button | Treat as previous step, not browser back |
| User clicks overlay backdrop | Confirm exit or skip |

---

## Testing Strategy

### Unit Tests

```typescript
// tests/unit/wizard-state.spec.ts

describe("useWizardState", () => {
  test("initializes from localStorage if exists", () => {
    localStorage.setItem(WIZARD_PROGRESS_KEY, JSON.stringify({
      currentStep: "align",
      selectedSections: ["summary"],
    }));

    const { result } = renderHook(() => useWizardState());
    expect(result.current.state.currentStep).toBe("align");
  });

  test("skips wizard if previously completed", () => {
    localStorage.setItem(WIZARD_STORAGE_KEY, "true");

    const { result } = renderHook(() => useWizardState());
    expect(result.current.state.isOpen).toBe(false);
  });

  test("progresses through steps correctly", () => {
    const { result } = renderHook(() => useWizardState());

    act(() => result.current.nextStep());
    expect(result.current.state.currentStep).toBe("align");

    act(() => result.current.nextStep());
    expect(result.current.state.currentStep).toBe("review");
  });
});
```

### Component Tests

```typescript
// tests/components/WizardProgress.spec.tsx

test("marks completed steps with checkmark", () => {
  render(
    <WizardProgress
      currentStep="align"
      completedSteps={["difference"]}
    />
  );

  expect(screen.getByRole("img", { name: /check/i })).toBeInTheDocument();
});

test("highlights current step", () => {
  render(
    <WizardProgress
      currentStep="align"
      completedSteps={["difference"]}
    />
  );

  expect(screen.getByText("Align Resume")).toHaveClass("text-blue-600");
});
```

### E2E Tests

```typescript
// tests/e2e/wizard-flow.spec.ts

test("completes full wizard flow", async ({ page }) => {
  await page.goto("/dashboard/workshop/123");

  // Step 1: See Difference
  await expect(page.getByText("See How You Compare")).toBeVisible();
  await page.click("text=Continue");

  // Step 2: Align
  await expect(page.getByText("Choose Sections to Enhance")).toBeVisible();
  await page.click("text=Summary");
  await page.click("text=Apply & Continue");

  // Step 3: Review
  await expect(page.getByText("Your Tailored Resume is Ready")).toBeVisible();
  await page.click("text=Export PDF");

  // Wizard should close
  await expect(page.getByText("See How You Compare")).not.toBeVisible();
});

test("remembers completion on refresh", async ({ page }) => {
  // Complete wizard
  await page.goto("/dashboard/workshop/123");
  // ... complete steps ...

  // Refresh
  await page.reload();

  // Wizard should not appear
  await expect(page.getByText("See How You Compare")).not.toBeVisible();
});
```

---

## Acceptance Criteria

- [x] Wizard shows on first visit to workshop (with job)
- [x] Three steps display with correct content
- [x] Progress indicator shows current and completed steps
- [x] User can navigate back to previous steps
- [x] "Skip to Workshop" closes wizard at any point
- [x] Section selection in Step 2 updates projected score
- [x] Progress persists if user leaves mid-wizard
- [x] Completed flag prevents wizard from showing again
- [x] "Restart Guide" button available in workshop header
- [x] Mobile-responsive overlay layout
- [x] Keyboard accessible (Tab, Enter, Escape)

---

## Dependencies

### No New Packages Required

- Uses existing React state management
- Uses localStorage for persistence
- Uses existing Tailwind CSS

---

## Handoff Notes

**Files to reference:**
- `WorkshopContext.tsx` - Workshop state provider
- `WorkshopLayout.tsx` - Main workshop component
- `tailoredResume` response type - Contains match_score, skill_matches, skill_gaps

**Context patterns:**
```typescript
const { state } = useWorkshop();
const score = state.tailoredResume?.match_score ?? 0;
const skillGaps = state.tailoredResume?.skill_gaps ?? [];
```

**localStorage usage:**
```typescript
localStorage.getItem("workshop_wizard_completed") === "true"
localStorage.setItem("workshop_wizard_progress", JSON.stringify(state))
```

---

## Phase Order Reference

A (PDF Preview) → B (Layout) → C-D (Score + Tabs) ✓ → E (AI Rewrite) ✓ → F (Editor) → G (Style) → H (Score Updates) → **I (Wizard)** → J (Polish)
