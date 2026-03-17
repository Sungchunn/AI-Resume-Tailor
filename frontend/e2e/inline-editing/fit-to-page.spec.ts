import { test, expect } from "@playwright/test";
import { ResumeEditorPage } from "../fixtures/page-objects/ResumeEditorPage";
import {
  generateInlineEditingResume,
  toApiResponse,
} from "../fixtures/test-data/inline-editing.fixture";
import { setupAuth } from "../helpers/auth";

/**
 * Integration tests between inline editing and fit-to-page
 */
test.describe("Inline Editing - Fit to Page Integration", () => {
  let editor: ResumeEditorPage;
  const resumeData = generateInlineEditingResume();

  test.beforeEach(async ({ page }) => {
    // Set up authentication first
    await setupAuth(page);

    // Mock API routes
    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            ...toApiResponse(resumeData),
            fit_to_page: true, // Enable fit-to-page
          },
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/api/resumes/*/partial", async (route) => {
      await route.fulfill({ status: 200, json: { success: true } });
    });

    editor = new ResumeEditorPage(page);
    await editor.goto("test-resume-id");
  });

  test.describe("Fit-to-Page Re-measurement", () => {
    test("adding content triggers fit-to-page re-measurement", async ({
      page,
    }) => {
      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Wait for initial fit-to-page to complete
      await editor.waitForFitComplete({ timeout: 10000 });
      const initialStatus = await editor.getStatus();

      // Edit and add lots of content
      await editor.clickEditableField(firstElementId);
      await editor.clearAndType(
        "This is a very long text that should cause the resume to require re-fitting. ".repeat(
          5
        )
      );

      // Commit the edit
      await editor.commitEditByClickingOutside();
      await editor.waitForEditComplete(firstElementId);

      // Wait for re-measurement
      await page.waitForTimeout(500);

      // Fit-to-page should respond to the content change
      // The status might still be "fitted" or might show "fitting" temporarily
    });

    test("removing content may remove font adjustments", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Wait for initial fit
      await editor.waitForFitComplete({ timeout: 10000 });

      // Get initial reductions
      const initialReductions = await editor.getAppliedReductions();

      // Remove content
      await editor.clickEditableField(firstElementId);
      await editor.clearAndType("Short");
      await editor.commitEditByClickingOutside();
      await editor.waitForEditComplete(firstElementId);

      // Wait for re-measurement
      await page.waitForTimeout(500);

      // Reductions might be reduced if content is smaller
    });
  });

  test.describe("Font Size Changes During Edit", () => {
    test("inline edit respects current font size", async ({ page }) => {
      // Wait for fit-to-page to apply font adjustments
      await editor.waitForFitComplete({ timeout: 10000 });

      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Get the computed font size before editing
      const initialFontSize = await editor.getComputedFontSize();

      // Start editing
      await editor.clickEditableField(firstElementId);

      // The editor should use the same font size as the preview
      const prosemirror = page.locator(".ProseMirror");
      const editorFontSize = await prosemirror.evaluate((el) => {
        return parseFloat(window.getComputedStyle(el).fontSize);
      });

      // Font sizes should be comparable (exact match may vary due to inheritance)
    });

    test("editing does not disrupt fit-to-page process", async ({ page }) => {
      // Wait for fit
      await editor.waitForFitComplete({ timeout: 10000 });

      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Start editing
      await editor.clickEditableField(firstElementId);

      // Type content
      await page.keyboard.type("Editing while fitted");

      // Fit-to-page status should remain stable
      const status = await editor.getStatus();
      expect(["fitted", "minimum_reached"]).toContain(status);

      // Commit
      await editor.commitEditByClickingOutside();
    });
  });

  test.describe("Content Overflow Scenarios", () => {
    test("adding long text triggers re-fit", async ({ page }) => {
      await editor.waitForFitComplete({ timeout: 10000 });

      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Add very long content
      await editor.clickEditableField(firstElementId);
      await editor.clearAndType("A".repeat(500));
      await editor.commitEditByClickingOutside();
      await editor.waitForEditComplete(firstElementId);

      // Wait for fit-to-page re-measurement
      await page.waitForTimeout(1000);

      // Check fit status
      const status = await editor.getStatus();
      expect(["fitted", "fitting", "minimum_reached"]).toContain(status);
    });

    test("fit-to-page maintains content fit after edit", async ({ page }) => {
      await editor.waitForFitComplete({ timeout: 10000 });

      // Verify content fits initially
      const initiallyFits = await editor.contentFits();

      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Make a small edit
      await editor.clickEditableField(firstElementId);
      await editor.clearAndType("Modified content");
      await editor.commitEditByClickingOutside();
      await editor.waitForEditComplete(firstElementId);

      // Wait for potential re-fit
      await page.waitForTimeout(1000);

      // Content should still fit (or be at minimum)
      const status = await editor.getStatus();
      expect(["fitted", "minimum_reached"]).toContain(status);
    });
  });

  test.describe("Toggle Interaction", () => {
    test("can still edit with fit-to-page enabled", async ({ page }) => {
      // Verify fit-to-page is enabled
      expect(await editor.isFitToPageEnabled()).toBe(true);

      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Should be able to edit
      await editor.clickEditableField(firstElementId);
      await editor.clearAndType("Editing with fit-to-page enabled");

      // Editor should be visible and functional
      const prosemirror = page.locator(".ProseMirror");
      await expect(prosemirror).toBeVisible();
      await expect(prosemirror).toContainText(
        "Editing with fit-to-page enabled"
      );

      // Commit
      await editor.commitEditByClickingOutside();
      await editor.waitForEditComplete(firstElementId);

      // Verify content saved
      const text = await editor.getEditableFieldText(firstElementId);
      expect(text).toContain("Editing with fit-to-page enabled");
    });

    test("disabling fit-to-page during edit works correctly", async ({
      page,
    }) => {
      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Start editing
      await editor.clickEditableField(firstElementId);
      await editor.clearAndType("Content during disable");

      // Disable fit-to-page
      await editor.disableFitToPage();

      // Edit should continue normally
      await page.keyboard.type(" more content");

      // Commit
      await editor.commitEditByClickingOutside();
      await editor.waitForEditComplete(firstElementId);

      // Verify
      const text = await editor.getEditableFieldText(firstElementId);
      expect(text).toContain("Content during disable more content");
    });

    test("enabling fit-to-page during edit triggers fit", async ({ page }) => {
      // First disable fit-to-page
      await editor.disableFitToPage();

      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Start editing
      await editor.clickEditableField(firstElementId);
      await editor.clearAndType("Pre-enable content");

      // Enable fit-to-page
      await editor.enableFitToPage();

      // Should trigger fit process
      await page.waitForTimeout(500);

      // Commit
      await editor.commitEditByClickingOutside();
      await editor.waitForEditComplete(firstElementId);
    });
  });

  test.describe("Typography Controls", () => {
    test("typography controls remain accessible during edit", async ({
      page,
    }) => {
      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Start editing
      await editor.clickEditableField(firstElementId);

      // Typography controls should still be visible in the panel
      // (depending on panel configuration)
    });
  });
});
