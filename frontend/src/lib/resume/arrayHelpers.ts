/**
 * Array Helpers for Immutable Operations
 *
 * Utility functions for immutable array operations used in inline editing
 * of entry-based resume blocks (experience, education, projects, etc.).
 */

/**
 * Update item at index in nested array
 *
 * @example
 * updateNestedArrayItem([a, b, c], 1, (item) => ({ ...item, title: "New" }))
 * // Returns [a, { ...b, title: "New" }, c]
 */
export function updateNestedArrayItem<T>(
  array: T[],
  index: number,
  updater: (item: T) => T
): T[] {
  return array.map((item, i) => (i === index ? updater(item) : item));
}

/**
 * Insert item after index in array
 *
 * @example
 * insertAfter([a, b, c], 1, d)
 * // Returns [a, b, d, c]
 */
export function insertAfter<T>(array: T[], index: number, item: T): T[] {
  const result = [...array];
  result.splice(index + 1, 0, item);
  return result;
}

/**
 * Remove item at index from array
 *
 * @example
 * removeAt([a, b, c], 1)
 * // Returns [a, c]
 */
export function removeAt<T>(array: T[], index: number): T[] {
  return array.filter((_, i) => i !== index);
}

/**
 * Update item at index in array with a new value
 *
 * @example
 * updateAt([a, b, c], 1, d)
 * // Returns [a, d, c]
 */
export function updateAt<T>(array: T[], index: number, newValue: T): T[] {
  return array.map((item, i) => (i === index ? newValue : item));
}
