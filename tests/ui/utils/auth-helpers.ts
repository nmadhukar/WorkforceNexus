import { Page } from '@playwright/test';
import { AuthPage } from '../pages/auth.page';

/**
 * Authentication helper utilities for UI tests
 * @description Provides methods for managing user authentication across different roles
 */
export class AuthHelpers {
  private page: Page;
  private authPage: AuthPage;

  constructor(page: Page) {
    this.page = page;
    this.authPage = new AuthPage(page);
  }

  /**
   * Test user credentials for different roles
   */
  static readonly CREDENTIALS = {
    admin: { username: 'testadmin', password: 'admin123' },
    hr: { username: 'testhr', password: 'hr123' },
    viewer: { username: 'testviewer', password: 'viewer123' }
  } as const;

  /**
   * Login as a specific role
   * @param role - User role to login as
   */
  async loginAs(role: 'admin' | 'hr' | 'viewer'): Promise<void> {
    const credentials = AuthHelpers.CREDENTIALS[role];
    await this.authPage.login(credentials.username, credentials.password);
  }

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    // Navigate to dashboard first to ensure we're on an authenticated page
    await this.page.goto('/');
    
    // Look for logout button in header/sidebar
    const logoutButton = this.page.locator('[data-testid*="logout"], button:has-text("Logout"), button:has-text("Sign Out")').first();
    
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
    } else {
      // If no logout button found, clear session manually
      await this.page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await this.page.goto('/auth');
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      await this.page.goto('/');
      // If we get redirected to /auth, user is not authenticated
      await this.page.waitForURL(/\/(auth)?$/, { timeout: 3000 });
      return !this.page.url().includes('/auth');
    } catch {
      return false;
    }
  }

  /**
   * Create a test user for authentication
   * @param userData - User data for registration
   */
  async createTestUser(userData: {
    username: string;
    password: string;
    role: 'admin' | 'hr' | 'viewer';
  }): Promise<void> {
    await this.authPage.register(userData);
  }

  /**
   * Setup authentication state for persistent login
   * @param role - User role to setup authentication for
   */
  async setupAuthState(role: 'admin' | 'hr' | 'viewer'): Promise<void> {
    const credentials = AuthHelpers.CREDENTIALS[role];
    
    try {
      // First try to create the user (in case it doesn't exist)
      await this.createTestUser({
        username: credentials.username,
        password: credentials.password,
        role
      });
    } catch {
      // User might already exist, continue with login
    }

    // Login with the credentials
    await this.loginAs(role);
    
    // Verify login was successful
    const isAuth = await this.isAuthenticated();
    if (!isAuth) {
      throw new Error(`Failed to setup authentication state for role: ${role}`);
    }
  }

  /**
   * Clear all authentication data
   */
  async clearAuthData(): Promise<void> {
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      // Clear cookies
      document.cookie.split(";").forEach((c) => {
        const eqPos = c.indexOf("=");
        const name = eqPos > -1 ? c.substr(0, eqPos) : c;
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
      });
    });
  }

  /**
   * Validate user role permissions
   * @param expectedRole - Expected user role
   */
  async validateUserRole(expectedRole: 'admin' | 'hr' | 'viewer'): Promise<void> {
    // Navigate to a page that shows user info
    await this.page.goto('/');
    
    // Check role-specific elements
    switch (expectedRole) {
      case 'admin':
        // Admin should see all management options
        await this.page.locator('[data-testid*="admin"], [data-testid*="settings"]').first().waitFor({ state: 'visible' });
        break;
      case 'hr':
        // HR should see employee management but limited settings
        await this.page.locator('[data-testid*="employee"], [data-testid*="invitation"]').first().waitFor({ state: 'visible' });
        break;
      case 'viewer':
        // Viewer should have read-only access
        const addButton = this.page.locator('[data-testid*="add"], [data-testid*="create"]').first();
        if (await addButton.isVisible()) {
          throw new Error('Viewer should not have add/create permissions');
        }
        break;
    }
  }

  /**
   * Switch to a different user role during the same test
   * @param newRole - New role to switch to
   */
  async switchToRole(newRole: 'admin' | 'hr' | 'viewer'): Promise<void> {
    await this.logout();
    await this.loginAs(newRole);
    await this.validateUserRole(newRole);
  }

  /**
   * Test session persistence across page reloads
   */
  async testSessionPersistence(): Promise<void> {
    // Verify user is logged in
    const wasAuth = await this.isAuthenticated();
    if (!wasAuth) {
      throw new Error('User must be authenticated before testing session persistence');
    }

    // Reload the page
    await this.page.reload();
    await this.page.waitForLoadState('networkidle');

    // Verify still authenticated
    const stillAuth = await this.isAuthenticated();
    if (!stillAuth) {
      throw new Error('Session was not persisted after page reload');
    }
  }

  /**
   * Test session timeout behavior
   */
  async testSessionTimeout(): Promise<void> {
    // This would require modifying session timeout settings
    // or waiting for actual timeout (not practical in tests)
    // Instead, we can simulate it by clearing specific auth tokens
    await this.page.evaluate(() => {
      // Clear specific auth tokens while keeping other storage
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
    });

    // Navigate to a protected route
    await this.page.goto('/employees');
    
    // Should be redirected to login
    await this.page.waitForURL('/auth', { timeout: 5000 });
  }
}