/**
 * Employee Onboarding Regression Tests
 * @description Tests to ensure existing functionality remains intact after code changes
 */

import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../ui/utils/auth-helpers';
import { CommonHelpers } from '../ui/utils/common-helpers';
import { TestCleanup } from '../ui/utils/test-cleanup';
import {
  generateEmployeeData,
  fillPersonalInfo,
  fillProfessionalInfo,
  fillCredentials,
  cleanupTestEmployees,
  verifyAuditLog
} from '../utils/onboarding-helpers';

test.describe('Employee Onboarding Regression Tests', () => {
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

  test('Old invitation links still work', async ({ page, request }) => {
    // Login as admin
    await authHelpers.loginAs('admin');
    
    // Create an invitation using the standard flow
    const invitationData = {
      firstName: 'Legacy',
      lastName: 'Invitation',
      email: `legacy${Date.now()}@hospital.com`
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
    
    expect(invitation).toBeTruthy();
    const invitationLink = `/register/${invitation.token}`;
    
    // Logout
    await authHelpers.logout();
    
    // Test that the invitation link works
    await page.goto(invitationLink);
    
    // Should load registration page without errors
    await expect(page.locator('[data-testid="input-password"]')).toBeVisible();
    
    // Complete registration
    const password = 'LegacyPass123!';
    await page.fill('[data-testid="input-password"]', password);
    await page.fill('[data-testid="input-confirmPassword"]', password);
    await page.click('[data-testid="button-register"], button:has-text("Register")');
    
    // Should redirect to onboarding
    await page.waitForURL(/\/employees\/new|\/onboarding/);
    
    // Verify can complete onboarding
    const employeeData = generateEmployeeData({
      personalInfo: { workEmail: invitationData.email }
    });
    
    await fillPersonalInfo(page, employeeData.personalInfo);
    await page.click('[data-testid="button-next"]');
    
    // Verify we can navigate through steps
    await expect(page.locator('[data-step="2"].active, .step-2.active')).toBeVisible();
    
    // Store for cleanup
    createdUsernames.push(invitationData.email);
  });

  test('Existing employees can be edited', async ({ page, request }) => {
    // Login as admin
    await authHelpers.loginAs('admin');
    
    // Create an employee first
    await page.goto('/employees/new');
    
    const originalData = {
      firstName: 'Original',
      lastName: 'Employee',
      workEmail: `original${Date.now()}@hospital.com`,
      cellPhone: '555-111-1111'
    };
    
    // Fill minimal data to create employee
    await page.fill('[data-testid="input-firstName"]', originalData.firstName);
    await page.fill('[data-testid="input-lastName"]', originalData.lastName);
    await page.fill('[data-testid="input-workEmail"]', originalData.workEmail);
    await page.fill('[data-testid="input-cellPhone"]', originalData.cellPhone);
    
    // Navigate through all steps
    for (let i = 1; i <= 12; i++) {
      const nextButton = page.locator('[data-testid="button-next"]');
      if (await nextButton.isVisible({ timeout: 500 }).catch(() => false)) {
        await nextButton.click();
      }
    }
    
    // Submit
    await page.click('[data-testid="button-submit"], button:has-text("Submit"), button:has-text("Complete")');
    await page.waitForSelector('[data-testid="toast-success"], .toast-success');
    
    // Get employee ID from URL
    const currentUrl = page.url();
    const idMatch = currentUrl.match(/employees\/(\d+)/);
    const employeeId = idMatch ? idMatch[1] : null;
    
    expect(employeeId).toBeTruthy();
    createdEmployeeIds.push(employeeId!);
    
    // Navigate to edit form
    await page.goto(`/employees/${employeeId}/edit`);
    await page.waitForLoadState('networkidle');
    
    // Edit all fields
    const updatedData = {
      firstName: 'Updated',
      lastName: 'Name',
      cellPhone: '555-999-9999',
      jobTitle: 'Senior Physician',
      workLocation: 'Updated Hospital'
    };
    
    // Clear and update personal info
    await page.fill('[data-testid="input-firstName"]', '');
    await page.fill('[data-testid="input-firstName"]', updatedData.firstName);
    
    await page.fill('[data-testid="input-lastName"]', '');
    await page.fill('[data-testid="input-lastName"]', updatedData.lastName);
    
    await page.fill('[data-testid="input-cellPhone"]', '');
    await page.fill('[data-testid="input-cellPhone"]', updatedData.cellPhone);
    
    // Navigate to professional info step
    await page.click('[data-testid="button-next"]');
    
    // Update professional info
    await page.fill('[data-testid="input-jobTitle"]', updatedData.jobTitle);
    await page.fill('[data-testid="input-workLocation"]', updatedData.workLocation);
    
    // Navigate through remaining steps
    for (let i = 2; i <= 12; i++) {
      const nextButton = page.locator('[data-testid="button-next"]');
      if (await nextButton.isVisible({ timeout: 500 }).catch(() => false)) {
        await nextButton.click();
      }
    }
    
    // Submit changes
    await page.click('[data-testid="button-submit"], button:has-text("Save"), button:has-text("Update")');
    await page.waitForSelector('[data-testid="toast-success"], .toast-success');
    
    // Verify changes were saved
    await page.goto(`/employees/${employeeId}`);
    
    // Check updated fields are displayed
    await expect(page.locator('[data-testid="text-firstName"], [data-testid="employee-firstName"]')).toContainText(updatedData.firstName);
    await expect(page.locator('[data-testid="text-lastName"], [data-testid="employee-lastName"]')).toContainText(updatedData.lastName);
    
    // Verify through API
    const employeesResponse = await request.get('/api/employees');
    const employees = await employeesResponse.json();
    const updatedEmployee = employees.employees?.find((emp: any) => emp.id.toString() === employeeId);
    
    expect(updatedEmployee).toBeTruthy();
    expect(updatedEmployee.firstName).toBe(updatedData.firstName);
    expect(updatedEmployee.lastName).toBe(updatedData.lastName);
  });

  test('Permission model unchanged', async ({ page }) => {
    // Test Admin permissions
    await authHelpers.loginAs('admin');
    
    // Admin should be able to:
    // 1. Create invitations with any role
    await page.goto('/employees');
    await page.click('[data-testid="tab-invitations"], button:has-text("Invitations")');
    await page.click('[data-testid="button-create-invitation"], button:has-text("Create Invitation"), button:has-text("New Invitation")');
    
    const roleSelect = page.locator('[data-testid="select-role"]');
    if (await roleSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
      const options = await roleSelect.locator('option').allTextContents();
      expect(options).toContain('admin');
      expect(options).toContain('hr');
      expect(options).toContain('viewer');
    }
    
    await page.click('[data-testid="button-cancel"], button:has-text("Cancel")');
    
    // 2. Create and edit employees
    await page.click('[data-testid="button-add-employee"], button:has-text("Add Employee"), button:has-text("New Employee")');
    await expect(page).toHaveURL(/\/employees\/new/);
    
    await page.goto('/employees');
    
    // 3. View all data
    await expect(page.locator('[data-testid="employees-table"], table')).toBeVisible();
    
    // Logout and test HR permissions
    await authHelpers.logout();
    await authHelpers.loginAs('hr');
    
    // HR should be able to:
    // 1. Create invitations (viewer role only)
    await page.goto('/employees');
    await page.click('[data-testid="tab-invitations"], button:has-text("Invitations")');
    
    const createInviteButton = page.locator('[data-testid="button-create-invitation"], button:has-text("Create Invitation"), button:has-text("New Invitation")');
    if (await createInviteButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await createInviteButton.click();
      
      const hrRoleSelect = page.locator('[data-testid="select-role"]');
      if (await hrRoleSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
        const hrOptions = await hrRoleSelect.locator('option').allTextContents();
        // HR should only see viewer option
        expect(hrOptions.every(opt => opt.toLowerCase() === 'viewer' || opt === '')).toBeTruthy();
      }
      
      await page.click('[data-testid="button-cancel"], button:has-text("Cancel")');
    }
    
    // 2. Create and edit employees
    const addEmployeeButton = page.locator('[data-testid="button-add-employee"], button:has-text("Add Employee"), button:has-text("New Employee")');
    await expect(addEmployeeButton).toBeVisible();
    
    // Logout and test Viewer permissions
    await authHelpers.logout();
    await authHelpers.loginAs('viewer');
    
    // Viewer should NOT be able to:
    // 1. Create invitations
    await page.goto('/employees');
    
    const invitationsTab = page.locator('[data-testid="tab-invitations"], button:has-text("Invitations")');
    const invitationsVisible = await invitationsTab.isVisible({ timeout: 1000 }).catch(() => false);
    
    if (invitationsVisible) {
      await invitationsTab.click();
      
      // Should not see create invitation button
      const viewerCreateButton = page.locator('[data-testid="button-create-invitation"]');
      const createButtonVisible = await viewerCreateButton.isVisible({ timeout: 1000 }).catch(() => false);
      expect(createButtonVisible).toBeFalsy();
    }
    
    // 2. Should not see Add Employee button
    const viewerAddButton = page.locator('[data-testid="button-add-employee"]');
    const addButtonVisible = await viewerAddButton.isVisible({ timeout: 1000 }).catch(() => false);
    expect(addButtonVisible).toBeFalsy();
    
    // But should be able to view employees
    await expect(page.locator('[data-testid="employees-table"], table')).toBeVisible();
  });

  test('Audit logs created', async ({ page, request }) => {
    // Login as admin
    await authHelpers.loginAs('admin');
    
    // Perform onboarding actions
    const employeeData = {
      firstName: 'Audit',
      lastName: 'Test',
      workEmail: `audit${Date.now()}@hospital.com`
    };
    
    // Create employee
    await page.goto('/employees/new');
    await page.fill('[data-testid="input-firstName"]', employeeData.firstName);
    await page.fill('[data-testid="input-lastName"]', employeeData.lastName);
    await page.fill('[data-testid="input-workEmail"]', employeeData.workEmail);
    
    // Navigate through all steps
    for (let i = 1; i <= 12; i++) {
      const nextButton = page.locator('[data-testid="button-next"]');
      if (await nextButton.isVisible({ timeout: 500 }).catch(() => false)) {
        await nextButton.click();
      }
    }
    
    // Submit
    await page.click('[data-testid="button-submit"], button:has-text("Submit"), button:has-text("Complete")');
    await page.waitForSelector('[data-testid="toast-success"], .toast-success');
    
    // Get employee ID
    const currentUrl = page.url();
    const idMatch = currentUrl.match(/employees\/(\d+)/);
    const employeeId = idMatch ? idMatch[1] : null;
    
    if (employeeId) {
      createdEmployeeIds.push(employeeId);
      
      // Check audit logs via API
      const auditResponse = await request.get(`/api/audits?entityType=employee&entityId=${employeeId}`);
      
      if (auditResponse.status() === 200) {
        const audits = await auditResponse.json();
        
        // Should have CREATE audit entry
        const createAudit = audits.find((audit: any) => 
          audit.action === 'CREATE' && 
          audit.entityType === 'employee' &&
          audit.entityId.toString() === employeeId
        );
        
        expect(createAudit).toBeTruthy();
      }
      
      // Edit the employee to generate UPDATE audit
      await page.goto(`/employees/${employeeId}/edit`);
      await page.fill('[data-testid="input-firstName"]', 'UpdatedAudit');
      
      // Navigate through all steps
      for (let i = 1; i <= 12; i++) {
        const nextButton = page.locator('[data-testid="button-next"]');
        if (await nextButton.isVisible({ timeout: 500 }).catch(() => false)) {
          await nextButton.click();
        }
      }
      
      // Submit update
      await page.click('[data-testid="button-submit"], button:has-text("Save"), button:has-text("Update")');
      await page.waitForSelector('[data-testid="toast-success"], .toast-success');
      
      // Check for UPDATE audit
      const updateAuditResponse = await request.get(`/api/audits?entityType=employee&entityId=${employeeId}`);
      
      if (updateAuditResponse.status() === 200) {
        const updateAudits = await updateAuditResponse.json();
        
        const updateAudit = updateAudits.find((audit: any) => 
          audit.action === 'UPDATE' && 
          audit.entityType === 'employee' &&
          audit.entityId.toString() === employeeId
        );
        
        expect(updateAudit).toBeTruthy();
      }
    }
  });

  test('Email templates render', async ({ page, request }) => {
    // Login as admin
    await authHelpers.loginAs('admin');
    
    // Create invitation to trigger email
    const invitationData = {
      firstName: 'EmailTest',
      lastName: 'User',
      email: `emailtest${Date.now()}@hospital.com`
    };
    
    await page.goto('/employees');
    await page.click('[data-testid="tab-invitations"], button:has-text("Invitations")');
    await page.click('[data-testid="button-create-invitation"], button:has-text("Create Invitation"), button:has-text("New Invitation")');
    
    await page.fill('[data-testid="input-firstName"]', invitationData.firstName);
    await page.fill('[data-testid="input-lastName"]', invitationData.lastName);
    await page.fill('[data-testid="input-email"]', invitationData.email);
    
    // Submit and check for success
    await page.click('[data-testid="button-submit"], button:has-text("Send"), button:has-text("Create")');
    
    // Should show success without email errors
    await page.waitForSelector('[data-testid="toast-success"], .toast-success');
    
    // Check that no email error toast appears
    const errorToast = page.locator('[data-testid="toast-error"], .toast-error');
    const hasEmailError = await errorToast.isVisible({ timeout: 1000 }).catch(() => false);
    
    if (hasEmailError) {
      const errorText = await errorToast.textContent();
      // Should not have email template errors
      expect(errorText).not.toMatch(/template|render|email.*error/i);
    }
    
    // Verify invitation was created successfully
    const invitationsResponse = await request.get('/api/invitations');
    const invitations = await invitationsResponse.json();
    const invitation = invitations.find((inv: any) => inv.email === invitationData.email);
    
    expect(invitation).toBeTruthy();
    expect(invitation.status).toBe('pending');
  });

  test('Form state persistence across sessions', async ({ page, context }) => {
    // Login as admin
    await authHelpers.loginAs('admin');
    
    // Start creating employee
    await page.goto('/employees/new');
    
    const employeeData = generateEmployeeData();
    
    // Fill first 3 steps
    await fillPersonalInfo(page, employeeData.personalInfo);
    await page.click('[data-testid="button-next"]');
    
    await fillProfessionalInfo(page, employeeData.professionalInfo);
    await page.click('[data-testid="button-next"]');
    
    await fillCredentials(page, employeeData.credentials);
    
    // Save draft
    const saveDraftButton = page.locator('[data-testid="button-save-draft"], button:has-text("Save Draft"), button:has-text("Save")');
    if (await saveDraftButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await saveDraftButton.click();
      await page.waitForSelector('[data-testid="toast-success"], .toast-success');
    }
    
    // Get employee ID
    const currentUrl = page.url();
    const idMatch = currentUrl.match(/employees\/(\d+)/);
    const employeeId = idMatch ? idMatch[1] : null;
    
    if (employeeId) {
      createdEmployeeIds.push(employeeId);
      
      // Clear session
      await context.clearCookies();
      
      // Login again
      await page.goto('/login');
      await page.fill('[data-testid="input-username"], [data-testid="input-email"]', 'admin@test.com');
      await page.fill('[data-testid="input-password"]', 'AdminPass123!');
      await page.click('[data-testid="button-login"], button:has-text("Login"), button:has-text("Sign In")');
      
      // Navigate back to the employee form
      await page.goto(`/employees/${employeeId}/edit`);
      
      // Verify data persisted - check first name field
      const firstNameValue = await page.locator('[data-testid="input-firstName"]').inputValue();
      expect(firstNameValue).toBe(employeeData.personalInfo.firstName);
      
      // Verify we're on step 3 where we left off
      await expect(page.locator('[data-step="3"].active, .step-3.active')).toBeVisible();
    }
  });

  test('Backward compatibility of employee data structure', async ({ page, request }) => {
    // Login as admin
    await authHelpers.loginAs('admin');
    
    // Create employee with minimal legacy fields
    const legacyData = {
      firstName: 'Legacy',
      lastName: 'Structure',
      workEmail: `legacy${Date.now()}@hospital.com`
    };
    
    // Create via API to simulate legacy data
    const response = await request.post('/api/employees', {
      data: legacyData
    });
    
    if (response.status() === 201) {
      const employee = await response.json();
      createdEmployeeIds.push(employee.id.toString());
      
      // Try to edit the legacy employee through new form
      await page.goto(`/employees/${employee.id}/edit`);
      
      // Form should load without errors
      await expect(page.locator('[data-testid="input-firstName"]')).toBeVisible();
      
      // Should be able to add new fields
      await page.fill('[data-testid="input-cellPhone"]', '555-444-3333');
      
      // Navigate to professional info
      await page.click('[data-testid="button-next"]');
      await page.fill('[data-testid="input-jobTitle"]', 'Updated Title');
      
      // Navigate through remaining steps
      for (let i = 2; i <= 12; i++) {
        const nextButton = page.locator('[data-testid="button-next"]');
        if (await nextButton.isVisible({ timeout: 500 }).catch(() => false)) {
          await nextButton.click();
        }
      }
      
      // Submit updates
      await page.click('[data-testid="button-submit"], button:has-text("Save"), button:has-text("Update")');
      await page.waitForSelector('[data-testid="toast-success"], .toast-success');
      
      // Verify updates were saved
      const updatedResponse = await request.get(`/api/employees/${employee.id}`);
      const updatedEmployee = await updatedResponse.json();
      
      expect(updatedEmployee.firstName).toBe(legacyData.firstName);
      expect(updatedEmployee.cellPhone).toBeTruthy();
      expect(updatedEmployee.jobTitle).toBe('Updated Title');
    }
  });

  test('Performance: Form loads within acceptable time', async ({ page }) => {
    // Login as admin
    await authHelpers.loginAs('admin');
    
    // Measure form load time
    const startTime = Date.now();
    
    await page.goto('/employees/new');
    await page.waitForSelector('[data-testid="input-firstName"]');
    
    const loadTime = Date.now() - startTime;
    
    // Form should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
    
    // Test navigation between steps performance
    const navigationStartTime = Date.now();
    
    // Navigate through all 12 steps
    for (let i = 1; i <= 12; i++) {
      const nextButton = page.locator('[data-testid="button-next"]');
      if (await nextButton.isVisible({ timeout: 500 }).catch(() => false)) {
        await nextButton.click();
        // Wait for step transition
        await page.waitForTimeout(100);
      }
    }
    
    const navigationTime = Date.now() - navigationStartTime;
    
    // Navigation through all steps should take less than 5 seconds
    expect(navigationTime).toBeLessThan(5000);
  });

  test('Data integrity: Related entities properly linked', async ({ page, request }) => {
    // Login as admin
    await authHelpers.loginAs('admin');
    
    // Create employee with related entities
    await page.goto('/employees/new');
    
    const employeeData = generateEmployeeData();
    
    // Fill personal info
    await fillPersonalInfo(page, employeeData.personalInfo);
    await page.click('[data-testid="button-next"]');
    
    // Fill professional info
    await fillProfessionalInfo(page, employeeData.professionalInfo);
    await page.click('[data-testid="button-next"]');
    
    // Skip to education step (step 5)
    await page.click('[data-testid="button-next"]'); // Step 3
    await page.click('[data-testid="button-next"]'); // Step 4
    
    // Add education
    await page.click('[data-testid="button-add-education"]');
    await page.fill('[data-testid="input-education-institution"]', 'Test University');
    await page.fill('[data-testid="input-education-degree"]', 'MD');
    await page.fill('[data-testid="input-education-fieldOfStudy"]', 'Medicine');
    await page.fill('[data-testid="input-education-graduationDate"]', '2015-05-15');
    await page.fill('[data-testid="input-education-city"]', 'Boston');
    await page.fill('[data-testid="input-education-state"]', 'MA');
    await page.click('[data-testid="button-save-education"]');
    
    // Continue through remaining steps
    for (let i = 5; i <= 12; i++) {
      const nextButton = page.locator('[data-testid="button-next"]');
      if (await nextButton.isVisible({ timeout: 500 }).catch(() => false)) {
        await nextButton.click();
      }
    }
    
    // Submit
    await page.click('[data-testid="button-submit"], button:has-text("Submit"), button:has-text("Complete")');
    await page.waitForSelector('[data-testid="toast-success"], .toast-success');
    
    // Get employee ID
    const currentUrl = page.url();
    const idMatch = currentUrl.match(/employees\/(\d+)/);
    const employeeId = idMatch ? idMatch[1] : null;
    
    if (employeeId) {
      createdEmployeeIds.push(employeeId);
      
      // Verify through API that education is linked to employee
      const educationsResponse = await request.get(`/api/employees/${employeeId}/educations`);
      
      if (educationsResponse.status() === 200) {
        const educations = await educationsResponse.json();
        
        expect(educations).toHaveLength(1);
        expect(educations[0].employeeId.toString()).toBe(employeeId);
        expect(educations[0].institution).toBe('Test University');
        expect(educations[0].degree).toBe('MD');
      }
    }
  });
});