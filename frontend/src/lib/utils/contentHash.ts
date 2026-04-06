import type { AnyResumeBlock } from "@/lib/resume/types";

/**
 * Block types that affect ATS analysis.
 * Only these blocks are included in the content hash.
 */
const ATS_RELEVANT_BLOCK_TYPES = [
  "experience",
  "projects",
  "skills",
  "summary",
] as const;

/**
 * Generate a simple hash of resume content for staleness detection.
 * Uses text content only (not formatting) to avoid false positives.
 *
 * This is used to detect when resume content has changed after an ATS analysis,
 * indicating that the ATS score may no longer be accurate.
 *
 * @param blocks - The resume blocks to hash
 * @returns A hex string hash of the relevant content
 */
export function generateContentHash(blocks: AnyResumeBlock[]): string {
  const textContent = blocks
    .filter((b) =>
      (ATS_RELEVANT_BLOCK_TYPES as readonly string[]).includes(b.type)
    )
    .map((b) => JSON.stringify(b.content))
    .join("|");

  // Simple hash function (djb2)
  let hash = 5381;
  for (let i = 0; i < textContent.length; i++) {
    hash = (hash * 33) ^ textContent.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}
