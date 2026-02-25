"use client";

import { useState, useEffect, createContext, useContext, useCallback } from "react";
import type { ReactNode } from "react";
import { WizardOverlay } from "./WizardOverlay";
import { WizardProgress } from "./WizardProgress";
import { DifferenceStep, AlignStep, ReviewStep } from "./steps";
import type { WizardState, WizardStep, WizardContextValue } from "./types";
import { WIZARD_STORAGE_KEY, WIZARD_PROGRESS_KEY, STEPS } from "./types";

const WizardContext = createContext<WizardContextValue | null>(null);

export function useWizard(): WizardContextValue {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error("useWizard must be used within WizardContainer");
  }
  return context;
}

// Safe hook that doesn't throw - for components outside wizard context
export function useWizardOptional(): WizardContextValue | null {
  return useContext(WizardContext);
}

interface WizardContainerProps {
  jobTitle?: string;
  company?: string;
  hasJob: boolean;
  children: ReactNode;
}

function getInitialState(hasJob: boolean): WizardState {
  // Check localStorage for previous completion (client-side only)
  if (typeof window === "undefined") {
    return {
      currentStep: "difference",
      completedSteps: [],
      selectedSections: ["summary", "experience"],
      isOpen: false,
      hasCompletedBefore: false,
    };
  }

  const hasCompleted = localStorage.getItem(WIZARD_STORAGE_KEY) === "true";
  const savedProgressRaw = localStorage.getItem(WIZARD_PROGRESS_KEY);

  let savedProgress: Partial<WizardState> = {};
  if (savedProgressRaw) {
    try {
      savedProgress = JSON.parse(savedProgressRaw);
    } catch {
      // Invalid JSON, ignore
    }
  }

  return {
    currentStep: "difference",
    completedSteps: [],
    selectedSections: ["summary", "experience"],
    isOpen: hasJob && !hasCompleted,
    hasCompletedBefore: hasCompleted,
    ...savedProgress,
  };
}

export function WizardContainer({
  jobTitle = "this position",
  company = "the company",
  hasJob,
  children,
}: WizardContainerProps) {
  const [state, setState] = useState<WizardState>(() => getInitialState(hasJob));
  const [isHydrated, setIsHydrated] = useState(false);

  // Handle hydration
  useEffect(() => {
    setState(getInitialState(hasJob));
    setIsHydrated(true);
  }, [hasJob]);

  // Save progress to localStorage
  useEffect(() => {
    if (!isHydrated) return;

    if (state.isOpen) {
      localStorage.setItem(
        WIZARD_PROGRESS_KEY,
        JSON.stringify({
          currentStep: state.currentStep,
          completedSteps: state.completedSteps,
          selectedSections: state.selectedSections,
        })
      );
    }
  }, [
    state.currentStep,
    state.completedSteps,
    state.selectedSections,
    state.isOpen,
    isHydrated,
  ]);

  const goToStep = useCallback((step: WizardStep) => {
    setState((prev) => ({ ...prev, currentStep: step }));
  }, []);

  const nextStep = useCallback(() => {
    setState((prev) => {
      const currentIndex = STEPS.indexOf(prev.currentStep);
      if (currentIndex < STEPS.length - 1) {
        return {
          ...prev,
          currentStep: STEPS[currentIndex + 1],
          completedSteps: [...new Set([...prev.completedSteps, prev.currentStep])],
        };
      }
      return prev;
    });
  }, []);

  const prevStep = useCallback(() => {
    setState((prev) => {
      const currentIndex = STEPS.indexOf(prev.currentStep);
      if (currentIndex > 0) {
        return {
          ...prev,
          currentStep: STEPS[currentIndex - 1],
        };
      }
      return prev;
    });
  }, []);

  const toggleSection = useCallback((section: string) => {
    setState((prev) => ({
      ...prev,
      selectedSections: prev.selectedSections.includes(section)
        ? prev.selectedSections.filter((s) => s !== section)
        : [...prev.selectedSections, section],
    }));
  }, []);

  const skipWizard = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
    localStorage.removeItem(WIZARD_PROGRESS_KEY);
  }, []);

  const completeWizard = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false, hasCompletedBefore: true }));
    localStorage.setItem(WIZARD_STORAGE_KEY, "true");
    localStorage.removeItem(WIZARD_PROGRESS_KEY);
  }, []);

  const resetWizard = useCallback(() => {
    setState({
      currentStep: "difference",
      completedSteps: [],
      selectedSections: ["summary", "experience"],
      isOpen: true,
      hasCompletedBefore: false,
    });
    localStorage.removeItem(WIZARD_STORAGE_KEY);
    localStorage.removeItem(WIZARD_PROGRESS_KEY);
  }, []);

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

  // Don't render wizard during SSR or before hydration
  if (!isHydrated) {
    return (
      <WizardContext.Provider value={contextValue}>
        {children}
      </WizardContext.Provider>
    );
  }

  const title = `Tailor for ${jobTitle} at ${company}`;

  return (
    <WizardContext.Provider value={contextValue}>
      {state.isOpen ? (
        <WizardOverlay title={title} onSkip={skipWizard}>
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
  const { state, nextStep, prevStep, toggleSection, completeWizard, skipWizard } =
    useWizard();

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
