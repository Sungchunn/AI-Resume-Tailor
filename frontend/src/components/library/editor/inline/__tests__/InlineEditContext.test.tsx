import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { InlineEditProvider, useInlineEdit } from "../InlineEditContext";

// Mock TipTap editor
vi.mock("@tiptap/react", () => ({
  useEditor: () => ({
    commands: {
      setContent: vi.fn(),
      focus: vi.fn(),
    },
    getHTML: vi.fn(() => "<p>test content</p>"),
    getText: vi.fn(() => "test content"),
    on: vi.fn(),
    off: vi.fn(),
    destroy: vi.fn(),
  }),
}));

// Test component that uses the context
function TestConsumer({
  onContextValue,
}: {
  onContextValue?: (value: ReturnType<typeof useInlineEdit>) => void;
}) {
  const context = useInlineEdit();
  onContextValue?.(context);

  return (
    <div>
      <span data-testid="is-editing">{context.isEditing.toString()}</span>
      <span data-testid="is-dirty">{context.isDirty.toString()}</span>
      <span data-testid="editing-id">{context.editingElementId ?? "null"}</span>
      <span data-testid="original-value">{context.originalValue ?? "null"}</span>
      <button
        data-testid="start-edit"
        onClick={() => context.startEdit("test-1", "<p>Initial</p>")}
      >
        Start Edit
      </button>
      <button
        data-testid="commit-edit"
        onClick={() => context.commitEdit("<p>New Value</p>")}
      >
        Commit
      </button>
      <button data-testid="cancel-edit" onClick={() => context.cancelEdit()}>
        Cancel
      </button>
    </div>
  );
}

describe("InlineEditContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("InlineEditProvider", () => {
    it("provides initial state", () => {
      render(
        <InlineEditProvider>
          <TestConsumer />
        </InlineEditProvider>
      );

      expect(screen.getByTestId("is-editing")).toHaveTextContent("false");
      expect(screen.getByTestId("is-dirty")).toHaveTextContent("false");
      expect(screen.getByTestId("editing-id")).toHaveTextContent("null");
      expect(screen.getByTestId("original-value")).toHaveTextContent("null");
    });

    it("starts editing when startEdit is called", async () => {
      render(
        <InlineEditProvider>
          <TestConsumer />
        </InlineEditProvider>
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId("start-edit"));
      });

      expect(screen.getByTestId("is-editing")).toHaveTextContent("true");
      expect(screen.getByTestId("editing-id")).toHaveTextContent("test-1");
      expect(screen.getByTestId("original-value")).toHaveTextContent(
        "<p>Initial</p>"
      );
    });

    it("clears editing state when commitEdit is called", async () => {
      render(
        <InlineEditProvider>
          <TestConsumer />
        </InlineEditProvider>
      );

      // Start editing first
      await act(async () => {
        fireEvent.click(screen.getByTestId("start-edit"));
      });

      expect(screen.getByTestId("is-editing")).toHaveTextContent("true");

      // Then commit
      await act(async () => {
        fireEvent.click(screen.getByTestId("commit-edit"));
      });

      expect(screen.getByTestId("is-editing")).toHaveTextContent("false");
      expect(screen.getByTestId("editing-id")).toHaveTextContent("null");
      expect(screen.getByTestId("original-value")).toHaveTextContent("null");
    });

    it("clears editing state when cancelEdit is called", async () => {
      render(
        <InlineEditProvider>
          <TestConsumer />
        </InlineEditProvider>
      );

      // Start editing first
      await act(async () => {
        fireEvent.click(screen.getByTestId("start-edit"));
      });

      expect(screen.getByTestId("is-editing")).toHaveTextContent("true");

      // Then cancel
      await act(async () => {
        fireEvent.click(screen.getByTestId("cancel-edit"));
      });

      expect(screen.getByTestId("is-editing")).toHaveTextContent("false");
      expect(screen.getByTestId("editing-id")).toHaveTextContent("null");
    });

    it("calls onCommit callback when edit is committed", async () => {
      const mockOnCommit = vi.fn();

      render(
        <InlineEditProvider onCommit={mockOnCommit}>
          <TestConsumer />
        </InlineEditProvider>
      );

      // Start editing
      await act(async () => {
        fireEvent.click(screen.getByTestId("start-edit"));
      });

      // Commit
      await act(async () => {
        fireEvent.click(screen.getByTestId("commit-edit"));
      });

      expect(mockOnCommit).toHaveBeenCalledWith("test-1", "<p>New Value</p>");
    });
  });

  describe("useInlineEdit", () => {
    it("throws error when used outside provider", () => {
      // Suppress console error for this test
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer />);
      }).toThrow("useInlineEdit must be used within InlineEditProvider");

      consoleSpy.mockRestore();
    });
  });

  describe("commit handler registration", () => {
    it("calls registered commit handler on commit", async () => {
      const mockHandler = vi.fn();

      function TestWithHandler() {
        const context = useInlineEdit();

        // Register handler
        React.useEffect(() => {
          context.registerCommitHandler("test-1", mockHandler);
          return () => context.unregisterCommitHandler("test-1");
        }, [context]);

        return (
          <>
            <button
              onClick={() => context.startEdit("test-1", "<p>Initial</p>")}
            >
              Start
            </button>
            <button onClick={() => context.commitEdit("<p>New</p>")}>
              Commit
            </button>
          </>
        );
      }

      render(
        <InlineEditProvider>
          <TestWithHandler />
        </InlineEditProvider>
      );

      await act(async () => {
        fireEvent.click(screen.getByText("Start"));
      });

      await act(async () => {
        fireEvent.click(screen.getByText("Commit"));
      });

      expect(mockHandler).toHaveBeenCalledWith("<p>New</p>");
    });
  });
});

// Import React for the test with handler
import React from "react";
