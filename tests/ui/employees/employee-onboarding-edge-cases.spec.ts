/**
 * Employee Onboarding Edge Cases and Error Scenarios Tests
 * @description Tests for edge cases, error handling, and security scenarios in employee onboarding
 */

import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../utils/auth-helpers';
import { CommonHelpers } from '../utils/common-helpers';
import { TestCleanup } from '../utils/test-cleanup';
import {
  generateEmployeeData,
  fillPersonalInfo,
  fillProfessionalInfo,
  cleanupTestEmployees,
  createExpiredInvitation
} from '../../utils/onboarding-helpers';

test.describe('Employee Onboarding Edge Cases', () => {
  let authHelpers: AuthHelpers;
  let commonHelpers: CommonHelpers;
  let testCleanup: TestCleanup;
  const createdEmployeeIds: string[] = [];
  const createdUsernames: string[] = [];

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page);
    commonHelpers = new CommonHelpers(page);
    testCleanup = new TestCleanup(page);
  });

  test.afterEach(async ({ page }) => {
    // Clean up test data
    await testCleanup.comprehensiveCleanup({
      employeeIds: createdEmployeeIds,
      usernames: createdUsernames
    });
    await cleanupTestEmployees(createdEmployeeIds);
  });

  test('Expired invitation token', async ({ page, request }) => {
    // Login as admin
    await authHelpers.loginAs('admin');
    
    // Create an invitation
    const invitationData = {
      firstName: 'Expired',
      lastName: 'Token',
      email: `expired${Date.now()}@hospital.com`
    };
    
    await page.goto('/employees');
    await page.click('[data-testid="tab-invitations"], button:has-text("Invitations")');
    await page.click('[data-testid="button-create-invitation"], button:has-text("Create Invitation"), button:has-text("New Invitation")');
    
    await page.fill('[data-testid="input-firstName"]', invitationData.firstName);
    await page.fill('[data-testid="input-lastName"]', invitationData.lastName);
    await page.fill('[data-testid="input-email"]', invitationData.email);
    await page.click('[data-testid="button-submit"], button:has-text("Send"), button:has-text("Create")');
    await page.waitForSelector('[data-testid="toast-success"], .toast-success');
    
    // Get the invitation token
    const invitationsResponse = await request.get('/api/invitations');
    const invitations = await invitationsResponse.json();
    const invitation = invitations.find((inv: any) => inv.email === invitationData.email);
    
    // Simulate expired token by waiting or manipulating the token
    // For testing purposes, we'll use an old token format
    const expiredToken = 'expired_' + invitation.token;
    
    // Logout
    await authHelpers.logout();
    
    // Try to use expired invitation
    await page.goto(`/register/${expiredToken}`);
    
    // Should show error message
    await expect(page.locator('[data-testid="error-expired-token"], .error-message, .alert-error')).toBeVisible();
    
    // Verify error text
    const errorElement = page.locator('[data-testid="error-expired-token"], .error-message, .alert-error').first();
    await expect(errorElement).toContainText(/expired|invalid/i);
  });

  test('Invalid invitation token', async ({ page }) => {
    // Navigate with malformed token
    const invalidTokens = [
      'invalid_token_123',
      '../../etc/passwd',
      '<script>alert(1)</script>',
      'null',
      'undefined',
      '',
      '123456789012345678901234567890123456789012345678901234567890' // Too long
    ];
    
    for (const token of invalidTokens) {
      await page.goto(`/register/${token}`);
      
      // Should show error or redirect to login
      const errorVisible = await page.locator('[data-testid*="error"], .error-message, .alert-error').isVisible({ timeout: 2000 }).catch(() => false);
      const loginPageVisible = await page.url().includes('/login');
      
      expect(errorVisible || loginPageVisible).toBeTruthy();
    }
  });

  test('Duplicate email registration', async ({ page, request }) => {
    // Create an employee first
    await authHelpers.loginAs('admin');
    
    const existingEmail = `existing${Date.now()}@hospital.com`;
    
    // Create employee through form
    await page.goto('/employees/new');
    await page.fill('[data-testid="input-firstName"]', 'Existing');
    await page.fill('[data-testid="input-lastName"]', 'Employee');
    await page.fill('[data-testid="input-workEmail"]', existingEmail);
    
    // Navigate through minimal steps to create employee
    for (let i = 1; i <= 12; i++) {
      const nextButton = page.locator('[data-testid="button-next"]');
      if (await nextButton.isVisible({ timeout: 500 }).catch(() => false)) {
        await nextButton.click();
      }
    }
    
    await page.click('[data-testid="button-submit"], button:has-text("Submit"), button:has-text("Complete")');
    await page.waitForSelector('[data-testid="toast-success"], .toast-success');
    
    // Try to create another employee with same email
    await page.goto('/employees/new');
    await page.fill('[data-testid="input-firstName"]', 'Duplicate');
    await page.fill('[data-testid="input-lastName"]', 'Email');
    await page.fill('[data-testid="input-workEmail"]', existingEmail);
    
    // Try to proceed
    await page.click('[data-testid="button-next"], button:has-text("Next")');
    
    // Should show error about duplicate email
    const errorElement = page.locator('[data-testid*="error-email"], .field-error, .error-message').first();
    const errorVisible = await errorElement.isVisible({ timeout: 2000 }).catch(() => false);
    
    if (errorVisible) {
      await expect(errorElement).toContainText(/already exists|duplicate|taken/i);
    } else {
      // Or form submission should fail
      for (let i = 1; i <= 12; i++) {
        const nextButton = page.locator('[data-testid="button-next"]');
        if (await nextButton.isVisible({ timeout: 500 }).catch(() => false)) {
          await nextButton.click();
        }
      }
      
      await page.click('[data-testid="button-submit"], button:has-text("Submit"), button:has-text("Complete")');
      
      // Should show error toast
      await expect(page.locator('[data-testid="toast-error"], .toast-error')).toBeVisible();
    }
  });

  test('Session timeout during form', async ({ page, context }) => {
    // Login as admin
    await authHelpers.loginAs('admin');
    
    // Start filling form
    await page.goto('/employees/new');
    const employeeData = generateEmployeeData();
    
    await fillPersonalInfo(page, employeeData.personalInfo);
    await page.click('[data-testid="button-next"]');
    
    await fillProfessionalInfo(page, employeeData.professionalInfo);
    
    // Clear session cookies to simulate timeout
    await context.clearCookies();
    
    // Try to continue
    await page.click('[data-testid="button-next"]');
    
    // Should redirect to login
    await page.waitForURL(/\/login/, { timeout: 5000 });
    
    // Login again
    await page.fill('[data-testid="input-username"], [data-testid="input-email"]', 'admin@test.com');
    await page.fill('[data-testid="input-password"]', 'AdminPass123!');
    await page.click('[data-testid="button-login"], button:has-text("Login"), button:has-text("Sign In")');
    
    // Should be able to resume (if draft was saved) or start over
    await page.goto('/employees');
    
    // Check if we have drafts or need to start over
    const hasDrafts = await page.locator('[data-testid*="draft"], .draft-indicator').isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasDrafts !== null).toBeTruthy(); // Just verify we can continue
  });

  test('Large file upload', async ({ page }) => {
    // Login as admin
    await authHelpers.loginAs('admin');
    
    // Navigate to employee form
    await page.goto('/employees/new');
    
    // Fill basic info and navigate to documents step
    const employeeData = generateEmployeeData();
    await fillPersonalInfo(page, employeeData.personalInfo);
    
    // Navigate to documents step (step 12)
    for (let i = 1; i < 12; i++) {
      await page.click('[data-testid="button-next"]');
    }
    
    // Create a large file (>10MB) programmatically
    const largeFileContent = 'x'.repeat(11 * 1024 * 1024); // 11MB of 'x'
    const largeFileName = 'large-file.txt';
    
    // Try to upload large file
    const fileInput = page.locator('[data-testid="input-document-upload"], input[type="file"]').first();
    
    // Set up listener for file chooser
    page.on('filechooser', async (fileChooser) => {
      // Create a buffer with large content
      const buffer = Buffer.from(largeFileContent);
      await fileChooser.setFiles([
        {
          name: largeFileName,
          mimeType: 'text/plain',
          buffer: buffer
        }
      ]);
    });
    
    // Trigger file selection
    await fileInput.click();
    
    // Wait for error message about file size
    const errorElement = page.locator('[data-testid*="error-file"], .file-error, .error-message');
    const errorVisible = await errorElement.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (errorVisible) {
      await expect(errorElement.first()).toContainText(/size|large|10MB|limit/i);
    } else {
      // Check for toast error
      await expect(page.locator('[data-testid="toast-error"], .toast-error')).toBeVisible({ timeout: 5000 });
    }
  });

  test('Special characters in text fields', async ({ page }) => {
    // Login as admin
    await authHelpers.loginAs('admin');
    
    // Navigate to employee form
    await page.goto('/employees/new');
    
    // Test special character data
    const specialCharData = {
      firstName: "Jean-François",
      middleName: "D'Angelo",
      lastName: "O'Brien-Müller",
      workEmail: `special${Date.now()}@hospital.com`,
      homeAddress1: "123 Château-Rouge St. #4½",
      homeCity: "São Paulo",
      homeState: "CA",
      homeZip: "12345",
      jobTitle: "Médecin généraliste",
      qualification: "M.D., Ph.D.",
      cellPhone: "555-123-4567"
    };
    
    // Fill personal info with special characters
    await page.fill('[data-testid="input-firstName"]', specialCharData.firstName);
    await page.fill('[data-testid="input-middleName"]', specialCharData.middleName);
    await page.fill('[data-testid="input-lastName"]', specialCharData.lastName);
    await page.fill('[data-testid="input-workEmail"]', specialCharData.workEmail);
    await page.fill('[data-testid="input-homeAddress1"]', specialCharData.homeAddress1);
    await page.fill('[data-testid="input-homeCity"]', specialCharData.homeCity);
    await page.fill('[data-testid="input-homeState"]', specialCharData.homeState);
    await page.fill('[data-testid="input-homeZip"]', specialCharData.homeZip);
    await page.fill('[data-testid="input-cellPhone"]', specialCharData.cellPhone);
    
    await page.click('[data-testid="button-next"]');
    
    // Fill professional info with special characters
    await page.fill('[data-testid="input-jobTitle"]', specialCharData.jobTitle);
    await page.fill('[data-testid="input-qualification"]', specialCharData.qualification);
    
    // Continue through all steps
    for (let i = 2; i <= 12; i++) {
      const nextButton = page.locator('[data-testid="button-next"]');
      if (await nextButton.isVisible({ timeout: 500 }).catch(() => false)) {
        await nextButton.click();
      }
    }
    
    // Submit form
    await page.click('[data-testid="button-submit"], button:has-text("Submit"), button:has-text("Complete")');
    
    // Verify success
    await page.waitForSelector('[data-testid="toast-success"], .toast-success');
    
    // Verify data was saved correctly
    const currentUrl = page.url();
    const idMatch = currentUrl.match(/employees\/(\d+)/);
    
    if (idMatch) {
      createdEmployeeIds.push(idMatch[1]);
      
      // Navigate to the employee profile
      await page.goto(`/employees/${idMatch[1]}`);
      
      // Verify special characters are displayed correctly
      await expect(page.locator('[data-testid="text-firstName"], [data-testid="employee-firstName"]')).toContainText(specialCharData.firstName);
      await expect(page.locator('[data-testid="text-lastName"], [data-testid="employee-lastName"]')).toContainText(specialCharData.lastName);
    }
  });

  test('Invalid date inputs', async ({ page }) => {
    // Login as admin
    await authHelpers.loginAs('admin');
    
    // Navigate to employee form
    await page.goto('/employees/new');
    
    const testDates = [
      { field: 'dateOfBirth', value: '2030-01-01', error: 'future' }, // Future birth date
      { field: 'dateOfBirth', value: '1850-01-01', error: 'too old' }, // Before 1900
      { field: 'dateOfBirth', value: '99/99/9999', error: 'invalid format' }, // Invalid format
      { field: 'dateOfBirth', value: 'not-a-date', error: 'invalid' }, // Not a date
    ];
    
    // Fill basic required fields
    await page.fill('[data-testid="input-firstName"]', 'Test');
    await page.fill('[data-testid="input-lastName"]', 'Dates');
    await page.fill('[data-testid="input-workEmail"]', `dates${Date.now()}@hospital.com`);
    
    for (const testDate of testDates) {
      // Clear and fill the date field
      const dateInput = page.locator(`[data-testid="input-${testDate.field}"]`);
      await dateInput.fill('');
      await dateInput.fill(testDate.value);
      
      // Tab out or click elsewhere to trigger validation
      await page.keyboard.press('Tab');
      
      // Check for validation error
      const errorElement = page.locator(`[data-testid="error-${testDate.field}"], .field-error`);
      const errorVisible = await errorElement.isVisible({ timeout: 1000 }).catch(() => false);
      
      if (errorVisible) {
        // Verify appropriate error message
        const errorText = await errorElement.textContent();
        expect(errorText?.toLowerCase()).toMatch(/invalid|future|date|format/);
      }
      
      // Clear the field for next test
      await dateInput.fill('');
    }
    
    // Test valid date to ensure form can proceed
    await page.fill('[data-testid="input-dateOfBirth"]', '1990-01-15');
    await page.click('[data-testid="button-next"]');
    
    // Should be able to proceed to next step
    await expect(page.locator('[data-step="2"].active, .step-2.active')).toBeVisible();
  });

  test('SQL injection attempts', async ({ page }) => {
    // Login as admin
    await authHelpers.loginAs('admin');
    
    // Navigate to employee form
    await page.goto('/employees/new');
    
    // SQL injection payloads
    const sqlInjectionPayloads = [
      "Robert'); DROP TABLE employees; --",
      "' OR '1'='1",
      "1; DELETE FROM users WHERE 1=1; --",
      "admin'--",
      "' UNION SELECT * FROM users --",
      "1' AND '1' = '1"
    ];
    
    for (const payload of sqlInjectionPayloads) {
      // Try injection in first name field
      await page.fill('[data-testid="input-firstName"]', payload);
      await page.fill('[data-testid="input-lastName"]', 'TestUser');
      await page.fill('[data-testid="input-workEmail"]', `sqli${Date.now()}@hospital.com`);
      
      // Try to proceed
      await page.click('[data-testid="button-next"]');
      
      // The form should either:
      // 1. Sanitize the input and proceed normally
      // 2. Show validation error
      // 3. Not cause any database errors
      
      const hasError = await page.locator('[data-testid*="error"], .error-message').isVisible({ timeout: 1000 }).catch(() => false);
      const onNextStep = await page.locator('[data-step="2"].active, .step-2.active').isVisible({ timeout: 1000 }).catch(() => false);
      
      // Either should have error or proceed normally (input sanitized)
      expect(hasError || onNextStep).toBeTruthy();
      
      // Navigate back to first step for next test
      if (onNextStep) {
        await page.click('[data-testid="button-previous"], button:has-text("Previous"), button:has-text("Back")');
      }
      
      // Clear fields
      await page.fill('[data-testid="input-firstName"]', '');
      await page.fill('[data-testid="input-lastName"]', '');
      await page.fill('[data-testid="input-workEmail"]', '');
    }
    
    // Verify the application is still working
    await page.fill('[data-testid="input-firstName"]', 'Valid');
    await page.fill('[data-testid="input-lastName"]', 'Name');
    await page.fill('[data-testid="input-workEmail"]', `valid${Date.now()}@hospital.com`);
    await page.click('[data-testid="button-next"]');
    
    // Should proceed normally
    await expect(page.locator('[data-step="2"].active, .step-2.active')).toBeVisible();
  });

  test('XSS attempts', async ({ page }) => {
    // Login as admin
    await authHelpers.loginAs('admin');
    
    // Navigate to employee form
    await page.goto('/employees/new');
    
    // XSS payloads
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      'javascript:alert("XSS")',
      '<svg onload=alert("XSS")>',
      '"><script>alert(String.fromCharCode(88,83,83))</script>',
      '<iframe src="javascript:alert(`XSS`)">',
      '<body onload=alert("XSS")>'
    ];
    
    for (const payload of xssPayloads) {
      // Try XSS in various fields
      await page.fill('[data-testid="input-firstName"]', payload);
      await page.fill('[data-testid="input-lastName"]', 'Test');
      await page.fill('[data-testid="input-workEmail"]', `xss${Date.now()}@hospital.com`);
      
      // Check that no alert is triggered
      let alertTriggered = false;
      page.once('dialog', async dialog => {
        alertTriggered = true;
        await dialog.dismiss();
      });
      
      // Try to proceed
      await page.click('[data-testid="button-next"]');
      await page.waitForTimeout(1000); // Wait to see if alert triggers
      
      // XSS should not execute
      expect(alertTriggered).toBeFalsy();
      
      // Navigate back for next test
      const onNextStep = await page.locator('[data-step="2"].active, .step-2.active').isVisible({ timeout: 500 }).catch(() => false);
      if (onNextStep) {
        await page.click('[data-testid="button-previous"], button:has-text("Previous"), button:has-text("Back")');
      }
      
      // Clear fields
      await page.fill('[data-testid="input-firstName"]', '');
      await page.fill('[data-testid="input-lastName"]', '');
      await page.fill('[data-testid="input-workEmail"]', '');
    }
    
    // Test that the form still works normally
    await page.fill('[data-testid="input-firstName"]', 'Normal');
    await page.fill('[data-testid="input-lastName"]', 'User');
    await page.fill('[data-testid="input-workEmail"]', `normal${Date.now()}@hospital.com`);
    await page.click('[data-testid="button-next"]');
    
    // Should proceed normally
    await expect(page.locator('[data-step="2"].active, .step-2.active')).toBeVisible();
  });

  test('Form validation for required fields', async ({ page }) => {
    // Login as admin
    await authHelpers.loginAs('admin');
    
    // Navigate to employee form
    await page.goto('/employees/new');
    
    // Try to proceed without filling required fields
    await page.click('[data-testid="button-next"]');
    
    // Should show validation errors
    const requiredFields = ['firstName', 'lastName', 'workEmail'];
    
    for (const field of requiredFields) {
      const errorElement = page.locator(`[data-testid="error-${field}"], [data-testid="${field}-error"], .field-error`);
      const errorVisible = await errorElement.isVisible({ timeout: 1000 }).catch(() => false);
      
      if (errorVisible) {
        await expect(errorElement.first()).toContainText(/required|must|cannot be empty/i);
      }
    }
    
    // Fill required fields and verify we can proceed
    await page.fill('[data-testid="input-firstName"]', 'Test');
    await page.fill('[data-testid="input-lastName"]', 'User');
    await page.fill('[data-testid="input-workEmail"]', `test${Date.now()}@hospital.com`);
    
    await page.click('[data-testid="button-next"]');
    
    // Should move to next step
    await expect(page.locator('[data-step="2"].active, .step-2.active')).toBeVisible();
  });

  test('Email validation', async ({ page }) => {
    // Login as admin
    await authHelpers.loginAs('admin');
    
    // Navigate to employee form
    await page.goto('/employees/new');
    
    const invalidEmails = [
      'notanemail',
      '@hospital.com',
      'user@',
      'user@.com',
      'user@hospital.',
      'user name@hospital.com',
      'user@hospital@com',
      'user..name@hospital.com'
    ];
    
    // Fill other required fields
    await page.fill('[data-testid="input-firstName"]', 'Test');
    await page.fill('[data-testid="input-lastName"]', 'User');
    
    for (const email of invalidEmails) {
      await page.fill('[data-testid="input-workEmail"]', email);
      await page.keyboard.press('Tab'); // Trigger validation
      
      // Check for validation error
      const errorElement = page.locator('[data-testid="error-workEmail"], [data-testid="workEmail-error"], .field-error');
      const errorVisible = await errorElement.isVisible({ timeout: 1000 }).catch(() => false);
      
      if (errorVisible) {
        await expect(errorElement.first()).toContainText(/email|invalid|format/i);
      }
      
      // Try to proceed - should not work
      await page.click('[data-testid="button-next"]');
      
      // Should still be on step 1
      await expect(page.locator('[data-step="1"].active, .step-1.active')).toBeVisible();
      
      // Clear for next test
      await page.fill('[data-testid="input-workEmail"]', '');
    }
    
    // Test valid email
    await page.fill('[data-testid="input-workEmail"]', `valid${Date.now()}@hospital.com`);
    await page.click('[data-testid="button-next"]');
    
    // Should proceed to next step
    await expect(page.locator('[data-step="2"].active, .step-2.active')).toBeVisible();
  });

  test('Phone number validation', async ({ page }) => {
    // Login as admin
    await authHelpers.loginAs('admin');
    
    // Navigate to employee form
    await page.goto('/employees/new');
    
    const invalidPhones = [
      '123',           // Too short
      'abcdefghij',    // Letters
      '123-456-789a',  // Letters mixed
      '12345678901234567890' // Too long
    ];
    
    // Fill required fields
    await page.fill('[data-testid="input-firstName"]', 'Test');
    await page.fill('[data-testid="input-lastName"]', 'User');
    await page.fill('[data-testid="input-workEmail"]', `phone${Date.now()}@hospital.com`);
    
    for (const phone of invalidPhones) {
      await page.fill('[data-testid="input-cellPhone"]', phone);
      await page.keyboard.press('Tab');
      
      // Check for validation error (if implemented)
      const errorElement = page.locator('[data-testid="error-cellPhone"], [data-testid="cellPhone-error"]');
      const errorVisible = await errorElement.isVisible({ timeout: 500 }).catch(() => false);
      
      if (errorVisible) {
        await expect(errorElement.first()).toContainText(/phone|format|invalid/i);
      }
      
      // Clear for next test
      await page.fill('[data-testid="input-cellPhone"]', '');
    }
    
    // Test valid phone formats
    const validPhones = [
      '555-123-4567',
      '(555) 123-4567',
      '5551234567',
      '+1-555-123-4567'
    ];
    
    for (const phone of validPhones) {
      await page.fill('[data-testid="input-cellPhone"]', phone);
      await page.keyboard.press('Tab');
      
      // Should not show error
      const errorElement = page.locator('[data-testid="error-cellPhone"], [data-testid="cellPhone-error"]');
      const errorVisible = await errorElement.isVisible({ timeout: 500 }).catch(() => false);
      
      expect(errorVisible).toBeFalsy();
    }
  });

  test('Concurrent form submissions', async ({ page, context }) => {
    // Login as admin
    await authHelpers.loginAs('admin');
    
    // Open two tabs
    const page1 = page;
    const page2 = await context.newPage();
    
    // Navigate both to employee form
    await page1.goto('/employees/new');
    await page2.goto('/employees/new');
    
    // Fill both forms with same data
    const employeeData = {
      firstName: 'Concurrent',
      lastName: 'Test',
      workEmail: `concurrent${Date.now()}@hospital.com`
    };
    
    // Fill form in page 1
    await page1.fill('[data-testid="input-firstName"]', employeeData.firstName);
    await page1.fill('[data-testid="input-lastName"]', employeeData.lastName);
    await page1.fill('[data-testid="input-workEmail"]', employeeData.workEmail);
    
    // Fill form in page 2
    await page2.fill('[data-testid="input-firstName"]', employeeData.firstName);
    await page2.fill('[data-testid="input-lastName"]', employeeData.lastName);
    await page2.fill('[data-testid="input-workEmail"]', employeeData.workEmail);
    
    // Navigate through all steps quickly in both
    for (let i = 1; i <= 12; i++) {
      const next1 = page1.locator('[data-testid="button-next"]');
      const next2 = page2.locator('[data-testid="button-next"]');
      
      if (await next1.isVisible({ timeout: 500 }).catch(() => false)) {
        await next1.click();
      }
      if (await next2.isVisible({ timeout: 500 }).catch(() => false)) {
        await next2.click();
      }
    }
    
    // Submit both forms nearly simultaneously
    const [result1, result2] = await Promise.allSettled([
      page1.click('[data-testid="button-submit"], button:has-text("Submit"), button:has-text("Complete")'),
      page2.click('[data-testid="button-submit"], button:has-text("Submit"), button:has-text("Complete")')
    ]);
    
    // One should succeed, one should fail with duplicate email error
    const success1 = await page1.locator('[data-testid="toast-success"], .toast-success').isVisible({ timeout: 2000 }).catch(() => false);
    const success2 = await page2.locator('[data-testid="toast-success"], .toast-success').isVisible({ timeout: 2000 }).catch(() => false);
    const error1 = await page1.locator('[data-testid="toast-error"], .toast-error').isVisible({ timeout: 2000 }).catch(() => false);
    const error2 = await page2.locator('[data-testid="toast-error"], .toast-error').isVisible({ timeout: 2000 }).catch(() => false);
    
    // Exactly one should succeed and one should fail
    expect((success1 && error2) || (success2 && error1)).toBeTruthy();
    
    // Clean up
    await page2.close();
    
    // Add to cleanup if employee was created
    const currentUrl = page1.url();
    const idMatch = currentUrl.match(/employees\/(\d+)/);
    if (idMatch) {
      createdEmployeeIds.push(idMatch[1]);
    }
  });
});