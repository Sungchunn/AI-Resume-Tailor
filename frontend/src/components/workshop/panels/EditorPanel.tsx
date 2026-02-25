"use client";

import { useCallback } from "react";
import { useWorkshop } from "../WorkshopContext";
import { SectionList } from "./SectionList";
import type { TailoredContent } from "@/lib/api/types";

export function EditorPanel() {
  const { state, dispatch, generateAISuggestions } = useWorkshop();

  const handleOrderChange = useCallback(
    (newOrder: string[]) => {
      dispatch({ type: "SET_SECTION_ORDER", payload: newOrder });
    },
    [dispatch]
  );

  const handleContentChange = useCallback(
    (content: TailoredContent) => {
      dispatch({ type: "SET_CONTENT", payload: content });
    },
    [dispatch]
  );

  const handleSectionFocus = useCallback(
    (section: string) => {
      dispatch({ type: "SET_ACTIVE_SECTION", payload: section });
    },
    [dispatch]
  );

  const handleAIEnhance = useCallback(
    async (section: string) => {
      // Generate AI suggestions focused on this section
      await generateAISuggestions(`Improve the ${section} section`, [section]);
    },
    [generateAISuggestions]
  );

  return (
    <SectionList
      content={state.content}
      sectionOrder={state.sectionOrder}
      activeSection={state.activeSection}
      onOrderChange={handleOrderChange}
      onContentChange={handleContentChange}
      onSectionFocus={handleSectionFocus}
      onAIEnhance={handleAIEnhance}
    />
  );
}
