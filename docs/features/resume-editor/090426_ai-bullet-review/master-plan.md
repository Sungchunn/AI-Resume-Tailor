# AI Review: Line-by-Line Bullet Editing with ATS Feedback Loop

## Context

The `060426_ai-bullet-editing` feature is **fully implemented** as a panel-based card system. Backend endpoint (`POST /v1/tailor/{id}/analyze-bullets`), `BulletAnalyzer` service, Zustand store, and UI components all exist and work. However, the user experience is "review all cards at once" rather than the intended sequential "step through suggestions one at a time."

The user previously tried to implement a sequential review flow but it never worked behaviorally. The goal is to transform the existing batch-card UI into a sequential AI review flow where:

1. Suggestions are presented ONE AT A TIME
2. The target bullet is highlighted inline with a diff overlay
3. User presses Enter to accept, Esc to skip, auto-advancing through suggestions
4. After review completes, ATS re-scores to show the improvement

**Existing infrastructure to reuse:**

- `bulletSuggestionsStore.ts` - Zustand store with suggestions, accept/reject actions
- `useBulletAnalysis.ts` - Hook for analysis trigger and accept/reject logic
- `BulletSuggestionsPanel.tsx` - Panel UI (will be modified for AI review mode)
- `BulletSuggestionCard.tsx` - Card component (will be adapted)
- `BulletList.tsx` - Bullet rendering with suggestion indicators
- `atsProgressStore.ts` - Has `contentStale` and `analyzedContentHash`
- `ats/analyze-content` endpoint - Synchronous content-based ATS scoring
- `useScoreCalculation.ts` (Workshop hook) - Pattern for debounced re-scoring

---

## Design Decisions

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| Diff location | **Inline on bullet row** | Diff overlay appears below targeted bullet in editor. Sequential review experience. |
| ATS re-score timing | **After AI review completes** | Single API call after all suggestions reviewed. Shows before/after delta. |
| ATS tab re-scoring | **Manual trigger button** | User clicks "Re-analyze" button. No auto-scoring on tab open. Controls AI costs. |
| AI review entry | **Automatic after analysis** | Suggestions auto-enter AI review mode. User can exit to see all cards. |
| Keyboard capture | **Global listener in AI review mode** | Enter=accept, Esc=skip. Prevents BulletList Enter from creating new bullets. |

---

## Phase Summary

| Phase | Focus | Details |
| ----- | ----- | ------- |
| 1 | Store: AI review mode state | [phase-1.md](./phase-1.md) |
| 2 | Panel: Sequential AI review UI | [phase-2.md](./phase-2.md) |
| 3 | Inline: Diff overlay on BulletList | [phase-3.md](./phase-3.md) |
| 4 | Keyboard: Global handler for AI review | [phase-4.md](./phase-4.md) |
| 5 | ATS: Re-scoring feedback loop | [phase-5.md](./phase-5.md) |

---

## Files to Modify

| File | Changes |
| ---- | ------- |
| `frontend/src/lib/stores/bulletSuggestionsStore.ts` | Add AI review mode state + navigation actions |
| `frontend/src/hooks/useBulletAnalysis.ts` | Add AI review keyboard handler, ATS re-score logic |
| `frontend/src/components/tailor/editor/BulletSuggestionsPanel.tsx` | AI review sequential view + completion summary |
| `frontend/src/components/library/editor/blocks/shared/BulletList.tsx` | Inline diff overlay + visual highlight |
| `frontend/src/components/library/editor/blocks/ExperienceEditor.tsx` | Pass AI review suggestion to BulletList |
| `frontend/src/components/library/editor/blocks/ProjectsEditor.tsx` | Pass AI review suggestion to BulletList |
| `frontend/src/components/library/editor/tabs/ATSEvaluationTab.tsx` | Add manual "Re-analyze" button, remove auto-score trigger |

## Files to Create

| File | Purpose |
| ---- | ------- |
| `frontend/src/components/tailor/editor/AiReviewDiffOverlay.tsx` | Inline diff display below targeted bullet |

---

## Data Flow

```text
User clicks "Analyze Bullets"
  -> Capture preAnalysisScore from atsProgressStore
  -> Backend returns suggestions
  -> Enter AI review mode (sequential review)
  -> User reviews each: Enter=accept, Esc=skip
  -> After all reviewed:
    -> If acceptedCount > 0:
      -> Call POST /ats/analyze-content with current blocks
      -> Show score delta in completion summary
      -> Mark atsProgressStore.contentStale = true
    -> Show completion summary
  -> User can then go to ATS tab and click "Re-analyze" for full scoring
```

---

## Verification

### Manual Testing Checklist

1. Navigate to `/tailor/editor/{id}`, run ATS analysis
2. Click "Analyze Bullets" in AI tab
3. Verify AI review mode starts automatically with first suggestion focused
4. Verify the target bullet in the editor has a blue highlight + diff overlay below it
5. Press Enter -> bullet text updates, advances to next suggestion
6. Press Esc -> bullet unchanged, advances to next
7. After all reviewed -> verify completion summary with score delta
8. Verify ATS re-score triggers and shows before/after
9. Go to ATS tab -> verify "Re-analyze" button appears (no auto-score)

### Edge Cases

- Resume with 0 bullets -> "No bullets found" message
- All bullets already good -> "Your bullets look great!" (no AI review)
- Only 1 suggestion -> AI review still works, completes immediately after review
- User exits AI review early -> remaining suggestions stay as pending cards
- ATS re-score fails -> show error toast, still show accepted count

### Test Commands

```bash
cd frontend && bun run typecheck
cd frontend && bun test bulletSuggestionsStore
cd frontend && bun test useBulletAnalysis
```
