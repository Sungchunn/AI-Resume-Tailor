import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ATSKeywordDetailedResponse } from '@/lib/api/types';

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
  resumeId: string | null; // MongoDB ObjectId or job-related ID (string for flexibility)
  jobId: string | null; // UUID for user-created jobs, or string representation of job listing ID
  stages: Record<number, ATSStageResult>;
  compositeScore: ATSCompositeScore | null;
  currentStage: number;
  overallProgress: number;
  totalElapsedMs: number;
  fatalError: string | null;
  eventSource: EventSource | null;

  // Content tracking for staleness detection
  analyzedContentHash: string | null;
  contentStale: boolean;

  // Keyword analysis result (shared across tabs for library-mode bullet suggestions)
  keywordAnalysisResult: ATSKeywordDetailedResponse | null;

  // Actions
  startAnalysis: (resumeId: string, jobId: string) => void;
  updateStage: (stage: ATSStageResult) => void;
  setCompositeScore: (score: ATSCompositeScore) => void;
  completeAnalysis: () => void;
  setError: (error: string) => void;
  resetAnalysis: () => void;
  closeConnection: () => void;

  // Content tracking actions
  setAnalyzedContentHash: (hash: string) => void;
  markContentStale: () => void;
  clearStaleFlag: () => void;

  // Keyword analysis actions
  setKeywordAnalysisResult: (result: ATSKeywordDetailedResponse | null) => void;
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

      // Content tracking initial state
      analyzedContentHash: null,
      contentStale: false,

      // Keyword analysis result
      keywordAnalysisResult: null,

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

      // Content tracking actions
      setAnalyzedContentHash: (hash) => {
        set({ analyzedContentHash: hash, contentStale: false });
      },

      markContentStale: () => {
        set({ contentStale: true });
      },

      clearStaleFlag: () => {
        set({ contentStale: false });
      },

      // Keyword analysis actions
      setKeywordAnalysisResult: (result) => {
        set({ keywordAnalysisResult: result });
      },
    }),
    {
      name: 'ats-progress-storage',
      version: 2,
      partialize: (state) => ({
        stages: state.stages,
        compositeScore: state.compositeScore,
        resumeId: state.resumeId,
        jobId: state.jobId,
        analyzedContentHash: state.analyzedContentHash,
      }),
    }
  )
);
