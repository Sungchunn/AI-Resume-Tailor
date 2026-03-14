import { Page, Locator, expect } from "@playwright/test";

export class ResumeEditorPage {
  readonly page: Page;
  readonly previewPage: Locator;
  readonly fitToPageToggle: Locator;
  readonly statusBadge: Locator;
  readonly adjustmentsList: Locator;
  readonly minimumWarning: Locator;

  constructor(page: Page) {
    this.page = page;
    this.previewPage = page.locator('[data-testid="resume-page"]');
    this.fitToPageToggle = page.locator('[data-testid="fit-to-page-toggle"]');
    this.statusBadge = page.locator('[data-testid="fit-status-badge"]');
    this.adjustmentsList = page.locator('[data-testid="fit-adjustments-list"]');
    this.minimumWarning = page.locator('[data-testid="fit-minimum-warning"]');
  }

  async goto(resumeId: string) {
    await this.page.goto(`/library/resumes/${resumeId}/edit`);
    await this.previewPage.waitFor({ state: "visible" });
  }

  async gotoView(resumeId: string) {
    await this.page.goto(`/library/resumes/${resumeId}`);
    await this.previewPage.waitFor({ state: "visible" });
  }

  async gotoTailorEditor(buildId: string) {
    await this.page.goto(`/tailor/editor/${buildId}`);
    await this.previewPage.waitFor({ state: "visible" });
  }

  async enableFitToPage() {
    const isEnabled = await this.fitToPageToggle.getAttribute("aria-checked");
    if (isEnabled !== "true") {
      await this.fitToPageToggle.click();
    }
  }

  async disableFitToPage() {
    const isEnabled = await this.fitToPageToggle.getAttribute("aria-checked");
    if (isEnabled === "true") {
      await this.fitToPageToggle.click();
    }
  }

  async waitForFitComplete(options: { timeout?: number } = {}) {
    const timeout = options.timeout ?? 10000;
    await expect(this.statusBadge).toHaveText(/(Fitted|At minimum)/, { timeout });
  }

  async getPreviewHeight(): Promise<number> {
    return await this.previewPage.evaluate((el) => el.scrollHeight);
  }

  async getPageClientHeight(): Promise<number> {
    return await this.previewPage.evaluate((el) => el.clientHeight);
  }

  async contentFits(): Promise<boolean> {
    const scrollHeight = await this.getPreviewHeight();
    const clientHeight = await this.getPageClientHeight();
    return scrollHeight <= clientHeight;
  }

  async getStatus(): Promise<"idle" | "fitting" | "fitted" | "minimum_reached"> {
    try {
      const text = await this.statusBadge.textContent({ timeout: 1000 });
      if (text?.includes("Fitting")) return "fitting";
      if (text?.includes("Fitted")) return "fitted";
      if (text?.includes("At minimum")) return "minimum_reached";
    } catch {
      // Badge not visible = idle
    }
    return "idle";
  }

  async getAppliedReductions(): Promise<string[]> {
    try {
      const items = await this.adjustmentsList.locator("li").allTextContents();
      return items;
    } catch {
      return [];
    }
  }
}
