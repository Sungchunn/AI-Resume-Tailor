/**
 * Custom error for version conflicts (HTTP 409).
 *
 * Thrown when the client's version doesn't match the server's version,
 * indicating another session modified the document.
 */
export class VersionConflictError extends Error {
  readonly expectedVersion: number;
  readonly isConflict = true;

  constructor(expectedVersion: number, message?: string) {
    super(message ?? "Document was modified by another session");
    this.name = "VersionConflictError";
    this.expectedVersion = expectedVersion;

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, VersionConflictError);
    }
  }
}

/**
 * Type guard to check if an error is a VersionConflictError.
 *
 * Useful for catching and handling conflicts in try/catch blocks.
 *
 * @example
 * ```typescript
 * try {
 *   await saveResume(data);
 * } catch (error) {
 *   if (isVersionConflictError(error)) {
 *     showConflictModal();
 *   } else {
 *     throw error;
 *   }
 * }
 * ```
 */
export function isVersionConflictError(error: unknown): error is VersionConflictError {
  return error instanceof VersionConflictError;
}
