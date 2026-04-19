# Keyword-Guided Inline Suggestions

**Date:** 2026-04-19
**Group:** `resume-editor/ai-suggestions`
**Status:** Implemented

---

## Context

The tailor flow previously had a "Review Keywords" step (step 3) between Analyze Match and the editor. Users could edit extracted keywords before proceeding. This step was:

1. **Disconnected from ATS scoring** — keyword overrides were saved to MongoDB but `helpers.py:execute_keyword_analysis` re-extracted keywords from the job description directly, ignoring overrides.
2. **Friction without value** — users had to stop at an extra page before reaching the editor, where the real work happens.
3. **Unactionable** — confirming keywords didn't trigger any AI action. The bullet suggestions ("Analyze Bullets") still ran against all keywords regardless of what was confirmed.

---

## What Changed

### Step 3 Removed from Tailor Flow

The stepper now has 3 steps instead of 4:
`Select Resume → Analyze Match → Review & Edit`

After ATS analysis completes on the analyze page, "Continue" goes directly to the editor with `?jobListingId=N` in the URL. The `/tailor/keywords/[id]` page is now unreachable from the flow (kept in source for history).

### Keyword Intent UI in the ATS Tab

Missing keywords in the ATS tab are now **clickable**. Clicking a keyword:
- Marks it as "selected" (teal highlight + check icon)
- Adds it to a "Selected Keywords" panel below the keyword tiers

The Selected Keywords panel shows each selected keyword with a **section dropdown** — the user explicitly assigns the keyword to a specific experience entry or project entry. This is the truthfulness gate: the user is saying "I believe this keyword applies to my work at Company X."

### Run Keyword Suggestions

Once at least one keyword is assigned to a section, a **"Run Keyword Suggestions"** button appears. Clicking it:
1. Filters resume bullets to only those in the assigned sections
2. Sends targeted `keyword_assignments` to `POST /api/v1/ats/analyze-bullets`
3. Backend generates suggestions only for those bullets, focused on those specific keywords
4. Suggestions appear in the existing `BulletSuggestionDropdown` on the preview

The AI is already instructed not to fabricate experience ("Preserve the core meaning - don't invent achievements"). If a keyword truly doesn't fit the assigned bullets, the AI returns no suggestion for those bullets.

**No auto-trigger** — suggestions never run automatically.

---

## Truthfulness Design

Random keyword insertion is a trust problem. The two-layer solution:

1. **User layer:** the user assigns keywords to sections they know are relevant. They own the truthfulness gate.
2. **AI layer:** the existing system prompt already instructs "Preserve the core meaning — don't invent achievements or exaggerate." If AI can't incorporate a keyword naturally, it skips that bullet.

---

## Key Files

| File | Role |
| ---- | ---- |
| `frontend/src/lib/stores/keywordAssignmentStore.ts` | Session-state store for keyword selection + section assignments |
| `frontend/src/hooks/useKeywordTargetedSuggestions.ts` | Hook that filters bullets, builds request, populates suggestion queue |
| `frontend/src/components/library/editor/tabs/ATSEvaluationTab.tsx` | Keyword chip clickability + Selected Keywords panel + Run button |
| `frontend/src/components/tailoring/TailorFlowStepper.tsx` | 3-step stepper (keywords step removed) |
| `frontend/src/app/(protected)/tailor/analyze/page.tsx` | Navigates directly to editor for job listing flows |
| `backend/app/schemas/tailor/suggestions.py` | `KeywordAssignmentInput` + `keyword_assignments` on `BulletAnalysisRequest` |
| `backend/app/api/routes/ats/bullets.py` | Targeted bullet filtering + context when `keyword_assignments` provided |

---

## Data Flow

```text
ATS analysis runs (progressive SSE)
       ↓
atsProgressStore.keywordAnalysisResult populated
       ↓
ATSEvaluationTab shows Required / Preferred / Nice-to-Have keywords
       ↓
User clicks missing keyword → selected (teal chip)
       ↓
User picks section from dropdown → assigned (sectionId stored)
       ↓
User clicks "Run Keyword Suggestions"
       ↓
useKeywordTargetedSuggestions:
  - filters bullets to assigned sections
  - calls POST /ats/analyze-bullets with keyword_assignments
       ↓
bullets.py:
  - filters bullets by section_id prefix
  - builds targeted ATSContextInput with only assigned keywords
  - calls BulletAnalyzer.analyze_batch
       ↓
BulletSuggestionDropdown appears on targeted bullets in preview
       ↓
User reviews via Tab/Enter keyboard flow (existing behavior)
```

---

## Backward Compatibility

- General "Analyze Bullets" (from `SuggestionProgressPanel`) is unchanged — still analyzes all bullets against all missing keywords.
- `BulletAnalysisRequest.keyword_assignments` is optional — the backend behaves exactly as before when absent.
- `inlineSuggestionQueueStore` and `BulletSuggestionDropdown` are untouched; suggestions from keyword mode flow through the same queue.
