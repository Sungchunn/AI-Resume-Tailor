# Fit-to-One-Page Playwright Tests

**Created:** 2026-03-13
**Status:** Planning
**Related:** `/docs/features/fit-to-one-page/130326_master-plan.md`
**Infrastructure:** `130326_playwright-infrastructure.md`

---

## Overview

E2E tests for the fit-to-one-page feature, which automatically scales resume content to fit on one page using binary search through 100 compactness levels.

### Why Playwright is Required

This feature depends on real DOM measurements (`scrollHeight`, font metrics, line wrapping) that JSDOM cannot provide. See `/docs/features/fit-to-one-page/130326_tradeoff-2-coupling-preview-to-autofit.md` for detailed analysis.

---

## Test Scope

### Pages to Test

| Page | Route |
| ---- | ----- |
| Resume view | `/library/resumes/[id]` |
| Resume edit | `/library/resumes/[id]/edit` |
| Tailor editor | `/tailor/editor/[id]` |

### Behaviors to Validate

| Category | Behavior |
| -------- | -------- |
| Measurement | Content fits - no scaling applied |
| Measurement | Slight overflow (1-10%) - minimal scaling |
| Measurement | Moderate overflow (10-50%) - efficient convergence |
| Measurement | Severe overflow (>50%) - minimum threshold warning |
| Convergence | Binary search completes in <=7 iterations |
| Convergence | Double RAF timing - no delayed measurements |
| Persistence | Auto-save after 2000ms debounce |
| Persistence | No save during fitting process |
| Persistence | Preference persists across reload |
| Integration | Works on all three pages |

---

## Implementation Stages

| Stage | Description | Document |
| ----- | ----------- | -------- |
| 1 | Instrument components with test IDs | `130326_stage-1-instrumentation.md` |
| 2 | Configure Playwright projects | `130326_stage-2-playwright-config.md` |
| 3 | Create test infrastructure | `130326_stage-3-infrastructure.md` |
| 4 | Implement test suites | `130326_stage-4-test-suites.md` |
| 5 | Visual regression testing | `130326_stage-5-visual-regression.md` |

Each stage must be completed and verified before proceeding to the next.

---

## Test Directory Structure

```text
frontend/e2e/
├── fit-to-page/
│   ├── measurement.spec.ts
│   ├── convergence.spec.ts
│   ├── persistence.spec.ts
│   └── integration.spec.ts
├── visual-regression/
│   └── fit-to-page-visual.spec.ts
├── fixtures/
│   ├── page-objects/
│   │   └── ResumeEditorPage.ts
│   └── test-data/
│       └── resume.fixture.ts
└── helpers/
    └── autofit.ts
```

---

## Complete Implementation Checklist

### Stage 1: Instrument Components

- [ ] 1.1 Add `fit-to-page-toggle` test ID
- [ ] 1.2 Add `fit-status-badge` test ID
- [ ] 1.3 Add `fit-adjustments-list` test ID
- [ ] 1.4 Add `fit-minimum-warning` test ID
- [ ] 1.5 Add `resume-page` test ID
- [ ] Stage 1 commit created

### Stage 2: Configure Playwright

- [ ] 2.1 Add `fit-to-page` project config
- [ ] 2.2 Create test directory structure
- [ ] Stage 2 commit created

### Stage 3: Test Infrastructure

- [ ] 3.1 Create ResumeEditorPage page object
- [ ] 3.2 Create resume test data factory
- [ ] 3.3 Create autofit helper utilities
- [ ] TypeScript compiles
- [ ] Stage 3 commit created

### Stage 4: Test Suites

- [ ] 4.1 measurement.spec.ts (4 tests)
- [ ] 4.2 convergence.spec.ts (2 tests)
- [ ] 4.3 persistence.spec.ts (3 tests)
- [ ] 4.4 integration.spec.ts (3 tests)
- [ ] All 12 tests passing
- [ ] Stage 4 commit created

### Stage 5: Visual Regression

- [ ] 5.1 Visual test file created
- [ ] 5.2 Baseline screenshots captured
- [ ] 5.3 Diff thresholds configured
- [ ] All 14 tests passing (12 + 2 visual)
- [ ] Stage 5 commit created

---

## Estimated Test Coverage

| Category | Tests | Coverage |
| -------- | ----- | -------- |
| Measurement accuracy | 4 | All overflow scenarios |
| Binary search efficiency | 2 | Iteration count, timing |
| Persistence behavior | 3 | Auto-save, reload |
| Cross-page integration | 3 | All 3 routes |
| Visual regression | 2 | Fitted state, warning UI |
| **Total** | **14** | **100% of identified behaviors** |

---

## Running Tests

```bash
cd frontend

# Run all fit-to-page tests
npx playwright test --project=fit-to-page

# Run visual regression tests
npx playwright test --project=visual-regression

# Run with UI for debugging
npx playwright test --project=fit-to-page --ui

# View test report
npx playwright show-report
```
