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

/**
 * Thrown when the deep-analysis endpoint returns 429 with a structured
 * body `{ detail, limit, used, resets_at }`. The CTA uses these fields to
 * show an accurate countdown rather than the generic "too many requests"
 * message that ``fetchApi`` would otherwise surface.
 */
export class DeepAnalysisQuotaError extends Error {
  readonly limit: number;
  readonly used: number;
  readonly resetsAt: string; // ISO timestamp
  readonly isQuotaExceeded = true;

  constructor(limit: number, used: number, resetsAt: string, message?: string) {
    super(message ?? "Daily limit reached");
    this.name = "DeepAnalysisQuotaError";
    this.limit = limit;
    this.used = used;
    this.resetsAt = resetsAt;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DeepAnalysisQuotaError);
    }
  }
}

export function isDeepAnalysisQuotaError(
  error: unknown,
): error is DeepAnalysisQuotaError {
  return error instanceof DeepAnalysisQuotaError;
}
