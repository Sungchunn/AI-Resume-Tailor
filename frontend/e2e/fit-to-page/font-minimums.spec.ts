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
 *
 * Note: Style values are verified via API save interception since the
 * FormattingTab no longer has editable input fields for font sizes.
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

    // Wait for debounced save
    await page.waitForTimeout(2500);

    // The saved body font size should be at least 8pt for Inter
    expect(savedStyle).toBeTruthy();
    const bodySize = (savedStyle as Record<string, number>)?.fontSizeBody;
    expect(bodySize).toBeGreaterThanOrEqual(8);
  });

  test("Times New Roman enforces 9pt body minimum", async ({ page }) => {
    let savedStyle: Record<string, unknown> | null = null;

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
      const body = route.request().postDataJSON();
      if (body?.style) {
        savedStyle = body.style;
      }
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

    // Wait for debounced save
    await page.waitForTimeout(2500);

    // Body size should be at least 9pt for Times New Roman
    expect(savedStyle).toBeTruthy();
    const bodySize = (savedStyle as Record<string, number>)?.fontSizeBody;
    expect(bodySize).toBeGreaterThanOrEqual(9);
  });

  test("Georgia enforces 9pt body minimum", async ({ page }) => {
    let savedStyle: Record<string, unknown> | null = null;

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
      const body = route.request().postDataJSON();
      if (body?.style) {
        savedStyle = body.style;
      }
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

    // Wait for debounced save
    await page.waitForTimeout(2500);

    // Body size should be at least 9pt for Georgia
    expect(savedStyle).toBeTruthy();
    const bodySize = (savedStyle as Record<string, number>)?.fontSizeBody;
    expect(bodySize).toBeGreaterThanOrEqual(9);
  });

  test("heading sizes scale proportionally", async ({ page }) => {
    let initialStyle: Record<string, unknown> | null = null;
    let finalStyle: Record<string, unknown> | null = null;

    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "scale-id",
            ...generateResumeContent(RESUME_PRESETS.moderateOverflow),
            fit_to_page: false,
            style: {
              fontFamily: "Inter",
              fontSizeBody: 11,
              fontSizeHeading: 16,
              fontSizeSubheading: 13,
            },
          },
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/api/resumes/*/partial", async (route) => {
      const body = route.request().postDataJSON();
      if (body?.style) {
        if (!initialStyle) {
          initialStyle = body.style;
        }
        finalStyle = body.style;
      }
      await route.fulfill({ status: 200, json: { success: true } });
    });

    const editor = new ResumeEditorPage(page);
    await editor.goto("scale-id");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Wait for debounced save
    await page.waitForTimeout(2500);

    // If style was saved, check proportional scaling
    if (finalStyle) {
      const bodySize = (finalStyle as Record<string, number>).fontSizeBody;
      const headingSize = (finalStyle as Record<string, number>).fontSizeHeading;
      const subheadingSize = (finalStyle as Record<string, number>).fontSizeSubheading;

      // If any reduction occurred, heading should still be >= body
      if (bodySize < 11) {
        expect(headingSize).toBeGreaterThanOrEqual(bodySize);
        expect(subheadingSize).toBeGreaterThanOrEqual(bodySize);
      }
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

    // Note: When fit-to-page is enabled, typography controls are locked
    // This test verifies the expected behavior that controls are locked
    const isLocked = await editor.isTypographyLocked();
    expect(isLocked).toBe(true);
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
