"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { SuggestionProgressPanel } from "./tabs/SuggestionProgressPanel";
import { useATSProgressStore } from "@/lib/stores/atsProgressStore";
import { useTailorEditorContextSafe } from "@/components/tailor/editor/TailorEditorContext";

interface EditorSuggestionDockProps {
  jobId: string | null;
  jobListingId: number | null;
  tailoredResumeId: string | null;
}

/**
 * Floating suggestion dock that sits in the top-right of the preview Panel.
 *
 * Renders SuggestionProgressPanel next to the resume canvas so users can
 * review AI bullet suggestions without leaving the main editor view.
 *
 * Gating mirrors the original AIChatTab logic:
 *   - Tailor mode: isTailorMode && tailoredResumeId
 *   - Library mode: !isTailorMode && hasJobContext && atsKeywordResult
 *
 * Hidden during PDF export via the data-print-hidden / data-no-export
 * attributes, matching the floating BulletSuggestionDropdown pattern.
 */
export function EditorSuggestionDock({
  jobId,
  jobListingId,
  tailoredResumeId,
}: EditorSuggestionDockProps) {
  const [collapsed, setCollapsed] = useState(false);

  const tailorContext = useTailorEditorContextSafe();
  const isTailorMode = tailorContext?.aiAssistantEnabled ?? false;
  const hasJobContext = jobId !== null || jobListingId !== null;
  const atsKeywordResult = useATSProgressStore((s) => s.keywordAnalysisResult);

  const shouldRender =
    (isTailorMode && Boolean(tailoredResumeId)) ||
    (!isTailorMode && hasJobContext && Boolean(atsKeywordResult));

  if (!shouldRender) return null;

  return (
    <div
      className="absolute top-4 right-4 z-20 w-80 bg-card border border-border rounded-lg shadow-lg overflow-hidden"
      data-print-hidden="true"
      data-no-export="true"
    >
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-foreground hover:bg-accent/40 transition-colors"
        aria-expanded={!collapsed}
      >
        <span>Suggestions</span>
        {collapsed ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5" />
        )}
      </button>
      {!collapsed && (
        <div className="px-3 pb-3 border-t border-border pt-3">
          <SuggestionProgressPanel />
        </div>
      )}
    </div>
  );
}
