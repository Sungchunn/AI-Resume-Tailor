# Move AI Suggestion Review Inline on Preview

## Context

The inline bullet-suggestion system (attempt 5, `docs/features/resume-editor/ai-suggestions/260412_inline-bullet-suggestions/`) shipped the dropdown/portal/queue/keyboard plumbing but never became the primary review surface. Today:

- `SuggestionProgressPanel` in the sidebar AI tab (`AIChatTab.tsx:307,315`) hosts the actions that change the resume: `queue.acceptAll`, `dismissAll`, and the per-item nav list.
- `BulletSuggestionDropdown` in the preview ships with typewriter + keyboard hints only — no visible Accept/Dismiss buttons, no original-text display.
- The keyboard Tab→Accept path (`useInlineSuggestionKeyboard.ts:32`) calls the store-level `acceptCurrent`, which only marks the queue item and tags the authoritative store; the actual block text rewrite lives in `useInlineSuggestionQueue.acceptCurrent` (`useInlineSuggestionQueue.ts:55–62`). So the current inline keyboard accept is a latent bug — it advances the queue without applying the improved text to the resume.

Goal: make the preview dropdown the sole review surface. Original text, improved text, and Accept/Dismiss actions all render in the portal overlay positioned below the target bullet. The sidebar panel stays as a progress/navigation aid only (progress bar, ATS score delta, click-to-jump nav list, analyze/restart triggers).

---

## Prior attempts

See `AI_SUGGESTION_ATTEMPTS.md` for the full history. Relevant:

- **Attempt 5 (`260412_inline-bullet-suggestions/`)** built all the inline plumbing — portal, queue, keyboard, dropdown, progress panel. It intended keyboard-only interaction in the dropdown (no buttons) and kept bulk Accept All / Dismiss All in the sidebar. The UX never migrated; users still review in the sidebar.
- **This plan (attempt 6)** finishes the migration: visible buttons in the dropdown, wrapped-action wiring so keyboard Tab actually writes to the block, and strips the review surface from the sidebar.

---

## Current state → target state

| Surface | Renders today | Renders after |
| ----- | ----- | ----- |
| `BulletSuggestionDropdown` (preview, portal) | Impact badge, improved text w/ typewriter, reason, keyboard hints | + Original text, + visible Accept/Dismiss buttons, wired to **wrapped** actions |
| `SuggestionProgressPanel` (sidebar AI tab) | Analyze btn, progress bar, score delta, nav list, **Accept All**, **Dismiss All**, Re-analyze, Restart | Analyze btn, progress bar, score delta, nav list (jumpTo), Re-analyze, Restart |
| `useInlineSuggestionKeyboard` (document-level) | Tab→`store.acceptCurrent` (**broken: no block update**), Esc, arrows | Tab→**wrapped** `acceptCurrent` (writes to block), Esc, arrows |

---

## Implementation

### 1. Shared wrapped-action provider

**New file:** `frontend/src/components/library/editor/InlineSuggestionQueueProvider.tsx`

Rationale: `useInlineSuggestionQueue` wraps `store.acceptCurrent` / `acceptAll` with calls to `bulletAnalysis.acceptSuggestion(id)` that write the improved text back to the block via `useBulletAnalysis`. This wrapped version needs `tailoredResumeId` / `resumeId` / `jobId` / `jobListingId` / `atsData` — context the document-level keyboard hook and preview-side dropdown do not have. Calling the hook inside two components (panel + dropdown) would work mechanically (the populate effect is idempotent via `lastPopulatedAtRef`) but duplicates side effects and splits source-of-truth. Cleaner: call the hook once at the editor root and expose the wrapped actions + analyze trigger via context.

The provider:

- Calls `useInlineSuggestionQueue(options)` once with the analysis context (same args today passed to `SuggestionProgressPanel` at `AIChatTab.tsx:307,315`).
- Exposes context value: `{ analyze, isAnalyzing, error, acceptCurrent, acceptAll, preAnalysisScore, postScore, isRescoring }`.
- Consumer hook: `useInlineSuggestionQueueContext()` with a helpful invariant error if called outside the provider.

**Mount site:** `EditorLayout.tsx` — wrap the subtree that contains both the preview and the AI tab panel. The provider needs the resume/job/ATS context, which `EditorLayout` already has (it renders both the preview and `ControlPanel`). Passing props from `EditorLayout` down to the provider avoids the current pattern of `AIChatTab` forwarding them to `SuggestionProgressPanel`.

### 2. Enhance `BulletSuggestionDropdown`

**Modify:** `frontend/src/components/library/preview/BulletSuggestionDropdown.tsx`

Additions, keeping the existing portal/positioning/scroll/export machinery untouched:

- **Original text block.** New section between the header and the suggested text. Display `suggestion.original` with a subtle label ("Current") and muted color to distinguish it from the improved text. Full text (no truncation) — the dropdown width already adapts via `Math.max(position.width, 320)` at `BulletSuggestionDropdown.tsx:166`.
- **Accept/Dismiss buttons.** New action row between the reason and the keyboard-hint footer. `Check` icon + "Accept" (primary), `X` icon + "Dismiss" (secondary). Buttons read wrapped actions from `useInlineSuggestionQueueContext()` so they write the block text, not just mark queue state.
- **Keyboard hints row stays** but reflects that buttons also exist ("Tab or click Accept…" is overkill; leave hint as-is, just add the buttons).

Touch nothing in: portal mount, `getBoundingClientRect`-based positioning, scroll-hide/reposition logic, `data-print-hidden`/`data-no-export` attributes, typewriter bridge via `requestFastForward` / `typewriterDone`.

### 3. Fix the keyboard Tab→Accept path

**Modify:** `frontend/src/hooks/useInlineSuggestionKeyboard.ts`

Replace the direct `store.acceptCurrent()` call at line 32 with the wrapped action read from `useInlineSuggestionQueueContext()`. Esc→`store.dismissCurrent()` stays as-is (dismiss does not need to touch block content, only status). Arrows stay as-is.

Guarding: keep the existing `inlineEditContext?.focusedElementId` check (`useInlineSuggestionKeyboard.ts:20`) and the `target.isContentEditable` check (`:23`).

### 4. Strip review actions out of the sidebar panel

**Modify:** `frontend/src/components/library/editor/tabs/SuggestionProgressPanel.tsx`

Remove:

- The bulk-actions row: `Accept All` (`:222–230`) and `Dismiss All` (`:231–238`) — removed entirely. Review is strictly one-at-a-time via the dropdown.
- The direct `useInlineSuggestionQueue` call (`:53`) — replace with `useInlineSuggestionQueueContext()` so analyze/progress/score come from the shared provider.
- Unused imports (`Check` / `X` icons that were only used by the bulk buttons, and the `dismissAll` store selector at `:68` if no longer referenced).

Keep:

- Header, analyze button (when no items / after all reviewed), progress bar, score delta, nav list with status icons + truncated original text + jumpTo, re-analyze/restart buttons.

### 5. Parent-call cleanup

**Modify:** `frontend/src/components/library/editor/tabs/AIChatTab.tsx`

The two `<SuggestionProgressPanel …/>` renders at `:307` and `:315` no longer need to pass the analysis-context props (`tailoredResumeId`, `resumeId`, `jobId`, `jobListingId`, `atsData`) — those now feed the provider in `EditorLayout`. Trim the props to nothing (or a keep-as-context-marker if needed for tailor vs library display differences). Confirm during implementation whether the panel actually displays anything differently between the two call sites; if not, collapse to a single render.

### 6. Verify the broken-accept fix is load-bearing (sanity check)

Before deleting the store-level call, grep for any other caller of `useInlineSuggestionQueueStore.*acceptCurrent` besides the keyboard hook. Confirm no other component relies on the unwrapped path.

---

## Files touched

| File | Action | Notes |
| ----- | ----- | ----- |
| `frontend/src/components/library/editor/InlineSuggestionQueueProvider.tsx` | Create | Calls `useInlineSuggestionQueue` once, exposes wrapped actions via context |
| `frontend/src/components/library/editor/EditorLayout.tsx` | Modify | Mount provider around preview + sidebar subtree; pass resume/job/ats props |
| `frontend/src/components/library/preview/BulletSuggestionDropdown.tsx` | Modify | Add original-text section, Accept/Dismiss buttons reading wrapped actions |
| `frontend/src/hooks/useInlineSuggestionKeyboard.ts` | Modify | Route Tab→wrapped `acceptCurrent` via context |
| `frontend/src/components/library/editor/tabs/SuggestionProgressPanel.tsx` | Modify | Remove bulk Accept All / Dismiss All; read provider context instead of calling hook itself |
| `frontend/src/components/library/editor/tabs/AIChatTab.tsx` | Modify | Trim props passed to `SuggestionProgressPanel` (provider owns analysis context now) |

No new components, hooks, or panels inside `components/library/editor/tabs/` — the provider lives one level above tabs, and no review UI is added to tabs.

**Reused without change:** `SuggestionPortalLayer`, `PaginatedResumePreview` (already mounts the dropdown), `useTypewriter`, `inlineSuggestionQueueStore`, `bulletIdMapping`, `useInlineSuggestionQueue`, `useBulletAnalysis`, `bulletSuggestionsStore`, `InlineEditContext` mutual exclusion, PDF export filter at `pdf-export.ts`.

---

## Export safety checklist (already passing, kept as guardrails)

- Dropdown carries `data-print-hidden="true"` + `data-no-export="true"` — `BulletSuggestionDropdown.tsx:159–160`.
- Portal layer carries both attributes — `SuggestionPortalLayer.tsx:8–9`.
- PDF export filter reads both — `lib/pdf-export.ts`.
- Portal layer is a sibling of the scaled `pages-wrapper`, not inside it — `PaginatedResumePreview.tsx:302`.
- Editor export handler calls `inlineSuggestionQueueStore.getState().dismissActive()` alongside `setActiveBlock(null)` before capture (confirm this is already wired in `EditorLayout.tsx` export handler — if not, add).

---

## Verification

1. **Click Analyze Bullets** in sidebar panel with a job linked → dropdown appears below first bullet with typewriter animation on improved text; original text shows above it; Accept/Dismiss buttons visible.
2. **Click Accept button** → bullet text in the preview updates to the improved text; dropdown advances to next pending suggestion; `isDirty` flips (save indicator shows).
3. **Press Tab after typewriter finishes** → same behavior as clicking Accept (the keyboard path is fixed).
4. **Press Tab during typewriter** → fast-forward to reveal full text (unchanged).
5. **Click Dismiss button or press Esc** → suggestion marked dismissed, advances to next; bullet text unchanged.
6. **Arrow Up/Down** → navigate between pending suggestions; dropdown repositions under new target bullet; preview does not scroll (that's jumpTo's job).
7. **Click an item in sidebar nav list** → preview scrolls to that bullet via `scrollIntoView`; dropdown reattaches.
8. **Click a bullet in preview to edit inline** → dropdown hides (or suggestion keyboard yields — verify `focusedElementId` mutual exclusion still holds); type freely; blur → dropdown may reappear on next suggestion.
9. **Export to PDF** → dropdown absent from output; no highlight artifacts on the accepted bullets beyond the new text itself.
10. **Sidebar panel** shows progress bar + score delta + nav list only — no Accept All / Dismiss All visible. Re-analyze/Restart still works when all reviewed.
11. **Run typecheck and build:** `cd frontend && bun run build`.
12. **Run E2E if applicable:** check `frontend/e2e/` for any existing bullet-suggestion tests and run them.

---

## Out of scope (mentioned for clarity, not implemented here)

- **AI chat improvement cards** inside `AIChatTab` (the per-message Accept/Dismiss flow at `AIChatTab.tsx:519–550`) — that is a different feature (freeform chat suggestions), not bullet suggestions. Unchanged by this plan.
- **Deprecated `aiReviewActive` / `aiReviewIndex` / `aiReviewComplete` fields on `bulletSuggestionsStore`** and the still-wired `AiReviewDiffOverlay` in `BulletList.tsx` — flagged in `AI_SUGGESTION_ATTEMPTS.md` as tech debt from attempt 3. Not touched here.
- **Auto-trigger analyze when ATS keyword analysis completes** — `TODO` already in `useInlineSuggestionQueue.ts:76`. Separate follow-up.

---

## Post-implementation actions (per CLAUDE.md rules 18 & 19)

1. Update `AI_SUGGESTION_ATTEMPTS.md` with an "attempt 6" row summarizing this migration and its outcome.
2. Audit `bulletSuggestionsStore.acceptAll` / `rejectAll` actions — if no remaining callers after bulk UI removal, mark as DEPRECATED with reference to this attempt or remove outright.
3. Grep for any orphaned references to `queue.acceptAll` outside `SuggestionProgressPanel` — none expected.
