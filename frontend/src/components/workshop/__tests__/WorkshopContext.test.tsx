import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useReducer, type ReactNode } from "react";
import {
  workshopReducer,
  initialState,
  DEFAULT_STYLE,
  DEFAULT_SECTION_ORDER,
  WorkshopContext,
  useWorkshop,
  type WorkshopState,
  type WorkshopAction,
} from "../WorkshopContext";
import type { TailoredResumeFullResponse, Suggestion } from "@/lib/api/types";

// Mock data for testing
const mockTailoredResume: TailoredResumeFullResponse = {
  id: "1",
  resume_id: "10",
  job_id: 20,
  job_listing_id: null,
  tailored_data: {
    summary: "Experienced software engineer",
    experience: [
      {
        title: "Senior Developer",
        company: "Tech Corp",
        location: "San Francisco, CA",
        start_date: "2020-01",
        end_date: "Present",
        bullets: ["Led development", "Improved performance"],
      },
    ],
    skills: ["React", "TypeScript"],
    highlights: ["Increased revenue"],
  },
  finalized_data: null,
  status: "draft",
  match_score: 85,
  skill_matches: ["React", "TypeScript"],
  skill_gaps: ["Python"],
  keyword_coverage: 75,
  job_title: "Software Engineer",
  company_name: "Tech Corp",
  style_settings: {
    font_family: "Inter",
    font_size_body: 10,
    font_size_heading: 16,
    font_size_subheading: 11,
    margin_top: 0.5,
    margin_bottom: 0.5,
    margin_left: 0.5,
    margin_right: 0.5,
    line_spacing: 1.3,
    section_spacing: 14,
  },
  section_order: ["experience", "skills", "summary", "highlights"],
  created_at: "2026-02-25T00:00:00Z",
  updated_at: null,
  finalized_at: null,
};

describe("workshopReducer", () => {
  describe("INIT_DATA", () => {
    it("initializes state from tailored resume data", () => {
      const state = workshopReducer(initialState, {
        type: "INIT_DATA",
        payload: mockTailoredResume,
      });

      expect(state.tailoredResume).toEqual(mockTailoredResume);
      expect(state.tailoredId).toBe(1);
      expect(state.content).toEqual(mockTailoredResume.tailored_data);
      expect(state.styleSettings).toEqual(mockTailoredResume.style_settings);
      expect(state.sectionOrder).toEqual(mockTailoredResume.section_order);
      expect(state.suggestions).toEqual([]); // Suggestions are now managed through state, not API response
      expect(state.isLoading).toBe(false);
      expect(state.hasChanges).toBe(false);
    });

    it("uses default style when style_settings is null", () => {
      const resumeWithoutStyle = {
        ...mockTailoredResume,
        style_settings: null,
      };

      const state = workshopReducer(initialState, {
        type: "INIT_DATA",
        payload: resumeWithoutStyle as unknown as TailoredResumeFullResponse,
      });

      expect(state.styleSettings).toEqual(DEFAULT_STYLE);
    });

    it("uses default section order when section_order is null", () => {
      const resumeWithoutOrder = {
        ...mockTailoredResume,
        section_order: null,
      };

      const state = workshopReducer(initialState, {
        type: "INIT_DATA",
        payload: resumeWithoutOrder as unknown as TailoredResumeFullResponse,
      });

      expect(state.sectionOrder).toEqual(DEFAULT_SECTION_ORDER);
    });
  });

  describe("SET_LOADING", () => {
    it("sets loading state to true", () => {
      const state = workshopReducer(initialState, {
        type: "SET_LOADING",
        payload: true,
      });

      expect(state.isLoading).toBe(true);
    });

    it("sets loading state to false", () => {
      const loadingState = { ...initialState, isLoading: true };
      const state = workshopReducer(loadingState, {
        type: "SET_LOADING",
        payload: false,
      });

      expect(state.isLoading).toBe(false);
    });
  });

  describe("SET_ERROR", () => {
    it("sets error message and clears loading", () => {
      const loadingState = { ...initialState, isLoading: true };
      const state = workshopReducer(loadingState, {
        type: "SET_ERROR",
        payload: "Something went wrong",
      });

      expect(state.error).toBe("Something went wrong");
      expect(state.isLoading).toBe(false);
    });

    it("clears error when set to null", () => {
      const errorState = { ...initialState, error: "Previous error" };
      const state = workshopReducer(errorState, {
        type: "SET_ERROR",
        payload: null,
      });

      expect(state.error).toBeNull();
    });
  });

  describe("SET_CONTENT", () => {
    it("updates content and sets hasChanges to true", () => {
      const newContent = {
        summary: "Updated summary",
        experience: [],
        skills: ["New Skill"],
        highlights: [],
      };

      const state = workshopReducer(initialState, {
        type: "SET_CONTENT",
        payload: newContent,
      });

      expect(state.content).toEqual(newContent);
      expect(state.hasChanges).toBe(true);
    });
  });

  describe("SET_STYLE", () => {
    it("merges partial style updates", () => {
      const state = workshopReducer(initialState, {
        type: "SET_STYLE",
        payload: { font_size_body: 12, line_spacing: 1.5 },
      });

      expect(state.styleSettings.font_size_body).toBe(12);
      expect(state.styleSettings.line_spacing).toBe(1.5);
      expect(state.styleSettings.font_family).toBe(DEFAULT_STYLE.font_family);
      expect(state.hasChanges).toBe(true);
    });
  });

  describe("SET_SECTION_ORDER", () => {
    it("updates section order", () => {
      const newOrder = ["skills", "experience", "summary", "highlights"];
      const state = workshopReducer(initialState, {
        type: "SET_SECTION_ORDER",
        payload: newOrder,
      });

      expect(state.sectionOrder).toEqual(newOrder);
      expect(state.hasChanges).toBe(true);
    });
  });

  describe("ACCEPT_SUGGESTION", () => {
    it("applies summary rewrite suggestion", () => {
      const stateWithSuggestion: WorkshopState = {
        ...initialState,
        content: {
          summary: "Old summary",
          experience: [],
          skills: [],
          highlights: [],
        },
        suggestions: [
          {
            section: "summary",
            type: "rewrite",
            original: "Old summary",
            suggested: "New improved summary",
            reason: "More impactful",
            impact: "high",
          },
        ],
      };

      const state = workshopReducer(stateWithSuggestion, {
        type: "ACCEPT_SUGGESTION",
        payload: {
          index: 0,
          suggestion: stateWithSuggestion.suggestions[0],
        },
      });

      expect(state.content.summary).toBe("New improved summary");
      expect(state.suggestions).toHaveLength(0);
      expect(state.hasChanges).toBe(true);
    });

    it("removes suggestion from list after accepting", () => {
      const stateWithSuggestions: WorkshopState = {
        ...initialState,
        suggestions: [
          {
            section: "summary",
            type: "rewrite",
            original: "Old",
            suggested: "New",
            reason: "Better",
            impact: "high",
          },
          {
            section: "skills",
            type: "add",
            original: "",
            suggested: "Python",
            reason: "Missing skill",
            impact: "medium",
          },
        ],
      };

      const state = workshopReducer(stateWithSuggestions, {
        type: "ACCEPT_SUGGESTION",
        payload: {
          index: 0,
          suggestion: stateWithSuggestions.suggestions[0],
        },
      });

      expect(state.suggestions).toHaveLength(1);
      expect(state.suggestions[0].section).toBe("skills");
    });
  });

  describe("REJECT_SUGGESTION", () => {
    it("removes suggestion without applying", () => {
      const stateWithSuggestion: WorkshopState = {
        ...initialState,
        content: {
          summary: "Original summary",
          experience: [],
          skills: [],
          highlights: [],
        },
        suggestions: [
          {
            section: "summary",
            type: "rewrite",
            original: "Original summary",
            suggested: "New summary",
            reason: "Better",
            impact: "high",
          },
        ],
      };

      const state = workshopReducer(stateWithSuggestion, {
        type: "REJECT_SUGGESTION",
        payload: 0,
      });

      expect(state.content.summary).toBe("Original summary");
      expect(state.suggestions).toHaveLength(0);
    });
  });

  describe("SET_ACTIVE_SECTION", () => {
    it("sets active section", () => {
      const state = workshopReducer(initialState, {
        type: "SET_ACTIVE_SECTION",
        payload: "experience",
      });

      expect(state.activeSection).toBe("experience");
    });

    it("clears active section when set to undefined", () => {
      const activeState = { ...initialState, activeSection: "skills" };
      const state = workshopReducer(activeState, {
        type: "SET_ACTIVE_SECTION",
        payload: undefined,
      });

      expect(state.activeSection).toBeUndefined();
    });
  });

  describe("SET_ACTIVE_TAB", () => {
    it("switches active tab", () => {
      const state = workshopReducer(initialState, {
        type: "SET_ACTIVE_TAB",
        payload: "editor",
      });

      expect(state.activeTab).toBe("editor");
    });

    it("can switch to all tab values", () => {
      let state = workshopReducer(initialState, {
        type: "SET_ACTIVE_TAB",
        payload: "ai-rewrite",
      });
      expect(state.activeTab).toBe("ai-rewrite");

      state = workshopReducer(state, {
        type: "SET_ACTIVE_TAB",
        payload: "editor",
      });
      expect(state.activeTab).toBe("editor");

      state = workshopReducer(state, {
        type: "SET_ACTIVE_TAB",
        payload: "style",
      });
      expect(state.activeTab).toBe("style");
    });
  });

  describe("SET_FIT_TO_ONE_PAGE", () => {
    it("enables fit to one page", () => {
      const state = workshopReducer(initialState, {
        type: "SET_FIT_TO_ONE_PAGE",
        payload: true,
      });

      expect(state.fitToOnePage).toBe(true);
    });

    it("disables fit to one page", () => {
      const enabledState = { ...initialState, fitToOnePage: true };
      const state = workshopReducer(enabledState, {
        type: "SET_FIT_TO_ONE_PAGE",
        payload: false,
      });

      expect(state.fitToOnePage).toBe(false);
    });
  });

  describe("SET_ATS_ANALYSIS", () => {
    it("sets ATS analysis data", () => {
      const atsData = {
        coverage_score: 85,
        required_coverage: 90,
        preferred_coverage: 75,
        required_matched: ["React", "TypeScript"],
        required_missing: ["Python"],
        preferred_matched: ["AWS"],
        preferred_missing: ["Docker"],
        nice_to_have_matched: [],
        nice_to_have_missing: [],
        missing_available_in_vault: [],
        missing_not_in_vault: ["Python"],
        all_keywords: [],
        suggestions: [],
        warnings: [],
      };

      const state = workshopReducer(initialState, {
        type: "SET_ATS_ANALYSIS",
        payload: atsData,
      });

      expect(state.atsAnalysis).toEqual(atsData);
    });
  });

  describe("SAVE_START", () => {
    it("sets isSaving to true", () => {
      const state = workshopReducer(initialState, { type: "SAVE_START" });

      expect(state.isSaving).toBe(true);
    });
  });

  describe("SAVE_SUCCESS", () => {
    it("updates tailored resume and clears saving state", () => {
      const savingState: WorkshopState = {
        ...initialState,
        isSaving: true,
        hasChanges: true,
      };

      const state = workshopReducer(savingState, {
        type: "SAVE_SUCCESS",
        payload: mockTailoredResume,
      });

      expect(state.tailoredResume).toEqual(mockTailoredResume);
      expect(state.isSaving).toBe(false);
      expect(state.hasChanges).toBe(false);
    });
  });

  describe("SAVE_ERROR", () => {
    it("sets error and clears saving state", () => {
      const savingState = { ...initialState, isSaving: true };
      const state = workshopReducer(savingState, {
        type: "SAVE_ERROR",
        payload: "Failed to save",
      });

      expect(state.error).toBe("Failed to save");
      expect(state.isSaving).toBe(false);
    });
  });

  describe("RESET_CHANGES", () => {
    it("resets content to original tailored resume values", () => {
      const modifiedState: WorkshopState = {
        ...initialState,
        tailoredResume: mockTailoredResume,
        content: {
          summary: "Modified summary",
          experience: [],
          skills: ["Modified"],
          highlights: [],
        },
        styleSettings: {
          ...DEFAULT_STYLE,
          font_size_body: 20,
        },
        sectionOrder: ["skills"],
        hasChanges: true,
      };

      const state = workshopReducer(modifiedState, { type: "RESET_CHANGES" });

      expect(state.content).toEqual(mockTailoredResume.tailored_data);
      expect(state.styleSettings).toEqual(mockTailoredResume.style_settings);
      expect(state.sectionOrder).toEqual(mockTailoredResume.section_order);
      expect(state.hasChanges).toBe(false);
    });
  });

  describe("SET_JOB_DESCRIPTION", () => {
    it("sets job description", () => {
      const state = workshopReducer(initialState, {
        type: "SET_JOB_DESCRIPTION",
        payload: "Looking for a senior developer...",
      });

      expect(state.jobDescription).toBe("Looking for a senior developer...");
    });
  });
});

describe("useWorkshop hook", () => {
  it("throws error when used outside provider", () => {
    expect(() => {
      renderHook(() => useWorkshop());
    }).toThrow("useWorkshop must be used within a WorkshopProvider");
  });
});

describe("DEFAULT_STYLE", () => {
  it("has all required style properties", () => {
    expect(DEFAULT_STYLE).toHaveProperty("font_family");
    expect(DEFAULT_STYLE).toHaveProperty("font_size_body");
    expect(DEFAULT_STYLE).toHaveProperty("font_size_heading");
    expect(DEFAULT_STYLE).toHaveProperty("font_size_subheading");
    expect(DEFAULT_STYLE).toHaveProperty("margin_top");
    expect(DEFAULT_STYLE).toHaveProperty("margin_bottom");
    expect(DEFAULT_STYLE).toHaveProperty("margin_left");
    expect(DEFAULT_STYLE).toHaveProperty("margin_right");
    expect(DEFAULT_STYLE).toHaveProperty("line_spacing");
    expect(DEFAULT_STYLE).toHaveProperty("section_spacing");
  });

  it("has reasonable default values", () => {
    expect(DEFAULT_STYLE.font_size_body).toBeGreaterThanOrEqual(10);
    expect(DEFAULT_STYLE.font_size_body).toBeLessThanOrEqual(14);
    expect(DEFAULT_STYLE.line_spacing).toBeGreaterThanOrEqual(1.0);
    expect(DEFAULT_STYLE.line_spacing).toBeLessThanOrEqual(2.0);
  });
});

describe("DEFAULT_SECTION_ORDER", () => {
  it("contains all expected sections", () => {
    expect(DEFAULT_SECTION_ORDER).toContain("summary");
    expect(DEFAULT_SECTION_ORDER).toContain("experience");
    expect(DEFAULT_SECTION_ORDER).toContain("skills");
    expect(DEFAULT_SECTION_ORDER).toContain("highlights");
  });
});

describe("initialState", () => {
  it("has correct initial values", () => {
    expect(initialState.tailoredId).toBe(0);
    expect(initialState.tailoredResume).toBeNull();
    expect(initialState.jobDescription).toBeNull();
    expect(initialState.content).toEqual({
      summary: "",
      experience: [],
      skills: [],
      highlights: [],
    });
    expect(initialState.styleSettings).toEqual(DEFAULT_STYLE);
    expect(initialState.sectionOrder).toEqual(DEFAULT_SECTION_ORDER);
    expect(initialState.suggestions).toEqual([]);
    expect(initialState.activeSection).toBeUndefined();
    expect(initialState.activeTab).toBe("ai-rewrite");
    expect(initialState.hasChanges).toBe(false);
    expect(initialState.isSaving).toBe(false);
    expect(initialState.isLoading).toBe(true);
    expect(initialState.error).toBeNull();
    expect(initialState.fitToOnePage).toBe(false);
    expect(initialState.atsAnalysis).toBeNull();
  });
});
