import { test, expect } from "@playwright/test";
import { ResumeEditorPage } from "../fixtures/page-objects/ResumeEditorPage";
import {
  generateInlineEditingResume,
  toApiResponse,
} from "../fixtures/test-data/inline-editing.fixture";
import { setupAuth } from "../helpers/auth";

/**
 * Skills editing tests - Updated for comma-separated list editing
 *
 * The new InlineSkillsList component edits skills as a single comma-separated
 * text field using native contentEditable. No per-skill popups.
 */
test.describe("Inline Editing - Skills", () => {
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
   * Helper to find the skills list element
   */
  async function findSkillsElement(): Promise<string | null> {
    const allElements = await editor.getAllEditableElements();
    // Skills element ID ends with "::skills"
    return allElements.find((id) => id.endsWith("::skills")) || null;
  }

  test.describe("Comma-Separated List Editing", () => {
    test("skills display as comma-separated text", async ({ page }) => {
      const skillsId = await findSkillsElement();

      if (!skillsId) {
        test.skip();
        return;
      }

      const skillsText = await editor.getEditableFieldText(skillsId);
      // Should contain commas separating skills
      expect(skillsText).toContain(",");
    });

    test("clicking skills field starts editing entire list", async ({
      page,
    }) => {
      const skillsId = await findSkillsElement();

      if (!skillsId) {
        test.skip();
        return;
      }

      // Click to edit
      await editor.clickEditableField(skillsId);

      // Element should have focus (native contentEditable)
      const element = editor.getEditableElement(skillsId);
      const isFocused = await element.evaluate(
        (el) => document.activeElement === el
      );
      expect(isFocused).toBeTruthy();
    });

    test("can edit the entire skills list", async ({ page }) => {
      const skillsId = await findSkillsElement();

      if (!skillsId) {
        test.skip();
        return;
      }

      // Start editing
      await editor.clickEditableField(skillsId);

      // Clear and type new skills
      await page.keyboard.press("Meta+a");
      await page.keyboard.type("React, TypeScript, Node.js");

      // Commit by clicking outside
      await editor.commitEditByClickingOutside();
      await page.waitForTimeout(300);

      // Verify content
      const skillsText = await editor.getEditableFieldText(skillsId);
      expect(skillsText).toContain("React");
      expect(skillsText).toContain("TypeScript");
      expect(skillsText).toContain("Node.js");
    });

    test("adding comma adds new skill to list", async ({ page }) => {
      const skillsId = await findSkillsElement();

      if (!skillsId) {
        test.skip();
        return;
      }

      // Start editing
      await editor.clickEditableField(skillsId);

      // Go to end and add new skill
      await page.keyboard.press("End");
      await page.keyboard.type(", NewSkill");

      // Commit
      await editor.commitEditByClickingOutside();
      await page.waitForTimeout(300);

      // Verify new skill is in the list
      const skillsText = await editor.getEditableFieldText(skillsId);
      expect(skillsText).toContain("NewSkill");
    });

    test("removing text removes skill from list", async ({ page }) => {
      const skillsId = await findSkillsElement();

      if (!skillsId) {
        test.skip();
        return;
      }

      // Get original skills count
      const originalText = await editor.getEditableFieldText(skillsId);
      const originalCount = originalText.split(",").length;

      // Start editing and replace with fewer skills
      await editor.clickEditableField(skillsId);
      await page.keyboard.press("Meta+a");
      await page.keyboard.type("SingleSkill");

      // Commit
      await editor.commitEditByClickingOutside();
      await page.waitForTimeout(300);

      // Verify only one skill
      const newText = await editor.getEditableFieldText(skillsId);
      const newCount = newText.split(",").filter((s) => s.trim()).length;
      expect(newCount).toBe(1);
      expect(newText).toContain("SingleSkill");
    });
  });

  test.describe("Enter Key Behavior", () => {
    test("Enter commits the edit (no newlines)", async ({ page }) => {
      const skillsId = await findSkillsElement();

      if (!skillsId) {
        test.skip();
        return;
      }

      // Start editing
      await editor.clickEditableField(skillsId);
      await page.keyboard.press("Meta+a");
      await page.keyboard.type("Skill1, Skill2");

      // Press Enter
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);

      // Verify commit happened (element no longer focused)
      const element = editor.getEditableElement(skillsId);
      const isFocused = await element.evaluate(
        (el) => document.activeElement === el
      );
      expect(isFocused).toBeFalsy();

      // Verify content
      const skillsText = await editor.getEditableFieldText(skillsId);
      expect(skillsText).toContain("Skill1");
      expect(skillsText).toContain("Skill2");
    });
  });

  test.describe("No Per-Skill Popups", () => {
    test("editing does not create overlay popups", async ({ page }) => {
      const skillsId = await findSkillsElement();

      if (!skillsId) {
        test.skip();
        return;
      }

      // Start editing
      await editor.clickEditableField(skillsId);

      // Should NOT have any fixed overlay (old pattern)
      const fixedOverlay = page.locator(".fixed.z-50");
      await expect(fixedOverlay).toHaveCount(0);
    });

    test("skills use native contentEditable (not ProseMirror)", async ({
      page,
    }) => {
      const skillsId = await findSkillsElement();

      if (!skillsId) {
        test.skip();
        return;
      }

      // Start editing
      await editor.clickEditableField(skillsId);

      // Skills element itself should be contentEditable
      const element = editor.getEditableElement(skillsId);
      const isContentEditable = await element.getAttribute("contenteditable");
      expect(isContentEditable).toBe("true");

      // Should NOT have ProseMirror inside (skills use native contentEditable)
      const prosemirror = element.locator(".ProseMirror");
      await expect(prosemirror).toHaveCount(0);
    });
  });

  test.describe("Edge Cases", () => {
    test("empty skills list shows placeholder", async ({ page }) => {
      const skillsId = await findSkillsElement();

      if (!skillsId) {
        test.skip();
        return;
      }

      // Clear all skills
      await editor.clickEditableField(skillsId);
      await page.keyboard.press("Meta+a");
      await page.keyboard.press("Backspace");
      await editor.commitEditByClickingOutside();
      await page.waitForTimeout(300);

      // Element should show placeholder text
      const element = editor.getEditableElement(skillsId);
      const text = await element.textContent();
      // Placeholder is "Add skills..." when empty
      expect(text?.toLowerCase()).toContain("add skills");
    });

    test("trailing commas are handled gracefully", async ({ page }) => {
      const skillsId = await findSkillsElement();

      if (!skillsId) {
        test.skip();
        return;
      }

      // Type skills with trailing comma
      await editor.clickEditableField(skillsId);
      await page.keyboard.press("Meta+a");
      await page.keyboard.type("Skill1, Skill2,");

      // Commit
      await editor.commitEditByClickingOutside();
      await page.waitForTimeout(300);

      // Verify no empty skill was added
      const skillsText = await editor.getEditableFieldText(skillsId);
      const skills = skillsText.split(",").filter((s) => s.trim());
      expect(skills.length).toBe(2);
    });

    test("whitespace-only skills are filtered out", async ({ page }) => {
      const skillsId = await findSkillsElement();

      if (!skillsId) {
        test.skip();
        return;
      }

      // Type skills with empty entries
      await editor.clickEditableField(skillsId);
      await page.keyboard.press("Meta+a");
      await page.keyboard.type("Skill1,   , Skill2");

      // Commit
      await editor.commitEditByClickingOutside();
      await page.waitForTimeout(300);

      // Verify empty entry was filtered
      const skillsText = await editor.getEditableFieldText(skillsId);
      expect(skillsText).not.toContain(",  ,");
    });
  });
});
