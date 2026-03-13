# Phase 3: Save Coordinator Hook

**Created:** 2026-03-13
**Status:** Planning
**Parent:** [Master Plan](./130326_master-plan.md)
**Depends On:** [Phase 2: Frontend API](./130326_phase-2-frontend-api.md)
**Referenced By:** [Fit-to-One-Page Tradeoff 3](../fit-to-one-page/130326_tradeoff-3-eager-persistence.md)

---

## Overview

Create the `useSaveCoordinator` hook that centralizes save coordination logic. This hook is the **foundation** for the fit-to-one-page feature's eager persistence behavior.

---

## Design Goals

The hook must handle:

| Concern | Solution |
| ------- | -------- |
| Save operation lock | Prevents concurrent API calls within a tab |
| Hash comparison | Skips save if content unchanged |
| Debounce management | Single timer ref with proper cleanup |
| OCC integration | Passes version to API; catches 409 |
| Conflict state | Exposes `hasConflict` for UI |
| Manual save priority | Cancels pending auto-saves |

**Note:** BroadcastChannel integration is handled in [Phase 4](./130326_phase-4-broadcast-channel.md) and will be added to this hook.

---

## Implementation

**File:** `frontend/src/hooks/useSaveCoordinator.ts` (NEW)

```typescript
"use client";

import { useRef, useCallback, useState } from "react";
import { useUpdateResume } from "@/lib/api/hooks";
import {
  VersionConflictError,
  isVersionConflictError,
} from "@/lib/api/errors";
import type { ResumeUpdate } from "@/lib/api/types";

/**
 * State exposed by the save coordinator
 */
export interface SaveCoordinatorState {
  /** Whether a save operation is currently in progress */
  isSaving: boolean;
  /** Whether a version conflict has been detected */
  hasConflict: boolean;
  /** The conflict error, if any */
  conflictError: VersionConflictError | null;
}

/**
 * Options for the save coordinator hook
 */
export interface UseSaveCoordinatorOptions {
  /** Resume ID for API calls */
  resumeId: string;
  /** Callback on successful save */
  onSaveSuccess?: (newVersion: number) => void;
  /** Callback on version conflict */
  onConflict?: (error: VersionConflictError) => void;
  /** Callback on other errors */
  onError?: (error: Error) => void;
}

/**
 * Return type for the save coordinator hook
 */
export interface UseSaveCoordinatorReturn extends SaveCoordinatorState {
  /**
   * Execute a save operation with proper coordination.
   *
   * - Acquires lock to prevent concurrent saves
   * - Passes version for OCC
   * - Handles 409 conflicts
   * - Returns new version on success, null on failure
   */
  executeSave: (data: ResumeUpdate) => Promise<number | null>;
  /**
   * Clear the conflict state (called after user action, e.g., refresh)
   */
  clearConflict: () => void;
  /**
   * Check if a save is currently in progress (synchronous)
   */
  isSaveInProgress: () => boolean;
}

/**
 * Hook for coordinating save operations with OCC.
 *
 * Centralizes:
 * - Save operation locking (prevents concurrent API calls)
 * - Version conflict detection
 * - Error handling
 *
 * This is the foundation for the fit-to-one-page feature's
 * eager persistence behavior.
 *
 * @example
 * ```typescript
 * const { executeSave, hasConflict, isSaving } = useSaveCoordinator({
 *   resumeId: "abc123",
 *   onConflict: () => setShowConflictModal(true),
 * });
 *
 * // Manual save
 * const handleSave = async () => {
 *   const newVersion = await executeSave({
 *     version: currentVersion,
 *     title: "Updated title",
 *   });
 *   if (newVersion) {
 *     setCurrentVersion(newVersion);
 *   }
 * };
 * ```
 */
export function useSaveCoordinator({
  resumeId,
  onSaveSuccess,
  onConflict,
  onError,
}: UseSaveCoordinatorOptions): UseSaveCoordinatorReturn {
  // Lock to prevent concurrent saves
  const saveInProgressRef = useRef(false);

  // Conflict state
  const [hasConflict, setHasConflict] = useState(false);
  const [conflictError, setConflictError] = useState<VersionConflictError | null>(null);

  // Mutation hook (handles cache invalidation)
  const updateMutation = useUpdateResume({
    onVersionConflict: (error) => {
      setHasConflict(true);
      setConflictError(error);
      onConflict?.(error);
    },
  });

  /**
   * Execute a save operation with proper coordination.
   *
   * @returns New version number on success, null on failure
   */
  const executeSave = useCallback(
    async (data: ResumeUpdate): Promise<number | null> => {
      // Check lock
      if (saveInProgressRef.current) {
        console.log("[SaveCoordinator] Save already in progress, skipping");
        return null;
      }

      // Check if already in conflict state
      if (hasConflict) {
        console.log("[SaveCoordinator] In conflict state, save blocked");
        return null;
      }

      // Acquire lock
      saveInProgressRef.current = true;

      try {
        const result = await updateMutation.mutateAsync({
          id: resumeId,
          data,
        });

        const newVersion = result.version;
        onSaveSuccess?.(newVersion);
        return newVersion;
      } catch (error) {
        // Conflict errors are handled by the mutation hook's onVersionConflict
        if (isVersionConflictError(error)) {
          return null;
        }

        // Other errors
        if (error instanceof Error) {
          console.error("[SaveCoordinator] Save failed:", error.message);
          onError?.(error);
        }
        return null;
      } finally {
        saveInProgressRef.current = false;
      }
    },
    [resumeId, hasConflict, updateMutation, onSaveSuccess, onError]
  );

  /**
   * Clear conflict state (called after user refreshes)
   */
  const clearConflict = useCallback(() => {
    setHasConflict(false);
    setConflictError(null);
  }, []);

  /**
   * Synchronous check if save is in progress
   */
  const isSaveInProgress = useCallback(() => {
    return saveInProgressRef.current;
  }, []);

  return {
    executeSave,
    clearConflict,
    isSaving: updateMutation.isPending,
    hasConflict,
    conflictError,
    isSaveInProgress,
  };
}
```

---

## Future Extension: Auto-Save Support

When implementing the fit-to-one-page feature, this hook will be extended with:

```typescript
export interface UseSaveCoordinatorOptions {
  // ... existing options ...

  /** Enable automatic saving on style changes */
  autoSaveEnabled?: boolean;
  /** Debounce delay for auto-save (default: 2000ms) */
  autoSaveDelay?: number;
  /** Current style for change detection */
  currentStyle?: BlockEditorStyle;
  /** Whether AI is currently streaming (suspend auto-save) */
  isStreaming?: boolean;
}
```

The auto-save logic from [Fit-to-One-Page Tradeoff 3](../fit-to-one-page/130326_tradeoff-3-eager-persistence.md) will be integrated here:

```typescript
// Auto-save effect (to be added for fit-to-one-page)
useEffect(() => {
  if (!autoSaveEnabled || isStreaming || hasConflict) return;

  const currentStyleHash = JSON.stringify(currentStyle);
  if (currentStyleHash === lastSavedStyleRef.current) return;

  if (pendingAutoSaveRef.current) {
    clearTimeout(pendingAutoSaveRef.current);
  }

  pendingAutoSaveRef.current = setTimeout(() => {
    if (!saveInProgressRef.current && !isStreaming) {
      executeSave({ version: currentVersion, style: currentStyle });
    }
    pendingAutoSaveRef.current = null;
  }, autoSaveDelay);

  return () => {
    if (pendingAutoSaveRef.current) clearTimeout(pendingAutoSaveRef.current);
  };
}, [currentStyle, autoSaveEnabled, isStreaming, autoSaveDelay, hasConflict]);
```

---

## Integration Point

This hook will be used by `BlockEditorProvider` once [Phase 5: Conflict UI](./130326_phase-5-conflict-ui.md) is complete:

```typescript
// In BlockEditorProvider
const {
  executeSave,
  hasConflict,
  isSaving,
  clearConflict,
} = useSaveCoordinator({
  resumeId,
  onSaveSuccess: (newVersion) => {
    setCurrentVersion(newVersion);
    broadcast("SAVE_COMPLETED", newVersion);
  },
  onConflict: () => {
    broadcast("VERSION_CONFLICT");
  },
});
```

---

## Verification

### Manual Save Test

```typescript
const { executeSave, isSaving, hasConflict } = useSaveCoordinator({
  resumeId: "test-123",
});

// 1. Execute save
const newVersion = await executeSave({ version: 1, title: "Updated" });
expect(newVersion).toBe(2);

// 2. Concurrent save should be blocked
saveInProgressRef.current = true;
const result = await executeSave({ version: 2, title: "Another" });
expect(result).toBeNull();
```

### Conflict Detection Test

```typescript
// Mock 409 response
server.use(
  rest.put("/api/resumes/test-123", (req, res, ctx) => {
    return res(
      ctx.status(409),
      ctx.json({
        detail: {
          error: "version_conflict",
          expected_version: 1,
        },
      })
    );
  })
);

const { executeSave, hasConflict, conflictError } = useSaveCoordinator({
  resumeId: "test-123",
  onConflict: (error) => console.log("Conflict!", error),
});

await executeSave({ version: 1, title: "Stale" });
expect(hasConflict).toBe(true);
expect(conflictError?.expectedVersion).toBe(1);
```

---

## Next Phase

Proceed to [Phase 4: BroadcastChannel](./130326_phase-4-broadcast-channel.md) to implement cross-tab notification.
