import { test, expect } from "@playwright/test";
import { ResumeEditorPage } from "../fixtures/page-objects/ResumeEditorPage";
import {
  RESUME_PRESETS,
  generateResumeContent,
} from "../fixtures/test-data/resume.fixture";

/**
 * Edge case tests verify that the fit-to-page algorithm handles
 * unusual content scenarios gracefully.
 */
test.describe("Edge Cases", () => {
  test("handles empty resume without errors", async ({ page }) => {
    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "empty-id",
            ...generateResumeContent(RESUME_PRESETS.empty),
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
    await editor.goto("empty-id");

    // Capture any console errors
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Should complete successfully with fitted status (nothing to reduce)
    expect(await editor.getStatus()).toBe("fitted");
    expect(await editor.getAppliedReductions()).toHaveLength(0);

    // No errors should have occurred
    const fittingErrors = errors.filter(
      (e) => e.includes("Auto-fit") || e.includes("fit-to-page")
    );
    expect(fittingErrors).toHaveLength(0);
  });

  test("handles single section resume", async ({ page }) => {
    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "single-id",
            ...generateResumeContent(RESUME_PRESETS.singleSection),
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
    await editor.goto("single-id");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Should fit without any reductions (minimal content)
    expect(await editor.getStatus()).toBe("fitted");
    expect(await editor.contentFits()).toBe(true);
  });

  test("handles very long bullet points (500+ chars)", async ({ page }) => {
    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "long-bullets-id",
            ...generateResumeContent(RESUME_PRESETS.longBullets),
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
    await editor.goto("long-bullets-id");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Should complete without crashing
    const status = await editor.getStatus();
    expect(["fitted", "minimum_reached"]).toContain(status);

    // Content with long bullets will likely hit minimum thresholds
    // due to text wrapping taking more vertical space
    if (status === "minimum_reached") {
      await expect(editor.minimumWarning).toBeVisible();
    }
  });

  test("handles 100+ skill tags", async ({ page }) => {
    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "many-skills-id",
            ...generateResumeContent(RESUME_PRESETS.manySkills),
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
    await editor.goto("many-skills-id");

    await editor.enableFitToPage();
    await editor.waitForFitComplete({ timeout: 15000 });

    // Should complete without crashing
    const status = await editor.getStatus();
    expect(["fitted", "minimum_reached"]).toContain(status);

    // 100+ skills will likely hit minimum thresholds
    if (status === "minimum_reached") {
      await expect(editor.minimumWarning).toBeVisible();
    }
  });

  test("handles deeply nested experience entries", async ({ page }) => {
    // Create custom content with many experience entries
    const deepContent = generateResumeContent({
      experienceCount: 6,
      bulletsPerEntry: 5,
      bulletLength: 100,
      educationCount: 2,
      skillCount: 15,
    });

    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "deep-id",
            ...deepContent,
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
    await editor.goto("deep-id");

    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    const status = await editor.getStatus();
    expect(["fitted", "minimum_reached"]).toContain(status);
  });

  test("handles rapid toggle on/off cycles", async ({ page }) => {
    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            id: "rapid-id",
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
    await editor.goto("rapid-id");

    // Rapidly toggle on/off several times
    for (let i = 0; i < 3; i++) {
      await editor.enableFitToPage();
      await page.waitForTimeout(200);
      await editor.disableFitToPage();
      await page.waitForTimeout(100);
    }

    // Final enable and wait for completion
    await editor.enableFitToPage();
    await editor.waitForFitComplete();

    // Should end in a valid state
    const status = await editor.getStatus();
    expect(["fitted", "minimum_reached"]).toContain(status);
  });
});
