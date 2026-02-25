import type { TailoredContent, ResumeStyle } from "@/lib/api/types";

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

export interface WizardOverlayProps {
  title: string;
  onSkip: () => void;
  children: React.ReactNode;
}

export interface DifferenceStepProps {
  onContinue: () => void;
}

export interface AlignStepProps {
  selectedSections: string[];
  onToggle: (section: string) => void;
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

// Step configuration
export const STEPS: WizardStep[] = ["difference", "align", "review"];

export const STEP_CONFIG: Record<WizardStep, { number: number; label: string }> = {
  difference: { number: 1, label: "See Difference" },
  align: { number: 2, label: "Align Resume" },
  review: { number: 3, label: "Review" },
};

export const SECTION_OPTIONS: SectionOption[] = [
  {
    id: "summary",
    name: "Summary",
    description: "Add relevant keywords and tailor positioning",
    projectedImprovement: 10,
    isRecommended: true,
  },
  {
    id: "experience",
    name: "Experience",
    description: "Highlight leadership, metrics, and relevant achievements",
    projectedImprovement: 15,
    isRecommended: true,
  },
  {
    id: "skills",
    name: "Skills",
    description: "Reorder and add matching technical skills",
    projectedImprovement: 8,
    isRecommended: false,
  },
  {
    id: "highlights",
    name: "Highlights",
    description: "Add impactful accomplishment statements",
    projectedImprovement: 7,
    isRecommended: false,
  },
];
