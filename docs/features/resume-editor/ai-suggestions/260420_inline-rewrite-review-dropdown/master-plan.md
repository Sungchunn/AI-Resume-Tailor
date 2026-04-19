# Inline Rewrite Review Dropdown

**Date:** 2026-04-20
**Group:** `resume-editor/ai-suggestions`
**Status:** Implemented

---

## Context

The AI "Rewrite for Job" flow currently surfaces its review UI through a floating `RewriteChangeSummaryPanel` pinned to the top-left of the preview area. Users see a list of all rewritten bullets in the popup, click each one to jump the preview to that bullet, and then accept/reject via keyboard. The spatial split between the list and the bullet being reviewed creates friction — users must mentally map panel text back to the resume before deciding.

The goal of this change is to replace the popup with an **inline dropdown attached directly beneath each bullet** (and the summary section) during rewrite review. Each dropdown shows the proposed text, reason, keywords, and Accept / Undo / Reject buttons — visually bounded by two horizontal separator lines — so the diff is reviewed in place instead of across panels.

Per the user's answers during planning:

1. All pending bullet dropdowns expand at once (no active/collapsed distinction).
2. The floating `RewriteChangeSummaryPanel` is removed entirely.
3. The dropdown lives in document flow and pushes content down (no portal, no overlay).
4. The section summary rewrite uses the same inline pattern (attached to `SummaryPreview`).

## Prior-Attempts Note (CLAUDE.md rule 18)

This is distinct from the **bullet-suggestion** system (`bulletSuggestionsStore` + `BulletSuggestionDropdown`, documented across attempts 1–7 in `AI_SUGGESTION_ATTEMPTS.md`). The rewrite-review feature uses a separate store (`rewriteDiffStore`) and component tree; no prior attempts are on file for it. This is the first plan for the rewrite-review UX specifically.

Unrelated attempts:

- `260412_inline-bullet-suggestions/`, `260418_inline-review-migration/`, `260419_suggestion-panel-relocation.md` — all target the bullet-suggestion path, not rewrite review. The two systems coexist and both use `data-bullet-element-id` for DOM anchoring, so the inline-dropdown patterns from those docs are useful references for styling but the stores and triggers are independent.

## Scope

**In scope:**

- Delete `RewriteChangeSummaryPanel.tsx` and remove its mount in `EditorLayout.tsx`.
- Stop swapping displayed bullet text inside `RewritableBulletItem`; render the current text as-is and append an inline `InlineRewriteDropdown` sibling when an entry exists.
- Add inline rewrite dropdown to `SummaryPreview` for the summary rewrite case.
- Add a `markRejected(elementId)` action to `rewriteDiffStore` (non-breaking addition).
- Add a minimal, inline "Done reviewing" exit control (not floating).

**Out of scope:**

- Workshop editor (`/workshop/[id]`) — uses a different architecture.
- Bullet-suggestion system (`BulletSuggestionDropdown`, `SuggestionProgressPanel`, `EditorSuggestionDock`). Untouched.
- Deprecated `aiReviewActive` / `aiReviewIndex` cleanup from `bulletSuggestionsStore` — pre-existing tech debt.

## Current Architecture

| File | Role |
| ----- | ----- |
| `frontend/src/lib/stores/rewriteDiffStore.ts` | Zustand store with `bullets`, `summary`, `stateStack`, `activeElementId`, accept / undo / advance actions |
| `frontend/src/hooks/useRewriteResume.ts` | Triggers rewrite from ATS tab, populates the store via `store.populate()` |
| `frontend/src/hooks/useRewriteKeyboard.ts` | Document-level Tab/Enter (accept), Escape (undo), ArrowUp/Down (navigate) |
| `frontend/src/components/library/editor/RewriteChangeSummaryPanel.tsx` | Floating popup at `top-4 left-4` of preview — the UI this plan removes |
| `frontend/src/components/library/editor/inline/RewritableBulletItem.tsx` | Wraps each bullet `<li>`; currently **overrides displayed text** with proposed text when an entry exists |
| `frontend/src/components/library/preview/blocks/SummaryPreview.tsx` | Renders summary; has its own inline override (`summary-content` span vs `InlineRichText`) |
| `frontend/src/components/library/editor/EditorLayout.tsx` | Mounts `<RewriteChangeSummaryPanel />` at line 351 |

Five preview block files (`ExperiencePreview`, `ProjectsPreview`, `LeadershipPreview`, `VolunteerPreview`, `EducationPreview`) wrap their bullets in `<RewritableBulletItem>` — they will **not** be modified; only the wrapper's internals change.

## UX Specification

Each bullet with a rewrite entry renders:

```text
•  [current bullet text (the <li>, unmodified)]
   ─────────────────────────────────────────────
   ✨ Suggested
   [proposed rewrite text]
   Why: <reason>             [keyword] [keyword] [keyword]
   [✓ Accept]   [↶ Undo]   [✗ Reject]
   ─────────────────────────────────────────────
```

Behaviors:

- **Visibility:** open for every bullet whose `status !== "rejected"`. Rejected bullets render no dropdown. Accepted bullets keep the dropdown visible in a green "Accepted" state so users can still Undo.
- **Active bullet:** styled with a subtle teal ring (matching today's `isActive` treatment), useful for the keyboard navigator. Content is identical to non-active dropdowns.
- **Summary:** identical treatment, attached below the summary section body.
- **Export hygiene:** dropdown root carries `data-no-export="true"` + `data-print-hidden="true"` (consistent with `SuggestionPortalLayer.tsx:8-9` and `BulletSuggestionDropdown.tsx:164-165`).
- **Layout:** dropdown flows in the document and pushes content below it down. Pagination will re-settle after review ends (dropdowns vanish). PDF export is unaffected due to `data-no-export`.
- **Styling:** muted card background, smaller-than-body font, teal accents for pending, green for accepted. The two visible separator lines are `border-t` + `border-b` on the dropdown container.

## Bullet Display Rule Change

Today, `RewritableBulletItem.tsx:40,55` shows `entry.stateStack[entry.currentIndex]` (proposed text) and hides the original `children`. After this change:

- Always render `children` unchanged. The `<li>` shows the current block text.
- When an entry exists, append `<InlineRewriteDropdown entry={entry} isActive={isActive} />` as a sibling child of the `<li>`.
- On Accept, `useRewriteKeyboard`'s action path already calls `editorContext.updateContentByPath(elementId, proposedText)` (`useRewriteKeyboard.ts:32-33`), which updates the block text so `children` naturally shows the new text.

DOM:

```tsx
<li data-bullet-element-id={elementId} style={liStyle}>
  <div className="bullet-text">{children}</div>
  {entry && <InlineRewriteDropdown entry={entry} isActive={isActive} />}
</li>
```

The `list-disc` marker sits on the `<li>` and visually attaches to the first line of content (the text). The dropdown is a subsequent child of the same `<li>` but renders as a block-level element — no bullet marker appears next to it because `list-disc` targets the `<li>`, not its children.

## Files to Modify

| File | Change |
| ----- | ----- |
| `frontend/src/components/library/editor/inline/RewritableBulletItem.tsx` | Render `children` unchanged; append `<InlineRewriteDropdown />` when entry exists. Keep active-state ring. |
| `frontend/src/components/library/editor/inline/InlineRewriteDropdown.tsx` **(new)** | Proposed text + reason + keywords + Accept/Undo/Reject. Supports `variant: "bullet" \| "summary"`. Uses `useRewriteDiffStore` + `useBlockEditorOptional`. |
| `frontend/src/components/library/editor/inline/index.ts` | Export `InlineRewriteDropdown`. |
| `frontend/src/components/library/preview/blocks/SummaryPreview.tsx` | Always render `InlineRichText` (no override); append `<InlineRewriteDropdown variant="summary" />` when pending summary entry exists. |
| `frontend/src/lib/stores/rewriteDiffStore.ts` | Add `markRejected(elementId)` action + type declaration in `RewriteDiffActions`. |
| `frontend/src/hooks/useRewriteKeyboard.ts` | Optional: add a Reject shortcut (e.g. Shift+Tab or Backspace) — confirm during implementation. |
| `frontend/src/components/library/editor/EditorLayout.tsx` | Remove `<RewriteChangeSummaryPanel />` import (line 22) and mount (line 351). Add a small inline "Done reviewing" control docked at the bottom-right of the preview container when `isRewriteActive`, carrying `data-print-hidden` / `data-no-export`. Calls `exitReview`. |
| `frontend/src/components/library/editor/RewriteChangeSummaryPanel.tsx` | **Delete.** |

## New `InlineRewriteDropdown` Component

```tsx
interface InlineRewriteDropdownProps {
  entry: BulletRewriteEntry | SummaryRewriteEntry;
  variant?: "bullet" | "summary";
  isActive?: boolean;
}
```

Render shape (sketch):

```tsx
<div
  className="my-1 border-t border-b border-teal-200 bg-teal-50/40 px-2 py-1.5 text-xs rounded-sm data-[status=accepted]:bg-green-50/40 data-[status=accepted]:border-green-200"
  data-print-hidden="true"
  data-no-export="true"
  data-status={entry.status}
>
  <div className="flex items-center gap-1.5 font-medium text-teal-700">
    <Wand2 className="w-3 h-3" /> Suggested
    {isActive && <span className="ml-auto text-[10px] text-teal-600">active</span>}
  </div>
  <p className="mt-1 text-foreground">{entry.stateStack[1]}</p>
  {entry.reason && (
    <p className="mt-1 text-muted-foreground italic">Why: {entry.reason}</p>
  )}
  {"keywords" in entry && entry.keywords.length > 0 && (
    <div className="mt-1 flex flex-wrap gap-1">
      {entry.keywords.map((k) => <Pill key={k}>{k}</Pill>)}
    </div>
  )}
  <div className="mt-1.5 flex gap-1">
    <button onClick={onAccept}>✓ Accept</button>
    <button onClick={onUndo} disabled={entry.currentIndex <= 0}>↶ Undo</button>
    <button onClick={onReject}>✗ Reject</button>
  </div>
</div>
```

Action wiring (reuses the `useRewriteActions` pattern from `useRewriteKeyboard.ts:19-65`):

- **Accept:** `markAccepted(elementId)` + `editorContext.updateContentByPath(elementId, proposedText)` + `advanceNext()`.
- **Undo:** `popUndo(elementId)` + `updateContentByPath` if the text was already written (status was `"accepted"`).
- **Reject:** `markRejected(elementId)` (new) + `advanceNext()`. No block text update.

Summary variant uses the already-existing `acceptSummary`, `popSummaryUndo`, and `rejectSummary` actions.

## `markRejected` — Store Addition

In `frontend/src/lib/stores/rewriteDiffStore.ts`:

```ts
markRejected: (elementId) => {
  const { bullets } = get();
  const entry = bullets[elementId];
  if (!entry) return;
  set({
    bullets: { ...bullets, [elementId]: { ...entry, status: "rejected" } },
  });
},
```

Also add to the `RewriteDiffActions` interface. `advanceNext()` already filters on `status === "pending"` (via `findNextPendingId`, lines 89-99), so rejections are skipped in navigation naturally.

## Done-Reviewing Control

With the floating panel gone, users still need a way to exit review early (accept/reject-all flow is no longer bundled together). Minimal approach:

- A small pill button rendered by `EditorLayout.tsx`, absolutely positioned at `bottom-4 right-4` of the preview Panel container, **only when `isRewriteActive === true`**.
- Label: "Done reviewing". On click → `useRewriteDiffStore.getState().exitReview()`.
- `data-print-hidden="true"` + `data-no-export="true"`.
- Visually lighter than the removed panel (no progress counter; progress was redundant once review is inline).

If users later request the progress indicator back, it can live inside this pill (e.g. "Done reviewing (3/13 accepted)").

## Verification

End-to-end check after implementation:

1. `cd frontend && bun run build` — type check + build pass.
2. `bun dev` and open `/library/resumes/<id>/edit`.
3. Go to the ATS tab → click "Rewrite for Job".
4. **Confirm visually:**
   - No floating panel at top-left.
   - Each pending bullet has an inline dropdown directly below it with:
     - Two horizontal separator lines (top and bottom of the dropdown).
     - Proposed text, reason, keywords.
     - Accept / Undo / Reject buttons.
   - The summary section shows an equivalent dropdown.
   - A "Done reviewing" pill is visible at the bottom-right of the preview.
5. **Functional checks:**
   - Click Accept on a bullet dropdown → the bullet text updates to the proposed text; dropdown enters green "Accepted" state with Undo enabled.
   - Click Reject on a bullet dropdown → dropdown disappears; other dropdowns remain.
   - Click Undo on an accepted bullet → bullet text reverts; dropdown returns to pending.
   - Keyboard: Tab (accept), Escape (undo), ArrowUp/Down (navigate active bullet). Active bullet shows the teal ring.
   - Click "Done reviewing" → all dropdowns vanish; bullets show final accepted or original text.
6. **Export check:** trigger PDF export. Confirm no dropdowns, separator lines, or Done button appear in the output.
7. **Regression check:** the bullet-suggestion system (`EditorSuggestionDock` / `BulletSuggestionDropdown`) still works end-to-end; the two flows don't collide.
8. **Test:** extend `frontend/src/__tests__/stores/rewriteDiffStore.test.ts` with a `markRejected` case — advances to next pending, skips the rejected ID in subsequent navigation.

## Risks and Mitigations

| Risk | Mitigation |
| ----- | ----- |
| Dropdown pushes content onto the next page during review, causing A4 pagination shifts | Accepted by the user. Noted that pagination re-settles after review ends because dropdowns carry `data-no-export` and vanish on `exitReview`. |
| `list-disc` marker rendering awkwardly when `<li>` has multiple children | Wrap text in `<div class="bullet-text">` — marker still attaches to the `<li>`. Test visually across all 5 block types. |
| Many simultaneous dropdowns feel noisy | Styled muted + small text + clearly delimited by borders. If feedback is negative, follow up with a per-dropdown collapse or "only active" toggle. |
| `RewritableBulletItem` no longer swapping text could momentarily show wrong text if `updateContentByPath` were async | `updateContentByPath` is synchronous (zustand `set`). No race. |
| Existing store tests break from `markRejected` addition | Addition is non-breaking (new action only). Extend tests rather than replace. |

## Follow-Ups

- No entry needed in `AI_SUGGESTION_ATTEMPTS.md` — that ledger is scoped to the bullet-suggestion system. A separate rewrite-review ledger is not warranted until there's a second attempt to track.
- If the "Done reviewing" pill pattern proves useful, consider documenting it as a standard "review-mode exit control" in `/docs/architecture/editor-guide.md`.
