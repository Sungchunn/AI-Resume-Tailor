import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for E2E and visual regression tests.
 *
 * @see https://playwright.dev/docs/test-configuration
 */

// Environment flags for conditional configuration
const isCI = !!process.env.CI;
const runAllBrowsers = process.env.PLAYWRIGHT_BROWSERS === "all";
const generateHtmlReport = !!process.env.PLAYWRIGHT_HTML_REPORT;

// Default: Chromium only locally, all browsers in CI
const includeBrowsers = runAllBrowsers || isCI
  ? ["chromium", "firefox", "webkit"]
  : ["chromium"];

// Specialized test directories to exclude from generic browser projects
const specializedTestDirs = [
  "**/fit-to-page/**",
  "**/visual-regression/**",
  "**/inline-editing/**",
];

export default defineConfig({
  testDir: "./e2e",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Use 50% of CPU cores locally to keep machine responsive; single worker on CI */
  workers: process.env.CI ? 1 : "50%",
  /* Reporter to use */
  reporter: [
    // List reporter for immediate terminal feedback locally
    ...(!isCI ? [["list"] as const] : []),
    // JSON always - for Claude Code to parse test failures
    ["json", { outputFile: "test-results/results.json" }],
    // HTML only in CI or on explicit request
    ...(isCI || generateHtmlReport
      ? [["html", { outputFolder: "playwright-report" }] as const]
      : []),
  ],
  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",

    /* Collect trace when retrying the failed test */
    trace: "on-first-retry",

    /* Screenshot on failure */
    screenshot: "only-on-failure",

    /* Video recording */
    video: "retain-on-failure",
  },

  /* Configure projects for major browsers */
  projects: [
    // Browser projects - filtered by includeBrowsers, exclude specialized test dirs
    ...(includeBrowsers.includes("chromium")
      ? [
          {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
            testIgnore: specializedTestDirs,
          },
        ]
      : []),

    ...(includeBrowsers.includes("firefox")
      ? [
          {
            name: "firefox",
            use: { ...devices["Desktop Firefox"] },
            testIgnore: specializedTestDirs,
          },
        ]
      : []),

    ...(includeBrowsers.includes("webkit")
      ? [
          {
            name: "webkit",
            use: { ...devices["Desktop Safari"] },
            testIgnore: specializedTestDirs,
          },
        ]
      : []),

    /* Fit-to-page tests - requires consistent viewport for PDF/page measurements */
    {
      name: "fit-to-page",
      testDir: "./e2e/fit-to-page",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
      },
    },

    /* Visual regression tests - only run in Chromium for consistency */
    {
      name: "visual-regression",
      testDir: "./e2e/visual-regression",
      use: {
        ...devices["Desktop Chrome"],
        /* Use consistent viewport for visual tests */
        viewport: { width: 1280, height: 900 },
        /* Disable animations for visual consistency */
        launchOptions: {
          args: ["--disable-animations", "--force-prefers-reduced-motion"],
        },
      },
    },

    /* Inline editing tests - requires consistent viewport for editor interactions */
    {
      name: "inline-editing",
      testDir: "./e2e/inline-editing",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
      },
    },
  ],

  /* Run local dev server before starting the tests */
  webServer: {
    command: "bun run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes for dev server startup
  },

  /* Output folder for test artifacts */
  outputDir: "test-results",

  /* Expect settings */
  expect: {
    /* Maximum time expect() should wait for the condition to be met */
    timeout: 10000,

    /* Threshold for visual comparison tests */
    toHaveScreenshot: {
      maxDiffPixels: 100,
      threshold: 0.1,
      /* Disable animations globally for visual consistency */
      animations: "disabled",
    },
  },

  /* Snapshot path template for better organization */
  snapshotPathTemplate:
    "{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}",
});
