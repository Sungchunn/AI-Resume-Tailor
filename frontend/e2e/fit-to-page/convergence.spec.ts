import { test, expect } from "@playwright/test";
import { ResumeEditorPage } from "../fixtures/page-objects/ResumeEditorPage";
import { captureConsoleLogs } from "../helpers/autofit";
import {
  RESUME_PRESETS,
  generateResumeContent,
} from "../fixtures/test-data/resume.fixture";

/**
 * Convergence tests verify that the binary search algorithm
 * converges efficiently without performance issues.
 */
test.describe("Binary Search Convergence", () => {
  test("converges in max 7 iterations", async ({ page }) => {
    // Set up console log capture BEFORE navigation
    const logs = captureConsoleLogs(page, "[Auto-fit]");

    // Mock API with moderate overflow content
    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "moderate-overflow-id",
            ...generateResumeContent(RESUME_PRESETS.moderateOverflow),
            fit_to_page: false,
          },
        });
      } else {
        await route.continue();
      }
    });

    const editor = new ResumeEditorPage(page);
    await editor.goto("moderate-overflow-id");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Find log entry with iteration count
    const iterationLog = logs.find((log) => log.includes("iterations"));
    expect(iterationLog).toBeDefined();

    // Parse iteration count from log message
    const match = iterationLog?.match(/(\d+) iterations/);
    const count = match ? parseInt(match[1]) : 0;

    // Binary search should converge in at most 7 iterations
    // (log2(100 scale levels) ≈ 6.6)
    expect(count).toBeLessThanOrEqual(7);
  });

  test("no timing warnings during normal operation", async ({ page }) => {
    // Capture any "Measurement delayed" warnings
    const warnings = captureConsoleLogs(page, "Measurement delayed");

    // Mock API with moderate overflow content
    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "moderate-overflow-id",
            ...generateResumeContent(RESUME_PRESETS.moderateOverflow),
            fit_to_page: false,
          },
        });
      } else {
        await route.continue();
      }
    });

    const editor = new ResumeEditorPage(page);
    await editor.goto("moderate-overflow-id");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Should have no delayed measurement warnings during normal operation
    expect(warnings.length).toBe(0);
  });

  test("severe overflow converges in max 10 iterations", async ({ page }) => {
    // Set up console log capture BEFORE navigation
    const logs = captureConsoleLogs(page, "[Auto-fit]");

    // Mock API with severe overflow content
    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "severe-overflow-id",
            ...generateResumeContent(RESUME_PRESETS.severeOverflow),
            fit_to_page: false,
          },
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/api/resumes/*/partial", async (route) => {
      await route.fulfill({ status: 200, json: { success: true } });
    });

    const editor = new ResumeEditorPage(page);
    await editor.goto("severe-overflow-id");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Find log entry with iteration count
    const iterationLog = logs.find((log) => log.includes("iterations"));
    expect(iterationLog).toBeDefined();

    // Parse iteration count from log message
    const match = iterationLog?.match(/(\d+) iterations/);
    const count = match ? parseInt(match[1]) : 0;

    // Even severe overflow should converge in reasonable iterations
    expect(count).toBeLessThanOrEqual(10);
  });

  test("early exit when content already fits (1 iteration)", async ({
    page,
  }) => {
    // Set up console log capture BEFORE navigation
    const logs = captureConsoleLogs(page, "[Auto-fit]");

    // Mock API with minimal content that already fits
    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "minimal-id",
            ...generateResumeContent(RESUME_PRESETS.minimal),
            fit_to_page: false,
          },
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/api/resumes/*/partial", async (route) => {
      await route.fulfill({ status: 200, json: { success: true } });
    });

    const editor = new ResumeEditorPage(page);
    await editor.goto("minimal-id");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Should be fitted with no reductions
    expect(await editor.getStatus()).toBe("fitted");
    expect(await editor.getAppliedReductions()).toHaveLength(0);

    // Check for early exit pattern in logs
    const iterationLog = logs.find((log) => log.includes("iterations"));
    if (iterationLog) {
      const match = iterationLog.match(/(\d+) iterations/);
      const count = match ? parseInt(match[1]) : 0;
      // Should exit very quickly when content already fits
      expect(count).toBeLessThanOrEqual(2);
    }
  });

  test("logs compactness level during fitting", async ({ page }) => {
    // Set up console log capture BEFORE navigation
    const logs = captureConsoleLogs(page, "[Auto-fit]");

    // Mock API with moderate overflow content
    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "compact-id",
            ...generateResumeContent(RESUME_PRESETS.moderateOverflow),
            fit_to_page: false,
          },
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/api/resumes/*/partial", async (route) => {
      await route.fulfill({ status: 200, json: { success: true } });
    });

    const editor = new ResumeEditorPage(page);
    await editor.goto("compact-id");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Should have logged some fitting activity
    expect(logs.length).toBeGreaterThan(0);

    // Check that completion log exists
    const completionLog = logs.find(
      (log) => log.includes("Complete") || log.includes("iterations")
    );
    expect(completionLog).toBeDefined();
  });
});
