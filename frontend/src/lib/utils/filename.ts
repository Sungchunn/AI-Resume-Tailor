/**
 * Filename utility functions for resume upload.
 */

/**
 * Generates a human-readable title from a filename.
 *
 * @example
 * generateTitleFromFilename("John_Resume_2024.pdf") // "John Resume 2024"
 * generateTitleFromFilename("my-resume.docx") // "My Resume"
 * generateTitleFromFilename("UPPERCASE_FILE.PDF") // "Uppercase File"
 */
export function generateTitleFromFilename(filename: string): string {
  // Remove file extension
  const nameWithoutExt = filename.replace(/\.(pdf|docx)$/i, "");

  // Replace underscores and hyphens with spaces
  const withSpaces = nameWithoutExt.replace(/[_-]/g, " ");

  // Remove multiple consecutive spaces
  const cleaned = withSpaces.replace(/\s+/g, " ").trim();

  // Capitalize first letter of each word (title case)
  return cleaned
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
