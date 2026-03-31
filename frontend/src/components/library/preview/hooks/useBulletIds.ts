"use client";

import { useRef } from "react";
import { nanoid } from "nanoid";

/**
 * Generate stable IDs for bullet arrays to use as React keys.
 *
 * Problem: Using array indices as React keys causes the wrong DOM element
 * to be removed when deleting items from the middle of an array.
 *
 * Solution: This hook maintains stable IDs that persist across renders
 * and synchronize with array length changes.
 *
 * @param entries - Array of entries with bullets or relevantCourses
 * @param field - Which field to generate IDs for ("bullets" or "relevantCourses")
 * @returns Map from entry.id to array of stable bullet IDs
 *
 * @example
 * ```tsx
 * const bulletIds = useBulletIds(content);
 * {entry.bullets.map((bullet, idx) => (
 *   <li key={bulletIds.get(entry.id)?.[idx]}>{bullet}</li>
 * ))}
 * ```
 */
export function useBulletIds(
  entries: { id: string; bullets?: string[]; relevantCourses?: string[] }[],
  field: "bullets" | "relevantCourses" = "bullets"
): Map<string, string[]> {
  const idsRef = useRef<Map<string, string[]>>(new Map());

  // Sync IDs with current entries
  entries.forEach((entry) => {
    const items = field === "bullets" ? entry.bullets : entry.relevantCourses;
    const count = items?.length ?? 0;

    let ids = idsRef.current.get(entry.id);
    if (!ids) {
      ids = [];
      idsRef.current.set(entry.id, ids);
    }

    // Add IDs for new items
    while (ids.length < count) {
      ids.push(nanoid());
    }
    // Trim IDs for removed items
    if (ids.length > count) {
      ids.length = count;
    }
  });

  // Clean up IDs for entries that no longer exist
  const currentEntryIds = new Set(entries.map((e) => e.id));
  for (const entryId of idsRef.current.keys()) {
    if (!currentEntryIds.has(entryId)) {
      idsRef.current.delete(entryId);
    }
  }

  return idsRef.current;
}
