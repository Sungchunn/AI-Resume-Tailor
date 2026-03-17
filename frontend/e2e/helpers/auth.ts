import { Page } from "@playwright/test";

/**
 * Mock user data for authenticated tests
 */
export const MOCK_USER = {
  id: 1,
  email: "test@example.com",
  timezone: "America/Los_Angeles",
  created_at: "2024-01-01T00:00:00Z",
};

/**
 * Set up authentication for E2E tests.
 * This mocks the auth/me endpoint and sets up localStorage tokens.
 *
 * Call this BEFORE navigating to protected pages.
 *
 * @example
 * ```ts
 * test.beforeEach(async ({ page }) => {
 *   await setupAuth(page);
 *   // Now navigate to protected routes
 *   await page.goto('/library/resumes/test-id/edit');
 * });
 * ```
 */
export async function setupAuth(page: Page): Promise<void> {
  // Mock the auth/me endpoint
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      json: MOCK_USER,
    });
  });

  // Set localStorage tokens before navigation
  // We need to navigate to the domain first to set localStorage
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("access_token", "mock-access-token-for-testing");
    localStorage.setItem("refresh_token", "mock-refresh-token-for-testing");
  });
}

/**
 * Clear authentication state.
 * Useful for testing logout or unauthenticated flows.
 */
export async function clearAuth(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  });
}
