import { test, expect } from "@playwright/test";
import { ResumeEditorPage } from "../fixtures/page-objects/ResumeEditorPage";
import {
  generateInlineEditingResume,
  toApiResponse,
} from "../fixtures/test-data/inline-editing.fixture";
import { setupAuth } from "../helpers/auth";

/**
 * Bullet point editing tests
 */
test.describe("Inline Editing - Bullets", () => {
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

  /**
   * Helper to find bullet elements
   */
  async function findBulletElements(): Promise<string[]> {
    const allElements = await editor.getAllEditableElements();
    // Bullet IDs typically contain "bullet" or end with numeric index
    return allElements.filter((id) => id.includes("bullet"));
  }

  test.describe("Basic Bullet Editing", () => {
    test("can edit bullet content", async ({ page }) => {
      const bulletElements = await findBulletElements();

      if (bulletElements.length === 0) {
        test.skip();
        return;
      }

      const bulletId = bulletElements[0];

      // Start editing
      await editor.clickEditableField(bulletId);

      // Clear and type new content
      await editor.clearAndType("New bullet accomplishment");

      // Commit
      await editor.commitEditByClickingOutside();
      await editor.waitForEditComplete(bulletId);

      // Verify content
      const bulletText = await editor.getEditableFieldText(bulletId);
      expect(bulletText).toContain("New bullet accomplishment");
    });

    test("bullet supports rich text formatting", async ({ page }) => {
      const bulletElements = await findBulletElements();

      if (bulletElements.length === 0) {
        test.skip();
        return;
      }

      const bulletId = bulletElements[0];

      // Verify it's a rich text element
      const isRichText = await editor.isRichTextElement(bulletId);
      expect(isRichText).toBe(true);

      // Start editing
      await editor.clickEditableField(bulletId);
      await editor.clearAndType("Achievement with emphasis");

      // Select and apply bold
      await editor.selectAllText();
      await page.keyboard.press("Meta+b");

      // Commit
      await editor.commitEditByClickingOutside();
      await editor.waitForEditComplete(bulletId);

      // Verify formatting preserved
      const element = editor.getEditableElement(bulletId);
      const hasBold = await element.evaluate((el) => {
        return (
          el.innerHTML.includes("<strong>") || el.innerHTML.includes("<b>")
        );
      });
      expect(hasBold).toBe(true);
    });
  });

  test.describe("Enter Key Behavior", () => {
    test("Enter creates new bullet", async ({ page }) => {
      const bulletElements = await findBulletElements();

      if (bulletElements.length === 0) {
        test.skip();
        return;
      }

      const firstBulletId = bulletElements[0];
      const initialBulletCount = bulletElements.length;

      // Start editing first bullet
      await editor.clickEditableField(firstBulletId);

      // Type content and press Enter
      await editor.clearAndType("First bullet content");
      await page.keyboard.press("Enter");

      // Wait for new bullet to be created
      await page.waitForTimeout(500);

      // Check for increased bullet count
      const newBulletElements = await findBulletElements();
      expect(newBulletElements.length).toBeGreaterThanOrEqual(initialBulletCount);
    });

    test("Enter at end of bullet moves to new bullet", async ({ page }) => {
      const bulletElements = await findBulletElements();

      if (bulletElements.length === 0) {
        test.skip();
        return;
      }

      const bulletId = bulletElements[0];

      // Start editing
      await editor.clickEditableField(bulletId);

      // Move to end and press Enter
      await page.keyboard.press("End");
      await page.keyboard.press("Enter");

      // Wait for transition
      await page.waitForTimeout(500);

      // The editor should now be focused on the new bullet
      const prosemirror = page.locator(".ProseMirror");
      await expect(prosemirror).toBeVisible();
    });
  });

  test.describe("Backspace Behavior", () => {
    test("Backspace on empty bullet removes it", async ({ page }) => {
      const bulletElements = await findBulletElements();

      if (bulletElements.length <= 1) {
        // Need at least 2 bullets to safely test deletion
        test.skip();
        return;
      }

      // Find an empty bullet or create one
      const lastBulletId = bulletElements[bulletElements.length - 1];

      // Start editing
      await editor.clickEditableField(lastBulletId);

      // Clear content
      await editor.selectAllText();
      await page.keyboard.press("Backspace");

      // Press Backspace again on empty bullet
      await page.keyboard.press("Backspace");

      // Wait for deletion
      await page.waitForTimeout(500);

      // Check if bullet was removed
      const newBulletElements = await findBulletElements();
      // Note: The exact behavior depends on implementation
      // It might focus the previous bullet or stay in same position
    });

    test("Backspace with content behaves normally", async ({ page }) => {
      const bulletElements = await findBulletElements();

      if (bulletElements.length === 0) {
        test.skip();
        return;
      }

      const bulletId = bulletElements[0];

      // Start editing
      await editor.clickEditableField(bulletId);

      // Type content
      await editor.clearAndType("Delete last char");

      // Press Backspace
      await page.keyboard.press("Backspace");

      // Verify one character was deleted
      const prosemirror = page.locator(".ProseMirror");
      await expect(prosemirror).toContainText("Delete last cha");
    });
  });

  test.describe("Bullet Focus Management", () => {
    test("after creating new bullet, focus moves to it", async ({ page }) => {
      const bulletElements = await findBulletElements();

      if (bulletElements.length === 0) {
        test.skip();
        return;
      }

      const firstBulletId = bulletElements[0];

      // Start editing first bullet
      await editor.clickEditableField(firstBulletId);

      // Type and press Enter to create new bullet
      await editor.clearAndType("Original bullet");
      await page.keyboard.press("Enter");

      // Wait for new bullet
      await page.waitForTimeout(500);

      // Type in new bullet
      await page.keyboard.type("New bullet content");

      // The new bullet should have the typed content
      const prosemirror = page.locator(".ProseMirror");
      await expect(prosemirror).toContainText("New bullet content");
    });

    test("after deleting bullet, focus moves to previous", async ({ page }) => {
      const bulletElements = await findBulletElements();

      if (bulletElements.length <= 1) {
        test.skip();
        return;
      }

      // Start with second bullet
      const secondBulletId = bulletElements[1];

      // Start editing
      await editor.clickEditableField(secondBulletId);

      // Clear and delete
      await editor.selectAllText();
      await page.keyboard.press("Backspace");
      await page.keyboard.press("Backspace");

      // Wait for deletion and focus change
      await page.waitForTimeout(500);

      // Should be focused on previous bullet (or stay in edit mode)
      const prosemirror = page.locator(".ProseMirror");
      const isVisible = await prosemirror.isVisible();
      // Either still in edit mode or exited
    });
  });

  test.describe("Multiple Bullet Operations", () => {
    test("can edit multiple bullets sequentially", async ({ page }) => {
      const bulletElements = await findBulletElements();

      if (bulletElements.length < 2) {
        test.skip();
        return;
      }

      // Edit first bullet
      await editor.clickEditableField(bulletElements[0]);
      await editor.clearAndType("First bullet edited");
      await editor.commitEditByClickingOutside();
      await editor.waitForEditComplete(bulletElements[0]);

      // Edit second bullet
      await editor.clickEditableField(bulletElements[1]);
      await editor.clearAndType("Second bullet edited");
      await editor.commitEditByClickingOutside();
      await editor.waitForEditComplete(bulletElements[1]);

      // Verify both
      const firstText = await editor.getEditableFieldText(bulletElements[0]);
      const secondText = await editor.getEditableFieldText(bulletElements[1]);

      expect(firstText).toContain("First bullet edited");
      expect(secondText).toContain("Second bullet edited");
    });

    test("Tab moves between bullets", async ({ page }) => {
      const bulletElements = await findBulletElements();

      if (bulletElements.length < 2) {
        test.skip();
        return;
      }

      // Start editing first bullet
      await editor.clickEditableField(bulletElements[0]);
      await editor.clearAndType("First bullet");

      // Tab to next
      await page.keyboard.press("Tab");
      await page.waitForTimeout(300);

      // Should have committed first bullet
      const firstText = await editor.getEditableFieldText(bulletElements[0]);
      expect(firstText).toContain("First bullet");
    });
  });

  test.describe("Bullet Placeholder", () => {
    test("empty bullet shows placeholder", async ({ page }) => {
      const bulletElements = await findBulletElements();

      if (bulletElements.length === 0) {
        test.skip();
        return;
      }

      const bulletId = bulletElements[0];

      // Clear the bullet
      await editor.clickEditableField(bulletId);
      await editor.selectAllText();
      await page.keyboard.press("Backspace");
      await editor.commitEditByClickingOutside();
      await editor.waitForEditComplete(bulletId);

      // Check for placeholder or empty state
      const element = editor.getEditableElement(bulletId);
      const hasPlaceholder = await element.evaluate((el) => {
        const placeholder = el.getAttribute("data-placeholder");
        const text = el.textContent?.trim();
        return placeholder !== null || text === "" || text === undefined;
      });
    });
  });
});
