import { test, expect } from '@playwright/test';
import { AuthPage } from '../pages/auth.page';
import { AuthHelpers } from '../utils/auth-helpers';
import { TestDataFactory } from '../utils/test-data';
import { TestCleanup } from '../utils/test-cleanup';

/**
 * Authentication Flow Tests
 * @description Comprehensive tests for login, logout, registration, and session management
 */
test.describe('Authentication Flow', () => {
  let authPage: AuthPage;
  let authHelpers: AuthHelpers;
  let testCleanup: TestCleanup;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    authHelpers = new AuthHelpers(page);
    testCleanup = new TestCleanup(page);
    
    // Reset application state before each test
    await testCleanup.resetApplicationState();
  });

  test.afterEach(async ({ page }) => {
    // Clean up any test data created during the test
    await testCleanup.clearBrowserStorage();
  });

  test.describe('Login Functionality', () => {
    test('should successfully login with valid credentials', async ({ page }) => {
      // Test with admin credentials
      const credentials = AuthHelpers.CREDENTIALS.admin;
      
      await authPage.navigateToAuth();
      await authPage.login(credentials.username, credentials.password);
      
      // Verify successful login
      await authPage.validateLoginSuccess();
      await expect(page).toHaveURL('/');
      
      // Verify user is authenticated
      const isAuth = await authHelpers.isAuthenticated();
      expect(isAuth).toBe(true);
    });

    test('should fail login with invalid credentials', async ({ page }) => {
      await authPage.navigateToAuth();
      
      // Try to login with invalid credentials
      await authPage.login('invaliduser', 'wrongpassword');
      
      // Should remain on auth page and show error
      await expect(page).toHaveURL('/auth');
      await authPage.validateLoginError('Invalid username or password');
    });

    test('should require both username and password', async ({ page }) => {
      await authPage.navigateToAuth();
      
      // Try to submit empty form
      await authPage.loginSubmitButton.click();
      
      // Form should not submit (browser validation)
      await expect(authPage.loginUsernameInput).toHaveAttribute('required');
      await expect(authPage.loginPasswordInput).toHaveAttribute('required');
    });

    test('should show loading state during login', async ({ page }) => {
      const credentials = AuthHelpers.CREDENTIALS.admin;
      
      await authPage.navigateToAuth();
      await authPage.loginUsernameInput.fill(credentials.username);
      await authPage.loginPasswordInput.fill(credentials.password);
      
      // Check that button shows loading state when clicked
      await authPage.loginSubmitButton.click();
      await expect(authPage.loginSubmitButton).toContainText('Signing In...');
    });
  });

  test.describe('Registration Functionality', () => {
    test('should successfully register new user', async ({ page }) => {
      const userData = TestDataFactory.createUser('hr');
      
      await authPage.register(userData);
      
      // Should show success and redirect to dashboard
      await authPage.validateRegistrationSuccess();
      await authPage.validateLoginSuccess();
    });

    test('should validate password confirmation', async ({ page }) => {
      await authPage.testPasswordMismatch();
      
      // Submit button should be disabled when passwords don't match
      await expect(authPage.registerSubmitButton).toBeDisabled();
    });

    test('should show password mismatch error', async ({ page }) => {
      const userData = TestDataFactory.createUser('hr', {
        confirmPassword: 'differentpassword'
      });
      
      await authPage.register(userData);
      
      // Should show password mismatch error
      await authPage.validateRegistrationError('Passwords do not match');
    });

    test('should handle duplicate username registration', async ({ page }) => {
      const userData = TestDataFactory.createUser('hr');
      
      // Register user first time
      await authPage.register(userData);
      await authPage.validateRegistrationSuccess();
      
      // Logout and try to register again with same username
      await authHelpers.logout();
      await authPage.register(userData);
      
      // Should show error for duplicate username
      await authPage.validateRegistrationError('Username already exists');
    });

    test('should validate role selection for non-onboarding registration', async ({ page }) => {
      const userData = TestDataFactory.createUser('admin');
      
      await authPage.navigateToAuth();
      await authPage.registerTab.click();
      
      // Fill form data
      await authPage.registerUsernameInput.fill(userData.username);
      await authPage.registerPasswordInput.fill(userData.password);
      await authPage.registerConfirmPasswordInput.fill(userData.password);
      await authPage.registerRoleSelect.selectOption(userData.role);
      
      // Verify role was selected
      await expect(authPage.registerRoleSelect).toHaveValue(userData.role);
      
      await authPage.registerSubmitButton.click();
      await authPage.validateRegistrationSuccess();
    });
  });

  test.describe('Session Management', () => {
    test('should maintain session across page reloads', async ({ page }) => {
      await authHelpers.loginAs('admin');
      await authHelpers.testSessionPersistence();
    });

    test('should handle session timeout gracefully', async ({ page }) => {
      await authHelpers.loginAs('admin');
      await authHelpers.testSessionTimeout();
      
      // Should be redirected to login page
      await expect(page).toHaveURL('/auth');
    });

    test('should logout successfully', async ({ page }) => {
      await authHelpers.loginAs('admin');
      
      // Verify user is authenticated
      const wasAuth = await authHelpers.isAuthenticated();
      expect(wasAuth).toBe(true);
      
      // Logout
      await authHelpers.logout();
      
      // Should be redirected to auth page
      await expect(page).toHaveURL('/auth');
      
      // Should not be authenticated anymore
      const isAuth = await authHelpers.isAuthenticated();
      expect(isAuth).toBe(false);
    });
  });

  test.describe('Role-Based Access', () => {
    test('should login with admin role and validate permissions', async ({ page }) => {
      await authHelpers.loginAs('admin');
      await authHelpers.validateUserRole('admin');
      
      // Admin should have access to settings and all management features
      await page.goto('/settings');
      await expect(page.locator('[data-testid*="admin"], h1:has-text("Settings")')).toBeVisible();
    });

    test('should login with HR role and validate permissions', async ({ page }) => {
      await authHelpers.loginAs('hr');
      await authHelpers.validateUserRole('hr');
      
      // HR should have access to employee management
      await page.goto('/employees');
      await expect(page.locator('[data-testid="button-add-employee"]')).toBeVisible();
      await expect(page.locator('[data-testid="button-send-invitation"]')).toBeVisible();
    });

    test('should login with viewer role and validate limited permissions', async ({ page }) => {
      await authHelpers.loginAs('viewer');
      await authHelpers.validateUserRole('viewer');
      
      // Viewer should have read-only access
      await page.goto('/employees');
      await expect(page.locator('[data-testid="text-employees-title"]')).toBeVisible();
      
      // Should not see add/edit buttons
      const addButton = page.locator('[data-testid="button-add-employee"]');
      if (await addButton.isVisible()) {
        await expect(addButton).toBeDisabled();
      }
    });

    test('should switch between different user roles', async ({ page }) => {
      // Start as admin
      await authHelpers.loginAs('admin');
      await authHelpers.validateUserRole('admin');
      
      // Switch to HR role
      await authHelpers.switchToRole('hr');
      await authHelpers.validateUserRole('hr');
      
      // Switch to viewer role
      await authHelpers.switchToRole('viewer');
      await authHelpers.validateUserRole('viewer');
    });
  });

  test.describe('Onboarding Flow', () => {
    test('should handle employee onboarding with invitation token', async ({ page }) => {
      const invitationToken = 'test-token-123';
      const userData = TestDataFactory.createUser('viewer');
      
      await authPage.registerWithInvitationToken(invitationToken, userData);
      
      // Should show onboarding success message
      await expect(page.locator('text=Welcome! Create your account')).toBeVisible();
      
      // After registration, should show onboarding completion
      await authPage.validateRegistrationSuccess();
    });

    test('should show onboarding form instructions', async ({ page }) => {
      const invitationToken = 'test-token-456';
      
      await page.goto(`/auth?token=${invitationToken}`);
      await authPage.registerTab.click();
      
      // Should show onboarding-specific messaging
      await expect(page.locator('text=Welcome! Create your account to begin the onboarding process')).toBeVisible();
      await expect(page.locator('text=Required forms will be sent to your email')).toBeVisible();
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect unauthenticated users to login', async ({ page }) => {
      // Try to access protected route without authentication
      await page.goto('/employees');
      
      // Should be redirected to auth page
      await expect(page).toHaveURL('/auth');
    });

    test('should allow access to protected routes when authenticated', async ({ page }) => {
      await authHelpers.loginAs('admin');
      
      // Should be able to access protected routes
      await page.goto('/employees');
      await expect(page).toHaveURL('/employees');
      await expect(page.locator('[data-testid="text-employees-title"]')).toBeVisible();
    });

    test('should handle direct navigation to protected routes', async ({ page }) => {
      await authHelpers.loginAs('hr');
      
      // Direct navigation should work
      await page.goto('/settings');
      await expect(page).toHaveURL('/settings');
      
      await page.goto('/documents');
      await expect(page).toHaveURL('/documents');
      
      await page.goto('/reports');
      await expect(page).toHaveURL('/reports');
    });
  });

  test.describe('Form Validation and UX', () => {
    test('should show proper form validation messages', async ({ page }) => {
      await authPage.navigateToAuth();
      
      // Test login form validation
      await authPage.loginUsernameInput.fill('');
      await authPage.loginPasswordInput.fill('');
      await authPage.loginSubmitButton.click();
      
      // Browser validation should prevent submission
      await expect(authPage.loginUsernameInput).toBeInvalid();
      await expect(authPage.loginPasswordInput).toBeInvalid();
    });

    test('should handle keyboard navigation', async ({ page }) => {
      await authPage.navigateToAuth();
      
      // Tab through form elements
      await authPage.loginUsernameInput.focus();
      await expect(authPage.loginUsernameInput).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(authPage.loginPasswordInput).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(authPage.loginSubmitButton).toBeFocused();
    });

    test('should toggle between login and register tabs', async ({ page }) => {
      await authPage.navigateToAuth();
      
      // Should start on login tab by default
      await expect(authPage.loginForm).toBeVisible();
      
      // Switch to register tab
      await authPage.registerTab.click();
      await expect(authPage.registerForm).toBeVisible();
      await expect(authPage.loginForm).toBeHidden();
      
      // Switch back to login tab
      await authPage.loginTab.click();
      await expect(authPage.loginForm).toBeVisible();
      await expect(authPage.registerForm).toBeHidden();
    });
  });
});