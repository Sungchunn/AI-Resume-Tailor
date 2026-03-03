"use client";

import { createContext, useContext } from "react";
import type {
  TailoredContent,
  ResumeStyle,
  Suggestion,
  TailoredResumeFullResponse,
  ATSKeywordDetailedResponse,
} from "@/lib/api/types";

export type WorkshopTab = "ai-rewrite" | "editor" | "style";

export interface WorkshopState {
  // Data
  tailoredId: string;
  tailoredResume: TailoredResumeFullResponse | null;
  jobDescription: string | null;

  // Editable state
  content: TailoredContent;
  styleSettings: ResumeStyle;
  sectionOrder: string[];
  suggestions: Suggestion[];

  // UI state
  activeSection: string | undefined;
  activeTab: WorkshopTab;
  hasChanges: boolean;
  isSaving: boolean;
  isLoading: boolean;
  error: string | null;
  fitToOnePage: boolean;

  // ATS analysis
  atsAnalysis: ATSKeywordDetailedResponse | null;

  // Real-time score tracking
  matchScore: number;
  previousMatchScore: number | null;
  scoreLastUpdated: Date | null;
  isScoreUpdating: boolean;
}

export type WorkshopAction =
  | { type: "INIT_DATA"; payload: TailoredResumeFullResponse }
  | { type: "SET_JOB_DESCRIPTION"; payload: string | null }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_CONTENT"; payload: TailoredContent }
  | { type: "SET_STYLE"; payload: Partial<ResumeStyle> }
  | { type: "SET_SECTION_ORDER"; payload: string[] }
  | { type: "ACCEPT_SUGGESTION"; payload: { index: number; suggestion: Suggestion } }
  | { type: "REJECT_SUGGESTION"; payload: number }
  | { type: "SET_ACTIVE_SECTION"; payload: string | undefined }
  | { type: "SET_ACTIVE_TAB"; payload: WorkshopTab }
  | { type: "SET_FIT_TO_ONE_PAGE"; payload: boolean }
  | { type: "SET_ATS_ANALYSIS"; payload: ATSKeywordDetailedResponse | null }
  | { type: "SAVE_START" }
  | { type: "SAVE_SUCCESS"; payload: TailoredResumeFullResponse }
  | { type: "SAVE_ERROR"; payload: string }
  | { type: "RESET_CHANGES" }
  | { type: "SET_MATCH_SCORE"; payload: { score: number; previous?: number | null } }
  | { type: "SET_SCORE_UPDATING"; payload: boolean }
  | { type: "SET_SCORE_LAST_UPDATED"; payload: Date | null };

export interface WorkshopContextValue {
  state: WorkshopState;
  dispatch: React.Dispatch<WorkshopAction>;

  // Convenience methods
  save: () => Promise<void>;
  acceptSuggestion: (index: number, suggestion: Suggestion) => void;
  rejectSuggestion: (index: number) => void;
  updateContent: (content: Partial<TailoredContent>) => void;
  updateStyle: (style: Partial<ResumeStyle>) => void;
  runATSAnalysis: () => Promise<void>;
  generateAISuggestions: (prompt: string, focusSections?: string[]) => Promise<void>;

  // Undo/Redo
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

// Default values
export const DEFAULT_STYLE: ResumeStyle = {
  font_family: "Arial",
  font_size_body: 11,
  font_size_heading: 18,
  font_size_subheading: 12,
  margin_top: 0.75,
  margin_bottom: 0.75,
  margin_left: 0.75,
  margin_right: 0.75,
  line_spacing: 1.4,
  section_spacing: 16,
};

export const DEFAULT_SECTION_ORDER = [
  "summary",
  "experience",
  "skills",
  "highlights",
];

export const initialState: WorkshopState = {
  tailoredId: "",
  tailoredResume: null,
  jobDescription: null,
  content: { summary: "", experience: [], skills: [], highlights: [] },
  styleSettings: DEFAULT_STYLE,
  sectionOrder: DEFAULT_SECTION_ORDER,
  suggestions: [],
  activeSection: undefined,
  activeTab: "ai-rewrite",
  hasChanges: false,
  isSaving: false,
  isLoading: true,
  error: null,
  fitToOnePage: false,
  atsAnalysis: null,
  // Real-time score tracking
  matchScore: 0,
  previousMatchScore: null,
  scoreLastUpdated: null,
  isScoreUpdating: false,
};

// Helper function to apply suggestion to content
function applySuggestionToContent(
  content: TailoredContent,
  suggestion: Suggestion
): TailoredContent {
  const { section, type, suggested } = suggestion;

  switch (section) {
    case "summary":
      if (type === "rewrite" || type === "replace") {
        return { ...content, summary: suggested };
      }
      break;
    case "experience":
      // Handle experience bullet updates - would need more context to know which bullet
      break;
    case "skills":
      if (type === "add") {
        return { ...content, skills: [...content.skills, suggested] };
      }
      break;
    case "highlights":
      if (type === "add") {
        return { ...content, highlights: [...content.highlights, suggested] };
      }
      break;
  }

  return content;
}

export function workshopReducer(
  state: WorkshopState,
  action: WorkshopAction
): WorkshopState {
  switch (action.type) {
    case "INIT_DATA":
      return {
        ...state,
        tailoredResume: action.payload,
        tailoredId: action.payload.id,
        content: action.payload.finalized_data ?? action.payload.tailored_data,
        styleSettings: action.payload.style_settings ?? DEFAULT_STYLE,
        sectionOrder: action.payload.section_order ?? DEFAULT_SECTION_ORDER,
        suggestions: [],
        isLoading: false,
        hasChanges: false,
        matchScore: action.payload.match_score ?? 0,
        previousMatchScore: null,
        scoreLastUpdated: null,
        isScoreUpdating: false,
      };

    case "SET_JOB_DESCRIPTION":
      return { ...state, jobDescription: action.payload };

    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "SET_ERROR":
      return { ...state, error: action.payload, isLoading: false };

    case "SET_CONTENT":
      return { ...state, content: action.payload, hasChanges: true };

    case "SET_STYLE":
      return {
        ...state,
        styleSettings: { ...state.styleSettings, ...action.payload },
        hasChanges: true,
      };

    case "SET_SECTION_ORDER":
      return { ...state, sectionOrder: action.payload, hasChanges: true };

    case "ACCEPT_SUGGESTION": {
      const { index, suggestion } = action.payload;
      // Apply suggestion to content
      const updatedContent = applySuggestionToContent(state.content, suggestion);
      // Remove suggestion from list
      const updatedSuggestions = state.suggestions.filter((_, i) => i !== index);
      return {
        ...state,
        content: updatedContent,
        suggestions: updatedSuggestions,
        hasChanges: true,
      };
    }

    case "REJECT_SUGGESTION":
      return {
        ...state,
        suggestions: state.suggestions.filter((_, i) => i !== action.payload),
      };

    case "SET_ACTIVE_SECTION":
      return { ...state, activeSection: action.payload };

    case "SET_ACTIVE_TAB":
      return { ...state, activeTab: action.payload };

    case "SET_FIT_TO_ONE_PAGE":
      return { ...state, fitToOnePage: action.payload };

    case "SET_ATS_ANALYSIS":
      return { ...state, atsAnalysis: action.payload };

    case "SAVE_START":
      return { ...state, isSaving: true };

    case "SAVE_SUCCESS":
      return {
        ...state,
        tailoredResume: action.payload,
        isSaving: false,
        hasChanges: false,
      };

    case "SAVE_ERROR":
      return { ...state, isSaving: false, error: action.payload };

    case "RESET_CHANGES":
      return {
        ...state,
        content: state.tailoredResume?.finalized_data ?? state.tailoredResume?.tailored_data ?? state.content,
        styleSettings: state.tailoredResume?.style_settings ?? DEFAULT_STYLE,
        sectionOrder:
          state.tailoredResume?.section_order ?? DEFAULT_SECTION_ORDER,
        hasChanges: false,
      };

    case "SET_MATCH_SCORE":
      return {
        ...state,
        matchScore: action.payload.score,
        previousMatchScore: action.payload.previous ?? state.previousMatchScore,
      };

    case "SET_SCORE_UPDATING":
      return { ...state, isScoreUpdating: action.payload };

    case "SET_SCORE_LAST_UPDATED":
      return { ...state, scoreLastUpdated: action.payload };

    default:
      return state;
  }
}

export const WorkshopContext = createContext<WorkshopContextValue | null>(null);

export function useWorkshop(): WorkshopContextValue {
  const context = useContext(WorkshopContext);
  if (!context) {
    throw new Error("useWorkshop must be used within a WorkshopProvider");
  }
  return context;
}
