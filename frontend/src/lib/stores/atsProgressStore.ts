import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ATSStageResult {
  stage: number;
  stageName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progressPercent: number;
  elapsedMs?: number;
  result?: any;
  error?: string;
}

export interface ATSCompositeScore {
  finalScore: number;
  stageBreakdown: Record<string, number>;
  weightsUsed: Record<string, number>;
  normalizationApplied: boolean;
  failedStages: string[];
}

export interface ATSProgressState {
  isAnalyzing: boolean;
  analysisId: string | null;
  resumeId: number | null;
  jobId: number | null;
  stages: Record<number, ATSStageResult>;
  compositeScore: ATSCompositeScore | null;
  currentStage: number;
  overallProgress: number;
  totalElapsedMs: number;
  fatalError: string | null;
  eventSource: EventSource | null;
  startAnalysis: (resumeId: number, jobId: number) => void;
  updateStage: (stage: ATSStageResult) => void;
  setCompositeScore: (score: ATSCompositeScore) => void;
  completeAnalysis: () => void;
  setError: (error: string) => void;
  resetAnalysis: () => void;
  closeConnection: () => void;
}

export const useATSProgressStore = create<ATSProgressState>()(
  persist(
    (set, get) => ({
      isAnalyzing: false,
      analysisId: null,
      resumeId: null,
      jobId: null,
      stages: {},
      compositeScore: null,
      currentStage: -1,
      overallProgress: 0,
      totalElapsedMs: 0,
      fatalError: null,
      eventSource: null,

      startAnalysis: (resumeId, jobId) => {
        set({
          isAnalyzing: true,
          analysisId: `${resumeId}-${jobId}-${Date.now()}`,
          resumeId,
          jobId,
          stages: {},
          compositeScore: null,
          currentStage: 0,
          overallProgress: 0,
          totalElapsedMs: 0,
          fatalError: null,
        });
      },

      updateStage: (stageData) => {
        set((state) => ({
          stages: {
            ...state.stages,
            [stageData.stage]: stageData,
          },
          currentStage: stageData.stage,
          overallProgress: stageData.progressPercent,
          totalElapsedMs: stageData.elapsedMs || state.totalElapsedMs,
        }));
      },

      setCompositeScore: (score) => {
        set({ compositeScore: score });
      },

      completeAnalysis: () => {
        get().closeConnection();
        set({
          isAnalyzing: false,
          overallProgress: 100,
        });
      },

      setError: (error) => {
        get().closeConnection();
        set({
          fatalError: error,
          isAnalyzing: false,
        });
      },

      resetAnalysis: () => {
        get().closeConnection();
        set({
          isAnalyzing: false,
          analysisId: null,
          resumeId: null,
          jobId: null,
          stages: {},
          compositeScore: null,
          currentStage: -1,
          overallProgress: 0,
          totalElapsedMs: 0,
          fatalError: null,
        });
      },

      closeConnection: () => {
        const { eventSource } = get();
        if (eventSource) {
          eventSource.close();
          set({ eventSource: null });
        }
      },
    }),
    {
      name: 'ats-progress-storage',
      partialize: (state) => ({
        stages: state.stages,
        compositeScore: state.compositeScore,
        resumeId: state.resumeId,
        jobId: state.jobId,
      }),
    }
  )
);
