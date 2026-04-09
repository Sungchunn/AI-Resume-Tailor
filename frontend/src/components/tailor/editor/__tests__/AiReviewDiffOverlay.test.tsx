import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { AiReviewDiffOverlay } from "../AiReviewDiffOverlay";
import type { BulletSuggestion } from "@/lib/stores/bulletSuggestionsStore";

function makeSuggestion(
  overrides?: Partial<BulletSuggestion>
): BulletSuggestion {
  return {
    id: "test-id",
    bulletId: "block1:entry-0:bullet-0",
    entryContext: { title: "Engineer", company: "Acme", dateRange: "2024-2025" },
    original: "Did some work on the project",
    suggested: "Improved system performance by 30% through optimization",
    reason: "Add quantifiable metrics",
    impact: "high",
    keywordsAdded: [],
    metricsAdded: false,
    status: "pending",
    ...overrides,
  };
}

describe("AiReviewDiffOverlay", () => {
  describe("rendering", () => {
    it("renders impact badge with correct text (uppercase)", () => {
      render(<AiReviewDiffOverlay suggestion={makeSuggestion()} />);
      expect(screen.getByText("HIGH")).toBeInTheDocument();
    });

    it("renders MEDIUM impact badge", () => {
      render(
        <AiReviewDiffOverlay
          suggestion={makeSuggestion({ impact: "medium" })}
        />
      );
      expect(screen.getByText("MEDIUM")).toBeInTheDocument();
    });

    it("renders LOW impact badge", () => {
      render(
        <AiReviewDiffOverlay suggestion={makeSuggestion({ impact: "low" })} />
      );
      expect(screen.getByText("LOW")).toBeInTheDocument();
    });

    it("renders original text inside a del element", () => {
      render(<AiReviewDiffOverlay suggestion={makeSuggestion()} />);
      const del = screen.getByText("Did some work on the project");
      expect(del.tagName).toBe("DEL");
    });

    it("renders suggested text", () => {
      render(<AiReviewDiffOverlay suggestion={makeSuggestion()} />);
      expect(
        screen.getByText(
          "Improved system performance by 30% through optimization"
        )
      ).toBeInTheDocument();
    });

    it("renders reason text", () => {
      render(<AiReviewDiffOverlay suggestion={makeSuggestion()} />);
      expect(
        screen.getByText("Add quantifiable metrics")
      ).toBeInTheDocument();
    });

    it('renders keyword badges with "+" prefix when keywordsAdded is non-empty', () => {
      render(
        <AiReviewDiffOverlay
          suggestion={makeSuggestion({ keywordsAdded: ["React", "Docker"] })}
        />
      );
      expect(screen.getByText("+React")).toBeInTheDocument();
      expect(screen.getByText("+Docker")).toBeInTheDocument();
    });

    it("does not render keyword section when keywordsAdded is empty", () => {
      render(
        <AiReviewDiffOverlay
          suggestion={makeSuggestion({ keywordsAdded: [] })}
        />
      );
      expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
    });

    it("renders Enter and Esc keyboard hints", () => {
      render(<AiReviewDiffOverlay suggestion={makeSuggestion()} />);
      expect(screen.getByText("Enter")).toBeInTheDocument();
      expect(screen.getByText("Esc")).toBeInTheDocument();
    });
  });
});
