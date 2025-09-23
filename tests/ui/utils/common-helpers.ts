import { Page, expect, Locator } from '@playwright/test';

/**
 * Common helper utilities for UI tests
 * @description Provides reusable helper methods for common test operations
 */
export class CommonHelpers {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Wait for element to be visible and stable
   * @param locator - Element locator
   * @param timeout - Optional timeout
   */
  async waitForElementStable(locator: Locator, timeout: number = 5000): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout });
    
    // Wait a bit more to ensure element is stable (no animations/transitions)
    await this.page.waitForTimeout(300);
  }

  /**
   * Fill form field and validate it was filled correctly
   * @param locator - Input field locator
   * @param value - Value to fill
   */
  async fillAndValidate(locator: Locator, value: string): Promise<void> {
    await locator.fill(value);
    await expect(locator).toHaveValue(value);
  }

  /**
   * Click element and wait for navigation
   * @param locator - Element to click
   * @param expectedUrl - Expected URL pattern after click
   */
  async clickAndWaitForNavigation(locator: Locator, expectedUrl?: string | RegExp): Promise<void> {
    if (expectedUrl) {
      await Promise.all([
        this.page.waitForURL(expectedUrl),
        locator.click()
      ]);
    } else {
      await Promise.all([
        this.page.waitForLoadState('networkidle'),
        locator.click()
      ]);
    }
  }

  /**
   * Select option from dropdown and validate selection
   * @param selectLocator - Select element locator
   * @param value - Value to select
   */
  async selectAndValidate(selectLocator: Locator, value: string): Promise<void> {
    await selectLocator.selectOption(value);
    await expect(selectLocator).toHaveValue(value);
  }

  /**
   * Upload file and wait for upload completion
   * @param fileInputLocator - File input locator
   * @param filePath - Path to file to upload
   */
  async uploadFile(fileInputLocator: Locator, filePath: string): Promise<void> {
    await fileInputLocator.setInputFiles(filePath);
    
    // Wait for upload to complete - look for success indicators
    await expect(
      this.page.locator('.upload-success, [data-testid*="upload-success"], .file-uploaded')
    ).toBeVisible({ timeout: 10000 });
  }

  /**
   * Wait for toast notification and validate message
   * @param expectedMessage - Expected message text (partial match)
   * @param type - Toast type (success, error, etc.)
   */
  async waitForToastAndValidate(expectedMessage: string, type: 'success' | 'error' | 'warning' = 'success'): Promise<void> {
    const toastSelectors = {
      success: '.toast-success, [data-testid*="toast-success"], .alert-success',
      error: '.toast-error, [data-testid*="toast-error"], .alert-error, .toast-destructive',
      warning: '.toast-warning, [data-testid*="toast-warning"], .alert-warning'
    };
    
    const toastLocator = this.page.locator(toastSelectors[type]).first();
    await expect(toastLocator).toBeVisible({ timeout: 5000 });
    await expect(toastLocator).toContainText(expectedMessage);
  }

  /**
   * Scroll element into view and ensure it's visible
   * @param locator - Element locator
   */
  async scrollIntoViewAndEnsureVisible(locator: Locator): Promise<void> {
    await locator.scrollIntoViewIfNeeded();
    await expect(locator).toBeInViewport();
  }

  /**
   * Wait for table to load and validate row count
   * @param tableLocator - Table locator
   * @param expectedMinRows - Minimum expected rows (excluding header)
   */
  async waitForTableLoad(tableLocator: Locator, expectedMinRows: number = 1): Promise<void> {
    await expect(tableLocator).toBeVisible();
    
    // Wait for loading states to complete
    await this.page.waitForFunction(
      () => !document.querySelector('.loading, .animate-spin, .table-loading')
    );
    
    // Validate table has data rows
    const rows = tableLocator.locator('tbody tr, tr:not(:first-child)');
    await expect(rows).toHaveCount({ min: expectedMinRows });
  }

  /**
   * Handle modal dialog interactions
   * @param triggerLocator - Element that opens modal
   * @param modalTitle - Expected modal title
   * @param action - Action to perform in modal ('confirm', 'cancel', or custom button text)
   */
  async handleModal(triggerLocator: Locator, modalTitle: string, action: string = 'confirm'): Promise<void> {
    // Click trigger to open modal
    await triggerLocator.click();
    
    // Wait for modal to appear
    const modal = this.page.locator('[role="dialog"], .modal, .dialog').first();
    await expect(modal).toBeVisible();
    
    // Validate modal title
    await expect(modal.locator(`text=${modalTitle}`)).toBeVisible();
    
    // Perform action
    let buttonText: string;
    switch (action.toLowerCase()) {
      case 'confirm':
        buttonText = 'Confirm|OK|Yes|Submit';
        break;
      case 'cancel':
        buttonText = 'Cancel|Close|No';
        break;
      default:
        buttonText = action;
    }
    
    const actionButton = modal.locator(`button:has-text("${buttonText}"), button[data-testid*="${action.toLowerCase()}"]`).first();
    await actionButton.click();
    
    // Wait for modal to close
    await expect(modal).toBeHidden();
  }

  /**
   * Test responsive behavior by changing viewport
   * @param width - Viewport width
   * @param height - Viewport height
   * @param testCallback - Function to run after viewport change
   */
  async testResponsive(width: number, height: number, testCallback: () => Promise<void>): Promise<void> {
    // Store original viewport
    const originalViewport = this.page.viewportSize();
    
    try {
      // Set new viewport
      await this.page.setViewportSize({ width, height });
      await this.page.waitForTimeout(500); // Allow time for responsive changes
      
      // Run test callback
      await testCallback();
      
    } finally {
      // Restore original viewport
      if (originalViewport) {
        await this.page.setViewportSize(originalViewport);
      }
    }
  }

  /**
   * Test keyboard navigation
   * @param startLocator - Starting element
   * @param keys - Array of keys to press
   * @param expectedFinalLocator - Expected final focused element
   */
  async testKeyboardNavigation(startLocator: Locator, keys: string[], expectedFinalLocator: Locator): Promise<void> {
    // Focus on starting element
    await startLocator.focus();
    await expect(startLocator).toBeFocused();
    
    // Press each key
    for (const key of keys) {
      await this.page.keyboard.press(key);
      await this.page.waitForTimeout(100); // Small delay between key presses
    }
    
    // Validate final focus
    await expect(expectedFinalLocator).toBeFocused();
  }

  /**
   * Capture full page screenshot with timestamp
   * @param name - Screenshot name
   */
  async captureScreenshot(name: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await this.page.screenshot({
      path: `test-results/screenshots/${name}-${timestamp}.png`,
      fullPage: true
    });
  }

  /**
   * Wait for multiple conditions to be met
   * @param conditions - Array of async functions that should resolve
   * @param timeout - Total timeout for all conditions
   */
  async waitForMultipleConditions(conditions: (() => Promise<void>)[], timeout: number = 10000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        await Promise.all(conditions.map(condition => condition()));
        return; // All conditions met
      } catch {
        await this.page.waitForTimeout(100);
      }
    }
    
    throw new Error('Timeout waiting for multiple conditions to be met');
  }

  /**
   * Validate accessibility - basic checks
   * @param elementLocator - Element to check for accessibility
   */
  async validateBasicAccessibility(elementLocator: Locator): Promise<void> {
    // Check if interactive elements have proper labels
    const interactiveElements = elementLocator.locator('button, input, select, textarea, [role="button"]');
    const count = await interactiveElements.count();
    
    for (let i = 0; i < count; i++) {
      const element = interactiveElements.nth(i);
      const tagName = await element.evaluate((el) => el.tagName.toLowerCase());
      
      if (tagName === 'button') {
        // Buttons should have text or aria-label
        const hasText = await element.textContent();
        const hasAriaLabel = await element.getAttribute('aria-label');
        expect(hasText || hasAriaLabel).toBeTruthy();
      }
      
      if (['input', 'select', 'textarea'].includes(tagName)) {
        // Form elements should have labels or aria-label
        const id = await element.getAttribute('id');
        let hasLabel = false;
        
        if (id) {
          hasLabel = await this.page.locator(`label[for="${id}"]`).count() > 0;
        }
        
        const hasAriaLabel = await element.getAttribute('aria-label');
        const hasAriaLabelledBy = await element.getAttribute('aria-labelledby');
        
        expect(hasLabel || hasAriaLabel || hasAriaLabelledBy).toBeTruthy();
      }
    }
  }

  /**
   * Test form validation by submitting empty/invalid data
   * @param formLocator - Form element locator
   * @param submitButtonLocator - Submit button locator
   * @param expectedErrorFields - Array of field selectors that should show errors
   */
  async testFormValidation(formLocator: Locator, submitButtonLocator: Locator, expectedErrorFields: string[]): Promise<void> {
    // Clear all form fields first
    const inputs = formLocator.locator('input, textarea, select');
    const inputCount = await inputs.count();
    
    for (let i = 0; i < inputCount; i++) {
      await inputs.nth(i).clear();
    }
    
    // Try to submit form
    await submitButtonLocator.click();
    
    // Check for validation errors
    for (const fieldSelector of expectedErrorFields) {
      const errorElement = this.page.locator(`${fieldSelector} + .error, ${fieldSelector} ~ .error, .error:near(${fieldSelector})`);
      await expect(errorElement).toBeVisible();
    }
  }
}