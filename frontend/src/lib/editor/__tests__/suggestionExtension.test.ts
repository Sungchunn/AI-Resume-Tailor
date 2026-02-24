import { describe, it, expect, vi } from "vitest";
import {
  generateSuggestionId,
  impactColors,
  SuggestionExtension,
} from "../suggestionExtension";
import type { SuggestionMark, SuggestionImpact } from "../suggestionExtension";

describe("suggestionExtension", () => {
  describe("generateSuggestionId", () => {
    it("should generate a unique ID string", () => {
      const id = generateSuggestionId();
      expect(id).toBeDefined();
      expect(typeof id).toBe("string");
      expect(id).toMatch(/^suggestion-\d+-[a-z0-9]+$/);
    });

    it("should generate different IDs on each call", () => {
      const id1 = generateSuggestionId();
      const id2 = generateSuggestionId();
      expect(id1).not.toBe(id2);
    });

    it("should include timestamp component", () => {
      const beforeTime = Date.now();
      const id = generateSuggestionId();
      const afterTime = Date.now();

      const parts = id.split("-");
      const timestamp = parseInt(parts[1], 10);
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe("impactColors", () => {
    it("should have colors for all impact levels", () => {
      const impacts: SuggestionImpact[] = ["high", "medium", "low"];
      impacts.forEach((impact) => {
        expect(impactColors[impact]).toBeDefined();
        expect(impactColors[impact].bg).toBeDefined();
        expect(impactColors[impact].border).toBeDefined();
      });
    });

    it("should have red colors for high impact", () => {
      expect(impactColors.high.bg).toContain("239, 68, 68");
      expect(impactColors.high.border).toContain("239, 68, 68");
    });

    it("should have yellow colors for medium impact", () => {
      expect(impactColors.medium.bg).toContain("234, 179, 8");
      expect(impactColors.medium.border).toContain("234, 179, 8");
    });

    it("should have blue colors for low impact", () => {
      expect(impactColors.low.bg).toContain("59, 130, 246");
      expect(impactColors.low.border).toContain("59, 130, 246");
    });
  });

  describe("SuggestionExtension", () => {
    it("should have correct name", () => {
      expect(SuggestionExtension.name).toBe("suggestion");
    });

    it("should have default options", () => {
      const extension = SuggestionExtension.configure({});
      expect(extension.options).toBeDefined();
      expect(extension.options.onSuggestionClick).toBeUndefined();
    });

    it("should accept onSuggestionClick option", () => {
      const mockHandler = vi.fn();
      const extension = SuggestionExtension.configure({
        onSuggestionClick: mockHandler,
      });
      expect(extension.options.onSuggestionClick).toBe(mockHandler);
    });
  });

  describe("SuggestionMark type", () => {
    it("should accept valid suggestion mark objects", () => {
      const validMark: SuggestionMark = {
        id: "test-id",
        type: "replace",
        original: "old text",
        suggested: "new text",
        reason: "for testing",
        impact: "high",
        section: "experience",
      };

      expect(validMark.id).toBe("test-id");
      expect(validMark.type).toBe("replace");
      expect(validMark.original).toBe("old text");
      expect(validMark.suggested).toBe("new text");
      expect(validMark.reason).toBe("for testing");
      expect(validMark.impact).toBe("high");
      expect(validMark.section).toBe("experience");
    });

    it("should accept mark without optional section", () => {
      const markWithoutSection: SuggestionMark = {
        id: "test-id",
        type: "enhance",
        original: "text",
        suggested: "better text",
        reason: "improvement",
        impact: "low",
      };

      expect(markWithoutSection.section).toBeUndefined();
    });
  });
});
