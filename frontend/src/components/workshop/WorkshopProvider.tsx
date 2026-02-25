"use client";

import { useEffect, useCallback, useReducer, useRef, type ReactNode } from "react";
import {
  WorkshopContext,
  workshopReducer,
  initialState,
  DEFAULT_STYLE,
  DEFAULT_SECTION_ORDER,
  type WorkshopContextValue,
  type WorkshopState,
} from "./WorkshopContext";
import type { TailoredContent, ResumeStyle, Suggestion, TailoredResumeFullResponse } from "@/lib/api/types";
import { useTailoredResume, useUpdateTailoredResume, useATSKeywordAnalysis } from "@/lib/api/hooks";
import { useScoreCalculation } from "./hooks/useScoreCalculation";
import { useUndoRedo, HISTORY_LIMIT } from "./hooks/useUndoRedo";

// State subset that is tracked for undo/redo
interface UndoableState {
  content: TailoredContent;
  styleSettings: ResumeStyle;
  sectionOrder: string[];
}

function getUndoableState(state: WorkshopState): UndoableState {
  return {
    content: state.content,
    styleSettings: state.styleSettings,
    sectionOrder: state.sectionOrder,
  };
}

interface WorkshopProviderProps {
  tailoredId: number;
  children: ReactNode;
}

export function WorkshopProvider({ tailoredId, children }: WorkshopProviderProps) {
  const [state, dispatch] = useReducer(workshopReducer, {
    ...initialState,
    tailoredId,
  });

  // Fetch initial data
  const { data: tailoredResume, isLoading, error } = useTailoredResume(tailoredId);
  const updateMutation = useUpdateTailoredResume();
  const atsAnalysisMutation = useATSKeywordAnalysis();

  // Initialize state when data loads
  useEffect(() => {
    if (tailoredResume) {
      // Convert TailorResponse to TailoredResumeFullResponse by adding default values
      // for fields that may not be present in the response
      const fullResponse: TailoredResumeFullResponse = {
        ...tailoredResume,
        job_listing_id: (tailoredResume as TailoredResumeFullResponse).job_listing_id ?? null,
        style_settings: (tailoredResume as TailoredResumeFullResponse).style_settings ?? DEFAULT_STYLE,
        section_order: (tailoredResume as TailoredResumeFullResponse).section_order ?? DEFAULT_SECTION_ORDER,
        updated_at: (tailoredResume as TailoredResumeFullResponse).updated_at ?? null,
      };
      dispatch({ type: "INIT_DATA", payload: fullResponse });
    }
  }, [tailoredResume]);

  useEffect(() => {
    if (error) {
      dispatch({
        type: "SET_ERROR",
        payload: error instanceof Error ? error.message : "Failed to load data",
      });
    }
  }, [error]);

  // Real-time score calculation
  const {
    score: calculatedScore,
    previousScore: calculatedPreviousScore,
    isUpdating: isScoreUpdating,
    lastUpdated: scoreLastUpdated,
  } = useScoreCalculation({
    content: state.content,
    resumeId: state.tailoredResume?.resume_id ?? 0,
    jobId: state.tailoredResume?.job_id ?? null,
    enabled: !!state.tailoredResume?.job_id && !state.isLoading,
  });

  // Sync calculated score to state
  useEffect(() => {
    if (calculatedScore !== state.matchScore || calculatedPreviousScore !== state.previousMatchScore) {
      dispatch({
        type: "SET_MATCH_SCORE",
        payload: { score: calculatedScore, previous: calculatedPreviousScore },
      });
    }
  }, [calculatedScore, calculatedPreviousScore, state.matchScore, state.previousMatchScore]);

  // Sync score updating state
  useEffect(() => {
    if (isScoreUpdating !== state.isScoreUpdating) {
      dispatch({ type: "SET_SCORE_UPDATING", payload: isScoreUpdating });
    }
  }, [isScoreUpdating, state.isScoreUpdating]);

  // Sync score last updated
  useEffect(() => {
    if (scoreLastUpdated !== state.scoreLastUpdated) {
      dispatch({ type: "SET_SCORE_LAST_UPDATED", payload: scoreLastUpdated });
    }
  }, [scoreLastUpdated, state.scoreLastUpdated]);

  // Undo/Redo history management
  const undoRedoInitialState: UndoableState = {
    content: initialState.content,
    styleSettings: initialState.styleSettings,
    sectionOrder: initialState.sectionOrder,
  };

  const {
    canUndo,
    canRedo,
    pushState: pushHistoryState,
    undo: undoHistory,
    redo: redoHistory,
  } = useUndoRedo<UndoableState>(undoRedoInitialState);

  // Track if we're currently applying an undo/redo to prevent pushing to history
  const isApplyingHistoryRef = useRef(false);

  // Push state to history when content, style, or section order changes
  // Debounced to avoid excessive history entries
  const lastPushedStateRef = useRef<string>("");
  useEffect(() => {
    if (state.isLoading || isApplyingHistoryRef.current) return;

    const currentState = getUndoableState(state);
    const stateHash = JSON.stringify(currentState);

    // Only push if state actually changed
    if (stateHash !== lastPushedStateRef.current) {
      const timer = setTimeout(() => {
        lastPushedStateRef.current = stateHash;
        pushHistoryState(currentState, "Edit");
      }, 500); // Debounce

      return () => clearTimeout(timer);
    }
  }, [state.content, state.styleSettings, state.sectionOrder, state.isLoading, pushHistoryState]);

  // Initialize history when data loads
  useEffect(() => {
    if (tailoredResume && !state.isLoading) {
      const initialUndoableState = getUndoableState(state);
      lastPushedStateRef.current = JSON.stringify(initialUndoableState);
    }
  }, [tailoredResume, state.isLoading]);

  const undo = useCallback(() => {
    const previousState = undoHistory();
    if (previousState) {
      isApplyingHistoryRef.current = true;
      dispatch({ type: "SET_CONTENT", payload: previousState.content });
      dispatch({ type: "SET_STYLE", payload: previousState.styleSettings });
      dispatch({ type: "SET_SECTION_ORDER", payload: previousState.sectionOrder });
      // Reset flag after a short delay to allow state to settle
      setTimeout(() => {
        isApplyingHistoryRef.current = false;
      }, 100);
    }
  }, [undoHistory]);

  const redo = useCallback(() => {
    const nextState = redoHistory();
    if (nextState) {
      isApplyingHistoryRef.current = true;
      dispatch({ type: "SET_CONTENT", payload: nextState.content });
      dispatch({ type: "SET_STYLE", payload: nextState.styleSettings });
      dispatch({ type: "SET_SECTION_ORDER", payload: nextState.sectionOrder });
      // Reset flag after a short delay to allow state to settle
      setTimeout(() => {
        isApplyingHistoryRef.current = false;
      }, 100);
    }
  }, [redoHistory]);

  // Save handler
  const save = useCallback(async () => {
    dispatch({ type: "SAVE_START" });
    try {
      const result = await updateMutation.mutateAsync({
        id: tailoredId,
        data: {
          tailored_content: state.content,
          style_settings: state.styleSettings,
          section_order: state.sectionOrder,
        },
      });
      dispatch({ type: "SAVE_SUCCESS", payload: result });
    } catch (err) {
      dispatch({
        type: "SAVE_ERROR",
        payload: err instanceof Error ? err.message : "Failed to save",
      });
    }
  }, [tailoredId, state.content, state.styleSettings, state.sectionOrder, updateMutation]);

  // Convenience methods
  const acceptSuggestion = useCallback(
    (index: number, suggestion: Suggestion) => {
      dispatch({ type: "ACCEPT_SUGGESTION", payload: { index, suggestion } });
    },
    []
  );

  const rejectSuggestion = useCallback((index: number) => {
    dispatch({ type: "REJECT_SUGGESTION", payload: index });
  }, []);

  const updateContent = useCallback(
    (content: Partial<TailoredContent>) => {
      dispatch({
        type: "SET_CONTENT",
        payload: { ...state.content, ...content },
      });
    },
    [state.content]
  );

  const updateStyle = useCallback((style: Partial<ResumeStyle>) => {
    dispatch({ type: "SET_STYLE", payload: style });
  }, []);

  const runATSAnalysis = useCallback(async () => {
    if (!state.jobDescription) return;
    try {
      // Convert tailored content to string for ATS analysis
      const resumeContentString = JSON.stringify(state.content);
      const result = await atsAnalysisMutation.mutateAsync({
        job_description: state.jobDescription,
        resume_content: resumeContentString,
      });
      dispatch({ type: "SET_ATS_ANALYSIS", payload: result });
    } catch (err) {
      console.error("ATS analysis failed:", err);
    }
  }, [state.jobDescription, state.content, atsAnalysisMutation]);

  // Generate AI suggestions based on a custom prompt
  // TODO: Connect to backend AI endpoint when available
  const generateAISuggestions = useCallback(
    async (prompt: string, focusSections?: string[]) => {
      console.log("[AI Rewrite] Generating suggestions with prompt:", prompt, "focus:", focusSections);

      // For now, show a placeholder message since the backend endpoint
      // for custom AI prompts may not exist yet
      // In the future, this will call an endpoint like:
      // POST /api/tailor/{id}/suggest with { prompt, focus_sections }

      // Simulate a short delay to show the loading state
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // TODO: Replace with actual API call when backend supports it
      // const result = await tailorApi.generateSuggestions(tailoredId, { prompt });
      // dispatch({ type: "SET_SUGGESTIONS", payload: result.suggestions });

      console.log("[AI Rewrite] Custom AI prompt feature coming soon");
    },
    []
  );

  const contextValue: WorkshopContextValue = {
    state,
    dispatch,
    save,
    acceptSuggestion,
    rejectSuggestion,
    updateContent,
    updateStyle,
    runATSAnalysis,
    generateAISuggestions,
    // Undo/Redo
    canUndo,
    canRedo,
    undo,
    redo,
  };

  return (
    <WorkshopContext.Provider value={contextValue}>
      {children}
    </WorkshopContext.Provider>
  );
}
