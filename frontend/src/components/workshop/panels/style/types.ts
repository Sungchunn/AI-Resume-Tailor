import type { ResumeStyle, TailoredContent } from "@/lib/api/types";

export interface TemplatePreset {
  id: string;
  name: string;
  description: string;
  style: ResumeStyle;
}

export interface TemplateSelectorProps {
  presets: TemplatePreset[];
  activePreset: string | null;
  onSelect: (preset: TemplatePreset) => void;
}

export interface TemplateThumbnailProps {
  preset: TemplatePreset;
  isActive: boolean;
  onClick: () => void;
}

export interface AutoFitToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  status: AutoFitStatus;
}

export type AutoFitStatus =
  | { state: "idle" }
  | { state: "fitting"; iteration: number }
  | { state: "fitted"; reductions: string[] }
  | { state: "minimum_reached"; message: string };

export interface UseAutoFitOptions {
  content: TailoredContent;
  style: ResumeStyle;
  targetHeight: number;
  enabled: boolean;
  onStyleChange: (style: Partial<ResumeStyle>) => void;
}

export interface UseAutoFitResult {
  status: AutoFitStatus;
  adjustedStyle: ResumeStyle;
  reductions: AutoFitReduction[];
}

export interface AutoFitReduction {
  property: string;
  from: number;
  to: number;
  label: string;
}