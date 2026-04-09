# Test Plan: AI Bullet Review Feature

## Context

The AI bullet review feature (5 phases, documented in `/docs/features/resume-editor/090426_ai-bullet-review/`) is fully implemented but has zero test coverage. The project uses Vitest + jsdom + @testing-library/react. There are no existing Zustand store tests — this will establish the pattern. The plan creates 4 test files covering the store, pure helper functions, and key components.

---

## Prerequisite: Export Helper Functions

**File:** `frontend/src/hooks/useBulletAnalysis.ts`

Export the 3 pure helper functions (currently private) so they can be unit tested:

- `collectBulletsFromBlocks` (line 74) — add `export`
- `buildImportanceMap` (line 132) — add `export`
- `findEntryContext` (line 142) — add `export`

These are pure functions with no React dependencies.

---

## File 1: Store Tests (highest priority)

**Path:** `frontend/src/lib/stores/__tests__/bulletSuggestionsStore.test.ts`

Pure logic tests — no React rendering, no mocking. Uses `useBulletSuggestionsStore.getState()` directly.

**Shared fixture:** `makeSuggestion(overrides?)` factory returning a `BulletSuggestion` with defaults.

**Reset pattern:**

```typescript
const initialState = useBulletSuggestionsStore.getState();
beforeEach(() => useBulletSuggestionsStore.setState(initialState, true));
```

### Test Cases (~35 tests)

**`describe("initial state")`** — defaults: empty suggestions, aiReviewActive=false, aiReviewIndex=0, aiReviewComplete=false, preAnalysisScore=null

**`describe("setSuggestions")`:**

- Stores suggestions, sets lastAnalyzedAt, binds resumeId, clears error/isAnalyzing
- Auto-enters AI review mode when suggestions.length > 0
- Does NOT enter AI review when empty array
- Resets aiReviewIndex=0, aiReviewComplete=false

**`describe("clearSuggestions")`:** — resets suggestions, lastAnalyzedAt, all AI review state, preAnalysisScore, error

**`describe("acceptSuggestion / rejectSuggestion")`:**

- Sets status to "accepted"/"rejected" for matching id
- Does not modify other suggestions
- No-op for nonexistent id

**`describe("acceptAll / rejectAll")`:**

- Sets all pending to accepted/rejected
- Does not modify already-accepted/rejected suggestions

**`describe("bindToResume")`:**

- Clears suggestions when switching resumeId
- No-op when binding to same resumeId

**`describe("startAiReview")`:** — sets active=true, index=0, complete=false

**`describe("exitAiReview")`:** — sets active=false, index=0, complete=false; preserves suggestions

**`describe("advanceNext")`:**

- Increments aiReviewIndex when more pending remain
- Sets aiReviewComplete=true, aiReviewActive=false at last pending suggestion
- Correctly counts only pending (ignores accepted/rejected)

**`describe("setPreAnalysisScore")`:** — stores the score

**`describe("selectors")`:** — test via `renderHook`:

- `useCurrentAiReviewSuggestion`: null when inactive; returns pending[index]; null when OOB
- `useAiReviewProgress`: correct current/total/acceptedCount/rejectedCount/reviewed
- `usePendingSuggestions`: filters pending only
- `useSuggestionForBullet`: finds by bulletId; undefined for accepted; undefined for no match
- `useSuggestionStats`: correct total/pending/accepted/rejected/highImpact counts

---

## File 2: Hook Helper Function Tests

**Path:** `frontend/src/hooks/__tests__/useBulletAnalysis.helpers.test.ts`

Pure function tests — no React, no mocking.

### Test Cases (~15 tests)

**`describe("collectBulletsFromBlocks")`:**

- Extracts bullets from experience blocks with ID format `blockId:entry-N:bullet-M`
- Extracts bullets from projects blocks (company="" for projects)
- Skips empty/whitespace-only bullets
- Handles multiple entries within a single block
- Returns empty array for blocks with no content
- Ignores non-experience, non-projects block types
- Builds correct entry_context (title, company, date_range)

**`describe("buildImportanceMap")`:**

- Creates keyword->importance mapping
- Returns empty object for empty array

**`describe("findEntryContext")`:**

- Returns entry context for matching bulletId
- Returns empty strings when bulletId not found

---

## File 3: AiReviewDiffOverlay Component Tests

**Path:** `frontend/src/components/tailor/editor/__tests__/AiReviewDiffOverlay.test.tsx`

Simple prop-based rendering — no hooks, no store, no mocking needed.

### Test Cases (~8 tests)

**`describe("rendering")`:**

- Renders impact badge with correct text (HIGH/MEDIUM/LOW uppercase)
- Renders original text inside `<del>` element
- Renders suggested text
- Renders reason text in italic
- Renders keyword badges with "+" prefix when keywordsAdded is non-empty
- Does not render keyword section when keywordsAdded is empty
- Renders Enter/Esc keyboard hints

---

## File 4: BulletSuggestionCard Component Tests

**Path:** `frontend/src/components/tailor/editor/__tests__/BulletSuggestionCard.test.tsx`

Props-based component with callbacks. Uses `@testing-library/user-event` for clicks.

### Test Cases (~10 tests)

**`describe("rendering")`:**

- Renders impact badge (HIGH/MEDIUM/LOW)
- Renders original text with strikethrough
- Renders suggested text
- Renders reason text
- Renders "+Metrics" badge when metricsAdded=true; absent when false
- Renders keyword badges with "+" prefix; absent when empty

**`describe("actions")`:**

- Calls onAccept when Accept button clicked
- Calls onReject when Reject button clicked

**`describe("focus")`:**

- Focuses card element when isFirst=true

---

## Not Included (and why)

**`BulletSuggestionsPanel.test.tsx`:** — Requires mocking 3+ modules (useBulletAnalysis hook, TailorEditorContext, bulletSuggestionsStore selectors). High effort, lower marginal value since the store and components it composes are already tested. Can be added later.

**`BulletList.tsx` AI review integration:** — The AI review-specific rendering (highlight ring, overlay) depends on `useCurrentAiReviewSuggestion` which is tested via the store tests. The overlay component is tested independently.

**`useBulletAnalysis` hook integration test:** — Heavy context dependencies (useBlockEditor, useTailorEditorContextSafe, API clients). The pure helpers are extracted and tested. Store interactions are tested via store tests.

---

## Implementation Order

1. Export helpers from `useBulletAnalysis.ts` (prerequisite)
2. `bulletSuggestionsStore.test.ts` — store tests (zero dependencies, highest value)
3. `useBulletAnalysis.helpers.test.ts` — pure function tests
4. `AiReviewDiffOverlay.test.tsx` — simple component test
5. `BulletSuggestionCard.test.tsx` — component test with callbacks

---

## Verification

```bash
cd frontend && bun run test:run -- --reporter=verbose src/lib/stores/__tests__/bulletSuggestionsStore.test.ts
cd frontend && bun run test:run -- --reporter=verbose src/hooks/__tests__/useBulletAnalysis.helpers.test.ts
cd frontend && bun run test:run -- --reporter=verbose src/components/tailor/editor/__tests__/AiReviewDiffOverlay.test.tsx
cd frontend && bun run test:run -- --reporter=verbose src/components/tailor/editor/__tests__/BulletSuggestionCard.test.tsx
cd frontend && bun run test:run  # run all tests to verify no regressions
cd frontend && bun run typecheck  # verify exports don't break types
```

---

## Summary

| File | Location | Tests | Mocking | Priority |
| ---- | -------- | ----- | ------- | -------- |
| `bulletSuggestionsStore.test.ts` | `stores/__tests__/` | ~35 | None | 1 |
| `useBulletAnalysis.helpers.test.ts` | `hooks/__tests__/` | ~15 | None | 2 |
| `AiReviewDiffOverlay.test.tsx` | `tailor/editor/__tests__/` | ~8 | None | 3 |
| `BulletSuggestionCard.test.tsx` | `tailor/editor/__tests__/` | ~10 | None | 4 |

**Total: ~68 test cases across 4 files, 1 minor code change (export helpers).**
