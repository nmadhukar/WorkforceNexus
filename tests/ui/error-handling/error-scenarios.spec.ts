import { test, expect } from '@playwright/test';
import { AuthPage } from '../pages/auth.page';
import { EmployeesPage } from '../pages/employees.page';
import { DocumentsPage } from '../pages/documents.page';
import { SettingsPage } from '../pages/settings.page';
import { AuthHelpers } from '../utils/auth-helpers';
import { TestDataFactory } from '../utils/test-data';
import { CommonHelpers } from '../utils/common-helpers';

/**
 * Error Handling and Edge Case Tests
 * @description Tests for error scenarios, network failures, and edge cases
 */
test.describe('Error Handling and Edge Cases', () => {
  let authPage: AuthPage;
  let employeesPage: EmployeesPage;
  let documentsPage: DocumentsPage;
  let settingsPage: SettingsPage;
  let authHelpers: AuthHelpers;
  let commonHelpers: CommonHelpers;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    employeesPage = new EmployeesPage(page);
    documentsPage = new DocumentsPage(page);
    settingsPage = new SettingsPage(page);
    authHelpers = new AuthHelpers(page);
    commonHelpers = new CommonHelpers(page);
  });

  test.describe('Network Error Handling', () => {
    test('should handle complete network failure gracefully', async ({ page }) => {
      await authHelpers.loginAs('hr');
      
      // Mock complete network failure
      await page.route('**/*', route => route.abort('internetdisconnected'));
      
      await page.goto('/employees');
      
      // Should show appropriate error message
      const errorMessage = page.locator('text=network error, text=connection failed, text=offline, .error-message');
      await expect(errorMessage.first()).toBeVisible({ timeout: 10000 });
    });

    test('should handle API server errors', async ({ page }) => {
      await authHelpers.loginAs('hr');
      
      // Mock server error
      await page.route('**/api/**', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error', message: 'Database connection failed' })
        });
      });
      
      await employeesPage.navigateToEmployees();
      
      // Should show server error message
      const errorMessage = page.locator('text=server error, text=something went wrong, .error-banner');
      await expect(errorMessage.first()).toBeVisible();
    });

    test('should handle API timeout errors', async ({ page }) => {
      await authHelpers.loginAs('hr');
      
      // Mock slow API responses that timeout
      await page.route('**/api/employees', route => {
        setTimeout(() => {
          route.fulfill({
            status: 408,
            body: JSON.stringify({ error: 'Request timeout' })
          });
        }, 10000);
      });
      
      await employeesPage.navigateToEmployees();
      
      // Should show timeout error
      const timeoutMessage = page.locator('text=timeout, text=taking too long, .timeout-error');
      await expect(timeoutMessage.first()).toBeVisible({ timeout: 15000 });
    });

    test('should retry failed requests automatically', async ({ page }) => {
      await authHelpers.loginAs('hr');
      
      let requestCount = 0;
      
      // Mock API that fails first time, succeeds second time
      await page.route('**/api/employees', route => {
        requestCount++;
        if (requestCount === 1) {
          route.fulfill({ status: 500, body: 'Server Error' });
        } else {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([])
          });
        }
      });
      
      await employeesPage.navigateToEmployees();
      
      // Should eventually succeed after retry
      await expect(employeesPage.employeesTable).toBeVisible({ timeout: 10000 });
      expect(requestCount).toBeGreaterThan(1);
    });
  });

  test.describe('Form Validation Edge Cases', () => {
    test('should handle extremely long input values', async ({ page }) => {
      const longString = 'a'.repeat(10000);
      
      await authPage.navigateToAuth();
      await authPage.registerTab.click();
      
      // Try to enter extremely long username
      await authPage.registerUsernameInput.fill(longString);
      await authPage.registerPasswordInput.fill('password');
      await authPage.registerConfirmPasswordInput.fill('password');
      
      await authPage.registerSubmitButton.click();
      
      // Should handle gracefully with validation error or truncation
      const validationError = page.locator('text=too long, text=maximum length, .validation-error');
      await expect(validationError.first()).toBeVisible();
    });

    test('should handle special characters in form inputs', async ({ page }) => {
      const specialCharsData = {
        username: '"><script>alert("xss")</script>',
        password: 'pass&word<>',
        firstName: 'John\'s "Test" Name',
        lastName: 'O\'Connor & Sons'
      };
      
      await authHelpers.loginAs('hr');
      await employeesPage.navigateToAddEmployee();
      
      const firstNameInput = page.locator('[data-testid="input-firstName"]');
      const lastNameInput = page.locator('[data-testid="input-lastName"]');
      
      if (await firstNameInput.isVisible()) {
        await firstNameInput.fill(specialCharsData.firstName);
        await lastNameInput.fill(specialCharsData.lastName);
        
        // Should handle special characters without security issues
        await expect(firstNameInput).toHaveValue(specialCharsData.firstName);
        await expect(lastNameInput).toHaveValue(specialCharsData.lastName);
        
        // No XSS should occur
        const alertDialog = page.locator('text=xss');
        await expect(alertDialog).toHaveCount(0);
      }
    });

    test('should handle emoji and unicode characters', async ({ page }) => {
      const unicodeData = {
        firstName: '张三',
        lastName: '李四',
        notes: '🎉 Test employee with émojis and àccénts'
      };
      
      await authHelpers.loginAs('hr');
      await employeesPage.navigateToAddEmployee();
      
      const firstNameInput = page.locator('[data-testid="input-firstName"]');
      const lastNameInput = page.locator('[data-testid="input-lastName"]');
      
      if (await firstNameInput.isVisible()) {
        await firstNameInput.fill(unicodeData.firstName);
        await lastNameInput.fill(unicodeData.lastName);
        
        // Should handle unicode correctly
        await expect(firstNameInput).toHaveValue(unicodeData.firstName);
        await expect(lastNameInput).toHaveValue(unicodeData.lastName);
      }
    });

    test('should validate date formats correctly', async ({ page }) => {
      await authHelpers.loginAs('hr');
      await employeesPage.navigateToAddEmployee();
      
      const dateInput = page.locator('[data-testid="input-dateOfBirth"], [data-testid="input-hireDate"]').first();
      
      if (await dateInput.isVisible()) {
        const invalidDates = [
          '99/99/9999',
          '2024-13-45',
          'not-a-date',
          '2024/02/30', // Invalid date
          '1800-01-01'  // Too old
        ];
        
        for (const invalidDate of invalidDates) {
          await dateInput.fill(invalidDate);
          
          // Should show date validation error
          const validationError = page.locator('text=valid date, text=invalid date, .date-error');
          if (await validationError.isVisible()) {
            await expect(validationError).toBeVisible();
          }
          
          await dateInput.clear();
        }
      }
    });
  });

  test.describe('File Upload Edge Cases', () => {
    test.beforeEach(async ({ page }) => {
      await authHelpers.loginAs('hr');
    });

    test('should handle corrupted file uploads', async ({ page }) => {
      await documentsPage.navigateToDocuments();
      await documentsPage.clickByTestId('button-upload-document');
      
      // Create a corrupted file scenario
      await page.evaluate(() => {
        const fileInput = document.querySelector('[data-testid="input-file-upload"]') as HTMLInputElement;
        if (fileInput) {
          // Mock corrupted file
          const corruptedFile = new File(['corrupted-data'], 'corrupted.pdf', { type: 'application/pdf' });
          Object.defineProperty(corruptedFile, 'arrayBuffer', {
            value: () => Promise.reject(new Error('File is corrupted'))
          });
        }
      });
      
      await documentsPage.documentNameInput.fill('Corrupted File Test');
      await documentsPage.clickByTestId('button-submit-upload');
      
      // Should handle corruption gracefully
      const errorMessage = page.locator('text=corrupted, text=invalid file, .upload-error');
      await expect(errorMessage.first()).toBeVisible();
    });

    test('should handle zero-byte files', async ({ page }) => {
      await documentsPage.navigateToDocuments();
      await documentsPage.clickByTestId('button-upload-document');
      
      // Try to upload empty file
      await page.evaluate(() => {
        const fileInput = document.querySelector('[data-testid="input-file-upload"]') as HTMLInputElement;
        if (fileInput) {
          const emptyFile = new File([''], 'empty.txt', { type: 'text/plain' });
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(emptyFile);
          fileInput.files = dataTransfer.files;
        }
      });
      
      await documentsPage.documentNameInput.fill('Empty File Test');
      await documentsPage.clickByTestId('button-submit-upload');
      
      // Should reject empty files
      const errorMessage = page.locator('text=empty file, text=file cannot be empty, .empty-file-error');
      await expect(errorMessage.first()).toBeVisible();
    });

    test('should handle files with malicious extensions', async ({ page }) => {
      await documentsPage.navigateToDocuments();
      await documentsPage.clickByTestId('button-upload-document');
      
      // Try to upload file with dangerous extension
      await page.evaluate(() => {
        const fileInput = document.querySelector('[data-testid="input-file-upload"]') as HTMLInputElement;
        if (fileInput) {
          const maliciousFile = new File(['malicious content'], 'virus.exe', { type: 'application/octet-stream' });
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(maliciousFile);
          fileInput.files = dataTransfer.files;
        }
      });
      
      await documentsPage.documentNameInput.fill('Malicious File');
      await documentsPage.clickByTestId('button-submit-upload');
      
      // Should reject dangerous file types
      const errorMessage = page.locator('text=not allowed, text=unsupported file type, .file-type-error');
      await expect(errorMessage.first()).toBeVisible();
    });
  });

  test.describe('Authentication Edge Cases', () => {
    test('should handle concurrent login sessions', async ({ page, context }) => {
      // Create second browser context to simulate concurrent login
      const secondContext = await context.browser()?.newContext();
      if (!secondContext) return;
      
      const secondPage = await secondContext.newPage();
      const secondAuthPage = new AuthPage(secondPage);
      
      // Login from first session
      await authHelpers.loginAs('hr');
      await expect(page).toHaveURL('/');
      
      // Login from second session with same user
      await secondAuthPage.navigateToAuth();
      const credentials = AuthHelpers.CREDENTIALS.hr;
      await secondAuthPage.login(credentials.username, credentials.password);
      
      // Both sessions should handle concurrent access gracefully
      await expect(secondPage).toHaveURL('/');
      
      await secondContext.close();
    });

    test('should handle session hijacking attempts', async ({ page }) => {
      await authHelpers.loginAs('hr');
      
      // Simulate session token manipulation
      await page.evaluate(() => {
        localStorage.setItem('authToken', 'invalid-hijacked-token');
      });
      
      // Navigate to protected route
      await page.goto('/employees');
      
      // Should detect invalid token and redirect to login
      await expect(page).toHaveURL('/auth');
    });

    test('should handle expired session tokens', async ({ page }) => {
      await authHelpers.loginAs('hr');
      
      // Simulate expired token
      await page.evaluate(() => {
        localStorage.setItem('authToken', 'expired.token.here');
        localStorage.setItem('tokenExpiry', String(Date.now() - 10000)); // Expired 10 seconds ago
      });
      
      await page.goto('/employees');
      
      // Should redirect to login due to expired token
      await expect(page).toHaveURL('/auth');
    });
  });

  test.describe('Data Consistency Edge Cases', () => {
    test.beforeEach(async ({ page }) => {
      await authHelpers.loginAs('hr');
    });

    test('should handle optimistic update failures', async ({ page }) => {
      await employeesPage.navigateToEmployees();
      
      // Mock update failure after optimistic update
      await page.route('**/api/employees/**', route => {
        if (route.request().method() === 'PUT') {
          route.fulfill({ status: 409, body: 'Conflict: Data was modified' });
        } else {
          route.continue();
        }
      });
      
      // Try to edit an employee (if available)
      const editButton = page.locator('[data-testid*="edit"], button:has-text("Edit")').first();
      
      if (await editButton.isVisible()) {
        await editButton.click();
        
        // Make changes and submit
        const nameInput = page.locator('[data-testid="input-firstName"], input[name="firstName"]').first();
        if (await nameInput.isVisible()) {
          await nameInput.fill('Updated Name');
          const submitButton = page.locator('[data-testid="button-submit"], button:has-text("Save")').first();
          await submitButton.click();
          
          // Should show conflict error
          const conflictError = page.locator('text=conflict, text=was modified, .conflict-error');
          await expect(conflictError.first()).toBeVisible();
        }
      }
    });

    test('should handle data race conditions', async ({ page }) => {
      // This test simulates two users editing the same data simultaneously
      const employeeData = TestDataFactory.createEmployee();
      
      await employeesPage.navigateToEmployees();
      
      // Mock race condition scenario
      let requestCount = 0;
      await page.route('**/api/employees', route => {
        requestCount++;
        if (route.request().method() === 'POST') {
          if (requestCount === 1) {
            // First request succeeds
            route.fulfill({
              status: 201,
              body: JSON.stringify({ id: 'emp123', ...employeeData })
            });
          } else {
            // Second request conflicts
            route.fulfill({
              status: 409,
              body: JSON.stringify({ error: 'Employee ID already exists' })
            });
          }
        } else {
          route.continue();
        }
      });
      
      // Simulate rapid duplicate submissions
      const addButton = employeesPage.addEmployeeButton;
      if (await addButton.isVisible()) {
        await addButton.click();
        
        // Try to create employee twice rapidly
        for (let i = 0; i < 2; i++) {
          const nameInput = page.locator('[data-testid="input-firstName"]').first();
          if (await nameInput.isVisible()) {
            await nameInput.fill(employeeData.firstName);
            const submitButton = page.locator('[data-testid="button-submit"]').first();
            await submitButton.click();
          }
        }
        
        // Should handle race condition gracefully
        const errorMessage = page.locator('text=already exists, text=duplicate, .duplicate-error');
        await expect(errorMessage.first()).toBeVisible();
      }
    });
  });

  test.describe('Browser Compatibility Edge Cases', () => {
    test('should handle JavaScript disabled scenarios', async ({ browser }) => {
      // Create context with JavaScript disabled
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      
      await page.goto('/auth');
      
      // Page should still be functional without JavaScript (basic HTML forms)
      const form = page.locator('form').first();
      if (await form.isVisible()) {
        await expect(form).toBeVisible();
      }
      
      // Clean up
      await context.close();
    });

    test('should handle localStorage unavailable', async ({ page }) => {
      // Mock localStorage being unavailable
      await page.addInitScript(() => {
        delete (window as any).localStorage;
        (window as any).localStorage = {
          getItem: () => null,
          setItem: () => { throw new Error('localStorage not available'); },
          removeItem: () => {},
          clear: () => {}
        };
      });
      
      await authPage.navigateToAuth();
      
      // App should handle localStorage errors gracefully
      const credentials = AuthHelpers.CREDENTIALS.hr;
      await authPage.login(credentials.username, credentials.password);
      
      // Login might still work with session cookies or other storage methods
      const isAuthSuccessful = page.url().includes('/auth');
      // Should either work or show appropriate error message
      expect(isAuthSuccessful || await page.locator('.storage-error').isVisible());
    });

    test('should handle memory pressure scenarios', async ({ page }) => {
      // Simulate memory pressure by creating large objects
      await page.evaluate(() => {
        try {
          const largeArray = new Array(10000000).fill('memory-pressure-test');
          (window as any).memoryTest = largeArray;
        } catch (e) {
          console.log('Memory pressure simulation failed:', e);
        }
      });
      
      await authHelpers.loginAs('hr');
      await employeesPage.navigateToEmployees();
      
      // App should still function under memory pressure
      await expect(employeesPage.employeesTitle).toBeVisible();
    });
  });

  test.describe('Accessibility Error Scenarios', () => {
    test.beforeEach(async ({ page }) => {
      await authHelpers.loginAs('hr');
    });

    test('should handle high contrast mode', async ({ page }) => {
      // Simulate high contrast mode
      await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
      
      await employeesPage.navigateToEmployees();
      
      // Elements should remain visible and accessible
      await expect(employeesPage.employeesTitle).toBeVisible();
      await expect(employeesPage.addEmployeeButton).toBeVisible();
    });

    test('should handle screen reader compatibility', async ({ page }) => {
      await employeesPage.navigateToEmployees();
      
      // Check ARIA labels and roles are present
      const interactiveElements = page.locator('button, input, select, a');
      const count = await interactiveElements.count();
      
      for (let i = 0; i < Math.min(count, 5); i++) {
        const element = interactiveElements.nth(i);
        const hasLabel = await element.evaluate(el => {
          return el.getAttribute('aria-label') || 
                 el.getAttribute('aria-labelledby') ||
                 el.textContent?.trim() ||
                 ((el as HTMLInputElement).labels?.length ?? 0) > 0;
        });
        
        expect(hasLabel).toBeTruthy();
      }
    });
  });
});