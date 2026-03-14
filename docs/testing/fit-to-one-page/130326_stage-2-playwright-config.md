# Stage 2: Configure Playwright

**Goal:** Set up Playwright project configuration and directory structure for fit-to-page tests.

**Dependencies:** Stage 1 complete

**Back to:** `130326_master-plan.md`

---

## Tasks

| # | Task | File |
| - | ---- | ---- |
| 2.1 | Add `fit-to-page` project to config | `frontend/playwright.config.ts` |
| 2.2 | Add `visual-regression` project to config | `frontend/playwright.config.ts` |
| 2.3 | Create test directory | `frontend/e2e/fit-to-page/` |
| 2.4 | Create visual regression directory | `frontend/e2e/visual-regression/` |

---

## Implementation Details

### 2.1 & 2.2 Playwright Config

**File:** `frontend/playwright.config.ts`

Add to the `projects` array:

```typescript
{
  name: "fit-to-page",
  testDir: "./e2e/fit-to-page",
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 900 },
  },
},
{
  name: "visual-regression",
  testDir: "./e2e/visual-regression",
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 900 },
  },
},
```

### Viewport Selection Rationale

| Setting | Value | Reason |
| ------- | ----- | ------ |
| Width | 1280px | Standard desktop, shows full editor layout |
| Height | 900px | Ensures full page preview visible without scroll |
| Device | Desktop Chrome | Primary target browser, most consistent rendering |

### 2.3 & 2.4 Create Directories

```bash
cd frontend
mkdir -p e2e/fit-to-page
mkdir -p e2e/visual-regression

# Add .gitkeep to track empty directories
touch e2e/fit-to-page/.gitkeep
touch e2e/visual-regression/.gitkeep
```

---

## Full Config Context

If your `playwright.config.ts` doesn't have a `projects` array yet, here's the structure:

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // Add these two:
    {
      name: "fit-to-page",
      testDir: "./e2e/fit-to-page",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: "visual-regression",
      testDir: "./e2e/visual-regression",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
      },
    },
  ],
  webServer: {
    command: "bun dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## Verification

```bash
cd frontend

# Verify config loads without errors
bun run test:e2e --list --project=fit-to-page
# Expected: "No tests found" (not an error)

bun run test:e2e --list --project=visual-regression
# Expected: "No tests found" (not an error)

# Verify directories exist
ls -la e2e/fit-to-page/
ls -la e2e/visual-regression/
```

---

## Definition of Done

- [ ] 2.1 `fit-to-page` project added to config
- [ ] 2.2 `visual-regression` project added to config
- [ ] 2.3 `e2e/fit-to-page/` directory created
- [ ] 2.4 `e2e/visual-regression/` directory created
- [ ] `bun run test:e2e --list` runs without config errors
- [ ] Commit created: `test: configure Playwright projects for fit-to-page tests`

---

## Next Stage

Proceed to `130326_stage-3-infrastructure.md`
