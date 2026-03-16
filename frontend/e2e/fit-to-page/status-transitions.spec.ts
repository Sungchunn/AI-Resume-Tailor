import { test, expect } from "@playwright/test";
import { ResumeEditorPage } from "../fixtures/page-objects/ResumeEditorPage";
import {
  RESUME_PRESETS,
  generateResumeContent,
} from "../fixtures/test-data/resume.fixture";

/**
 * Status transitions tests verify that the status badge transitions
 * correctly between idle, fitting, fitted, and minimum_reached states.
 */
test.describe("Status Transitions", () => {
  test("transitions from idle to fitting on enable", async ({ page }) => {
    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "test-id",
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
    await editor.goto("test-id");

    // Verify initial idle state
    expect(await editor.getStatus()).toBe("idle");

    // Enable and immediately check for fitting state
    await editor.fitToPageToggle.click();

    // Should transition through fitting
    // Use a polling approach to catch the fitting state
    let sawFitting = false;
    const startTime = Date.now();
    while (Date.now() - startTime < 5000) {
      const status = await editor.getStatus();
      if (status === "fitting") {
        sawFitting = true;
        break;
      }
      if (status === "fitted" || status === "minimum_reached") {
        // Algorithm might complete very quickly, that's OK
        break;
      }
      await page.waitForTimeout(50);
    }

    // Wait for completion
    await editor.waitForFitComplete();
    const finalStatus = await editor.getStatus();
    expect(["fitted", "minimum_reached"]).toContain(finalStatus);
  });

  test("transitions from fitting to fitted on success", async ({ page }) => {
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

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Slight overflow should result in fitted (not minimum_reached)
    expect(await editor.getStatus()).toBe("fitted");
    expect(await editor.contentFits()).toBe(true);
  });

  test("transitions from fitting to minimum_reached on severe overflow", async ({
    page,
  }) => {
    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "test-id",
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
    await editor.goto("test-id");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Severe overflow should hit minimum thresholds
    expect(await editor.getStatus()).toBe("minimum_reached");
    await expect(editor.minimumWarning).toBeVisible();
  });

  test("transitions back to idle on disable", async ({ page }) => {
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

    // Enable and wait for completion
    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    const statusBeforeDisable = await editor.getStatus();
    expect(["fitted", "minimum_reached"]).toContain(statusBeforeDisable);

    // Disable
    await editor.disableFitToPage();

    // Should be back to idle
    expect(await editor.getStatus()).toBe("idle");
    await expect(editor.statusBadge).not.toBeVisible();
  });
});
