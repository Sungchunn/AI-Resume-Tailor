/**
 * Bullet Helpers
 *
 * Utilities for working with BulletItem arrays.
 * Handles transformation between API format (string[]) and UI format (BulletItem[]).
 */

import { nanoid } from "nanoid";
import type { BulletItem } from "./types";

/**
 * Convert string array to BulletItem array (API -> UI)
 * Each string gets a unique stable ID
 */
export function stringsToBullets(strings: string[] | undefined): BulletItem[] {
  if (!strings) return [];
  return strings.map((text) => ({
    id: nanoid(),
    text: typeof text === "string" ? text : "",
  }));
}

/**
 * Convert BulletItem array to string array (UI -> API)
 */
export function bulletsToStrings(bullets: BulletItem[] | undefined): string[] {
  if (!bullets) return [];
  return bullets.map((bullet) => bullet.text);
}

/**
 * Create a new empty bullet with a unique ID
 */
export function createBullet(text: string = ""): BulletItem {
  return { id: nanoid(), text };
}

/**
 * Insert a new bullet after the specified index
 */
export function insertBulletAfter(
  bullets: BulletItem[],
  afterIndex: number,
  text: string = ""
): BulletItem[] {
  const result = [...bullets];
  result.splice(afterIndex + 1, 0, createBullet(text));
  return result;
}

/**
 * Remove bullet at the specified index
 */
export function removeBulletAt(
  bullets: BulletItem[],
  index: number
): BulletItem[] {
  return bullets.filter((_, i) => i !== index);
}

/**
 * Update bullet text at the specified index (preserves ID)
 */
export function updateBulletAt(
  bullets: BulletItem[],
  index: number,
  text: string
): BulletItem[] {
  return bullets.map((bullet, i) =>
    i === index ? { ...bullet, text } : bullet
  );
}

/**
 * Check if a value is a BulletItem array (has id and text properties)
 */
export function isBulletItemArray(value: unknown): value is BulletItem[] {
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return true; // Empty array is valid
  const first = value[0];
  return (
    typeof first === "object" &&
    first !== null &&
    "id" in first &&
    "text" in first
  );
}

/**
 * Normalize bullets - convert string[] to BulletItem[] if needed
 * This handles data that might come from the API as string[] or
 * already be in BulletItem[] format from the UI
 */
export function normalizeBullets(
  bullets: string[] | BulletItem[] | undefined
): BulletItem[] {
  if (!bullets || bullets.length === 0) return [];

  // Already in BulletItem format
  if (isBulletItemArray(bullets)) {
    return bullets;
  }

  // Convert from string array
  return stringsToBullets(bullets as string[]);
}
