# Stage 3: Create Test Infrastructure

**Goal:** Build reusable page objects, test data factories, and helper utilities.

**Dependencies:** Stage 2 complete

**Back to:** `130326_master-plan.md`

---

## Tasks

| # | Task | File | Priority |
| - | ---- | ---- | -------- |
| 3.1 | Create ResumeEditorPage page object | `frontend/e2e/fixtures/page-objects/ResumeEditorPage.ts` | High |
| 3.2 | Create resume test data factory | `frontend/e2e/fixtures/test-data/resume.fixture.ts` | Medium |
| 3.3 | Create autofit helper utilities | `frontend/e2e/helpers/autofit.ts` | High |

---

## 3.1 ResumeEditorPage Page Object

**File:** `frontend/e2e/fixtures/page-objects/ResumeEditorPage.ts`

### Methods Required

| Method | Purpose | Returns |
| ------ | ------- | ------- |
| `goto(resumeId)` | Navigate to edit page | `Promise<void>` |
| `gotoView(resumeId)` | Navigate to view page | `Promise<void>` |
| `gotoTailorEditor(buildId)` | Navigate to tailor editor | `Promise<void>` |
| `enableFitToPage()` | Turn on toggle if not already on | `Promise<void>` |
| `disableFitToPage()` | Turn off toggle if not already off | `Promise<void>` |
| `waitForFitComplete(opts?)` | Wait for fitting to finish | `Promise<void>` |
| `getPreviewHeight()` | Get scrollHeight of page | `Promise<number>` |
| `getPageClientHeight()` | Get clientHeight of page | `Promise<number>` |
| `contentFits()` | Check if content <= container | `Promise<boolean>` |
| `getStatus()` | Get current fitting status | `Promise<Status>` |
| `getAppliedReductions()` | List reduction adjustments | `Promise<string[]>` |

### Locators Required

| Locator | Selector |
| ------- | -------- |
| `previewPage` | `[data-testid="resume-page"]` |
| `fitToPageToggle` | `[data-testid="fit-to-page-toggle"]` |
| `statusBadge` | `[data-testid="fit-status-badge"]` |
| `adjustmentsList` | `[data-testid="fit-adjustments-list"]` |
| `minimumWarning` | `[data-testid="fit-minimum-warning"]` |

### Implementation

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

## 3.2 Resume Test Data Factory

**File:** `frontend/e2e/fixtures/test-data/resume.fixture.ts`

### Presets

| Preset | Purpose | Expected Outcome |
| ------ | ------- | ---------------- |
| `minimal` | Fits without scaling | `fitted` with 0 reductions |
| `slightOverflow` | 1-10% overflow | `fitted` with 1-2 reductions |
| `moderateOverflow` | 10-50% overflow | `fitted` with multiple reductions |
| `severeOverflow` | >50% overflow | `minimum_reached` with warning |

### Implementation

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

## 3.3 Autofit Helper Utilities

**File:** `frontend/e2e/helpers/autofit.ts`

### Functions

| Function | Purpose | Signature |
| -------- | ------- | --------- |
| `waitForAutoFitComplete` | Await fitting finish | `(page, opts?) → Promise<"fitted" \| "minimum_reached">` |
| `measurePageFit` | Get height measurements | `(page) → Promise<{ contentHeight, clientHeight, fits }>` |
| `captureConsoleLogs` | Intercept console for assertions | `(page, filter) → string[]` |

### Implementation

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

## Directory Setup

```bash
cd frontend

# Create directories
mkdir -p e2e/fixtures/page-objects
mkdir -p e2e/fixtures/test-data
mkdir -p e2e/helpers

# Create files (copy implementations above)
touch e2e/fixtures/page-objects/ResumeEditorPage.ts
touch e2e/fixtures/test-data/resume.fixture.ts
touch e2e/helpers/autofit.ts
```

---

## Verification

```bash
cd frontend

# Check TypeScript compiles
npx tsc --noEmit

# Or if you have a separate e2e tsconfig:
npx tsc --noEmit -p e2e/tsconfig.json
```

---

## Definition of Done

- [ ] 3.1 `ResumeEditorPage.ts` created with all methods
- [ ] 3.2 `resume.fixture.ts` created with all presets
- [ ] 3.3 `autofit.ts` created with all helpers
- [ ] TypeScript compiles without errors
- [ ] Commit created: `test: add page objects and fixtures for fit-to-page E2E`

---

## Next Stage

Proceed to `130326_stage-4-test-suites.md`
