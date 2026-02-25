import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SkillsEditor } from "../sections/SkillsEditor";

describe("SkillsEditor", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all skills as tags", () => {
    const skills = ["JavaScript", "React", "TypeScript"];
    render(<SkillsEditor skills={skills} onChange={mockOnChange} />);

    expect(screen.getByText("JavaScript")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
  });

  it("displays skill count", () => {
    const skills = ["JavaScript", "React"];
    render(<SkillsEditor skills={skills} onChange={mockOnChange} />);

    expect(screen.getByText("2 skills added")).toBeInTheDocument();
  });

  it("displays singular form for one skill", () => {
    render(<SkillsEditor skills={["JavaScript"]} onChange={mockOnChange} />);

    expect(screen.getByText("1 skill added")).toBeInTheDocument();
  });

  it("removes skill when X button is clicked", () => {
    const skills = ["JavaScript", "React", "TypeScript"];
    render(<SkillsEditor skills={skills} onChange={mockOnChange} />);

    const removeButtons = screen.getAllByRole("button", { name: /remove/i });
    fireEvent.click(removeButtons[1]); // Remove "React"

    expect(mockOnChange).toHaveBeenCalledWith(["JavaScript", "TypeScript"]);
  });

  it("adds skill when form is submitted", () => {
    const skills = ["JavaScript"];
    render(<SkillsEditor skills={skills} onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText("Add a skill...");
    const addButton = screen.getByRole("button", { name: "Add" });

    fireEvent.change(input, { target: { value: "Python" } });
    fireEvent.click(addButton);

    expect(mockOnChange).toHaveBeenCalledWith(["JavaScript", "Python"]);
  });

  it("adds skill when Enter is pressed", () => {
    const skills = ["JavaScript"];
    render(<SkillsEditor skills={skills} onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText("Add a skill...");
    fireEvent.change(input, { target: { value: "Python" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockOnChange).toHaveBeenCalledWith(["JavaScript", "Python"]);
  });

  it("does not add duplicate skills", () => {
    const skills = ["JavaScript"];
    render(<SkillsEditor skills={skills} onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText("Add a skill...");
    fireEvent.change(input, { target: { value: "JavaScript" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it("trims whitespace from skill names", () => {
    const skills: string[] = [];
    render(<SkillsEditor skills={skills} onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText("Add a skill...");
    fireEvent.change(input, { target: { value: "  Python  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockOnChange).toHaveBeenCalledWith(["Python"]);
  });

  it("does not add empty skills", () => {
    const skills: string[] = [];
    render(<SkillsEditor skills={skills} onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText("Add a skill...");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it("disables Add button when input is empty", () => {
    render(<SkillsEditor skills={[]} onChange={mockOnChange} />);

    const addButton = screen.getByRole("button", { name: "Add" });
    expect(addButton).toBeDisabled();
  });

  it("enables Add button when input has text", () => {
    render(<SkillsEditor skills={[]} onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText("Add a skill...");
    fireEvent.change(input, { target: { value: "Python" } });

    const addButton = screen.getByRole("button", { name: "Add" });
    expect(addButton).not.toBeDisabled();
  });
});
