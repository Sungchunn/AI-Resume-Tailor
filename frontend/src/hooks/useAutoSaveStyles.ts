"use client";

import { useRef, useEffect, useCallback } from "react";
import type { BlockEditorStyle } from "@/lib/resume/types";

/**
 * Configuration for auto-save behavior
 */
export interface UseAutoSaveStylesOptions {
  /** Current style state */
  style: BlockEditorStyle;
  /** Whether fit-to-one-page is enabled */
  fitToOnePage: boolean;
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Whether AI is currently streaming (suspend auto-save during LLM operations) */
  isStreaming?: boolean;
  /** Whether auto-fit is currently processing (suspend auto-save during fitting) */
  isFitting?: boolean;
  /** Whether a conflict has been detected (block all saves) */
  hasConflict?: boolean;
  /** Execute the save operation - should return true on success */
  executeSave: () => Promise<boolean>;
  /** Debounce delay in milliseconds (default: 2000) */
  debounceMs?: number;
}

/**
 * Return type for the auto-save hook
 */
export interface UseAutoSaveStylesReturn {
  /**
   * Handle a manual save request.
   * Cancels any pending auto-save and executes save immediately.
   */
  handleManualSave: () => Promise<void>;
  /**
   * Cancel any pending auto-save timer.
   * Useful when unmounting or when save should be deferred.
   */
  cancelPendingAutoSave: () => void;
  /**
   * Check if an auto-save is pending (synchronous).
   */
  hasPendingAutoSave: () => boolean;
}

/**
 * Compute a simple hash of the style object for change detection.
 * Using JSON.stringify for simplicity - sufficient for shallow objects.
 */
function computeStyleHash(style: BlockEditorStyle): string {
  return JSON.stringify(style);
}

/**
 * Hook for eagerly persisting style changes with proper coordination.
 *
 * This hook implements the eager persistence pattern for fit-to-one-page:
 * - Auto-saves style changes with a debounce delay
 * - Skips save if styles haven't changed (hash comparison)
 * - Cancels pending auto-save when manual save is triggered
 * - Suspends auto-save during AI streaming or auto-fit processing
 * - Respects conflict state (blocks all saves when in conflict)
 *
 * Race Condition Mitigations:
 * 1. Debounce prevents API spam during rapid changes
 * 2. Hash comparison prevents duplicate saves of identical styles
 * 3. Manual save cancels pending auto-save to prevent races
 * 4. isStreaming/isFitting flags suspend auto-save during operations
 *
 * @see /docs/features/fit-to-one-page/130326_tradeoff-3-eager-persistence.md
 *
 * @example
 * ```typescript
 * const { handleManualSave } = useAutoSaveStyles({
 *   style: state.style,
 *   fitToOnePage: state.fitToOnePage,
 *   isDirty: state.isDirty,
 *   executeSave: async () => {
 *     const result = await coordinator.executeSave({ style, version });
 *     return result !== null;
 *   },
 * });
 *
 * // In save button onClick
 * await handleManualSave();
 * ```
 */
export function useAutoSaveStyles({
  style,
  fitToOnePage,
  isDirty,
  isStreaming = false,
  isFitting = false,
  hasConflict = false,
  executeSave,
  debounceMs = 2000,
}: UseAutoSaveStylesOptions): UseAutoSaveStylesReturn {
  // Track the hash of the last successfully saved style
  const lastSavedStyleHashRef = useRef<string>(computeStyleHash(style));

  // Track pending auto-save timer
  const pendingAutoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track if a save is currently in flight (prevents concurrent saves)
  const saveInProgressRef = useRef<boolean>(false);

  /**
   * Cancel any pending auto-save timer.
   */
  const cancelPendingAutoSave = useCallback(() => {
    if (pendingAutoSaveRef.current) {
      clearTimeout(pendingAutoSaveRef.current);
      pendingAutoSaveRef.current = null;
    }
  }, []);

  /**
   * Check if an auto-save is pending.
   */
  const hasPendingAutoSave = useCallback(() => {
    return pendingAutoSaveRef.current !== null;
  }, []);

  /**
   * Execute save with lock protection.
   * Updates the last saved hash on success.
   */
  const executeProtectedSave = useCallback(async () => {
    if (saveInProgressRef.current) {
      console.log("[AutoSaveStyles] Save already in progress, skipping");
      return;
    }

    if (hasConflict) {
      console.log("[AutoSaveStyles] In conflict state, save blocked");
      return;
    }

    const currentHash = computeStyleHash(style);

    // Skip if styles haven't changed since last save
    if (currentHash === lastSavedStyleHashRef.current) {
      console.log("[AutoSaveStyles] Styles unchanged, skipping save");
      return;
    }

    saveInProgressRef.current = true;

    try {
      const success = await executeSave();
      if (success) {
        // Update hash only on successful save
        lastSavedStyleHashRef.current = currentHash;
        console.log("[AutoSaveStyles] Auto-save completed successfully");
      }
    } catch (error) {
      console.error("[AutoSaveStyles] Auto-save failed:", error);
    } finally {
      saveInProgressRef.current = false;
    }
  }, [style, hasConflict, executeSave]);

  /**
   * Handle manual save: cancel pending auto-save and execute immediately.
   */
  const handleManualSave = useCallback(async () => {
    // Cancel any pending auto-save to prevent race
    cancelPendingAutoSave();

    // Execute save immediately
    await executeProtectedSave();
  }, [cancelPendingAutoSave, executeProtectedSave]);

  /**
   * Auto-save effect: trigger debounced save when styles change.
   *
   * Conditions for auto-save to fire:
   * 1. fitToOnePage is enabled
   * 2. isDirty is true (there are unsaved changes)
   * 3. Not currently streaming (AI operation)
   * 4. Not currently fitting (auto-fit in progress)
   * 5. Not in conflict state
   * 6. Style has changed since last save (hash comparison)
   */
  useEffect(() => {
    // Early exit conditions
    if (!fitToOnePage) return;
    if (!isDirty) return;
    if (isStreaming) {
      console.log("[AutoSaveStyles] Streaming in progress, suspending auto-save");
      return;
    }
    if (isFitting) {
      console.log("[AutoSaveStyles] Auto-fit in progress, suspending auto-save");
      return;
    }
    if (hasConflict) {
      console.log("[AutoSaveStyles] Conflict detected, suspending auto-save");
      return;
    }

    const currentHash = computeStyleHash(style);

    // Skip if no change
    if (currentHash === lastSavedStyleHashRef.current) {
      return;
    }

    // Clear any existing timer
    if (pendingAutoSaveRef.current) {
      clearTimeout(pendingAutoSaveRef.current);
    }

    // Schedule new auto-save
    console.log("[AutoSaveStyles] Scheduling auto-save in", debounceMs, "ms");
    pendingAutoSaveRef.current = setTimeout(() => {
      // Double-check conditions before executing
      // (they may have changed during the debounce period)
      if (!saveInProgressRef.current && !isStreaming && !isFitting && !hasConflict) {
        executeProtectedSave();
      }
      pendingAutoSaveRef.current = null;
    }, debounceMs);

    // Cleanup: cancel timer on unmount or dependency change
    return () => {
      if (pendingAutoSaveRef.current) {
        clearTimeout(pendingAutoSaveRef.current);
      }
    };
  }, [
    style,
    fitToOnePage,
    isDirty,
    isStreaming,
    isFitting,
    hasConflict,
    debounceMs,
    executeProtectedSave,
  ]);

  /**
   * Cleanup on unmount: cancel any pending auto-save.
   */
  useEffect(() => {
    return () => {
      cancelPendingAutoSave();
    };
  }, [cancelPendingAutoSave]);

  /**
   * Sync last saved hash when style is reset externally.
   * This handles cases like:
   * - Initial load from API
   * - Conflict resolution (refresh)
   * - Undo/redo operations
   */
  useEffect(() => {
    if (!isDirty) {
      lastSavedStyleHashRef.current = computeStyleHash(style);
    }
  }, [isDirty, style]);

  return {
    handleManualSave,
    cancelPendingAutoSave,
    hasPendingAutoSave,
  };
}
