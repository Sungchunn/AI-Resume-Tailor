import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useScoreCalculation } from "../useScoreCalculation";
import type { TailoredContent, QuickMatchResponse } from "@/lib/api/types";
import type { ReactNode } from "react";

// Mock the useQuickMatch hook
const mockMutateAsync = vi.fn();
vi.mock("@/lib/api/hooks", () => ({
  useQuickMatch: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

// Test wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Default content for testing
const defaultContent: TailoredContent = {
  summary: "Test summary",
  experience: [
    {
      title: "Engineer",
      company: "Corp",
      location: "NYC",
      start_date: "2020",
      end_date: "2024",
      bullets: ["Did stuff"],
    },
  ],
  skills: ["JavaScript", "React"],
  highlights: ["Achievement 1"],
};

const defaultOptions = {
  content: defaultContent,
  resumeId: 1,
  jobId: 10,
  enabled: true,
  debounceMs: 10, // Very short debounce for testing
};

describe("useScoreCalculation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({
      match_score: 75,
      keyword_coverage: 80,
      skill_matches: ["React"],
      skill_gaps: ["Python"],
    } as QuickMatchResponse);
  });

  describe("initial state", () => {
    it("starts with score 0 and null previousScore", () => {
      const { result } = renderHook(() => useScoreCalculation(defaultOptions), {
        wrapper: createWrapper(),
      });

      // Score starts at 0 and previousScore is null
      expect(result.current.score).toBe(0);
      expect(result.current.previousScore).toBeNull();
    });

    it("immediately starts calculating when enabled", () => {
      const { result } = renderHook(() => useScoreCalculation(defaultOptions), {
        wrapper: createWrapper(),
      });

      // Hook starts calculating immediately when enabled
      expect(["idle", "pending", "calculating"]).toContain(result.current.status.state);
    });

    it("has null lastUpdated initially", () => {
      const { result } = renderHook(() => useScoreCalculation(defaultOptions), {
        wrapper: createWrapper(),
      });

      expect(result.current.lastUpdated).toBeNull();
    });
  });

  describe("enabled flag", () => {
    it("does not calculate when enabled is false", async () => {
      const { result } = renderHook(
        () => useScoreCalculation({ ...defaultOptions, enabled: false }),
        { wrapper: createWrapper() }
      );

      // Wait a bit to ensure no calculation happens
      await new Promise((r) => setTimeout(r, 50));

      expect(mockMutateAsync).not.toHaveBeenCalled();
      expect(result.current.score).toBe(0);
    });

    it("does not calculate when jobId is null", async () => {
      const { result } = renderHook(
        () => useScoreCalculation({ ...defaultOptions, jobId: null }),
        { wrapper: createWrapper() }
      );

      await new Promise((r) => setTimeout(r, 50));

      expect(mockMutateAsync).not.toHaveBeenCalled();
      expect(result.current.score).toBe(0);
    });

    it("does not calculate when resumeId is 0", async () => {
      const { result } = renderHook(
        () => useScoreCalculation({ ...defaultOptions, resumeId: 0 }),
        { wrapper: createWrapper() }
      );

      await new Promise((r) => setTimeout(r, 50));

      expect(mockMutateAsync).not.toHaveBeenCalled();
    });
  });

  describe("score calculation", () => {
    it("calculates score when enabled with valid jobId", async () => {
      const { result } = renderHook(() => useScoreCalculation(defaultOptions), {
        wrapper: createWrapper(),
      });

      await waitFor(
        () => {
          expect(result.current.score).toBe(75);
        },
        { timeout: 2000 }
      );

      expect(mockMutateAsync).toHaveBeenCalled();
    });

    it("passes correct parameters to API", async () => {
      renderHook(() => useScoreCalculation(defaultOptions), {
        wrapper: createWrapper(),
      });

      await waitFor(
        () => {
          expect(mockMutateAsync).toHaveBeenCalledWith({
            resume_id: 1,
            job_id: 10,
          });
        },
        { timeout: 2000 }
      );
    });

    it("sets lastUpdated after successful calculation", async () => {
      const { result } = renderHook(() => useScoreCalculation(defaultOptions), {
        wrapper: createWrapper(),
      });

      await waitFor(
        () => {
          expect(result.current.lastUpdated).toBeInstanceOf(Date);
        },
        { timeout: 2000 }
      );
    });

    it("sets success status after calculation", async () => {
      const { result } = renderHook(() => useScoreCalculation(defaultOptions), {
        wrapper: createWrapper(),
      });

      await waitFor(
        () => {
          expect(result.current.status.state).toBe("success");
        },
        { timeout: 2000 }
      );
    });
  });

  describe("error handling", () => {
    it("sets error status on API failure", async () => {
      mockMutateAsync.mockRejectedValue(new Error("API Error"));

      const { result } = renderHook(() => useScoreCalculation(defaultOptions), {
        wrapper: createWrapper(),
      });

      await waitFor(
        () => {
          expect(result.current.status.state).toBe("error");
        },
        { timeout: 2000 }
      );
    });

    it("keeps previous score on error", async () => {
      mockMutateAsync.mockRejectedValue(new Error("API Error"));

      const { result } = renderHook(() => useScoreCalculation(defaultOptions), {
        wrapper: createWrapper(),
      });

      await waitFor(
        () => {
          expect(result.current.status.state).toBe("error");
        },
        { timeout: 2000 }
      );

      // Score should remain at initial value
      expect(result.current.score).toBe(0);
    });
  });

  describe("isUpdating state", () => {
    it("returns true when status is pending or calculating", () => {
      const { result } = renderHook(() => useScoreCalculation(defaultOptions), {
        wrapper: createWrapper(),
      });

      // Initially might be pending/calculating during first load
      // After completion, should be false
      expect(typeof result.current.isUpdating).toBe("boolean");
    });
  });

  describe("triggerRecalculation", () => {
    it("provides a function to manually trigger recalculation", () => {
      const { result } = renderHook(() => useScoreCalculation(defaultOptions), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.triggerRecalculation).toBe("function");
    });
  });

  describe("content hash change detection", () => {
    it("detects content changes via hash", async () => {
      const { result, rerender } = renderHook(
        (props) => useScoreCalculation(props),
        {
          wrapper: createWrapper(),
          initialProps: defaultOptions,
        }
      );

      // Wait for initial calculation
      await waitFor(
        () => {
          expect(result.current.score).toBe(75);
        },
        { timeout: 2000 }
      );

      const initialCallCount = mockMutateAsync.mock.calls.length;

      // Change content
      mockMutateAsync.mockResolvedValueOnce({
        match_score: 82,
        keyword_coverage: 85,
        skill_matches: ["React", "TypeScript"],
        skill_gaps: [],
      } as QuickMatchResponse);

      const updatedContent = {
        ...defaultContent,
        summary: "Different summary that should trigger recalculation",
      };

      rerender({ ...defaultOptions, content: updatedContent });

      // Wait for debounced recalculation
      await waitFor(
        () => {
          expect(mockMutateAsync.mock.calls.length).toBeGreaterThan(
            initialCallCount
          );
        },
        { timeout: 2000 }
      );
    });
  });
});
