"use client";

import { useCallback, useEffect } from "react";

import { useInlineEditOptional } from "@/components/library/editor/inline/InlineEditContext";
import { useBlockEditorOptional } from "@/components/library/editor/BlockEditorContext";
import { useIsInlineReviewActive } from "@/lib/stores/inlineSuggestionQueueStore";
import {
  useRewriteDiffStore,
  useRewriteIsActive,
} from "@/lib/stores/rewriteDiffStore";

/**
 * Returns wrapped accept/undo actions that update both the rewriteDiffStore
 * and the block editor content via updateContentByPath.
 *
 * Must be called inside a BlockEditorProvider to update block content.
 */
function useRewriteActions() {
  const editorContext = useBlockEditorOptional();

  const acceptCurrent = useCallback(() => {
    const { activeElementId, bullets, markAccepted, advanceNext } =
      useRewriteDiffStore.getState();
    if (!activeElementId) return;

    const entry = bullets[activeElementId];
    if (!entry || entry.status !== "pending") return;

    // The proposed text is always at index 1 in the stateStack
    const proposedText = entry.stateStack[1];
    if (proposedText !== undefined && editorContext) {
      editorContext.updateContentByPath(activeElementId, proposedText);
    }

    markAccepted(activeElementId);
    advanceNext();
  }, [editorContext]);

  const undoCurrent = useCallback(() => {
    const { activeElementId, bullets, popUndo } = useRewriteDiffStore.getState();
    if (!activeElementId) return;

    const entry = bullets[activeElementId];
    if (!entry || entry.currentIndex <= 0) return;

    // Only call updateContentByPath if the text was already written to blocks (accepted)
    if (entry.status === "accepted" && editorContext) {
      const originalText = entry.stateStack[0];
      editorContext.updateContentByPath(activeElementId, originalText);
    }

    popUndo(activeElementId);
  }, [editorContext]);

  const advanceNext = useCallback(() => {
    useRewriteDiffStore.getState().advanceNext();
  }, []);

  const advancePrevious = useCallback(() => {
    useRewriteDiffStore.getState().advancePrevious();
  }, []);

  return { acceptCurrent, undoCurrent, advanceNext, advancePrevious };
}

/**
 * Document-level keyboard handler for the AI rewrite review mode.
 *
 * Arrow keys navigate between pending bullets.
 * Tab/Enter accepts the current proposed rewrite and advances.
 * Escape undoes the current bullet (reverts to previous state in stateStack).
 *
 * Yields to InlineEditContext when the user is actively editing a bullet.
 * Deactivates when the batch suggestion review (inlineSuggestionQueueStore) is active.
 */
export function useRewriteKeyboard() {
  const isRewriteActive = useRewriteIsActive();
  const isBatchReviewActive = useIsInlineReviewActive();
  const inlineEditContext = useInlineEditOptional();
  const { acceptCurrent, undoCurrent, advanceNext, advancePrevious } =
    useRewriteActions();

  useEffect(() => {
    // Don't activate if rewrite review is off or batch suggestion review owns the keyboard
    if (!isRewriteActive || isBatchReviewActive) return;

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      // Yield to inline editing
      if (inlineEditContext?.focusedElementId) return;
      const target = e.target as HTMLElement;
      if (target.isContentEditable) return;

      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        acceptCurrent();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        undoCurrent();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        advanceNext();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        advancePrevious();
      }
    };

    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [
    isRewriteActive,
    isBatchReviewActive,
    inlineEditContext?.focusedElementId,
    acceptCurrent,
    undoCurrent,
    advanceNext,
    advancePrevious,
  ]);
}
