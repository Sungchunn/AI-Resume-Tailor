# Phase 5: Polish & Re-scoring

**Goal:** Add indicators when content changes after ATS analysis and provide a way to re-run ATS analysis.

---

## 5.1 Add "Content Changed" Indicator

### Concept

When the user modifies their resume content (especially after accepting bullet suggestions), the ATS score may no longer be accurate. We need to:

1. Track the content hash that was analyzed
2. Detect when current content differs from analyzed content
3. Show a visual indicator that the score may have changed

### Store Changes

**File:** `frontend/src/lib/stores/atsProgressStore.ts`

Add content hash tracking:

```typescript
interface ATSProgressState {
  // ... existing fields

  // Content tracking
  analyzedContentHash: string | null;  // Hash of content when analysis ran
  contentStale: boolean;               // True if content changed since analysis
}

interface ATSProgressActions {
  // ... existing actions

  setAnalyzedContentHash: (hash: string) => void;
  markContentStale: () => void;
  clearStaleFlag: () => void;
}
```

### Hash Utility

**File:** `frontend/src/lib/utils/contentHash.ts`

```typescript
/**
 * Generate a simple hash of resume content for staleness detection.
 * Uses text content only (not formatting) to avoid false positives.
 */
export function generateContentHash(blocks: Block[]): string {
  const textContent = blocks
    .filter((b) => ["experience", "projects", "skills", "summary"].includes(b.type))
    .map((b) => JSON.stringify(b.content))
    .join("|");

  // Simple hash function (djb2)
  let hash = 5381;
  for (let i = 0; i < textContent.length; i++) {
    hash = (hash * 33) ^ textContent.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}
```

### Integration in Editor

**File:** `frontend/src/components/library/editor/BlockEditorContext.tsx`

Add content change detection:

```typescript
// In BlockEditorProvider:

const { analyzedContentHash, markContentStale } = useATSProgressStore();

// Track content changes
useEffect(() => {
  if (!analyzedContentHash) return;

  const currentHash = generateContentHash(blocks);
  if (currentHash !== analyzedContentHash) {
    markContentStale();
  }
}, [blocks, analyzedContentHash, markContentStale]);
```

### Visual Indicator

**File:** `frontend/src/components/library/editor/EditorHeader.tsx`

Add stale score indicator near the ATS score display:

```typescript
const contentStale = useATSProgressStore((s) => s.contentStale);

// In render, next to ATS score:
{contentStale && (
  <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
    <AlertTriangle className="h-4 w-4" />
    <span className="text-xs">Score may have changed</span>
  </div>
)}
```

---

## 5.2 Add "Re-analyze ATS" Button

### Changes to ATSEvaluationTab

**File:** `frontend/src/components/library/editor/tabs/ATSEvaluationTab.tsx`

Add re-analyze functionality:

```typescript
import { RefreshCw, AlertTriangle } from "lucide-react";

export function ATSEvaluationTab({ jobId, jobListingId }: ATSEvaluationTabProps) {
  const contentStale = useATSProgressStore((s) => s.contentStale);
  const clearStaleFlag = useATSProgressStore((s) => s.clearStaleFlag);
  const resetAnalysis = useATSProgressStore((s) => s.reset);

  // Function to trigger re-analysis
  const handleReanalyze = useCallback(async () => {
    // Clear existing analysis state
    resetAnalysis();
    clearStaleFlag();

    // Invalidate cache (force fresh analysis)
    // This will be handled by the analysis mutation with forceRefresh=true

    // Trigger new analysis
    // The auto-run effect will pick this up, or manually call:
    await runAnalysis({ forceRefresh: true });
  }, [resetAnalysis, clearStaleFlag, runAnalysis]);

  return (
    <div className="space-y-4 p-4">
      {/* Stale content warning */}
      {contentStale && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-sm font-medium">Content has changed</p>
                <p className="text-xs text-muted-foreground">
                  Your resume was modified since the last analysis
                </p>
              </div>
            </div>
            <Button
              onClick={handleReanalyze}
              variant="outline"
              size="sm"
              className="shrink-0"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Re-analyze
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Existing ATS content */}
      {/* ... */}
    </div>
  );
}
```

### Backend Cache Invalidation

The `forceRefresh` parameter already exists in the progressive analysis endpoint. When `forceRefresh=true`:

1. Skip cache lookup
2. Run full analysis pipeline
3. Overwrite cached results

No backend changes needed - just ensure frontend passes `force_refresh: true` when re-analyzing.

---

## 5.3 Clear Stale Flag on Fresh Analysis

### In ATS Progress Store

When a new analysis completes, automatically clear the stale flag:

```typescript
// In atsProgressStore.ts, in the SSE event handlers:

case "complete":
  set({
    // ... existing state updates
    contentStale: false,  // Clear stale flag
    analyzedContentHash: generateContentHash(currentBlocks), // Set new hash
  });
  break;
```

---

## 5.4 Update Bullet Suggestions Store on Re-analysis

When ATS is re-run, clear old bullet suggestions since they were based on outdated ATS data:

```typescript
// In the re-analyze handler:
const clearSuggestions = useBulletSuggestionsStore((s) => s.clearSuggestions);

const handleReanalyze = useCallback(async () => {
  // Clear bullet suggestions (based on old ATS data)
  clearSuggestions();

  // Clear ATS state
  resetAnalysis();
  clearStaleFlag();

  // Trigger new analysis
  await runAnalysis({ forceRefresh: true });
}, [clearSuggestions, resetAnalysis, clearStaleFlag, runAnalysis]);
```

---

## Verification

### Phase 5 Verification Checklist

- [ ] Content hash is generated and stored after ATS analysis
- [ ] `contentStale` flag is set when blocks change after analysis
- [ ] Yellow "Score may have changed" indicator appears in header
- [ ] Yellow warning card appears in ATS tab when stale
- [ ] "Re-analyze" button triggers fresh ATS analysis
- [ ] Re-analysis clears the stale flag
- [ ] Re-analysis clears old bullet suggestions
- [ ] Cache is bypassed when re-analyzing (forceRefresh=true)

### Test Scenarios

1. **Stale detection:**
   - Run ATS analysis
   - Edit a bullet point
   - Verify stale indicator appears

2. **Re-analysis flow:**
   - With stale indicator showing
   - Click "Re-analyze"
   - Verify new analysis runs
   - Verify stale indicator clears

3. **Bullet suggestions cleared:**
   - Run ATS analysis
   - Run bullet analysis (get suggestions)
   - Modify a bullet manually
   - Click "Re-analyze ATS"
   - Verify bullet suggestions are cleared

### Test Commands

```bash
# TypeScript check
cd frontend && bun run typecheck

# Run related tests
cd frontend && bun test atsProgressStore
cd frontend && bun test ATSEvaluationTab
```

---

## Summary

Phase 5 completes the feature loop by:

1. **Detecting content changes** after ATS analysis via content hashing
2. **Showing visual feedback** when the ATS score may be stale
3. **Providing re-analysis** capability with cache invalidation
4. **Maintaining consistency** by clearing old suggestions when ATS is re-run

This ensures users always know when their ATS score is current and can easily refresh it after making improvements.
