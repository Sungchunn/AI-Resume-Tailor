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

  // Handle accepted bullet suggestions - could be extended to create pending diffs
  const handleBulletAccepted = useCallback(
    (entryIndex: number, bulletIndex: number, original: string, suggested: string, reason: string) => {
      console.log("[BulletReview] Accepted suggestion:", {
        entryIndex,
        bulletIndex,
        original,
        suggested,
        reason,
      });
      // Future: Add to pending_diffs for undo/tracking
    },
    []
  );

  // Get job description from tailored resume or direct source
  const jobDescription = state.tailoredResume?.job_title
    ? `Position: ${state.tailoredResume.job_title}${state.tailoredResume.company_name ? ` at ${state.tailoredResume.company_name}` : ""}`
    : state.jobDescription;

  return (
    <SectionList
      content={state.content}
      sectionOrder={state.sectionOrder}
      activeSection={state.activeSection}
      onOrderChange={handleOrderChange}
      onContentChange={handleContentChange}
      onSectionFocus={handleSectionFocus}
      onAIEnhance={handleAIEnhance}
      jobDescription={jobDescription}
      resumeBuildId={state.tailoredId}
      onBulletAccepted={handleBulletAccepted}
    />
  );
}
