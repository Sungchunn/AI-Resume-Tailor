# Playwright Testing Infrastructure

**Created:** 2026-03-13
**Status:** Planning

---

## Overview

This document establishes the Playwright E2E testing infrastructure for the project. It defines reusable patterns, page objects, fixtures, and helpers that can be used across all feature tests.

---

## Why Playwright

Playwright is required for features that depend on real browser behavior:

| Capability | JSDOM | Playwright |
| ---------- | ----- | ---------- |
| CSS layout engine (`scrollHeight`, `offsetHeight`) | No | Yes |
| Font rendering and line wrapping | No | Yes |
| Real browser interactions | No | Yes |
| Visual regression testing | No | Yes |
| Cross-browser validation | No | Yes |

---

## Directory Structure

```text
frontend/e2e/
├── <feature-name>/              # Feature-specific tests
│   ├── <test-type>.spec.ts      # Test files
│   └── ...
├── visual-regression/           # Visual regression tests (existing)
│   └── *.spec.ts
├── fixtures/
│   ├── page-objects/            # Page object models
│   │   └── <PageName>Page.ts
│   ├── test-data/               # Test data factories
│   │   └── <entity>.fixture.ts
│   └── auth.fixture.ts          # Authentication setup
└── helpers/
    └── <utility>.ts             # Shared helper functions
```

---

## Playwright Configuration

**File:** `frontend/playwright.config.ts`

### Base Configuration (Existing)

```typescript
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["html", { outputFolder: "playwright-report" }],
    ["json", { outputFile: "test-results/results.json" }],
  ],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "bun run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

### Adding Feature-Specific Projects

When adding tests for a new feature, add a project to the config:

```typescript
projects: [
  // ... existing projects ...

  {
    name: "<feature-name>",
    testDir: "./e2e/<feature-name>",
    use: {
      ...devices["Desktop Chrome"],
      // Consistent viewport for measurement tests
      viewport: { width: 1280, height: 900 },
    },
  },
],
```

---

## Page Object Pattern

Page objects encapsulate page interactions and locators for reusability.

### Template

```typescript
// frontend/e2e/fixtures/page-objects/ExamplePage.ts
import { Page, Locator, expect } from "@playwright/test";

export class ExamplePage {
  readonly page: Page;

  // Define locators as readonly properties
  readonly mainElement: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.mainElement = page.locator('[data-testid="main-element"]');
    this.submitButton = page.locator('[data-testid="submit-button"]');
  }

  // Navigation methods
  async goto(id: string) {
    await this.page.goto(`/example/${id}`);
    await this.mainElement.waitFor({ state: "visible" });
  }

  // Action methods
  async submit() {
    await this.submitButton.click();
  }

  // Assertion helpers
  async expectSuccess() {
    await expect(this.page.locator('[data-testid="success-message"]')).toBeVisible();
  }
}
```

### Naming Conventions

- File: `<PageName>Page.ts` (PascalCase)
- Class: `<PageName>Page`
- Locators: Use `data-testid` attributes exclusively

---

## Test Data Factories

Factories generate consistent test data for different scenarios.

### Template1

```typescript
// frontend/e2e/fixtures/test-data/example.fixture.ts

export interface ExampleConfig {
  fieldA: string;
  fieldB: number;
}

export const EXAMPLE_PRESETS = {
  minimal: {
    fieldA: "small",
    fieldB: 1,
  },
  standard: {
    fieldA: "medium",
    fieldB: 5,
  },
  maximal: {
    fieldA: "large",
    fieldB: 100,
  },
} as const;

export function generateExampleData(config: ExampleConfig) {
  return {
    // Transform config into API-ready data
  };
}
```

---

## Helper Utilities

Shared functions for common test operations.

### Wait Utilities

```typescript
// frontend/e2e/helpers/wait-utils.ts
import { Page, expect } from "@playwright/test";

export async function waitForNetworkIdle(page: Page, timeout = 5000) {
  await page.waitForLoadState("networkidle", { timeout });
}

export async function waitForToast(page: Page, message: string) {
  await expect(page.locator('[role="alert"]')).toContainText(message);
}
```

### Measurement Utilities

```typescript
// frontend/e2e/helpers/measurement.ts
import { Locator } from "@playwright/test";

export async function getElementDimensions(locator: Locator) {
  return await locator.evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
    offsetHeight: el.offsetHeight,
  }));
}
```

---

## data-testid Conventions

All testable elements must have `data-testid` attributes.

### Naming Pattern

```text
<component>-<element>[-<modifier>]
```

### Examples

```text
fit-to-page-toggle          # Toggle button
fit-status-badge            # Status indicator
resume-page                 # Main content area
style-panel-tab             # Tab button
experience-section-0        # Indexed elements
```

### Adding to Components

```tsx
// In React components
<button data-testid="fit-to-page-toggle" onClick={handleClick}>
  Toggle
</button>

// For mapped elements
{items.map((item, idx) => (
  <div key={item.id} data-testid={`item-${idx}`}>
    {item.name}
  </div>
))}
```

---

## Running Tests

### Local Development

```bash
cd frontend

# Run all E2E tests
npx playwright test

# Run specific feature tests
npx playwright test e2e/<feature-name>

# Run specific project
npx playwright test --project=<project-name>

# Run with UI mode (interactive)
npx playwright test --ui

# Run with headed browser
npx playwright test --headed
```

### View Reports

```bash
npx playwright show-report
```

### Update Visual Snapshots

```bash
npx playwright test --update-snapshots
```

---

## CI Integration

Tests run automatically on:

- PR merge to `main`
- Manual workflow dispatch

### CI-Specific Behavior

| Setting | Local | CI |
| ------- | ----- | -- |
| Workers | Auto (parallel) | 1 (serial) |
| Retries | 0 | 2 |
| Server | Reuse existing | Start fresh |
| Artifacts | On failure | Always |

---

## Adding Tests for New Features

1. **Create feature directory:** `frontend/e2e/<feature-name>/`
2. **Add data-testid attributes** to components being tested
3. **Create page object** in `fixtures/page-objects/`
4. **Create test data factory** in `fixtures/test-data/` (if needed)
5. **Add project to playwright.config.ts** (if feature needs specific settings)
6. **Write test files** in feature directory
7. **Update this doc** with any new patterns established

---

## Test Documentation Location

- **Infrastructure docs:** `/docs/testing/` (this directory)
- **Feature test plans:** `/docs/testing/<feature>-tests.md`
