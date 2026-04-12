"use client";

import { useEffect } from "react";

import {
  useIsInlineReviewActive,
  useInlineSuggestionQueueStore,
} from "@/lib/stores/inlineSuggestionQueueStore";
import { useInlineEditOptional } from "@/components/library/editor/inline/InlineEditContext";

export function useInlineSuggestionKeyboard() {
  const isActive = useIsInlineReviewActive();
  const inlineEditContext = useInlineEditOptional();

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
          store.acceptCurrent();
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
  }, [isActive, inlineEditContext?.focusedElementId]);
}
