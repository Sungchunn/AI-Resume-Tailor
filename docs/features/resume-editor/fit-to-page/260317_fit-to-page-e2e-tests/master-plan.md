# Fit-to-One-Page Playwright E2E Test Suite

## Overview

Comprehensive E2E test expansion for the fit-to-one-page algorithm across both editor pages:

- **Library editor:** `/library/resumes/[id]/edit`
- **Tailor editor:** `/tailor/editor/[id]`

**Current state:** 12 tests across 4 files
**Target state:** 45+ tests across 9 files

---

## Test File Organization

```text
frontend/e2e/fit-to-page/
├── measurement.spec.ts         # (existing) 4 -> 8 tests
├── convergence.spec.ts         # (existing) 2 -> 5 tests
├── persistence.spec.ts         # (existing) 3 -> 5 tests
├── integration.spec.ts         # (existing) 3 -> 6 tests
├── toggle-behavior.spec.ts     # (new) 5 tests
├── status-transitions.spec.ts  # (new) 4 tests
├── edge-cases.spec.ts          # (new) 6 tests
├── font-minimums.spec.ts       # (new) 6 tests
└── control-interactions.spec.ts # (new) 5 tests
```

---

## Prerequisites: Component Updates

### FormattingTab.tsx - Add data-testid attributes

| Element | Test ID | Purpose |
| ------- | ------- | ------- |
| Style section button | `formatting-section-style` | Navigate to style section |
| Font section button | `formatting-section-font` | Navigate to font section |
| Spacing section button | `formatting-section-spacing` | Navigate to spacing section |
| Font family select | `font-family-select` | Font selection |
| Body size input | `font-size-body` | Body font size |
| Heading size input | `font-size-heading` | Heading font size |
| Subheading size input | `font-size-subheading` | Subheading font size |
| Classic preset | `preset-classic` | Style preset |
| Modern preset | `preset-modern` | Style preset |
| Minimal preset | `preset-minimal` | Style preset |
| Executive preset | `preset-executive` | Style preset |
| Line height input | `spacing-line` | Line spacing |
| Section gap input | `spacing-section` | Section spacing |
| Entry gap input | `spacing-entry` | Entry spacing |

---

## Prerequisites: Fixture Updates

### resume.fixture.ts - New Presets

```typescript
export const RESUME_PRESETS = {
  // ... existing presets ...

  /** Empty resume - no blocks */
  empty: {
    experienceCount: 0,
    bulletsPerEntry: 0,
    bulletLength: 0,
    educationCount: 0,
    skillCount: 0,
  },

  /** Single section - minimal content */
  singleSection: {
    experienceCount: 1,
    bulletsPerEntry: 2,
    bulletLength: 50,
    educationCount: 0,
    skillCount: 0,
  },

  /** Very long bullets - text wrap stress test */
  longBullets: {
    experienceCount: 2,
    bulletsPerEntry: 3,
    bulletLength: 500,
    educationCount: 1,
    skillCount: 5,
  },

  /** Many skills - tag rendering stress */
  manySkills: {
    experienceCount: 2,
    bulletsPerEntry: 3,
    bulletLength: 80,
    educationCount: 1,
    skillCount: 100,
  },
} as const;
```

### ResumeEditorPage.ts - New Methods

```typescript
// New locators
readonly fontFamilySelect: Locator;
readonly fontSizeBodyInput: Locator;
readonly formattingSectionButtons: {
  style: Locator;
  font: Locator;
  spacing: Locator;
};
readonly presetButtons: Record<string, Locator>;

// New methods
async selectFont(fontFamily: string): Promise<void>;
async getComputedFontSize(): Promise<number>;
async isControlDisabled(locator: Locator): Promise<boolean>;
async waitForStatusTransition(from: string, to: string, timeout?: number): Promise<void>;
async navigateToFormattingSection(section: "style" | "font" | "spacing"): Promise<void>;
```

---

## Test Categories

### 1. Toggle Behavior (5 tests) - NEW FILE

**File:** `toggle-behavior.spec.ts`

| Test | Description | Page |
| ---- | ----------- | ---- |
| `toggle enabled state on library editor` | Verify toggle shows enabled state | Library |
| `toggle enabled state on tailor editor` | Verify toggle shows enabled state | Tailor |
| `toggle can be disabled after enabling` | Round-trip toggle test | Both |
| `toggle state syncs with aria-checked` | Accessibility attribute test | Both |
| `status badge appears only when enabled` | Badge visibility test | Both |

### 2. Status Transitions (4 tests) - NEW FILE

**File:** `status-transitions.spec.ts`

| Test | Transition | Assertion |
| ---- | ---------- | --------- |
| `idle to fitting on enable` | idle -> fitting | Badge shows "Fitting..." |
| `fitting to fitted on success` | fitting -> fitted | Badge shows "Fitted" |
| `fitting to minimum_reached` | fitting -> minimum | Badge shows "At minimum" |
| `back to idle on disable` | any -> idle | Badge disappears |

### 3. Edge Cases (6 tests) - NEW FILE

**File:** `edge-cases.spec.ts`

| Test | Scenario | Expected |
| ---- | -------- | -------- |
| `empty resume` | No content | Status = fitted (trivial) |
| `single section` | 1 experience | Status = fitted |
| `long bullets 500+ chars` | Text wrapping stress | Fits or minimum_reached |
| `100+ skills` | Many tags | Algorithm handles gracefully |
| `10+ experience entries` | Deep nesting | minimum_reached |
| `collapsed sections` | Hidden content | Correct calculation |

### 4. Font Minimums (6 tests) - NEW FILE

**File:** `font-minimums.spec.ts`

| Test | Font | Min Body | Assertion |
| ---- | ---- | -------- | --------- |
| `Inter minimum` | Inter | 8pt | fontSizeBody >= 8 |
| `Times New Roman minimum` | Times New Roman | 9pt | fontSizeBody >= 9 |
| `Georgia minimum` | Georgia | 9pt | fontSizeBody >= 9 |
| `heading proportional scaling` | Any | varies | heading scales with body |
| `font change triggers re-fit` | Any -> Different | - | Reductions recalculated |
| `warning shows font minimum` | All | varies | Warning message accurate |

### 5. Control Interactions (5 tests) - NEW FILE

**File:** `control-interactions.spec.ts`

| Test | Control | Assertion |
| ---- | ------- | --------- |
| `font selector disabled` | Font dropdown | disabled attribute |
| `spacing inputs disabled` | All spacing inputs | disabled attribute |
| `preset buttons disabled` | Style presets | disabled attribute |
| `disabling re-enables controls` | All controls | enabled after toggle off |
| `font change before enable` | Font -> toggle | Correct minimums applied |

### 6. Measurement Extensions (4 new tests)

**File:** `measurement.spec.ts` (add to existing)

| Test | Phase | Assertion |
| ---- | ----- | --------- |
| `phase 1 reduction` | Section spacing | Reduction label contains "Section" |
| `phase 2 reduction` | Entry spacing | Reduction label contains "Entry" |
| `phase 3 reduction` | Line height | Reduction label contains "Line" |
| `phase 4 reduction` | Body font | Reduction label contains "Font" |

### 7. Convergence Extensions (3 new tests)

**File:** `convergence.spec.ts` (add to existing)

| Test | Scenario | Assertion |
| ---- | -------- | --------- |
| `severe overflow max iterations` | severeOverflow | iterations <= 10 |
| `early exit when fits` | minimal | iterations = 1 |
| `logs compactness level` | Any | Console shows "Level: X" |

### 8. Persistence Extensions (2 new tests)

**File:** `persistence.spec.ts` (add to existing)

| Test | Scenario | Assertion |
| ---- | -------- | --------- |
| `styles persist on reload` | Adjust -> reload | Same font sizes |
| `no re-fit on reload` | Fitted -> reload | No "Fitting..." state |

### 9. Integration Extensions (3 new tests)

**File:** `integration.spec.ts` (add to existing)

| Test | Scenario | Assertion |
| ---- | -------- | --------- |
| `consistent state across pages` | Navigate edit -> view | Same status |
| `tailor inherits fit setting` | Source resume fitted | Tailor starts fitted |
| `same algorithm both editors` | Same content | Same compactness level |

---

## Mock API Setup

### Library Editor

```typescript
// GET/PATCH resume
await page.route("**/api/resumes/*", handler);
await page.route("**/api/resumes/*/partial", saveHandler);
```

### Tailor Editor

```typescript
// GET/PATCH resume build
await page.route("**/api/resume-builds/*", handler);
await page.route("**/api/resume-builds/*/partial", saveHandler);

// Tailored resume data
await page.route("**/api/tailored-resumes/*", handler);
```

### Mock Response Structure

```typescript
// Library editor
{
  id: "test-resume-id",
  title: "Test Resume",
  ...generateResumeContent(RESUME_PRESETS.slightOverflow),
  fit_to_page: false,
  style: {
    fontFamily: "Inter",
    fontSizeBody: 10,
    fontSizeHeading: 16,
    fontSizeSubheading: 12,
    lineSpacing: 1.15,
    sectionSpacing: 16,
    entrySpacing: 8,
    marginTop: 0.75,
    marginBottom: 0.75,
    marginLeft: 0.75,
    marginRight: 0.75,
  },
}

// Tailor editor
{
  id: "test-build-id",
  resume_id: "test-resume-id",
  job_listing_id: "test-job-id",
  job_title: "Software Engineer",
  company_name: "Test Company",
  ...generateResumeContent(RESUME_PRESETS.slightOverflow),
  fit_to_page: false,
  style_settings: { ... },
}
```

---

## Implementation Order

### Stage 1: Prerequisites

1. Add `data-testid` attributes to `FormattingTab.tsx`
2. Add new presets to `resume.fixture.ts`
3. Extend `ResumeEditorPage.ts` with new methods

### Stage 2: New Test Files

4. Create `toggle-behavior.spec.ts`
5. Create `status-transitions.spec.ts`
6. Create `edge-cases.spec.ts`
7. Create `font-minimums.spec.ts`
8. Create `control-interactions.spec.ts`

### Stage 3: Extend Existing Tests

9. Add tests to `measurement.spec.ts`
10. Add tests to `convergence.spec.ts`
11. Add tests to `persistence.spec.ts`
12. Add tests to `integration.spec.ts`

---

## Verification

### Run Tests

```bash
cd frontend

# Run all fit-to-page tests
bun run test:e2e e2e/fit-to-page/

# Run specific test file
bun run test:e2e e2e/fit-to-page/toggle-behavior.spec.ts

# Interactive mode for debugging
bun run test:e2e:ui

# View HTML report
bun run test:e2e:report
```

### Expected Results

- All 45+ tests pass
- Both editor pages (library and tailor) behave identically
- Edge cases handled without errors
- Font-specific minimums correctly enforced
- Controls properly disabled during auto-fit
- Status transitions occur in correct order

---

## Critical Files

| File | Purpose |
| ---- | ------- |
| `frontend/src/components/library/editor/tabs/FormattingTab.tsx` | Add data-testid |
| `frontend/e2e/fixtures/page-objects/ResumeEditorPage.ts` | Extend page object |
| `frontend/e2e/fixtures/test-data/resume.fixture.ts` | Add new presets |
| `frontend/src/components/library/editor/style/useAutoFitBlocks.ts` | Algorithm reference |
| `frontend/src/lib/resume/defaults.ts` | Font profiles reference |
