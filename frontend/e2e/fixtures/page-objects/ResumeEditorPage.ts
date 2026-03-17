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
  readonly floatingToolbar: Locator;

  constructor(page: Page) {
    this.page = page;
    this.previewPage = page.locator('[data-testid^="resume-page-"]').first();
    this.fitToPageToggle = page.locator('[data-testid="fit-to-page-toggle"]');
    this.statusBadge = page.locator('[data-testid="fit-status-badge"]');
    this.adjustmentsList = page.locator('[data-testid="fit-adjustments-list"]');
    this.minimumWarning = page.locator('[data-testid="fit-minimum-warning"]');
    this.fontPresetGrid = page.locator('[data-testid="font-preset-grid"]');
    this.fontPresets = page.locator('[data-testid^="font-preset-"]');
    this.currentFontDisplay = page.locator('[data-testid="current-font-display"]');
    this.floatingToolbar = page.locator('[data-floating-toolbar]');
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

  // ============================================================
  // Inline Editing Methods
  // ============================================================

  /**
   * Get an editable element by its element ID
   */
  getEditableElement(elementId: string): Locator {
    return this.page.locator(`[data-element-id="${elementId}"]`);
  }

  /**
   * Click an editable field to start editing
   */
  async clickEditableField(elementId: string): Promise<void> {
    const element = this.getEditableElement(elementId);
    await element.click();
  }

  /**
   * Check if an element is currently being edited
   */
  async isElementEditing(elementId: string): Promise<boolean> {
    const element = this.getEditableElement(elementId);
    const isInvisible = await element.evaluate((el) => {
      return window.getComputedStyle(el).visibility === "hidden";
    });
    // When editing, the element becomes invisible (editor overlay shows)
    return isInvisible;
  }

  /**
   * Get the text content of an editable field
   */
  async getEditableFieldText(elementId: string): Promise<string> {
    const element = this.getEditableElement(elementId);
    return (await element.textContent()) || "";
  }

  /**
   * Type text into the currently active inline editor
   */
  async typeInEditor(text: string): Promise<void> {
    // The editor content is in a ProseMirror contenteditable
    const prosemirror = this.page.locator(".ProseMirror");
    await prosemirror.type(text);
  }

  /**
   * Clear the current editor content and type new text
   */
  async clearAndType(text: string): Promise<void> {
    await this.page.keyboard.press("Meta+a");
    await this.page.keyboard.type(text);
  }

  /**
   * Press a key in the editor
   */
  async pressKey(key: string): Promise<void> {
    await this.page.keyboard.press(key);
  }

  /**
   * Commit the current edit by clicking outside
   */
  async commitEditByClickingOutside(): Promise<void> {
    // Click on the preview page background (outside editable elements)
    await this.previewPage.click({ position: { x: 10, y: 10 } });
  }

  /**
   * Cancel the current edit by pressing Escape
   */
  async cancelEdit(): Promise<void> {
    await this.page.keyboard.press("Escape");
  }

  /**
   * Check if the floating toolbar is visible
   */
  async isFloatingToolbarVisible(): Promise<boolean> {
    return await this.floatingToolbar.isVisible();
  }

  /**
   * Click a formatting button in the floating toolbar
   */
  async clickToolbarButton(
    button: "bold" | "italic" | "underline" | "clear"
  ): Promise<void> {
    const titleMap = {
      bold: "Bold (Ctrl+B)",
      italic: "Italic (Ctrl+I)",
      underline: "Underline (Ctrl+U)",
      clear: "Clear formatting",
    };
    await this.floatingToolbar.locator(`[title="${titleMap[button]}"]`).click();
  }

  /**
   * Select text in the editor
   */
  async selectAllText(): Promise<void> {
    await this.page.keyboard.press("Meta+a");
  }

  /**
   * Wait for editing to complete (element becomes visible again)
   */
  async waitForEditComplete(
    elementId: string,
    options: { timeout?: number } = {}
  ): Promise<void> {
    const timeout = options.timeout ?? 5000;
    const element = this.getEditableElement(elementId);
    await element.waitFor({ state: "visible", timeout });
  }

  /**
   * Get all editable elements on the page
   */
  async getAllEditableElements(): Promise<string[]> {
    const elements = await this.page.locator("[data-element-id]").all();
    const ids: string[] = [];
    for (const el of elements) {
      const id = await el.getAttribute("data-element-id");
      if (id) ids.push(id);
    }
    return ids;
  }

  /**
   * Get the currently focused element's ID
   */
  async getFocusedElementId(): Promise<string | null> {
    return await this.page.evaluate(() => {
      const activeEl = document.activeElement;
      if (activeEl) {
        // Check if it's an editable element
        const editableParent = activeEl.closest("[data-element-id]");
        if (editableParent) {
          return editableParent.getAttribute("data-element-id");
        }
        // Check if it's the ProseMirror editor
        if (activeEl.classList.contains("ProseMirror")) {
          // Find which element is being edited (invisible)
          const invisibleEl = document.querySelector(
            '[data-element-id][style*="visibility: hidden"], [data-element-id].invisible'
          );
          return invisibleEl?.getAttribute("data-element-id") || null;
        }
      }
      return null;
    });
  }

  /**
   * Check if an element has rich text attributes
   */
  async isRichTextElement(elementId: string): Promise<boolean> {
    const element = this.getEditableElement(elementId);
    const richText = await element.getAttribute("data-rich-text");
    return richText === "true";
  }

  /**
   * Check if an element shows toolbar on edit
   */
  async elementShowsToolbar(elementId: string): Promise<boolean> {
    const element = this.getEditableElement(elementId);
    const showToolbar = await element.getAttribute("data-show-toolbar");
    return showToolbar === "true";
  }
}
