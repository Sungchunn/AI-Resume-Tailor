import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BulletSuggestionCard } from "../BulletSuggestionCard";
import type { BulletSuggestion } from "@/lib/stores/bulletSuggestionsStore";

function makeSuggestion(
  overrides?: Partial<BulletSuggestion>
): BulletSuggestion {
  return {
    id: "test-id",
    bulletId: "block1:entry-0:bullet-0",
    entryContext: { title: "Engineer", company: "Acme", dateRange: "2024-2025" },
    original: "Worked on various tasks",
    suggested: "Delivered 5 features reducing churn by 15%",
    reason: "Quantify impact",
    impact: "high",
    keywordsAdded: [],
    metricsAdded: false,
    status: "pending",
    ...overrides,
  };
}

const noop = () => {};

describe("BulletSuggestionCard", () => {
  describe("rendering", () => {
    it("renders impact badge (HIGH)", () => {
      render(
        <BulletSuggestionCard
          suggestion={makeSuggestion()}
          onAccept={noop}
          onReject={noop}
        />
      );
      expect(screen.getByText("HIGH")).toBeInTheDocument();
    });

    it("renders MEDIUM impact badge", () => {
      render(
        <BulletSuggestionCard
          suggestion={makeSuggestion({ impact: "medium" })}
          onAccept={noop}
          onReject={noop}
        />
      );
      expect(screen.getByText("MEDIUM")).toBeInTheDocument();
    });

    it("renders LOW impact badge", () => {
      render(
        <BulletSuggestionCard
          suggestion={makeSuggestion({ impact: "low" })}
          onAccept={noop}
          onReject={noop}
        />
      );
      expect(screen.getByText("LOW")).toBeInTheDocument();
    });

    it("renders original text with strikethrough", () => {
      render(
        <BulletSuggestionCard
          suggestion={makeSuggestion()}
          onAccept={noop}
          onReject={noop}
        />
      );
      const original = screen.getByText("Worked on various tasks");
      expect(original.className).toContain("line-through");
    });

    it("renders suggested text", () => {
      render(
        <BulletSuggestionCard
          suggestion={makeSuggestion()}
          onAccept={noop}
          onReject={noop}
        />
      );
      expect(
        screen.getByText("Delivered 5 features reducing churn by 15%")
      ).toBeInTheDocument();
    });

    it("renders reason text", () => {
      render(
        <BulletSuggestionCard
          suggestion={makeSuggestion()}
          onAccept={noop}
          onReject={noop}
        />
      );
      expect(screen.getByText("Quantify impact")).toBeInTheDocument();
    });

    it('renders "+Metrics" badge when metricsAdded=true', () => {
      render(
        <BulletSuggestionCard
          suggestion={makeSuggestion({ metricsAdded: true })}
          onAccept={noop}
          onReject={noop}
        />
      );
      expect(screen.getByText("+Metrics")).toBeInTheDocument();
    });

    it('does not render "+Metrics" badge when metricsAdded=false', () => {
      render(
        <BulletSuggestionCard
          suggestion={makeSuggestion({ metricsAdded: false })}
          onAccept={noop}
          onReject={noop}
        />
      );
      expect(screen.queryByText("+Metrics")).not.toBeInTheDocument();
    });

    it('renders keyword badges with "+" prefix', () => {
      render(
        <BulletSuggestionCard
          suggestion={makeSuggestion({ keywordsAdded: ["AWS", "Terraform"] })}
          onAccept={noop}
          onReject={noop}
        />
      );
      expect(screen.getByText("+AWS")).toBeInTheDocument();
      expect(screen.getByText("+Terraform")).toBeInTheDocument();
    });

    it("does not render keyword badges when keywordsAdded is empty", () => {
      render(
        <BulletSuggestionCard
          suggestion={makeSuggestion({ keywordsAdded: [] })}
          onAccept={noop}
          onReject={noop}
        />
      );
      expect(screen.queryByText(/^\+(?!Metrics)/)).not.toBeInTheDocument();
    });
  });

  describe("actions", () => {
    it("calls onAccept when Accept button clicked", async () => {
      const onAccept = vi.fn();
      const user = userEvent.setup();

      render(
        <BulletSuggestionCard
          suggestion={makeSuggestion()}
          onAccept={onAccept}
          onReject={noop}
        />
      );

      await user.click(screen.getByRole("button", { name: /accept/i }));
      expect(onAccept).toHaveBeenCalledOnce();
    });

    it("calls onReject when Reject button clicked", async () => {
      const onReject = vi.fn();
      const user = userEvent.setup();

      render(
        <BulletSuggestionCard
          suggestion={makeSuggestion()}
          onAccept={noop}
          onReject={onReject}
        />
      );

      await user.click(screen.getByRole("button", { name: /reject/i }));
      expect(onReject).toHaveBeenCalledOnce();
    });
  });

  describe("focus", () => {
    it("focuses card element when isFirst=true", () => {
      render(
        <BulletSuggestionCard
          suggestion={makeSuggestion()}
          onAccept={noop}
          onReject={noop}
          isFirst
        />
      );

      // The card div has tabIndex=0 and should be focused
      const card = screen.getByText("Worked on various tasks").closest(
        "[tabindex='0']"
      );
      expect(card).toBe(document.activeElement);
    });
  });
});
