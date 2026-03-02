/**
 * Text Diff Utilities
 *
 * Uses jsdiff library for word-level text diffing.
 * Provides utilities for highlighting changes in the UI.
 */

import { diffWords } from "diff";

// ============================================================================
// Types
// ============================================================================

/**
 * A single part of a word-level diff.
 */
export interface DiffPart {
  /** The text content */
  value: string;
  /** True if this text was added (only in tailored) */
  added: boolean;
  /** True if this text was removed (only in original) */
  removed: boolean;
}

/**
 * Result of a word-level diff comparison.
 */
export interface WordDiffResult {
  /** Individual diff parts for rendering */
  parts: DiffPart[];
  /** Whether any changes were detected */
  hasChanges: boolean;
  /** Count of added words/segments */
  addedCount: number;
  /** Count of removed words/segments */
  removedCount: number;
}

// ============================================================================
// Diff Functions
// ============================================================================

/**
 * Computes a word-level diff between original and tailored text.
 *
 * @param original - The original text
 * @param tailored - The AI-tailored text
 * @returns WordDiffResult with parts for rendering
 */
export function computeWordDiff(
  original: string,
  tailored: string
): WordDiffResult {
  const changes = diffWords(original, tailored);

  const parts: DiffPart[] = changes.map((change) => ({
    value: change.value,
    added: change.added ?? false,
    removed: change.removed ?? false,
  }));

  const addedCount = changes.filter((c) => c.added).length;
  const removedCount = changes.filter((c) => c.removed).length;

  return {
    parts,
    hasChanges: addedCount > 0 || removedCount > 0,
    addedCount,
    removedCount,
  };
}

/**
 * Checks if two strings are meaningfully different.
 * Ignores whitespace-only differences.
 *
 * @param original - Original text
 * @param tailored - Tailored text
 * @returns True if there are meaningful differences
 */
export function hasMeaningfulDiff(original: string, tailored: string): boolean {
  const normalizedOriginal = original.trim().replace(/\s+/g, " ");
  const normalizedTailored = tailored.trim().replace(/\s+/g, " ");
  return normalizedOriginal !== normalizedTailored;
}

/**
 * Gets a summary of changes between two texts.
 *
 * @param original - Original text
 * @param tailored - Tailored text
 * @returns Human-readable summary of changes
 */
export function getDiffSummaryText(original: string, tailored: string): string {
  const diff = computeWordDiff(original, tailored);

  if (!diff.hasChanges) {
    return "No changes";
  }

  const parts: string[] = [];

  if (diff.addedCount > 0) {
    parts.push(`${diff.addedCount} addition${diff.addedCount > 1 ? "s" : ""}`);
  }

  if (diff.removedCount > 0) {
    parts.push(
      `${diff.removedCount} removal${diff.removedCount > 1 ? "s" : ""}`
    );
  }

  return parts.join(", ");
}

// ============================================================================
// Rendering Utilities
// ============================================================================

/**
 * Generates CSS class names for a diff part based on its type.
 *
 * @param part - The diff part
 * @returns CSS class string for styling
 */
export function getDiffPartClassName(part: DiffPart): string {
  if (part.added) {
    return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
  }
  if (part.removed) {
    return "bg-red-100 text-red-800 line-through dark:bg-red-900/30 dark:text-red-300";
  }
  return "";
}

/**
 * Generates inline styles for a diff part.
 * Use when class-based styling isn't available.
 *
 * @param part - The diff part
 * @returns Style object for React
 */
export function getDiffPartStyle(part: DiffPart): React.CSSProperties {
  if (part.added) {
    return {
      backgroundColor: "rgb(220 252 231)", // green-100
      color: "rgb(22 101 52)", // green-800
      borderRadius: "2px",
      padding: "0 2px",
    };
  }
  if (part.removed) {
    return {
      backgroundColor: "rgb(254 226 226)", // red-100
      color: "rgb(153 27 27)", // red-800
      textDecoration: "line-through",
      borderRadius: "2px",
      padding: "0 2px",
    };
  }
  return {};
}

// ============================================================================
// Display Helpers
// ============================================================================

/**
 * Truncates text with ellipsis if it exceeds maxLength.
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated text
 */
export function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Gets a preview of what changed - useful for collapsed diff views.
 *
 * @param original - Original text
 * @param tailored - Tailored text
 * @param maxLength - Maximum preview length
 * @returns Preview string showing key changes
 */
export function getChangePreview(
  original: string,
  tailored: string,
  maxLength: number = 50
): string {
  const diff = computeWordDiff(original, tailored);

  // Find the first significant change
  for (const part of diff.parts) {
    if (part.added || part.removed) {
      const prefix = part.added ? "+" : "-";
      return `${prefix}${truncateText(part.value.trim(), maxLength)}`;
    }
  }

  return "Modified";
}
