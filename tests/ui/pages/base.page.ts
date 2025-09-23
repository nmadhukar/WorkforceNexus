import { Page, Locator, expect } from '@playwright/test';

/**
 * Base Page Object Model class providing common functionality for all pages
 * @description Contains shared methods and properties for navigation, waiting, and common actions
 */
export abstract class BasePage {
  protected page: Page;
  protected baseUrl: string;

  constructor(page: Page, baseUrl: string = 'http://localhost:5000') {
    this.page = page;
    this.baseUrl = baseUrl;
  }

  /**
   * Navigate to a specific path
   * @param path - The path to navigate to
   */
  async goto(path: string = '/'): Promise<void> {
    await this.page.goto(`${this.baseUrl}${path}`);
  }

  /**
   * Wait for an element to be visible
   * @param selector - The selector to wait for
   * @param timeout - Optional timeout in milliseconds
   */
  async waitForSelector(selector: string, timeout?: number): Promise<Locator> {
    const locator = this.page.locator(selector);
    await locator.waitFor({ state: 'visible', timeout });
    return locator;
  }

  /**
   * Wait for navigation to complete
   * @param url - Optional URL pattern to wait for
   */
  async waitForNavigation(url?: string | RegExp): Promise<void> {
    if (url) {
      await this.page.waitForURL(url);
    } else {
      await this.page.waitForLoadState('networkidle');
    }
  }

  /**
   * Take a screenshot with a meaningful name
   * @param name - Screenshot name
   */
  async screenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `test-results/${name}.png`, fullPage: true });
  }

  /**
   * Wait for a toast message to appear
   * @param type - Toast type (success, error, etc.)
   * @param timeout - Optional timeout
   */
  async waitForToast(type: 'success' | 'error' | 'destructive' = 'success', timeout: number = 5000): Promise<Locator> {
    const toastSelector = type === 'success' 
      ? '[data-testid*="toast"]:not([data-testid*="error"]):not([data-testid*="destructive"])'
      : `[data-testid*="toast-${type}"], [class*="${type}"]`;
    
    return await this.waitForSelector(toastSelector, timeout);
  }

  /**
   * Fill a form field by its test ID
   * @param testId - The test ID of the input field
   * @param value - The value to fill
   */
  async fillByTestId(testId: string, value: string): Promise<void> {
    await this.page.fill(`[data-testid="${testId}"]`, value);
  }

  /**
   * Click an element by its test ID
   * @param testId - The test ID of the element
   */
  async clickByTestId(testId: string): Promise<void> {
    await this.page.click(`[data-testid="${testId}"]`);
  }

  /**
   * Select an option by its test ID
   * @param testId - The test ID of the select element
   * @param value - The value to select
   */
  async selectByTestId(testId: string, value: string): Promise<void> {
    await this.page.selectOption(`[data-testid="${testId}"]`, value);
  }

  /**
   * Assert that an element with test ID is visible
   * @param testId - The test ID of the element
   */
  async expectVisible(testId: string): Promise<void> {
    await expect(this.page.locator(`[data-testid="${testId}"]`)).toBeVisible();
  }

  /**
   * Assert that an element with test ID contains specific text
   * @param testId - The test ID of the element
   * @param text - The expected text
   */
  async expectText(testId: string, text: string): Promise<void> {
    await expect(this.page.locator(`[data-testid="${testId}"]`)).toContainText(text);
  }

  /**
   * Wait for loading states to complete
   */
  async waitForLoading(): Promise<void> {
    // Wait for common loading indicators to disappear
    await this.page.waitForFunction(
      () => !document.querySelector('.animate-spin, [data-testid*="loading"], .loading')
    );
  }
}