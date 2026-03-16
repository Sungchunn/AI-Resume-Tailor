import { Page, Locator, expect } from "@playwright/test";

export type FitStatus = "idle" | "fitting" | "fitted" | "minimum_reached";

export class ResumeEditorPage {
  readonly page: Page;
  readonly previewPage: Locator;
  readonly fitToPageToggle: Locator;
  readonly statusBadge: Locator;
  readonly adjustmentsList: Locator;
  readonly minimumWarning: Locator;
  readonly fontPresetGrid: Locator;
  readonly fontPresets: Locator;
  readonly currentFontDisplay: Locator;

  constructor(page: Page) {
    this.page = page;
    this.previewPage = page.locator('[data-testid="resume-page"]');
    this.fitToPageToggle = page.locator('[data-testid="fit-to-page-toggle"]');
    this.statusBadge = page.locator('[data-testid="fit-status-badge"]');
    this.adjustmentsList = page.locator('[data-testid="fit-adjustments-list"]');
    this.minimumWarning = page.locator('[data-testid="fit-minimum-warning"]');
    this.fontPresetGrid = page.locator('[data-testid="font-preset-grid"]');
    this.fontPresets = page.locator('[data-testid^="font-preset-"]');
    this.currentFontDisplay = page.locator('[data-testid="current-font-display"]');
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
    await expect(this.statusBadge).toHaveText(/(Fitted|Limit)/, { timeout });
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
      if (text?.includes("Limit")) return "minimum_reached";
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
   * Select a font by clicking the corresponding preset button.
   * Accepts either the display label (e.g., "Inter", "Times New Roman")
   * or the preset key (e.g., "inter", "timesNewRoman").
   */
  async selectFont(fontFamily: string) {
    // Map display names to preset keys
    const displayToPreset: Record<string, string> = {
      "Inter": "inter",
      "Roboto": "roboto",
      "Open Sans": "openSans",
      "Lato": "lato",
      "Arial": "arial",
      "Georgia": "georgia",
      "Times New Roman": "timesNewRoman",
    };
    const presetKey = displayToPreset[fontFamily] || fontFamily.toLowerCase();
    await this.page.locator(`[data-testid="font-preset-${presetKey}"]`).click();
  }

  /**
   * Get the current font family from the display element
   */
  async getSelectedFont(): Promise<string> {
    const text = await this.currentFontDisplay.locator("span").first().textContent();
    return text?.trim() || "";
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
   * Check if typography controls are locked (font grid disabled)
   */
  async isTypographyLocked(): Promise<boolean> {
    const classes = await this.fontPresetGrid.getAttribute("class");
    return classes?.includes("pointer-events-none") ?? false;
  }

  /**
   * Check if a font preset button is disabled
   */
  async isFontPresetDisabled(presetKey: string): Promise<boolean> {
    const button = this.page.locator(`[data-testid="font-preset-${presetKey}"]`);
    return await button.isDisabled();
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
