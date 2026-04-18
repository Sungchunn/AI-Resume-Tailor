"use client";

import { useEffect } from "react";

import {
  useIsInlineReviewActive,
  useInlineSuggestionQueueStore,
} from "@/lib/stores/inlineSuggestionQueueStore";
import { useInlineEditOptional } from "@/components/library/editor/inline/InlineEditContext";
import { useInlineSuggestionQueueContext } from "@/components/library/editor/InlineSuggestionQueueProvider";

export function useInlineSuggestionKeyboard() {
  const isActive = useIsInlineReviewActive();
  const inlineEditContext = useInlineEditOptional();
  // Wrapped version: writes the improved text back to the block, not just
  // the queue status. The store-level acceptCurrent alone leaves the resume
  // text unchanged.
  const { acceptCurrent } = useInlineSuggestionQueueContext();

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      // Yield to inline editing — if a bullet is being edited, don't intercept
      if (inlineEditContext?.focusedElementId) return;

      const target = e.target as HTMLElement;
      if (target.isContentEditable) return;

      const store = useInlineSuggestionQueueStore.getState();

      if (e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();

        if (store.typewriterDone) {
          acceptCurrent();
        } else {
          store.setRequestFastForward(true);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        store.dismissCurrent();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        store.advanceNext();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        store.advancePrevious();
      }
    };

    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [isActive, inlineEditContext?.focusedElementId, acceptCurrent]);
}
