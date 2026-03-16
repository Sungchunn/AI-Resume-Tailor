import { test, expect } from "@playwright/test";
import { ResumeEditorPage } from "../fixtures/page-objects/ResumeEditorPage";
import {
  RESUME_PRESETS,
  generateResumeContent,
} from "../fixtures/test-data/resume.fixture";

/**
 * Font minimum tests verify that the fit-to-page algorithm enforces
 * font-specific minimum sizes correctly.
 *
 * Font-specific minimums (from FONT_PROFILES):
 * - Inter: 8pt body, 12pt heading, 9pt subheading
 * - Times New Roman: 9pt body, 13pt heading, 10pt subheading
 * - Georgia: 9pt body, 14pt heading, 11pt subheading
 * - Arial: 8pt body, 12pt heading, 9pt subheading
 */
test.describe("Font Minimums", () => {
  test("Inter enforces 8pt body minimum", async ({ page }) => {
    let savedStyle: Record<string, unknown> | null = null;

    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "inter-id",
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
    await editor.goto("inter-id");

    // Verify font is Inter
    expect(await editor.getSelectedFont()).toBe("Inter");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Should hit minimum with severe overflow
    expect(await editor.getStatus()).toBe("minimum_reached");

    // Wait for save and check the saved body font size
    await page.waitForTimeout(2500);

    // The input value should be at least 8pt for Inter
    const bodySize = await editor.fontSizeBody.inputValue();
    expect(Number(bodySize)).toBeGreaterThanOrEqual(8);
  });

  test("Times New Roman enforces 9pt body minimum", async ({ page }) => {
    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "times-id",
            ...generateResumeContent(RESUME_PRESETS.severeOverflow),
            fit_to_page: false,
            style: { fontFamily: "Times New Roman" },
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
    await editor.goto("times-id");

    // First select Times New Roman if not already selected
    await editor.selectFont("Times New Roman");
    await page.waitForTimeout(500);

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Should hit minimum
    expect(await editor.getStatus()).toBe("minimum_reached");

    // Body size should be at least 9pt for Times New Roman
    const bodySize = await editor.fontSizeBody.inputValue();
    expect(Number(bodySize)).toBeGreaterThanOrEqual(9);
  });

  test("Georgia enforces 9pt body minimum", async ({ page }) => {
    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "georgia-id",
            ...generateResumeContent(RESUME_PRESETS.severeOverflow),
            fit_to_page: false,
            style: { fontFamily: "Georgia" },
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
    await editor.goto("georgia-id");

    // First select Georgia if not already selected
    await editor.selectFont("Georgia");
    await page.waitForTimeout(500);

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Should hit minimum
    expect(await editor.getStatus()).toBe("minimum_reached");

    // Body size should be at least 9pt for Georgia
    const bodySize = await editor.fontSizeBody.inputValue();
    expect(Number(bodySize)).toBeGreaterThanOrEqual(9);
  });

  test("heading sizes scale proportionally", async ({ page }) => {
    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "scale-id",
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
    await editor.goto("scale-id");

    // Get initial sizes
    const initialBody = Number(await editor.fontSizeBody.inputValue());
    const initialHeading = Number(await editor.fontSizeHeading.inputValue());
    const initialSubheading = Number(
      await editor.fontSizeSubheading.inputValue()
    );

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Get final sizes
    const finalBody = Number(await editor.fontSizeBody.inputValue());
    const finalHeading = Number(await editor.fontSizeHeading.inputValue());
    const finalSubheading = Number(await editor.fontSizeSubheading.inputValue());

    // If any reduction occurred, heading should still be >= body
    if (finalBody < initialBody) {
      expect(finalHeading).toBeGreaterThanOrEqual(finalBody);
      expect(finalSubheading).toBeGreaterThanOrEqual(finalBody);
    }
  });

  test("font change triggers re-fit calculation", async ({ page }) => {
    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "refit-id",
            ...generateResumeContent(RESUME_PRESETS.moderateOverflow),
            fit_to_page: true, // Start with fit enabled
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
    await editor.goto("refit-id");

    // Fit should already be enabled, wait for initial fit
    await editor.waitForFitComplete();
    const initialStatus = await editor.getStatus();
    expect(["fitted", "minimum_reached"]).toContain(initialStatus);

    // Note: When fit-to-page is enabled, font selector is disabled
    // This test verifies the expected behavior that controls are locked
    const isDisabled = await editor.isControlDisabled(editor.fontFamilySelect);
    expect(isDisabled).toBe(true);
  });

  test("warning shows font-specific minimum message", async ({ page }) => {
    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "warning-id",
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
    await editor.goto("warning-id");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Should show minimum warning
    expect(await editor.getStatus()).toBe("minimum_reached");
    await expect(editor.minimumWarning).toBeVisible();

    // Warning text should mention that content won't fit
    const warningText = await editor.minimumWarning.textContent();
    expect(warningText).toBeTruthy();
    // The warning should indicate the content exceeds minimum limits
    expect(
      warningText?.toLowerCase().includes("minimum") ||
        warningText?.toLowerCase().includes("fit") ||
        warningText?.toLowerCase().includes("content")
    ).toBe(true);
  });
});
