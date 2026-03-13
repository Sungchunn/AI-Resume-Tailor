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

## Prerequisites

### Add data-testid Attributes

**File:** `frontend/src/components/library/editor/style/AutoFitToggle.tsx`

```tsx
// Toggle button (line ~45)
<button
  role="switch"
  aria-checked={enabled}
  data-testid="fit-to-page-toggle"
  onClick={() => onToggle(!enabled)}
  // ...
>

// StatusBadge component (line ~89)
function StatusBadge({ status }: { status: AutoFitStatus }) {
  // Add data-testid to wrapper span in each case
  return (
    <span data-testid="fit-status-badge" className="...">
      {/* content */}
    </span>
  );
}

// Adjustments list (line ~66)
<ul className="mt-1 space-y-0.5 text-green-600" data-testid="fit-adjustments-list">

// Warning message (line ~78)
<div data-testid="fit-minimum-warning" className="text-xs text-amber-700 ...">
```

**File:** `frontend/src/components/library/preview/ResumePreview.tsx`

```tsx
// Page container - add data-testid
<div ref={pageRef} data-testid="resume-page" className="...">
```

### Update Playwright Config

**File:** `frontend/playwright.config.ts`

Add project:

```typescript
{
  name: "fit-to-page",
  testDir: "./e2e/fit-to-page",
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 900 },
  },
},
```

---

## Test Files

### Directory Structure

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

## Page Object

**File:** `frontend/e2e/fixtures/page-objects/ResumeEditorPage.ts`

```typescript
import { Page, Locator, expect } from "@playwright/test";

export class ResumeEditorPage {
  readonly page: Page;
  readonly previewPage: Locator;
  readonly fitToPageToggle: Locator;
  readonly statusBadge: Locator;
  readonly adjustmentsList: Locator;
  readonly minimumWarning: Locator;

  constructor(page: Page) {
    this.page = page;
    this.previewPage = page.locator('[data-testid="resume-page"]');
    this.fitToPageToggle = page.locator('[data-testid="fit-to-page-toggle"]');
    this.statusBadge = page.locator('[data-testid="fit-status-badge"]');
    this.adjustmentsList = page.locator('[data-testid="fit-adjustments-list"]');
    this.minimumWarning = page.locator('[data-testid="fit-minimum-warning"]');
  }

  async goto(resumeId: string) {
    await this.page.goto(`/library/resumes/${resumeId}/edit`);
    await this.previewPage.waitFor({ state: "visible" });
  }

  async gotoView(resumeId: string) {
    await this.page.goto(`/library/resumes/${resumeId}`);
    await this.previewPage.waitFor({ state: "visible" });
  }

  async gotoTailorEditor(buildId: string) {
    await this.page.goto(`/tailor/editor/${buildId}`);
    await this.previewPage.waitFor({ state: "visible" });
  }

  async enableFitToPage() {
    const isEnabled = await this.fitToPageToggle.getAttribute("aria-checked");
    if (isEnabled !== "true") {
      await this.fitToPageToggle.click();
    }
  }

  async disableFitToPage() {
    const isEnabled = await this.fitToPageToggle.getAttribute("aria-checked");
    if (isEnabled === "true") {
      await this.fitToPageToggle.click();
    }
  }

  async waitForFitComplete(options: { timeout?: number } = {}) {
    const timeout = options.timeout ?? 10000;
    await expect(this.statusBadge).toHaveText(/(Fitted|At minimum)/, { timeout });
  }

  async getPreviewHeight(): Promise<number> {
    return await this.previewPage.evaluate((el) => el.scrollHeight);
  }

  async getPageClientHeight(): Promise<number> {
    return await this.previewPage.evaluate((el) => el.clientHeight);
  }

  async contentFits(): Promise<boolean> {
    const scrollHeight = await this.getPreviewHeight();
    const clientHeight = await this.getPageClientHeight();
    return scrollHeight <= clientHeight;
  }

  async getStatus(): Promise<"idle" | "fitting" | "fitted" | "minimum_reached"> {
    try {
      const text = await this.statusBadge.textContent({ timeout: 1000 });
      if (text?.includes("Fitting")) return "fitting";
      if (text?.includes("Fitted")) return "fitted";
      if (text?.includes("At minimum")) return "minimum_reached";
    } catch {
      // Badge not visible = idle
    }
    return "idle";
  }

  async getAppliedReductions(): Promise<string[]> {
    try {
      const items = await this.adjustmentsList.locator("li").allTextContents();
      return items;
    } catch {
      return [];
    }
  }
}
```

---

## Test Data Factory

**File:** `frontend/e2e/fixtures/test-data/resume.fixture.ts`

```typescript
export interface ResumeTestConfig {
  experienceCount: number;
  bulletsPerEntry: number;
  bulletLength: number;
  educationCount: number;
  skillCount: number;
}

export const RESUME_PRESETS = {
  /** Fits on one page - no scaling needed */
  minimal: {
    experienceCount: 1,
    bulletsPerEntry: 3,
    bulletLength: 60,
    educationCount: 1,
    skillCount: 5,
  },

  /** Slight overflow (1-10%) - needs minor scaling */
  slightOverflow: {
    experienceCount: 3,
    bulletsPerEntry: 4,
    bulletLength: 80,
    educationCount: 2,
    skillCount: 12,
  },

  /** Moderate overflow (10-50%) - needs significant scaling */
  moderateOverflow: {
    experienceCount: 5,
    bulletsPerEntry: 5,
    bulletLength: 90,
    educationCount: 3,
    skillCount: 20,
  },

  /** Severe overflow (>50%) - will hit minimum thresholds */
  severeOverflow: {
    experienceCount: 8,
    bulletsPerEntry: 6,
    bulletLength: 100,
    educationCount: 4,
    skillCount: 30,
  },
} as const;

export function generateBullet(targetLength: number): string {
  const starters = ["Developed", "Led", "Implemented", "Designed", "Optimized"];
  let bullet = starters[Math.floor(Math.random() * starters.length)];
  const filler = " technology solution delivering measurable business value";
  while (bullet.length < targetLength) {
    bullet += filler;
  }
  return bullet.substring(0, targetLength);
}

export function generateResumeContent(config: ResumeTestConfig) {
  return {
    contact: {
      name: "Test User",
      email: "test@example.com",
      phone: "(555) 123-4567",
      location: "San Francisco, CA",
    },
    summary: "Experienced software engineer with expertise in full-stack development.",
    experience: Array.from({ length: config.experienceCount }, (_, i) => ({
      title: `Senior Software Engineer ${i + 1}`,
      company: `Tech Company ${i + 1}`,
      location: "Remote",
      start_date: "2020-01",
      end_date: i === 0 ? "Present" : `202${i}-12`,
      bullets: Array.from({ length: config.bulletsPerEntry }, () =>
        generateBullet(config.bulletLength)
      ),
    })),
    education: Array.from({ length: config.educationCount }, (_, i) => ({
      degree: `Bachelor of Science in Computer Science`,
      institution: `University ${i + 1}`,
      graduation_date: `201${i}`,
    })),
    skills: Array.from({ length: config.skillCount }, (_, i) => `Skill ${i + 1}`),
  };
}
```

---

## Helper Utilities

**File:** `frontend/e2e/helpers/autofit.ts`

```typescript
import { Page, expect } from "@playwright/test";

export async function waitForAutoFitComplete(
  page: Page,
  options: { timeout?: number } = {}
): Promise<"fitted" | "minimum_reached"> {
  const timeout = options.timeout ?? 10000;
  const statusBadge = page.locator('[data-testid="fit-status-badge"]');

  await expect(statusBadge).toHaveText(/(Fitted|At minimum)/, { timeout });

  const text = await statusBadge.textContent();
  return text?.includes("minimum") ? "minimum_reached" : "fitted";
}

export async function measurePageFit(page: Page): Promise<{
  contentHeight: number;
  clientHeight: number;
  fits: boolean;
}> {
  const previewPage = page.locator('[data-testid="resume-page"]');

  const contentHeight = await previewPage.evaluate((el) => el.scrollHeight);
  const clientHeight = await previewPage.evaluate((el) => el.clientHeight);

  return {
    contentHeight,
    clientHeight,
    fits: contentHeight <= clientHeight,
  };
}

export function captureConsoleLogs(page: Page, filter: string): string[] {
  const logs: string[] = [];
  page.on("console", (msg) => {
    if (msg.text().includes(filter)) {
      logs.push(msg.text());
    }
  });
  return logs;
}
```

---

## Test Implementations

### measurement.spec.ts

```typescript
import { test, expect } from "@playwright/test";
import { ResumeEditorPage } from "../fixtures/page-objects/ResumeEditorPage";

test.describe("Fit to One Page - Measurement", () => {
  test("no scaling when content fits", async ({ page }) => {
    const editor = new ResumeEditorPage(page);
    // TODO: Create/use resume with minimal content
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

### convergence.spec.ts

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

    const iterationLog = logs.find((log) => log.includes("iterations"));
    expect(iterationLog).toBeDefined();

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

    expect(warnings.length).toBe(0);
  });
});
```

### persistence.spec.ts

```typescript
import { test, expect } from "@playwright/test";
import { ResumeEditorPage } from "../fixtures/page-objects/ResumeEditorPage";

test.describe("Auto-Save and Persistence", () => {
  test("auto-saves after debounce", async ({ page }) => {
    let saveCount = 0;
    await page.route("**/api/resumes/*/partial", async (route) => {
      saveCount++;
      await route.continue();
    });

    const editor = new ResumeEditorPage(page);
    await editor.goto("overflow-id");
    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    await page.waitForTimeout(2500);
    expect(saveCount).toBeGreaterThanOrEqual(1);
  });

  test("no save during fitting", async ({ page }) => {
    let savesDuringFit = 0;
    let isFitting = false;

    page.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("fitting")) isFitting = true;
      if (text.includes("fitted") || text.includes("minimum")) isFitting = false;
    });

    await page.route("**/api/resumes/*/partial", async (route) => {
      if (isFitting) savesDuringFit++;
      await route.continue();
    });

    const editor = new ResumeEditorPage(page);
    await editor.goto("overflow-id");
    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    expect(savesDuringFit).toBe(0);
  });

  test("preference persists across reload", async ({ page }) => {
    const editor = new ResumeEditorPage(page);
    await editor.goto("overflow-id");
    await editor.enableFitToPage();
    await editor.waitForFitComplete();
    await page.waitForTimeout(2500);

    await page.reload();
    await editor.previewPage.waitFor({ state: "visible" });

    const isEnabled = await editor.fitToPageToggle.getAttribute("aria-checked");
    expect(isEnabled).toBe("true");
  });
});
```

### integration.spec.ts

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

## Visual Regression

**File:** `frontend/e2e/visual-regression/fit-to-page-visual.spec.ts`

```typescript
import { test, expect } from "@playwright/test";
import { ResumeEditorPage } from "../fixtures/page-objects/ResumeEditorPage";

test.describe("Fit to Page Visual", () => {
  test("fitted resume matches baseline", async ({ page }) => {
    const editor = new ResumeEditorPage(page);
    await editor.goto("visual-test-id");
    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    await expect(editor.previewPage).toHaveScreenshot("fitted-resume.png", {
      maxDiffPixels: 100,
    });
  });

  test("minimum warning renders correctly", async ({ page }) => {
    const editor = new ResumeEditorPage(page);
    await editor.goto("severe-overflow-id");
    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    await expect(editor.minimumWarning).toHaveScreenshot("minimum-warning.png");
  });
});
```

---

## Verification

### Run Tests

```bash
cd frontend
npx playwright test e2e/fit-to-page --project=fit-to-page
```

### Coverage Checklist

- [ ] Minimal content - no scaling
- [ ] Slight overflow - scales to fit
- [ ] Moderate overflow - <=7 iterations
- [ ] Severe overflow - warning displayed
- [ ] Auto-save triggers after debounce
- [ ] No save during fitting
- [ ] Preference persists after reload
- [ ] Works on /library/resumes/[id]
- [ ] Works on /library/resumes/[id]/edit
- [ ] Works on /tailor/editor/[id]
- [ ] Visual baselines captured

---

## Implementation Order

1. Add `data-testid` attributes (AutoFitToggle, ResumePreview)
2. Update `playwright.config.ts` (add project)
3. Create `e2e/fixtures/page-objects/ResumeEditorPage.ts`
4. Create `e2e/fixtures/test-data/resume.fixture.ts`
5. Create `e2e/helpers/autofit.ts`
6. Create `e2e/fit-to-page/measurement.spec.ts`
7. Create `e2e/fit-to-page/convergence.spec.ts`
8. Create `e2e/fit-to-page/persistence.spec.ts`
9. Create `e2e/fit-to-page/integration.spec.ts`
10. Create `e2e/visual-regression/fit-to-page-visual.spec.ts`
