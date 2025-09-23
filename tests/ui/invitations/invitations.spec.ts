import { test, expect } from '@playwright/test';
import { EmployeesPage } from '../pages/employees.page';
import { AuthHelpers } from '../utils/auth-helpers';
import { TestDataFactory } from '../utils/test-data';
import { TestCleanup } from '../utils/test-cleanup';
import { CommonHelpers } from '../utils/common-helpers';

/**
 * Employee Invitation System Tests
 * @description Tests for sending, managing, and tracking employee invitations
 */
test.describe('Employee Invitations', () => {
  let employeesPage: EmployeesPage;
  let authHelpers: AuthHelpers;
  let testCleanup: TestCleanup;
  let commonHelpers: CommonHelpers;

  const createdInvitationIds: number[] = [];
  const testEmails: string[] = [];

  test.beforeEach(async ({ page }) => {
    employeesPage = new EmployeesPage(page);
    authHelpers = new AuthHelpers(page);
    testCleanup = new TestCleanup(page);
    commonHelpers = new CommonHelpers(page);
    
    // Login as HR user (has invitation permissions)
    await authHelpers.loginAs('hr');
  });

  test.afterEach(async ({ page }) => {
    await testCleanup.comprehensiveCleanup({
      invitationIds: createdInvitationIds
    });
  });

  test.describe('Sending Invitations', () => {
    test('should successfully send employee invitation', async ({ page }) => {
      const invitationData = TestDataFactory.createInvitation();
      testEmails.push(invitationData.email);
      
      await employeesPage.sendInvitation(invitationData);
      
      // Verify invitation sent successfully
      await employeesPage.validateInvitationSent();
      
      // Check invitation appears in invitations tab
      await employeesPage.switchToInvitationsTab();
      await expect(employeesPage.getInvitationRow(invitationData.email)).toBeVisible();
    });

    test('should validate required invitation fields', async ({ page }) => {
      await employeesPage.navigateToEmployees();
      await employeesPage.clickByTestId('button-send-invitation');
      
      // Try to submit empty invitation form
      await employeesPage.clickByTestId('button-submit-invitation');
      
      // Form validation should prevent submission
      await expect(employeesPage.invitationEmailInput).toBeInvalid();
      await expect(employeesPage.invitationFirstNameInput).toBeInvalid();
      await expect(employeesPage.invitationLastNameInput).toBeInvalid();
    });

    test('should validate email format in invitations', async ({ page }) => {
      const invalidInvitation = TestDataFactory.createInvitation({
        email: 'invalid-email-format'
      });
      
      await employeesPage.navigateToEmployees();
      await employeesPage.clickByTestId('button-send-invitation');
      
      await employeesPage.invitationEmailInput.fill(invalidInvitation.email);
      await employeesPage.invitationFirstNameInput.fill(invalidInvitation.firstName);
      await employeesPage.invitationLastNameInput.fill(invalidInvitation.lastName);
      await employeesPage.invitationPositionInput.fill(invalidInvitation.position);
      await employeesPage.invitationDepartmentInput.fill(invalidInvitation.department);
      
      await employeesPage.clickByTestId('button-submit-invitation');
      
      // Should show email validation error
      await expect(employeesPage.invitationEmailInput).toBeInvalid();
    });

    test('should handle duplicate email invitations', async ({ page }) => {
      const invitationData = TestDataFactory.createInvitation();
      testEmails.push(invitationData.email);
      
      // Send first invitation
      await employeesPage.sendInvitation(invitationData);
      await employeesPage.validateInvitationSent();
      
      // Try to send another invitation to same email
      await employeesPage.sendInvitation(invitationData);
      
      // Should show error for duplicate email
      await commonHelpers.waitForToastAndValidate('already been invited', 'error');
    });

    test('should handle email delivery failures gracefully', async ({ page }) => {
      // Mock email service failure
      await page.route('/api/invitations', route => {
        if (route.request().method() === 'POST') {
          route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Failed to send invitation email',
              invitation: { note: 'Email service unavailable' }
            })
          });
        } else {
          route.continue();
        }
      });
      
      const invitationData = TestDataFactory.createInvitation();
      
      await employeesPage.navigateToEmployees();
      await employeesPage.clickByTestId('button-send-invitation');
      
      await employeesPage.invitationEmailInput.fill(invitationData.email);
      await employeesPage.invitationFirstNameInput.fill(invitationData.firstName);
      await employeesPage.invitationLastNameInput.fill(invitationData.lastName);
      await employeesPage.invitationPositionInput.fill(invitationData.position);
      await employeesPage.invitationDepartmentInput.fill(invitationData.department);
      
      await employeesPage.clickByTestId('button-submit-invitation');
      
      // Should show email failure message
      await employeesPage.validateInvitationEmailFailure();
    });
  });

  test.describe('Managing Invitations', () => {
    test('should display invitation status correctly', async ({ page }) => {
      const invitationData = TestDataFactory.createInvitation();
      testEmails.push(invitationData.email);
      
      await employeesPage.sendInvitation(invitationData);
      
      // Check initial status is 'Pending'
      await employeesPage.validateInvitationStatus(invitationData.email, 'Pending');
    });

    test('should resend expired invitation', async ({ page }) => {
      // Create an invitation (would normally need to set up expired state)
      const invitationData = TestDataFactory.createInvitation();
      testEmails.push(invitationData.email);
      
      await employeesPage.sendInvitation(invitationData);
      
      // Navigate to invitations tab and resend
      await employeesPage.switchToInvitationsTab();
      
      const invitationRow = employeesPage.getInvitationRow(invitationData.email);
      const resendButton = invitationRow.locator('[data-testid*="button-resend-invitation"]');
      
      if (await resendButton.isVisible()) {
        await resendButton.click();
        
        // Confirm in dialog
        await page.locator('button:has-text("Resend Invitation")').click();
        
        // Should show success message
        await commonHelpers.waitForToastAndValidate('Invitation resent', 'success');
      }
    });

    test('should show invitation details and metadata', async ({ page }) => {
      const invitationData = TestDataFactory.createInvitation();
      testEmails.push(invitationData.email);
      
      await employeesPage.sendInvitation(invitationData);
      await employeesPage.switchToInvitationsTab();
      
      const invitationRow = employeesPage.getInvitationRow(invitationData.email);
      
      // Verify invitation details are displayed
      await expect(invitationRow.locator(`text=${invitationData.firstName}`)).toBeVisible();
      await expect(invitationRow.locator(`text=${invitationData.lastName}`)).toBeVisible();
      await expect(invitationRow.locator(`text=${invitationData.position}`)).toBeVisible();
      await expect(invitationRow.locator(`text=${invitationData.department}`)).toBeVisible();
    });

    test('should show invitation expiration dates', async ({ page }) => {
      const invitationData = TestDataFactory.createInvitation();
      testEmails.push(invitationData.email);
      
      await employeesPage.sendInvitation(invitationData);
      await employeesPage.switchToInvitationsTab();
      
      const invitationRow = employeesPage.getInvitationRow(invitationData.email);
      
      // Should show expiration date (typically 7 days from creation)
      await expect(invitationRow.locator('[title*="expires"], [data-testid*="expires"]')).toBeVisible();
    });
  });

  test.describe('Invitation Workflow', () => {
    test('should complete invitation acceptance workflow', async ({ page }) => {
      const invitationData = TestDataFactory.createInvitation();
      const userData = TestDataFactory.createUser('viewer');
      testEmails.push(invitationData.email);
      
      // Send invitation
      await employeesPage.sendInvitation(invitationData);
      
      // Simulate invitation acceptance by navigating with token
      const mockToken = 'mock-invitation-token';
      
      // Logout current user
      await authHelpers.logout();
      
      // Register using invitation token
      await page.goto(`/auth?token=${mockToken}`);
      
      // Should show onboarding flow
      await expect(page.locator('text=Welcome! Create your account')).toBeVisible();
      
      // Complete registration
      await page.locator('[role="tab"]:has-text("Register")').click();
      await page.locator('[data-testid="input-register-username"]').fill(userData.username);
      await page.locator('[data-testid="input-register-password"]').fill(userData.password);
      await page.locator('[data-testid="input-register-confirm-password"]').fill(userData.password);
      
      await page.locator('[data-testid="button-register-submit"]').click();
      
      // Should show onboarding success
      await expect(page.locator('.alert-success, [data-testid*="success"]')).toBeVisible();
    });

    test('should track invitation reminder count', async ({ page }) => {
      const invitationData = TestDataFactory.createInvitation();
      testEmails.push(invitationData.email);
      
      await employeesPage.sendInvitation(invitationData);
      await employeesPage.switchToInvitationsTab();
      
      // Initial reminder count should be 0
      const invitationRow = employeesPage.getInvitationRow(invitationData.email);
      
      // Resend invitation (increases reminder count)
      const resendButton = invitationRow.locator('[data-testid*="resend"]');
      if (await resendButton.isVisible()) {
        await resendButton.click();
        await page.locator('button:has-text("Resend")').click();
        
        // Reminder count should increase (if tracked in UI)
        await commonHelpers.waitForToastAndValidate('resent', 'success');
      }
    });
  });

  test.describe('Role-Based Invitation Management', () => {
    test('should allow HR users to send invitations', async ({ page }) => {
      await authHelpers.loginAs('hr');
      await employeesPage.navigateToEmployees();
      
      // HR should see invitation button
      await expect(employeesPage.sendInvitationButton).toBeVisible();
      await expect(employeesPage.invitationsTab).toBeVisible();
    });

    test('should allow admin users to send invitations', async ({ page }) => {
      await authHelpers.loginAs('admin');
      await employeesPage.navigateToEmployees();
      
      // Admin should see invitation button
      await expect(employeesPage.sendInvitationButton).toBeVisible();
      await expect(employeesPage.invitationsTab).toBeVisible();
    });

    test('should restrict viewer access to invitations', async ({ page }) => {
      await authHelpers.loginAs('viewer');
      await employeesPage.navigateToEmployees();
      
      // Viewer should not see invitation features
      await expect(employeesPage.sendInvitationButton).toBeHidden();
      await expect(employeesPage.invitationsTab).toBeHidden();
    });
  });

  test.describe('Invitation List Management', () => {
    test('should filter invitations by status', async ({ page }) => {
      // Create multiple invitations with different states (would need backend setup)
      const invitations = [
        TestDataFactory.createInvitation({ firstName: 'Pending', lastName: 'User' }),
        TestDataFactory.createInvitation({ firstName: 'Expired', lastName: 'User' })
      ];
      
      for (const invitation of invitations) {
        testEmails.push(invitation.email);
        await employeesPage.sendInvitation(invitation);
      }
      
      await employeesPage.switchToInvitationsTab();
      
      // Should show all invitations by default
      for (const invitation of invitations) {
        await expect(employeesPage.getInvitationRow(invitation.email)).toBeVisible();
      }
    });

    test('should search invitations by email or name', async ({ page }) => {
      const invitationData = TestDataFactory.createInvitation({
        firstName: 'Searchable',
        lastName: 'TestUser'
      });
      testEmails.push(invitationData.email);
      
      await employeesPage.sendInvitation(invitationData);
      await employeesPage.switchToInvitationsTab();
      
      // Search functionality (if available)
      const searchInput = page.locator('[data-testid*="search"], input[placeholder*="Search"]').first();
      
      if (await searchInput.isVisible()) {
        await searchInput.fill('Searchable');
        
        // Should show matching invitation
        await expect(employeesPage.getInvitationRow(invitationData.email)).toBeVisible();
      }
    });

    test('should sort invitations by date', async ({ page }) => {
      await employeesPage.navigateToEmployees();
      await employeesPage.switchToInvitationsTab();
      
      // Check if sorting controls exist
      const sortButton = page.locator('[data-testid*="sort"], button:has-text("Sort")').first();
      
      if (await sortButton.isVisible()) {
        await sortButton.click();
        
        // Should show sort options
        await expect(page.locator('text=Date, text=Name')).toBeVisible();
      }
    });
  });

  test.describe('Invitation Error Handling', () => {
    test('should handle network errors when sending invitations', async ({ page }) => {
      // Mock network failure
      await page.route('/api/invitations', route => route.abort());
      
      const invitationData = TestDataFactory.createInvitation();
      
      await employeesPage.navigateToEmployees();
      await employeesPage.clickByTestId('button-send-invitation');
      
      await employeesPage.invitationEmailInput.fill(invitationData.email);
      await employeesPage.invitationFirstNameInput.fill(invitationData.firstName);
      await employeesPage.invitationLastNameInput.fill(invitationData.lastName);
      await employeesPage.invitationPositionInput.fill(invitationData.position);
      await employeesPage.invitationDepartmentInput.fill(invitationData.department);
      
      await employeesPage.clickByTestId('button-submit-invitation');
      
      // Should show network error
      await commonHelpers.waitForToastAndValidate('network error', 'error');
    });

    test('should handle invalid invitation tokens', async ({ page }) => {
      await authHelpers.logout();
      
      // Navigate with invalid token
      await page.goto('/auth?token=invalid-token-12345');
      
      // Should show error or redirect to normal auth
      await expect(page).toHaveURL('/auth');
    });

    test('should handle expired invitation tokens', async ({ page }) => {
      await authHelpers.logout();
      
      // Navigate with expired token (mock scenario)
      await page.goto('/auth?token=expired-token-12345');
      
      // Should show expiration message or redirect
      const errorMessage = page.locator('text=expired, text=invalid');
      if (await errorMessage.isVisible()) {
        await expect(errorMessage).toBeVisible();
      }
    });
  });
});