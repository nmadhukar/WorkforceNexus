/**
 * Employee Onboarding E2E Tests
 * @description Comprehensive end-to-end tests for the complete employee onboarding flow
 */

import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../utils/auth-helpers';
import { CommonHelpers } from '../utils/common-helpers';
import { TestCleanup } from '../utils/test-cleanup';
import {
  generateEmployeeData,
  createInvitation,
  fillPersonalInfo,
  fillProfessionalInfo,
  fillCredentials,
  fillAdditionalInfo,
  fillEducationEmployment,
  fillLicenses,
  fillCertifications,
  fillReferencesContacts,
  fillTaxDocumentation,
  fillTrainingPayer,
  fillIncidentLogs,
  fillFormsDocuments,
  completeFullOnboarding,
  cleanupTestEmployees,
  saveDraftAtStep,
  resumeDraftFromStep,
  verifyInvitationInDatabase,
  getEmployeeByEmail,
  verifyAuditLog
} from '../../utils/onboarding-helpers';

test.describe('Employee Onboarding Flow', () => {
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

  test('Admin creates invitation and employee completes onboarding', async ({ page, request }) => {
    // Step 1: Admin logs in
    await authHelpers.loginAs('admin');
    
    // Step 2: Navigate to employees page
    await page.goto('/employees');
    await page.waitForLoadState('networkidle');
    
    // Step 3: Create invitation
    const invitationData = {
      firstName: 'NewHire',
      lastName: 'Employee',
      email: `newhire${Date.now()}@hospital.com`,
      role: 'viewer'
    };
    
    await page.click('[data-testid="tab-invitations"], button:has-text("Invitations")');
    await page.click('[data-testid="button-create-invitation"], button:has-text("Create Invitation"), button:has-text("New Invitation")');
    
    // Fill invitation form
    await page.fill('[data-testid="input-firstName"]', invitationData.firstName);
    await page.fill('[data-testid="input-lastName"]', invitationData.lastName);
    await page.fill('[data-testid="input-email"]', invitationData.email);
    
    // Submit invitation
    await page.click('[data-testid="button-submit"], button:has-text("Send"), button:has-text("Create")');
    await page.waitForSelector('[data-testid="toast-success"], .toast-success');
    
    // Step 4: Get invitation token from API
    const invitationsResponse = await request.get('/api/invitations');
    const invitations = await invitationsResponse.json();
    const invitation = invitations.find((inv: any) => inv.email === invitationData.email);
    expect(invitation).toBeTruthy();
    
    const invitationToken = invitation.token;
    const invitationLink = `/register/${invitationToken}`;
    
    // Step 5: Logout admin
    await authHelpers.logout();
    
    // Step 6: Navigate to invitation link
    await page.goto(invitationLink);
    await page.waitForLoadState('networkidle');
    
    // Step 7: Complete registration
    const password = 'SecurePass123!';
    await page.fill('[data-testid="input-password"]', password);
    await page.fill('[data-testid="input-confirmPassword"]', password);
    await page.click('[data-testid="button-register"], button:has-text("Register")');
    
    // Should redirect to onboarding form
    await page.waitForURL(/\/employees\/new|\/onboarding/);
    
    // Step 8: Fill all 12 steps of the form with valid data
    const employeeData = generateEmployeeData({
      personalInfo: { workEmail: invitationData.email }
    });
    
    // Step 1: Personal Information
    await fillPersonalInfo(page, employeeData.personalInfo);
    await page.click('[data-testid="button-next"]');
    
    // Step 2: Professional Information
    await fillProfessionalInfo(page, employeeData.professionalInfo);
    await page.click('[data-testid="button-next"]');
    
    // Step 3: Credentials
    await fillCredentials(page, employeeData.credentials);
    await page.click('[data-testid="button-next"]');
    
    // Step 4: Additional Information (CAQH)
    await fillAdditionalInfo(page, employeeData.additionalInfo);
    await page.click('[data-testid="button-next"]');
    
    // Step 5: Education & Employment History
    await fillEducationEmployment(page, employeeData.educationEmployment);
    await page.click('[data-testid="button-next"]');
    
    // Step 6: State Licenses & DEA Licenses
    await fillLicenses(page, employeeData.licenses);
    await page.click('[data-testid="button-next"]');
    
    // Step 7: Board Certifications
    await fillCertifications(page, employeeData.certifications);
    await page.click('[data-testid="button-next"]');
    
    // Step 8: References & Emergency Contacts
    await fillReferencesContacts(page, employeeData.referencesContacts);
    await page.click('[data-testid="button-next"]');
    
    // Step 9: Tax Documentation
    await fillTaxDocumentation(page, employeeData.taxDocumentation);
    await page.click('[data-testid="button-next"]');
    
    // Step 10: Training & Payer Enrollment
    await fillTrainingPayer(page, employeeData.trainingPayer);
    await page.click('[data-testid="button-next"]');
    
    // Step 11: Incident Logs (usually empty for new employees)
    await fillIncidentLogs(page, employeeData.incidentLogs);
    await page.click('[data-testid="button-next"]');
    
    // Step 12: Forms & Documents (skip for now, no files to upload)
    await fillFormsDocuments(page, employeeData.formsDocuments);
    
    // Step 13: Review & Submit
    await page.click('[data-testid="button-submit"], button:has-text("Submit"), button:has-text("Complete Onboarding")');
    
    // Step 9: Verify employee created
    await page.waitForSelector('[data-testid="toast-success"], .toast-success');
    
    // Should redirect to employee profile or list
    await page.waitForURL(/\/employees/);
    
    // Verify employee exists in the system
    const employeeResponse = await request.get('/api/employees');
    const employees = await employeeResponse.json();
    const createdEmployee = employees.employees?.find((emp: any) => 
      emp.workEmail === invitationData.email
    );
    
    expect(createdEmployee).toBeTruthy();
    expect(createdEmployee.firstName).toBe(employeeData.personalInfo.firstName);
    expect(createdEmployee.lastName).toBe(employeeData.personalInfo.lastName);
    
    // Store for cleanup
    if (createdEmployee?.id) {
      createdEmployeeIds.push(createdEmployee.id);
    }
  });

  test('HR user can only invite viewer role', async ({ page, request }) => {
    // Login as HR user
    await authHelpers.loginAs('hr');
    
    // Navigate to employees page
    await page.goto('/employees');
    await page.waitForLoadState('networkidle');
    
    // Go to invitations tab
    await page.click('[data-testid="tab-invitations"], button:has-text("Invitations")');
    await page.click('[data-testid="button-create-invitation"], button:has-text("Create Invitation"), button:has-text("New Invitation")');
    
    // Fill invitation form
    const invitationData = {
      firstName: 'HRInvite',
      lastName: 'Employee',
      email: `hrinvite${Date.now()}@hospital.com`
    };
    
    await page.fill('[data-testid="input-firstName"]', invitationData.firstName);
    await page.fill('[data-testid="input-lastName"]', invitationData.lastName);
    await page.fill('[data-testid="input-email"]', invitationData.email);
    
    // Check role selector - HR should only be able to select viewer
    const roleSelect = page.locator('[data-testid="select-role"]');
    
    // Check if role select exists and is visible
    if (await roleSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
      const options = await roleSelect.locator('option').allTextContents();
      
      // HR users should only see viewer option or have it pre-selected
      expect(options.every(opt => opt.toLowerCase() === 'viewer' || opt === '')).toBeTruthy();
    }
    
    // Submit invitation
    await page.click('[data-testid="button-submit"], button:has-text("Send"), button:has-text("Create")');
    await page.waitForSelector('[data-testid="toast-success"], .toast-success');
    
    // Verify invitation created with correct role
    const invitationsResponse = await request.get('/api/invitations');
    const invitations = await invitationsResponse.json();
    const invitation = invitations.find((inv: any) => inv.email === invitationData.email);
    
    expect(invitation).toBeTruthy();
    expect(invitation.role).toBe('viewer');
  });

  test('Employee can resume interrupted onboarding', async ({ page, context }) => {
    // Start with admin creating an invitation
    await authHelpers.loginAs('admin');
    
    const invitationData = {
      firstName: 'Resume',
      lastName: 'Test',
      email: `resume${Date.now()}@hospital.com`,
      role: 'viewer'
    };
    
    // Create invitation through UI
    await page.goto('/employees');
    await page.click('[data-testid="tab-invitations"], button:has-text("Invitations")');
    await page.click('[data-testid="button-create-invitation"], button:has-text("Create Invitation"), button:has-text("New Invitation")');
    
    await page.fill('[data-testid="input-firstName"]', invitationData.firstName);
    await page.fill('[data-testid="input-lastName"]', invitationData.lastName);
    await page.fill('[data-testid="input-email"]', invitationData.email);
    await page.click('[data-testid="button-submit"], button:has-text("Send"), button:has-text("Create")');
    await page.waitForSelector('[data-testid="toast-success"], .toast-success');
    
    // Get invitation token
    const response = await page.request.get('/api/invitations');
    const invitations = await response.json();
    const invitation = invitations.find((inv: any) => inv.email === invitationData.email);
    const invitationLink = `/register/${invitation.token}`;
    
    // Logout admin
    await authHelpers.logout();
    
    // Register as new employee
    await page.goto(invitationLink);
    const password = 'SecurePass123!';
    await page.fill('[data-testid="input-password"]', password);
    await page.fill('[data-testid="input-confirmPassword"]', password);
    await page.click('[data-testid="button-register"], button:has-text("Register")');
    
    await page.waitForURL(/\/employees\/new|\/onboarding/);
    
    // Start onboarding and complete steps 1-5
    const employeeData = generateEmployeeData({
      personalInfo: { workEmail: invitationData.email }
    });
    
    // Step 1: Personal Information
    await fillPersonalInfo(page, employeeData.personalInfo);
    await page.click('[data-testid="button-next"]');
    
    // Step 2: Professional Information
    await fillProfessionalInfo(page, employeeData.professionalInfo);
    await page.click('[data-testid="button-next"]');
    
    // Step 3: Credentials
    await fillCredentials(page, employeeData.credentials);
    await page.click('[data-testid="button-next"]');
    
    // Step 4: Additional Information
    await fillAdditionalInfo(page, employeeData.additionalInfo);
    await page.click('[data-testid="button-next"]');
    
    // Step 5: Education & Employment
    await fillEducationEmployment(page, employeeData.educationEmployment);
    
    // Save draft at step 5
    const saveDraftButton = page.locator('[data-testid="button-save-draft"], button:has-text("Save Draft"), button:has-text("Save")');
    if (await saveDraftButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await saveDraftButton.click();
      await page.waitForSelector('[data-testid="toast-success"], .toast-success');
    }
    
    // Get employee ID for later
    const employeeUrl = page.url();
    const employeeIdMatch = employeeUrl.match(/employees\/(\d+)/);
    const employeeId = employeeIdMatch ? employeeIdMatch[1] : null;
    
    // Simulate closing browser (logout)
    await authHelpers.logout();
    
    // Clear cookies to simulate new session
    await context.clearCookies();
    
    // Login again with same credentials
    await page.goto('/login');
    await page.fill('[data-testid="input-username"], [data-testid="input-email"]', invitationData.email);
    await page.fill('[data-testid="input-password"]', password);
    await page.click('[data-testid="button-login"], button:has-text("Login"), button:has-text("Sign In")');
    
    // Navigate back to employee form
    if (employeeId) {
      await page.goto(`/employees/${employeeId}/edit`);
    } else {
      await page.goto('/employees/new');
    }
    
    // Verify we're on step 6 (or at least past step 5)
    const currentStep = await page.locator('[data-step].active, .step-indicator.active').getAttribute('data-step');
    const stepNumber = currentStep ? parseInt(currentStep) : 0;
    
    // We should be at step 6 or later
    expect(stepNumber).toBeGreaterThanOrEqual(5);
    
    // Complete remaining steps starting from step 6
    // If not already on step 6, navigate to it
    if (stepNumber < 6) {
      await page.click('[data-testid="button-next"]');
    }
    
    // Step 6: Licenses
    await fillLicenses(page, employeeData.licenses);
    await page.click('[data-testid="button-next"]');
    
    // Step 7: Certifications
    await fillCertifications(page, employeeData.certifications);
    await page.click('[data-testid="button-next"]');
    
    // Step 8: References & Contacts
    await fillReferencesContacts(page, employeeData.referencesContacts);
    await page.click('[data-testid="button-next"]');
    
    // Step 9: Tax Documentation
    await fillTaxDocumentation(page, employeeData.taxDocumentation);
    await page.click('[data-testid="button-next"]');
    
    // Step 10: Training & Payer
    await fillTrainingPayer(page, employeeData.trainingPayer);
    await page.click('[data-testid="button-next"]');
    
    // Step 11: Incident Logs
    await fillIncidentLogs(page, employeeData.incidentLogs);
    await page.click('[data-testid="button-next"]');
    
    // Step 12: Forms & Documents
    await fillFormsDocuments(page, employeeData.formsDocuments);
    
    // Submit the form
    await page.click('[data-testid="button-submit"], button:has-text("Submit"), button:has-text("Complete")');
    
    // Verify completion
    await page.waitForSelector('[data-testid="toast-success"], .toast-success');
    await page.waitForURL(/\/employees/);
    
    // Store for cleanup
    if (employeeId) {
      createdEmployeeIds.push(employeeId);
    }
  });

  test('Verify all 12 form steps', async ({ page }) => {
    // Login as admin to create employee
    await authHelpers.loginAs('admin');
    
    // Navigate to new employee form
    await page.goto('/employees/new');
    await page.waitForLoadState('networkidle');
    
    const employeeData = generateEmployeeData();
    
    // Test Step 1: Personal Information
    await fillPersonalInfo(page, employeeData.personalInfo);
    
    // Verify step 1 is active
    await expect(page.locator('[data-step="1"].active, .step-1.active')).toBeVisible();
    
    // Test navigation to next step
    await page.click('[data-testid="button-next"]');
    
    // Test Step 2: Professional Information
    await expect(page.locator('[data-step="2"].active, .step-2.active')).toBeVisible();
    await fillProfessionalInfo(page, employeeData.professionalInfo);
    
    // Test navigation back
    await page.click('[data-testid="button-previous"], button:has-text("Previous"), button:has-text("Back")');
    await expect(page.locator('[data-step="1"].active, .step-1.active')).toBeVisible();
    
    // Go forward again
    await page.click('[data-testid="button-next"]');
    await page.click('[data-testid="button-next"]');
    
    // Test Step 3: Credentials
    await expect(page.locator('[data-step="3"].active, .step-3.active')).toBeVisible();
    await fillCredentials(page, employeeData.credentials);
    
    // Test save draft on step 3
    const saveDraftButton = page.locator('[data-testid="button-save-draft"], button:has-text("Save Draft"), button:has-text("Save")');
    if (await saveDraftButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await saveDraftButton.click();
      await page.waitForSelector('[data-testid="toast-success"], .toast-success');
    }
    
    await page.click('[data-testid="button-next"]');
    
    // Test Step 4: Additional Information
    await expect(page.locator('[data-step="4"].active, .step-4.active')).toBeVisible();
    await fillAdditionalInfo(page, employeeData.additionalInfo);
    await page.click('[data-testid="button-next"]');
    
    // Test Step 5: Education & Employment
    await expect(page.locator('[data-step="5"].active, .step-5.active')).toBeVisible();
    await fillEducationEmployment(page, employeeData.educationEmployment);
    await page.click('[data-testid="button-next"]');
    
    // Test Step 6: Licenses
    await expect(page.locator('[data-step="6"].active, .step-6.active')).toBeVisible();
    await fillLicenses(page, employeeData.licenses);
    await page.click('[data-testid="button-next"]');
    
    // Test Step 7: Certifications
    await expect(page.locator('[data-step="7"].active, .step-7.active')).toBeVisible();
    await fillCertifications(page, employeeData.certifications);
    await page.click('[data-testid="button-next"]');
    
    // Test Step 8: References & Contacts
    await expect(page.locator('[data-step="8"].active, .step-8.active')).toBeVisible();
    await fillReferencesContacts(page, employeeData.referencesContacts);
    await page.click('[data-testid="button-next"]');
    
    // Test Step 9: Tax Documentation
    await expect(page.locator('[data-step="9"].active, .step-9.active')).toBeVisible();
    await fillTaxDocumentation(page, employeeData.taxDocumentation);
    
    // Test save draft on step 9
    if (await saveDraftButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await saveDraftButton.click();
      await page.waitForSelector('[data-testid="toast-success"], .toast-success');
    }
    
    await page.click('[data-testid="button-next"]');
    
    // Test Step 10: Training & Payer
    await expect(page.locator('[data-step="10"].active, .step-10.active')).toBeVisible();
    await fillTrainingPayer(page, employeeData.trainingPayer);
    await page.click('[data-testid="button-next"]');
    
    // Test Step 11: Incident Logs
    await expect(page.locator('[data-step="11"].active, .step-11.active')).toBeVisible();
    await fillIncidentLogs(page, employeeData.incidentLogs);
    await page.click('[data-testid="button-next"]');
    
    // Test Step 12: Forms & Documents
    await expect(page.locator('[data-step="12"].active, .step-12.active')).toBeVisible();
    await fillFormsDocuments(page, employeeData.formsDocuments);
    
    // Verify can navigate back through all steps
    for (let i = 11; i > 0; i--) {
      await page.click('[data-testid="button-previous"], button:has-text("Previous"), button:has-text("Back")');
      await expect(page.locator(`[data-step="${i}"].active, .step-${i}.active`)).toBeVisible();
    }
    
    // Navigate forward to the end
    for (let i = 1; i <= 12; i++) {
      await page.click('[data-testid="button-next"]');
    }
    
    // Submit the form
    await page.click('[data-testid="button-submit"], button:has-text("Submit"), button:has-text("Complete")');
    
    // Verify success
    await page.waitForSelector('[data-testid="toast-success"], .toast-success');
    
    // Get the created employee ID for cleanup
    const currentUrl = page.url();
    const idMatch = currentUrl.match(/employees\/(\d+)/);
    if (idMatch) {
      createdEmployeeIds.push(idMatch[1]);
    }
  });

  test('Test save draft functionality at each step', async ({ page }) => {
    // Login as admin
    await authHelpers.loginAs('admin');
    
    // Navigate to new employee form
    await page.goto('/employees/new');
    await page.waitForLoadState('networkidle');
    
    const employeeData = generateEmployeeData();
    const saveDraftButton = page.locator('[data-testid="button-save-draft"], button:has-text("Save Draft"), button:has-text("Save")');
    
    // Fill and save at step 1
    await fillPersonalInfo(page, employeeData.personalInfo);
    if (await saveDraftButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await saveDraftButton.click();
      await page.waitForSelector('[data-testid="toast-success"], .toast-success');
    }
    
    // Get employee ID after first save
    const currentUrl = page.url();
    const idMatch = currentUrl.match(/employees\/(\d+)/);
    const employeeId = idMatch ? idMatch[1] : null;
    
    if (employeeId) {
      createdEmployeeIds.push(employeeId);
      
      // Test saving at various steps
      const stepsToTest = [2, 5, 8, 11];
      
      for (const stepNumber of stepsToTest) {
        // Navigate to the step
        for (let i = 1; i < stepNumber; i++) {
          await page.click('[data-testid="button-next"]');
        }
        
        // Fill the step based on step number
        switch (stepNumber) {
          case 2:
            await fillProfessionalInfo(page, employeeData.professionalInfo);
            break;
          case 5:
            await fillEducationEmployment(page, employeeData.educationEmployment);
            break;
          case 8:
            await fillReferencesContacts(page, employeeData.referencesContacts);
            break;
          case 11:
            await fillIncidentLogs(page, employeeData.incidentLogs);
            break;
        }
        
        // Save draft
        if (await saveDraftButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await saveDraftButton.click();
          await page.waitForSelector('[data-testid="toast-success"], .toast-success');
        }
        
        // Verify we're still on the same step
        await expect(page.locator(`[data-step="${stepNumber}"].active, .step-${stepNumber}.active`)).toBeVisible();
        
        // Navigate away and back to verify draft is saved
        await page.goto('/employees');
        await page.goto(`/employees/${employeeId}/edit`);
        
        // Should be on the same step
        await expect(page.locator(`[data-step="${stepNumber}"].active, .step-${stepNumber}.active`)).toBeVisible();
      }
    }
  });

  test('Complete onboarding with minimal required fields', async ({ page }) => {
    // Login as admin
    await authHelpers.loginAs('admin');
    
    // Navigate to new employee form
    await page.goto('/employees/new');
    await page.waitForLoadState('networkidle');
    
    const minimalData = {
      firstName: `MinTest${Date.now()}`,
      lastName: 'Employee',
      workEmail: `minimal${Date.now()}@hospital.com`
    };
    
    // Fill only required fields in step 1
    await page.fill('[data-testid="input-firstName"]', minimalData.firstName);
    await page.fill('[data-testid="input-lastName"]', minimalData.lastName);
    await page.fill('[data-testid="input-workEmail"]', minimalData.workEmail);
    
    // Navigate through all steps with minimal data
    for (let i = 1; i <= 12; i++) {
      const nextButton = page.locator('[data-testid="button-next"]');
      if (await nextButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await nextButton.click();
        await page.waitForTimeout(500); // Allow for step transition
      }
    }
    
    // Submit the form
    await page.click('[data-testid="button-submit"], button:has-text("Submit"), button:has-text("Complete")');
    
    // Verify success
    await page.waitForSelector('[data-testid="toast-success"], .toast-success');
    
    // Get the created employee ID for cleanup
    const currentUrl = page.url();
    const idMatch = currentUrl.match(/employees\/(\d+)/);
    if (idMatch) {
      createdEmployeeIds.push(idMatch[1]);
    }
  });
});