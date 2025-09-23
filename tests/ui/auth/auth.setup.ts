import { test as setup, expect } from '@playwright/test';
import { AuthHelpers } from '../utils/auth-helpers';

/**
 * Authentication setup for Playwright tests
 * @description Creates authenticated sessions for different user roles
 * Sets up auth state files that can be reused across tests
 */

const ADMIN_AUTH_FILE = 'tests/ui/auth/.auth/admin.json';
const HR_AUTH_FILE = 'tests/ui/auth/.auth/hr.json';
const VIEWER_AUTH_FILE = 'tests/ui/auth/.auth/viewer.json';

/**
 * Setup authentication for admin user
 */
setup('authenticate as admin', async ({ page }) => {
  const authHelpers = new AuthHelpers(page);
  
  try {
    // Try to create admin user first (in case it doesn't exist)
    await authHelpers.createTestUser({
      username: AuthHelpers.CREDENTIALS.admin.username,
      password: AuthHelpers.CREDENTIALS.admin.password,
      role: 'admin'
    });
  } catch (error) {
    // User might already exist, continue with login
    console.log('Admin user might already exist, continuing with login');
  }
  
  // Login as admin
  await authHelpers.loginAs('admin');
  
  // Verify login was successful
  const isAuth = await authHelpers.isAuthenticated();
  expect(isAuth).toBe(true);
  
  // Validate admin permissions
  await authHelpers.validateUserRole('admin');
  
  // Save authentication state
  await page.context().storageState({ path: ADMIN_AUTH_FILE });
});

/**
 * Setup authentication for HR user
 */
setup('authenticate as hr', async ({ page }) => {
  const authHelpers = new AuthHelpers(page);
  
  try {
    // Try to create HR user first (in case it doesn't exist)
    await authHelpers.createTestUser({
      username: AuthHelpers.CREDENTIALS.hr.username,
      password: AuthHelpers.CREDENTIALS.hr.password,
      role: 'hr'
    });
  } catch (error) {
    // User might already exist, continue with login
    console.log('HR user might already exist, continuing with login');
  }
  
  // Login as HR
  await authHelpers.loginAs('hr');
  
  // Verify login was successful
  const isAuth = await authHelpers.isAuthenticated();
  expect(isAuth).toBe(true);
  
  // Validate HR permissions
  await authHelpers.validateUserRole('hr');
  
  // Save authentication state
  await page.context().storageState({ path: HR_AUTH_FILE });
});

/**
 * Setup authentication for viewer user
 */
setup('authenticate as viewer', async ({ page }) => {
  const authHelpers = new AuthHelpers(page);
  
  try {
    // Try to create viewer user first (in case it doesn't exist)
    await authHelpers.createTestUser({
      username: AuthHelpers.CREDENTIALS.viewer.username,
      password: AuthHelpers.CREDENTIALS.viewer.password,
      role: 'viewer'
    });
  } catch (error) {
    // User might already exist, continue with login
    console.log('Viewer user might already exist, continuing with login');
  }
  
  // Login as viewer
  await authHelpers.loginAs('viewer');
  
  // Verify login was successful
  const isAuth = await authHelpers.isAuthenticated();
  expect(isAuth).toBe(true);
  
  // Validate viewer permissions
  await authHelpers.validateUserRole('viewer');
  
  // Save authentication state
  await page.context().storageState({ path: VIEWER_AUTH_FILE });
});