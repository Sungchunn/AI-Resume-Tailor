# AI Line-by-Line Bullet Editing for Tailored Resume Editor

## Overview

Add intelligent AI-powered suggestions for bullet points in the tailored resume editor (`/tailor/editor/[id]`), leveraging ATS scoring data to provide targeted improvements focused on:

- Clear measurable metrics
- Impact/goal statements
- What the person did and their contribution
- Missing keyword integration

**Scope:**

- Enabled: `/tailor/editor/[id]` (tailored resume editor)
- Disabled: `/library/resumes/[id]/edit` (base resume editor)
- Bullet points in Experience/Projects sections
- Skills section (suggest missing skills from ATS)
- Excluded: Job title, dates, location, Language section

---

## Architecture

```text
TailorEditorPage (/tailor/editor/[id])
└── TailorEditorContext.Provider
    ├── aiAssistantEnabled: true
    ├── jobDescription, jobId, jobListingId
    └── atsContext: { keywordGaps, contentQualityHints }
        └── BlockEditorProvider
            └── EditorLayout
                └── ControlPanel
                    ├── AI Tab: "Analyze Bullets" button
                    │   └── BulletSuggestionsPanel (all suggestions)
                    └── Sections Tab: ExperienceEditor → BulletList
                        └── Inline suggestion indicator per bullet
```

### Trigger Mechanism: Batch Analysis

User clicks "Analyze Bullets" button in AI tab → Backend analyzes ALL bullets across experience/project sections → Returns suggestions for each bullet → User reviews and accepts/rejects individually with Enter/Esc

---

## Phase 1: Context Provider (Foundation)

### New: TailorEditorContext.tsx

**Location:** `/frontend/src/components/tailor/editor/TailorEditorContext.tsx`

**Provides:**

```typescript
interface TailorEditorContextValue {
  aiAssistantEnabled: boolean;
  jobDescription: string | null;
  jobId: number | null;
  jobListingId: string | null;
  atsContext: {
    keywordGaps: KeywordGap[];     // From ATS Stage 2
    contentHints: ContentHints;    // From ATS Stage 3
  } | null;
}
```

**Data sources:**

- `jobDescription` → Fetch from `/api/jobs/{id}` or `/api/job-listings/{id}`
- `atsContext` → Read from `atsProgressStore` (Zustand)

### Modify: Tailor Editor Page

**File:** `/frontend/src/app/(protected)/tailor/editor/[id]/page.tsx`

- Wrap `BlockEditorProvider` with `TailorEditorContext.Provider`
- Fetch job description based on `jobId` or `jobListingId`
- Extract ATS results from store

---

## Phase 2: Backend Endpoint

### New: POST /api/tailor/{id}/analyze-bullets

**File:** `/backend/app/api/routes/tailor/suggestions.py`

Batch endpoint that analyzes ALL bullets in the resume at once.

**Request:**

```json
{
  "bullets": [
    {
      "id": "exp-0:entry-0:bullet-0",
      "text": "Managed team projects",
      "entry_context": { "title": "PM", "company": "Corp", "date_range": "2020-2023" }
    },
    {
      "id": "exp-0:entry-0:bullet-1",
      "text": "Worked on customer issues",
      "entry_context": { "title": "PM", "company": "Corp", "date_range": "2020-2023" }
    }
  ],
  "ats_context": {
    "keyword_gaps": ["Agile", "Scrum", "stakeholder management"],
    "importance_map": { "Agile": "required", "Scrum": "preferred" },
    "content_hints": { "bullets_needing_metrics": ["exp-0:entry-0:bullet-0"] }
  }
}
```

**Response:**

```json
{
  "suggestions": [
    {
      "bullet_id": "exp-0:entry-0:bullet-0",
      "original": "Managed team projects",
      "suggested": "Led 8-person Agile team using Scrum, delivering 15 projects on-time",
      "reason": "Added metrics (8, 15), action verb (Led), keywords (Agile, Scrum)",
      "impact": "high",
      "keywords_added": ["Agile", "Scrum"],
      "metrics_added": true
    },
    {
      "bullet_id": "exp-0:entry-0:bullet-1",
      "original": "Worked on customer issues",
      "suggested": "Resolved 200+ customer escalations, improving satisfaction by 35% through stakeholder management",
      "reason": "Added metrics (200+, 35%), outcome focus, keyword (stakeholder management)",
      "impact": "high",
      "keywords_added": ["stakeholder management"],
      "metrics_added": true
    }
  ],
  "total_analyzed": 2,
  "suggestions_count": 2
}
```

### Modify: SuggestionGenerator

**File:** `/backend/app/services/job/diff/suggestions.py`

Add method `analyze_bullets_batch()` that:

1. Takes array of bullets with entry context
2. Takes ATS context (keyword gaps, content hints)
3. Processes all bullets in single LLM call (or batched calls if >10)
4. Returns suggestions array with bullet_id mapping
5. Tracks AI usage metrics

### New: ATS-Aware Batch Prompt

**File:** `/backend/app/services/job/diff/prompts_ats.py`

Prompt analyzes multiple bullets at once, focusing on:

- MEASURABLE IMPACT: Add specific numbers, percentages
- WHAT + HOW + IMPACT: Structure as "Did X using Y, resulting in Z"
- KEYWORD INTEGRATION: Distribute missing keywords across bullets naturally
- ACTION VERBS: Start with strong verbs (Led, Architected, Optimized)
- PRIORITIZATION: Mark high-impact suggestions for bullets most needing improvement

---

## Phase 3: Bullet Point UI

### New: BulletSuggestionsPanel.tsx

**File:** `/frontend/src/components/tailor/editor/BulletSuggestionsPanel.tsx`

Main panel in AI tab showing all bullet suggestions:

- "Analyze Bullets" button at top (triggers batch analysis)
- Loading state with skeleton cards during analysis
- List of suggestion cards grouped by experience entry
- Each card shows: original → suggested, reason, impact badge, keywords_added pills
- Accept (Enter) / Reject (Esc) buttons per suggestion
- "Accept All" / "Reject All" bulk actions
- Empty state when no suggestions or not yet analyzed

### New: useBulletAnalysis.ts

**File:** `/frontend/src/hooks/useBulletAnalysis.ts`

Hook for batch bullet analysis:

```typescript
interface UseBulletAnalysisReturn {
  suggestions: BulletSuggestion[];
  isAnalyzing: boolean;
  error: string | null;
  analyze: () => Promise<void>;        // Trigger analysis
  acceptSuggestion: (id: string) => void;
  rejectSuggestion: (id: string) => void;
  acceptAll: () => void;
  rejectAll: () => void;
  clearSuggestions: () => void;
}
```

- Collects all bullets from current resume blocks
- Calls `POST /api/tailor/{id}/analyze-bullets`
- Stores suggestions in local state (or Zustand store for persistence)
- On accept: updates bullet in BlockEditorProvider, removes suggestion
- On reject: removes suggestion only

### Modify: BulletList.tsx

**File:** `/frontend/src/components/library/editor/blocks/shared/BulletList.tsx`

Minimal changes:

1. Accept optional `suggestionForBullet?: BulletSuggestion` prop
2. Show subtle indicator (sparkle icon) on bullets with pending suggestions
3. Clicking indicator scrolls AI tab into view / focuses suggestion card

### New: BulletSuggestionCard.tsx

**File:** `/frontend/src/components/tailor/editor/BulletSuggestionCard.tsx`

Individual suggestion card:

- Shows entry context (job title @ company)
- Original text with strikethrough
- Suggested text highlighted
- Reason explanation
- Impact badge (high=red, medium=yellow, low=blue)
- Keywords added as pills
- Accept / Reject buttons
- Keyboard: Enter to accept, Esc to reject when focused

### Accept Flow

1. User clicks "Analyze Bullets" in AI tab
2. Backend analyzes all bullets, returns suggestions
3. Suggestions displayed in panel, bullets show indicators
4. User reviews each suggestion:
   - Click Accept → Bullet updates, suggestion removed
   - Click Reject → Suggestion removed, bullet unchanged
5. "Accept All" applies all remaining suggestions
6. After all processed, panel shows "All suggestions reviewed" state

---

## Phase 4: Skills Suggestions

### New: SkillSuggestionsPanel.tsx

**File:** `/frontend/src/components/tailor/editor/SkillSuggestionsPanel.tsx`

- Shows in AI tab when in tailor mode
- Lists missing skills from ATS `gap_list` (Stage 2)
- Displays importance badges (required/preferred/nice-to-have)
- Single-click to add skill to resume
- Shows `in_vault` indicator for skills user already has elsewhere

### Modify: SkillsEditor.tsx

**File:** `/frontend/src/components/library/editor/blocks/SkillsEditor.tsx`

- Accept callback to add skills from suggestions panel
- Animate newly added skills

---

## Phase 5: Re-scoring Integration

### Add "Re-analyze" Button

When content changes after ATS analysis:

1. Show "Score may have changed" indicator
2. Add "Re-analyze" button to trigger fresh ATS analysis
3. Invalidate ATS cache when triggering re-analysis

---

## Key Files Summary

| Action | File |
| ------ | ---- |
| Create | `/frontend/src/components/tailor/editor/TailorEditorContext.tsx` |
| Create | `/frontend/src/components/tailor/editor/BulletSuggestionsPanel.tsx` |
| Create | `/frontend/src/components/tailor/editor/BulletSuggestionCard.tsx` |
| Create | `/frontend/src/components/tailor/editor/SkillSuggestionsPanel.tsx` |
| Create | `/frontend/src/hooks/useBulletAnalysis.ts` |
| Create | `/backend/app/api/routes/tailor/suggestions.py` |
| Create | `/backend/app/services/job/diff/prompts_ats.py` |
| Modify | `/frontend/src/app/(protected)/tailor/editor/[id]/page.tsx` |
| Modify | `/frontend/src/components/library/editor/blocks/shared/BulletList.tsx` |
| Modify | `/frontend/src/components/library/editor/tabs/AIChatTab.tsx` |
| Modify | `/frontend/src/components/library/editor/blocks/SkillsEditor.tsx` |
| Modify | `/backend/app/services/job/diff/suggestions.py` |

---

## Verification Plan

1. **Manual Testing:**
   - Navigate to `/tailor/editor/{id}` with a tailored resume that has ATS analysis
   - Open AI tab, click "Analyze Bullets" button
   - Verify loading state shows during analysis
   - Verify suggestions appear for multiple bullets
   - Check each suggestion shows: original, suggested, reason, impact, keywords_added
   - Click Accept on one suggestion → verify bullet updates in Sections tab
   - Click Reject on another → verify bullet unchanged
   - Test "Accept All" button
   - Verify bullets in Sections tab show suggestion indicators
   - Check Skills panel shows missing skills from ATS gaps
   - Add a skill, verify it appears in skills section

2. **Unit Tests:**
   - Backend: Test `analyze_bullets_batch()` returns proper format with multiple bullets
   - Backend: Test prompt includes keyword gaps and content hints
   - Frontend: Test `useBulletAnalysis` hook accept/reject behavior

3. **E2E Tests (Playwright):**
   - Test full batch analysis flow
   - Test skill suggestion acceptance
   - Test bulk accept/reject actions

4. **Verify Disabled for Library Editor:**
   - Navigate to `/library/resumes/{id}/edit`
   - Confirm AI tab does NOT show "Analyze Bullets" button
   - Confirm no skill suggestions panel appears
