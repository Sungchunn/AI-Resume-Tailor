import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AIPromptInput } from "../AIPromptInput";

describe("AIPromptInput", () => {
  const defaultProps = {
    onSubmit: vi.fn().mockResolvedValue(undefined),
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders Quick Actions section", () => {
      render(<AIPromptInput {...defaultProps} />);

      expect(screen.getByText("Quick Actions")).toBeInTheDocument();
    });

    it("renders Custom Request section", () => {
      render(<AIPromptInput {...defaultProps} />);

      expect(screen.getByText("Custom Request")).toBeInTheDocument();
    });

    it("renders all quick prompt buttons", () => {
      render(<AIPromptInput {...defaultProps} />);

      expect(screen.getByText("More concise")).toBeInTheDocument();
      expect(screen.getByText("Add metrics")).toBeInTheDocument();
      expect(screen.getByText("Stronger verbs")).toBeInTheDocument();
      expect(screen.getByText("Match keywords")).toBeInTheDocument();
    });

    it("renders text input with placeholder", () => {
      render(<AIPromptInput {...defaultProps} />);

      const input = screen.getByPlaceholderText("Ask AI to improve your resume...");
      expect(input).toBeInTheDocument();
    });

    it("renders Generate button", () => {
      render(<AIPromptInput {...defaultProps} />);

      expect(screen.getByText("Generate")).toBeInTheDocument();
    });

    it("renders helper text", () => {
      render(<AIPromptInput {...defaultProps} />);

      expect(
        screen.getByText("Describe how you want AI to improve your resume")
      ).toBeInTheDocument();
    });
  });

  describe("custom placeholder", () => {
    it("accepts custom placeholder text", () => {
      render(<AIPromptInput {...defaultProps} placeholder="Custom placeholder..." />);

      const input = screen.getByPlaceholderText("Custom placeholder...");
      expect(input).toBeInTheDocument();
    });
  });

  describe("quick prompts", () => {
    it("calls onSubmit with 'More concise' prompt", async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      render(<AIPromptInput {...defaultProps} onSubmit={onSubmit} />);

      fireEvent.click(screen.getByText("More concise"));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          "Make my resume more concise and impactful"
        );
      });
    });

    it("calls onSubmit with 'Add metrics' prompt", async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      render(<AIPromptInput {...defaultProps} onSubmit={onSubmit} />);

      fireEvent.click(screen.getByText("Add metrics"));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          "Add quantifiable metrics and achievements"
        );
      });
    });

    it("calls onSubmit with 'Stronger verbs' prompt", async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      render(<AIPromptInput {...defaultProps} onSubmit={onSubmit} />);

      fireEvent.click(screen.getByText("Stronger verbs"));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          "Use stronger action verbs throughout"
        );
      });
    });

    it("calls onSubmit with 'Match keywords' prompt", async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      render(<AIPromptInput {...defaultProps} onSubmit={onSubmit} />);

      fireEvent.click(screen.getByText("Match keywords"));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          "Better align with the job keywords"
        );
      });
    });

    it("disables quick prompts when loading", () => {
      render(<AIPromptInput {...defaultProps} isLoading />);

      const buttons = screen.getAllByRole("button");
      buttons.forEach((button) => {
        // Only quick prompt buttons (not the Generate button)
        if (
          button.textContent?.includes("concise") ||
          button.textContent?.includes("metrics") ||
          button.textContent?.includes("verbs") ||
          button.textContent?.includes("keywords")
        ) {
          expect(button).toBeDisabled();
        }
      });
    });

    it("does not call onSubmit when loading", () => {
      const onSubmit = vi.fn();
      render(<AIPromptInput {...defaultProps} onSubmit={onSubmit} isLoading />);

      fireEvent.click(screen.getByText("More concise"));

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe("custom input form", () => {
    it("updates input value on change", () => {
      render(<AIPromptInput {...defaultProps} />);

      const input = screen.getByPlaceholderText("Ask AI to improve your resume...");
      fireEvent.change(input, { target: { value: "Make it better" } });

      expect(input).toHaveValue("Make it better");
    });

    it("calls onSubmit with custom prompt on form submit", async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      render(<AIPromptInput {...defaultProps} onSubmit={onSubmit} />);

      const input = screen.getByPlaceholderText("Ask AI to improve your resume...");
      fireEvent.change(input, { target: { value: "My custom prompt" } });
      fireEvent.submit(input.closest("form")!);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith("My custom prompt");
      });
    });

    it("trims whitespace from prompt", async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      render(<AIPromptInput {...defaultProps} onSubmit={onSubmit} />);

      const input = screen.getByPlaceholderText("Ask AI to improve your resume...");
      fireEvent.change(input, { target: { value: "  padded prompt  " } });
      fireEvent.submit(input.closest("form")!);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith("padded prompt");
      });
    });

    it("clears input after successful submit", async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      render(<AIPromptInput {...defaultProps} onSubmit={onSubmit} />);

      const input = screen.getByPlaceholderText("Ask AI to improve your resume...");
      fireEvent.change(input, { target: { value: "My prompt" } });
      fireEvent.submit(input.closest("form")!);

      await waitFor(() => {
        expect(input).toHaveValue("");
      });
    });

    it("does not submit empty prompt", () => {
      const onSubmit = vi.fn();
      render(<AIPromptInput {...defaultProps} onSubmit={onSubmit} />);

      const input = screen.getByPlaceholderText("Ask AI to improve your resume...");
      fireEvent.submit(input.closest("form")!);

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("does not submit whitespace-only prompt", () => {
      const onSubmit = vi.fn();
      render(<AIPromptInput {...defaultProps} onSubmit={onSubmit} />);

      const input = screen.getByPlaceholderText("Ask AI to improve your resume...");
      fireEvent.change(input, { target: { value: "   " } });
      fireEvent.submit(input.closest("form")!);

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("does not submit when loading", () => {
      const onSubmit = vi.fn();
      render(<AIPromptInput {...defaultProps} onSubmit={onSubmit} isLoading />);

      const input = screen.getByPlaceholderText("Ask AI to improve your resume...");
      fireEvent.change(input, { target: { value: "My prompt" } });
      fireEvent.submit(input.closest("form")!);

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe("Generate button", () => {
    it("is disabled when input is empty", () => {
      render(<AIPromptInput {...defaultProps} />);

      const button = screen.getByText("Generate").closest("button");
      expect(button).toBeDisabled();
    });

    it("is enabled when input has text", () => {
      render(<AIPromptInput {...defaultProps} />);

      const input = screen.getByPlaceholderText("Ask AI to improve your resume...");
      fireEvent.change(input, { target: { value: "My prompt" } });

      const button = screen.getByText("Generate").closest("button");
      expect(button).not.toBeDisabled();
    });

    it("is disabled when loading", () => {
      render(<AIPromptInput {...defaultProps} isLoading />);

      // When loading, button shows "Generating..." instead of "Generate"
      const button = screen.getByText("Generating...").closest("button");
      expect(button).toBeDisabled();
    });

    it("submits form when clicked", async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      render(<AIPromptInput {...defaultProps} onSubmit={onSubmit} />);

      const input = screen.getByPlaceholderText("Ask AI to improve your resume...");
      fireEvent.change(input, { target: { value: "My prompt" } });
      fireEvent.click(screen.getByText("Generate"));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith("My prompt");
      });
    });
  });

  describe("loading state", () => {
    it("shows 'Generating...' text when loading", () => {
      render(<AIPromptInput {...defaultProps} isLoading />);

      expect(screen.getByText("Generating...")).toBeInTheDocument();
      expect(screen.queryByText("Generate")).not.toBeInTheDocument();
    });

    it("shows spinner animation when loading", () => {
      render(<AIPromptInput {...defaultProps} isLoading />);

      const spinner = document.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });

    it("disables input when loading", () => {
      render(<AIPromptInput {...defaultProps} isLoading />);

      const input = screen.getByPlaceholderText("Ask AI to improve your resume...");
      expect(input).toBeDisabled();
    });

    it("shows Generate with icon when not loading", () => {
      render(<AIPromptInput {...defaultProps} />);

      const button = screen.getByText("Generate").closest("button");
      const svg = button?.querySelector("svg");
      expect(svg).toBeInTheDocument();
      expect(svg).not.toHaveClass("animate-spin");
    });
  });

  describe("styling", () => {
    it("has border-top separator", () => {
      const { container } = render(<AIPromptInput {...defaultProps} />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass("border-t");
    });

    it("has gray background", () => {
      const { container } = render(<AIPromptInput {...defaultProps} />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass("bg-gray-50");
    });

    it("quick prompt buttons have pill styling", () => {
      render(<AIPromptInput {...defaultProps} />);

      const quickButton = screen.getByText("More concise");
      expect(quickButton).toHaveClass("rounded-full");
    });

    it("quick prompt buttons have hover state", () => {
      render(<AIPromptInput {...defaultProps} />);

      const quickButton = screen.getByText("More concise");
      expect(quickButton).toHaveClass("hover:bg-gray-100");
    });

    it("Generate button has blue styling", () => {
      render(<AIPromptInput {...defaultProps} />);

      const button = screen.getByText("Generate").closest("button");
      expect(button).toHaveClass("bg-blue-600");
    });

    it("input has focus ring styling", () => {
      render(<AIPromptInput {...defaultProps} />);

      const input = screen.getByPlaceholderText("Ask AI to improve your resume...");
      expect(input).toHaveClass("focus:ring-2");
      expect(input).toHaveClass("focus:ring-blue-500");
    });
  });

  describe("accessibility", () => {
    it("all quick prompt buttons are keyboard accessible", () => {
      render(<AIPromptInput {...defaultProps} />);

      const buttons = screen.getAllByRole("button");
      buttons.forEach((button) => {
        expect(button).not.toHaveAttribute("tabindex", "-1");
      });
    });

    it("input is properly labeled via placeholder", () => {
      render(<AIPromptInput {...defaultProps} />);

      const input = screen.getByPlaceholderText("Ask AI to improve your resume...");
      expect(input).toHaveAttribute("type", "text");
    });
  });
});
