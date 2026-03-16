import { test, expect } from "@playwright/test";
import { ResumeEditorPage } from "../fixtures/page-objects/ResumeEditorPage";
import {
  RESUME_PRESETS,
  generateResumeContent,
} from "../fixtures/test-data/resume.fixture";

/**
 * Control interactions tests verify that style controls are properly
 * locked when fit-to-page is active and unlocked when disabled.
 *
 * UI Note: The FormattingTab uses a preset-based font grid (not a dropdown).
 * When fit-to-page is active, the grid has `pointer-events-none` class
 * and individual preset buttons are disabled.
 */
test.describe("Control Interactions", () => {
  test("font presets locked when fit-to-page active", async ({ page }) => {
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

    // Initially, typography should not be locked
    expect(await editor.isTypographyLocked()).toBe(false);
    expect(await editor.isFontPresetDisabled("inter")).toBe(false);

    // Enable fit-to-page
    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Now typography controls should be locked
    expect(await editor.isTypographyLocked()).toBe(true);
    expect(await editor.isFontPresetDisabled("inter")).toBe(true);
    expect(await editor.isFontPresetDisabled("georgia")).toBe(true);
  });

  test("disabling fit-to-page unlocks font presets", async ({ page }) => {
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

    // Enable fit-to-page
    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Verify controls are locked
    expect(await editor.isTypographyLocked()).toBe(true);

    // Disable fit-to-page
    await editor.disableFitToPage();

    // Controls should be unlocked again
    expect(await editor.isTypographyLocked()).toBe(false);
    expect(await editor.isFontPresetDisabled("inter")).toBe(false);
    expect(await editor.isFontPresetDisabled("georgia")).toBe(false);
    expect(await editor.isFontPresetDisabled("timesNewRoman")).toBe(false);
  });

  test("changing font before enabling triggers correct minimums", async ({
    page,
  }) => {
    let savedStyle: Record<string, unknown> | null = null;

    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "test-id",
            ...generateResumeContent(RESUME_PRESETS.severeOverflow),
            fit_to_page: false,
            style: { fontFamily: "Inter" },
          },
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/api/resumes/*/partial", async (route) => {
      const body = route.request().postDataJSON();
      if (body?.style) {
        savedStyle = body.style;
      }
      await route.fulfill({ status: 200, json: { success: true } });
    });

    const editor = new ResumeEditorPage(page);
    await editor.goto("test-id");

    // Change to Georgia (which has 9pt minimum vs Inter's 8pt)
    await editor.selectFont("Georgia");
    await page.waitForTimeout(300);

    // Now enable fit-to-page
    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Should hit minimum with severe overflow
    expect(await editor.getStatus()).toBe("minimum_reached");

    // Wait for debounced save
    await page.waitForTimeout(2500);

    // Body size should respect Georgia's 9pt minimum (check via saved style)
    expect(savedStyle).toBeTruthy();
    const bodySize = (savedStyle as Record<string, number>)?.fontSizeBody;
    expect(bodySize).toBeGreaterThanOrEqual(9);
  });
});
