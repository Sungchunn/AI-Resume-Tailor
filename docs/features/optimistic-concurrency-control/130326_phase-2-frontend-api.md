# Phase 2: Frontend API Layer

**Created:** 2026-03-13
**Status:** Planning
**Parent:** [Master Plan](./130326_master-plan.md)
**Depends On:** [Phase 1: Backend OCC](./130326_phase-1-backend-occ.md)

---

## Overview

Update the frontend API layer to support version-based optimistic concurrency control.

---

## 2.1 TypeScript Types

**File:** `frontend/src/lib/api/types.ts`

### ResumeUpdate

Add required `version` field:

```typescript
export interface ResumeUpdate {
  version: number;  // NEW: Required for OCC
  title?: string;
  raw_content?: string;
  html_content?: string;
  parsed_content?: Record<string, unknown> | null;
  style?: ResumeStyle | null;
}
```

### ResumeResponse

Add `version` field:

```typescript
export interface ResumeResponse extends ResumeBase {
  id: string;
  user_id: number;
  parsed?: Record<string, unknown> | null;
  style?: ResumeStyle | null;
  html_content?: string | null;
  original_file?: OriginalFileInfo | null;
  is_master: boolean;
  created_at: string;
  updated_at?: string | null;
  parsed_verified: boolean;
  parsed_verified_at: string | null;
  version: number;  // NEW: Document version for OCC
}
```

---

## 2.2 Custom Error Class

**File:** `frontend/src/lib/api/errors.ts` (NEW)

```typescript
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
```

---

## 2.3 API Client Update

**File:** `frontend/src/lib/api/client.ts`

### Import Error Class

```typescript
import { VersionConflictError } from "./errors";
```

### Update `fetchApi()` Function

Add 409 handling after 401 handling:

```typescript
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
  includeAuth = true
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (includeAuth) {
    const token = tokenManager.getAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (error) {
    throw new Error(
      `Unable to connect to server. Please ensure the backend is running at ${API_BASE_URL}`
    );
  }

  // Handle 401 - try to refresh token
  if (response.status === 401 && includeAuth) {
    // ... existing 401 handling code ...
  }

  // NEW: Handle 409 Conflict (version mismatch)
  if (response.status === 409) {
    const errorBody = await response.json().catch(() => ({}));
    if (errorBody.detail?.error === "version_conflict") {
      throw new VersionConflictError(
        errorBody.detail.expected_version,
        errorBody.detail.message
      );
    }
    // Non-version 409 errors
    throw new Error(errorBody.detail?.message || "Conflict error");
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}
```

---

## 2.4 API Hooks Update

**File:** `frontend/src/lib/api/hooks.ts`

### Import Error Utilities

```typescript
import { VersionConflictError, isVersionConflictError } from "./errors";
```

### Enhanced `useUpdateResume` Hook

Add optional conflict callback:

```typescript
export interface UseUpdateResumeOptions {
  /**
   * Callback invoked when a version conflict (HTTP 409) occurs.
   * Use this to show conflict UI.
   */
  onVersionConflict?: (error: VersionConflictError) => void;
}

export function useUpdateResume(options?: UseUpdateResumeOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ResumeUpdate }) =>
      resumeApi.update(id, data),
    onSuccess: (updatedResume, { id }) => {
      // Update cache with new data (includes new version)
      queryClient.setQueryData(queryKeys.resumes.detail(id), updatedResume);
      queryClient.invalidateQueries({ queryKey: queryKeys.resumes.list() });
    },
    onError: (error) => {
      if (isVersionConflictError(error) && options?.onVersionConflict) {
        options.onVersionConflict(error);
      }
    },
  });
}
```

---

## Verification

### Type Checking

Ensure TypeScript catches missing version:

```typescript
// This should cause a TypeScript error
const badUpdate: ResumeUpdate = {
  title: "Missing version",
};
// Error: Property 'version' is missing in type...

// This should pass
const goodUpdate: ResumeUpdate = {
  version: 1,
  title: "Has version",
};
```

### Error Handling

```typescript
// Test VersionConflictError behavior
const error = new VersionConflictError(5, "Custom message");
console.log(error.name);            // "VersionConflictError"
console.log(error.expectedVersion); // 5
console.log(error.message);         // "Custom message"
console.log(isVersionConflictError(error)); // true
console.log(isVersionConflictError(new Error())); // false
```

### Integration Test

```typescript
// Mock 409 response
fetchMock.mockResponseOnce(
  JSON.stringify({
    detail: {
      error: "version_conflict",
      message: "Resume was modified by another session.",
      expected_version: 3,
    },
  }),
  { status: 409 }
);

// Call should throw VersionConflictError
await expect(resumeApi.update("id", { version: 2, title: "Test" }))
  .rejects
  .toThrow(VersionConflictError);
```

---

## Next Phase

After completing this phase, proceed to [Phase 3: Save Coordinator](./130326_phase-3-save-coordinator.md) to implement the `useSaveCoordinator` hook that uses these primitives.
