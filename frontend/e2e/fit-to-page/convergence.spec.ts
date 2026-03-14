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
});
