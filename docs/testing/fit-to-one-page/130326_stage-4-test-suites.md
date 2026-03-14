# Stage 4: Implement Test Suites

**Goal:** Write all test spec files covering measurement, convergence, persistence, and integration.

**Dependencies:** Stage 3 complete

**Back to:** `130326_master-plan.md`

---

## Tasks

| # | Task | File | Test Count |
| - | ---- | ---- | ---------- |
| 4.1 | Create measurement tests | `e2e/fit-to-page/measurement.spec.ts` | 4 tests |
| 4.2 | Create convergence tests | `e2e/fit-to-page/convergence.spec.ts` | 2 tests |
| 4.3 | Create persistence tests | `e2e/fit-to-page/persistence.spec.ts` | 3 tests |
| 4.4 | Create integration tests | `e2e/fit-to-page/integration.spec.ts` | 3 tests |

---

## Test Data Strategy

### Option A: API Mocking (Recommended for isolation)

```typescript
// In test setup - beforeEach or per-test
await page.route("**/api/resumes/*", async (route) => {
  await route.fulfill({
    status: 200,
    json: generateResumeContent(RESUME_PRESETS.moderateOverflow),
  });
});
```

**Pros:** Fast, isolated, deterministic
**Cons:** Doesn't catch real API integration issues

### Option B: Seeded Database (More realistic)

- Requires test database with known resume IDs
- Use environment variables for test resume IDs
- More complex but catches real integration issues

```typescript
const RESUME_IDS = {
  minimal: process.env.TEST_RESUME_MINIMAL ?? "test-minimal-id",
  slightOverflow: process.env.TEST_RESUME_SLIGHT ?? "test-slight-id",
  moderateOverflow: process.env.TEST_RESUME_MODERATE ?? "test-moderate-id",
  severeOverflow: process.env.TEST_RESUME_SEVERE ?? "test-severe-id",
};
```

---

## 4.1 Measurement Tests

**File:** `e2e/fit-to-page/measurement.spec.ts`

### Test Matrix

| Test Name | Scenario | Key Assertions |
| --------- | -------- | -------------- |
| `no scaling when content fits` | minimal preset | status=fitted, reductions=0, contentFits=true |
| `slight overflow - minimal scaling` | slightOverflow preset | status=fitted, 0<reductions<=2, contentFits=true |
| `moderate overflow - efficient convergence` | moderateOverflow preset | status=fitted, contentFits=true |
| `severe overflow - shows warning` | severeOverflow preset | status=minimum_reached, warning visible |

### Implementation

```typescript
import { test, expect } from "@playwright/test";
import { ResumeEditorPage } from "../fixtures/page-objects/ResumeEditorPage";

test.describe("Fit to One Page - Measurement", () => {
  test("no scaling when content fits", async ({ page }) => {
    const editor = new ResumeEditorPage(page);
    // TODO: Replace with actual resume ID or API mock
    await editor.goto("minimal-resume-id");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    expect(await editor.getStatus()).toBe("fitted");
    expect(await editor.getAppliedReductions()).toHaveLength(0);
    expect(await editor.contentFits()).toBe(true);
  });

  test("slight overflow - minimal scaling", async ({ page }) => {
    const editor = new ResumeEditorPage(page);
    await editor.goto("slight-overflow-id");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    expect(await editor.getStatus()).toBe("fitted");
    const reductions = await editor.getAppliedReductions();
    expect(reductions.length).toBeGreaterThan(0);
    expect(reductions.length).toBeLessThanOrEqual(2);
    expect(await editor.contentFits()).toBe(true);
  });

  test("moderate overflow - efficient convergence", async ({ page }) => {
    const editor = new ResumeEditorPage(page);
    await editor.goto("moderate-overflow-id");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    expect(await editor.getStatus()).toBe("fitted");
    expect(await editor.contentFits()).toBe(true);
  });

  test("severe overflow - shows warning", async ({ page }) => {
    const editor = new ResumeEditorPage(page);
    await editor.goto("severe-overflow-id");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    expect(await editor.getStatus()).toBe("minimum_reached");
    await expect(editor.minimumWarning).toBeVisible();

    const reductions = await editor.getAppliedReductions();
    expect(reductions.some((r) => r.toLowerCase().includes("spacing"))).toBe(true);
    expect(reductions.some((r) => r.toLowerCase().includes("font"))).toBe(true);
  });
});
```

---

## 4.2 Convergence Tests

**File:** `e2e/fit-to-page/convergence.spec.ts`

### Convergence Test Matrix

| Test Name | Scenario | Key Assertions |
| --------- | -------- | -------------- |
| `converges in max 7 iterations` | moderateOverflow | Parse console log, iterations <= 7 |
| `no timing warnings during normal operation` | moderateOverflow | No "Measurement delayed" in console |

### Convergence Implementation

```typescript
import { test, expect } from "@playwright/test";
import { ResumeEditorPage } from "../fixtures/page-objects/ResumeEditorPage";
import { captureConsoleLogs } from "../helpers/autofit";

test.describe("Binary Search Convergence", () => {
  test("converges in max 7 iterations", async ({ page }) => {
    const logs = captureConsoleLogs(page, "[Auto-fit]");
    const editor = new ResumeEditorPage(page);
    await editor.goto("moderate-overflow-id");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Find log entry with iteration count
    const iterationLog = logs.find((log) => log.includes("iterations"));
    expect(iterationLog).toBeDefined();

    // Parse iteration count
    const match = iterationLog?.match(/(\d+) iterations/);
    const count = match ? parseInt(match[1]) : 0;
    expect(count).toBeLessThanOrEqual(7);
  });

  test("no timing warnings during normal operation", async ({ page }) => {
    const warnings = captureConsoleLogs(page, "Measurement delayed");
    const editor = new ResumeEditorPage(page);
    await editor.goto("moderate-overflow-id");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Should have no delayed measurement warnings
    expect(warnings.length).toBe(0);
  });
});
```

---

## 4.3 Persistence Tests

**File:** `e2e/fit-to-page/persistence.spec.ts`

### Persistence Test Matrix

| Test Name | Scenario | Key Assertions |
| --------- | -------- | -------------- |
| `auto-saves after debounce` | Any overflow | API call count >= 1 after 2500ms |
| `no save during fitting` | Any overflow | savesDuringFit === 0 |
| `preference persists across reload` | Any | After reload, toggle aria-checked="true" |

### Persistence Implementation

```typescript
import { test, expect } from "@playwright/test";
import { ResumeEditorPage } from "../fixtures/page-objects/ResumeEditorPage";

test.describe("Auto-Save and Persistence", () => {
  test("auto-saves after debounce", async ({ page }) => {
    let saveCount = 0;

    // Intercept save API calls
    await page.route("**/api/resumes/*/partial", async (route) => {
      saveCount++;
      await route.continue();
    });

    const editor = new ResumeEditorPage(page);
    await editor.goto("overflow-id");
    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Wait for debounce (2000ms) + buffer
    await page.waitForTimeout(2500);

    expect(saveCount).toBeGreaterThanOrEqual(1);
  });

  test("no save during fitting", async ({ page }) => {
    let savesDuringFit = 0;
    let isFitting = false;

    // Track fitting state from console
    page.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("fitting")) isFitting = true;
      if (text.includes("fitted") || text.includes("minimum")) isFitting = false;
    });

    // Count saves that happen during fitting
    await page.route("**/api/resumes/*/partial", async (route) => {
      if (isFitting) savesDuringFit++;
      await route.continue();
    });

    const editor = new ResumeEditorPage(page);
    await editor.goto("overflow-id");
    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // No API calls should have happened while fitting was in progress
    expect(savesDuringFit).toBe(0);
  });

  test("preference persists across reload", async ({ page }) => {
    const editor = new ResumeEditorPage(page);
    await editor.goto("overflow-id");

    // Enable and wait for save
    await editor.enableFitToPage();
    await editor.waitForFitComplete();
    await page.waitForTimeout(2500); // Wait for debounced save

    // Reload page
    await page.reload();
    await editor.previewPage.waitFor({ state: "visible" });

    // Toggle should still be enabled
    const isEnabled = await editor.fitToPageToggle.getAttribute("aria-checked");
    expect(isEnabled).toBe("true");
  });
});
```

---

## 4.4 Integration Tests

**File:** `e2e/fit-to-page/integration.spec.ts`

### Integration Test Matrix

| Test Name | Route | Key Assertions |
| --------- | ----- | -------------- |
| `works on view page` | `/library/resumes/[id]` | status in [fitted, minimum_reached] |
| `works on edit page` | `/library/resumes/[id]/edit` | status in [fitted, minimum_reached] |
| `works on tailor editor` | `/tailor/editor/[id]` | status in [fitted, minimum_reached] |

### Integration Implementation

```typescript
import { test, expect } from "@playwright/test";
import { ResumeEditorPage } from "../fixtures/page-objects/ResumeEditorPage";

test.describe("Cross-Page Integration", () => {
  test("works on view page", async ({ page }) => {
    const editor = new ResumeEditorPage(page);
    await editor.gotoView("test-id");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    const status = await editor.getStatus();
    expect(["fitted", "minimum_reached"]).toContain(status);
  });

  test("works on edit page", async ({ page }) => {
    const editor = new ResumeEditorPage(page);
    await editor.goto("test-id");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    const status = await editor.getStatus();
    expect(["fitted", "minimum_reached"]).toContain(status);
  });

  test("works on tailor editor", async ({ page }) => {
    const editor = new ResumeEditorPage(page);
    await editor.gotoTailorEditor("build-id");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    const status = await editor.getStatus();
    expect(["fitted", "minimum_reached"]).toContain(status);
  });
});
```

---

## Verification

```bash
cd frontend

# Run all fit-to-page tests
npx playwright test --project=fit-to-page

# Run with UI for debugging
npx playwright test --project=fit-to-page --ui

# Run specific file
npx playwright test e2e/fit-to-page/measurement.spec.ts

# Run with verbose output
npx playwright test --project=fit-to-page --reporter=list
```

---

## Troubleshooting

### Tests Timing Out

```typescript
// Increase timeout for specific tests
test("slow test", async ({ page }) => {
  test.setTimeout(30000); // 30 seconds
  // ...
});
```

### API Mocking Not Working

```typescript
// Ensure route is set BEFORE navigation
await page.route("**/api/**", handler);
await editor.goto("test-id"); // Navigate after route is set
```

### Console Logs Not Captured

```typescript
// Set up console listener BEFORE navigation
const logs = captureConsoleLogs(page, "[Auto-fit]");
await editor.goto("test-id");
// ... perform actions
// Check logs after actions complete
```

---

## Definition of Done

- [ ] 4.1 `measurement.spec.ts` created (4 tests)
- [ ] 4.2 `convergence.spec.ts` created (2 tests)
- [ ] 4.3 `persistence.spec.ts` created (3 tests)
- [ ] 4.4 `integration.spec.ts` created (3 tests)
- [ ] All 12 tests passing
- [ ] Commit created: `test: implement fit-to-page E2E test suites`

---

## Next Stage

Proceed to `130326_stage-5-visual-regression.md`
