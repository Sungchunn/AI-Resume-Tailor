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

  test("same resume shows consistent fit state across pages", async ({
    page,
  }) => {
    const sharedContent = generateResumeContent(RESUME_PRESETS.moderateOverflow);
    let savedFitToPage = false;
    let savedStyle: Record<string, unknown> = {};

    // Track saves
    await page.route("**/api/resumes/*/partial", async (route) => {
      const body = route.request().postDataJSON();
      if (body?.fit_to_page !== undefined) {
        savedFitToPage = body.fit_to_page;
      }
      if (body?.style) {
        savedStyle = { ...savedStyle, ...body.style };
      }
      await route.fulfill({ status: 200, json: { success: true } });
    });

    // Mock resume API with shared state
    await page.route("**/api/resumes/*", async (route) => {
      if (
        route.request().method() === "GET" &&
        !route.request().url().includes("/partial")
      ) {
        await route.fulfill({
          status: 200,
          json: {
            id: "shared-id",
            ...sharedContent,
            fit_to_page: savedFitToPage,
            style: savedStyle,
          },
        });
      } else if (!route.request().url().includes("/partial")) {
        await route.continue();
      }
    });

    const editor = new ResumeEditorPage(page);

    // Go to edit page and enable fit
    await editor.goto("shared-id");
    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    const editStatus = await editor.getStatus();
    const editBodySize = await editor.fontSizeBody.inputValue();

    // Wait for save
    await page.waitForTimeout(2500);

    // Go to view page
    await editor.gotoView("shared-id");
    await editor.waitForFitComplete();

    const viewStatus = await editor.getStatus();
    const viewBodySize = await editor.fontSizeBody.inputValue();

    // Status and styling should match
    expect(viewStatus).toBe(editStatus);
    expect(viewBodySize).toBe(editBodySize);
  });

  test("tailor editor inherits fit setting from source resume", async ({
    page,
  }) => {
    const sharedContent = generateResumeContent(RESUME_PRESETS.slightOverflow);

    // Mock source resume API - fit is enabled
    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "source-resume-id",
            ...sharedContent,
            fit_to_page: true,
            style: {
              fontFamily: "Inter",
              fontSizeBody: 9,
              sectionSpacing: 10,
            },
          },
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/api/resumes/*/partial", async (route) => {
      await route.fulfill({ status: 200, json: { success: true } });
    });

    // Mock resume builds API - should inherit from source
    await page.route("**/api/resume-builds/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "build-from-source",
            resume_id: "source-resume-id",
            job_listing_id: "job-id",
            ...sharedContent,
            fit_to_page: true, // Inherited
            style: {
              fontFamily: "Inter",
              fontSizeBody: 9,
              sectionSpacing: 10,
            },
          },
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/api/resume-builds/*/partial", async (route) => {
      await route.fulfill({ status: 200, json: { success: true } });
    });

    const editor = new ResumeEditorPage(page);
    await editor.gotoTailorEditor("build-from-source");

    // Should start with fit already enabled
    expect(await editor.isFitToPageEnabled()).toBe(true);

    await editor.waitForFitComplete();
    const status = await editor.getStatus();
    expect(["fitted", "minimum_reached"]).toContain(status);
  });

  test("both editors use same algorithm (compare compactness)", async ({
    page,
  }) => {
    const sharedContent = generateResumeContent(RESUME_PRESETS.moderateOverflow);

    // Mock resume API
    await page.route("**/api/resumes/*", async (route) => {
      if (
        route.request().method() === "GET" &&
        !route.request().url().includes("/partial")
      ) {
        await route.fulfill({
          status: 200,
          json: {
            id: "compare-id",
            ...sharedContent,
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

    // Mock resume builds API
    await page.route("**/api/resume-builds/*", async (route) => {
      if (
        route.request().method() === "GET" &&
        !route.request().url().includes("/partial")
      ) {
        await route.fulfill({
          status: 200,
          json: {
            id: "compare-build-id",
            resume_id: "compare-id",
            job_listing_id: "job-id",
            ...sharedContent,
            fit_to_page: false,
          },
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/api/resume-builds/*/partial", async (route) => {
      await route.fulfill({ status: 200, json: { success: true } });
    });

    const editor = new ResumeEditorPage(page);

    // Test library editor
    await editor.goto("compare-id");
    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    const libraryStatus = await editor.getStatus();
    const libraryReductions = await editor.getAppliedReductions();

    // Reset by navigating to tailor editor
    await editor.gotoTailorEditor("compare-build-id");
    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    const tailorStatus = await editor.getStatus();
    const tailorReductions = await editor.getAppliedReductions();

    // Both should reach same conclusion (fitted or minimum_reached)
    expect(tailorStatus).toBe(libraryStatus);

    // Reduction count should be similar (allowing for timing differences)
    expect(Math.abs(libraryReductions.length - tailorReductions.length)).toBeLessThanOrEqual(1);
  });
});
