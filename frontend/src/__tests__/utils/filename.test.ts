/**
 * Tests for filename utility functions.
 *
 * These tests cover the generateTitleFromFilename function used
 * to auto-generate resume titles from uploaded filenames.
 */

import { describe, it, expect } from "vitest";
import { generateTitleFromFilename } from "@/lib/utils/filename";

describe("generateTitleFromFilename", () => {
  describe("extension removal", () => {
    it("removes .pdf extension", () => {
      expect(generateTitleFromFilename("resume.pdf")).toBe("Resume");
    });

    it("removes .docx extension", () => {
      expect(generateTitleFromFilename("resume.docx")).toBe("Resume");
    });

    it("removes .PDF extension (case insensitive)", () => {
      expect(generateTitleFromFilename("resume.PDF")).toBe("Resume");
    });

    it("removes .DOCX extension (case insensitive)", () => {
      expect(generateTitleFromFilename("resume.DOCX")).toBe("Resume");
    });

    it("handles mixed case extensions", () => {
      expect(generateTitleFromFilename("resume.Pdf")).toBe("Resume");
      expect(generateTitleFromFilename("resume.DocX")).toBe("Resume");
    });
  });

  describe("separator handling", () => {
    it("converts underscores to spaces", () => {
      expect(generateTitleFromFilename("john_doe_resume.pdf")).toBe(
        "John Doe Resume"
      );
    });

    it("converts hyphens to spaces", () => {
      expect(generateTitleFromFilename("john-doe-resume.pdf")).toBe(
        "John Doe Resume"
      );
    });

    it("handles mixed separators", () => {
      expect(generateTitleFromFilename("john_doe-resume_2024.pdf")).toBe(
        "John Doe Resume 2024"
      );
    });
  });

  describe("title case conversion", () => {
    it("capitalizes first letter of each word", () => {
      expect(generateTitleFromFilename("software engineer resume.pdf")).toBe(
        "Software Engineer Resume"
      );
    });

    it("converts all uppercase to title case", () => {
      expect(generateTitleFromFilename("JOHN_RESUME.pdf")).toBe("John Resume");
    });

    it("converts mixed case to title case", () => {
      expect(generateTitleFromFilename("JoHn_ReSuMe.pdf")).toBe("John Resume");
    });
  });

  describe("whitespace handling", () => {
    it("removes leading whitespace", () => {
      expect(generateTitleFromFilename("  resume.pdf")).toBe("Resume");
    });

    it("removes trailing whitespace", () => {
      expect(generateTitleFromFilename("resume  .pdf")).toBe("Resume");
    });

    it("collapses multiple spaces to single space", () => {
      expect(generateTitleFromFilename("john__doe___resume.pdf")).toBe(
        "John Doe Resume"
      );
    });
  });

  describe("real-world examples", () => {
    it("handles typical resume filename with underscores", () => {
      expect(generateTitleFromFilename("John_Doe_Resume_2024.pdf")).toBe(
        "John Doe Resume 2024"
      );
    });

    it("handles typical resume filename with hyphens", () => {
      expect(generateTitleFromFilename("jane-smith-software-engineer.docx")).toBe(
        "Jane Smith Software Engineer"
      );
    });

    it("handles simple filename", () => {
      expect(generateTitleFromFilename("Resume.pdf")).toBe("Resume");
    });

    it("handles filename with version number", () => {
      expect(generateTitleFromFilename("resume_v2.pdf")).toBe("Resume V2");
    });

    it("handles filename with date", () => {
      expect(generateTitleFromFilename("resume_2024_01_15.pdf")).toBe(
        "Resume 2024 01 15"
      );
    });

    it("handles company-specific resume", () => {
      expect(
        generateTitleFromFilename("john_doe_google_application.docx")
      ).toBe("John Doe Google Application");
    });
  });

  describe("edge cases", () => {
    it("handles empty string", () => {
      expect(generateTitleFromFilename("")).toBe("");
    });

    it("handles filename without extension", () => {
      expect(generateTitleFromFilename("my_resume")).toBe("My Resume");
    });

    it("handles single character filename", () => {
      expect(generateTitleFromFilename("a.pdf")).toBe("A");
    });

    it("handles numbers in filename", () => {
      expect(generateTitleFromFilename("resume123.pdf")).toBe("Resume123");
    });

    it("handles special characters that are not separators", () => {
      // Numbers and other characters should be preserved
      expect(generateTitleFromFilename("resume_v2.0.pdf")).toBe("Resume V2.0");
    });
  });
});
