# ATS Panel Integration - Master Plan

**Created:** 2026-03-07
**Session:** 4 - ATS Scoring Placement & Integration
**Status:** Planning

---

## Overview

Integrate ATS scoring results into the workshop as a **4th tab** with a **persistent score badge** in the header. Use **manual re-analysis with staleness indicators** to respect rate limits while keeping users informed when scores become outdated.

---

## Problem Statement

1. **ATS results surface but aren't actionable** - users see a score with no clear next step
2. **Keyword selection happens before tailoring but can't be revisited mid-edit**
3. **Score goes stale after edits with no indication it needs refreshing**
4. **No visual hierarchy** answering: *What's my score? What am I missing? How do I fix it?*
5. **Cache staleness isn't communicated** - users may act on outdated results

---

## Key Decisions

| Question | Decision | Rationale |
| -------- | -------- | --------- |
| **Placement** | 4th tab + header badge | Matches existing 3-tab pattern; mobile-compatible |
| **Refresh strategy** | Manual with staleness indicator | Rate limit safety (30/min AI); backend caches 24h anyway |
| **Cache invalidation** | Mark stale on content/suggestion changes | Not on style changes (formatting doesn't affect ATS) |
| **Missing keywords** | Both "Insert" (from vault) + "Add to Vault" (missing) | Maintains vault integrity; inline actions preferred |
| **Competitor comparison** | Deferred | Out of scope for this session |

---

## Architecture

### Panel Hierarchy

```text
ATS Tab (4th tab in WorkshopControlPanel)
├── ATSScoreSummary (always visible)
│   ├── Composite score gauge (0-100)
│   ├── Stale indicator (yellow badge if outdated)
│   └── "Re-analyze" button
│
├── KnockoutAlerts (if risks detected)
│   └── Risk cards with severity (hard/soft)
│
├── StageBreakdown (collapsible, expanded by default)
│   ├── Structure (15%)
│   ├── Keywords (40%)
│   ├── Content Quality (25%)
│   └── Role Proximity (20%)
│
└── KeywordAnalysis (collapsible, expanded by default)
    ├── Coverage indicators
    ├── Required keywords (critical)
    ├── Preferred keywords (important)
    └── Nice-to-have (collapsed)
```

### Header Badge Behavior

| State | Appearance |
| ----- | ---------- |
| Fresh score | Green badge: "ATS: 78" |
| Stale score | Yellow badge + clock icon: "ATS: 78 (stale)" |
| Knockout risk | Red badge + warning icon |
| Analyzing | Pulsing animation |

---

## Implementation Phases

| Phase | Description | Complexity | Files |
| ----- | ----------- | ---------- | ----- |
| 1 | State Foundation | Medium | 2-3 files |
| 2 | Core ATS Panel | Medium | 5-6 files |
| 3 | Knockout & Keywords | High | 4-5 files |
| 4 | Header Integration | Low | 2 files |
| 5 | Polish & Mobile | Low | Updates only |

See phase-specific documents for detailed implementation steps.

---

## Files Summary

### Files to Create

| File | Purpose |
| ---- | ------- |
| `panels/ats/ATSPanel.tsx` | Main tab container |
| `panels/ats/ATSScoreSummary.tsx` | Score gauge + re-analyze button |
| `panels/ats/StageBreakdown.tsx` | 5-stage score bars |
| `panels/ats/StageScoreBar.tsx` | Individual stage visualization |
| `panels/ats/KnockoutAlerts.tsx` | Critical risk warnings |
| `panels/ats/KeywordAnalysis.tsx` | Keyword coverage section |
| `panels/ats/KeywordSection.tsx` | Per-importance keyword group |
| `panels/ats/KeywordChip.tsx` | Matched/missing chip with actions |
| `panels/ats/InsertKeywordModal.tsx` | Section selector for insertion |
| `hooks/useATSProgressiveAnalysis.ts` | SSE connection hook |
| `hooks/useATSStaleness.ts` | Content hash comparison |
| `ScoreDisplay/ATSScoreBadge.tsx` | Header badge component |

### Files to Modify

| File | Changes |
| ---- | ------- |
| `WorkshopContext.tsx` | Add ATS state fields, actions, reducer cases |
| `WorkshopControlPanel.tsx` | Add 4th tab to TABS array, render ATSPanel |
| `WorkshopHeader.tsx` | Add ATS score badge |
| `panels/index.ts` | Export ATSPanel |

---

## API Dependencies

| Endpoint | Purpose | Rate Limit |
| -------- | ------- | ---------- |
| `POST /v1/ats/analyze-progressive` | SSE streaming for 5-stage analysis | Default (60/min) |
| `POST /v1/ats/knockout-check` | Quick knockout-only check | Default |

Both endpoints use Redis caching with 24h TTL and content hash for staleness detection.

---

## Verification Checklist

- [ ] ATS tab appears as 4th option in WorkshopControlPanel
- [ ] Score gauge displays composite score (0-100)
- [ ] Stage breakdown shows 5 stages with correct weights
- [ ] Knockout alerts appear prominently when risks detected
- [ ] "Re-analyze" button triggers SSE progressive analysis
- [ ] Stale indicator appears after content edits
- [ ] Header badge shows score with staleness/knockout indicators
- [ ] Keyword chips show insert action for vault-backed skills
- [ ] Missing keywords show "Add to Vault" action
- [ ] Insert modal lets user choose target section
- [ ] Mobile bottom sheet renders correctly with 4th tab
- [ ] SSE connection handles cache hits (fast playback)
- [ ] Error states display with retry option

---

## Dependencies

- **Session 1 (Tailor Flow):** None blocking - ATS works on existing tailored resumes
- **Session 3 (Panel Consolidation):** Completed - Style panel pattern available for reference
- **Backend ATS endpoints:** Fully implemented, ready to integrate

---

## Out of Scope (Deferred)

- Competitor comparison ("your score vs average applicant")
- Auto-refresh on edit (rate limit concerns)
- AI suggestion generation from keyword gaps
- Deep linking from keyword to specific experience bullet

---

## Document Index

| Document | Purpose |
| -------- | ------- |
| `070326_master-plan.md` | This document - overall architecture |
| `070326_phase1-state-management.md` | State foundation implementation |
| `070326_phase2-core-panel.md` | Core ATS panel components |
| `070326_phase3-keyword-actions.md` | Keyword insertion and vault integration |
