# Stage 5: Visual Regression Testing

**Goal:** Capture visual baselines and implement screenshot comparison tests.

**Dependencies:** Stage 4 complete, all functional tests passing

**Back to:** `130326_master-plan.md`

---

## Tasks

| # | Task | File |
| - | ---- | ---- |
| 5.1 | Create visual test file | `e2e/visual-regression/fit-to-page-visual.spec.ts` |
| 5.2 | Capture baseline screenshots | Auto-generated in snapshots directory |
| 5.3 | Configure diff thresholds | In spec file per-screenshot |

---

## 5.1 Visual Tests

### Test Matrix

| Test Name | Scenario | Screenshot Name |
| --------- | -------- | --------------- |
| `fitted resume matches baseline` | After fit completes | `fitted-resume.png` |
| `minimum warning renders correctly` | severeOverflow after fit | `minimum-warning.png` |

### Implementation

**File:** `e2e/visual-regression/fit-to-page-visual.spec.ts`

```typescript
import { test, expect } from "@playwright/test";
import { ResumeEditorPage } from "../fixtures/page-objects/ResumeEditorPage";

test.describe("Fit to Page Visual Regression", () => {
  test("fitted resume matches baseline", async ({ page }) => {
    const editor = new ResumeEditorPage(page);
    await editor.goto("visual-test-id");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Capture screenshot of the preview page
    await expect(editor.previewPage).toHaveScreenshot("fitted-resume.png", {
      maxDiffPixels: 100,
    });
  });

  test("minimum warning renders correctly", async ({ page }) => {
    const editor = new ResumeEditorPage(page);
    await editor.goto("severe-overflow-id");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Capture screenshot of the warning element
    await expect(editor.minimumWarning).toHaveScreenshot("minimum-warning.png", {
      maxDiffPixels: 50,
    });
  });

  test("adjustments list displays correctly", async ({ page }) => {
    const editor = new ResumeEditorPage(page);
    await editor.goto("moderate-overflow-id");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Wait for adjustments to render
    await expect(editor.adjustmentsList).toBeVisible();

    await expect(editor.adjustmentsList).toHaveScreenshot("adjustments-list.png", {
      maxDiffPixels: 30,
    });
  });
});
```

---

## Screenshot Thresholds

| Screenshot | Recommended Threshold | Rationale |
| ---------- | -------------------- | --------- |
| `fitted-resume.png` | `maxDiffPixels: 100` | Minor text rendering variations OK |
| `minimum-warning.png` | `maxDiffPixels: 50` | Warning UI should be stable |
| `adjustments-list.png` | `maxDiffPixels: 30` | Small component, low variance expected |

### Threshold Options

```typescript
// Option 1: Absolute pixel count
await expect(locator).toHaveScreenshot("name.png", {
  maxDiffPixels: 100, // Allow up to 100 differing pixels
});

// Option 2: Percentage ratio
await expect(locator).toHaveScreenshot("name.png", {
  maxDiffPixelRatio: 0.01, // Allow up to 1% difference
});

// Option 3: Threshold per-pixel (0-1, strict to lenient)
await expect(locator).toHaveScreenshot("name.png", {
  threshold: 0.2, // 20% color difference allowed per pixel
});
```

---

## 5.2 Capture Baseline Screenshots

### First Run

```bash
cd frontend

# First run creates baseline screenshots
npx playwright test --project=visual-regression --update-snapshots

# Verify baselines were created
ls -la e2e/visual-regression/fit-to-page-visual.spec.ts-snapshots/
```

### Expected Output

```text
e2e/visual-regression/fit-to-page-visual.spec.ts-snapshots/
├── fitted-resume-chromium-darwin.png
├── minimum-warning-chromium-darwin.png
└── adjustments-list-chromium-darwin.png
```

### Platform-Specific Snapshots

Playwright creates platform-specific snapshots (darwin/linux/win32). For CI consistency:

```typescript
// playwright.config.ts
export default defineConfig({
  // ...
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFilePath}/{arg}{ext}",
  // Or use platform-agnostic path:
  // snapshotPathTemplate: "{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}",
});
```

---

## 5.3 Configure Diff Behavior

### Global Configuration

**File:** `playwright.config.ts`

```typescript
export default defineConfig({
  // ...
  expect: {
    toHaveScreenshot: {
      // Global defaults
      maxDiffPixels: 50,
      threshold: 0.2,
      animations: "disabled",
    },
  },
});
```

### Per-Test Overrides

```typescript
test("high precision test", async ({ page }) => {
  await expect(locator).toHaveScreenshot("precise.png", {
    maxDiffPixels: 0, // No tolerance
    threshold: 0, // Exact color match
  });
});
```

### Disable Animations

```typescript
test("stable screenshot", async ({ page }) => {
  // Wait for animations to complete
  await page.waitForTimeout(500);

  // Or disable animations globally in config
  await expect(locator).toHaveScreenshot("name.png", {
    animations: "disabled",
  });
});
```

---

## Verification

### Run Visual Tests

```bash
cd frontend

# Run visual regression tests
npx playwright test --project=visual-regression

# If tests fail, view the diff report
npx playwright show-report
```

### Interpreting Failures

When a visual test fails, Playwright generates:

1. **expected-name.png** - The baseline
2. **actual-name.png** - Current screenshot
3. **diff-name.png** - Highlighted differences

These appear in the HTML report (`npx playwright show-report`).

### Common Failure Causes

| Cause | Solution |
| ----- | -------- |
| Font rendering differences | Increase `maxDiffPixels` or use web fonts |
| Animation mid-frame | Add `animations: "disabled"` |
| Dynamic content (dates, IDs) | Mock API responses with static data |
| Viewport size differences | Set explicit viewport in project config |
| Anti-aliasing differences | Increase `threshold` (e.g., 0.3) |

---

## Handling Intentional UI Changes

When the UI intentionally changes:

```bash
# 1. Run tests to see failures (expected)
npx playwright test --project=visual-regression

# 2. Review the diffs in the report
npx playwright show-report

# 3. If changes are intentional, update baselines
npx playwright test --project=visual-regression --update-snapshots

# 4. Commit new baselines
git add e2e/visual-regression/*-snapshots/
git commit -m "test: update visual baselines for fit-to-page UI changes"
```

---

## CI Integration Notes

### GitHub Actions Example

```yaml
- name: Run visual regression tests
  run: npx playwright test --project=visual-regression

- name: Upload test artifacts on failure
  if: failure()
  uses: actions/upload-artifact@v3
  with:
    name: visual-regression-diff
    path: |
      frontend/test-results/
      frontend/playwright-report/
```

### Baseline Management Strategy

| Approach | Pros | Cons |
| -------- | ---- | ---- |
| Commit to repo | Simple, version-controlled | Increases repo size |
| Store in LFS | Efficient for large images | Requires LFS setup |
| External storage (S3) | Scales well | More complex setup |

**Recommendation:** Commit to repo for small projects (<50 screenshots).

---

## Definition of Done

- [ ] 5.1 Visual test file created with all tests
- [ ] 5.2 Baseline screenshots captured and committed
- [ ] 5.3 Diff thresholds configured per screenshot
- [ ] All visual tests passing
- [ ] Documentation updated with baseline update procedure
- [ ] Commit created: `test: add visual regression tests for fit-to-page`

---

## Final Verification

After completing all stages:

```bash
cd frontend

# Run ALL tests (functional + visual)
npx playwright test --project=fit-to-page
npx playwright test --project=visual-regression

# Or run both projects
npx playwright test --project=fit-to-page --project=visual-regression

# View combined report
npx playwright show-report
```

### Expected Results

| Project | Tests | Status |
| ------- | ----- | ------ |
| fit-to-page | 12 | Passing |
| visual-regression | 2-3 | Passing |
| **Total** | **14-15** | **All Passing** |

---

## Back to Master Plan

Return to `130326_master-plan.md` to mark all stages complete.
