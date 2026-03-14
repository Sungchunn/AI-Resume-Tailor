import { test, expect } from "@playwright/test";
import { ResumeEditorPage } from "../fixtures/page-objects/ResumeEditorPage";
import {
  RESUME_PRESETS,
  generateResumeContent,
} from "../fixtures/test-data/resume.fixture";

/**
 * Persistence tests verify that fit-to-page settings are saved
 * correctly and persist across page reloads.
 */
test.describe("Auto-Save and Persistence", () => {
  test("auto-saves after debounce", async ({ page }) => {
    let saveCount = 0;

    // Track save API calls
    await page.route("**/api/resumes/*/partial", async (route) => {
      saveCount++;
      await route.fulfill({
        status: 200,
        json: { success: true },
      });
    });

    // Mock resume API
    await page.route("**/api/resumes/*", async (route) => {
      if (
        route.request().method() === "GET" &&
        !route.request().url().includes("/partial")
      ) {
        await route.fulfill({
          status: 200,
          json: {
            id: "overflow-id",
            ...generateResumeContent(RESUME_PRESETS.slightOverflow),
            fit_to_page: false,
          },
        });
      } else if (!route.request().url().includes("/partial")) {
        await route.continue();
      }
    });

    const editor = new ResumeEditorPage(page);
    await editor.goto("overflow-id");
    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Wait for debounce (2000ms) + buffer
    await page.waitForTimeout(2500);

    expect(saveCount).toBeGreaterThanOrEqual(1);
  });

  test("no save during fitting", async ({ page }) => {
    let savesDuringFit = 0;
    let isFitting = false;

    // Track fitting state from console
    page.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("fitting")) isFitting = true;
      if (text.includes("fitted") || text.includes("minimum")) isFitting = false;
    });

    // Count saves that happen during fitting
    await page.route("**/api/resumes/*/partial", async (route) => {
      if (isFitting) savesDuringFit++;
      await route.fulfill({
        status: 200,
        json: { success: true },
      });
    });

    // Mock resume API
    await page.route("**/api/resumes/*", async (route) => {
      if (
        route.request().method() === "GET" &&
        !route.request().url().includes("/partial")
      ) {
        await route.fulfill({
          status: 200,
          json: {
            id: "overflow-id",
            ...generateResumeContent(RESUME_PRESETS.moderateOverflow),
            fit_to_page: false,
          },
        });
      } else if (!route.request().url().includes("/partial")) {
        await route.continue();
      }
    });

    const editor = new ResumeEditorPage(page);
    await editor.goto("overflow-id");
    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // No API calls should have happened while fitting was in progress
    expect(savesDuringFit).toBe(0);
  });

  test("preference persists across reload", async ({ page }) => {
    let savedFitToPage = false;

    // Track saves and update saved state
    await page.route("**/api/resumes/*/partial", async (route) => {
      const body = route.request().postDataJSON();
      if (body?.fit_to_page !== undefined) {
        savedFitToPage = body.fit_to_page;
      }
      await route.fulfill({
        status: 200,
        json: { success: true },
      });
    });

    // Mock resume API - return saved fit_to_page state
    await page.route("**/api/resumes/*", async (route) => {
      if (
        route.request().method() === "GET" &&
        !route.request().url().includes("/partial")
      ) {
        await route.fulfill({
          status: 200,
          json: {
            id: "overflow-id",
            ...generateResumeContent(RESUME_PRESETS.slightOverflow),
            fit_to_page: savedFitToPage,
          },
        });
      } else if (!route.request().url().includes("/partial")) {
        await route.continue();
      }
    });

    const editor = new ResumeEditorPage(page);
    await editor.goto("overflow-id");

    // Enable and wait for save
    await editor.enableFitToPage();
    await editor.waitForFitComplete();
    await page.waitForTimeout(2500); // Wait for debounced save

    // Reload page
    await page.reload();
    await editor.previewPage.waitFor({ state: "visible" });

    // Toggle should still be enabled (based on saved state)
    const isEnabled = await editor.fitToPageToggle.getAttribute("aria-checked");
    expect(isEnabled).toBe("true");
  });
});
