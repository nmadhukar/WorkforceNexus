import { Page, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Settings Page Object Model for application settings management
 * @description Handles settings configuration, API keys, and system preferences
 */
export class SettingsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // Main settings locators
  get settingsTitle() { return this.page.locator('h1:has-text("Settings")'); }
  get apiKeysTab() { return this.page.locator('[data-testid*="api-keys"], a:has-text("API Keys")'); }
  get systemSettingsTab() { return this.page.locator('[data-testid*="system"], a:has-text("System")'); }
  get emailSettingsTab() { return this.page.locator('[data-testid*="email"], a:has-text("Email")'); }

  // API Keys section
  get addApiKeyButton() { return this.page.locator('[data-testid="button-add-api-key"]'); }
  get apiKeyNameInput() { return this.page.locator('[data-testid="input-api-key-name"]'); }
  get apiKeyValueInput() { return this.page.locator('[data-testid="input-api-key-value"]'); }
  get apiKeyServiceSelect() { return this.page.locator('[data-testid="select-api-key-service"]'); }
  get saveApiKeyButton() { return this.page.locator('[data-testid="button-save-api-key"]'); }
  
  // S3 Configuration
  get s3BucketInput() { return this.page.locator('[data-testid="input-s3-bucket"]'); }
  get s3RegionInput() { return this.page.locator('[data-testid="input-s3-region"]'); }
  get s3AccessKeyInput() { return this.page.locator('[data-testid="input-s3-access-key"]'); }
  get s3SecretKeyInput() { return this.page.locator('[data-testid="input-s3-secret-key"]'); }
  get testS3ConnectionButton() { return this.page.locator('[data-testid="button-test-s3"]'); }
  get saveS3SettingsButton() { return this.page.locator('[data-testid="button-save-s3"]'); }

  // SES Configuration
  get sesRegionInput() { return this.page.locator('[data-testid="input-ses-region"]'); }
  get sesAccessKeyInput() { return this.page.locator('[data-testid="input-ses-access-key"]'); }
  get sesSecretKeyInput() { return this.page.locator('[data-testid="input-ses-secret-key"]'); }
  get sesFromEmailInput() { return this.page.locator('[data-testid="input-ses-from-email"]'); }
  get testSESConnectionButton() { return this.page.locator('[data-testid="button-test-ses"]'); }
  get saveSESSettingsButton() { return this.page.locator('[data-testid="button-save-ses"]'); }

  // DocuSeal Configuration
  get docusealApiKeyInput() { return this.page.locator('[data-testid="input-docuseal-api-key"]'); }
  get docusealWebhookUrlInput() { return this.page.locator('[data-testid="input-docuseal-webhook"]'); }
  get testDocusealButton() { return this.page.locator('[data-testid="button-test-docuseal"]'); }
  get saveDocusealButton() { return this.page.locator('[data-testid="button-save-docuseal"]'); }

  /**
   * Navigate to settings page
   */
  async navigateToSettings(): Promise<void> {
    await this.goto('/settings');
    await expect(this.settingsTitle).toBeVisible();
  }

  /**
   * Navigate to API Keys settings
   */
  async navigateToApiKeys(): Promise<void> {
    await this.goto('/settings/api-keys');
    await this.waitForNavigation('/settings/api-keys');
  }

  /**
   * Add a new API key
   * @param apiKeyData - API key information
   */
  async addApiKey(apiKeyData: {
    name: string;
    value: string;
    service: 'openai' | 's3' | 'ses' | 'docuseal' | 'custom';
  }): Promise<void> {
    await this.navigateToApiKeys();
    await this.clickByTestId('button-add-api-key');
    
    await this.apiKeyNameInput.fill(apiKeyData.name);
    await this.apiKeyValueInput.fill(apiKeyData.value);
    await this.apiKeyServiceSelect.selectOption(apiKeyData.service);
    
    await this.clickByTestId('button-save-api-key');
    await this.waitForToast('success');
  }

  /**
   * Configure S3 settings
   * @param s3Config - S3 configuration data
   */
  async configureS3(s3Config: {
    bucket: string;
    region: string;
    accessKey: string;
    secretKey: string;
  }): Promise<void> {
    await this.navigateToSettings();
    
    await this.s3BucketInput.fill(s3Config.bucket);
    await this.s3RegionInput.fill(s3Config.region);
    await this.s3AccessKeyInput.fill(s3Config.accessKey);
    await this.s3SecretKeyInput.fill(s3Config.secretKey);
    
    await this.clickByTestId('button-save-s3');
    await this.waitForToast('success');
  }

  /**
   * Test S3 connection
   */
  async testS3Connection(): Promise<void> {
    await this.clickByTestId('button-test-s3');
    
    // Wait for either success or error toast
    const toast = await Promise.race([
      this.waitForToast('success'),
      this.waitForToast('error')
    ]);
    
    await expect(toast).toBeVisible();
  }

  /**
   * Configure SES settings
   * @param sesConfig - SES configuration data
   */
  async configureSES(sesConfig: {
    region: string;
    accessKey: string;
    secretKey: string;
    fromEmail: string;
  }): Promise<void> {
    await this.navigateToSettings();
    
    await this.sesRegionInput.fill(sesConfig.region);
    await this.sesAccessKeyInput.fill(sesConfig.accessKey);
    await this.sesSecretKeyInput.fill(sesConfig.secretKey);
    await this.sesFromEmailInput.fill(sesConfig.fromEmail);
    
    await this.clickByTestId('button-save-ses');
    await this.waitForToast('success');
  }

  /**
   * Test SES connection
   */
  async testSESConnection(): Promise<void> {
    await this.clickByTestId('button-test-ses');
    
    const toast = await Promise.race([
      this.waitForToast('success'),
      this.waitForToast('error')
    ]);
    
    await expect(toast).toBeVisible();
  }

  /**
   * Configure DocuSeal settings
   * @param docusealConfig - DocuSeal configuration data
   */
  async configureDocuSeal(docusealConfig: {
    apiKey: string;
    webhookUrl: string;
  }): Promise<void> {
    await this.navigateToSettings();
    
    await this.docusealApiKeyInput.fill(docusealConfig.apiKey);
    await this.docusealWebhookUrlInput.fill(docusealConfig.webhookUrl);
    
    await this.clickByTestId('button-save-docuseal');
    await this.waitForToast('success');
  }

  /**
   * Test DocuSeal connection
   */
  async testDocuSealConnection(): Promise<void> {
    await this.clickByTestId('button-test-docuseal');
    
    const toast = await Promise.race([
      this.waitForToast('success'),
      this.waitForToast('error')
    ]);
    
    await expect(toast).toBeVisible();
  }

  /**
   * Validate settings save success
   * @param settingType - Type of setting saved
   */
  async validateSettingsSaved(settingType: string): Promise<void> {
    const toast = await this.waitForToast('success');
    await expect(toast).toContainText(/saved|updated|configured/i);
  }

  /**
   * Validate API key creation
   * @param keyName - Name of the created API key
   */
  async validateApiKeyCreated(keyName: string): Promise<void> {
    await this.navigateToApiKeys();
    const keyRow = this.page.locator(`tr:has-text("${keyName}")`);
    await expect(keyRow).toBeVisible();
  }

  /**
   * Delete an API key
   * @param keyName - Name of the API key to delete
   */
  async deleteApiKey(keyName: string): Promise<void> {
    await this.navigateToApiKeys();
    const keyRow = this.page.locator(`tr:has-text("${keyName}")`);
    const deleteButton = keyRow.locator('[data-testid*="delete"], button:has-text("Delete")');
    
    await deleteButton.click();
    
    // Confirm deletion in modal/dialog
    const confirmButton = this.page.locator('button:has-text("Delete"), button:has-text("Confirm")');
    await confirmButton.click();
    
    await this.waitForToast('success');
  }

  /**
   * Validate configuration connection test results
   * @param service - Service being tested (s3, ses, docuseal)
   * @param shouldSucceed - Whether the test should succeed
   */
  async validateConnectionTest(service: 's3' | 'ses' | 'docuseal', shouldSucceed: boolean): Promise<void> {
    const expectedToastType = shouldSucceed ? 'success' : 'error';
    const toast = await this.waitForToast(expectedToastType);
    
    if (shouldSucceed) {
      await expect(toast).toContainText(/connected|success/i);
    } else {
      await expect(toast).toContainText(/failed|error|invalid/i);
    }
  }

  /**
   * Test role-based access to settings
   * @param userRole - User role to test with
   */
  async validateRoleBasedAccess(userRole: 'admin' | 'hr' | 'viewer'): Promise<void> {
    await this.navigateToSettings();
    
    if (userRole === 'viewer') {
      // Viewers should not see sensitive settings
      await expect(this.s3AccessKeyInput).toBeDisabled();
      await expect(this.sesSecretKeyInput).toBeDisabled();
    } else if (userRole === 'hr') {
      // HR should have limited access
      await expect(this.s3AccessKeyInput).toBeVisible();
      await expect(this.addApiKeyButton).toBeDisabled();
    } else {
      // Admin should have full access
      await expect(this.s3AccessKeyInput).toBeVisible();
      await expect(this.addApiKeyButton).toBeEnabled();
    }
  }
}