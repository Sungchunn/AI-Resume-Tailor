import { Page, expect } from "@playwright/test";

export async function waitForAutoFitComplete(
  page: Page,
  options: { timeout?: number } = {}
): Promise<"fitted" | "minimum_reached"> {
  const timeout = options.timeout ?? 10000;
  const statusBadge = page.locator('[data-testid="fit-status-badge"]');

  await expect(statusBadge).toHaveText(/(Fitted|At minimum)/, { timeout });

  const text = await statusBadge.textContent();
  return text?.includes("minimum") ? "minimum_reached" : "fitted";
}

export async function measurePageFit(page: Page): Promise<{
  contentHeight: number;
  clientHeight: number;
  fits: boolean;
}> {
  const previewPage = page.locator('[data-testid="resume-page"]');

  const contentHeight = await previewPage.evaluate((el) => el.scrollHeight);
  const clientHeight = await previewPage.evaluate((el) => el.clientHeight);

  return {
    contentHeight,
    clientHeight,
    fits: contentHeight <= clientHeight,
  };
}

export function captureConsoleLogs(page: Page, filter: string): string[] {
  const logs: string[] = [];
  page.on("console", (msg) => {
    if (msg.text().includes(filter)) {
      logs.push(msg.text());
    }
  });
  return logs;
}
