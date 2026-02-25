import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PreviewHeader } from "../PreviewHeader";
import type { ContactInfo } from "../PreviewHeader";
import type { ComputedPreviewStyle } from "../types";

const mockStyle: ComputedPreviewStyle = {
  fontFamily: "Arial, sans-serif",
  bodyFontSize: "11pt",
  headingFontSize: "18pt",
  subheadingFontSize: "12pt",
  lineHeight: 1.4,
  sectionGap: "16px",
  paddingTop: "72px",
  paddingBottom: "72px",
  paddingLeft: "72px",
  paddingRight: "72px",
};

describe("PreviewHeader", () => {
  it("renders name prominently", () => {
    const contact: ContactInfo = {
      name: "John Doe",
    };

    render(<PreviewHeader contact={contact} style={mockStyle} />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("John Doe");
    expect(heading).toHaveStyle({ fontSize: "18pt" });
  });

  it("renders all contact information when provided", () => {
    const contact: ContactInfo = {
      name: "Jane Smith",
      email: "jane@example.com",
      phone: "(555) 123-4567",
      location: "San Francisco, CA",
      linkedin: "linkedin.com/in/janesmith",
      website: "janesmith.dev",
    };

    render(<PreviewHeader contact={contact} style={mockStyle} />);

    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(screen.getByText("(555) 123-4567")).toBeInTheDocument();
    expect(screen.getByText("San Francisco, CA")).toBeInTheDocument();
    expect(screen.getByText("linkedin.com/in/janesmith")).toBeInTheDocument();
    expect(screen.getByText("janesmith.dev")).toBeInTheDocument();
  });

  it("handles partial contact information", () => {
    const contact: ContactInfo = {
      name: "Bob Wilson",
      email: "bob@example.com",
    };

    render(<PreviewHeader contact={contact} style={mockStyle} />);

    expect(screen.getByText("Bob Wilson")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    expect(screen.queryByText("(555)")).not.toBeInTheDocument();
  });

  it("renders only name when no contact details provided", () => {
    const contact: ContactInfo = {
      name: "Solo Person",
    };

    render(<PreviewHeader contact={contact} style={mockStyle} />);

    expect(screen.getByText("Solo Person")).toBeInTheDocument();
    // Should not render contact details section
    const contactItems = document.querySelectorAll(".preview-header > div");
    expect(contactItems.length).toBeLessThanOrEqual(2); // name + maybe contact row
  });

  it("handles empty string contact fields", () => {
    const contact: ContactInfo = {
      name: "Test User",
      email: "",
      phone: "",
      location: "",
    };

    render(<PreviewHeader contact={contact} style={mockStyle} />);

    expect(screen.getByText("Test User")).toBeInTheDocument();
    // Empty strings should be filtered out
    const separators = screen.queryAllByText("|");
    expect(separators.length).toBe(0);
  });

  it("applies correct font styles", () => {
    const contact: ContactInfo = {
      name: "Styled Person",
      email: "styled@example.com",
    };

    const customStyle: ComputedPreviewStyle = {
      ...mockStyle,
      headingFontSize: "24pt",
      bodyFontSize: "12pt",
    };

    render(<PreviewHeader contact={contact} style={customStyle} />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveStyle({ fontSize: "24pt" });
  });

  it("handles long names gracefully", () => {
    const contact: ContactInfo = {
      name: "Dr. Alexandra Wilhelmina Montgomery-Fitzgerald III",
      email: "alex@example.com",
    };

    render(<PreviewHeader contact={contact} style={mockStyle} />);

    expect(
      screen.getByText("Dr. Alexandra Wilhelmina Montgomery-Fitzgerald III")
    ).toBeInTheDocument();
  });

  it("handles special characters in contact info", () => {
    const contact: ContactInfo = {
      name: "José García-López",
      email: "jose+test@example.com",
      phone: "+1 (555) 123-4567",
      location: "São Paulo, Brazil",
    };

    render(<PreviewHeader contact={contact} style={mockStyle} />);

    expect(screen.getByText("José García-López")).toBeInTheDocument();
    expect(screen.getByText("jose+test@example.com")).toBeInTheDocument();
    expect(screen.getByText("+1 (555) 123-4567")).toBeInTheDocument();
    expect(screen.getByText("São Paulo, Brazil")).toBeInTheDocument();
  });

  it("renders LinkedIn URL correctly", () => {
    const contact: ContactInfo = {
      name: "LinkedIn User",
      linkedin: "linkedin.com/in/someuser",
    };

    render(<PreviewHeader contact={contact} style={mockStyle} />);

    expect(screen.getByText("linkedin.com/in/someuser")).toBeInTheDocument();
  });

  it("renders website URL correctly", () => {
    const contact: ContactInfo = {
      name: "Web Developer",
      website: "https://myportfolio.com",
    };

    render(<PreviewHeader contact={contact} style={mockStyle} />);

    expect(screen.getByText("https://myportfolio.com")).toBeInTheDocument();
  });

  it("has correct structure for styling", () => {
    const contact: ContactInfo = {
      name: "Structure Test",
      email: "test@example.com",
    };

    const { container } = render(
      <PreviewHeader contact={contact} style={mockStyle} />
    );

    // Should have preview-header class
    const header = container.querySelector(".preview-header");
    expect(header).toBeInTheDocument();
    expect(header).toHaveClass("text-center");
  });
});
