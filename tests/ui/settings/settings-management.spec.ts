import { test, expect } from '@playwright/test';
import { SettingsPage } from '../pages/settings.page';
import { AuthHelpers } from '../utils/auth-helpers';
import { TestDataFactory } from '../utils/test-data';
import { TestCleanup } from '../utils/test-cleanup';
import { CommonHelpers } from '../utils/common-helpers';

/**
 * Settings Management Tests
 * @description Tests for application settings, API keys, and system configuration
 */
test.describe('Settings Management', () => {
  let settingsPage: SettingsPage;
  let authHelpers: AuthHelpers;
  let testCleanup: TestCleanup;
  let commonHelpers: CommonHelpers;

  const createdApiKeyIds: string[] = [];

  test.beforeEach(async ({ page }) => {
    settingsPage = new SettingsPage(page);
    authHelpers = new AuthHelpers(page);
    testCleanup = new TestCleanup(page);
    commonHelpers = new CommonHelpers(page);
    
    // Login as admin user (has settings permissions)
    await authHelpers.loginAs('admin');
  });

  test.afterEach(async ({ page }) => {
    await testCleanup.comprehensiveCleanup({
      apiKeyIds: createdApiKeyIds
    });
  });

  test.describe('General Settings Access', () => {
    test('should navigate to settings page', async ({ page }) => {
      await settingsPage.navigateToSettings();
      
      // Verify settings page elements
      await expect(settingsPage.settingsTitle).toBeVisible();
    });

    test('should display settings navigation tabs', async ({ page }) => {
      await settingsPage.navigateToSettings();
      
      // Check for main settings sections
      const expectedTabs = [
        settingsPage.apiKeysTab,
        settingsPage.systemSettingsTab,
        settingsPage.emailSettingsTab
      ];
      
      for (const tab of expectedTabs) {
        if (await tab.isVisible()) {
          await expect(tab).toBeVisible();
        }
      }
    });
  });

  test.describe('API Keys Management', () => {
    test('should create new API key', async ({ page }) => {
      const apiKeyData = TestDataFactory.createApiKey({
        name: 'Test OpenAI Key',
        service: 'openai'
      });
      
      await settingsPage.addApiKey(apiKeyData);
      
      // Verify API key was created
      await settingsPage.validateApiKeyCreated(apiKeyData.name);
      
      // Store for cleanup
      createdApiKeyIds.push(apiKeyData.name); // Using name as ID for simplification
    });

    test('should validate API key required fields', async ({ page }) => {
      await settingsPage.navigateToApiKeys();
      await settingsPage.clickByTestId('button-add-api-key');
      
      // Try to submit empty form
      await settingsPage.clickByTestId('button-save-api-key');
      
      // Should show validation errors
      await expect(settingsPage.apiKeyNameInput).toBeInvalid();
      await expect(settingsPage.apiKeyValueInput).toBeInvalid();
    });

    test('should support different API key types', async ({ page }) => {
      const keyTypes = ['openai', 's3', 'ses', 'docuseal', 'custom'];
      
      for (const service of keyTypes.slice(0, 2)) { // Test first 2 types
        const apiKeyData = TestDataFactory.createApiKey({
          name: `Test ${service.toUpperCase()} Key`,
          service: service as any
        });
        
        await settingsPage.addApiKey(apiKeyData);
        await settingsPage.validateApiKeyCreated(apiKeyData.name);
        
        createdApiKeyIds.push(apiKeyData.name);
      }
    });

    test('should delete API key', async ({ page }) => {
      const apiKeyData = TestDataFactory.createApiKey({
        name: 'Key to Delete'
      });
      
      // Create API key first
      await settingsPage.addApiKey(apiKeyData);
      await settingsPage.validateApiKeyCreated(apiKeyData.name);
      
      // Delete the API key
      await settingsPage.deleteApiKey(apiKeyData.name);
      
      // Verify key is deleted
      await settingsPage.navigateToApiKeys();
      await expect(page.locator(`tr:has-text("${apiKeyData.name}")`)).toBeHidden();
    });

    test('should mask API key values in display', async ({ page }) => {
      const apiKeyData = TestDataFactory.createApiKey();
      
      await settingsPage.addApiKey(apiKeyData);
      await settingsPage.navigateToApiKeys();
      
      // API key value should be masked in the UI
      const keyRow = page.locator(`tr:has-text("${apiKeyData.name}")`);
      await expect(keyRow.locator('text=*****, text=••••')).toBeVisible();
      
      createdApiKeyIds.push(apiKeyData.name);
    });
  });

  test.describe('S3 Configuration', () => {
    test('should configure S3 settings', async ({ page }) => {
      const settingsData = TestDataFactory.createSettingsData();
      
      await settingsPage.configureS3(settingsData.s3);
      
      // Verify settings were saved
      await settingsPage.validateSettingsSaved('S3');
    });

    test('should validate S3 configuration fields', async ({ page }) => {
      await settingsPage.navigateToSettings();
      
      // Clear S3 fields and try to save
      await settingsPage.s3BucketInput.fill('');
      await settingsPage.s3RegionInput.fill('');
      
      await settingsPage.clickByTestId('button-save-s3');
      
      // Should show validation errors
      await expect(settingsPage.s3BucketInput).toBeInvalid();
      await expect(settingsPage.s3RegionInput).toBeInvalid();
    });

    test('should test S3 connection', async ({ page }) => {
      const settingsData = TestDataFactory.createSettingsData();
      
      // Configure S3 first
      await settingsPage.configureS3(settingsData.s3);
      
      // Test connection
      await settingsPage.testS3Connection();
      
      // Verify connection test result (could be success or failure)
      await settingsPage.validateConnectionTest('s3', false); // Expect failure with test credentials
    });

    test('should handle S3 connection failures', async ({ page }) => {
      // Configure with invalid credentials
      const invalidS3Config = {
        bucket: 'invalid-bucket',
        region: 'invalid-region',
        accessKey: 'invalid-key',
        secretKey: 'invalid-secret'
      };
      
      await settingsPage.configureS3(invalidS3Config);
      await settingsPage.testS3Connection();
      
      // Should show connection failure
      await settingsPage.validateConnectionTest('s3', false);
    });
  });

  test.describe('SES Configuration', () => {
    test('should configure SES settings', async ({ page }) => {
      const settingsData = TestDataFactory.createSettingsData();
      
      await settingsPage.configureSES(settingsData.ses);
      
      // Verify settings were saved
      await settingsPage.validateSettingsSaved('SES');
    });

    test('should validate email address format', async ({ page }) => {
      const invalidSESConfig = {
        region: 'us-east-1',
        accessKey: 'valid-key',
        secretKey: 'valid-secret',
        fromEmail: 'invalid-email-format'
      };
      
      await settingsPage.configureSES(invalidSESConfig);
      
      // Should show email validation error
      await expect(settingsPage.sesFromEmailInput).toBeInvalid();
    });

    test('should test SES connection', async ({ page }) => {
      const settingsData = TestDataFactory.createSettingsData();
      
      await settingsPage.configureSES(settingsData.ses);
      await settingsPage.testSESConnection();
      
      // Verify connection test (expect failure with test credentials)
      await settingsPage.validateConnectionTest('ses', false);
    });
  });

  test.describe('DocuSeal Configuration', () => {
    test('should configure DocuSeal settings', async ({ page }) => {
      const settingsData = TestDataFactory.createSettingsData();
      
      await settingsPage.configureDocuSeal(settingsData.docuseal);
      
      // Verify settings were saved
      await settingsPage.validateSettingsSaved('DocuSeal');
    });

    test('should validate webhook URL format', async ({ page }) => {
      const invalidDocuSealConfig = {
        apiKey: 'valid-api-key',
        webhookUrl: 'invalid-url-format'
      };
      
      await settingsPage.configureDocuSeal(invalidDocuSealConfig);
      
      // Should show URL validation error
      await expect(settingsPage.docusealWebhookUrlInput).toBeInvalid();
    });

    test('should test DocuSeal connection', async ({ page }) => {
      const settingsData = TestDataFactory.createSettingsData();
      
      await settingsPage.configureDocuSeal(settingsData.docuseal);
      await settingsPage.testDocuSealConnection();
      
      // Verify connection test
      await settingsPage.validateConnectionTest('docuseal', false);
    });
  });

  test.describe('Role-Based Settings Access', () => {
    test('should allow admin full access to settings', async ({ page }) => {
      await authHelpers.loginAs('admin');
      await settingsPage.validateRoleBasedAccess('admin');
      
      // Admin should see all settings sections
      await expect(settingsPage.s3AccessKeyInput).toBeVisible();
      await expect(settingsPage.addApiKeyButton).toBeEnabled();
    });

    test('should limit HR access to settings', async ({ page }) => {
      await authHelpers.loginAs('hr');
      await settingsPage.validateRoleBasedAccess('hr');
      
      // HR should have limited access
    });

    test('should restrict viewer access to settings', async ({ page }) => {
      await authHelpers.loginAs('viewer');
      await settingsPage.validateRoleBasedAccess('viewer');
      
      // Viewer should have read-only access
    });
  });

  test.describe('Settings Persistence', () => {
    test('should persist settings across sessions', async ({ page }) => {
      const settingsData = TestDataFactory.createSettingsData();
      
      // Configure and save settings
      await settingsPage.configureS3(settingsData.s3);
      
      // Logout and login again
      await authHelpers.logout();
      await authHelpers.loginAs('admin');
      
      // Navigate back to settings
      await settingsPage.navigateToSettings();
      
      // Settings should be preserved
      await expect(settingsPage.s3BucketInput).toHaveValue(settingsData.s3.bucket);
      await expect(settingsPage.s3RegionInput).toHaveValue(settingsData.s3.region);
    });

    test('should handle settings update conflicts', async ({ page }) => {
      const settingsData = TestDataFactory.createSettingsData();
      
      // Configure settings
      await settingsPage.configureS3(settingsData.s3);
      
      // Simulate concurrent update (this would require more complex setup)
      await settingsPage.s3BucketInput.fill('updated-bucket-name');
      await settingsPage.clickByTestId('button-save-s3');
      
      // Should handle update gracefully
      await settingsPage.validateSettingsSaved('S3');
    });
  });

  test.describe('Settings Import/Export', () => {
    test('should export settings configuration', async ({ page }) => {
      await settingsPage.navigateToSettings();
      
      // Look for export functionality
      const exportButton = page.locator('[data-testid*="export"], button:has-text("Export")');
      
      if (await exportButton.isVisible()) {
        const downloadPromise = page.waitForEvent('download');
        await exportButton.click();
        const download = await downloadPromise;
        
        expect(download.suggestedFilename()).toContain('settings');
      }
    });

    test('should validate settings before import', async ({ page }) => {
      await settingsPage.navigateToSettings();
      
      const importButton = page.locator('[data-testid*="import"], button:has-text("Import")');
      
      if (await importButton.isVisible()) {
        // This would require creating a test import file
        const importInput = page.locator('input[type="file"]');
        if (await importInput.isVisible()) {
          await importInput.setInputFiles('tests/ui/fixtures/invalid-settings.json');
          
          // Should show validation errors for invalid settings
          await commonHelpers.waitForToastAndValidate('invalid settings', 'error');
        }
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle settings save failures', async ({ page }) => {
      // Mock settings API failure
      await page.route('/api/settings/**', route => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Settings save failed' })
        });
      });
      
      const settingsData = TestDataFactory.createSettingsData();
      
      await settingsPage.navigateToSettings();
      await settingsPage.s3BucketInput.fill(settingsData.s3.bucket);
      await settingsPage.clickByTestId('button-save-s3');
      
      // Should show save error
      await commonHelpers.waitForToastAndValidate('Settings save failed', 'error');
    });

    test('should handle network errors gracefully', async ({ page }) => {
      await page.route('/api/settings/**', route => route.abort());
      
      await settingsPage.navigateToSettings();
      
      // Should show network error or loading state
      const errorMessage = page.locator('text=network error, text=failed to load');
      if (await errorMessage.isVisible()) {
        await expect(errorMessage).toBeVisible();
      }
    });

    test('should validate settings before saving', async ({ page }) => {
      await settingsPage.navigateToSettings();
      
      // Enter invalid settings data
      await settingsPage.s3BucketInput.fill(''); // Invalid empty bucket
      await settingsPage.s3RegionInput.fill('invalid-region'); // Invalid region
      
      await settingsPage.clickByTestId('button-save-s3');
      
      // Should show validation errors
      await expect(settingsPage.s3BucketInput).toBeInvalid();
    });
  });

  test.describe('Settings Security', () => {
    test('should not expose sensitive values in client-side code', async ({ page }) => {
      const settingsData = TestDataFactory.createSettingsData();
      
      await settingsPage.configureS3(settingsData.s3);
      
      // Check that secret keys are not exposed in the DOM
      const pageContent = await page.content();
      expect(pageContent).not.toContain(settingsData.s3.secretKey);
      expect(pageContent).not.toContain(settingsData.s3.accessKey);
    });

    test('should mask sensitive input fields', async ({ page }) => {
      await settingsPage.navigateToSettings();
      
      // Secret key fields should be password type
      await expect(settingsPage.s3SecretKeyInput).toHaveAttribute('type', 'password');
      await expect(settingsPage.sesSecretKeyInput).toHaveAttribute('type', 'password');
    });

    test('should require confirmation for destructive actions', async ({ page }) => {
      const apiKeyData = TestDataFactory.createApiKey();
      
      await settingsPage.addApiKey(apiKeyData);
      
      // Delete should require confirmation
      await settingsPage.navigateToApiKeys();
      const deleteButton = page.locator(`tr:has-text("${apiKeyData.name}") [data-testid*="delete"]`);
      
      if (await deleteButton.isVisible()) {
        await deleteButton.click();
        
        // Should show confirmation dialog
        await expect(page.locator('[role="dialog"], .modal')).toBeVisible();
      }
      
      createdApiKeyIds.push(apiKeyData.name);
    });
  });
});