import { test, expect } from "@playwright/test";
import { ResumeEditorPage } from "../fixtures/page-objects/ResumeEditorPage";
import {
  RESUME_PRESETS,
  generateResumeContent,
} from "../fixtures/test-data/resume.fixture";

/**
 * Fit-to-Page Visual Regression Tests
 *
 * These tests capture visual baselines for the fit-to-page feature
 * and detect unintended visual changes.
 *
 * Test Coverage:
 * - Fitted resume: Visual state after successful fit
 * - Minimum warning: Warning UI when content hits minimum thresholds
 * - Adjustments list: Applied reductions display
 *
 * Screenshot Thresholds:
 * - fitted-resume.png: maxDiffPixels: 100 (text rendering variations OK)
 * - minimum-warning.png: maxDiffPixels: 50 (warning UI should be stable)
 * - adjustments-list.png: maxDiffPixels: 30 (small component, low variance)
 */

test.describe("Fit to Page Visual Regression", () => {
  test.beforeEach(async ({ page }) => {
    // Disable CSS animations for visual consistency
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `,
    });
  });

  test("fitted resume matches baseline", async ({ page }) => {
    // Mock API with slight overflow content that will be fitted
    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "visual-test-fitted",
            ...generateResumeContent(RESUME_PRESETS.slightOverflow),
            fit_to_page: false,
          },
        });
      } else {
        await route.continue();
      }
    });

    const editor = new ResumeEditorPage(page);
    await editor.goto("visual-test-fitted");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Wait for layout to stabilize after fit completes
    await page.waitForTimeout(300);

    // Capture screenshot of the preview page
    await expect(editor.previewPage).toHaveScreenshot("fitted-resume.png", {
      maxDiffPixels: 100,
      animations: "disabled",
    });
  });

  test("minimum warning renders correctly", async ({ page }) => {
    // Mock API with severe overflow content that will hit minimums
    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "visual-test-severe",
            ...generateResumeContent(RESUME_PRESETS.severeOverflow),
            fit_to_page: false,
          },
        });
      } else {
        await route.continue();
      }
    });

    const editor = new ResumeEditorPage(page);
    await editor.goto("visual-test-severe");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Verify warning is visible before taking screenshot
    await expect(editor.minimumWarning).toBeVisible();

    // Wait for layout to stabilize
    await page.waitForTimeout(300);

    // Capture screenshot of the warning element
    await expect(editor.minimumWarning).toHaveScreenshot("minimum-warning.png", {
      maxDiffPixels: 50,
      animations: "disabled",
    });
  });

  test("adjustments list displays correctly", async ({ page }) => {
    // Mock API with moderate overflow content
    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "visual-test-moderate",
            ...generateResumeContent(RESUME_PRESETS.moderateOverflow),
            fit_to_page: false,
          },
        });
      } else {
        await route.continue();
      }
    });

    const editor = new ResumeEditorPage(page);
    await editor.goto("visual-test-moderate");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Wait for adjustments to render
    await expect(editor.adjustmentsList).toBeVisible();

    // Wait for layout to stabilize
    await page.waitForTimeout(300);

    await expect(editor.adjustmentsList).toHaveScreenshot("adjustments-list.png", {
      maxDiffPixels: 30,
      animations: "disabled",
    });
  });
});

test.describe("Fit to Page Status Badge Visual", () => {
  test.beforeEach(async ({ page }) => {
    // Disable CSS animations for visual consistency
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `,
    });
  });

  test("status badge renders correctly when fitted", async ({ page }) => {
    // Mock API with slight overflow content
    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "visual-test-badge-fitted",
            ...generateResumeContent(RESUME_PRESETS.slightOverflow),
            fit_to_page: false,
          },
        });
      } else {
        await route.continue();
      }
    });

    const editor = new ResumeEditorPage(page);
    await editor.goto("visual-test-badge-fitted");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Verify badge is visible before taking screenshot
    await expect(editor.statusBadge).toBeVisible();

    // Wait for layout to stabilize
    await page.waitForTimeout(300);

    await expect(editor.statusBadge).toHaveScreenshot("status-badge-fitted.png", {
      maxDiffPixels: 20,
      animations: "disabled",
    });
  });

  test("status badge renders correctly at minimum", async ({ page }) => {
    // Mock API with severe overflow content
    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "visual-test-badge-minimum",
            ...generateResumeContent(RESUME_PRESETS.severeOverflow),
            fit_to_page: false,
          },
        });
      } else {
        await route.continue();
      }
    });

    const editor = new ResumeEditorPage(page);
    await editor.goto("visual-test-badge-minimum");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Verify badge is visible and shows minimum state
    await expect(editor.statusBadge).toBeVisible();
    await expect(editor.statusBadge).toHaveText(/At minimum/);

    // Wait for layout to stabilize
    await page.waitForTimeout(300);

    await expect(editor.statusBadge).toHaveScreenshot("status-badge-minimum.png", {
      maxDiffPixels: 20,
      animations: "disabled",
    });
  });
});

test.describe("Fit to Page Toggle Visual States", () => {
  test.beforeEach(async ({ page }) => {
    // Disable CSS animations for visual consistency
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `,
    });
  });

  test("toggle displays correctly in enabled state", async ({ page }) => {
    // Mock API with minimal content
    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "visual-test-toggle-enabled",
            ...generateResumeContent(RESUME_PRESETS.minimal),
            fit_to_page: false,
          },
        });
      } else {
        await route.continue();
      }
    });

    const editor = new ResumeEditorPage(page);
    await editor.goto("visual-test-toggle-enabled");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Wait for layout to stabilize
    await page.waitForTimeout(300);

    await expect(editor.fitToPageToggle).toHaveScreenshot("toggle-enabled.png", {
      maxDiffPixels: 15,
      animations: "disabled",
    });
  });

  test("toggle displays correctly in disabled state", async ({ page }) => {
    // Mock API with minimal content
    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "visual-test-toggle-disabled",
            ...generateResumeContent(RESUME_PRESETS.minimal),
            fit_to_page: false,
          },
        });
      } else {
        await route.continue();
      }
    });

    const editor = new ResumeEditorPage(page);
    await editor.goto("visual-test-toggle-disabled");

    // Ensure toggle is disabled
    await editor.disableFitToPage();

    // Wait for layout to stabilize
    await page.waitForTimeout(300);

    await expect(editor.fitToPageToggle).toHaveScreenshot("toggle-disabled.png", {
      maxDiffPixels: 15,
      animations: "disabled",
    });
  });
});
