/**
 * UUID validation utilities for security hardening.
 * Used to validate that URL parameters contain valid UUID format.
 */

// Standard UUID v4 regex pattern (lowercase)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates if a string is a valid UUID format.
 * Accepts both uppercase and lowercase UUIDs.
 *
 * @param value - The string to validate
 * @returns true if the string is a valid UUID format
 *
 * @example
 * isValidUUID("550e8400-e29b-41d4-a716-446655440000") // true
 * isValidUUID("123") // false
 * isValidUUID("not-a-uuid") // false
 */
export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Checks if a string looks like a legacy integer ID.
 * Used to detect and handle bookmarked URLs with old integer IDs.
 *
 * @param value - The string to check
 * @returns true if the string is purely numeric (legacy integer ID)
 */
export function isLegacyIntegerId(value: string): boolean {
  return /^\d+$/.test(value);
}
