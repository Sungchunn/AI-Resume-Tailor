import type { TailoredContent } from "@/lib/api/types";

export interface ScoreDisplayProps {
  score: number;
  previousScore?: number | null;
  isUpdating: boolean;
  lastUpdated?: Date | null;
  className?: string;
}

export interface ScoreUpdateIndicatorProps {
  isUpdating: boolean;
  showPulse?: boolean;
}

export interface ScoreComparisonProps {
  currentScore: number;
  previousScore: number;
  showDelta?: boolean;
}

export type ScoreCalculationStatus =
  | { state: "idle" }
  | { state: "pending" }
  | { state: "calculating" }
  | { state: "success"; score: number }
  | { state: "error"; message: string };

export interface UseScoreCalculationOptions {
  content: TailoredContent;
  resumeId: number;
  jobId: number | null;
  enabled?: boolean;
  debounceMs?: number;
}

export interface UseScoreCalculationResult {
  score: number;
  previousScore: number | null;
  status: ScoreCalculationStatus;
  isUpdating: boolean;
  lastUpdated: Date | null;
  triggerRecalculation: () => void;
}
