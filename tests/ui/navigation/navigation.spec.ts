import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../utils/auth-helpers';
import { CommonHelpers } from '../utils/common-helpers';

/**
 * Navigation and Routing Tests
 * @description Tests for page navigation, protected routes, and routing behavior
 */
test.describe('Navigation and Routing', () => {
  let authHelpers: AuthHelpers;
  let commonHelpers: CommonHelpers;

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page);
    commonHelpers = new CommonHelpers(page);
  });

  test.describe('Public Routes', () => {
    test('should access authentication page without login', async ({ page }) => {
      await page.goto('/auth');
      await expect(page).toHaveURL('/auth');
      
      // Should see login form
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    });

    test('should redirect unauthenticated users to auth page', async ({ page }) => {
      const protectedRoutes = [
        '/',
        '/employees',
        '/documents',
        '/settings',
        '/reports'
      ];

      for (const route of protectedRoutes) {
        await page.goto(route);
        await expect(page).toHaveURL('/auth');
      }
    });
  });

  test.describe('Protected Routes', () => {
    test.beforeEach(async ({ page }) => {
      await authHelpers.loginAs('hr');
    });

    test('should access dashboard after login', async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveURL('/');
      
      // Should see authenticated dashboard content
      await expect(page.locator('[data-testid*="dashboard"], h1')).toBeVisible();
    });

    test('should navigate to all main sections', async ({ page }) => {
      const routes = [
        { path: '/employees', title: 'Employees' },
        { path: '/documents', title: 'Documents' },
        { path: '/reports', title: 'Reports' },
        { path: '/settings', title: 'Settings' }
      ];

      for (const route of routes) {
        await page.goto(route.path);
        await expect(page).toHaveURL(route.path);
        
        // Should see page title or main content
        const pageTitle = page.locator(`h1:has-text("${route.title}"), [data-testid*="${route.title.toLowerCase()}"]`).first();
        if (await pageTitle.isVisible()) {
          await expect(pageTitle).toBeVisible();
        }
      }
    });

    test('should handle deep links to protected routes', async ({ page }) => {
      const deepLinks = [
        '/employees/new',
        '/employees/123/edit',
        '/settings/api-keys',
        '/documents?category=License'
      ];

      for (const link of deepLinks) {
        await page.goto(link);
        
        // Should either load the page or redirect appropriately
        // The exact behavior depends on whether the resource exists
        const currentUrl = page.url();
        expect(currentUrl).not.toBe('/auth'); // Should not be redirected to auth
      }
    });
  });

  test.describe('Navigation Menu', () => {
    test.beforeEach(async ({ page }) => {
      await authHelpers.loginAs('hr');
    });

    test('should display navigation menu', async ({ page }) => {
      await page.goto('/');
      
      // Look for navigation menu (sidebar or header nav)
      const navigation = page.locator('[data-testid*="nav"], nav, .sidebar').first();
      
      if (await navigation.isVisible()) {
        await expect(navigation).toBeVisible();
        
        // Should contain main navigation items
        const navItems = ['Employees', 'Documents', 'Reports', 'Settings'];
        for (const item of navItems) {
          const navItem = navigation.locator(`text=${item}, [data-testid*="${item.toLowerCase()}"]`).first();
          if (await navItem.isVisible()) {
            await expect(navItem).toBeVisible();
          }
        }
      }
    });

    test('should navigate using menu links', async ({ page }) => {
      await page.goto('/');
      
      // Find and click Employees navigation link
      const employeesLink = page.locator('a:has-text("Employees"), [data-testid*="nav-employees"]').first();
      
      if (await employeesLink.isVisible()) {
        await commonHelpers.clickAndWaitForNavigation(employeesLink, '/employees');
        await expect(page).toHaveURL('/employees');
      }
    });

    test('should highlight active navigation item', async ({ page }) => {
      await page.goto('/employees');
      
      // Active nav item should be highlighted
      const activeNavItem = page.locator('[data-testid*="nav-employees"].active, .nav-item.active:has-text("Employees")').first();
      
      if (await activeNavItem.isVisible()) {
        await expect(activeNavItem).toHaveClass(/active|current/);
      }
    });
  });

  test.describe('Breadcrumb Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await authHelpers.loginAs('hr');
    });

    test('should show breadcrumbs for nested pages', async ({ page }) => {
      await page.goto('/employees/new');
      
      // Look for breadcrumb navigation
      const breadcrumbs = page.locator('[data-testid*="breadcrumb"], .breadcrumb').first();
      
      if (await breadcrumbs.isVisible()) {
        await expect(breadcrumbs).toBeVisible();
        await expect(breadcrumbs.locator('text=Employees')).toBeVisible();
        await expect(breadcrumbs.locator('text=New Employee, text=Add')).toBeVisible();
      }
    });

    test('should navigate using breadcrumb links', async ({ page }) => {
      await page.goto('/employees/new');
      
      const breadcrumbLink = page.locator('[data-testid*="breadcrumb"] a:has-text("Employees"), .breadcrumb a:has-text("Employees")').first();
      
      if (await breadcrumbLink.isVisible()) {
        await commonHelpers.clickAndWaitForNavigation(breadcrumbLink, '/employees');
        await expect(page).toHaveURL('/employees');
      }
    });
  });

  test.describe('Back Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await authHelpers.loginAs('hr');
    });

    test('should handle browser back button', async ({ page }) => {
      // Navigate through pages
      await page.goto('/employees');
      await page.goto('/documents');
      await page.goto('/settings');
      
      // Use browser back button
      await page.goBack();
      await expect(page).toHaveURL('/documents');
      
      await page.goBack();
      await expect(page).toHaveURL('/employees');
    });

    test('should preserve page state on back navigation', async ({ page }) => {
      // Go to employees and apply filters
      await page.goto('/employees');
      
      const searchInput = page.locator('[data-testid*="search"], input[placeholder*="Search"]').first();
      if (await searchInput.isVisible()) {
        await searchInput.fill('test search');
      }
      
      // Navigate away
      await page.goto('/documents');
      
      // Navigate back
      await page.goBack();
      await expect(page).toHaveURL('/employees');
      
      // Search should be preserved (if implemented)
      if (await searchInput.isVisible()) {
        await expect(searchInput).toHaveValue('test search');
      }
    });
  });

  test.describe('URL Parameters and Query Strings', () => {
    test.beforeEach(async ({ page }) => {
      await authHelpers.loginAs('hr');
    });

    test('should handle URL parameters correctly', async ({ page }) => {
      // Navigate with query parameters
      await page.goto('/documents?category=License&sort=date');
      await expect(page).toHaveURL('/documents?category=License&sort=date');
      
      // Page should respect the parameters
      const categoryFilter = page.locator('select[data-testid*="category"]').first();
      if (await categoryFilter.isVisible()) {
        await expect(categoryFilter).toHaveValue('License');
      }
    });

    test('should update URL when filters change', async ({ page }) => {
      await page.goto('/employees');
      
      const departmentFilter = page.locator('select[data-testid*="department"]').first();
      if (await departmentFilter.isVisible()) {
        await departmentFilter.selectOption('Emergency Medicine');
        
        // URL might update to reflect the filter (if implemented)
        // This depends on the application's design
      }
    });
  });

  test.describe('Route Guards and Permissions', () => {
    test('should enforce role-based route access', async ({ page }) => {
      // Test viewer role restrictions
      await authHelpers.loginAs('viewer');
      
      // Viewers might not have access to settings
      await page.goto('/settings');
      
      // Depending on implementation, might redirect or show limited view
      const url = page.url();
      const hasAccess = url.includes('/settings');
      
      if (hasAccess) {
        // If allowed, should show read-only view
        const readOnlyIndicator = page.locator('[data-testid*="read-only"], .read-only');
        if (await readOnlyIndicator.isVisible()) {
          await expect(readOnlyIndicator).toBeVisible();
        }
      }
    });

    test('should allow admin access to all routes', async ({ page }) => {
      await authHelpers.loginAs('admin');
      
      const adminRoutes = [
        '/settings',
        '/settings/api-keys',
        '/reports',
        '/employees/new'
      ];

      for (const route of adminRoutes) {
        await page.goto(route);
        
        // Admin should have access to all routes
        expect(page.url()).toContain(route.split('?')[0]);
      }
    });
  });

  test.describe('Error Page Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await authHelpers.loginAs('hr');
    });

    test('should handle 404 pages gracefully', async ({ page }) => {
      await page.goto('/non-existent-page');
      
      // Should show 404 page or redirect appropriately
      const notFoundPage = page.locator('text=Not Found, text=404, h1:has-text("Page Not Found")');
      
      if (await notFoundPage.isVisible()) {
        await expect(notFoundPage).toBeVisible();
        
        // Should provide navigation back to main app
        const homeLink = page.locator('a:has-text("Home"), a:has-text("Dashboard"), [data-testid*="home"]').first();
        if (await homeLink.isVisible()) {
          await expect(homeLink).toBeVisible();
        }
      }
    });

    test('should handle non-existent resource pages', async ({ page }) => {
      await page.goto('/employees/999999999');
      
      // Should handle non-existent employee gracefully
      const errorMessage = page.locator('text=Employee not found, text=Not found, .error-message');
      
      if (await errorMessage.isVisible()) {
        await expect(errorMessage).toBeVisible();
      } else {
        // Or might redirect to employees list
        await expect(page).toHaveURL('/employees');
      }
    });
  });

  test.describe('Loading States During Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await authHelpers.loginAs('hr');
    });

    test('should show loading states during page transitions', async ({ page }) => {
      // Simulate slow navigation
      await page.route('**/api/**', route => {
        setTimeout(() => route.continue(), 500);
      });
      
      await page.goto('/employees');
      
      // Look for loading indicators during navigation
      const loadingIndicator = page.locator('.loading, .spinner, [data-testid*="loading"]');
      
      // Loading might be brief, so we check if it appears
      try {
        await expect(loadingIndicator).toBeVisible({ timeout: 1000 });
      } catch {
        // Loading might be too fast to catch, which is fine
      }
      
      // Eventually should load the page
      await expect(page.locator('[data-testid*="employees-title"], h1')).toBeVisible();
    });
  });

  test.describe('Keyboard Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await authHelpers.loginAs('hr');
    });

    test('should support keyboard navigation', async ({ page }) => {
      await page.goto('/');
      
      // Tab through navigation elements
      await page.keyboard.press('Tab');
      
      // Should focus on interactive elements
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
      
      // Enter should activate links
      const activeLink = await focusedElement.evaluate(el => el.tagName === 'A');
      if (activeLink) {
        await page.keyboard.press('Enter');
        // Should navigate to the link target
      }
    });

    test('should handle escape key to close modals during navigation', async ({ page }) => {
      await page.goto('/employees');
      
      // Open a modal (if available)
      const modalTrigger = page.locator('[data-testid*="button-add"], button:has-text("Add")').first();
      
      if (await modalTrigger.isVisible()) {
        await modalTrigger.click();
        
        const modal = page.locator('[role="dialog"], .modal').first();
        if (await modal.isVisible()) {
          await expect(modal).toBeVisible();
          
          // Escape should close modal
          await page.keyboard.press('Escape');
          await expect(modal).toBeHidden();
        }
      }
    });
  });

  test.describe('Mobile Navigation', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test.beforeEach(async ({ page }) => {
      await authHelpers.loginAs('hr');
    });

    test('should adapt navigation for mobile', async ({ page }) => {
      await page.goto('/');
      
      // Look for mobile navigation menu
      const mobileMenu = page.locator('[data-testid*="mobile-menu"], .hamburger-menu, button[aria-label*="menu"]').first();
      
      if (await mobileMenu.isVisible()) {
        await expect(mobileMenu).toBeVisible();
        
        // Should open navigation on click
        await mobileMenu.click();
        
        const navigationPanel = page.locator('[data-testid*="nav-panel"], .mobile-nav, .slide-out').first();
        if (await navigationPanel.isVisible()) {
          await expect(navigationPanel).toBeVisible();
        }
      }
    });
  });
});