/**
 * Date formatting utilities for consistent date display across the app.
 */

/**
 * Format a date string as a relative time (e.g., "2 hours ago", "yesterday").
 * Handles null/undefined values gracefully.
 *
 * @param dateStr - ISO date string or null
 * @returns Relative time string or "N/A" for null values
 */
export function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/A";

  // Parse the date and ensure UTC comparison to avoid timezone issues
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }
  return date.toLocaleDateString();
}

/**
 * Format a date string as a compact relative date (e.g., "2d ago", "1w ago").
 * Useful for table views where space is limited.
 *
 * @param dateStr - ISO date string or null
 * @returns Compact relative date string
 */
export function formatRelativeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";

  const date = new Date(dateStr);
  const now = new Date();

  // Use UTC dates for comparison to avoid timezone boundary issues
  const dateUTC = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const nowUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const diffDays = Math.floor((nowUTC - dateUTC) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
}
