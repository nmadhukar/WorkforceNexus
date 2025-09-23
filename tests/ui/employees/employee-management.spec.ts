import { test, expect } from '@playwright/test';
import { EmployeesPage } from '../pages/employees.page';
import { EmployeeFormPage } from '../pages/employee-form.page';
import { AuthHelpers } from '../utils/auth-helpers';
import { TestDataFactory } from '../utils/test-data';
import { TestCleanup } from '../utils/test-cleanup';
import { CommonHelpers } from '../utils/common-helpers';

/**
 * Employee Management Tests
 * @description Comprehensive tests for employee CRUD operations, forms, and management features
 */
test.describe('Employee Management', () => {
  let employeesPage: EmployeesPage;
  let employeeFormPage: EmployeeFormPage;
  let authHelpers: AuthHelpers;
  let testCleanup: TestCleanup;
  let commonHelpers: CommonHelpers;

  // Store created test data for cleanup
  const createdEmployeeIds: string[] = [];
  const createdUsernames: string[] = [];

  test.beforeEach(async ({ page }) => {
    employeesPage = new EmployeesPage(page);
    employeeFormPage = new EmployeeFormPage(page);
    authHelpers = new AuthHelpers(page);
    testCleanup = new TestCleanup(page);
    commonHelpers = new CommonHelpers(page);
    
    // Login as HR user for most tests
    await authHelpers.loginAs('hr');
  });

  test.afterEach(async ({ page }) => {
    // Clean up test data
    await testCleanup.comprehensiveCleanup({
      employeeIds: createdEmployeeIds,
      usernames: createdUsernames
    });
  });

  test.describe('Employee List and Navigation', () => {
    test('should load and display employees list', async ({ page }) => {
      await employeesPage.navigateToEmployees();
      
      // Verify page elements are visible
      await employeesPage.expectVisible('text-employees-title');
      await employeesPage.expectVisible('button-add-employee');
      await employeesPage.expectVisible('employees-table');
      
      // Verify table loads with data
      await employeesPage.validateEmployeesTableLoaded();
    });

    test('should navigate to add employee form', async ({ page }) => {
      await employeesPage.navigateToAddEmployee();
      
      // Should be on the new employee form page
      await expect(page).toHaveURL('/employees/new');
    });

    test('should search employees by name', async ({ page }) => {
      await employeesPage.searchEmployees('John');
      
      // Wait for search results to load
      await employeesPage.validateEmployeesTableLoaded();
      
      // Results should contain the search term (if any employees exist)
      const tableRows = page.locator('tbody tr');
      const rowCount = await tableRows.count();
      
      if (rowCount > 0) {
        const firstRowText = await tableRows.first().textContent();
        expect(firstRowText?.toLowerCase()).toContain('john');
      }
    });

    test('should filter employees by department', async ({ page }) => {
      await employeesPage.filterByDepartment('Emergency Medicine');
      await employeesPage.validateEmployeesTableLoaded();
      
      // Verify filter is applied
      const departmentFilter = page.locator('select[data-testid*="department"]').first();
      await expect(departmentFilter).toHaveValue('Emergency Medicine');
    });

    test('should filter employees by status', async ({ page }) => {
      await employeesPage.filterByStatus('active');
      await employeesPage.validateEmployeesTableLoaded();
      
      // Verify filter is applied
      const statusFilter = page.locator('select[data-testid*="status"]').first();
      await expect(statusFilter).toHaveValue('active');
    });

    test('should navigate through pagination', async ({ page }) => {
      await employeesPage.navigateToEmployees();
      await employeesPage.validateEmployeesTableLoaded();
      
      // Check if pagination exists (might not if there are few employees)
      const paginationButton = page.locator('button:has-text("2")');
      
      if (await paginationButton.isVisible()) {
        await employeesPage.goToPage(2);
        await employeesPage.validateEmployeesTableLoaded();
      }
    });
  });

  test.describe('Employee Creation', () => {
    test('should create new employee with complete information', async ({ page }) => {
      const employeeData = {
        personal: TestDataFactory.createEmployee(),
        professional: {
          employeeId: `EMP${Date.now()}`,
          position: 'Test Physician',
          department: 'Emergency Medicine',
          location: 'Main Hospital',
          hireDate: '2024-01-01',
          salary: '150000',
          status: 'active' as const
        }
      };
      
      await employeeFormPage.createCompleteEmployee(employeeData);
      
      // Store employee ID for cleanup
      createdEmployeeIds.push(employeeData.professional.employeeId);
      
      // Verify creation success
      await employeeFormPage.validateSubmissionSuccess();
      
      // Should redirect to employee profile or list
      await expect(page).toHaveURL(/\/(employees\/\d+|employees)/);
    });

    test('should validate required fields', async ({ page }) => {
      await employeeFormPage.navigateToNewEmployeeForm();
      
      // Try to submit empty form
      const requiredFields = [
        'input-firstName',
        'input-lastName',
        'input-email',
        'input-phone',
        'input-position',
        'input-department'
      ];
      
      await employeeFormPage.validateRequiredFields(requiredFields);
    });

    test('should handle multi-step form navigation', async ({ page }) => {
      await employeeFormPage.navigateToNewEmployeeForm();
      
      // Test step navigation (assuming the form has multiple steps)
      await employeeFormPage.testStepNavigation(3); // Adjust based on actual steps
    });

    test('should validate email format', async ({ page }) => {
      const employeeData = TestDataFactory.createEmployee({
        email: 'invalid-email'
      });
      
      await employeeFormPage.navigateToNewEmployeeForm();
      await employeeFormPage.fillPersonalInformation(employeeData);
      
      // Try to proceed to next step
      await employeeFormPage.goToNextStep();
      
      // Should show email validation error
      await employeeFormPage.validateFieldError('input-email', 'valid email');
    });

    test('should validate phone number format', async ({ page }) => {
      const employeeData = TestDataFactory.createEmployee({
        phone: '123' // Invalid phone
      });
      
      await employeeFormPage.navigateToNewEmployeeForm();
      await employeeFormPage.fillPersonalInformation(employeeData);
      
      await employeeFormPage.goToNextStep();
      
      // Should show phone validation error
      await employeeFormPage.validateFieldError('input-phone', 'valid phone');
    });

    test('should save form as draft', async ({ page }) => {
      const employeeData = TestDataFactory.createEmployee();
      
      await employeeFormPage.navigateToNewEmployeeForm();
      await employeeFormPage.fillPersonalInformation(employeeData);
      
      // Save as draft
      await employeeFormPage.saveAsDraft();
      
      // Should show draft saved message
      await commonHelpers.waitForToastAndValidate('saved as draft', 'success');
    });
  });

  test.describe('Employee Editing', () => {
    test('should edit existing employee', async ({ page }) => {
      // First create an employee to edit
      const originalData = {
        personal: TestDataFactory.createEmployee(),
        professional: {
          employeeId: `EMP${Date.now()}`,
          position: 'Original Position',
          department: 'Emergency Medicine',
          location: 'Main Hospital',
          hireDate: '2024-01-01',
          salary: '150000',
          status: 'active' as const
        }
      };
      
      await employeeFormPage.createCompleteEmployee(originalData);
      createdEmployeeIds.push(originalData.professional.employeeId);
      
      // Navigate back to employees list
      await employeesPage.navigateToEmployees();
      
      // Edit the employee
      await employeesPage.editEmployee(originalData.professional.employeeId);
      
      // Update position
      await employeeFormPage.positionInput.fill('Updated Position');
      await employeeFormPage.submitForm();
      
      // Verify update success
      await employeeFormPage.validateSubmissionSuccess();
    });

    test('should preserve data when navigating between form steps during edit', async ({ page }) => {
      const employeeData = TestDataFactory.createEmployee();
      
      await employeeFormPage.navigateToNewEmployeeForm();
      await employeeFormPage.fillPersonalInformation(employeeData);
      await employeeFormPage.goToNextStep();
      
      // Go back to previous step
      await employeeFormPage.goToPreviousStep();
      
      // Verify data is preserved
      await expect(employeeFormPage.firstNameInput).toHaveValue(employeeData.firstName);
      await expect(employeeFormPage.lastNameInput).toHaveValue(employeeData.lastName);
    });
  });

  test.describe('Employee Profile and Details', () => {
    test('should view employee profile details', async ({ page }) => {
      // Navigate to employees list and view first employee
      await employeesPage.navigateToEmployees();
      await employeesPage.validateEmployeesTableLoaded();
      
      const firstEmployeeRow = page.locator('tbody tr').first();
      if (await firstEmployeeRow.isVisible()) {
        await firstEmployeeRow.click();
        
        // Should navigate to employee profile
        await expect(page).toHaveURL(/\/employees\/\d+/);
      }
    });

    test('should display employee information correctly', async ({ page }) => {
      // This would require creating a test employee first
      const employeeData = TestDataFactory.createEmployee();
      const testEmployeeId = `EMP${Date.now()}`;
      
      // Create employee through API or form first
      await employeeFormPage.createCompleteEmployee({
        personal: employeeData,
        professional: {
          employeeId: testEmployeeId,
          position: 'Test Position',
          department: 'Test Department',
          location: 'Test Location',
          hireDate: '2024-01-01',
          salary: '100000',
          status: 'active'
        }
      });
      
      createdEmployeeIds.push(testEmployeeId);
      
      // Navigate to profile and verify information is displayed
      await page.goto(`/employees/${testEmployeeId}`);
      
      await expect(page.locator(`text=${employeeData.firstName}`)).toBeVisible();
      await expect(page.locator(`text=${employeeData.lastName}`)).toBeVisible();
      await expect(page.locator(`text=${employeeData.email}`)).toBeVisible();
    });
  });

  test.describe('Bulk Operations', () => {
    test('should handle bulk employee operations', async ({ page }) => {
      await employeesPage.navigateToEmployees();
      await employeesPage.validateEmployeesTableLoaded();
      
      // Check if bulk operations are available
      const bulkCheckbox = page.locator('[data-testid*="select-all"]').first();
      
      if (await bulkCheckbox.isVisible()) {
        await bulkCheckbox.check();
        
        // Verify bulk actions become available
        const bulkActions = page.locator('[data-testid*="bulk-actions"]');
        await expect(bulkActions).toBeVisible();
      }
    });
  });

  test.describe('Role-Based Access Control', () => {
    test('should allow HR users to manage employees', async ({ page }) => {
      await authHelpers.loginAs('hr');
      await employeesPage.navigateToEmployees();
      
      // HR should see add employee button
      await expect(employeesPage.addEmployeeButton).toBeVisible();
      await expect(employeesPage.sendInvitationButton).toBeVisible();
    });

    test('should restrict viewer access to read-only', async ({ page }) => {
      await authHelpers.loginAs('viewer');
      await employeesPage.navigateToEmployees();
      
      // Viewer should not see add/edit buttons
      const addButton = employeesPage.addEmployeeButton;
      if (await addButton.isVisible()) {
        await expect(addButton).toBeDisabled();
      }
    });

    test('should allow admin full access to employee management', async ({ page }) => {
      await authHelpers.loginAs('admin');
      await employeesPage.navigateToEmployees();
      
      // Admin should have full access
      await expect(employeesPage.addEmployeeButton).toBeVisible();
      await expect(employeesPage.sendInvitationButton).toBeVisible();
      
      // Should be able to access all employee management features
      await employeesPage.navigateToAddEmployee();
      await expect(page).toHaveURL('/employees/new');
    });
  });

  test.describe('Data Validation and Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Simulate network failure
      await page.route('/api/employees', route => route.abort());
      
      await employeesPage.navigateToEmployees();
      
      // Should show error message or loading state
      const errorMessage = page.locator('text=Failed to load employees');
      await expect(errorMessage).toBeVisible({ timeout: 10000 });
    });

    test('should validate SSN format', async ({ page }) => {
      const invalidSSN = '123-45-67890'; // Too many digits
      const employeeData = TestDataFactory.createEmployee({ ssn: invalidSSN });
      
      await employeeFormPage.navigateToNewEmployeeForm();
      await employeeFormPage.fillPersonalInformation(employeeData);
      
      await employeeFormPage.goToNextStep();
      
      // Should show SSN validation error
      await employeeFormPage.validateFieldError('input-ssn', 'valid SSN');
    });

    test('should prevent duplicate employee IDs', async ({ page }) => {
      const duplicateId = `DUP${Date.now()}`;
      
      // Create first employee
      await employeeFormPage.createCompleteEmployee({
        personal: TestDataFactory.createEmployee(),
        professional: {
          employeeId: duplicateId,
          position: 'First Employee',
          department: 'Test Dept',
          location: 'Test Location',
          hireDate: '2024-01-01',
          salary: '100000',
          status: 'active'
        }
      });
      
      createdEmployeeIds.push(duplicateId);
      
      // Try to create another employee with same ID
      await employeeFormPage.navigateToNewEmployeeForm();
      
      const secondEmployeeData = {
        personal: TestDataFactory.createEmployee(),
        professional: {
          employeeId: duplicateId, // Same ID
          position: 'Second Employee',
          department: 'Test Dept',
          location: 'Test Location',
          hireDate: '2024-01-01',
          salary: '100000',
          status: 'active' as const
        }
      };
      
      await employeeFormPage.fillPersonalInformation(secondEmployeeData.personal);
      await employeeFormPage.goToNextStep();
      await employeeFormPage.fillProfessionalInformation(secondEmployeeData.professional);
      await employeeFormPage.submitForm();
      
      // Should show duplicate ID error
      await commonHelpers.waitForToastAndValidate('Employee ID already exists', 'error');
    });
  });
});