/**
 * Element Path Utilities
 *
 * Provides encoding/decoding for granular element identification within resume blocks.
 * Element IDs use a compound format: "blockId:entryId:field:index"
 *
 * Examples:
 * - Block only: "exp-1"
 * - Entry in block: "exp-1:entry-0"
 * - Field in entry: "exp-1:entry-0:title"
 * - Indexed item: "exp-1:entry-0:bullets:2"
 * - Array field (no entry): "skills-1::skills:4"
 */

/**
 * Parsed element path structure
 */
export interface ElementPath {
  /** The parent block ID */
  blockId: string;
  /** Entry ID for array entries (experience, education) */
  entryId?: string;
  /** Field name (title, company, bullets, skills) */
  field?: string;
  /** Index for array fields (bullets[2], skills[4]) */
  index?: number;
}

/** Separator used in compound element IDs */
const SEPARATOR = ":";

/**
 * Encode an ElementPath into a string ID
 *
 * @example
 * encodeElementPath({ blockId: "exp-1" }) // "exp-1"
 * encodeElementPath({ blockId: "exp-1", entryId: "entry-0" }) // "exp-1:entry-0"
 * encodeElementPath({ blockId: "exp-1", entryId: "entry-0", field: "title" }) // "exp-1:entry-0:title"
 * encodeElementPath({ blockId: "exp-1", entryId: "entry-0", field: "bullets", index: 2 }) // "exp-1:entry-0:bullets:2"
 * encodeElementPath({ blockId: "skills-1", field: "skills", index: 4 }) // "skills-1::skills:4"
 */
export function encodeElementPath(path: ElementPath): string {
  const parts: string[] = [path.blockId];

  // Always include entry slot (empty if no entry)
  if (path.field !== undefined || path.index !== undefined) {
    parts.push(path.entryId ?? "");
  } else if (path.entryId !== undefined) {
    parts.push(path.entryId);
  }

  // Include field if present
  if (path.field !== undefined) {
    parts.push(path.field);
  }

  // Include index if present
  if (path.index !== undefined) {
    parts.push(String(path.index));
  }

  return parts.join(SEPARATOR);
}

/**
 * Decode a string ID into an ElementPath
 *
 * @example
 * decodeElementPath("exp-1") // { blockId: "exp-1" }
 * decodeElementPath("exp-1:entry-0") // { blockId: "exp-1", entryId: "entry-0" }
 * decodeElementPath("exp-1:entry-0:title") // { blockId: "exp-1", entryId: "entry-0", field: "title" }
 * decodeElementPath("exp-1:entry-0:bullets:2") // { blockId: "exp-1", entryId: "entry-0", field: "bullets", index: 2 }
 * decodeElementPath("skills-1::skills:4") // { blockId: "skills-1", field: "skills", index: 4 }
 */
export function decodeElementPath(encoded: string): ElementPath {
  const parts = encoded.split(SEPARATOR);
  const path: ElementPath = {
    blockId: parts[0],
  };

  // Second part is entry ID (can be empty string for blocks without entries)
  if (parts.length > 1 && parts[1] !== "") {
    path.entryId = parts[1];
  }

  // Third part is field name
  if (parts.length > 2) {
    path.field = parts[2];
  }

  // Fourth part is index
  if (parts.length > 3) {
    const indexStr = parts[3];
    const index = parseInt(indexStr, 10);
    if (!isNaN(index)) {
      path.index = index;
    }
  }

  return path;
}

/**
 * Extract the block ID from a compound element ID
 *
 * @example
 * getBlockId("exp-1:entry-0:title") // "exp-1"
 * getBlockId("exp-1") // "exp-1"
 */
export function getBlockId(elementId: string): string {
  const separatorIndex = elementId.indexOf(SEPARATOR);
  return separatorIndex === -1 ? elementId : elementId.substring(0, separatorIndex);
}

/**
 * Check if a child element ID is a descendant of a parent element ID
 *
 * @example
 * isChildOf("exp-1:entry-0:title", "exp-1") // true
 * isChildOf("exp-1:entry-0:bullets:2", "exp-1:entry-0") // true
 * isChildOf("exp-1:entry-0", "exp-1:entry-1") // false
 * isChildOf("skills-1::skills:4", "skills-1") // true
 */
export function isChildOf(child: string, parent: string): boolean {
  // Parent must be a prefix of child
  if (!child.startsWith(parent)) {
    return false;
  }
  // If lengths are equal, they're the same element (not parent-child)
  if (child.length === parent.length) {
    return false;
  }
  // Child must have a separator after the parent prefix
  return child[parent.length] === SEPARATOR;
}

/**
 * Get the depth of an element path
 * Useful for determining highlight intensity or nesting level
 *
 * @example
 * getPathDepth("exp-1") // 1 (block only)
 * getPathDepth("exp-1:entry-0") // 2 (block + entry)
 * getPathDepth("exp-1:entry-0:title") // 3 (block + entry + field)
 * getPathDepth("exp-1:entry-0:bullets:2") // 4 (block + entry + field + index)
 */
export function getPathDepth(elementId: string): number {
  const parts = elementId.split(SEPARATOR);
  // Filter out empty parts (e.g., from "skills-1::skills:4")
  return parts.filter((part) => part !== "").length;
}

/**
 * Create element ID for a block
 */
export function createBlockElementId(blockId: string): string {
  return blockId;
}

/**
 * Create element ID for an entry within a block
 */
export function createEntryElementId(blockId: string, entryId: string): string {
  return encodeElementPath({ blockId, entryId });
}

/**
 * Create element ID for a field within an entry
 */
export function createFieldElementId(
  blockId: string,
  entryId: string | undefined,
  field: string
): string {
  return encodeElementPath({ blockId, entryId, field });
}

/**
 * Create element ID for an indexed item within an array field
 */
export function createIndexedElementId(
  blockId: string,
  entryId: string | undefined,
  field: string,
  index: number
): string {
  return encodeElementPath({ blockId, entryId, field, index });
}
