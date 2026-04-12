# Inline Bullet Suggestion System — Implementation Plan

## Context

After ATS analysis completes, the editor currently shows bullet rewrite suggestions in a side-panel card view (`BulletSuggestionsPanel` in the AI tab). This plan replaces that with a floating dropdown card that appears directly below the target bullet in the preview, with typewriter animation. The goal: bring suggestions to where the content lives, eliminating context-switching between preview and panel.

---

## Architecture Summary

**New artifacts:** 8 files (1 store, 3 hooks, 3 components, 1 utility)
**Modified files:** ~6 existing files
**Approach:** Portal-based dropdown outside page DOM (export-safe), new Zustand store for queue navigation, reuse existing `useBulletAnalysis` for API calls and accept logic.

---

## Phase 1: Foundation (no UI changes, can be built in parallel)

### 1A. Create `inlineSuggestionQueueStore`

**Create:** `frontend/src/lib/stores/inlineSuggestionQueueStore.ts`

New Zustand store (plain `create()`, no `persist` — suggestions are ephemeral). Manages ordered queue for inline review, replacing the `aiReviewActive/aiReviewIndex/aiReviewComplete` fields on `bulletSuggestionsStore`.

Store shape per the spec: `suggestions[]`, `currentIndex`, `boundResumeId`, `preAnalysisScore`, `isActive`, `currentSuggestion` (computed). Actions: `populateQueue`, `acceptCurrent`, `dismissCurrent`, `advanceNext/Previous`, `jumpTo`, `acceptAll`, `dismissAll`, `dismissActive`, `reset`.

Key behavior: `advanceNext` skips already-accepted/dismissed suggestions (finds next `pending` item). `acceptCurrent`/`dismissCurrent` also call the corresponding `bulletSuggestionsStore` action by ID to keep the authoritative store in sync.

Export selectors: `useCurrentQueueSuggestion()`, `useQueueProgress()`, `useIsInlineReviewActive()`.

### 1B. Create bullet ID mapping utility

**Create:** `frontend/src/lib/resume/bulletIdMapping.ts`

Bridges the mismatch between analysis IDs (`"blockId:entry-N:bullet-M"` — positional, from `collectBulletsFromBlocks`) and DOM element IDs (`"blockId:actualEntryId:bullets:bulletIndex"` — uses nanoid entry IDs, from `createIndexedElementId`).

Functions:

- `analysisBulletIdToElementId(bulletId, blocks)` → DOM element ID or null
- `elementIdToAnalysisBulletId(elementId, blocks)` → analysis bullet ID or null

Logic: parse `entry-N` to get index → find `block.content[entryIndex]` → read actual `entry.id` → call `createIndexedElementId(blockId, entry.id, "bullets", bulletIndex)`.

Reuses: `createIndexedElementId` from `lib/resume/elementPath.ts`.

### 1C. Create `useTypewriter` hook

**Create:** `frontend/src/hooks/useTypewriter.ts`

Purely presentational animation. Input: full string. Output: `{ displayText, isDone, fastForward(), reset() }`.

Uses `requestAnimationFrame` with timestamp tracking at ~35 chars/sec. On `text` change, auto-resets. On unmount, cancels animation frame. `fastForward` immediately sets `displayText = text`.

---

## Phase 2: Preview Infrastructure

### 2A. Add `data-bullet-element-id` attributes to bullet `<li>` elements

Currently the `<li>` elements wrapping bullets have no data attributes — only the `InlineRichText` inside knows the element ID. Add `data-bullet-element-id` to each `<li>`:

```tsx
<li
  key={bullet.id}
  data-bullet-element-id={createIndexedElementId(blockId, entry.id, "bullets", bulletIndex)}
>
```

This gives the dropdown a reliable DOM query: `containerRef.querySelector('[data-bullet-element-id="..."]')`.

**Complete list of files to modify** (all 5 block types that render `<li>` bullets):

| File | Field | Element ID pattern |
| ----- | ----- | ----- |
| `ExperiencePreview.tsx` | `entry.bullets` | `createIndexedElementId(blockId, entry.id, "bullets", bulletIndex)` |
| `ProjectsPreview.tsx` | `entry.bullets` | `createIndexedElementId(blockId, entry.id, "bullets", bulletIndex)` |
| `LeadershipPreview.tsx` | `entry.bullets` | `createIndexedElementId(blockId, entry.id, "bullets", bulletIndex)` |
| `VolunteerPreview.tsx` | `entry.bullets` | `createIndexedElementId(blockId, entry.id, "bullets", bulletIndex)` |
| `EducationPreview.tsx` | `entry.relevantCourses` | `createIndexedElementId(blockId, entry.id, "relevantCourses", courseIndex)` |

Each file has both a read-only and editable rendering path — add `data-bullet-element-id` to both.

All files are in `frontend/src/components/library/preview/blocks/`.

### 2B. Create `SuggestionPortalLayer`

**Create:** `frontend/src/components/library/preview/SuggestionPortalLayer.tsx`

A container `<div>` rendered inside `containerRef` but outside `pagesWrapperRef`. Portal target for the floating dropdown.

```tsx
<div
  ref={ref}
  data-print-hidden="true"
  data-no-export="true"
  style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 50 }}
/>
```

### 2C. Integrate portal layer into `PaginatedResumePreview`

**Modify:** `frontend/src/components/library/preview/PaginatedResumePreview.tsx`

1. Add `portalLayerRef = useRef<HTMLDivElement>(null)`
2. Add `position: relative` to `containerRef`'s style (line 219)
3. Render `<SuggestionPortalLayer ref={portalLayerRef} />` after the `pages-wrapper` div (line 285), still inside `containerRef`
4. Expose in imperative handle: `getPortalTarget: () => portalLayerRef.current`

DOM result:

```text
containerRef (position: relative)
├── MeasurementContainer
├── pages-wrapper (scaled) → PreviewPage[] (captured by export)
└── SuggestionPortalLayer (absolute, NOT captured by export)
    └── BulletSuggestionDropdown (via portal)
```

---

## Phase 3: Dropdown Card

### 3A. Create `BulletSuggestionDropdown`

**Create:** `frontend/src/components/library/preview/BulletSuggestionDropdown.tsx`

Props: `portalTarget`, `containerRef`, `blocks`.

**Positioning:**

1. Read current suggestion from `inlineSuggestionQueueStore`
2. Convert `suggestion.bulletElementPath` to DOM element ID via `analysisBulletIdToElementId()`
3. Query: `containerRef.querySelector('[data-bullet-element-id="..."]')`
4. Compute position: `bulletRect.bottom - containerRect.top` for top, `bulletRect.left - containerRect.left` for left
5. Width: match the bullet's parent block width

**Scale handling note:** `getBoundingClientRect()` returns screen-space coordinates that account for CSS transforms, so the basic `bulletRect - containerRect` math works when the portal layer and containerRef share the same coordinate space. However, the pages inside containerRef are scaled via `transform: scale(${scale})` on `pagesWrapperRef`. Since `SuggestionPortalLayer` is a sibling of `pagesWrapperRef` (not inside it), it lives in containerRef's unscaled coordinate space — and `getBoundingClientRect()` on the bullet returns already-scaled screen coords, while `containerRect` is also in screen coords. The subtraction cancels out correctly. **Must test at various scale levels** (narrow viewport forcing scale < 1, and full-width scale = 1) to confirm alignment. If containerRef itself ever gets a transform in the future, the math would break — add a comment noting this assumption.

**Content:** Impact badge, suggested text with typewriter animation (via `useTypewriter`), reason line (fades in after typing completes), keyboard hint bar (Tab/Esc/arrows).

**Highlight:** When active, call `setActiveElement(mappedDomElementId)` via `BlockEditorContext` to highlight the target bullet. Clear on dismiss/navigate.

**Scroll handling:** Listen for scroll events on the preview scroll container. Do NOT discover this via `containerRef.closest('.overflow-auto')` — that's fragile (breaks if someone changes the Tailwind class). Instead, pass the scroll container ref explicitly: add a `scrollContainerRef` prop to `PaginatedResumePreview`, set from `EditorLayout` using a ref on the `<div className="h-full overflow-auto ...">` wrapper (line 261). Alternatively, add a stable `data-preview-scroll-container` attribute to that div for discovery. On scroll: hide dropdown. After 200ms idle: reposition and show. Use `requestAnimationFrame` for repositioning.

**Entry/exit animations:** Slide down + fade in on show. Collapse up + fade out on dismiss.

**Export attributes:** `data-print-hidden="true"` and `data-no-export="true"`.

### 3B. Render dropdown in `PaginatedResumePreview`

**Modify:** `frontend/src/components/library/preview/PaginatedResumePreview.tsx`

Conditionally render `<BulletSuggestionDropdown>` when `useIsInlineReviewActive()` returns true. Pass `portalLayerRef.current`, `containerRef.current`, and `blocks`.

---

## Phase 4: Keyboard & Orchestration

### 4A. Create `useInlineSuggestionKeyboard` hook

**Create:** `frontend/src/hooks/useInlineSuggestionKeyboard.ts`

Global keyboard handler (document-level, capture phase). Active only when `isActive` from queue store is true.

Bindings:

- **Tab:** If typewriter running → `requestFastForward()`. If done → `acceptCurrent()`.
- **Escape:** `dismissCurrent()` (skip and advance)
- **Arrow Down/Up:** `advanceNext()`/`advancePrevious()`

**Bridging Tab → typewriter fastForward:** The keyboard hook is at document level, but `useTypewriter` lives inside `BulletSuggestionDropdown`. These are different component scopes. Bridge via the queue store: add a `requestFastForward` boolean flag and `setRequestFastForward(value)` action to `inlineSuggestionQueueStore`. The keyboard hook sets `requestFastForward: true`. The dropdown watches this flag via `useEffect` — when it flips to `true`, calls `typewriter.fastForward()` and resets the flag to `false`. This avoids callback refs or imperative handles between unrelated components.

**Mutual exclusion with inline editing:** Check `InlineEditContext.focusedElementId`. If non-null, yield all keys except Escape. Also check `event.target.isContentEditable` as fallback.

**Conflict with existing keyboard handlers:** `useBulletAnalysis` (lines 490-518) registers a capture-phase handler for AI review (Enter/Escape). Condition that handler on `!useIsInlineReviewActive()` to avoid double-handling.

**Integration:** Call this hook in `EditorLayout.tsx`.

### 4B. Create `useInlineSuggestionQueue` hook

**Create:** `frontend/src/hooks/useInlineSuggestionQueue.ts`

Orchestration hook. For v1, does NOT auto-trigger analysis — provides an `analyze()` function that delegates to `useBulletAnalysis.analyze()`. The user clicks "Analyze Bullets" in the progress panel to start. When `bulletSuggestionsStore.suggestions` populates, sorts by impact and writes to `inlineSuggestionQueueStore.populateQueue()`.

**Future: auto-trigger.** The spec envisions auto-triggering when `atsProgressStore.keywordAnalysisResult` becomes non-null. Leave a `// TODO: auto-trigger` comment at the top of the hook with the planned subscription pattern (`useEffect` watching `keywordAnalysisResult`), so a follow-up can flip it on without restructuring.

Also wraps `acceptCurrent` to call `useBulletAnalysis.acceptSuggestion(id)` for the actual block update + save, then advance the queue.

Mode handling: passes through to `useBulletAnalysis` which already handles tailor vs library mode.

---

## Phase 5: Progress Panel

### 5A. Create `SuggestionProgressPanel`

**Create:** `frontend/src/components/library/editor/tabs/SuggestionProgressPanel.tsx`

Replaces `BulletSuggestionsPanel` in the AI tab. Shows:

- "Analyze Bullets" button (same trigger as before)
- Progress bar: "4 of 12 reviewed"
- Score delta: "ATS: 62 → 78 (+16)"
- Compact list of suggestions with status icons (checkmark/x/pending). Click to `jumpTo(index)` + scroll preview to that bullet.
- Bulk actions: Accept All Remaining, Dismiss All Remaining
- Restart button (re-queue dismissed suggestions)

**Click-to-jump scroll behavior:** When the user clicks a suggestion in the list, `jumpTo(index)` updates the queue store, then the component queries the target bullet DOM element via `data-bullet-element-id` and calls `element.scrollIntoView({ behavior: 'smooth', block: 'center' })`. The `BulletSuggestionDropdown` must wait one animation frame (`requestAnimationFrame`) after scroll completes before measuring position, since `scrollIntoView` is asynchronous and `getBoundingClientRect()` would return stale values mid-scroll. Use a `setTimeout` of ~400ms (smooth scroll duration) or listen for `scrollend` event as a more precise alternative.

Reads from `inlineSuggestionQueueStore` for progress. Uses `useInlineSuggestionQueue` for analyze action.

### 5B. Replace `BulletSuggestionsPanel` in `AIChatTab`

**Modify:** `frontend/src/components/library/editor/tabs/AIChatTab.tsx`

Replace the two `<BulletSuggestionsPanel>` renders (lines 304-323) with `<SuggestionProgressPanel>`, passing the same props (resumeId, jobId, jobListingId, tailoredResumeId, atsData, atsReady).

---

## Phase 6: Export Safety & Cleanup

### 6A. Update export pipeline

**Modify:** `frontend/src/lib/pdf-export.ts`

Add `data-no-export` to the filter function (belt-and-suspenders — the portal layer is already outside page DOM):

```ts
filter: (node) => {
  if (node instanceof HTMLElement) {
    return node.dataset.printHidden !== "true" && node.dataset.noExport !== "true";
  }
  return true;
}
```

**Modify:** `frontend/src/components/library/editor/EditorLayout.tsx`

In the export handler (line 249-253), also call `inlineSuggestionQueueStore.getState().dismissActive()` alongside `setActiveBlock(null)`.

### 6B. Dead code audit

After all above is working:

| File | Action | Reason |
| ----- | ----- | ----- |
| `BulletSuggestionsPanel.tsx` | Remove | Replaced by `SuggestionProgressPanel` |
| `BulletSuggestionCard.tsx` | Remove if unused | Check imports — may be needed by progress panel list items |
| `AiReviewDiffOverlay.tsx` | Check usage in `BulletList.tsx` | Condition on `!useIsInlineReviewActive()` or remove |
| `bulletSuggestionsStore` AI review fields | Deprecate | `aiReviewActive`, `aiReviewIndex`, `aiReviewComplete`, `advanceNext` — replaced by queue store |
| `useInlineSuggestion.ts` | Keep | Workshop-only (confirmed: only imported by `workshop/panels/sections/ExperienceEditor.tsx` and `workshop/panels/sections/InlineSuggestion.tsx`). Not used in the library editor. |

Verify each with `grep` for imports before deleting.

---

## Critical Files Summary

| File | Action |
| ----- | ----- |
| `src/lib/stores/inlineSuggestionQueueStore.ts` | Create |
| `src/lib/resume/bulletIdMapping.ts` | Create |
| `src/hooks/useTypewriter.ts` | Create |
| `src/hooks/useInlineSuggestionQueue.ts` | Create |
| `src/hooks/useInlineSuggestionKeyboard.ts` | Create |
| `src/components/library/preview/SuggestionPortalLayer.tsx` | Create |
| `src/components/library/preview/BulletSuggestionDropdown.tsx` | Create |
| `src/components/library/editor/tabs/SuggestionProgressPanel.tsx` | Create |
| `src/components/library/preview/PaginatedResumePreview.tsx` | Modify (portal layer, scroll container ref) |
| `src/components/library/preview/blocks/ExperiencePreview.tsx` | Modify (data-bullet-element-id) |
| `src/components/library/preview/blocks/ProjectsPreview.tsx` | Modify (data-bullet-element-id) |
| `src/components/library/preview/blocks/LeadershipPreview.tsx` | Modify (data-bullet-element-id) |
| `src/components/library/preview/blocks/VolunteerPreview.tsx` | Modify (data-bullet-element-id) |
| `src/components/library/preview/blocks/EducationPreview.tsx` | Modify (data-bullet-element-id for relevantCourses) |
| `src/components/library/editor/tabs/AIChatTab.tsx` | Modify |
| `src/components/library/editor/EditorLayout.tsx` | Modify (keyboard hook, scroll container ref, export handler) |
| `src/lib/pdf-export.ts` | Modify |
| `src/hooks/useBulletAnalysis.ts` | Modify (condition old keyboard handler) |

**Reused existing code:**

- `useBulletAnalysis` hook — API calls, accept/reject logic, block updates (`src/hooks/useBulletAnalysis.ts`)
- `createIndexedElementId` / `encodeElementPath` — element path encoding (`src/lib/resume/elementPath.ts`)
- `bulletSuggestionsStore` — authoritative suggestion data, `acceptSuggestion`/`rejectSuggestion` actions (`src/lib/stores/bulletSuggestionsStore.ts`)
- `BlockEditorContext.setActiveElement` — bullet highlighting in preview
- `InlineEditContext.focusedElementId` — mutual exclusion with inline editing

---

## Verification

1. **Typewriter animation:** Open editor with a job linked, run ATS analysis, verify suggestions appear below bullets with character-by-character reveal
2. **Two-tap accept:** Press Tab during animation → text fully reveals. Press Tab again → suggestion applied, bullet text updated, next suggestion shown
3. **Escape dismiss:** Press Esc → suggestion skipped, advances to next
4. **Arrow navigation:** Up/Down arrows navigate between suggestions, preview scrolls to target bullet
5. **Inline edit mutual exclusion:** Click a bullet to edit inline → dropdown dismisses, keyboard shortcuts yield. Blur → dropdown can reappear.
6. **Export safety:** Export to PDF → no dropdown or highlight artifacts in the PDF
7. **Progress panel:** AI tab shows progress bar, score delta, click-to-jump works
8. **Bulk actions:** "Accept All" applies all remaining suggestions, "Dismiss All" clears queue
9. **Scroll behavior:** Scroll the preview → dropdown hides. Stop scrolling → dropdown repositions
10. **Both modes:** Test in tailor mode (with `tailoredResumeId`) and library mode (with `jobId`/`jobListingId`)
