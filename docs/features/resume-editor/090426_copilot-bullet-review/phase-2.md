# Phase 2: Copilot Review UI in BulletSuggestionsPanel

**Goal:** Transform the suggestions panel to show a focused sequential review when copilot mode is active, with progress tracking and a completion summary.

---

## 2.1 Modify BulletSuggestionsPanel

**File:** `frontend/src/components/tailor/editor/BulletSuggestionsPanel.tsx`

Add a new render state between the existing "State 5: No suggestions" and "State 6: Results":

**State 6a: Copilot Active** (sequential review)
**State 6b: Cards View** (fallback, existing behavior)
**State 7: Copilot Complete** (summary with score delta)

### Copilot Active View

```typescript
// When copilotActive is true, show sequential review:
<div className="space-y-3">
  {/* Progress bar */}
  <div className="space-y-2">
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span>Reviewing suggestions</span>
      <span>{progress.current} of {progress.total}</span>
    </div>
    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
      <div
        className="h-full bg-blue-500 rounded-full transition-all duration-300"
        style={{ width: `${(progress.reviewed / progress.total) * 100}%` }}
      />
    </div>
  </div>

  {/* Current suggestion card */}
  {currentSuggestion && (
    <BulletSuggestionCard
      suggestion={currentSuggestion}
      onAccept={() => handleCopilotAccept(currentSuggestion.id)}
      onReject={() => handleCopilotReject(currentSuggestion.id)}
      isFirst={true}
    />
  )}

  {/* Keyboard hints */}
  <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
    <span className="flex items-center gap-1">
      <kbd>Enter</kbd> accept
    </span>
    <span className="flex items-center gap-1">
      <kbd>Esc</kbd> skip
    </span>
  </div>

  {/* Exit copilot button */}
  <button onClick={exitCopilot} className="...">
    Exit review (show all cards)
  </button>
</div>
```

### Copilot Complete View

```typescript
// When copilotComplete is true, show summary:
<div className="space-y-4">
  <div className="flex items-center gap-2">
    <CheckCircle2 className="h-5 w-5 text-green-500" />
    <span className="font-medium">Review complete</span>
  </div>

  {/* Stats */}
  <div className="grid grid-cols-2 gap-2 text-sm">
    <div className="bg-green-500/10 rounded-lg p-3 text-center">
      <div className="text-lg font-bold text-green-600">{acceptedCount}</div>
      <div className="text-xs text-muted-foreground">Accepted</div>
    </div>
    <div className="bg-muted rounded-lg p-3 text-center">
      <div className="text-lg font-bold">{rejectedCount}</div>
      <div className="text-xs text-muted-foreground">Skipped</div>
    </div>
  </div>

  {/* Score delta (if re-score completed) */}
  {postScore !== null && preScore !== null && (
    <div className="flex items-center justify-center gap-2 text-sm">
      <span className="text-muted-foreground">ATS Score:</span>
      <span className="text-muted-foreground">{preScore}%</span>
      <span>-></span>
      <span className={delta > 0 ? "text-green-600 font-bold" : "text-foreground"}>
        {postScore}%
      </span>
      {delta !== 0 && (
        <span className={delta > 0 ? "text-green-600" : "text-red-600"}>
          ({delta > 0 ? "+" : ""}{delta}%)
        </span>
      )}
    </div>
  )}

  {/* Actions */}
  <button onClick={analyze} className="...">Analyze Again</button>
</div>
```

---

## 2.2 New Imports and Hooks

Add to `BulletSuggestionsPanel`:

```typescript
import {
  useCurrentCopilotSuggestion,
  useCopilotProgress,
} from "@/lib/stores/bulletSuggestionsStore";

// In component:
const currentSuggestion = useCurrentCopilotSuggestion();
const progress = useCopilotProgress();
const copilotActive = useBulletSuggestionsStore(s => s.copilotActive);
const copilotComplete = useBulletSuggestionsStore(s => s.copilotComplete);
const exitCopilot = useBulletSuggestionsStore(s => s.exitCopilot);
const preAnalysisScore = useBulletSuggestionsStore(s => s.preAnalysisScore);
```

---

## 2.3 Accept/Reject in Copilot Mode

In `useBulletAnalysis` hook, add copilot-specific accept/reject that advances:

```typescript
const handleCopilotAccept = useCallback(async (id: string) => {
  await acceptSuggestion(id);  // existing: update block + save
  advanceNext();               // new: move to next pending
}, [acceptSuggestion, advanceNext]);

const handleCopilotReject = useCallback((id: string) => {
  rejectSuggestion(id);       // existing: mark as rejected
  advanceNext();               // new: move to next pending
}, [rejectSuggestion, advanceNext]);
```

---

## Verification

- [ ] After analysis returns suggestions, panel enters copilot view (not cards)
- [ ] Progress bar shows "1 of N" and updates as suggestions are reviewed
- [ ] Only ONE suggestion card is visible at a time
- [ ] "Exit review" button switches to all-cards view
- [ ] After all reviewed, shows completion summary with accepted/skipped counts
- [ ] Score delta displays correctly (after Phase 5 integration)
- [ ] "Analyze Again" button works from completion view
