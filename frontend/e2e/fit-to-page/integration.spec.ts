import { test, expect } from "@playwright/test";
import { ResumeEditorPage } from "../fixtures/page-objects/ResumeEditorPage";
import {
  RESUME_PRESETS,
  generateResumeContent,
} from "../fixtures/test-data/resume.fixture";

/**
 * Integration tests verify that fit-to-page works consistently
 * across all pages that display resume previews.
 */
test.describe("Cross-Page Integration", () => {
  test("works on view page", async ({ page }) => {
    // Mock resume API for view page
    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "test-id",
            ...generateResumeContent(RESUME_PRESETS.slightOverflow),
            fit_to_page: false,
          },
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/api/resumes/*/partial", async (route) => {
      await route.fulfill({
        status: 200,
        json: { success: true },
      });
    });

    const editor = new ResumeEditorPage(page);
    await editor.gotoView("test-id");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    const status = await editor.getStatus();
    expect(["fitted", "minimum_reached"]).toContain(status);
  });

  test("works on edit page", async ({ page }) => {
    // Mock resume API for edit page
    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "test-id",
            ...generateResumeContent(RESUME_PRESETS.slightOverflow),
            fit_to_page: false,
          },
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/api/resumes/*/partial", async (route) => {
      await route.fulfill({
        status: 200,
        json: { success: true },
      });
    });

    const editor = new ResumeEditorPage(page);
    await editor.goto("test-id");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    const status = await editor.getStatus();
    expect(["fitted", "minimum_reached"]).toContain(status);
  });

  test("works on tailor editor", async ({ page }) => {
    // Mock resume builds API for tailor editor
    await page.route("**/api/resume-builds/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "build-id",
            resume_id: "test-resume-id",
            job_listing_id: "test-job-id",
            ...generateResumeContent(RESUME_PRESETS.slightOverflow),
            fit_to_page: false,
          },
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/api/resume-builds/*/partial", async (route) => {
      await route.fulfill({
        status: 200,
        json: { success: true },
      });
    });

    const editor = new ResumeEditorPage(page);
    await editor.gotoTailorEditor("build-id");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    const status = await editor.getStatus();
    expect(["fitted", "minimum_reached"]).toContain(status);
  });
});
