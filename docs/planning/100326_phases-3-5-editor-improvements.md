# Phases 3-5: Editor Flow Improvements

**Date:** 2026-03-10
**Status:** Ready for Implementation
**Prerequisite:** Phases 1-2 completed (Backend Parser + Frontend Section Support)

---

## Overview

| Phase | Scope | Description |
| ----- | ----- | ----------- |
| Phase 3 | Verify Step | Add missing section editors, field editing, scroll UX |
| Phase 4 | ATS Analysis | Display knockout risks, populate keyword panel |
| Phase 5 | Real-time + AI | Auto-save, content quality metrics, AI suggestions |

**Blocking Issue:** Leadership field name mismatch (`role` in backend models, `title` expected everywhere else) - see Phase 3.0.

---

## Current State Analysis

### What's Built

| Step | Page | Status |
| ---- | ---- | ------ |
| Step 2: Analyze | `/tailor/analyze` | 90% - ATS works, UI incomplete |
| Step 3: Verify | `/tailor/verify/[id]` | 40% - Only 6/16 sections editable |
| Step 4: Editor | `/tailor/editor/[id]` | 80% - Works, needs auto-save + AI |

### ATS Backend Capabilities (Already Built)

| Stage | Purpose | Score Weight |
| ----- | ------- | ------------ |
| 0: Knockout | Binary disqualifiers | Pass/Fail |
| 1: Structure | ATS parsing compatibility | 15% |
| 2: Keywords | Placement-weighted matching | 40% |
| 3: Content Quality | Bullet quantification, action verbs | 25% |
| 4: Role Proximity | Career fit analysis | 20% |

---

## Phase 3.0: Leadership Field Fix (Prerequisite)

**Problem:** Field name mismatch between parser and MongoDB/API schemas.

| File | Current | Should Be |
| ---- | ------- | --------- |
| `parser.py` Leadership TypedDict | `title` | `title` |
| `resume.py` LeadershipEntry | `role` | `title` |
| `tailor.py` LeadershipEntrySchema | `role` | `title` |
| `TAILORING_SYSTEM_PROMPT` | `title` | `title` |
| Frontend TailoredContent | `title` | `title` |

### Files to Modify

**File 1:** `backend/app/models/mongo/resume.py`

```python
class LeadershipEntry(BaseModel):
    """Leadership experience entry in parsed resume."""

    id: str | None = None
    title: str | None = None  # Changed from 'role'
    organization: str | None = None
    location: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    description: str | None = None
    bullets: list[str] = Field(default_factory=list)
```

**File 2:** `backend/app/schemas/tailor.py`

```python
class LeadershipEntrySchema(BaseModel):
    """Leadership experience entry in parsed resume."""

    id: str | None = None
    title: str | None = None  # Changed from 'role'
    organization: str | None = None
    location: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    description: str | None = None
    bullets: list[str] = []
```

**Commit:** `backend: align leadership field name 'role' -> 'title'`

---

## Phase 3: Verify Step Improvements

**Goal:** Enable editing of all 16 section types in the verify step.

### 3.1 Current Section Support

| Section | ContentEditor | Status |
| ------- | ------------- | ------ |
| summary | SummarySection | Working |
| experience | ExperienceSection | Working |
| education | EducationSection | Missing: minor, relevant_courses |
| skills | SkillsSection | Working |
| certifications | - | Not implemented |
| projects | ProjectsSection | Missing: start_date, end_date |
| languages | - | Not implemented |
| volunteer | - | Not implemented |
| publications | - | Not implemented |
| awards | - | Not implemented |
| interests | - | Not implemented |
| references | - | Not implemented |
| courses | - | Not implemented |
| memberships | - | Not implemented |
| leadership | - | Not implemented |

### 3.2 Files to Modify

**Primary File:** `frontend/src/app/(protected)/tailor/verify/[id]/components/ContentEditor.tsx`

**Supporting Components (create or modify):**

```text
frontend/src/app/(protected)/tailor/verify/[id]/components/sections/
├── SummarySection.tsx          # Existing
├── ExperienceSection.tsx       # Existing
├── EducationSection.tsx        # Existing - add minor, relevant_courses
├── SkillsSection.tsx           # Existing
├── ProjectsSection.tsx         # Existing - add start_date, end_date
├── CertificationsSection.tsx   # NEW
├── LanguagesSection.tsx        # NEW
├── VolunteerSection.tsx        # NEW
├── PublicationsSection.tsx     # NEW
├── AwardsSection.tsx           # NEW
├── InterestsSection.tsx        # NEW
├── ReferencesSection.tsx       # NEW
├── CoursesSection.tsx          # NEW
├── MembershipsSection.tsx      # NEW
└── LeadershipSection.tsx       # NEW
```

### 3.3 Section Implementation Priority

**Priority 1 (High Impact):**

1. **LanguagesSection** - Common on resumes
2. **CertificationsSection** - Already structured in backend
3. **LeadershipSection** - Similar to experience

**Priority 2 (Medium Impact):**

1. **VolunteerSection** - Similar to experience
2. **AwardsSection** - Simple list with dates
3. **PublicationsSection** - Academic resumes

**Priority 3 (Lower Impact):**

1. **InterestsSection** - Simple text field
2. **ReferencesSection** - Simple contact list
3. **CoursesSection** - Simple list
4. **MembershipsSection** - Simple list with dates

### 3.4 Section Component Patterns

**Entry-based sections** (experience, education, volunteer, leadership, etc.):

```tsx
interface EntryEditorProps<T> {
  entries: T[];
  onChange: (entries: T[]) => void;
  entryRenderer: (entry: T, index: number, onUpdate: (entry: T) => void) => ReactNode;
}
```

**Simple list sections** (certifications, awards, courses):

```tsx
interface SimpleListProps {
  items: ItemType[];
  onChange: (items: ItemType[]) => void;
  fields: Array<{ key: string; label: string; type: 'text' | 'date' }>;
}
```

**Text field sections** (interests):

```tsx
interface TextSectionProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}
```

### 3.5 Education Section Updates

Add missing field editing:

```tsx
// In EducationSection.tsx

// Add minor field
<input
  value={entry.minor || ""}
  onChange={(e) => updateEntry(index, { ...entry, minor: e.target.value })}
  placeholder="Minor (optional)"
  className="input-field"
/>

// Add relevant_courses field
<TagInput
  tags={entry.relevant_courses || []}
  onChange={(courses) => updateEntry(index, { ...entry, relevant_courses: courses })}
  placeholder="Add relevant course..."
/>
```

### 3.6 Projects Section Updates

Add date fields:

```tsx
// In ProjectsSection.tsx

<div className="flex gap-2">
  <input
    type="text"
    value={entry.start_date || ""}
    onChange={(e) => updateEntry(index, { ...entry, start_date: e.target.value })}
    placeholder="Start date"
    className="input-field w-1/2"
  />
  <input
    type="text"
    value={entry.end_date || ""}
    onChange={(e) => updateEntry(index, { ...entry, end_date: e.target.value })}
    placeholder="End date"
    className="input-field w-1/2"
  />
</div>
```

### 3.7 Testing Checklist

- [ ] All 16 sections render in ContentEditor
- [ ] Adding/removing entries works for all entry-based sections
- [ ] Education minor field saves and persists
- [ ] Education relevant_courses saves and persists
- [ ] Projects dates save and persist
- [ ] Leadership entries use `title` field (not `role`)
- [ ] Changes detected correctly for all sections
- [ ] Save button only appears when dirty

---

## Phase 4: ATS Analysis Improvements

**Goal:** Display ATS analysis results and populate keyword selection with real data.

### 4.1 Current Gaps

| Feature | Backend | Frontend |
| ------- | ------- | -------- |
| Knockout risk detection | Implemented | Not displayed |
| Keyword coverage score | Calculated | Not shown |
| Matched keywords list | Available | Not extracted |
| Missing keywords list | Available | Not extracted |
| Stage breakdown scores | Calculated | Not visualized |

### 4.2 Files to Modify

**Primary Files:**

1. `frontend/src/app/(protected)/tailor/analyze/page.tsx`
2. `frontend/src/components/tailoring/KeywordSelectionPanel.tsx`

**New Components:**

1. `frontend/src/components/tailoring/KnockoutRiskBanner.tsx`
2. `frontend/src/components/tailoring/ATSScoreBreakdown.tsx`

### 4.3 Knockout Risk Display

**Implementation in `analyze/page.tsx`:**

```tsx
// Extract knockout risks from composite score
const knockoutRisks = useMemo(() => {
  const compositeScore = useATSProgressStore.getState().compositeScore;
  return compositeScore?.knockoutRisks ?? [];
}, [atsComplete]);

// Display warning banner if critical/warning risks exist
{knockoutRisks.length > 0 && (
  <KnockoutRiskBanner risks={knockoutRisks} />
)}
```

**KnockoutRiskBanner Component:**

```tsx
interface KnockoutRiskBannerProps {
  risks: Array<{
    type: string;
    severity: "critical" | "warning" | "info";
    message: string;
    recommendation: string;
  }>;
}

export function KnockoutRiskBanner({ risks }: KnockoutRiskBannerProps) {
  const criticalRisks = risks.filter((r) => r.severity === "critical");
  const warningRisks = risks.filter((r) => r.severity === "warning");

  if (criticalRisks.length === 0 && warningRisks.length === 0) return null;

  return (
    <div className="card border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/30">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-amber-800 dark:text-amber-300">
            Potential Match Issues Found
          </h3>
          <ul className="mt-2 space-y-1 text-sm text-amber-700 dark:text-amber-400">
            {criticalRisks.map((risk, i) => (
              <li key={i} className="flex items-start gap-2">
                <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <span>{risk.message}</span>
              </li>
            ))}
            {warningRisks.map((risk, i) => (
              <li key={i} className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <span>{risk.message}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
```

### 4.4 Keyword Panel Population

**Extract keywords from ATS results:**

```tsx
// In analyze/page.tsx handleATSComplete callback

const handleATSComplete = useCallback((compositeScore: ATSCompositeScore) => {
  setAtsComplete(true);

  // Extract keyword data from stage results
  const keywordStage = compositeScore.stageBreakdown?.["keywords-enhanced"];

  // TODO: Backend needs to include matched/missing keyword arrays
  // in the composite score response for frontend consumption

  // For now, extract from coverage breakdown if available
  if (compositeScore.keywordAnalysis) {
    const { matchedKeywords, missingKeywords } = compositeScore.keywordAnalysis;
    setSkillMatches(matchedKeywords ?? []);
    setSkillGaps(missingKeywords ?? []);
  }
}, []);
```

**Backend Enhancement Needed:**

Add keyword arrays to composite score response in `ats_analyzer.py`:

```python
@dataclass
class CompositeATSResult:
    # ... existing fields ...
    keyword_analysis: KeywordAnalysis | None = None

@dataclass
class KeywordAnalysis:
    matched_keywords: list[str]
    missing_keywords: list[str]
    coverage_percent: float
```

### 4.5 Score Breakdown Display

**ATSScoreBreakdown Component:**

```tsx
interface ATSScoreBreakdownProps {
  compositeScore: ATSCompositeScore;
}

export function ATSScoreBreakdown({ compositeScore }: ATSScoreBreakdownProps) {
  const stages = [
    { key: "structure", label: "Structure", weight: "15%" },
    { key: "keywords-enhanced", label: "Keywords", weight: "40%" },
    { key: "content-quality", label: "Content Quality", weight: "25%" },
    { key: "role-proximity", label: "Role Fit", weight: "20%" },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {stages.map(({ key, label, weight }) => {
        const score = compositeScore.stageBreakdown?.[key] ?? 0;
        return (
          <div key={key} className="text-center">
            <div className="text-2xl font-bold">{Math.round(score)}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-xs text-muted-foreground/60">{weight}</div>
          </div>
        );
      })}
    </div>
  );
}
```

### 4.6 Testing Checklist

- [ ] Knockout risks display when present
- [ ] Critical risks show with red icon
- [ ] Warning risks show with amber icon
- [ ] KeywordSelectionPanel populates with matched skills
- [ ] KeywordSelectionPanel shows missing skills as suggestions
- [ ] Score breakdown shows all 4 stage scores
- [ ] User can proceed even with warnings (with acknowledgment)

---

## Phase 5: Real-time + AI Improvements

**Goal:** Add auto-save, content quality metrics, and proactive AI suggestions.

### 5.1 Feature Priority

| Feature | Priority | Complexity |
| ------- | -------- | ---------- |
| Auto-save with debounce | High | Low |
| Save status indicator | High | Low |
| Content quality metrics | Medium | Medium |
| Proactive AI suggestions | Medium | High |
| Section reordering | Low | Medium |

### 5.2 Auto-save Implementation

**File:** `frontend/src/components/library/editor/BlockEditorProvider.tsx`

```tsx
// Add auto-save hook
const AUTO_SAVE_DELAY = 2000; // 2 seconds debounce

const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

// Debounced auto-save effect
useEffect(() => {
  if (!isDirty) return;

  setSaveStatus('idle');

  // Clear existing timeout
  if (saveTimeoutRef.current) {
    clearTimeout(saveTimeoutRef.current);
  }

  // Set new timeout
  saveTimeoutRef.current = setTimeout(async () => {
    setSaveStatus('saving');
    try {
      await handleSave();
      setSaveStatus('saved');
      // Reset to idle after 2 seconds
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
    }
  }, AUTO_SAVE_DELAY);

  return () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
  };
}, [isDirty, blocks, style]);
```

**Save Status Indicator Component:**

```tsx
function SaveStatusIndicator({ status }: { status: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (status === 'idle') return null;

  return (
    <div className="flex items-center gap-1.5 text-xs">
      {status === 'saving' && (
        <>
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Saving...</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <Check className="h-3 w-3 text-green-500" />
          <span className="text-green-500">Saved</span>
        </>
      )}
      {status === 'error' && (
        <>
          <X className="h-3 w-3 text-destructive" />
          <span className="text-destructive">Save failed</span>
        </>
      )}
    </div>
  );
}
```

### 5.3 Content Quality Metrics

**New Component:** `frontend/src/components/library/editor/ContentQualityMetrics.tsx`

```tsx
interface ContentMetrics {
  totalBullets: number;
  quantifiedBullets: number;
  actionVerbBullets: number;
  averageBulletLength: number;
}

function calculateMetrics(blocks: Block[]): ContentMetrics {
  const bullets: string[] = [];

  // Extract all bullets from experience, projects, volunteer, etc.
  blocks.forEach((block) => {
    if (block.type === 'experience' || block.type === 'projects') {
      block.data.entries?.forEach((entry: { bullets?: string[] }) => {
        bullets.push(...(entry.bullets ?? []));
      });
    }
  });

  const quantifiedCount = bullets.filter((b) =>
    /\d+%?|\$[\d,]+|[\d,]+\+?/.test(b)
  ).length;

  const actionVerbCount = bullets.filter((b) =>
    /^(Led|Developed|Implemented|Created|Designed|Built|Managed|Increased|Reduced|Improved|Delivered|Launched|Optimized|Automated|Coordinated)/i.test(b)
  ).length;

  return {
    totalBullets: bullets.length,
    quantifiedBullets: quantifiedCount,
    actionVerbBullets: actionVerbCount,
    averageBulletLength: bullets.length
      ? bullets.reduce((sum, b) => sum + b.length, 0) / bullets.length
      : 0,
  };
}

export function ContentQualityMetrics({ blocks }: { blocks: Block[] }) {
  const metrics = useMemo(() => calculateMetrics(blocks), [blocks]);

  const quantifiedPercent = metrics.totalBullets
    ? Math.round((metrics.quantifiedBullets / metrics.totalBullets) * 100)
    : 0;

  const actionVerbPercent = metrics.totalBullets
    ? Math.round((metrics.actionVerbBullets / metrics.totalBullets) * 100)
    : 0;

  return (
    <div className="grid grid-cols-3 gap-4 text-center">
      <div>
        <div className="text-lg font-bold">{quantifiedPercent}%</div>
        <div className="text-xs text-muted-foreground">Quantified</div>
      </div>
      <div>
        <div className="text-lg font-bold">{actionVerbPercent}%</div>
        <div className="text-xs text-muted-foreground">Action Verbs</div>
      </div>
      <div>
        <div className="text-lg font-bold">{metrics.totalBullets}</div>
        <div className="text-xs text-muted-foreground">Total Bullets</div>
      </div>
    </div>
  );
}
```

### 5.4 Proactive AI Suggestions (Optional Feature)

**Implementation Approach:**

1. **Background Analysis:** When user stops typing for 3+ seconds, analyze current content
2. **Highlight Low Quality:** Mark bullets that lack metrics or action verbs
3. **Inline Suggestions:** Show tooltip with improvement suggestion on hover
4. **Apply/Dismiss:** User can apply suggestion or dismiss it

**This is a larger feature - defer to later sprint if needed.**

### 5.5 Testing Checklist

- [ ] Auto-save triggers after 2 seconds of inactivity
- [ ] Save status shows "Saving...", "Saved", or error
- [ ] Manual save (Cmd+S) still works
- [ ] Content quality metrics update in real-time
- [ ] Quantification percentage is accurate
- [ ] Action verb percentage is accurate
- [ ] No data loss when navigating away during save

---

## Implementation Order

### Sprint 1: Critical Fixes + Infrastructure

1. **Phase 3.0:** Leadership field fix (backend)
2. **Phase 5.2:** Auto-save + save status indicator

### Sprint 2: Section Support

1. **Phase 3.2-3.6:** Add all 10 missing section editors
2. **Phase 3.5-3.6:** Education minor + Projects dates

### Sprint 3: ATS UI

1. **Phase 4.3:** Knockout risk banner
2. **Phase 4.4:** Keyword panel population
3. **Phase 4.5:** Score breakdown display

### Sprint 4: Quality Features

1. **Phase 5.3:** Content quality metrics
2. **Phase 5.4:** Proactive AI suggestions (optional)

---

## Success Criteria

1. All 16 sections editable in verify step
2. ATS knockout risks displayed before user proceeds
3. Keyword panel shows real matched/missing keywords
4. Auto-save prevents data loss
5. Content quality metrics visible while editing
6. No field name mismatches between backend and frontend
