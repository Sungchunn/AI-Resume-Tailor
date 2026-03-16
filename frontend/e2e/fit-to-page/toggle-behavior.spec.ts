import { test, expect } from "@playwright/test";
import { ResumeEditorPage } from "../fixtures/page-objects/ResumeEditorPage";
import {
  RESUME_PRESETS,
  generateResumeContent,
} from "../fixtures/test-data/resume.fixture";

/**
 * Toggle behavior tests verify that the fit-to-page toggle works
 * correctly on both library and tailor editor pages.
 */
test.describe("Toggle Behavior", () => {
  test("toggle enabled state reflects correctly on library editor", async ({
    page,
  }) => {
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
      await route.fulfill({ status: 200, json: { success: true } });
    });

    const editor = new ResumeEditorPage(page);
    await editor.goto("test-id");

    // Verify initial state is disabled
    expect(await editor.isFitToPageEnabled()).toBe(false);
    expect(await editor.getStatus()).toBe("idle");

    // Enable and verify
    await editor.enableFitToPage();
    expect(await editor.isFitToPageEnabled()).toBe(true);

    await editor.waitForFitComplete();
    const status = await editor.getStatus();
    expect(["fitted", "minimum_reached"]).toContain(status);
  });

  test("toggle enabled state reflects correctly on tailor editor", async ({
    page,
  }) => {
    await page.route("**/api/resume-builds/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "build-id",
            resume_id: "source-resume-id",
            job_listing_id: "job-id",
            ...generateResumeContent(RESUME_PRESETS.slightOverflow),
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
    await editor.gotoTailorEditor("build-id");

    // Verify initial state is disabled
    expect(await editor.isFitToPageEnabled()).toBe(false);
    expect(await editor.getStatus()).toBe("idle");

    // Enable and verify
    await editor.enableFitToPage();
    expect(await editor.isFitToPageEnabled()).toBe(true);

    await editor.waitForFitComplete();
    const status = await editor.getStatus();
    expect(["fitted", "minimum_reached"]).toContain(status);
  });

  test("toggle can be disabled after enabling", async ({ page }) => {
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
      await route.fulfill({ status: 200, json: { success: true } });
    });

    const editor = new ResumeEditorPage(page);
    await editor.goto("test-id");

    // Enable first
    await editor.enableFitToPage();
    await editor.waitForFitComplete();
    expect(await editor.isFitToPageEnabled()).toBe(true);

    // Now disable
    await editor.disableFitToPage();
    expect(await editor.isFitToPageEnabled()).toBe(false);
    expect(await editor.getStatus()).toBe("idle");
  });

  test("toggle state syncs with aria-checked attribute", async ({ page }) => {
    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "test-id",
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
    await editor.goto("test-id");

    // Initial: aria-checked should be false
    let ariaChecked = await editor.fitToPageToggle.getAttribute("aria-checked");
    expect(ariaChecked).toBe("false");

    // After enabling: aria-checked should be true
    await editor.enableFitToPage();
    ariaChecked = await editor.fitToPageToggle.getAttribute("aria-checked");
    expect(ariaChecked).toBe("true");

    // After disabling: aria-checked should be false again
    await editor.disableFitToPage();
    ariaChecked = await editor.fitToPageToggle.getAttribute("aria-checked");
    expect(ariaChecked).toBe("false");
  });

  test("status badge appears only when enabled", async ({ page }) => {
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
      await route.fulfill({ status: 200, json: { success: true } });
    });

    const editor = new ResumeEditorPage(page);
    await editor.goto("test-id");

    // Badge should not be visible when disabled
    await expect(editor.statusBadge).not.toBeVisible();

    // Enable and wait for fitting
    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Badge should now be visible
    await expect(editor.statusBadge).toBeVisible();

    // Disable again
    await editor.disableFitToPage();

    // Badge should be hidden again
    await expect(editor.statusBadge).not.toBeVisible();
  });
});
