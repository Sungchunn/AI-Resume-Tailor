import { test, expect } from "@playwright/test";
import { ResumeEditorPage } from "../fixtures/page-objects/ResumeEditorPage";
import {
  generateInlineEditingResume,
  toApiResponse,
} from "../fixtures/test-data/inline-editing.fixture";
import { setupAuth } from "../helpers/auth";

/**
 * Text formatting tests for inline editing
 */
test.describe("Inline Editing - Formatting", () => {
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

  test.describe("Floating Toolbar", () => {
    test("toolbar appears when text is selected in rich text field", async ({
      page,
    }) => {
      // Find a rich text editable element
      const editableElements = await editor.getAllEditableElements();
      let richTextElementId: string | null = null;

      for (const elementId of editableElements) {
        if (await editor.isRichTextElement(elementId)) {
          if (await editor.elementShowsToolbar(elementId)) {
            richTextElementId = elementId;
            break;
          }
        }
      }

      if (!richTextElementId) {
        test.skip();
        return;
      }

      // Start editing
      await editor.clickEditableField(richTextElementId);

      // Type some text
      await editor.clearAndType("Select this text");

      // Select all text
      await editor.selectAllText();

      // Wait for toolbar to appear
      await page.waitForTimeout(200);

      // Toolbar should be visible
      const isVisible = await editor.isFloatingToolbarVisible();
      expect(isVisible).toBe(true);
    });

    test("toolbar disappears when selection is cleared", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      let richTextElementId: string | null = null;

      for (const elementId of editableElements) {
        if (await editor.isRichTextElement(elementId)) {
          if (await editor.elementShowsToolbar(elementId)) {
            richTextElementId = elementId;
            break;
          }
        }
      }

      if (!richTextElementId) {
        test.skip();
        return;
      }

      // Start editing
      await editor.clickEditableField(richTextElementId);
      await editor.clearAndType("Some text");

      // Select text to show toolbar
      await editor.selectAllText();
      await page.waitForTimeout(200);
      expect(await editor.isFloatingToolbarVisible()).toBe(true);

      // Click to clear selection
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(200);

      // Toolbar should disappear
      expect(await editor.isFloatingToolbarVisible()).toBe(false);
    });

    test("toolbar has bold, italic, underline, and clear buttons", async ({
      page,
    }) => {
      const editableElements = await editor.getAllEditableElements();
      let richTextElementId: string | null = null;

      for (const elementId of editableElements) {
        if (await editor.isRichTextElement(elementId)) {
          if (await editor.elementShowsToolbar(elementId)) {
            richTextElementId = elementId;
            break;
          }
        }
      }

      if (!richTextElementId) {
        test.skip();
        return;
      }

      // Start editing and select
      await editor.clickEditableField(richTextElementId);
      await editor.clearAndType("Test text");
      await editor.selectAllText();
      await page.waitForTimeout(200);

      // Check for toolbar buttons
      const toolbar = editor.floatingToolbar;
      await expect(toolbar.locator('[title="Bold (Ctrl+B)"]')).toBeVisible();
      await expect(toolbar.locator('[title="Italic (Ctrl+I)"]')).toBeVisible();
      await expect(
        toolbar.locator('[title="Underline (Ctrl+U)"]')
      ).toBeVisible();
      await expect(toolbar.locator('[title="Clear formatting"]')).toBeVisible();
    });
  });

  test.describe("Bold Formatting", () => {
    test("clicking bold button applies bold to selection", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      let richTextElementId: string | null = null;

      for (const elementId of editableElements) {
        if (await editor.isRichTextElement(elementId)) {
          if (await editor.elementShowsToolbar(elementId)) {
            richTextElementId = elementId;
            break;
          }
        }
      }

      if (!richTextElementId) {
        test.skip();
        return;
      }

      // Start editing
      await editor.clickEditableField(richTextElementId);
      await editor.clearAndType("Make this bold");

      // Select text
      await editor.selectAllText();
      await page.waitForTimeout(200);

      // Click bold button
      await editor.clickToolbarButton("bold");

      // Verify bold is applied
      const prosemirror = page.locator(".ProseMirror");
      const hasBold = await prosemirror.evaluate((el) => {
        return el.querySelector("strong, b") !== null;
      });
      expect(hasBold).toBe(true);
    });

    test("Ctrl+B toggles bold", async ({ page }) => {
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
      await editor.clearAndType("Bold text");

      // Select and apply bold with keyboard
      await editor.selectAllText();
      await page.keyboard.press("Meta+b");

      // Verify bold
      const prosemirror = page.locator(".ProseMirror");
      const hasBold = await prosemirror.evaluate((el) => {
        return el.querySelector("strong, b") !== null;
      });
      expect(hasBold).toBe(true);

      // Toggle off
      await page.keyboard.press("Meta+b");

      // Verify not bold
      const stillBold = await prosemirror.evaluate((el) => {
        return el.querySelector("strong, b") !== null;
      });
      expect(stillBold).toBe(false);
    });
  });

  test.describe("Italic Formatting", () => {
    test("clicking italic button applies italic to selection", async ({
      page,
    }) => {
      const editableElements = await editor.getAllEditableElements();
      let richTextElementId: string | null = null;

      for (const elementId of editableElements) {
        if (await editor.isRichTextElement(elementId)) {
          if (await editor.elementShowsToolbar(elementId)) {
            richTextElementId = elementId;
            break;
          }
        }
      }

      if (!richTextElementId) {
        test.skip();
        return;
      }

      // Start editing
      await editor.clickEditableField(richTextElementId);
      await editor.clearAndType("Make this italic");

      // Select text
      await editor.selectAllText();
      await page.waitForTimeout(200);

      // Click italic button
      await editor.clickToolbarButton("italic");

      // Verify italic is applied
      const prosemirror = page.locator(".ProseMirror");
      const hasItalic = await prosemirror.evaluate((el) => {
        return el.querySelector("em, i") !== null;
      });
      expect(hasItalic).toBe(true);
    });

    test("Ctrl+I toggles italic", async ({ page }) => {
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
      await editor.clearAndType("Italic text");

      // Select and apply italic
      await editor.selectAllText();
      await page.keyboard.press("Meta+i");

      // Verify italic
      const prosemirror = page.locator(".ProseMirror");
      const hasItalic = await prosemirror.evaluate((el) => {
        return el.querySelector("em, i") !== null;
      });
      expect(hasItalic).toBe(true);
    });
  });

  test.describe("Underline Formatting", () => {
    test("clicking underline button applies underline to selection", async ({
      page,
    }) => {
      const editableElements = await editor.getAllEditableElements();
      let richTextElementId: string | null = null;

      for (const elementId of editableElements) {
        if (await editor.isRichTextElement(elementId)) {
          if (await editor.elementShowsToolbar(elementId)) {
            richTextElementId = elementId;
            break;
          }
        }
      }

      if (!richTextElementId) {
        test.skip();
        return;
      }

      // Start editing
      await editor.clickEditableField(richTextElementId);
      await editor.clearAndType("Make this underlined");

      // Select text
      await editor.selectAllText();
      await page.waitForTimeout(200);

      // Click underline button
      await editor.clickToolbarButton("underline");

      // Verify underline is applied
      const prosemirror = page.locator(".ProseMirror");
      const hasUnderline = await prosemirror.evaluate((el) => {
        return el.querySelector("u") !== null;
      });
      expect(hasUnderline).toBe(true);
    });

    test("Ctrl+U toggles underline", async ({ page }) => {
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
      await editor.clearAndType("Underlined text");

      // Select and apply underline
      await editor.selectAllText();
      await page.keyboard.press("Meta+u");

      // Verify underline
      const prosemirror = page.locator(".ProseMirror");
      const hasUnderline = await prosemirror.evaluate((el) => {
        return el.querySelector("u") !== null;
      });
      expect(hasUnderline).toBe(true);
    });
  });

  test.describe("Clear Formatting", () => {
    test("clear formatting removes all marks", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      let richTextElementId: string | null = null;

      for (const elementId of editableElements) {
        if (await editor.isRichTextElement(elementId)) {
          if (await editor.elementShowsToolbar(elementId)) {
            richTextElementId = elementId;
            break;
          }
        }
      }

      if (!richTextElementId) {
        test.skip();
        return;
      }

      // Start editing
      await editor.clickEditableField(richTextElementId);
      await editor.clearAndType("Formatted text");

      // Select and apply multiple formats
      await editor.selectAllText();
      await page.waitForTimeout(200);
      await editor.clickToolbarButton("bold");
      await editor.clickToolbarButton("italic");

      // Verify formatting applied
      const prosemirror = page.locator(".ProseMirror");
      let hasBold = await prosemirror.evaluate((el) => {
        return el.querySelector("strong, b") !== null;
      });
      expect(hasBold).toBe(true);

      // Clear formatting
      await editor.selectAllText();
      await page.waitForTimeout(200);
      await editor.clickToolbarButton("clear");

      // Verify formatting removed
      hasBold = await prosemirror.evaluate((el) => {
        return el.querySelector("strong, b") !== null;
      });
      expect(hasBold).toBe(false);
    });
  });

  test.describe("Formatting Persistence", () => {
    test("formatting is preserved after commit", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      let richTextElementId: string | null = null;

      for (const elementId of editableElements) {
        if (await editor.isRichTextElement(elementId)) {
          if (await editor.elementShowsToolbar(elementId)) {
            richTextElementId = elementId;
            break;
          }
        }
      }

      if (!richTextElementId) {
        test.skip();
        return;
      }

      // Start editing
      await editor.clickEditableField(richTextElementId);
      await editor.clearAndType("Bold content");

      // Apply bold
      await editor.selectAllText();
      await page.keyboard.press("Meta+b");

      // Commit by clicking outside
      await editor.commitEditByClickingOutside();
      await editor.waitForEditComplete(richTextElementId);

      // Check that the committed element contains bold HTML
      const element = editor.getEditableElement(richTextElementId);
      const hasBold = await element.evaluate((el) => {
        return el.innerHTML.includes("<strong>") || el.innerHTML.includes("<b>");
      });
      expect(hasBold).toBe(true);
    });
  });

  test.describe("Plain Text Fields", () => {
    test("toolbar does not appear for plain text fields", async ({ page }) => {
      const editableElements = await editor.getAllEditableElements();
      let plainTextElementId: string | null = null;

      for (const elementId of editableElements) {
        const isRichText = await editor.isRichTextElement(elementId);
        if (!isRichText) {
          plainTextElementId = elementId;
          break;
        }
      }

      if (!plainTextElementId) {
        test.skip();
        return;
      }

      // Start editing
      await editor.clickEditableField(plainTextElementId);
      await editor.clearAndType("Plain text");

      // Select text
      await editor.selectAllText();
      await page.waitForTimeout(200);

      // Toolbar should not appear
      expect(await editor.isFloatingToolbarVisible()).toBe(false);
    });
  });
});
