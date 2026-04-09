# Phase 4: Global Keyboard Handler for AI Review Mode

**Goal:** Capture Enter/Esc globally when AI review mode is active so the user can review suggestions without clicking buttons.

---

## 4.1 Add AI Review Keyboard Hook

**File:** `frontend/src/hooks/useBulletAnalysis.ts`

Add a new function `useAiReviewKeyboard` to the hook's return value, or integrate directly into the hook.

### Approach: `useEffect` with Global Keydown Listener

Register a `document.addEventListener("keydown", ...)` when AI review is active, remove on cleanup.

```typescript
// Inside useBulletAnalysis hook:

const aiReviewActive = useBulletSuggestionsStore(s => s.aiReviewActive);
const advanceNext = useBulletSuggestionsStore(s => s.advanceNext);

// AI review keyboard handler
useEffect(() => {
  if (!aiReviewActive) return;

  const handleKeyDown = (e: KeyboardEvent) => {
    // Don't capture if user is typing in an unrelated input
    // (the target bullet input is OK since we want to intercept there too)
    const target = e.target as HTMLElement;
    const isInUnrelatedInput =
      target.tagName === "INPUT" &&
      !target.closest("[data-ai-review-bullet]");

    if (isInUnrelatedInput || target.tagName === "TEXTAREA") return;

    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      handleAiReviewAccept();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      handleAiReviewReject();
    }
  };

  // Use capture phase to intercept before BulletList's own Enter handler
  document.addEventListener("keydown", handleKeyDown, { capture: true });
  return () => {
    document.removeEventListener("keydown", handleKeyDown, { capture: true });
  };
}, [aiReviewActive, handleAiReviewAccept, handleAiReviewReject]);
```

---

## 4.2 Key Interaction Conflicts

### Problem: BulletList's Enter Handler

The existing `BulletList.tsx` handles Enter on bullet inputs to create new bullets:

```typescript
if (e.key === "Enter") {
  e.preventDefault();
  // Insert new bullet after current...
}
```

### Solution: Capture Phase + `data-ai-review-bullet` Attribute

1. Register the AI review handler in the **capture phase** (`{ capture: true }`) so it fires before the BulletList handler
2. Call `e.stopPropagation()` to prevent the event from reaching BulletList
3. Mark the AI review-targeted bullet input with a `data-ai-review-bullet` attribute so we know not to suppress in non-target inputs

**In BulletList.tsx:** Add `data-ai-review-bullet` to the bullet that's currently targeted:

```typescript
<input
  // ... existing props ...
  data-ai-review-bullet={isAiReviewTarget ? "true" : undefined}
/>
```

This ensures:

- Enter on the AI review-target bullet -> accept suggestion (global handler captures)
- Enter on non-target bullets -> normal behavior (create new bullet)
- Enter in unrelated inputs (chat, search) -> normal behavior

---

## 4.3 Accept/Reject with Auto-Advance

The `handleAiReviewAccept` and `handleAiReviewReject` functions combine the existing accept/reject logic with advancing:

```typescript
const handleAiReviewAccept = useCallback(async () => {
  const current = useBulletSuggestionsStore.getState();
  const pending = current.suggestions.filter(s => s.status === "pending");
  const suggestion = pending[current.aiReviewIndex];
  if (!suggestion) return;

  // Reuse existing acceptSuggestion logic (update block + save)
  await acceptSuggestion(suggestion.id);

  // Advance to next
  advanceNext();
}, [acceptSuggestion, advanceNext]);

const handleAiReviewReject = useCallback(() => {
  const current = useBulletSuggestionsStore.getState();
  const pending = current.suggestions.filter(s => s.status === "pending");
  const suggestion = pending[current.aiReviewIndex];
  if (!suggestion) return;

  rejectSuggestion(suggestion.id);
  advanceNext();
}, [rejectSuggestion, advanceNext]);
```

**Important:** Read from `getState()` (not from hook state) inside the callback to avoid stale closure issues with rapidly advancing suggestions.

---

## 4.4 Edge Case: Last Suggestion

When `advanceNext()` detects no more pending suggestions:

1. Sets `aiReviewComplete = true`
2. Sets `aiReviewActive = false`
3. The keyboard listener cleanup fires (effect dependency on `aiReviewActive`)
4. Panel switches to the completion summary view (Phase 2)

---

## 4.5 Return New Functions from Hook

Add to `UseBulletAnalysisReturn`:

```typescript
// AI review actions
handleAiReviewAccept: () => Promise<void>;
handleAiReviewReject: () => void;
aiReviewActive: boolean;
aiReviewComplete: boolean;
```

These are consumed by `BulletSuggestionsPanel` for its button handlers (Phase 2), and the global keyboard handler is registered automatically via `useEffect`.

---

## Verification

- [ ] Enter accepts the current suggestion and advances to the next
- [ ] Esc rejects (skips) the current suggestion and advances
- [ ] Enter on non-AI-review-target bullet inputs creates new bullets normally
- [ ] Enter in chat input or other text fields is not intercepted
- [ ] Keyboard listener is removed when AI review deactivates
- [ ] Rapid Enter presses handle correctly (no double-accept)
- [ ] Last suggestion -> AI review completes, keyboard handler removed
- [ ] No stale closure issues when rapidly advancing
