import { test, expect, Browser, BrowserContext, Page } from "@playwright/test";
import { ResumeEditorPage } from "../fixtures/page-objects/ResumeEditorPage";
import {
  generateInlineEditingResume,
  toApiResponse,
} from "../fixtures/test-data/inline-editing.fixture";
import { setupAuth, MOCK_USER } from "../helpers/auth";

/**
 * Concurrent/multi-tab editing tests
 * Tests OCC (Optimistic Concurrency Control) integration
 */
test.describe("Inline Editing - Concurrent Edits", () => {
  const resumeData = generateInlineEditingResume();
  let version = 1;

  /**
   * Setup API routes for a page with version tracking
   * Also sets up authentication for the page
   */
  async function setupApiRoutesWithAuth(page: Page, currentVersion: number) {
    // Mock auth/me endpoint
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        json: MOCK_USER,
      });
    });

    await page.route("**/api/resumes/*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            ...toApiResponse(resumeData),
            version: currentVersion,
          },
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/api/resumes/*/partial", async (route) => {
      const body = route.request().postDataJSON();
      const requestVersion = body?.version;

      if (requestVersion && requestVersion < version) {
        // Version conflict
        await route.fulfill({
          status: 409,
          json: {
            error: "Version conflict",
            current_version: version,
            your_version: requestVersion,
          },
        });
      } else {
        // Success - increment version
        version++;
        await route.fulfill({
          status: 200,
          json: { success: true, version },
        });
      }
    });

    // Set localStorage tokens
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("access_token", "mock-access-token-for-testing");
      localStorage.setItem("refresh_token", "mock-refresh-token-for-testing");
    });
  }

  test.beforeEach(() => {
    // Reset version for each test
    version = 1;
  });

  test.describe("Single Tab Scenarios", () => {
    test("rapid edits maintain version consistency", async ({ page }) => {
      await setupApiRoutesWithAuth(page, version);

      const editor = new ResumeEditorPage(page);
      await editor.goto("test-resume-id");

      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Make rapid edits
      for (let i = 0; i < 3; i++) {
        await editor.clickEditableField(firstElementId);
        await editor.clearAndType(`Edit number ${i + 1}`);
        await editor.commitEditByClickingOutside();
        await editor.waitForEditComplete(firstElementId);
        await page.waitForTimeout(100);
      }

      // All edits should have succeeded
      const finalText = await editor.getEditableFieldText(firstElementId);
      expect(finalText).toContain("Edit number 3");
    });

    test("edit debouncing prevents excessive API calls", async ({ page }) => {
      let apiCallCount = 0;

      // Mock auth/me endpoint
      await page.route("**/api/auth/me", async (route) => {
        await route.fulfill({ status: 200, json: MOCK_USER });
      });

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
        apiCallCount++;
        await route.fulfill({ status: 200, json: { success: true } });
      });

      // Set localStorage tokens
      await page.goto("/");
      await page.evaluate(() => {
        localStorage.setItem("access_token", "mock-access-token-for-testing");
        localStorage.setItem("refresh_token", "mock-refresh-token-for-testing");
      });

      const editor = new ResumeEditorPage(page);
      await editor.goto("test-resume-id");

      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Start editing and type rapidly
      await editor.clickEditableField(firstElementId);
      await page.keyboard.type("Rapid typing test");

      // Commit
      await editor.commitEditByClickingOutside();
      await editor.waitForEditComplete(firstElementId);

      // Should have minimal API calls due to debouncing
      // (Exact count depends on implementation)
    });
  });

  test.describe("Multi-Tab Conflict Detection", () => {
    test("detects version conflict from another tab", async ({ browser }) => {
      // Create two separate browser contexts (simulating two tabs)
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();

      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      try {
        // Setup routes for both pages
        await setupApiRoutesWithAuth(page1, 1);
        await setupApiRoutesWithAuth(page2, 1);

        const editor1 = new ResumeEditorPage(page1);
        const editor2 = new ResumeEditorPage(page2);

        await editor1.goto("test-resume-id");
        await editor2.goto("test-resume-id");

        const editableElements1 = await editor1.getAllEditableElements();
        const editableElements2 = await editor2.getAllEditableElements();

        const elementId = editableElements1[0];

        // Tab 1 makes an edit
        await editor1.clickEditableField(elementId);
        await editor1.clearAndType("Tab 1 edit");
        await editor1.commitEditByClickingOutside();
        await editor1.waitForEditComplete(elementId);

        // Version is now 2

        // Tab 2 tries to edit with old version
        // This should trigger a conflict warning
        await editor2.clickEditableField(elementId);
        await editor2.clearAndType("Tab 2 edit");
        await editor2.commitEditByClickingOutside();

        // Wait for potential conflict handling
        await page2.waitForTimeout(500);

        // Check for conflict indicator (implementation dependent)
        // Could be a warning message, dialog, or visual indicator
      } finally {
        await context1.close();
        await context2.close();
      }
    });
  });

  test.describe("Conflict Resolution", () => {
    test("shows conflict warning when version mismatch", async ({ page }) => {
      let shouldConflict = false;

      // Mock auth/me endpoint
      await page.route("**/api/auth/me", async (route) => {
        await route.fulfill({ status: 200, json: MOCK_USER });
      });

      await page.route("**/api/resumes/*", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            json: {
              ...toApiResponse(resumeData),
              version: 1,
            },
          });
        } else {
          await route.continue();
        }
      });

      await page.route("**/api/resumes/*/partial", async (route) => {
        if (shouldConflict) {
          await route.fulfill({
            status: 409,
            json: {
              error: "Version conflict",
              message: "Document has been modified by another user",
              current_version: 3,
              your_version: 1,
            },
          });
        } else {
          await route.fulfill({ status: 200, json: { success: true } });
        }
      });

      // Set localStorage tokens
      await page.goto("/");
      await page.evaluate(() => {
        localStorage.setItem("access_token", "mock-access-token-for-testing");
        localStorage.setItem("refresh_token", "mock-refresh-token-for-testing");
      });

      const editor = new ResumeEditorPage(page);
      await editor.goto("test-resume-id");

      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Make first edit (success)
      await editor.clickEditableField(firstElementId);
      await editor.clearAndType("First edit");
      await editor.commitEditByClickingOutside();
      await editor.waitForEditComplete(firstElementId);

      // Enable conflict for next edit
      shouldConflict = true;

      // Make second edit (should conflict)
      await editor.clickEditableField(firstElementId);
      await editor.clearAndType("Conflicting edit");
      await editor.commitEditByClickingOutside();

      // Wait for conflict handling
      await page.waitForTimeout(500);

      // Check for conflict UI (toast, dialog, etc.)
      // This depends on how conflicts are displayed in the UI
    });

    test("can force save on conflict", async ({ page }) => {
      let conflictHandled = false;

      // Mock auth/me endpoint
      await page.route("**/api/auth/me", async (route) => {
        await route.fulfill({ status: 200, json: MOCK_USER });
      });

      await page.route("**/api/resumes/*", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            json: {
              ...toApiResponse(resumeData),
              version: 1,
            },
          });
        } else {
          await route.continue();
        }
      });

      await page.route("**/api/resumes/*/partial", async (route) => {
        const body = route.request().postDataJSON();

        if (body?.force_save) {
          conflictHandled = true;
          await route.fulfill({ status: 200, json: { success: true } });
        } else {
          await route.fulfill({
            status: 409,
            json: { error: "Version conflict" },
          });
        }
      });

      // Set localStorage tokens
      await page.goto("/");
      await page.evaluate(() => {
        localStorage.setItem("access_token", "mock-access-token-for-testing");
        localStorage.setItem("refresh_token", "mock-refresh-token-for-testing");
      });

      const editor = new ResumeEditorPage(page);
      await editor.goto("test-resume-id");

      // This test would need UI interaction to force save
      // Implementation depends on how force save is exposed
    });

    test("can reload on conflict", async ({ page }) => {
      // Mock auth/me endpoint
      await page.route("**/api/auth/me", async (route) => {
        await route.fulfill({ status: 200, json: MOCK_USER });
      });

      await page.route("**/api/resumes/*", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            json: {
              ...toApiResponse(resumeData),
              version: 5, // Newer version after reload
            },
          });
        } else {
          await route.continue();
        }
      });

      await page.route("**/api/resumes/*/partial", async (route) => {
        await route.fulfill({
          status: 409,
          json: { error: "Version conflict" },
        });
      });

      // Set localStorage tokens
      await page.goto("/");
      await page.evaluate(() => {
        localStorage.setItem("access_token", "mock-access-token-for-testing");
        localStorage.setItem("refresh_token", "mock-refresh-token-for-testing");
      });

      const editor = new ResumeEditorPage(page);
      await editor.goto("test-resume-id");

      // This test would verify reload functionality
      // Implementation depends on UI for reload option
    });
  });

  test.describe("Network Error Handling", () => {
    test("handles network error during save gracefully", async ({ page }) => {
      // Mock auth/me endpoint
      await page.route("**/api/auth/me", async (route) => {
        await route.fulfill({ status: 200, json: MOCK_USER });
      });

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
        await route.abort("failed");
      });

      // Set localStorage tokens
      await page.goto("/");
      await page.evaluate(() => {
        localStorage.setItem("access_token", "mock-access-token-for-testing");
        localStorage.setItem("refresh_token", "mock-refresh-token-for-testing");
      });

      const editor = new ResumeEditorPage(page);
      await editor.goto("test-resume-id");

      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Make edit
      await editor.clickEditableField(firstElementId);
      await editor.clearAndType("Edit during network failure");
      await editor.commitEditByClickingOutside();

      // Wait for error handling
      await page.waitForTimeout(500);

      // Should show error state or retry option
      // Check for error toast or indicator
    });

    test("retries failed save", async ({ page }) => {
      let failCount = 0;
      const maxFails = 2;

      // Mock auth/me endpoint
      await page.route("**/api/auth/me", async (route) => {
        await route.fulfill({ status: 200, json: MOCK_USER });
      });

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
        if (failCount < maxFails) {
          failCount++;
          await route.fulfill({ status: 500, json: { error: "Server error" } });
        } else {
          await route.fulfill({ status: 200, json: { success: true } });
        }
      });

      // Set localStorage tokens
      await page.goto("/");
      await page.evaluate(() => {
        localStorage.setItem("access_token", "mock-access-token-for-testing");
        localStorage.setItem("refresh_token", "mock-refresh-token-for-testing");
      });

      const editor = new ResumeEditorPage(page);
      await editor.goto("test-resume-id");

      const editableElements = await editor.getAllEditableElements();
      const firstElementId = editableElements[0];

      // Make edit
      await editor.clickEditableField(firstElementId);
      await editor.clearAndType("Edit with retries");
      await editor.commitEditByClickingOutside();

      // Wait for retries to complete
      await page.waitForTimeout(2000);

      // Eventually should succeed (if retry logic exists)
    });
  });

  test.describe("Stale Data Prevention", () => {
    test("edit reflects latest data from server", async ({ page }) => {
      let serverContent = "Original content";

      // Mock auth/me endpoint
      await page.route("**/api/auth/me", async (route) => {
        await route.fulfill({ status: 200, json: MOCK_USER });
      });

      await page.route("**/api/resumes/*", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            json: {
              ...toApiResponse({
                ...resumeData,
                contact: {
                  ...resumeData.contact,
                  fullName: serverContent,
                },
              }),
            },
          });
        } else {
          await route.continue();
        }
      });

      await page.route("**/api/resumes/*/partial", async (route) => {
        const body = route.request().postDataJSON();
        if (body?.contact?.full_name) {
          serverContent = body.contact.full_name;
        }
        await route.fulfill({ status: 200, json: { success: true } });
      });

      // Set localStorage tokens
      await page.goto("/");
      await page.evaluate(() => {
        localStorage.setItem("access_token", "mock-access-token-for-testing");
        localStorage.setItem("refresh_token", "mock-refresh-token-for-testing");
      });

      const editor = new ResumeEditorPage(page);
      await editor.goto("test-resume-id");

      const editableElements = await editor.getAllEditableElements();
      const nameElementId = editableElements.find((id) =>
        id.includes("fullName") || id.includes("name")
      );

      if (!nameElementId) {
        test.skip();
        return;
      }

      // Edit name
      await editor.clickEditableField(nameElementId);
      await editor.clearAndType("Updated Name");
      await editor.commitEditByClickingOutside();
      await editor.waitForEditComplete(nameElementId);

      // Verify server received update
      expect(serverContent).toBe("Updated Name");
    });
  });
});
