# Phase 5: ATS Re-scoring Feedback Loop

**Goal:** After copilot review completes, automatically re-score the resume and show the score improvement. In the ATS tab, replace auto-scoring with a manual "Re-analyze" button.

---

## 5A: Auto Re-score After Copilot Review

**File:** `frontend/src/hooks/useBulletAnalysis.ts`

### Capture Pre-Analysis Score

Before calling `analyze()`, capture the current ATS score:

```typescript
const analyze = useCallback(async () => {
  // Capture current ATS score for delta display
  const currentScore = useATSProgressStore.getState().compositeScore?.finalScore;
  if (currentScore) {
    setPreAnalysisScore(currentScore);
  }

  // ... existing analysis logic ...
}, [...]);
```

### Trigger Re-score on Copilot Complete

Watch for `copilotComplete` and re-score if any suggestions were accepted:

```typescript
const copilotComplete = useBulletSuggestionsStore(s => s.copilotComplete);
const acceptedCount = useBulletSuggestionsStore(
  s => s.suggestions.filter(s => s.status === "accepted").length
);
const [postScore, setPostScore] = useState<number | null>(null);
const [isRescoring, setIsRescoring] = useState(false);

useEffect(() => {
  if (!copilotComplete || acceptedCount === 0) return;

  const rescore = async () => {
    setIsRescoring(true);
    try {
      const tailorContext = useTailorEditorContextSafe();
      if (!tailorContext?.jobDescription) return;

      // Build resume content from current blocks
      const content = parsedContentToTailoredContent(
        blocksToContent(blocks)
      );

      const response = await atsApi.analyzeContent({
        resume_content: content,
        job_description: tailorContext.jobDescription,
      });

      setPostScore(response.final_score);

      // Update ATS store with new score
      const atsStore = useATSProgressStore.getState();
      atsStore.markContentStale();
    } catch (err) {
      console.error("ATS re-score failed:", err);
      // Don't block completion summary - just skip score display
    } finally {
      setIsRescoring(false);
    }
  };

  rescore();
}, [copilotComplete, acceptedCount]);
```

### Expose Re-score State

Add to `UseBulletAnalysisReturn`:

```typescript
postScore: number | null;
preAnalysisScore: number | null;
isRescoring: boolean;
```

These are consumed by the `BulletSuggestionsPanel` completion summary (Phase 2).

---

## 5B: Manual Re-analyze Button in ATS Tab

**File:** `frontend/src/components/library/editor/tabs/ATSEvaluationTab.tsx`

### Current Behavior (to change)

The ATS tab may auto-trigger analysis when opened or when content changes. Replace this with:

1. Show analysis results if they exist
2. When `contentStale` is true, show a prominent "Re-analyze" banner at the top
3. Analysis only runs when user clicks the button

### Implementation

```typescript
import { RefreshCw, AlertTriangle } from "lucide-react";

// Inside ATSEvaluationTab:
const contentStale = useATSProgressStore(s => s.contentStale);
const resetAnalysis = useATSProgressStore(s => s.resetAnalysis);
const clearStaleFlag = useATSProgressStore(s => s.clearStaleFlag);
const clearSuggestions = useBulletSuggestionsStore(s => s.clearSuggestions);

const handleReanalyze = useCallback(async () => {
  // Clear stale state
  clearStaleFlag();
  // Clear old bullet suggestions (based on outdated ATS data)
  clearSuggestions();
  // Reset analysis to trigger fresh run
  resetAnalysis();
  // The analysis trigger in the tab will pick this up,
  // or manually invoke with forceRefresh: true
  await runAnalysis({ forceRefresh: true });
}, [clearStaleFlag, clearSuggestions, resetAnalysis, runAnalysis]);

// Render at top of tab:
{contentStale && (
  <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 flex items-center justify-between">
    <div className="flex items-center gap-2">
      <AlertTriangle className="h-5 w-5 text-yellow-500" />
      <div>
        <p className="text-sm font-medium">Content has changed</p>
        <p className="text-xs text-muted-foreground">
          Resume was modified since the last analysis
        </p>
      </div>
    </div>
    <button
      onClick={handleReanalyze}
      className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors shrink-0"
    >
      <RefreshCw className="h-4 w-4" />
      Re-analyze
    </button>
  </div>
)}
```

### Disable Auto-Analysis

Find and disable any `useEffect` that auto-triggers ATS analysis when the tab opens. The analysis should only run when:

1. User explicitly clicks "Analyze" for the first time
2. User clicks "Re-analyze" after content changes

---

## 5C: Score Delta Display in Completion Summary

**File:** `frontend/src/components/tailor/editor/BulletSuggestionsPanel.tsx`

In the copilot complete view, show the score change:

```typescript
const { preAnalysisScore, postScore, isRescoring } = useBulletAnalysis({...});

// In completion summary:
{isRescoring ? (
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    <Loader2 className="h-4 w-4 animate-spin" />
    Re-calculating ATS score...
  </div>
) : postScore !== null && preAnalysisScore !== null ? (
  <div className="flex items-center justify-center gap-2 text-sm">
    <span className="text-muted-foreground">ATS Score:</span>
    <span className="text-muted-foreground">{Math.round(preAnalysisScore)}%</span>
    <span className="text-muted-foreground">-></span>
    <span className={cn(
      "font-bold",
      postScore > preAnalysisScore ? "text-green-600" : "text-foreground"
    )}>
      {Math.round(postScore)}%
    </span>
    {postScore !== preAnalysisScore && (
      <span className={postScore > preAnalysisScore ? "text-green-600" : "text-red-600"}>
        ({postScore > preAnalysisScore ? "+" : ""}{Math.round(postScore - preAnalysisScore)}%)
      </span>
    )}
  </div>
) : null}
```

---

## Verification

### 5A: Auto Re-score

- [ ] Pre-analysis score is captured before bullet analysis starts
- [ ] After copilot review completes with accepted suggestions, re-score triggers
- [ ] Score delta shows in completion summary (e.g., "62% -> 78% (+16%)")
- [ ] If no suggestions accepted, re-score is skipped
- [ ] Re-score failure shows gracefully (no score displayed, no crash)
- [ ] Loading state shows during re-score calculation

### 5B: Manual Re-analyze

- [ ] ATS tab shows "Content has changed" banner when content is stale
- [ ] "Re-analyze" button triggers fresh progressive analysis
- [ ] Old bullet suggestions are cleared when re-analyzing
- [ ] ATS analysis does NOT auto-run when tab opens
- [ ] After re-analysis, stale banner disappears

### 5C: Score Delta

- [ ] Pre and post scores render with correct formatting
- [ ] Positive delta shows green "+N%"
- [ ] No delta (same score) shows no change indicator
- [ ] Loading spinner shows during re-score
