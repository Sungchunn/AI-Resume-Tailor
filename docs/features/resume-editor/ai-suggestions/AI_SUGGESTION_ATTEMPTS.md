# AI Suggestion Feature: Attempt History

## Timeline

| # | Date | Directory | Approach | Outcome |
| ----- | ----- | ----- | ----- | ----- |
| 1 | 2026-03-07 | `260307_inline-suggestions/` | TipTap marks with inline diff (strikethrough + green insertion) in workshop `ResumeEditor`. `SuggestionExtension`, `SuggestionPopover`, `inlineSuggestionService`. | **Active (workshop only).** Powers the workshop editor's AI suggestion flow via TipTap marks. Not used in the block-based library/tailor editors. |
| 2 | 2026-04-06 | `260406_ai-bullet-editing/` | Panel-based card system in tailor editor. `BulletSuggestionsPanel`, `BulletSuggestionCard`, `bulletSuggestionsStore`, `useBulletAnalysis`, backend `analyze-bullets` endpoint. | **Partially active.** Backend endpoint, Zustand store, and `useBulletAnalysis` hook are still the foundation. Panel UI (`BulletSuggestionsPanel`, `BulletSuggestionCard`) replaced in attempt 5 -- deleted 2026-04-12. |
| 3 | 2026-04-09 | `260409_ai-bullet-review/` | Sequential one-at-a-time review mode on top of attempt 2. Added `aiReviewActive`/`aiReviewIndex`/`aiReviewComplete` to store, `AiReviewDiffOverlay` inline on bullet rows, keyboard Enter/Esc navigation. | **Deprecated.** Store fields and `AiReviewDiffOverlay` still wired into `BulletList.tsx` and `useBulletAnalysis.ts`, but superseded by `inlineSuggestionQueueStore` from attempt 5. Both systems currently fire simultaneously. Needs cleanup. |
| 4 | 2026-04-10 | `260410_library-bullet-suggestions/` | Extended attempt 2/3 to work in library editor (not just tailor). New backend endpoint `POST /ats/analyze-bullets`, refactored `useBulletAnalysis` for dual-mode, shared ATS data via `atsProgressStore`. | **Active.** All changes were modifications to existing files. No orphaned code. |
| 5 | 2026-04-12 | `260412_inline-bullet-suggestions/` | Floating dropdown below target bullet in preview with typewriter animation. `inlineSuggestionQueueStore`, `BulletSuggestionDropdown`, `SuggestionProgressPanel`, keyboard/queue hooks, portal layer. | **Active (current design).** This is the intended UX going forward. Reuses `bulletSuggestionsStore` + `useBulletAnalysis` as the data layer. |

---

## Currently Active Code

### Core data layer (from attempt 2, extended in 4)

- `frontend/src/lib/stores/bulletSuggestionsStore.ts` -- authoritative suggestion state
- `frontend/src/hooks/useBulletAnalysis.ts` -- API calls, accept/reject logic, block updates
- `frontend/src/components/tailor/editor/TailorEditorContext.tsx` -- tailor-mode context
- `frontend/src/components/tailor/editor/SkillSuggestionsPanel.tsx` -- missing skills panel (ATS gaps)
- `backend/app/api/routes/tailor/suggestions.py` -- tailor analyze-bullets endpoint
- `backend/app/api/routes/ats/bullets.py` -- library analyze-bullets endpoint
- `backend/app/services/job/diff/bullet_analyzer.py` -- batch bullet analysis service

### Inline dropdown system (from attempt 5)

- `frontend/src/lib/stores/inlineSuggestionQueueStore.ts` -- queue navigation state
- `frontend/src/components/library/preview/BulletSuggestionDropdown.tsx` -- floating dropdown card
- `frontend/src/components/library/preview/SuggestionPortalLayer.tsx` -- portal outside page DOM
- `frontend/src/components/library/editor/tabs/SuggestionProgressPanel.tsx` -- progress panel in AI tab
- `frontend/src/hooks/useInlineSuggestionKeyboard.ts` -- Tab/Esc/arrow key handler
- `frontend/src/hooks/useInlineSuggestionQueue.ts` -- orchestration hook
- `frontend/src/hooks/useTypewriter.ts` -- typewriter animation
- `frontend/src/lib/resume/bulletIdMapping.ts` -- analysis ID to DOM element ID bridge

### Workshop path (from attempt 1, separate architecture)

- `frontend/src/lib/editor/suggestionExtension.ts` -- TipTap mark extension
- `frontend/src/components/editor/SuggestionPopover.tsx` -- popover for TipTap suggestions
- `frontend/src/lib/services/inlineSuggestionService.ts` -- workshop AI suggestion service
- `frontend/src/components/editor/SuggestionsPanel.tsx` -- workshop suggestions panel
- `frontend/src/hooks/useInlineSuggestion.ts` -- workshop inline suggestion hook
- `frontend/src/hooks/useBulletNavigation.ts` -- workshop bullet navigation

---

## Dead Code Removed (2026-04-12)

| File | From Attempt | Reason |
| ----- | ----- | ----- |
| `frontend/src/components/tailor/editor/BulletSuggestionsPanel.tsx` | 2 | Replaced by `SuggestionProgressPanel` (attempt 5). Zero imports. |
| `frontend/src/components/tailor/editor/BulletSuggestionCard.tsx` | 2 | Only imported by dead `BulletSuggestionsPanel`. |
| `frontend/src/components/tailor/editor/__tests__/BulletSuggestionCard.test.tsx` | 2 | Test for dead component. |

---

## Deprecated Code (still wired in, needs future cleanup)

| Item | Location | From Attempt | Replacement |
| ----- | ----- | ----- | ----- |
| `aiReviewActive` field | `bulletSuggestionsStore.ts` | 3 | `inlineSuggestionQueueStore.isActive` |
| `aiReviewIndex` field | `bulletSuggestionsStore.ts` | 3 | `inlineSuggestionQueueStore.currentIndex` |
| `aiReviewComplete` field | `bulletSuggestionsStore.ts` | 3 | Queue store `progress.reviewed === progress.total` |
| `startAiReview()` action | `bulletSuggestionsStore.ts` | 3 | `inlineSuggestionQueueStore.populateQueue()` |
| `advanceNext()` action | `bulletSuggestionsStore.ts` | 3 | `inlineSuggestionQueueStore.advanceNext()` |
| `useCurrentAiReviewSuggestion` | `bulletSuggestionsStore.ts` | 3 | `useCurrentQueueSuggestion()` from queue store |
| `useAiReviewProgress` | `bulletSuggestionsStore.ts` | 3 | `useQueueProgress()` from queue store |
| `AiReviewDiffOverlay` component | `tailor/editor/AiReviewDiffOverlay.tsx` | 3 | `BulletSuggestionDropdown` (attempt 5) |
| `AiReviewDiffOverlay` import | `blocks/shared/BulletList.tsx` | 3 | Remove after inline system fully replaces old flow |

---

## Design Going Forward

The **inline bullet suggestion system** (attempt 5, `260412_inline-bullet-suggestions/master-plan.md`) is the canonical design:

1. ATS analysis completes, user clicks "Analyze Bullets" in AI tab progress panel
2. Backend returns suggestions via `useBulletAnalysis` into `bulletSuggestionsStore`
3. `inlineSuggestionQueueStore` picks up suggestions, sorts by impact
4. Floating `BulletSuggestionDropdown` appears below target bullet with typewriter animation
5. User presses Tab to accept, Esc to dismiss, arrows to navigate
6. `SuggestionProgressPanel` in AI tab shows progress and allows click-to-jump

**Next cleanup:** Remove deprecated attempt 3 fields from `bulletSuggestionsStore` and decouple `BulletList.tsx` from `AiReviewDiffOverlay`. The `setSuggestions` action currently sets `aiReviewActive: true` alongside the inline queue -- this dual activation should be eliminated.
