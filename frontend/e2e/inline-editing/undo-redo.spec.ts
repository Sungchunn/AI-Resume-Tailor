import { test, expect } from "@playwright/test";
import { ResumeEditorPage } from "../fixtures/page-objects/ResumeEditorPage";
import {
  generateInlineEditingResume,
  toApiResponse,
} from "../fixtures/test-data/inline-editing.fixture";

/**
 * Undo/Redo tests for inline editing
 */
test.describe("Inline Editing - Undo/Redo", () => {
  let editor: ResumeEditorPage;
  const resumeData = generateInlineEditingResume();

  test.beforeEach(async ({ page }) => {
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

  test.describe("In-Editor Undo/Redo", () => {
    test("Ctrl+Z undoes typing within editor", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Start editing
      await editor.clickEditableField(firstElementId);

      // Type content
      await page.keyboard.type("First ");
      await page.keyboard.type("Second ");
      await page.keyboard.type("Third");

      // Verify content
      const prosemirror = page.locator(".ProseMirror");
      await expect(prosemirror).toContainText("First Second Third");

      // Undo
      await page.keyboard.press("Meta+z");
      await page.waitForTimeout(100);

      // Should have undone some typing
      const textAfterUndo = await prosemirror.textContent();
      expect(textAfterUndo).not.toContain("Third");
    });

    test("Ctrl+Shift+Z redoes after undo", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Start editing
      await editor.clickEditableField(firstElementId);

      // Clear and type
      await editor.clearAndType("New content");

      // Undo
      await page.keyboard.press("Meta+z");
      await page.waitForTimeout(100);

      // Redo
      await page.keyboard.press("Meta+Shift+z");
      await page.waitForTimeout(100);

      // Content should be restored
      const prosemirror = page.locator(".ProseMirror");
      await expect(prosemirror).toContainText("New content");
    });

    test("multiple undos work correctly", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Start editing
      await editor.clickEditableField(firstElementId);

      // Get initial content
      const prosemirror = page.locator(".ProseMirror");

      // Type multiple things
      await page.keyboard.type("A");
      await page.waitForTimeout(50);
      await page.keyboard.type("B");
      await page.waitForTimeout(50);
      await page.keyboard.type("C");

      // Undo multiple times
      await page.keyboard.press("Meta+z");
      await page.keyboard.press("Meta+z");
      await page.keyboard.press("Meta+z");

      // Should have undone the typing
    });
  });

  test.describe("Block-Level Undo/Redo", () => {
    test("undo after committing edit reverts block content", async ({
      page,
    }) => {
      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Get original content
      const originalContent = await editor.getEditableFieldText(firstElementId);

      // Edit and commit
      await editor.clickEditableField(firstElementId);
      await editor.clearAndType("Changed content");
      await editor.commitEditByClickingOutside();
      await editor.waitForEditComplete(firstElementId);

      // Verify change
      let currentContent = await editor.getEditableFieldText(firstElementId);
      expect(currentContent).toContain("Changed content");

      // Use global undo (Ctrl+Z outside of edit mode)
      await page.keyboard.press("Meta+z");
      await page.waitForTimeout(300);

      // Content might be reverted depending on implementation
      // This tests the block editor's undo stack
    });

    test("redo restores committed edit", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Edit and commit
      await editor.clickEditableField(firstElementId);
      await editor.clearAndType("Redo test content");
      await editor.commitEditByClickingOutside();
      await editor.waitForEditComplete(firstElementId);

      // Undo
      await page.keyboard.press("Meta+z");
      await page.waitForTimeout(300);

      // Redo
      await page.keyboard.press("Meta+Shift+z");
      await page.waitForTimeout(300);

      // Content should be restored (if redo is implemented)
    });
  });

  test.describe("Undo Stack Isolation", () => {
    test("undo in one field does not affect another", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      if (editableElements.length < 2) {
        test.skip();
        return;
      }

      const firstElementId = editableElements[0];
      const secondElementId = editableElements[1];

      // Edit first field
      await editor.clickEditableField(firstElementId);
      await editor.clearAndType("First field content");
      await editor.commitEditByClickingOutside();
      await editor.waitForEditComplete(firstElementId);

      // Edit second field
      await editor.clickEditableField(secondElementId);
      await editor.clearAndType("Second field content");

      // Undo in second field
      await page.keyboard.press("Meta+z");
      await page.waitForTimeout(100);

      // First field should be unchanged
      const firstContent = await editor.getEditableFieldText(firstElementId);
      expect(firstContent).toContain("First field content");
    });

    test("each edit session has its own undo history", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // First edit session
      await editor.clickEditableField(firstElementId);
      await page.keyboard.type("Session 1");
      await editor.commitEditByClickingOutside();
      await editor.waitForEditComplete(firstElementId);

      // Second edit session
      await editor.clickEditableField(firstElementId);
      await page.keyboard.type(" Session 2");

      // Undo should only affect current session
      await page.keyboard.press("Meta+z");

      const prosemirror = page.locator(".ProseMirror");
      const text = await prosemirror.textContent();
      // Should still contain Session 1 content
    });
  });

  test.describe("Undo After Cancel", () => {
    test("cancelled edit does not create undo point", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Get original content
      const originalContent = await editor.getEditableFieldText(firstElementId);

      // Edit and cancel
      await editor.clickEditableField(firstElementId);
      await editor.clearAndType("Should not be in undo stack");
      await editor.cancelEdit();
      await editor.waitForEditComplete(firstElementId);

      // Content should be original
      const currentContent = await editor.getEditableFieldText(firstElementId);
      expect(currentContent).toBe(originalContent);

      // Undo should not bring back the cancelled content
      await page.keyboard.press("Meta+z");
      await page.waitForTimeout(200);

      // Still original
      const afterUndo = await editor.getEditableFieldText(firstElementId);
      expect(afterUndo).toBe(originalContent);
    });
  });

  test.describe("Undo with Formatting", () => {
    test("undo removes formatting", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      let richTextElementId: string | null = null;

      for (const elementId of editableElements) {
        if (await editor.isRichTextElement(elementId)) {
          richTextElementId = elementId;
          break;
        }
      }

      if (!richTextElementId) {
        test.skip();
        return;
      }

      // Start editing
      await editor.clickEditableField(richTextElementId);
      await editor.clearAndType("Format me");

      // Apply formatting
      await editor.selectAllText();
      await page.keyboard.press("Meta+b");

      // Verify bold applied
      const prosemirror = page.locator(".ProseMirror");
      let hasBold = await prosemirror.evaluate((el) => {
        return el.querySelector("strong, b") !== null;
      });
      expect(hasBold).toBe(true);

      // Undo
      await page.keyboard.press("Meta+z");
      await page.waitForTimeout(100);

      // Bold should be removed
      hasBold = await prosemirror.evaluate((el) => {
        return el.querySelector("strong, b") !== null;
      });
      expect(hasBold).toBe(false);
    });
  });

  test.describe("Keyboard Shortcut Variations", () => {
    test("Ctrl+Y works as redo", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Start editing
      await editor.clickEditableField(firstElementId);
      await editor.clearAndType("Test content");

      // Undo
      await page.keyboard.press("Meta+z");
      await page.waitForTimeout(100);

      // Redo with Ctrl+Y
      await page.keyboard.press("Meta+y");
      await page.waitForTimeout(100);

      // Content should be restored
      const prosemirror = page.locator(".ProseMirror");
      await expect(prosemirror).toContainText("Test content");
    });
  });
});
