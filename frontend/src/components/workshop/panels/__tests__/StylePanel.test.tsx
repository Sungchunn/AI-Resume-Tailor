import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { StylePanel } from "../style/StylePanel";
import { TemplateSelector } from "../style/TemplateSelector";
import { TemplateThumbnail } from "../style/TemplateThumbnail";
import { AutoFitToggle } from "../style/AutoFitToggle";
import { TEMPLATE_PRESETS } from "../style/templatePresets";
import type { AutoFitStatus, TemplatePreset } from "../style/types";

// Mock the WorkshopContext
const mockDispatch = vi.fn();
const mockState = {
  content: {
    summary: "Test summary",
    experience: [
      {
        title: "Software Engineer",
        company: "Tech Co",
        location: "NYC",
        start_date: "2020",
        end_date: "2023",
        bullets: ["Built systems", "Led team"],
      },
    ],
    skills: ["JavaScript", "TypeScript", "React"],
    highlights: ["Achievement 1"],
  },
  styleSettings: {
    font_family: "Inter",
    font_size_body: 11,
    font_size_heading: 16,
    font_size_subheading: 12,
    line_spacing: 1.4,
    section_spacing: 16,
    entry_spacing: 8,
    margin_top: 0.75,
    margin_bottom: 0.75,
    margin_left: 0.75,
    margin_right: 0.75,
  },
  fitToOnePage: false,
};

vi.mock("../../WorkshopContext", () => ({
  useWorkshop: () => ({
    state: mockState,
    dispatch: mockDispatch,
  }),
}));

describe("StylePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all main sections", () => {
    render(<StylePanel />);

    expect(screen.getByText("Template Presets")).toBeInTheDocument();
    expect(screen.getByText("Fit to One Page")).toBeInTheDocument();
    expect(screen.getByText("Style Settings")).toBeInTheDocument();
  });

  it("displays all template presets", () => {
    render(<StylePanel />);

    expect(screen.getByText("Classic")).toBeInTheDocument();
    expect(screen.getByText("Modern")).toBeInTheDocument();
    expect(screen.getByText("Minimal")).toBeInTheDocument();
    expect(screen.getByText("Executive")).toBeInTheDocument();
  });

  it("dispatches SET_STYLE when template is selected", async () => {
    const user = userEvent.setup();
    render(<StylePanel />);

    const modernButton = screen.getByText("Modern").closest("button")!;
    await user.click(modernButton);

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "SET_STYLE",
      payload: TEMPLATE_PRESETS.find((p) => p.id === "modern")?.style,
    });
  });

  it("dispatches SET_FIT_TO_ONE_PAGE when toggle is clicked", async () => {
    const user = userEvent.setup();
    render(<StylePanel />);

    const toggle = screen.getByRole("switch");
    await user.click(toggle);

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "SET_FIT_TO_ONE_PAGE",
      payload: true,
    });
  });
});

describe("TemplateSelector", () => {
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all presets in a grid", () => {
    render(
      <TemplateSelector
        presets={TEMPLATE_PRESETS}
        activePreset={null}
        onSelect={mockOnSelect}
      />
    );

    TEMPLATE_PRESETS.forEach((preset) => {
      expect(screen.getByText(preset.name)).toBeInTheDocument();
      expect(screen.getByText(preset.description)).toBeInTheDocument();
    });
  });

  it("highlights active preset", () => {
    render(
      <TemplateSelector
        presets={TEMPLATE_PRESETS}
        activePreset="modern"
        onSelect={mockOnSelect}
      />
    );

    const modernButton = screen.getByText("Modern").closest("button")!;
    expect(modernButton).toHaveClass("border-blue-500");
  });

  it("calls onSelect when preset is clicked", async () => {
    const user = userEvent.setup();
    render(
      <TemplateSelector
        presets={TEMPLATE_PRESETS}
        activePreset={null}
        onSelect={mockOnSelect}
      />
    );

    const classicButton = screen.getByText("Classic").closest("button")!;
    await user.click(classicButton);

    expect(mockOnSelect).toHaveBeenCalledWith(
      TEMPLATE_PRESETS.find((p) => p.id === "classic")
    );
  });
});

describe("TemplateThumbnail", () => {
  const mockPreset: TemplatePreset = {
    id: "test",
    name: "Test Template",
    description: "A test template",
    style: {
      font_family: "Arial",
      font_size_body: 11,
      font_size_heading: 18,
      font_size_subheading: 12,
      line_spacing: 1.4,
      section_spacing: 16,
    },
  };

  it("renders preset name and description", () => {
    render(
      <TemplateThumbnail preset={mockPreset} isActive={false} onClick={() => {}} />
    );

    expect(screen.getByText("Test Template")).toBeInTheDocument();
    expect(screen.getByText("A test template")).toBeInTheDocument();
  });

  it("applies active styles when selected", () => {
    const { container } = render(
      <TemplateThumbnail preset={mockPreset} isActive={true} onClick={() => {}} />
    );

    const button = container.querySelector("button")!;
    expect(button).toHaveClass("border-blue-500");
    expect(button).toHaveClass("bg-blue-50");
  });

  it("applies inactive styles when not selected", () => {
    const { container } = render(
      <TemplateThumbnail preset={mockPreset} isActive={false} onClick={() => {}} />
    );

    const button = container.querySelector("button")!;
    expect(button).toHaveClass("border-gray-200");
    expect(button).toHaveClass("bg-white");
  });

  it("renders mini preview with correct font family", () => {
    const { container } = render(
      <TemplateThumbnail preset={mockPreset} isActive={false} onClick={() => {}} />
    );

    const previewContainer = container.querySelector(
      '[style*="font-family"]'
    ) as HTMLElement;
    expect(previewContainer?.style.fontFamily).toBe("Arial");
  });

  it("calls onClick when clicked", async () => {
    const mockOnClick = vi.fn();
    const user = userEvent.setup();

    render(
      <TemplateThumbnail preset={mockPreset} isActive={false} onClick={mockOnClick} />
    );

    const button = screen.getByRole("button");
    await user.click(button);

    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });
});

describe("AutoFitToggle", () => {
  const mockOnToggle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders label and description", () => {
    const status: AutoFitStatus = { state: "idle" };
    render(
      <AutoFitToggle enabled={false} onToggle={mockOnToggle} status={status} />
    );

    expect(screen.getByText("Fit to One Page")).toBeInTheDocument();
    expect(
      screen.getByText("Automatically adjust styles to fit content on one page")
    ).toBeInTheDocument();
  });

  it("shows toggle in off state when disabled", () => {
    const status: AutoFitStatus = { state: "idle" };
    render(
      <AutoFitToggle enabled={false} onToggle={mockOnToggle} status={status} />
    );

    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(toggle).toHaveClass("bg-gray-200");
  });

  it("shows toggle in on state when enabled", () => {
    const status: AutoFitStatus = { state: "idle" };
    render(
      <AutoFitToggle enabled={true} onToggle={mockOnToggle} status={status} />
    );

    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(toggle).toHaveClass("bg-blue-600");
  });

  it("calls onToggle when clicked", async () => {
    const status: AutoFitStatus = { state: "idle" };
    const user = userEvent.setup();

    render(
      <AutoFitToggle enabled={false} onToggle={mockOnToggle} status={status} />
    );

    const toggle = screen.getByRole("switch");
    await user.click(toggle);

    expect(mockOnToggle).toHaveBeenCalledWith(true);
  });

  it("shows fitting status badge", () => {
    const status: AutoFitStatus = { state: "fitting", iteration: 5 };
    render(
      <AutoFitToggle enabled={true} onToggle={mockOnToggle} status={status} />
    );

    expect(screen.getByText("Fitting...")).toBeInTheDocument();
  });

  it("shows fitted status badge", () => {
    const status: AutoFitStatus = { state: "fitted", reductions: ["Body font"] };
    render(
      <AutoFitToggle enabled={true} onToggle={mockOnToggle} status={status} />
    );

    expect(screen.getByText("Fitted")).toBeInTheDocument();
  });

  it("shows minimum reached status badge", () => {
    const status: AutoFitStatus = {
      state: "minimum_reached",
      message: "Content too long",
    };
    render(
      <AutoFitToggle enabled={true} onToggle={mockOnToggle} status={status} />
    );

    expect(screen.getByText("At minimum")).toBeInTheDocument();
  });

  it("does not show status badge when idle", () => {
    const status: AutoFitStatus = { state: "idle" };
    render(
      <AutoFitToggle enabled={false} onToggle={mockOnToggle} status={status} />
    );

    expect(screen.queryByText("Fitting...")).not.toBeInTheDocument();
    expect(screen.queryByText("Fitted")).not.toBeInTheDocument();
    expect(screen.queryByText("At minimum")).not.toBeInTheDocument();
  });
});

describe("TEMPLATE_PRESETS", () => {
  it("contains 4 presets", () => {
    expect(TEMPLATE_PRESETS).toHaveLength(4);
  });

  it("each preset has required properties", () => {
    TEMPLATE_PRESETS.forEach((preset) => {
      expect(preset.id).toBeDefined();
      expect(preset.name).toBeDefined();
      expect(preset.description).toBeDefined();
      expect(preset.style).toBeDefined();
      expect(preset.style.font_family).toBeDefined();
      expect(preset.style.font_size_body).toBeDefined();
      expect(preset.style.font_size_heading).toBeDefined();
    });
  });

  it("has unique ids", () => {
    const ids = TEMPLATE_PRESETS.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("all presets have entry_spacing defined", () => {
    TEMPLATE_PRESETS.forEach((preset) => {
      expect(preset.style.entry_spacing).toBeDefined();
      expect(typeof preset.style.entry_spacing).toBe("number");
    });
  });
});
