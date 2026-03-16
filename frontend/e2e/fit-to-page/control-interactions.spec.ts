import { test, expect } from "@playwright/test";
import { ResumeEditorPage } from "../fixtures/page-objects/ResumeEditorPage";
import {
  RESUME_PRESETS,
  generateResumeContent,
} from "../fixtures/test-data/resume.fixture";

/**
 * Control interactions tests verify that style controls are properly
 * disabled when fit-to-page is active and re-enabled when disabled.
 */
test.describe("Control Interactions", () => {
  test("font selector disabled when fit-to-page active", async ({ page }) => {
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

    // Initially, controls should be enabled
    expect(await editor.isControlDisabled(editor.fontFamilySelect)).toBe(false);

    // Enable fit-to-page
    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Now font selector should be disabled
    expect(await editor.isControlDisabled(editor.fontFamilySelect)).toBe(true);
  });

  test("spacing inputs disabled when fit-to-page active", async ({ page }) => {
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

    // Initially, spacing controls should be enabled
    expect(await editor.isControlDisabled(editor.spacingLine)).toBe(false);
    expect(await editor.isControlDisabled(editor.spacingSection)).toBe(false);
    expect(await editor.isControlDisabled(editor.spacingEntry)).toBe(false);

    // Enable fit-to-page
    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Now spacing controls should be disabled
    expect(await editor.isControlDisabled(editor.spacingLine)).toBe(true);
    expect(await editor.isControlDisabled(editor.spacingSection)).toBe(true);
    expect(await editor.isControlDisabled(editor.spacingEntry)).toBe(true);
  });

  test("font size inputs disabled when fit-to-page active", async ({ page }) => {
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

    // Initially, font size controls should be enabled
    expect(await editor.isControlDisabled(editor.fontSizeBody)).toBe(false);
    expect(await editor.isControlDisabled(editor.fontSizeHeading)).toBe(false);
    expect(await editor.isControlDisabled(editor.fontSizeSubheading)).toBe(
      false
    );

    // Enable fit-to-page
    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Now font size controls should be disabled
    expect(await editor.isControlDisabled(editor.fontSizeBody)).toBe(true);
    expect(await editor.isControlDisabled(editor.fontSizeHeading)).toBe(true);
    expect(await editor.isControlDisabled(editor.fontSizeSubheading)).toBe(true);
  });

  test("disabling fit-to-page re-enables controls", async ({ page }) => {
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

    // Verify controls are disabled
    expect(await editor.isControlDisabled(editor.fontFamilySelect)).toBe(true);
    expect(await editor.isControlDisabled(editor.fontSizeBody)).toBe(true);
    expect(await editor.isControlDisabled(editor.spacingLine)).toBe(true);

    // Disable fit-to-page
    await editor.disableFitToPage();

    // Controls should be re-enabled
    expect(await editor.isControlDisabled(editor.fontFamilySelect)).toBe(false);
    expect(await editor.isControlDisabled(editor.fontSizeBody)).toBe(false);
    expect(await editor.isControlDisabled(editor.spacingLine)).toBe(false);
    expect(await editor.isControlDisabled(editor.spacingSection)).toBe(false);
    expect(await editor.isControlDisabled(editor.spacingEntry)).toBe(false);
    expect(await editor.isControlDisabled(editor.fontSizeHeading)).toBe(false);
    expect(await editor.isControlDisabled(editor.fontSizeSubheading)).toBe(
      false
    );
  });

  test("changing font before enabling triggers correct minimums", async ({
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
            style: { fontFamily: "Inter" },
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

    // Change to Georgia (which has 9pt minimum vs Inter's 8pt)
    await editor.selectFont("Georgia");
    await page.waitForTimeout(300);

    // Now enable fit-to-page
    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Should hit minimum with severe overflow
    expect(await editor.getStatus()).toBe("minimum_reached");

    // Body size should respect Georgia's 9pt minimum
    const bodySize = Number(await editor.fontSizeBody.inputValue());
    expect(bodySize).toBeGreaterThanOrEqual(9);
  });
});
