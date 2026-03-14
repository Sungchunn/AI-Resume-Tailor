import { test, expect } from "@playwright/test";
import { ResumeEditorPage } from "../fixtures/page-objects/ResumeEditorPage";
import {
  RESUME_PRESETS,
  generateResumeContent,
} from "../fixtures/test-data/resume.fixture";

/**
 * Measurement tests verify that the fit-to-page algorithm correctly
 * measures and responds to different content overflow scenarios.
 */
test.describe("Fit to One Page - Measurement", () => {
  test("no scaling when content fits", async ({ page }) => {
    // Mock API with minimal content that fits on one page
    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "minimal-resume-id",
            ...generateResumeContent(RESUME_PRESETS.minimal),
            fit_to_page: false,
          },
        });
      } else {
        await route.continue();
      }
    });

    const editor = new ResumeEditorPage(page);
    await editor.goto("minimal-resume-id");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    expect(await editor.getStatus()).toBe("fitted");
    expect(await editor.getAppliedReductions()).toHaveLength(0);
    expect(await editor.contentFits()).toBe(true);
  });

  test("slight overflow - minimal scaling", async ({ page }) => {
    // Mock API with slight overflow content
    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "slight-overflow-id",
            ...generateResumeContent(RESUME_PRESETS.slightOverflow),
            fit_to_page: false,
          },
        });
      } else {
        await route.continue();
      }
    });

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

    expect(await editor.getStatus()).toBe("fitted");
    expect(await editor.contentFits()).toBe(true);
  });

  test("severe overflow - shows warning", async ({ page }) => {
    // Mock API with severe overflow content that will hit minimums
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

    const editor = new ResumeEditorPage(page);
    await editor.goto("severe-overflow-id");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    expect(await editor.getStatus()).toBe("minimum_reached");
    await expect(editor.minimumWarning).toBeVisible();

    // Verify multiple reduction types were applied
    const reductions = await editor.getAppliedReductions();
    expect(reductions.some((r) => r.toLowerCase().includes("spacing"))).toBe(
      true
    );
    expect(reductions.some((r) => r.toLowerCase().includes("font"))).toBe(true);
  });
});
