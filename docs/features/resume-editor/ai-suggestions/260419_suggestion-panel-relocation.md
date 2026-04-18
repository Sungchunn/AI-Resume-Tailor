# Relocate SuggestionProgressPanel into the Library Editor canvas

**Status:** Active
**Created:** 2026-04-19

## Context

Today, `SuggestionProgressPanel` (the "Analyze Bullets" progress + navigation UI) is rendered **inside `AIChatTab.tsx`**, which is one of four tabs in the right-hand `ControlPanel` sidebar of the Library Editor (`EditorLayout.tsx`). Users only see it after clicking into the AI tab.

The user wants to:

1. **Delete `AIChatTab.tsx` entirely** from the sidebar navigation. The chat-based AI assistant is being retired.
2. **Relocate `SuggestionProgressPanel`** so it sits inside the main editor area, floating near / docked above the document canvas — always visible when relevant, without needing a tab.
3. Keep `InlineSuggestionQueueProvider` untouched (it already wraps `EditorLayoutContent` at `EditorLayout.tsx:54–64`).
4. Preserve `handleJumpTo` scroll behavior — the scroll logic uses `document.querySelector('[data-bullet-element-id="..."]')` and `scrollIntoView`, both of which are DOM-global and unaffected by where the panel is mounted.

**Target editor:** Only the **Library / Block-Based Editor** (`/library/resumes/[id]/edit`). The Workshop Editor at `/workshop/[id]` uses a different architecture (`useWorkshop` / `TailoredContent`, no `data-bullet-element-id` hooks) and is out of scope.

**Prior-attempts note (per CLAUDE.md rule 18):** The AI-suggestions feature has 6 prior attempts documented in `/docs/features/resume-editor/ai-suggestions/AI_SUGGESTION_ATTEMPTS.md`. This plan is a UI relocation, not a new attempt at suggestion mechanics — queue orchestration, wrapped actions, and typewriter dropdown all remain unchanged.

## Scope

**In scope:**
- Delete `AIChatTab.tsx` and clean up barrel exports.
- Narrow `ControlPanel` to 3 tabs: ATS / Format / Sections.
- Mount `SuggestionProgressPanel` as a floating card inside the left Panel of `EditorLayout.tsx`, gated by the existing context conditions.
- Dead-code audit for items only imported by `AIChatTab` (per CLAUDE.md rule 19).

**Out of scope:**
- Workshop editor integration.
- Changes to `InlineSuggestionQueueProvider`, `inlineSuggestionQueueStore`, `useInlineSuggestionQueue`, `SuggestionProgressPanel` internals, or the floating `BulletSuggestionDropdown` portal.
- Deprecated-field cleanup in `bulletSuggestionsStore` (`aiReviewActive`, etc.). Pre-existing tech debt, flagged in `AI_SUGGESTION_ATTEMPTS.md`, separate work.

## Design Decision: Placement

**Recommendation — Floating card pinned to the top-right of the preview Panel, above the scroll container:**

```text
┌──────────────────────────────────────────┬──────────────┐
│ Panel (left, 73%)                        │ Panel (right)│
│ ┌─────────────────────────────────────┐ ┌──┤ ControlPanel│
│ │ previewScrollContainerRef (scrolls) │ │🌟│  - ATS      │
│ │                                     │ └──┤  - Format   │
│ │   [ A4 Page — PaginatedResumePrev ] │    │  - Sections │
│ │                                     │    │             │
│ │   [ A4 Page — page 2 ]              │    │             │
│ │                                     │    │             │
│ └─────────────────────────────────────┘    │             │
└──────────────────────────────────────────┴──────────────┘
        🌟 = SuggestionProgressPanel (floating, top-right of left Panel)
```

**Why this placement:**
- Satisfies "floating beautifully near the document canvas" *and* "sits alongside the main text canvas without overlapping it" — the Panel has centered canvas with dead space to the right at typical widths.
- Does not reduce vertical canvas space (unlike a docked top bar).
- Pinned outside the scroll container → doesn't scroll with pages.
- `handleJumpTo` is unaffected: `document.querySelector` finds the bullet element regardless of where the panel lives in the tree; `scrollIntoView` scrolls the nearest scrollable ancestor of the bullet, which remains `previewScrollContainerRef`.

## Files to Modify

| File | Change |
| ---- | ------ |
| `frontend/src/components/library/editor/ControlPanel.tsx` | Remove AI tab button, AI tab content, `AIChatTab` import, `MessageSquare` icon, `tailoredResumeId` prop (only AIChatTab consumed it). Narrow `ControlPanelTab` union to `"ats" \| "formatting" \| "sections"`. |
| `frontend/src/components/library/editor/EditorLayout.tsx` | Stop passing `tailoredResumeId` to `ControlPanel` (line 340). Wrap the left Panel's scroll container in a `relative` parent and mount the new `EditorSuggestionDock` inside it at top-right. |
| `frontend/src/components/library/editor/EditorSuggestionDock.tsx` **(new file)** | Thin wrapper: reads job context + `atsKeywordResult` + tailor-mode flag, renders `SuggestionProgressPanel` inside a floating card (`absolute top-4 right-4 z-20 w-80 bg-card border rounded-lg shadow-lg p-3`) with an optional collapse button. Renders null when gate conditions aren't met. |
| `frontend/src/components/library/editor/tabs/index.ts` | Drop the `AIChatTab` re-export. |
| `frontend/src/components/library/editor/index.ts` | Drop `AIChatTab` if re-exported at the editor-level barrel. |
| `frontend/src/components/library/editor/tabs/AIChatTab.tsx` | **Delete file.** |
| `frontend/src/components/tailor/editor/SkillSuggestionsPanel.tsx` | **Decision required:** orphaned after AIChatTab deletion (only importer). Recommend deleting per CLAUDE.md rule 19 unless user wants to preserve for future tailor work. Default: **delete**, noted in retrospective. |

## Critical Invariants (must not change)

- **Provider stack:** `InlineSuggestionQueueProvider` continues to wrap `EditorLayoutContent` (`EditorLayout.tsx:54–64`). Both the floating `BulletSuggestionDropdown` and the relocated `SuggestionProgressPanel` share the same wrapped `acceptCurrent` / `acceptAll`.
- **Scroll logic:** `SuggestionProgressPanel.handleJumpTo` (lines 52–67 of the panel) is untouched. It uses `document.querySelector('[data-bullet-element-id="..."]')` + `el.scrollIntoView({ behavior: "smooth", block: "center" })`. This works from any DOM location because `scrollIntoView` walks up to the nearest scrollable ancestor (still `previewScrollContainerRef`).
- **Gating logic:** Preserve the exact conditions from `AIChatTab.tsx:305–317`:
  - Tailor mode (effectively dead after Tailor Editor removal but kept for safety): `isTailorMode && tailoredResumeId`
  - Library mode: `!isTailorMode && hasJobContext && atsKeywordResult`
  - `isTailorMode` comes from `useTailorEditorContextSafe()?.aiAssistantEnabled ?? false`.
  - `atsKeywordResult` from `useATSProgressStore((s) => s.keywordAnalysisResult)`.
- **Keyboard shortcuts:** `useInlineSuggestionKeyboard()` stays mounted in `EditorLayout` (line 111). Unchanged.
- **Export flow:** The `onExport` handler in `EditorLayout.tsx:274–278` already calls `useInlineSuggestionQueueStore.getState().dismissActive()` — unaffected.

## Implementation Sketch

### `EditorSuggestionDock.tsx` (new)

```tsx
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
    (isTailorMode && tailoredResumeId) ||
    (!isTailorMode && hasJobContext && atsKeywordResult);

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
      >
        <span>Suggestions</span>
        {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
      </button>
      {!collapsed && (
        <div className="px-3 pb-3 border-t border-border">
          <SuggestionProgressPanel />
        </div>
      )}
    </div>
  );
}
```

### `EditorLayout.tsx` diff (conceptual)

```diff
  <Panel defaultSize={isPreviewFullscreen ? "100%" : "73%"} minSize="40%">
+   <div className="relative h-full">
      <div ref={previewScrollContainerRef} className="h-full overflow-auto bg-muted p-4 flex flex-col items-center">
        ...
        <PaginatedResumePreview ... />
      </div>
+     {!isPreviewFullscreen && (
+       <EditorSuggestionDock
+         jobId={jobId}
+         jobListingId={jobListingId}
+         tailoredResumeId={tailoredResumeId}
+       />
+     )}
+   </div>
  </Panel>
  ...
  <Panel defaultSize="27%" minSize="20%" maxSize="40%">
-   <ControlPanel resumeId={resumeId} jobId={jobId} jobListingId={jobListingId} tailoredResumeId={tailoredResumeId} />
+   <ControlPanel resumeId={resumeId} jobId={jobId} jobListingId={jobListingId} />
  </Panel>
```

### `ControlPanel.tsx` diff (conceptual)

```diff
- import { MessageSquare, Target, Palette, Layers } from "lucide-react";
- import { AIChatTab, ATSEvaluationTab, FormattingTab, SectionDraggerTab } from "./tabs";
+ import { Target, Palette, Layers } from "lucide-react";
+ import { ATSEvaluationTab, FormattingTab, SectionDraggerTab } from "./tabs";

- type ControlPanelTab = "ai" | "ats" | "formatting" | "sections";
+ type ControlPanelTab = "ats" | "formatting" | "sections";

  interface ControlPanelProps {
    resumeId: string;
    jobId: string | null;
    jobListingId: number | null;
-   tailoredResumeId?: string | null;
  }

- export function ControlPanel({ resumeId, jobId, jobListingId, tailoredResumeId }: ControlPanelProps) {
+ export function ControlPanel({ resumeId, jobId, jobListingId }: ControlPanelProps) {
    ...
    return (
      <div className="h-full flex flex-col bg-card border-l border-border">
        <div className="flex items-center border-b border-border px-2">
-         <TabButton active={activeTab === "ai"} onClick={() => setActiveTab("ai")} icon={<MessageSquare ... />} label="AI" />
          <TabButton ... ATS />
          <TabButton ... Format />
          <TabButton ... Sections />
        </div>
        <div className="flex-1 overflow-hidden">
-         <div className={`h-full ${activeTab === "ai" ? "" : "hidden"}`}>
-           <AIChatTab resumeId={resumeId} jobId={jobId} jobListingId={jobListingId} tailoredResumeId={tailoredResumeId} />
-         </div>
          <div className={`h-full ${activeTab === "ats" ? "" : "hidden"}`}>...</div>
          <div className={`h-full ${activeTab === "formatting" ? "" : "hidden"}`}>...</div>
          <div className={`h-full ${activeTab === "sections" ? "" : "hidden"}`}>...</div>
        </div>
      </div>
    );
  }
```

## Dead-Code Audit (per CLAUDE.md rule 19)

After the changes, grep and remove anything orphaned:

- `AIChatTab.tsx` — **deleted directly**.
- `SkillSuggestionsPanel.tsx` (`frontend/src/components/tailor/editor/SkillSuggestionsPanel.tsx`) — its only importer was `AIChatTab.tsx`. **Recommend delete.** Flag in retrospective. Confirm no other importer with `grep -r SkillSuggestionsPanel frontend/`.
- `QUICK_ACTIONS` array, `ChatMessageBubble` component, `DisplayMessage` type — all internal to `AIChatTab.tsx`, gone with it.
- `useTailorEditorContextSafe`, `useJobListing`, `aiApi.chat`, `BLOCK_TYPE_INFO` — general utilities used by other call sites. **Keep.**

## Verification Plan

End-to-end verification after implementation:

1. **Build passes:** `cd frontend && bun run build` (CLAUDE.md rule 19 explicitly requires this).
2. **Dev server manual check:**
   - `bun dev` → open `/library/resumes/<resume-id>/edit` (no job context). Verify: sidebar shows 3 tabs (ATS / Format / Sections), no AI tab. Floating dock does NOT appear (no job context).
   - Open `/library/resumes/<id>/edit?jobId=<uuid>` or `?jobListingId=<int>`. Run ATS analysis from ATS tab. Once `atsKeywordResult` populates, floating dock appears top-right of preview.
   - Click "Analyze Bullets" → suggestions arrive → verify `BulletSuggestionDropdown` typewriter still works (provider wiring intact).
   - Click a suggestion in the list → page scrolls to that bullet (`handleJumpTo` works).
   - Accept/Dismiss via dropdown → progress bar + counts update in floating dock. Score delta renders when rescoring completes.
   - Collapse / expand the dock.
   - Toggle fullscreen preview → verify dock hides (gated on `!isPreviewFullscreen`).
   - Trigger export → verify `data-print-hidden` / `data-no-export` keeps dock out of the PDF.
3. **Keyboard shortcuts:** With active review, Tab / Esc / Arrow Up / Arrow Down still work (handler is in `EditorLayout`, untouched).
4. **Type check:** `bun tsc --noEmit` — no orphan type references to `AIChatTab` or `tailoredResumeId` on `ControlPanelProps`.

## Post-Implementation

- Move this plan file from `.claude/plans/` to `/docs/features/resume-editor/ai-suggestions/260419_suggestion-panel-relocation.md` as step 1 of execution (per user's feedback memory).
- Append a brief entry to `/docs/features/resume-editor/ai-suggestions/AI_SUGGESTION_ATTEMPTS.md` describing the relocation and the AIChatTab retirement, so the ledger stays current.
- Update `/docs/architecture/editor-guide.md` if the Library Editor's tab inventory is documented there.
