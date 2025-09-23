import { Page, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Employee Form Page Object Model for employee creation and editing
 * @description Handles multi-step employee form interactions and validation
 */
export class EmployeeFormPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // Navigation and step controls
  get nextButton() { return this.page.locator('[data-testid="button-next"], button:has-text("Next")'); }
  get previousButton() { return this.page.locator('[data-testid="button-previous"], button:has-text("Previous")'); }
  get submitButton() { return this.page.locator('[data-testid="button-submit"], button:has-text("Submit")'); }
  get saveButton() { return this.page.locator('[data-testid="button-save"], button:has-text("Save")'); }

  // Personal Information (Step 1)
  get firstNameInput() { return this.page.locator('[data-testid="input-firstName"]'); }
  get middleNameInput() { return this.page.locator('[data-testid="input-middleName"]'); }
  get lastNameInput() { return this.page.locator('[data-testid="input-lastName"]'); }
  get dateOfBirthInput() { return this.page.locator('[data-testid="input-dateOfBirth"]'); }
  get ssnInput() { return this.page.locator('[data-testid="input-ssn"]'); }
  get phoneInput() { return this.page.locator('[data-testid="input-phone"]'); }
  get emailInput() { return this.page.locator('[data-testid="input-email"]'); }
  get addressInput() { return this.page.locator('[data-testid="input-address"]'); }
  get cityInput() { return this.page.locator('[data-testid="input-city"]'); }
  get stateInput() { return this.page.locator('[data-testid="input-state"]'); }
  get zipCodeInput() { return this.page.locator('[data-testid="input-zipCode"]'); }

  // Professional Information (Step 2)
  get employeeIdInput() { return this.page.locator('[data-testid="input-employeeId"]'); }
  get positionInput() { return this.page.locator('[data-testid="input-position"]'); }
  get departmentInput() { return this.page.locator('[data-testid="input-department"]'); }
  get locationInput() { return this.page.locator('[data-testid="input-location"]'); }
  get hireDateInput() { return this.page.locator('[data-testid="input-hireDate"]'); }
  get salaryInput() { return this.page.locator('[data-testid="input-salary"]'); }
  get statusSelect() { return this.page.locator('[data-testid="select-status"]'); }

  /**
   * Navigate to new employee form
   */
  async navigateToNewEmployeeForm(): Promise<void> {
    await this.goto('/employees/new');
    await this.waitForNavigation('/employees/new');
  }

  /**
   * Navigate to edit employee form
   * @param employeeId - Employee ID to edit
   */
  async navigateToEditEmployeeForm(employeeId: string | number): Promise<void> {
    await this.goto(`/employees/${employeeId}/edit`);
    await this.waitForNavigation(`/employees/${employeeId}/edit`);
  }

  /**
   * Fill personal information step
   * @param personalData - Personal information data
   */
  async fillPersonalInformation(personalData: {
    firstName: string;
    middleName?: string;
    lastName: string;
    dateOfBirth: string;
    ssn: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
  }): Promise<void> {
    await this.firstNameInput.fill(personalData.firstName);
    if (personalData.middleName) {
      await this.middleNameInput.fill(personalData.middleName);
    }
    await this.lastNameInput.fill(personalData.lastName);
    await this.dateOfBirthInput.fill(personalData.dateOfBirth);
    await this.ssnInput.fill(personalData.ssn);
    await this.phoneInput.fill(personalData.phone);
    await this.emailInput.fill(personalData.email);
    await this.addressInput.fill(personalData.address);
    await this.cityInput.fill(personalData.city);
    await this.stateInput.fill(personalData.state);
    await this.zipCodeInput.fill(personalData.zipCode);
  }

  /**
   * Fill professional information step
   * @param professionalData - Professional information data
   */
  async fillProfessionalInformation(professionalData: {
    employeeId: string;
    position: string;
    department: string;
    location: string;
    hireDate: string;
    salary: string;
    status: 'active' | 'inactive' | 'on_leave';
  }): Promise<void> {
    await this.employeeIdInput.fill(professionalData.employeeId);
    await this.positionInput.fill(professionalData.position);
    await this.departmentInput.fill(professionalData.department);
    await this.locationInput.fill(professionalData.location);
    await this.hireDateInput.fill(professionalData.hireDate);
    await this.salaryInput.fill(professionalData.salary);
    await this.statusSelect.selectOption(professionalData.status);
  }

  /**
   * Navigate to next step in multi-step form
   */
  async goToNextStep(): Promise<void> {
    await this.nextButton.click();
    await this.page.waitForTimeout(500); // Allow form transition
  }

  /**
   * Navigate to previous step in multi-step form
   */
  async goToPreviousStep(): Promise<void> {
    await this.previousButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Submit the complete employee form
   */
  async submitForm(): Promise<void> {
    await this.submitButton.click();
    await this.waitForToast('success');
  }

  /**
   * Save the form as draft
   */
  async saveAsDraft(): Promise<void> {
    const saveButton = this.page.locator('button:has-text("Save Draft"), [data-testid*="save-draft"]');
    await saveButton.click();
    await this.waitForToast('success');
  }

  /**
   * Create a complete employee through all form steps
   * @param employeeData - Complete employee data
   */
  async createCompleteEmployee(employeeData: {
    personal: {
      firstName: string;
      middleName?: string;
      lastName: string;
      dateOfBirth: string;
      ssn: string;
      phone: string;
      email: string;
      address: string;
      city: string;
      state: string;
      zipCode: string;
    };
    professional: {
      employeeId: string;
      position: string;
      department: string;
      location: string;
      hireDate: string;
      salary: string;
      status: 'active' | 'inactive' | 'on_leave';
    };
  }): Promise<void> {
    await this.navigateToNewEmployeeForm();
    
    // Step 1: Personal Information
    await this.fillPersonalInformation(employeeData.personal);
    await this.goToNextStep();
    
    // Step 2: Professional Information
    await this.fillProfessionalInformation(employeeData.professional);
    
    // Continue with additional steps if they exist
    // (This would be expanded based on the actual form steps)
    
    await this.submitForm();
    
    // Wait for redirect to employee profile or list
    await this.waitForNavigation(/\/(employees\/\d+|employees)/);
  }

  /**
   * Validate form field errors
   * @param fieldTestId - Test ID of the field with error
   * @param expectedError - Expected error message
   */
  async validateFieldError(fieldTestId: string, expectedError: string): Promise<void> {
    const errorElement = this.page.locator(`[data-testid="${fieldTestId}"] + .error, [data-testid="${fieldTestId}"] ~ .error, .error:near([data-testid="${fieldTestId}"])`);
    await expect(errorElement).toContainText(expectedError);
  }

  /**
   * Validate form submission success
   */
  async validateSubmissionSuccess(): Promise<void> {
    const toast = await this.waitForToast('success');
    await expect(toast).toContainText(/created|updated|saved/i);
  }

  /**
   * Validate required field validation
   * @param requiredFields - Array of required field test IDs
   */
  async validateRequiredFields(requiredFields: string[]): Promise<void> {
    // Clear all required fields and try to submit
    for (const field of requiredFields) {
      await this.page.locator(`[data-testid="${field}"]`).fill('');
    }
    
    await this.submitButton.click();
    
    // Check that form doesn't submit and shows validation errors
    for (const field of requiredFields) {
      await this.validateFieldError(field, /required/i);
    }
  }

  /**
   * Test file upload functionality
   * @param fileInputTestId - Test ID of file input
   * @param filePath - Path to test file
   */
  async uploadFile(fileInputTestId: string, filePath: string): Promise<void> {
    const fileInput = this.page.locator(`[data-testid="${fileInputTestId}"]`);
    await fileInput.setInputFiles(filePath);
    
    // Wait for upload confirmation
    await expect(this.page.locator('.upload-success, [data-testid*="upload-success"]')).toBeVisible({ timeout: 10000 });
  }

  /**
   * Navigate between form steps and validate step indicators
   * @param totalSteps - Total number of steps
   */
  async testStepNavigation(totalSteps: number): Promise<void> {
    // Navigate forward through all steps
    for (let step = 1; step < totalSteps; step++) {
      await this.goToNextStep();
      // Validate step indicator
      await expect(this.page.locator(`.step-${step + 1}.active, [data-step="${step + 1}"].active`)).toBeVisible();
    }
    
    // Navigate backward through all steps
    for (let step = totalSteps - 1; step > 0; step--) {
      await this.goToPreviousStep();
      await expect(this.page.locator(`.step-${step}.active, [data-step="${step}"].active`)).toBeVisible();
    }
  }
}