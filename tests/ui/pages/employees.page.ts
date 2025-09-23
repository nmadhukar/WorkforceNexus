import { Page, expect, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Employees Page Object Model for employee management functionality
 * @description Handles employee listing, creation, editing, and invitation management
 */
export class EmployeesPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // Main page locators
  get employeesTitle() { return this.page.locator('[data-testid="text-employees-title"]'); }
  get addEmployeeButton() { return this.page.locator('[data-testid="button-add-employee"]'); }
  get sendInvitationButton() { return this.page.locator('[data-testid="button-send-invitation"]'); }
  get searchFilters() { return this.page.locator('[data-testid="search-filters"]'); }
  get employeesTable() { return this.page.locator('[data-testid="employees-table"]'); }
  get activeEmployeesTab() { return this.page.locator('[data-testid="tab-active-employees"]'); }
  get invitationsTab() { return this.page.locator('[data-testid="tab-invitations"]'); }

  // Invitation dialog locators
  get invitationEmailInput() { return this.page.locator('[data-testid="input-invitation-email"]'); }
  get invitationFirstNameInput() { return this.page.locator('[data-testid="input-invitation-firstName"]'); }
  get invitationLastNameInput() { return this.page.locator('[data-testid="input-invitation-lastName"]'); }
  get invitationPositionInput() { return this.page.locator('[data-testid="input-invitation-position"]'); }
  get invitationDepartmentInput() { return this.page.locator('[data-testid="input-invitation-department"]'); }
  get submitInvitationButton() { return this.page.locator('[data-testid="button-submit-invitation"]'); }

  /**
   * Navigate to employees page
   */
  async navigateToEmployees(): Promise<void> {
    await this.goto('/employees');
    await this.expectVisible('text-employees-title');
  }

  /**
   * Navigate to new employee form
   */
  async navigateToAddEmployee(): Promise<void> {
    await this.navigateToEmployees();
    await this.clickByTestId('button-add-employee');
    await this.waitForNavigation('/employees/new');
  }

  /**
   * Send an employee invitation
   * @param invitationData - Invitation details
   */
  async sendInvitation(invitationData: {
    email: string;
    firstName: string;
    lastName: string;
    position: string;
    department: string;
  }): Promise<void> {
    await this.navigateToEmployees();
    await this.clickByTestId('button-send-invitation');
    
    await this.invitationEmailInput.fill(invitationData.email);
    await this.invitationFirstNameInput.fill(invitationData.firstName);
    await this.invitationLastNameInput.fill(invitationData.lastName);
    await this.invitationPositionInput.fill(invitationData.position);
    await this.invitationDepartmentInput.fill(invitationData.department);
    
    await this.clickByTestId('button-submit-invitation');
    await this.waitForToast('success');
  }

  /**
   * Switch to invitations tab
   */
  async switchToInvitationsTab(): Promise<void> {
    await this.navigateToEmployees();
    await this.clickByTestId('tab-invitations');
  }

  /**
   * Resend an invitation by ID
   * @param invitationId - The invitation ID
   */
  async resendInvitation(invitationId: number): Promise<void> {
    await this.switchToInvitationsTab();
    await this.clickByTestId(`button-resend-invitation-${invitationId}`);
    
    // Confirm in dialog
    await this.page.locator('text=Resend Invitation').click();
    await this.waitForToast('success');
  }

  /**
   * Search for employees
   * @param searchTerm - The search term
   */
  async searchEmployees(searchTerm: string): Promise<void> {
    await this.navigateToEmployees();
    const searchInput = this.page.locator('[data-testid*="search"], input[placeholder*="Search"]').first();
    await searchInput.fill(searchTerm);
  }

  /**
   * Filter employees by department
   * @param department - Department name
   */
  async filterByDepartment(department: string): Promise<void> {
    await this.navigateToEmployees();
    const departmentFilter = this.page.locator('select[data-testid*="department"], [data-testid*="department"] select').first();
    await departmentFilter.selectOption(department);
  }

  /**
   * Filter employees by status
   * @param status - Employee status
   */
  async filterByStatus(status: string): Promise<void> {
    await this.navigateToEmployees();
    const statusFilter = this.page.locator('select[data-testid*="status"], [data-testid*="status"] select').first();
    await statusFilter.selectOption(status);
  }

  /**
   * Click on an employee row to view details
   * @param employeeId - Employee ID or name
   */
  async viewEmployeeDetails(employeeId: string | number): Promise<void> {
    await this.navigateToEmployees();
    const employeeRow = this.page.locator(`[data-testid*="row-employee-${employeeId}"], tr:has-text("${employeeId}")`).first();
    await employeeRow.click();
  }

  /**
   * Edit an employee
   * @param employeeId - Employee ID
   */
  async editEmployee(employeeId: string | number): Promise<void> {
    await this.navigateToEmployees();
    const editButton = this.page.locator(`[data-testid*="button-edit-employee-${employeeId}"], [data-testid*="edit"]:near(text="${employeeId}")`).first();
    await editButton.click();
  }

  /**
   * Validate employees table is loaded
   */
  async validateEmployeesTableLoaded(): Promise<void> {
    await this.expectVisible('employees-table');
    await this.waitForLoading();
  }

  /**
   * Validate invitation was sent successfully
   */
  async validateInvitationSent(): Promise<void> {
    const toast = await this.waitForToast('success');
    await expect(toast).toContainText('Invitation created and email sent successfully');
  }

  /**
   * Validate invitation email failure
   */
  async validateInvitationEmailFailure(): Promise<void> {
    const toast = await this.waitForToast('error');
    await expect(toast).toContainText('Email Delivery Failed');
  }

  /**
   * Get invitation row by email
   * @param email - Invitation email
   */
  getInvitationRow(email: string): Locator {
    return this.page.locator(`tr:has-text("${email}")`);
  }

  /**
   * Validate invitation status
   * @param email - Invitation email
   * @param expectedStatus - Expected status
   */
  async validateInvitationStatus(email: string, expectedStatus: 'Pending' | 'Registered' | 'Approved' | 'Expired'): Promise<void> {
    await this.switchToInvitationsTab();
    const invitationRow = this.getInvitationRow(email);
    await expect(invitationRow.locator(`text=${expectedStatus}`)).toBeVisible();
  }

  /**
   * Navigate to employee pagination
   * @param page - Page number
   */
  async goToPage(page: number): Promise<void> {
    const pageButton = this.page.locator(`button:has-text("${page}")`);
    await pageButton.click();
    await this.waitForLoading();
  }

  /**
   * Validate employee count
   * @param expectedCount - Expected number of employees
   */
  async validateEmployeeCount(expectedCount: number): Promise<void> {
    await this.validateEmployeesTableLoaded();
    const employeeRows = this.page.locator('tbody tr');
    await expect(employeeRows).toHaveCount(expectedCount);
  }
}