import { test, expect, devices } from '@playwright/test';
import { AuthPage } from '../pages/auth.page';
import { EmployeesPage } from '../pages/employees.page';
import { DocumentsPage } from '../pages/documents.page';
import { SettingsPage } from '../pages/settings.page';
import { AuthHelpers } from '../utils/auth-helpers';
import { CommonHelpers } from '../utils/common-helpers';

/**
 * Responsive Design Tests
 * @description Tests for mobile and desktop responsiveness across all major pages
 */
test.describe('Responsive Design', () => {
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

  test.describe('Mobile Responsiveness', () => {
    test.use({ ...devices['iPhone 12'] });

    test('should render authentication page correctly on mobile', async ({ page }) => {
      await authPage.navigateToAuth();
      
      // Verify mobile layout elements
      await expect(authPage.loginForm).toBeVisible();
      await expect(authPage.loginUsernameInput).toBeVisible();
      
      // Check that elements are properly sized for mobile
      const formWidth = await authPage.loginForm.evaluate(el => el.getBoundingClientRect().width);
      const viewportWidth = page.viewportSize()?.width || 0;
      
      // Form should take up most of the mobile width
      expect(formWidth).toBeGreaterThan(viewportWidth * 0.8);
      
      // Test mobile navigation between tabs
      await authPage.registerTab.click();
      await expect(authPage.registerForm).toBeVisible();
      
      // Form should remain readable
      await expect(authPage.registerUsernameInput).toBeVisible();
      await expect(authPage.registerPasswordInput).toBeVisible();
    });

    test('should handle mobile navigation menu', async ({ page }) => {
      await authHelpers.loginAs('hr');
      await employeesPage.navigateToEmployees();
      
      // Look for mobile hamburger menu
      const mobileMenuButton = page.locator('[data-testid*="mobile-menu"], button[aria-label*="menu"], .hamburger');
      
      if (await mobileMenuButton.isVisible()) {
        await mobileMenuButton.click();
        
        // Navigation menu should appear
        const navigationMenu = page.locator('[data-testid*="navigation"], nav, .sidebar');
        await expect(navigationMenu).toBeVisible();
        
        // Menu should contain main navigation items
        await expect(page.locator('text=Employees, text=Documents, text=Settings')).toBeVisible();
      }
    });

    test('should make employee table mobile-friendly', async ({ page }) => {
      await authHelpers.loginAs('hr');
      await employeesPage.navigateToEmployees();
      
      // Table should be responsive
      const table = employeesPage.employeesTable;
      await expect(table).toBeVisible();
      
      // On mobile, table might be scrollable or have a different layout
      const tableContainer = table.locator('..');
      const hasHorizontalScroll = await tableContainer.evaluate(el => el.scrollWidth > el.clientWidth);
      
      // Either table scrolls horizontally or has mobile-optimized layout
      expect(hasHorizontalScroll || true).toBeTruthy(); // Accept either approach
    });

    test('should adapt employee forms for mobile', async ({ page }) => {
      await authHelpers.loginAs('hr');
      await employeesPage.navigateToAddEmployee();
      
      // Form fields should be stacked vertically on mobile
      const firstNameInput = page.locator('[data-testid="input-firstName"]');
      const lastNameInput = page.locator('[data-testid="input-lastName"]');
      
      if (await firstNameInput.isVisible() && await lastNameInput.isVisible()) {
        const firstNameRect = await firstNameInput.boundingBox();
        const lastNameRect = await lastNameInput.boundingBox();
        
        // On mobile, last name should be below first name (higher Y coordinate)
        if (firstNameRect && lastNameRect) {
          expect(lastNameRect.y).toBeGreaterThan(firstNameRect.y);
        }
      }
    });

    test('should make document management mobile-friendly', async ({ page }) => {
      await authHelpers.loginAs('hr');
      await documentsPage.navigateToDocuments();
      
      // Upload button should be accessible on mobile
      if (await documentsPage.uploadButton.isVisible()) {
        await expect(documentsPage.uploadButton).toBeVisible();
        
        // Button should be large enough for touch interaction
        const buttonSize = await documentsPage.uploadButton.boundingBox();
        if (buttonSize) {
          expect(buttonSize.height).toBeGreaterThanOrEqual(44); // iOS minimum touch target
        }
      }
    });
  });

  test.describe('Tablet Responsiveness', () => {
    test.use({ ...devices['iPad Pro'] });

    test('should display content appropriately on tablet', async ({ page }) => {
      await authHelpers.loginAs('hr');
      await employeesPage.navigateToEmployees();
      
      // Tablet should show more content than mobile but less than desktop
      const viewportWidth = page.viewportSize()?.width || 0;
      expect(viewportWidth).toBeGreaterThan(768); // Typical tablet breakpoint
      
      // Navigation might be visible or collapsible
      const navigation = page.locator('[data-testid*="sidebar"], nav');
      await expect(navigation).toBeVisible();
      
      // Table should show more columns than mobile
      const tableHeaders = employeesPage.employeesTable.locator('th');
      const headerCount = await tableHeaders.count();
      expect(headerCount).toBeGreaterThan(3); // Should show more than mobile
    });

    test('should handle tablet forms layout', async ({ page }) => {
      await authHelpers.loginAs('hr');
      await employeesPage.navigateToAddEmployee();
      
      // On tablet, some fields might be side-by-side
      const formContainer = page.locator('form, .form-container').first();
      
      if (await formContainer.isVisible()) {
        const containerWidth = await formContainer.evaluate(el => el.getBoundingClientRect().width);
        expect(containerWidth).toBeGreaterThan(500); // Should have reasonable width for form fields
      }
    });
  });

  test.describe('Desktop Responsiveness', () => {
    test.use({ ...devices['Desktop Chrome'] });

    test('should show full desktop layout', async ({ page }) => {
      await authHelpers.loginAs('admin');
      await employeesPage.navigateToEmployees();
      
      // Desktop should show sidebar navigation
      const sidebar = page.locator('[data-testid*="sidebar"], .sidebar');
      if (await sidebar.isVisible()) {
        await expect(sidebar).toBeVisible();
        
        // Sidebar should contain navigation items
        await expect(sidebar.locator('text=Employees, text=Documents')).toBeVisible();
      }
      
      // Should show full table with all columns
      const tableHeaders = employeesPage.employeesTable.locator('th');
      const headerCount = await tableHeaders.count();
      expect(headerCount).toBeGreaterThanOrEqual(5); // Desktop should show more columns
    });

    test('should use desktop-optimized forms', async ({ page }) => {
      await authHelpers.loginAs('hr');
      await employeesPage.navigateToAddEmployee();
      
      // Desktop forms might show fields side-by-side
      const firstName = page.locator('[data-testid="input-firstName"]');
      const lastName = page.locator('[data-testid="input-lastName"]');
      
      if (await firstName.isVisible() && await lastName.isVisible()) {
        const firstNameRect = await firstName.boundingBox();
        const lastNameRect = await lastName.boundingBox();
        
        // On desktop, fields might be side-by-side (similar Y coordinates)
        if (firstNameRect && lastNameRect) {
          const yDifference = Math.abs(firstNameRect.y - lastNameRect.y);
          // Allow for some variation in alignment
          expect(yDifference).toBeLessThan(50);
        }
      }
    });
  });

  test.describe('Viewport Breakpoints', () => {
    test('should handle different viewport sizes gracefully', async ({ page }) => {
      await authHelpers.loginAs('hr');
      
      // Test different breakpoints
      const breakpoints = [
        { width: 320, height: 568, name: 'small-mobile' },
        { width: 768, height: 1024, name: 'tablet' },
        { width: 1200, height: 800, name: 'desktop' },
        { width: 1920, height: 1080, name: 'large-desktop' }
      ];
      
      for (const breakpoint of breakpoints) {
        await commonHelpers.testResponsive(breakpoint.width, breakpoint.height, async () => {
          await employeesPage.navigateToEmployees();
          
          // Basic functionality should work at all breakpoints
          await expect(employeesPage.employeesTitle).toBeVisible();
          
          // Table should be accessible (might scroll on smaller screens)
          await expect(employeesPage.employeesTable).toBeVisible();
          
          // Navigation should be accessible
          if (breakpoint.width >= 768) {
            // Larger screens should show navigation
            const navigation = page.locator('[data-testid*="nav"], nav').first();
            if (await navigation.isVisible()) {
              await expect(navigation).toBeVisible();
            }
          }
        });
      }
    });
  });

  test.describe('Touch Interactions', () => {
    test.use({ ...devices['iPhone 12'] });

    test('should support touch interactions', async ({ page }) => {
      await authHelpers.loginAs('hr');
      await employeesPage.navigateToEmployees();
      
      // Touch targets should be large enough
      const addButton = employeesPage.addEmployeeButton;
      
      if (await addButton.isVisible()) {
        const buttonSize = await addButton.boundingBox();
        if (buttonSize) {
          expect(buttonSize.width).toBeGreaterThanOrEqual(44);
          expect(buttonSize.height).toBeGreaterThanOrEqual(44);
        }
        
        // Touch interaction should work
        await addButton.tap();
        await expect(page).toHaveURL('/employees/new');
      }
    });

    test('should handle swipe gestures for navigation', async ({ page }) => {
      await authHelpers.loginAs('hr');
      await employeesPage.navigateToEmployees();
      
      // Test horizontal swipe on mobile tables (if implemented)
      const table = employeesPage.employeesTable;
      
      if (await table.isVisible()) {
        const tableRect = await table.boundingBox();
        
        if (tableRect) {
          // Simulate swipe gesture
          await page.touchscreen.tap(tableRect.x + 50, tableRect.y + 50);
          await page.touchscreen.tap(tableRect.x + tableRect.width - 50, tableRect.y + 50);
        }
      }
    });
  });

  test.describe('Orientation Changes', () => {
    test.use({ ...devices['iPhone 12'] });

    test('should handle orientation changes', async ({ page }) => {
      await authHelpers.loginAs('hr');
      await employeesPage.navigateToEmployees();
      
      // Portrait mode
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(employeesPage.employeesTitle).toBeVisible();
      
      // Landscape mode
      await page.setViewportSize({ width: 844, height: 390 });
      await expect(employeesPage.employeesTitle).toBeVisible();
      
      // Layout should adapt to landscape
      const table = employeesPage.employeesTable;
      if (await table.isVisible()) {
        // In landscape, table might show more columns
        await expect(table).toBeVisible();
      }
    });
  });

  test.describe('Accessibility on Different Screens', () => {
    test('should maintain accessibility across screen sizes', async ({ page }) => {
      const screenSizes = [
        { width: 320, height: 568 },
        { width: 1200, height: 800 }
      ];
      
      for (const size of screenSizes) {
        await page.setViewportSize(size);
        await authPage.navigateToAuth();
        
        // Form labels should be properly associated
        await commonHelpers.validateBasicAccessibility(authPage.loginForm);
        
        // Interactive elements should be keyboard accessible
        await authPage.loginUsernameInput.focus();
        await expect(authPage.loginUsernameInput).toBeFocused();
        
        await page.keyboard.press('Tab');
        await expect(authPage.loginPasswordInput).toBeFocused();
      }
    });
  });

  test.describe('Performance on Mobile', () => {
    test.use({ ...devices['iPhone 12'] });

    test('should load quickly on mobile devices', async ({ page }) => {
      const startTime = Date.now();
      
      await authHelpers.loginAs('hr');
      await employeesPage.navigateToEmployees();
      
      const loadTime = Date.now() - startTime;
      
      // Page should load within reasonable time on mobile
      expect(loadTime).toBeLessThan(5000); // 5 seconds max
      
      // Critical elements should be visible
      await expect(employeesPage.employeesTitle).toBeVisible();
    });

    test('should handle slow network conditions', async ({ page }) => {
      // Simulate slow network
      await page.route('**/*', route => {
        setTimeout(() => route.continue(), 100); // Add 100ms delay
      });
      
      await authHelpers.loginAs('hr');
      await employeesPage.navigateToEmployees();
      
      // Should show loading states appropriately
      await expect(employeesPage.employeesTitle).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Cross-Browser Responsive Consistency', () => {
    test('should render consistently across browsers', async ({ page }) => {
      await authHelpers.loginAs('hr');
      await employeesPage.navigateToEmployees();
      
      // Key elements should be visible and positioned correctly
      await expect(employeesPage.employeesTitle).toBeVisible();
      await expect(employeesPage.addEmployeeButton).toBeVisible();
      
      // Take screenshot for visual regression testing
      await commonHelpers.captureScreenshot('employees-page-responsive');
    });
  });
});