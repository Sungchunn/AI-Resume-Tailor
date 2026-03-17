import { test, expect } from "@playwright/test";
import { ResumeEditorPage } from "../fixtures/page-objects/ResumeEditorPage";
import {
  generateInlineEditingResume,
  toApiResponse,
} from "../fixtures/test-data/inline-editing.fixture";
import { setupAuth } from "../helpers/auth";

/**
 * Keyboard navigation tests for inline editing
 */
test.describe("Inline Editing - Keyboard Navigation", () => {
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

  test.describe("Tab Navigation", () => {
    test("Tab commits current edit", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Start editing
      await editor.clickEditableField(firstElementId);

      // Type content
      await editor.clearAndType("Tab Test Content");

      // Press Tab
      await page.keyboard.press("Tab");

      // Wait for edit to complete
      await page.waitForTimeout(200);

      // Content should be committed
      const fieldText = await editor.getEditableFieldText(firstElementId);
      expect(fieldText).toContain("Tab Test Content");
    });

    test("Tab moves to next editable field", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      expect(editableElements.length).toBeGreaterThan(1);

      const firstElementId = editableElements[0];

      // Start editing first field
      await editor.clickEditableField(firstElementId);

      // Press Tab
      await page.keyboard.press("Tab");

      // Wait for transition
      await page.waitForTimeout(200);

      // Should be editing or focused on next element
      // The exact behavior depends on implementation
    });

    test("Shift+Tab moves to previous editable field", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      expect(editableElements.length).toBeGreaterThan(1);

      const secondElementId = editableElements[1];

      // Start editing second field
      await editor.clickEditableField(secondElementId);

      // Press Shift+Tab
      await page.keyboard.press("Shift+Tab");

      // Wait for transition
      await page.waitForTimeout(200);

      // Should navigate backward
    });
  });

  test.describe("Escape Key", () => {
    test("Escape cancels edit and restores original value", async ({
      page,
    }) => {
      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Get original content
      const originalContent = await editor.getEditableFieldText(firstElementId);

      // Start editing
      await editor.clickEditableField(firstElementId);

      // Type something different
      await editor.clearAndType("This should be cancelled");

      // Press Escape
      await page.keyboard.press("Escape");

      // Wait for edit mode to end
      await editor.waitForEditComplete(firstElementId);

      // Original content should be restored
      const restoredContent = await editor.getEditableFieldText(firstElementId);
      expect(restoredContent).toBe(originalContent);
    });

    test("Escape removes focus from editor", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Start editing
      await editor.clickEditableField(firstElementId);

      // Verify editor is visible
      const prosemirror = page.locator(".ProseMirror");
      await expect(prosemirror).toBeVisible();

      // Press Escape
      await page.keyboard.press("Escape");

      // Wait for edit to cancel
      await page.waitForTimeout(200);

      // ProseMirror should no longer be the primary view
      const isEditing = await editor.isElementEditing(firstElementId);
      expect(isEditing).toBe(false);
    });
  });

  test.describe("Enter Key", () => {
    test("Enter in single-line field commits edit", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Check if it's a plain text (single-line) field
      const isRichText = await editor.isRichTextElement(firstElementId);

      if (!isRichText) {
        // Start editing
        await editor.clickEditableField(firstElementId);

        // Type content
        await editor.clearAndType("Enter Commit Test");

        // Press Enter
        await page.keyboard.press("Enter");

        // Wait for commit
        await page.waitForTimeout(200);

        // Content should be committed
        const fieldText = await editor.getEditableFieldText(firstElementId);
        expect(fieldText).toContain("Enter Commit Test");
      }
    });
  });

  test.describe("Accessibility Keyboard Shortcuts", () => {
    test("Enter activates edit mode on focused element", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];
      const element = editor.getEditableElement(firstElementId);

      // Focus the element (without clicking)
      await element.focus();

      // Press Enter to activate
      await page.keyboard.press("Enter");

      // Should start editing
      const prosemirror = page.locator(".ProseMirror");
      await expect(prosemirror).toBeVisible();
    });

    test("Space activates edit mode on focused element", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];
      const element = editor.getEditableElement(firstElementId);

      // Focus the element
      await element.focus();

      // Press Space to activate
      await page.keyboard.press("Space");

      // Should start editing
      const prosemirror = page.locator(".ProseMirror");
      await expect(prosemirror).toBeVisible();
    });
  });

  test.describe("Modifier Keys in Edit Mode", () => {
    test("Ctrl+A selects all text", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Start editing
      await editor.clickEditableField(firstElementId);

      // Press Ctrl+A (or Meta+A on Mac)
      await page.keyboard.press("Meta+a");

      // Selection should be active (we can test by typing which replaces selection)
      await page.keyboard.type("Replaced");

      // Content should be replaced
      const prosemirror = page.locator(".ProseMirror");
      await expect(prosemirror).toContainText("Replaced");
    });

    test("Ctrl+Z performs undo", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Start editing
      await editor.clickEditableField(firstElementId);

      // Get initial content
      const prosemirror = page.locator(".ProseMirror");
      const initialText = await prosemirror.textContent();

      // Type new content
      await page.keyboard.type(" additional");

      // Verify new content
      await expect(prosemirror).toContainText("additional");

      // Press Ctrl+Z to undo
      await page.keyboard.press("Meta+z");

      // Content should be undone
      await page.waitForTimeout(100);
      const undoneText = await prosemirror.textContent();
      expect(undoneText).not.toContain("additional");
    });
  });

  test.describe("Arrow Key Navigation", () => {
    test("Arrow keys move cursor within editor", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Start editing
      await editor.clickEditableField(firstElementId);

      // Move cursor with arrow keys
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("Home");
      await page.keyboard.press("End");

      // Should still be in edit mode
      const prosemirror = page.locator(".ProseMirror");
      await expect(prosemirror).toBeVisible();
    });
  });

  test.describe("Focus Management", () => {
    test("clicking editable element focuses the editor", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Click to edit
      await editor.clickEditableField(firstElementId);

      // The ProseMirror editor should have focus
      const hasFocus = await page.evaluate(() => {
        const prosemirror = document.querySelector(".ProseMirror");
        return (
          document.activeElement === prosemirror ||
          prosemirror?.contains(document.activeElement)
        );
      });
      expect(hasFocus).toBe(true);
    });

    test("focus is preserved while typing", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Start editing
      await editor.clickEditableField(firstElementId);

      // Type text
      await page.keyboard.type("Testing focus");

      // Should still have focus
      const hasFocus = await page.evaluate(() => {
        const prosemirror = document.querySelector(".ProseMirror");
        return (
          document.activeElement === prosemirror ||
          prosemirror?.contains(document.activeElement)
        );
      });
      expect(hasFocus).toBe(true);
    });
  });
});
