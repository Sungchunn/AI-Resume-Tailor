import { Page, Locator, expect } from "@playwright/test";

export type FitStatus = "idle" | "fitting" | "fitted" | "minimum_reached";

export class ResumeEditorPage {
  readonly page: Page;
  readonly previewPage: Locator;
  readonly fitToPageToggle: Locator;
  readonly statusBadge: Locator;
  readonly adjustmentsList: Locator;
  readonly minimumWarning: Locator;
  readonly fontFamilySelect: Locator;
  readonly fontSizeBody: Locator;
  readonly fontSizeHeading: Locator;
  readonly fontSizeSubheading: Locator;
  readonly spacingLine: Locator;
  readonly spacingSection: Locator;
  readonly spacingEntry: Locator;

  constructor(page: Page) {
    this.page = page;
    this.previewPage = page.locator('[data-testid="resume-page"]');
    this.fitToPageToggle = page.locator('[data-testid="fit-to-page-toggle"]');
    this.statusBadge = page.locator('[data-testid="fit-status-badge"]');
    this.adjustmentsList = page.locator('[data-testid="fit-adjustments-list"]');
    this.minimumWarning = page.locator('[data-testid="fit-minimum-warning"]');
    this.fontFamilySelect = page.locator('[data-testid="font-family-select"]');
    this.fontSizeBody = page.locator('[data-testid="font-size-body"]');
    this.fontSizeHeading = page.locator('[data-testid="font-size-heading"]');
    this.fontSizeSubheading = page.locator('[data-testid="font-size-subheading"]');
    this.spacingLine = page.locator('[data-testid="spacing-line"]');
    this.spacingSection = page.locator('[data-testid="spacing-section"]');
    this.spacingEntry = page.locator('[data-testid="spacing-entry"]');
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

  async getStatus(): Promise<FitStatus> {
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

  /**
   * Select a font family from the dropdown
   */
  async selectFont(fontFamily: string) {
    await this.fontFamilySelect.selectOption(fontFamily);
  }

  /**
   * Get the current font family value
   */
  async getSelectedFont(): Promise<string> {
    return await this.fontFamilySelect.inputValue();
  }

  /**
   * Get the computed body font size from the preview
   */
  async getComputedFontSize(): Promise<number> {
    return await this.previewPage.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return parseFloat(style.fontSize);
    });
  }

  /**
   * Check if a control is disabled
   */
  async isControlDisabled(locator: Locator): Promise<boolean> {
    return await locator.isDisabled();
  }

  /**
   * Wait for a status transition from one state to another
   */
  async waitForStatusTransition(
    from: FitStatus,
    to: FitStatus,
    options: { timeout?: number } = {}
  ): Promise<void> {
    const timeout = options.timeout ?? 10000;
    const startTime = Date.now();

    // First, verify we're in the "from" state
    const currentStatus = await this.getStatus();
    if (currentStatus !== from) {
      throw new Error(`Expected status to be "${from}" but got "${currentStatus}"`);
    }

    // Wait for the "to" state
    while (Date.now() - startTime < timeout) {
      const status = await this.getStatus();
      if (status === to) {
        return;
      }
      await this.page.waitForTimeout(100);
    }

    throw new Error(`Timeout waiting for status transition from "${from}" to "${to}"`);
  }

  /**
   * Check if the toggle is currently enabled
   */
  async isFitToPageEnabled(): Promise<boolean> {
    const isEnabled = await this.fitToPageToggle.getAttribute("aria-checked");
    return isEnabled === "true";
  }
}
