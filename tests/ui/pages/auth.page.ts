import { Page, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Authentication Page Object Model for login and registration functionality
 * @description Handles all authentication-related interactions and validations
 */
export class AuthPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // Locators
  get loginForm() { return this.page.locator('[data-testid="login-form"]'); }
  get registerForm() { return this.page.locator('[data-testid="register-form"]'); }
  get loginUsernameInput() { return this.page.locator('[data-testid="input-login-username"]'); }
  get loginPasswordInput() { return this.page.locator('[data-testid="input-login-password"]'); }
  get loginSubmitButton() { return this.page.locator('[data-testid="button-login-submit"]'); }
  get registerUsernameInput() { return this.page.locator('[data-testid="input-register-username"]'); }
  get registerPasswordInput() { return this.page.locator('[data-testid="input-register-password"]'); }
  get registerConfirmPasswordInput() { return this.page.locator('[data-testid="input-register-confirm-password"]'); }
  get registerRoleSelect() { return this.page.locator('[data-testid="select-register-role"]'); }
  get registerSubmitButton() { return this.page.locator('[data-testid="button-register-submit"]'); }
  get loginTab() { return this.page.locator('[role="tab"]', { hasText: 'Sign In' }); }
  get registerTab() { return this.page.locator('[role="tab"]', { hasText: 'Register' }); }

  /**
   * Navigate to the authentication page
   */
  async navigateToAuth(): Promise<void> {
    await this.goto('/auth');
    await this.waitForNavigation('/auth');
  }

  /**
   * Login with username and password
   * @param username - User's username
   * @param password - User's password
   */
  async login(username: string, password: string): Promise<void> {
    await this.navigateToAuth();
    await this.loginTab.click();
    await this.loginUsernameInput.fill(username);
    await this.loginPasswordInput.fill(password);
    await this.loginSubmitButton.click();
    await this.waitForNavigation('/');
  }

  /**
   * Register a new user
   * @param userData - User registration data
   */
  async register(userData: {
    username: string;
    password: string;
    confirmPassword?: string;
    role?: 'admin' | 'hr' | 'viewer';
  }): Promise<void> {
    const { username, password, confirmPassword = password, role = 'hr' } = userData;
    
    await this.navigateToAuth();
    await this.registerTab.click();
    await this.registerUsernameInput.fill(username);
    await this.registerPasswordInput.fill(password);
    await this.registerConfirmPasswordInput.fill(confirmPassword);
    await this.registerRoleSelect.selectOption(role);
    await this.registerSubmitButton.click();
  }

  /**
   * Login with different user roles for testing
   * @param role - The role to login as
   */
  async loginAsRole(role: 'admin' | 'hr' | 'viewer'): Promise<void> {
    const credentials = {
      admin: { username: 'admin', password: 'admin123' },
      hr: { username: 'hr', password: 'hr123' },
      viewer: { username: 'viewer', password: 'viewer123' }
    };

    const { username, password } = credentials[role];
    await this.login(username, password);
  }

  /**
   * Validate login form errors
   * @param expectedError - Expected error message
   */
  async validateLoginError(expectedError: string): Promise<void> {
    const toast = await this.waitForToast('error');
    await expect(toast).toContainText(expectedError);
  }

  /**
   * Validate registration form errors
   * @param expectedError - Expected error message
   */
  async validateRegistrationError(expectedError: string): Promise<void> {
    const toast = await this.waitForToast('error');
    await expect(toast).toContainText(expectedError);
  }

  /**
   * Validate successful registration
   */
  async validateRegistrationSuccess(): Promise<void> {
    const toast = await this.waitForToast('success');
    await expect(toast).toBeVisible();
  }

  /**
   * Check if user is redirected to dashboard after login
   */
  async validateLoginSuccess(): Promise<void> {
    await this.waitForNavigation('/');
    await expect(this.page).toHaveURL('/');
  }

  /**
   * Test password mismatch validation
   */
  async testPasswordMismatch(): Promise<void> {
    await this.navigateToAuth();
    await this.registerTab.click();
    await this.registerUsernameInput.fill('testuser');
    await this.registerPasswordInput.fill('password123');
    await this.registerConfirmPasswordInput.fill('differentpassword');
    
    // Check if submit button is disabled
    await expect(this.registerSubmitButton).toBeDisabled();
  }

  /**
   * Check for onboarding flow with invitation token
   * @param token - Invitation token
   */
  async registerWithInvitationToken(token: string, userData: { username: string; password: string }): Promise<void> {
    await this.goto(`/auth?token=${token}`);
    await this.registerTab.click();
    
    // Should show onboarding message
    await expect(this.page.locator('text=Welcome! Create your account to begin the onboarding process')).toBeVisible();
    
    await this.registerUsernameInput.fill(userData.username);
    await this.registerPasswordInput.fill(userData.password);
    await this.registerConfirmPasswordInput.fill(userData.password);
    await this.registerSubmitButton.click();
  }
}