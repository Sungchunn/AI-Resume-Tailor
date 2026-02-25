import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExperienceEditor } from "../sections/ExperienceEditor";
import type { TailoredContent } from "@/lib/api/types";

type ExperienceEntry = TailoredContent["experience"][number];

describe("ExperienceEditor", () => {
  const mockOnChange = vi.fn();

  const createEntry = (overrides: Partial<ExperienceEntry> = {}): ExperienceEntry => ({
    title: "Software Engineer",
    company: "Tech Corp",
    location: "San Francisco, CA",
    start_date: "Jan 2020",
    end_date: "Present",
    bullets: ["Built features", "Led team"],
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all experience entries", () => {
    const entries = [
      createEntry({ title: "Senior Engineer" }),
      createEntry({ title: "Junior Engineer" }),
    ];
    render(<ExperienceEditor entries={entries} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue("Senior Engineer")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Junior Engineer")).toBeInTheDocument();
  });

  it("renders all fields for an entry", () => {
    const entry = createEntry();
    render(<ExperienceEditor entries={[entry]} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue("Software Engineer")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Tech Corp")).toBeInTheDocument();
    expect(screen.getByDisplayValue("San Francisco, CA")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Jan 2020")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Present")).toBeInTheDocument();
  });

  it("renders bullet points", () => {
    const entry = createEntry();
    render(<ExperienceEditor entries={[entry]} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue("Built features")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Led team")).toBeInTheDocument();
  });

  it("updates title field", () => {
    const entry = createEntry();
    render(<ExperienceEditor entries={[entry]} onChange={mockOnChange} />);

    const titleInput = screen.getByDisplayValue("Software Engineer");
    fireEvent.change(titleInput, { target: { value: "Staff Engineer" } });

    expect(mockOnChange).toHaveBeenCalledWith([
      { ...entry, title: "Staff Engineer" },
    ]);
  });

  it("updates company field", () => {
    const entry = createEntry();
    render(<ExperienceEditor entries={[entry]} onChange={mockOnChange} />);

    const companyInput = screen.getByDisplayValue("Tech Corp");
    fireEvent.change(companyInput, { target: { value: "New Corp" } });

    expect(mockOnChange).toHaveBeenCalledWith([
      { ...entry, company: "New Corp" },
    ]);
  });

  it("updates bullet point text", () => {
    const entry = createEntry();
    render(<ExperienceEditor entries={[entry]} onChange={mockOnChange} />);

    const bulletInput = screen.getByDisplayValue("Built features");
    fireEvent.change(bulletInput, { target: { value: "Built amazing features" } });

    expect(mockOnChange).toHaveBeenCalledWith([
      { ...entry, bullets: ["Built amazing features", "Led team"] },
    ]);
  });

  it("adds new bullet point", () => {
    const entry = createEntry();
    render(<ExperienceEditor entries={[entry]} onChange={mockOnChange} />);

    const addBulletButton = screen.getByText("Add Bullet");
    fireEvent.click(addBulletButton);

    expect(mockOnChange).toHaveBeenCalledWith([
      { ...entry, bullets: ["Built features", "Led team", ""] },
    ]);
  });

  it("removes bullet point", () => {
    const entry = createEntry();
    render(<ExperienceEditor entries={[entry]} onChange={mockOnChange} />);

    const removeBulletButtons = screen.getAllByRole("button", { name: /remove bullet/i });
    fireEvent.click(removeBulletButtons[0]);

    expect(mockOnChange).toHaveBeenCalledWith([
      { ...entry, bullets: ["Led team"] },
    ]);
  });

  it("adds new experience entry", () => {
    const entry = createEntry();
    render(<ExperienceEditor entries={[entry]} onChange={mockOnChange} />);

    const addButton = screen.getByText("+ Add Experience");
    fireEvent.click(addButton);

    expect(mockOnChange).toHaveBeenCalledWith([
      entry,
      {
        title: "",
        company: "",
        location: "",
        start_date: "",
        end_date: "",
        bullets: [""],
      },
    ]);
  });

  it("removes experience entry", () => {
    const entries = [
      createEntry({ title: "First Job" }),
      createEntry({ title: "Second Job" }),
    ];
    render(<ExperienceEditor entries={entries} onChange={mockOnChange} />);

    const removeButtons = screen.getAllByRole("button", { name: /remove experience/i });
    fireEvent.click(removeButtons[0]);

    expect(mockOnChange).toHaveBeenCalledWith([entries[1]]);
  });

  it("displays position numbers", () => {
    const entries = [createEntry(), createEntry()];
    render(<ExperienceEditor entries={entries} onChange={mockOnChange} />);

    expect(screen.getByText("Position 1")).toBeInTheDocument();
    expect(screen.getByText("Position 2")).toBeInTheDocument();
  });

  it("renders empty state with add button", () => {
    render(<ExperienceEditor entries={[]} onChange={mockOnChange} />);

    expect(screen.getByText("+ Add Experience")).toBeInTheDocument();
    expect(screen.queryByText("Position 1")).not.toBeInTheDocument();
  });
});
