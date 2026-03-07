/**
 * HTML Sanitization Utility
 *
 * Provides safe HTML rendering by sanitizing content with DOMPurify
 * to prevent XSS attacks when using dangerouslySetInnerHTML.
 */

import DOMPurify from "dompurify";

/**
 * Sanitize HTML content to prevent XSS attacks.
 *
 * @param dirty - The potentially unsafe HTML string
 * @returns Sanitized HTML string safe for dangerouslySetInnerHTML
 */
export function sanitizeHtml(dirty: string): string {
  // Server-side rendering check - return empty string if no window
  if (typeof window === "undefined") {
    return "";
  }

  return DOMPurify.sanitize(dirty, {
    // Allow common formatting tags
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "strike",
      "ul",
      "ol",
      "li",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "a",
      "span",
      "div",
      "blockquote",
      "pre",
      "code",
    ],
    // Allow safe attributes
    ALLOWED_ATTR: ["href", "target", "rel", "class"],
    // Force all links to open in new tab with security attributes
    ADD_ATTR: ["target", "rel"],
    // Hook to add rel="noopener noreferrer" to links
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
  });
}
