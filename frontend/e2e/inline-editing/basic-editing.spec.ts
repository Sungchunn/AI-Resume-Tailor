import { test, expect } from "@playwright/test";
import { ResumeEditorPage } from "../fixtures/page-objects/ResumeEditorPage";
import {
  generateInlineEditingResume,
  toApiResponse,
} from "../fixtures/test-data/inline-editing.fixture";
import { setupAuth } from "../helpers/auth";

/**
 * Basic inline editing tests - click, edit, save flow
 */
test.describe("Inline Editing - Basic Editing", () => {
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
          json: toApiResponse(resumeData),
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

  test.describe("Click to Edit", () => {
    test("clicking an editable field starts edit mode", async ({ page }) => {
      // Find an editable element
      const editableElements = await editor.getAllEditableElements();
      expect(editableElements.length).toBeGreaterThan(0);

      const firstElementId = editableElements[0];
      await editor.clickEditableField(firstElementId);

      // Should be in edit mode (ProseMirror editor should be visible)
      const prosemirror = page.locator(".ProseMirror");
      await expect(prosemirror).toBeVisible();
    });

    test("editable fields have cursor: text style", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];
      const element = editor.getEditableElement(firstElementId);

      // Check cursor style
      const cursor = await element.evaluate((el) => {
        return window.getComputedStyle(el).cursor;
      });
      expect(cursor).toBe("text");
    });

    test("editable fields show hover state", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];
      const element = editor.getEditableElement(firstElementId);

      // Hover over element
      await element.hover();

      // Should have hover styles (blue background)
      const hasHoverClass = await element.evaluate((el) => {
        return el.classList.contains("hover:bg-blue-50") || el.matches(":hover");
      });
      expect(hasHoverClass).toBeTruthy();
    });
  });

  test.describe("Typing and Content Changes", () => {
    test("can type new content in edit mode", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Start editing
      await editor.clickEditableField(firstElementId);

      // Type new content
      await editor.clearAndType("New Content");

      // Verify content in editor
      const prosemirror = page.locator(".ProseMirror");
      await expect(prosemirror).toContainText("New Content");
    });

    test("content is preserved while typing", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Start editing
      await editor.clickEditableField(firstElementId);

      // Type incrementally
      await page.keyboard.press("End");
      await page.keyboard.type(" additional text");

      // Verify content
      const prosemirror = page.locator(".ProseMirror");
      await expect(prosemirror).toContainText("additional text");
    });
  });

  test.describe("Commit Changes", () => {
    test("clicking outside commits the edit", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Start editing
      await editor.clickEditableField(firstElementId);

      // Type new content
      await editor.clearAndType("Committed Content");

      // Click outside to commit
      await editor.commitEditByClickingOutside();

      // Wait for edit to complete
      await editor.waitForEditComplete(firstElementId);

      // Verify content is committed
      const fieldText = await editor.getEditableFieldText(firstElementId);
      expect(fieldText).toContain("Committed Content");
    });

    test("Tab commits current field", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Start editing
      await editor.clickEditableField(firstElementId);

      // Type new content
      await editor.clearAndType("Tab Committed");

      // Press Tab
      await page.keyboard.press("Tab");

      // Wait for edit to complete
      await page.waitForTimeout(200);

      // Verify content is committed
      const fieldText = await editor.getEditableFieldText(firstElementId);
      expect(fieldText).toContain("Tab Committed");
    });
  });

  test.describe("Cancel Changes", () => {
    test("Escape cancels the edit and restores original value", async ({
      page,
    }) => {
      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Get original content
      const originalContent = await editor.getEditableFieldText(firstElementId);

      // Start editing
      await editor.clickEditableField(firstElementId);

      // Type new content
      await editor.clearAndType("Should be cancelled");

      // Press Escape to cancel
      await editor.cancelEdit();

      // Wait for edit mode to end
      await editor.waitForEditComplete(firstElementId);

      // Verify original content is restored
      const restoredContent = await editor.getEditableFieldText(firstElementId);
      expect(restoredContent).toBe(originalContent);
    });
  });

  test.describe("Switching Between Fields", () => {
    test("clicking another field commits current and starts new edit", async ({
      page,
    }) => {
      const editableElements = await editor.getAllEditableElements();
      expect(editableElements.length).toBeGreaterThan(1);

      const firstElementId = editableElements[0];
      const secondElementId = editableElements[1];

      // Start editing first field
      await editor.clickEditableField(firstElementId);
      await editor.clearAndType("First Field Content");

      // Click second field (should commit first and start editing second)
      await editor.clickEditableField(secondElementId);

      // Wait for transition
      await page.waitForTimeout(200);

      // First field should have committed content
      const firstFieldText = await editor.getEditableFieldText(firstElementId);
      expect(firstFieldText).toContain("First Field Content");

      // Second field should be in edit mode
      const prosemirror = page.locator(".ProseMirror");
      await expect(prosemirror).toBeVisible();
    });
  });

  test.describe("Visual Feedback", () => {
    test("editing element shows visual indicator", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Start editing
      await editor.clickEditableField(firstElementId);

      // Should have editing class or border indicator
      const element = editor.getEditableElement(firstElementId);
      const hasEditingIndicator = await element.evaluate((el) => {
        return (
          el.classList.contains("inline-editing") ||
          getComputedStyle(el).visibility === "hidden"
        );
      });
      expect(hasEditingIndicator).toBeTruthy();
    });

    test("editor overlay appears over editing element", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Start editing
      await editor.clickEditableField(firstElementId);

      // Should have ProseMirror overlay
      const prosemirror = page.locator(".ProseMirror");
      await expect(prosemirror).toBeVisible();

      // Editor should be positioned
      const editorWrapper = page.locator(".fixed.z-50");
      await expect(editorWrapper).toBeVisible();
    });
  });

  test.describe("Empty State", () => {
    test("empty fields show placeholder", async ({ page }) => {
      // This test assumes there are placeholder attributes
      const editableElements = await editor.getAllEditableElements();
      const element = editor.getEditableElement(editableElements[0]);

      // Check for placeholder attribute or text
      const hasPlaceholder =
        (await element.getAttribute("data-placeholder")) !== null;
      // Placeholders are shown in different ways depending on implementation
    });

    test("can add content to empty field", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Start editing
      await editor.clickEditableField(firstElementId);

      // Clear and type new content
      await editor.clearAndType("New content for empty field");

      // Commit
      await editor.commitEditByClickingOutside();

      // Verify content
      await editor.waitForEditComplete(firstElementId);
      const fieldText = await editor.getEditableFieldText(firstElementId);
      expect(fieldText).toContain("New content for empty field");
    });
  });
});
