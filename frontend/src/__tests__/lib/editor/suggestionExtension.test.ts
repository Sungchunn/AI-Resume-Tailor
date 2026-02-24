/**
 * Tests for the TipTap Suggestion Extension.
 *
 * These tests cover the SuggestionExtension mark, utility functions,
 * and custom commands for managing inline AI suggestions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  SuggestionExtension,
  generateSuggestionId,
  impactColors,
  type SuggestionMark,
  type SuggestionImpact,
} from "@/lib/editor/suggestionExtension";

describe("SuggestionExtension", () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [
        StarterKit,
        SuggestionExtension.configure({
          onSuggestionClick: vi.fn(),
        }),
      ],
      content: "<p>This is some test content for suggestions.</p>",
    });
  });

  describe("generateSuggestionId", () => {
    it("generates a unique ID starting with 'suggestion-'", () => {
      const id = generateSuggestionId();
      expect(id).toMatch(/^suggestion-\d+-[a-z0-9]+$/);
    });

    it("generates unique IDs on multiple calls", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateSuggestionId());
      }
      expect(ids.size).toBe(100);
    });

    it("includes timestamp component", () => {
      const before = Date.now();
      const id = generateSuggestionId();
      const after = Date.now();

      // Extract timestamp from ID
      const parts = id.split("-");
      const timestamp = parseInt(parts[1], 10);

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe("impactColors", () => {
    it("defines colors for high impact", () => {
      expect(impactColors.high).toBeDefined();
      expect(impactColors.high.bg).toContain("rgba");
      expect(impactColors.high.border).toContain("rgb");
    });

    it("defines colors for medium impact", () => {
      expect(impactColors.medium).toBeDefined();
      expect(impactColors.medium.bg).toContain("rgba");
      expect(impactColors.medium.border).toContain("rgb");
    });

    it("defines colors for low impact", () => {
      expect(impactColors.low).toBeDefined();
      expect(impactColors.low.bg).toContain("rgba");
      expect(impactColors.low.border).toContain("rgb");
    });

    it("has distinct colors for each impact level", () => {
      expect(impactColors.high.bg).not.toBe(impactColors.medium.bg);
      expect(impactColors.medium.bg).not.toBe(impactColors.low.bg);
      expect(impactColors.high.bg).not.toBe(impactColors.low.bg);
    });

    it("uses red tones for high impact", () => {
      // Red-500 is 239, 68, 68
      expect(impactColors.high.border).toContain("239");
    });

    it("uses yellow tones for medium impact", () => {
      // Yellow-500 is 234, 179, 8
      expect(impactColors.medium.border).toContain("234");
    });

    it("uses blue tones for low impact", () => {
      // Blue-500 is 59, 130, 246
      expect(impactColors.low.border).toContain("59");
    });
  });

  describe("extension registration", () => {
    it("registers as a mark named 'suggestion'", () => {
      const suggestionMark = editor.schema.marks.suggestion;
      expect(suggestionMark).toBeDefined();
    });

    it("has the expected attributes", () => {
      const attrs = editor.schema.marks.suggestion.spec.attrs;
      expect(attrs).toHaveProperty("id");
      expect(attrs).toHaveProperty("type");
      expect(attrs).toHaveProperty("original");
      expect(attrs).toHaveProperty("suggested");
      expect(attrs).toHaveProperty("reason");
      expect(attrs).toHaveProperty("impact");
      expect(attrs).toHaveProperty("section");
    });

    it("has default attribute values", () => {
      const attrs = editor.schema.marks.suggestion.spec.attrs;
      expect(attrs?.id?.default).toBe(null);
      expect(attrs?.type?.default).toBe("replace");
      expect(attrs?.original?.default).toBe("");
      expect(attrs?.suggested?.default).toBe("");
      expect(attrs?.reason?.default).toBe("");
      expect(attrs?.impact?.default).toBe("medium");
      expect(attrs?.section?.default).toBe(null);
    });
  });

  describe("setSuggestion command", () => {
    it("applies suggestion mark to selected text", () => {
      const suggestion: SuggestionMark = {
        id: "test-id-1",
        type: "replace",
        original: "test",
        suggested: "testing",
        reason: "More specific",
        impact: "high",
        section: "summary",
      };

      // Select "test" in the content
      editor.commands.setTextSelection({ from: 14, to: 18 }); // "test"
      editor.commands.setSuggestion(suggestion);

      const html = editor.getHTML();
      expect(html).toContain('data-suggestion-id="test-id-1"');
      expect(html).toContain('data-impact="high"');
    });

    it("stores all suggestion metadata in attributes", () => {
      const suggestion: SuggestionMark = {
        id: "meta-test",
        type: "enhance",
        original: "content",
        suggested: "better content",
        reason: "Improved clarity",
        impact: "medium",
        section: "experience",
      };

      // Select "content" (position may vary, using approximate)
      editor.commands.setTextSelection({ from: 19, to: 26 });
      editor.commands.setSuggestion(suggestion);

      const html = editor.getHTML();
      expect(html).toContain('data-suggestion-type="enhance"');
      expect(html).toContain('data-original="content"');
      expect(html).toContain('data-suggested="better content"');
      expect(html).toContain('data-reason="Improved clarity"');
      expect(html).toContain('data-section="experience"');
    });
  });

  describe("removeSuggestionById command", () => {
    it("removes suggestion mark by ID while keeping text", () => {
      const suggestion: SuggestionMark = {
        id: "remove-test",
        type: "replace",
        original: "test",
        suggested: "testing",
        reason: "Test reason",
        impact: "low",
      };

      // Apply suggestion
      editor.commands.setTextSelection({ from: 14, to: 18 });
      editor.commands.setSuggestion(suggestion);

      // Verify it was applied
      expect(editor.getHTML()).toContain('data-suggestion-id="remove-test"');

      // Remove it
      editor.commands.removeSuggestionById("remove-test");

      // Verify it was removed but text remains
      expect(editor.getHTML()).not.toContain("data-suggestion-id");
      expect(editor.getText()).toContain("test");
    });

    it("returns false when ID not found", () => {
      const result = editor.commands.removeSuggestionById("nonexistent-id");
      expect(result).toBe(false);
    });

    it("only removes the specific suggestion by ID", () => {
      const suggestion1: SuggestionMark = {
        id: "suggestion-1",
        type: "replace",
        original: "This",
        suggested: "That",
        reason: "Reason 1",
        impact: "high",
      };
      const suggestion2: SuggestionMark = {
        id: "suggestion-2",
        type: "replace",
        original: "test",
        suggested: "testing",
        reason: "Reason 2",
        impact: "low",
      };

      // Apply both suggestions
      editor.commands.setTextSelection({ from: 1, to: 5 }); // "This"
      editor.commands.setSuggestion(suggestion1);
      editor.commands.setTextSelection({ from: 14, to: 18 }); // "test"
      editor.commands.setSuggestion(suggestion2);

      // Remove only suggestion-1
      editor.commands.removeSuggestionById("suggestion-1");

      const html = editor.getHTML();
      expect(html).not.toContain("suggestion-1");
      expect(html).toContain("suggestion-2");
    });
  });

  describe("acceptSuggestion command", () => {
    it("replaces original text with suggested text", () => {
      const suggestion: SuggestionMark = {
        id: "accept-test",
        type: "replace",
        original: "test",
        suggested: "examination",
        reason: "More formal",
        impact: "high",
      };

      // Apply suggestion
      editor.commands.setTextSelection({ from: 14, to: 18 });
      editor.commands.setSuggestion(suggestion);

      // Accept it
      editor.commands.acceptSuggestion("accept-test");

      // Verify text was replaced
      expect(editor.getText()).toContain("examination");
      expect(editor.getText()).not.toContain(" test ");

      // Verify mark was removed
      expect(editor.getHTML()).not.toContain("data-suggestion-id");
    });

    it("returns false when ID not found", () => {
      const result = editor.commands.acceptSuggestion("nonexistent-id");
      expect(result).toBe(false);
    });
  });

  describe("clearAllSuggestions command", () => {
    it("removes all suggestion marks", () => {
      // Apply multiple suggestions
      const suggestions: SuggestionMark[] = [
        { id: "s1", type: "replace", original: "This", suggested: "That", reason: "R1", impact: "high" },
        { id: "s2", type: "replace", original: "test", suggested: "exam", reason: "R2", impact: "medium" },
      ];

      editor.commands.setTextSelection({ from: 1, to: 5 });
      editor.commands.setSuggestion(suggestions[0]);
      editor.commands.setTextSelection({ from: 14, to: 18 });
      editor.commands.setSuggestion(suggestions[1]);

      // Verify they were applied
      expect(editor.getHTML()).toContain("s1");
      expect(editor.getHTML()).toContain("s2");

      // Clear all
      editor.commands.clearAllSuggestions();

      // Verify all removed
      expect(editor.getHTML()).not.toContain("data-suggestion-id");

      // But text remains
      expect(editor.getText()).toContain("This");
      expect(editor.getText()).toContain("test");
    });

    it("returns true even when no suggestions exist", () => {
      const result = editor.commands.clearAllSuggestions();
      expect(result).toBe(true);
    });
  });

  describe("click handler", () => {
    it("configures with onSuggestionClick callback", () => {
      const mockCallback = vi.fn();

      const editorWithCallback = new Editor({
        extensions: [
          StarterKit,
          SuggestionExtension.configure({
            onSuggestionClick: mockCallback,
          }),
        ],
        content: "<p>Test content</p>",
      });

      // The callback is configured (we can't easily test the actual click without DOM events)
      expect(editorWithCallback).toBeDefined();
      editorWithCallback.destroy();
    });
  });

  describe("HTML rendering", () => {
    it("renders as span element with data attributes", () => {
      const suggestion: SuggestionMark = {
        id: "render-test",
        type: "replace",
        original: "test",
        suggested: "testing",
        reason: "Test reason",
        impact: "high",
      };

      editor.commands.setTextSelection({ from: 14, to: 18 });
      editor.commands.setSuggestion(suggestion);

      const html = editor.getHTML();

      // Should be a span with data attributes
      expect(html).toMatch(/<span[^>]*data-suggestion-id="render-test"/);
      expect(html).toContain('class="suggestion-mark');
    });

    it("applies correct styling based on impact level", () => {
      const impacts: SuggestionImpact[] = ["high", "medium", "low"];

      impacts.forEach((impact) => {
        const testEditor = new Editor({
          extensions: [StarterKit, SuggestionExtension],
          content: "<p>Test text here</p>",
        });

        const suggestion: SuggestionMark = {
          id: `impact-${impact}`,
          type: "replace",
          original: "Test",
          suggested: "Testing",
          reason: "Reason",
          impact,
        };

        testEditor.commands.setTextSelection({ from: 1, to: 5 });
        testEditor.commands.setSuggestion(suggestion);

        const html = testEditor.getHTML();
        expect(html).toContain(`data-impact="${impact}"`);
        expect(html).toContain(impactColors[impact].bg);

        testEditor.destroy();
      });
    });
  });

  describe("HTML parsing", () => {
    it("parses suggestion marks from HTML", () => {
      const htmlWithSuggestion = `
        <p>This is
          <span
            data-suggestion-id="parse-test"
            data-suggestion-type="enhance"
            data-original="important"
            data-suggested="crucial"
            data-reason="Stronger word"
            data-impact="high"
            data-section="summary"
          >important</span>
          content.
        </p>
      `;

      const parseEditor = new Editor({
        extensions: [StarterKit, SuggestionExtension],
        content: htmlWithSuggestion,
      });

      const outputHtml = parseEditor.getHTML();
      expect(outputHtml).toContain('data-suggestion-id="parse-test"');
      expect(outputHtml).toContain('data-suggestion-type="enhance"');

      parseEditor.destroy();
    });
  });
});

describe("SuggestionMark type", () => {
  it("has all required properties", () => {
    const mark: SuggestionMark = {
      id: "type-test",
      type: "replace",
      original: "original text",
      suggested: "suggested text",
      reason: "test reason",
      impact: "high",
    };

    expect(mark.id).toBeDefined();
    expect(mark.type).toBeDefined();
    expect(mark.original).toBeDefined();
    expect(mark.suggested).toBeDefined();
    expect(mark.reason).toBeDefined();
    expect(mark.impact).toBeDefined();
  });

  it("section is optional", () => {
    const markWithSection: SuggestionMark = {
      id: "with-section",
      type: "replace",
      original: "text",
      suggested: "new text",
      reason: "reason",
      impact: "medium",
      section: "experience",
    };

    const markWithoutSection: SuggestionMark = {
      id: "without-section",
      type: "replace",
      original: "text",
      suggested: "new text",
      reason: "reason",
      impact: "low",
    };

    expect(markWithSection.section).toBe("experience");
    expect(markWithoutSection.section).toBeUndefined();
  });

  it("impact must be valid value", () => {
    const validImpacts: SuggestionImpact[] = ["high", "medium", "low"];

    validImpacts.forEach((impact) => {
      const mark: SuggestionMark = {
        id: `impact-${impact}`,
        type: "replace",
        original: "text",
        suggested: "new",
        reason: "reason",
        impact,
      };
      expect(mark.impact).toBe(impact);
    });
  });
});
