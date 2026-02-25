import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AddSectionMenu } from "../AddSectionMenu";

describe("AddSectionMenu", () => {
  const mockOnAdd = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Add button", () => {
    render(<AddSectionMenu existingSections={[]} onAdd={mockOnAdd} />);

    expect(screen.getByRole("button", { name: /add/i })).toBeInTheDocument();
  });

  it("opens menu when clicked", () => {
    render(<AddSectionMenu existingSections={[]} onAdd={mockOnAdd} />);

    fireEvent.click(screen.getByRole("button", { name: /add/i }));

    expect(screen.getByText("Professional Summary")).toBeInTheDocument();
    expect(screen.getByText("Work Experience")).toBeInTheDocument();
    expect(screen.getByText("Skills")).toBeInTheDocument();
  });

  it("filters out existing sections", () => {
    render(
      <AddSectionMenu
        existingSections={["summary", "experience"]}
        onAdd={mockOnAdd}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /add/i }));

    expect(screen.queryByText("Professional Summary")).not.toBeInTheDocument();
    expect(screen.queryByText("Work Experience")).not.toBeInTheDocument();
    expect(screen.getByText("Skills")).toBeInTheDocument();
  });

  it("calls onAdd with section key when option is clicked", () => {
    render(<AddSectionMenu existingSections={[]} onAdd={mockOnAdd} />);

    fireEvent.click(screen.getByRole("button", { name: /add/i }));
    fireEvent.click(screen.getByText("Skills"));

    expect(mockOnAdd).toHaveBeenCalledWith("skills");
  });

  it("closes menu after selection", () => {
    render(<AddSectionMenu existingSections={[]} onAdd={mockOnAdd} />);

    fireEvent.click(screen.getByRole("button", { name: /add/i }));
    fireEvent.click(screen.getByText("Skills"));

    expect(screen.queryByText("Professional Summary")).not.toBeInTheDocument();
  });

  it("returns null when all sections exist", () => {
    const allSections = [
      "summary",
      "experience",
      "skills",
      "highlights",
      "education",
      "projects",
      "certifications",
      "awards",
    ];

    const { container } = render(
      <AddSectionMenu existingSections={allSections} onAdd={mockOnAdd} />
    );

    expect(container.firstChild).toBeNull();
  });

  it("shows all available section options", () => {
    render(<AddSectionMenu existingSections={[]} onAdd={mockOnAdd} />);

    fireEvent.click(screen.getByRole("button", { name: /add/i }));

    expect(screen.getByText("Professional Summary")).toBeInTheDocument();
    expect(screen.getByText("Work Experience")).toBeInTheDocument();
    expect(screen.getByText("Skills")).toBeInTheDocument();
    expect(screen.getByText("Key Highlights")).toBeInTheDocument();
    expect(screen.getByText("Education")).toBeInTheDocument();
    expect(screen.getByText("Projects")).toBeInTheDocument();
    expect(screen.getByText("Certifications")).toBeInTheDocument();
    expect(screen.getByText("Awards")).toBeInTheDocument();
  });
});
