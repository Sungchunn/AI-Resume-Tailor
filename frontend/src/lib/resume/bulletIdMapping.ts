import type { AnyResumeBlock } from "./types";
import { createIndexedElementId } from "./elementPath";

type EntryWithId = { id: string };
type BlockWithEntries = { id: string; content: EntryWithId[] };

/**
 * Convert an analysis bullet ID ("blockId:entry-N:bullet-M") to a DOM element ID
 * that uses the actual entry nanoid from the block data.
 */
export function analysisBulletIdToElementId(
  bulletId: string,
  blocks: AnyResumeBlock[]
): string | null {
  const parts = bulletId.split(":");
  if (parts.length !== 3) return null;

  const blockId = parts[0];
  const entryIndex = parseInt(parts[1].replace("entry-", ""), 10);
  const bulletIndex = parseInt(parts[2].replace("bullet-", ""), 10);

  if (isNaN(entryIndex) || isNaN(bulletIndex)) return null;

  const block = blocks.find((b) => b.id === blockId);
  if (!block) return null;

  const entries = block.content as EntryWithId[] | undefined;
  if (!entries || !Array.isArray(entries)) return null;

  const entry = entries[entryIndex];
  if (!entry?.id) return null;

  return createIndexedElementId(blockId, entry.id, "bullets", bulletIndex);
}

/**
 * Convert a DOM element ID ("blockId:entryId:bullets:index") back to an analysis
 * bullet ID ("blockId:entry-N:bullet-M") by finding the entry's positional index.
 */
export function elementIdToAnalysisBulletId(
  elementId: string,
  blocks: AnyResumeBlock[]
): string | null {
  const parts = elementId.split(":");
  if (parts.length !== 4) return null;

  const [blockId, entryId, field, indexStr] = parts;
  if (field !== "bullets") return null;

  const bulletIndex = parseInt(indexStr, 10);
  if (isNaN(bulletIndex)) return null;

  const block = blocks.find((b) => b.id === blockId);
  if (!block) return null;

  const entries = (block as BlockWithEntries).content;
  if (!entries || !Array.isArray(entries)) return null;

  const entryIndex = entries.findIndex((e) => e.id === entryId);
  if (entryIndex === -1) return null;

  return `${blockId}:entry-${entryIndex}:bullet-${bulletIndex}`;
}
