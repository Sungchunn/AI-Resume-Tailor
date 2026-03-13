# Tradeoff 4: Default-On vs. Opt-In

**Created:** 2026-03-13
**Status:** Analysis
**Risk Level:** Medium

---

## Context

The plan changes the default value of `fitToOnePage` from `false` to `true`:

```typescript
// Before
export function createEmptyState(): BlockEditorState {
  return {
    // ...
    fitToOnePage: false,
  };
}

// After
export function createEmptyState(): BlockEditorState {
  return {
    // ...
    fitToOnePage: true,
  };
}
```

---

## Impact Analysis

### New Resumes

| Aspect | Impact |
| ------ | ------ |
| User experience | Auto-fit enabled immediately; content always fits one page |
| User expectation | Matches common resume best practice (one page) |
| Opt-out available | User can toggle off in settings if needed |

**Verdict:** Positive change for new users.

### Existing Resumes

| Aspect | Impact |
| ------ | ------ |
| On next load | Auto-fit activates, potentially reducing font sizes/spacing |
| Saved styles | May be overwritten with auto-fitted values |
| User surprise | Resume looks different without explicit action |
| Multi-page resumes | Forced to one page; content may become unreadable |

**Verdict:** Potentially breaking change for existing users.

---

## User Personas Affected

### Persona 1: Standard Job Seeker

- Has 1-2 page resume
- Expects resume to fit one page
- **Impact:** Positive - auto-fit matches their goal

### Persona 2: Academic/CV User

- Has multi-page CV (publications, teaching, grants)
- Never wants content compressed
- **Impact:** Negative - auto-fit ruins their document

### Persona 3: Senior Professional

- Has carefully crafted 2-page resume
- Specific formatting choices
- **Impact:** Negative - auto-fit overrides their decisions

---

## Migration Strategies

### Option A: Immediate Default Change (Proposed)

```typescript
fitToOnePage: true // For all resumes
```

| Pro | Con |
| --- | --- |
| Simple implementation | Breaks existing multi-page resumes |
| Consistent behavior | User surprise on next load |

### Option B: New Resumes Only

```typescript
// In createEmptyState (new resumes)
fitToOnePage: true

// When loading existing resume
fitToOnePage: resume.fitToOnePage ?? false // Preserve existing behavior
```

| Pro | Con |
| --- | --- |
| No breaking changes | Inconsistent defaults |
| Existing users unaffected | New feature less discoverable for existing resumes |

### Option C: Schema Migration

Add `fitToOnePage` column to database with migration:

```sql
ALTER TABLE resumes ADD COLUMN fit_to_one_page BOOLEAN;

-- New resumes get true
-- Existing resumes get NULL (interpreted as false)
UPDATE resumes SET fit_to_one_page = NULL WHERE fit_to_one_page IS NULL;
```

```typescript
// In frontend
const fitToOnePage = resume.fitToOnePage ?? (isNewResume ? true : false);
```

| Pro | Con |
| --- | --- |
| Explicit per-resume setting | Database migration required |
| Preserves user intent | More complex loading logic |

### Option D: Prompt User

On first load after feature launch:

```text
┌─────────────────────────────────────────────┐
│ New Feature: Auto-Fit to One Page           │
│                                             │
│ Would you like to enable automatic content  │
│ scaling for this resume?                    │
│                                             │
│ [Enable] [Keep Current Settings]            │
└─────────────────────────────────────────────┘
```

| Pro | Con |
| --- | --- |
| User makes explicit choice | Interrupts workflow |
| No surprise changes | Implementation complexity |

---

## Recommendation

**Use Option B: New Resumes Only**
Rationale:

1. **No breaking changes** - Existing users' resumes behave identically
2. **Progressive adoption** - New users get the improved default
3. **Simple implementation** - Null coalescing handles the logic
4. **Reversible** - Can migrate to Option C later if needed

### Implementation

```typescript
// In resume loading logic
function loadResumeState(resume: ApiResume): BlockEditorState {
  return {
    // ...
    fitToOnePage: resume.fitToOnePage ?? false, // Existing resumes keep current behavior
  };
}

// In new resume creation
function createEmptyState(): BlockEditorState {
  return {
    // ...
    fitToOnePage: true, // New resumes get auto-fit
  };
}
```

---

## Future Enhancement: User Preference

Consider adding a user-level preference:

```typescript
interface UserPreferences {
  defaultFitToOnePage: boolean; // User's preferred default for new resumes
}
```

This allows users who prefer multi-page documents to opt out globally.
