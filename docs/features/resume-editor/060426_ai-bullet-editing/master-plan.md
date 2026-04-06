# AI Line-by-Line Bullet Editing for Tailored Resume Editor

## Overview

Add AI-powered bullet point suggestions to the tailored resume editor (`/tailor/editor/[id]`), leveraging ATS analysis data to provide targeted improvements focused on:

- Measurable metrics and quantification
- Action verbs and impact statements
- Missing keyword integration from ATS gaps
- Skills suggestions from ATS gap analysis

**Scope:**

| Enabled | Disabled |
| ------- | -------- |
| `/tailor/editor/[id]` (tailored resume editor) | `/library/resumes/[id]/edit` (base resume editor) |
| Experience bullets | Job title, dates, location |
| Projects bullets | Languages section |
| Skills section (gap suggestions) | |

---

## Architecture

```text
TailorEditorPage (/tailor/editor/[id])
└── TailorEditorContext.Provider (NEW)
    ├── aiAssistantEnabled: true
    ├── jobDescription, jobId, jobListingId
    ├── atsContext: { keywordGaps, contentQualityHints }
    └── bulletSuggestionsStore (Zustand - NEW)
        └── BlockEditorProvider
            └── EditorLayout
                └── ControlPanel
                    ├── AI Tab (MODIFIED)
                    │   ├── "Analyze Bullets" button
                    │   ├── BulletSuggestionsPanel (NEW)
                    │   └── SkillSuggestionsPanel (NEW)
                    └── Sections Tab: BulletList (MODIFIED - indicators)
```

### Trigger Mechanism

User clicks "Analyze Bullets" button in AI tab (manual only) -> Backend analyzes ALL bullets across experience/project sections -> Returns suggestions for each bullet -> User reviews and accepts/rejects individually with Enter/Esc

**Prerequisite:** ATS analysis must be completed first. Feature is blocked until ATS data is available.

---

## Design Decisions

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| Suggestion persistence | **Ephemeral** | Cleared on refresh. User can re-analyze anytime. Simpler state. |
| Analysis trigger | **Manual only** | User clicks "Analyze Bullets". Gives control over AI costs. |
| Save behavior | **Immediate auto-save** | Each accepted suggestion saves immediately. Matches editor pattern. |
| ATS dependency | **Required prerequisite** | Must run ATS analysis first. Ensures keyword-aware suggestions. |

---

## Phase Summary

| Phase | Focus | New Files | Modified Files | Details |
| ----- | ----- | --------- | -------------- | ------- |
| 1 | Context & State Foundation | 2 | 1 | [phase-1.md](./phase-1.md) |
| 2 | Backend Endpoint + Service | 3 | 1 | [phase-2.md](./phase-2.md) |
| 3 | Bullet Suggestions UI | 4 | 2 | [phase-3.md](./phase-3.md) |
| 4 | Skills Suggestions UI | 1 | 1 | [phase-4.md](./phase-4.md) |
| 5 | Polish & Re-scoring | 0 | 2 | [phase-5.md](./phase-5.md) |

---

## Key Files Summary

### Files to Create

| File | Purpose |
| ---- | ------- |
| `frontend/src/components/tailor/editor/TailorEditorContext.tsx` | Tailor-specific context with job data and ATS context |
| `frontend/src/lib/stores/bulletSuggestionsStore.ts` | Zustand store for ephemeral suggestion state |
| `frontend/src/hooks/useBulletAnalysis.ts` | Hook for triggering analysis and managing suggestions |
| `frontend/src/components/tailor/editor/BulletSuggestionsPanel.tsx` | Main panel in AI tab with suggestions list |
| `frontend/src/components/tailor/editor/BulletSuggestionCard.tsx` | Individual suggestion card with accept/reject |
| `frontend/src/components/tailor/editor/SkillSuggestionsPanel.tsx` | Missing skills panel from ATS gaps |
| `backend/app/api/routes/tailor/suggestions.py` | API endpoint for bullet analysis |
| `backend/app/services/job/diff/bullet_analyzer.py` | Service for batch bullet analysis |
| `backend/app/services/job/diff/prompts_ats.py` | ATS-aware prompts for bullet improvement |

### Files to Modify

| File | Changes |
| ---- | ------- |
| `frontend/src/app/(protected)/tailor/editor/[id]/page.tsx` | Wrap with TailorEditorContext |
| `frontend/src/components/library/editor/tabs/AIChatTab.tsx` | Add BulletSuggestionsPanel in tailor mode |
| `frontend/src/components/library/editor/blocks/shared/BulletList.tsx` | Add suggestion indicators |
| `frontend/src/components/library/editor/blocks/SkillsEditor.tsx` | Accept onAddSkill callback |
| `frontend/src/components/library/editor/tabs/ATSEvaluationTab.tsx` | Add re-analyze button |
| `backend/app/api/routes/tailor/__init__.py` | Register suggestions router |

---

## Error Handling

| Scenario | Handling |
| -------- | -------- |
| No ATS analysis run | **Block feature**: Show "Run ATS analysis first" with link to ATS tab |
| No bullets in resume | Show empty state: "Add experience bullets to analyze" |
| API timeout | Retry with exponential backoff (max 2 retries) |
| API error | Toast notification + "Try Again" button |
| All bullets already good | Show success: "Your bullets look great!" |
| Partial failure | Show successful suggestions, log errors |

---

## Verification Plan

### Manual Testing Checklist

1. **Setup:**
   - Navigate to `/tailor/editor/{id}` with a tailored resume
   - Run ATS analysis first (required)

2. **Analyze Bullets:**
   - [ ] Verify feature is blocked before ATS analysis
   - [ ] Click "Analyze Bullets" in AI tab
   - [ ] Verify loading skeleton shows during analysis
   - [ ] Verify suggestions appear grouped by experience entry
   - [ ] Check each suggestion shows: original, suggested, reason, impact, keywords

3. **Accept/Reject Flow:**
   - [ ] Click Accept on one suggestion -> bullet updates in Sections tab
   - [ ] Click Reject on another -> bullet unchanged
   - [ ] Verify keyboard shortcuts (Enter/Esc) work
   - [ ] Test "Accept All" / "Reject All" buttons
   - [ ] Verify "All reviewed" state shows after completing all

4. **Bullet Indicators:**
   - [ ] Verify sparkle icons appear on bullets with pending suggestions
   - [ ] Click indicator scrolls to suggestion card

5. **Skills Suggestions:**
   - [ ] Verify missing skills panel shows ATS gap keywords
   - [ ] Click Add -> skill appears in Skills section
   - [ ] Verify importance badges display correctly

6. **Edge Cases:**
   - [ ] Test with resume that has no experience bullets
   - [ ] Test with already-excellent bullets (expect "looks great" message)

7. **Library Editor (Negative Test):**
   - [ ] Navigate to `/library/resumes/{id}/edit`
   - [ ] Confirm "Analyze Bullets" button does NOT appear
   - [ ] Confirm no skill suggestions panel

### Unit Tests

**Backend:**

- `test_analyze_bullets_returns_valid_format`
- `test_analyze_bullets_filters_unchanged`
- `test_prompt_includes_keyword_gaps`
- `test_batching_strategy_for_large_resumes`
- `test_metrics_logged_correctly`

**Frontend:**

- `test_useBulletAnalysis_hook_accept_updates_store`
- `test_suggestion_card_keyboard_navigation`
- `test_panel_empty_states`

### E2E Tests (Playwright)

- Full analyze -> accept -> verify bullet changed flow
- Bulk accept all suggestions
- Skills suggestion add flow
