# Test Plan: Deep Analysis CTA + Result (fit-score Wave 2)

**Created:** 2026-04-25
**Status:** Planning
**Master plan:** `/docs/features/ats/260425_fit-score-deep-analysis/master-plan.md`

---

## Context

Wave 2 adds `POST /api/job-listings/{id}/analyze` plus a CTA + inline result renderer on `/jobs/{id}`. Backend orchestration is covered by pytest (9 unit + 7 integration tests). This plan covers the browser-level behavior that pytest can't verify:

- CTA mounting + copy (`"Run deep analysis · 1 AI run"`)
- Loading state with Cancel link during a 30–60s request
- Cache-hit replay showing the badge without re-invoking the service
- 429 quota banner rendering with a countdown
- Partial-failure rendering — bullets section hidden + warning chip shown when the backend returns `warnings: [{stage: "bullets", ...}]`
- "Continue in Tailor →" link navigates to `/tailor?job_listing_id={id}`

Reference: `/docs/testing/260313_playwright-infrastructure.md` for patterns, page-object conventions, and gitignore rules for artifacts.

---

## Prerequisite: `data-testid` attributes

Add these stable test hooks to the Wave 2 components before writing tests. Pattern: `<component>-<element>[-<modifier>]`.

**`frontend/src/components/jobs/fit-score/DeepAnalysisCTA.tsx`:**

| Element | testid |
| ------- | ------ |
| Root CTA button | `deep-analysis-cta-button` |
| Running-state Cancel button | `deep-analysis-cta-cancel` |
| Running-state spinner container | `deep-analysis-cta-loading` |
| Quota banner root | `deep-analysis-quota-banner` |
| Quota banner countdown `<time>` | `deep-analysis-quota-resets-at` |
| Error banner root | `deep-analysis-error-banner` |
| Error banner Retry button | `deep-analysis-error-retry` |

**`frontend/src/components/jobs/fit-score/DeepAnalysisResult.tsx`:**

| Element | testid |
| ------- | ------ |
| Root result section | `deep-analysis-result` |
| Cache badge | `deep-analysis-cache-badge` |
| Rerun button | `deep-analysis-rerun` |
| Knockout section root | `deep-analysis-knockout` |
| Keywords section root | `deep-analysis-keywords` |
| Bullets section root | `deep-analysis-bullets` |
| Warning chip (one per partial failure) | `deep-analysis-warning-{stage}` |
| Continue-in-Tailor link | `deep-analysis-continue-tailor` |

---

## File Structure

```text
frontend/e2e/deep-analysis/
├── cta.spec.ts                    # CTA state machine + quota/error banners
├── result.spec.ts                 # Result renderer + cache replay
└── partial-failure.spec.ts        # Warnings rendering

frontend/e2e/fixtures/
├── page-objects/
│   └── JobDetailPage.ts           # Extend existing (add deep-analysis locators)
└── test-data/
    └── deep-analysis.fixture.ts   # Fixture payloads
```

---

## Network Interception Strategy

The backend call takes 30–60s under real conditions and requires a master resume + seeded job listing + valid quota. All E2E tests stub the network with `page.route()` to avoid real AI calls and to isolate the UI contract from backend timing:

```typescript
await page.route("**/api/job-listings/*/analyze", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(freshRunFixture),
  });
});
```

Fixtures expose helper payloads:

- `makeFreshRun(overrides?)` — `cached: false`, `warnings: []`
- `makeCachedHit(overrides?)` — `cached: true`, `cached_at`, `ai_usage` all zeros
- `makePartialFailure(stages: ["bullets", ...])` — blocks nulled + warnings populated
- `makeQuotaExceededResponse()` — 429 body with realistic `resets_at`

---

## Test Scope

### `cta.spec.ts`

| Scenario | Assertion |
| -------- | --------- |
| CTA idle copy | `getByTestId("deep-analysis-cta-button")` contains text `"Run deep analysis"` and `"1 AI run"` |
| Click triggers loading state | After click, `deep-analysis-cta-loading` visible; `deep-analysis-cta-button` hidden; Cancel link visible |
| Success transitions to result | After stub resolves, `deep-analysis-result` visible; CTA collapsed |
| Cancel aborts the request | Click Cancel → loading state disappears; no result rendered; subsequent CTA click works |
| 429 shows quota banner | Stub returns 429 → `deep-analysis-quota-banner` visible with countdown text |
| 500 shows error banner | Stub returns 500 → `deep-analysis-error-banner` visible with Retry; clicking Retry re-fires request |

### `result.spec.ts`

| Scenario | Assertion |
| -------- | --------- |
| Fresh run renders all 3 sections | Knockout, Keywords, Bullets sections all visible |
| Cache badge reflects `cached` flag | Fresh: `"Fresh run · N tokens"`; Cached: `"Cached · generated …"` |
| Rerun button clears result + shows CTA | Click Rerun → `deep-analysis-result` hidden, CTA idle visible |
| Continue-in-Tailor link | `deep-analysis-continue-tailor` has `href="/tailor?job_listing_id={id}"` |
| Keyword tier expand/collapse | Clicking a tier toggles chips; required tier starts expanded |
| Bullet card reasoning toggle | Clicking "Why this change?" reveals the reason block |

### `partial-failure.spec.ts`

| Scenario | Assertion |
| -------- | --------- |
| Bullets warning | Stub with `warnings: [{stage: "bullets", ...}]` → bullets section shows warning chip; knockout + keywords still render |
| Knockout warning | Same pattern with `stage: "knockout"` |
| Multiple warnings | Stub with two warnings; both chips render independently |

---

## Page Object Extension

`frontend/e2e/fixtures/page-objects/JobDetailPage.ts`:

```typescript
export class JobDetailPage {
  constructor(private page: Page) {}

  get deepAnalysisCTA() { return this.page.getByTestId("deep-analysis-cta-button"); }
  get deepAnalysisLoading() { return this.page.getByTestId("deep-analysis-cta-loading"); }
  get deepAnalysisCancel() { return this.page.getByTestId("deep-analysis-cta-cancel"); }
  get deepAnalysisResult() { return this.page.getByTestId("deep-analysis-result"); }
  get quotaBanner() { return this.page.getByTestId("deep-analysis-quota-banner"); }
  get errorBanner() { return this.page.getByTestId("deep-analysis-error-banner"); }
  get continueToTailor() { return this.page.getByTestId("deep-analysis-continue-tailor"); }

  async clickRunDeepAnalysis() { await this.deepAnalysisCTA.click(); }
  async clickCancel() { await this.deepAnalysisCancel.click(); }
  async clickRerun() { await this.page.getByTestId("deep-analysis-rerun").click(); }
}
```

---

## Running the Tests

```bash
cd frontend
bun run test:e2e e2e/deep-analysis    # Run all deep-analysis tests
bun run test:e2e:ui                   # Interactive debugging
bun run test:e2e:report               # View HTML report
```

---

## Artifacts Hygiene

Tests follow the repository-wide lean artifact policy:

- `trace: "on-first-retry"`
- `screenshot: "only-on-failure"`
- `video: "retain-on-failure"`

`playwright-report/`, `test-results/`, `blob-report/` are already gitignored. Clean up if `test-results/` exceeds 500MB:

```bash
rm -rf frontend/test-results/ frontend/playwright-report/
```

---

## Out of scope

- Real AI-call integration tests (covered by the backend pytest suite).
- Cross-browser validation beyond Chromium default (add as a follow-up if a rendering bug appears in Firefox/WebKit).
- Visual-regression snapshots — deferred until the component stabilizes. If the CTA/result styling changes significantly in a follow-up, add a visual-regression spec under `frontend/e2e/visual-regression/`.
