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
