# Playwright Configuration Optimization Plan

**Created:** 2026-03-17
**Status:** Approved for implementation

## Goal

Reduce compute and storage for local Playwright E2E tests while keeping JSON reports for Claude Code to parse failures.

---

## Changes Summary

| Aspect | Current | After |
| ------ | ------- | ----- |
| Local browsers | All 3 (chromium, firefox, webkit) | Chromium only |
| Local reporters | HTML + JSON | List + JSON (faster, less storage) |
| Cleanup scripts | None | 3 new scripts |
| Test duplication | Specialized tests run twice | Fixed with testIgnore |

---

## Implementation

### 1. Modify `playwright.config.ts`

**Add environment-based browser selection at top:**

```typescript
const isCI = !!process.env.CI;
const runAllBrowsers = process.env.PLAYWRIGHT_BROWSERS === "all";

// Default: Chromium only locally, all browsers in CI
const includeBrowsers = runAllBrowsers || isCI
  ? ["chromium", "firefox", "webkit"]
  : ["chromium"];
```

**Add testIgnore to browser projects to prevent duplicate test runs:**

```typescript
{
  name: "chromium",
  use: { ...devices["Desktop Chrome"] },
  testIgnore: ["**/fit-to-page/**", "**/visual-regression/**", "**/inline-editing/**"],
},
```

**Conditional reporters:**

```typescript
reporter: [
  // List reporter for immediate terminal feedback locally
  ...(!isCI ? [["list"] as const] : []),
  // JSON always - for Claude Code to parse
  ["json", { outputFile: "test-results/results.json" }],
  // HTML only in CI or on explicit request
  ...(isCI || process.env.PLAYWRIGHT_HTML_REPORT ? [["html", { outputFolder: "playwright-report" }] as const] : []),
],
```

**Keep specialized projects unchanged** (fit-to-page, visual-regression, inline-editing).

### 2. Add cleanup scripts to `package.json`

```json
"test:e2e:clean": "rm -rf playwright-report test-results",
"test:e2e:fresh": "rm -rf playwright-report test-results && playwright test"
```

---

## Files to Modify

1. **`frontend/playwright.config.ts`** - Browser selection, testIgnore, conditional reporters
2. **`frontend/package.json`** - Add cleanup scripts

---

## Usage After Changes

```bash
# Local development (Chromium only, list + JSON output)
bun run test:e2e

# Clean artifacts before running
bun run test:e2e:fresh

# Force all browsers locally
PLAYWRIGHT_BROWSERS=all bun run test:e2e

# Generate HTML report locally
PLAYWRIGHT_HTML_REPORT=1 bun run test:e2e

# Clean up artifacts manually
bun run test:e2e:clean
```

---

## Verification

1. Run `bun run test:e2e` - should only show Chromium tests, no HTML report generated
2. Check `test-results/results.json` exists after run - Claude Code can parse this
3. Verify `playwright-report/` directory does NOT exist after local run
4. Run `bun run test:e2e:clean` - should remove both directories
5. Run `PLAYWRIGHT_BROWSERS=all bun run test:e2e` - should run all 3 browsers
