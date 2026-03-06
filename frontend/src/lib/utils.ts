/**
 * Utility for conditionally joining class names together
 * Simple implementation without clsx/tailwind-merge dependencies
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
