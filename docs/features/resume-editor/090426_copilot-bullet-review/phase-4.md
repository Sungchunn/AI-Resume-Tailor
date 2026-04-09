# Phase 4: Global Keyboard Handler for Copilot Mode

**Goal:** Capture Enter/Esc globally when copilot mode is active so the user can review suggestions without clicking buttons.

---

## 4.1 Add Copilot Keyboard Hook

**File:** `frontend/src/hooks/useBulletAnalysis.ts`

Add a new function `useCopilotKeyboard` to the hook's return value, or integrate directly into the hook.

### Approach: `useEffect` with Global Keydown Listener

Register a `document.addEventListener("keydown", ...)` when copilot is active, remove on cleanup.

```typescript
// Inside useBulletAnalysis hook:

const copilotActive = useBulletSuggestionsStore(s => s.copilotActive);
const advanceNext = useBulletSuggestionsStore(s => s.advanceNext);

// Copilot keyboard handler
useEffect(() => {
  if (!copilotActive) return;

  const handleKeyDown = (e: KeyboardEvent) => {
    // Don't capture if user is typing in an unrelated input
    // (the target bullet input is OK since we want to intercept there too)
    const target = e.target as HTMLElement;
    const isInUnrelatedInput =
      target.tagName === "INPUT" &&
      !target.closest("[data-copilot-bullet]");

    if (isInUnrelatedInput || target.tagName === "TEXTAREA") return;

    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      handleCopilotAccept();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      handleCopilotReject();
    }
  };

  // Use capture phase to intercept before BulletList's own Enter handler
  document.addEventListener("keydown", handleKeyDown, { capture: true });
  return () => {
    document.removeEventListener("keydown", handleKeyDown, { capture: true });
  };
}, [copilotActive, handleCopilotAccept, handleCopilotReject]);
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

### Solution: Capture Phase + `data-copilot-bullet` Attribute

1. Register the copilot handler in the **capture phase** (`{ capture: true }`) so it fires before the BulletList handler
2. Call `e.stopPropagation()` to prevent the event from reaching BulletList
3. Mark the copilot-targeted bullet input with a `data-copilot-bullet` attribute so we know not to suppress in non-target inputs

**In BulletList.tsx:** Add `data-copilot-bullet` to the bullet that's currently targeted:

```typescript
<input
  // ... existing props ...
  data-copilot-bullet={isCopilotTarget ? "true" : undefined}
/>
```

This ensures:

- Enter on the copilot-target bullet -> accept suggestion (global handler captures)
- Enter on non-target bullets -> normal behavior (create new bullet)
- Enter in unrelated inputs (chat, search) -> normal behavior

---

## 4.3 Accept/Reject with Auto-Advance

The `handleCopilotAccept` and `handleCopilotReject` functions combine the existing accept/reject logic with advancing:

```typescript
const handleCopilotAccept = useCallback(async () => {
  const current = useBulletSuggestionsStore.getState();
  const pending = current.suggestions.filter(s => s.status === "pending");
  const suggestion = pending[current.copilotIndex];
  if (!suggestion) return;

  // Reuse existing acceptSuggestion logic (update block + save)
  await acceptSuggestion(suggestion.id);

  // Advance to next
  advanceNext();
}, [acceptSuggestion, advanceNext]);

const handleCopilotReject = useCallback(() => {
  const current = useBulletSuggestionsStore.getState();
  const pending = current.suggestions.filter(s => s.status === "pending");
  const suggestion = pending[current.copilotIndex];
  if (!suggestion) return;

  rejectSuggestion(suggestion.id);
  advanceNext();
}, [rejectSuggestion, advanceNext]);
```

**Important:** Read from `getState()` (not from hook state) inside the callback to avoid stale closure issues with rapidly advancing suggestions.

---

## 4.4 Edge Case: Last Suggestion

When `advanceNext()` detects no more pending suggestions:

1. Sets `copilotComplete = true`
2. Sets `copilotActive = false`
3. The keyboard listener cleanup fires (effect dependency on `copilotActive`)
4. Panel switches to the completion summary view (Phase 2)

---

## 4.5 Return New Functions from Hook

Add to `UseBulletAnalysisReturn`:

```typescript
// Copilot actions
handleCopilotAccept: () => Promise<void>;
handleCopilotReject: () => void;
copilotActive: boolean;
copilotComplete: boolean;
```

These are consumed by `BulletSuggestionsPanel` for its button handlers (Phase 2), and the global keyboard handler is registered automatically via `useEffect`.

---

## Verification

- [ ] Enter accepts the current suggestion and advances to the next
- [ ] Esc rejects (skips) the current suggestion and advances
- [ ] Enter on non-copilot-target bullet inputs creates new bullets normally
- [ ] Enter in chat input or other text fields is not intercepted
- [ ] Keyboard listener is removed when copilot deactivates
- [ ] Rapid Enter presses handle correctly (no double-accept)
- [ ] Last suggestion -> copilot completes, keyboard handler removed
- [ ] No stale closure issues when rapidly advancing
