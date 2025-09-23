import { Page, expect, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Documents Page Object Model for document management functionality
 * @description Handles document upload, viewing, organization, and file management
 */
export class DocumentsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // Main page locators
  get documentsTitle() { return this.page.locator('h1:has-text("Documents")'); }
  get uploadButton() { return this.page.locator('[data-testid="button-upload-document"]'); }
  get documentsTable() { return this.page.locator('[data-testid="documents-table"]'); }
  get searchInput() { return this.page.locator('[data-testid="input-document-search"]'); }
  get categoryFilter() { return this.page.locator('[data-testid="select-category-filter"]'); }
  get sortSelect() { return this.page.locator('[data-testid="select-document-sort"]'); }

  // Upload dialog locators
  get fileInput() { return this.page.locator('[data-testid="input-file-upload"]'); }
  get documentNameInput() { return this.page.locator('[data-testid="input-document-name"]'); }
  get documentCategorySelect() { return this.page.locator('[data-testid="select-document-category"]'); }
  get documentDescriptionTextarea() { return this.page.locator('[data-testid="textarea-document-description"]'); }
  get employeeSelect() { return this.page.locator('[data-testid="select-document-employee"]'); }
  get submitUploadButton() { return this.page.locator('[data-testid="button-submit-upload"]'); }

  // File management locators
  get bulkActionsDropdown() { return this.page.locator('[data-testid="dropdown-bulk-actions"]'); }
  get selectAllCheckbox() { return this.page.locator('[data-testid="checkbox-select-all"]'); }

  /**
   * Navigate to documents page
   */
  async navigateToDocuments(): Promise<void> {
    await this.goto('/documents');
    await expect(this.documentsTitle).toBeVisible();
  }

  /**
   * Upload a document
   * @param documentData - Document upload data
   */
  async uploadDocument(documentData: {
    filePath: string;
    name: string;
    category: string;
    description?: string;
    employeeId?: string;
  }): Promise<void> {
    await this.navigateToDocuments();
    await this.clickByTestId('button-upload-document');
    
    // Upload file
    await this.fileInput.setInputFiles(documentData.filePath);
    
    // Fill document details
    await this.documentNameInput.fill(documentData.name);
    await this.documentCategorySelect.selectOption(documentData.category);
    
    if (documentData.description) {
      await this.documentDescriptionTextarea.fill(documentData.description);
    }
    
    if (documentData.employeeId) {
      await this.employeeSelect.selectOption(documentData.employeeId);
    }
    
    await this.clickByTestId('button-submit-upload');
    await this.waitForToast('success');
  }

  /**
   * Search for documents
   * @param searchTerm - Search term
   */
  async searchDocuments(searchTerm: string): Promise<void> {
    await this.navigateToDocuments();
    await this.searchInput.fill(searchTerm);
    await this.page.keyboard.press('Enter');
    await this.waitForLoading();
  }

  /**
   * Filter documents by category
   * @param category - Document category
   */
  async filterByCategory(category: string): Promise<void> {
    await this.navigateToDocuments();
    await this.categoryFilter.selectOption(category);
    await this.waitForLoading();
  }

  /**
   * Sort documents
   * @param sortOption - Sort option (name, date, size, etc.)
   */
  async sortDocuments(sortOption: string): Promise<void> {
    await this.navigateToDocuments();
    await this.sortSelect.selectOption(sortOption);
    await this.waitForLoading();
  }

  /**
   * View document details
   * @param documentName - Name of document to view
   */
  async viewDocumentDetails(documentName: string): Promise<void> {
    await this.navigateToDocuments();
    const documentRow = this.page.locator(`tr:has-text("${documentName}")`);
    const viewButton = documentRow.locator('[data-testid*="view"], button:has-text("View")');
    await viewButton.click();
  }

  /**
   * Download a document
   * @param documentName - Name of document to download
   */
  async downloadDocument(documentName: string): Promise<void> {
    await this.navigateToDocuments();
    const documentRow = this.page.locator(`tr:has-text("${documentName}")`);
    const downloadButton = documentRow.locator('[data-testid*="download"], button:has-text("Download")');
    
    // Start waiting for download before clicking
    const downloadPromise = this.page.waitForEvent('download');
    await downloadButton.click();
    const download = await downloadPromise;
    
    // Validate download started
    expect(download.suggestedFilename()).toBeTruthy();
  }

  /**
   * Delete a document
   * @param documentName - Name of document to delete
   */
  async deleteDocument(documentName: string): Promise<void> {
    await this.navigateToDocuments();
    const documentRow = this.page.locator(`tr:has-text("${documentName}")`);
    const deleteButton = documentRow.locator('[data-testid*="delete"], button:has-text("Delete")');
    
    await deleteButton.click();
    
    // Confirm deletion in modal
    const confirmButton = this.page.locator('button:has-text("Delete"), button:has-text("Confirm")');
    await confirmButton.click();
    
    await this.waitForToast('success');
  }

  /**
   * Select multiple documents for bulk operations
   * @param documentNames - Array of document names to select
   */
  async selectDocuments(documentNames: string[]): Promise<void> {
    await this.navigateToDocuments();
    
    for (const docName of documentNames) {
      const documentRow = this.page.locator(`tr:has-text("${docName}")`);
      const checkbox = documentRow.locator('input[type="checkbox"]');
      await checkbox.check();
    }
  }

  /**
   * Perform bulk delete operation
   * @param documentNames - Array of document names to delete
   */
  async bulkDeleteDocuments(documentNames: string[]): Promise<void> {
    await this.selectDocuments(documentNames);
    await this.bulkActionsDropdown.click();
    await this.page.locator('button:has-text("Delete Selected")').click();
    
    // Confirm bulk deletion
    const confirmButton = this.page.locator('button:has-text("Delete All"), button:has-text("Confirm")');
    await confirmButton.click();
    
    await this.waitForToast('success');
  }

  /**
   * Bulk download documents
   * @param documentNames - Array of document names to download
   */
  async bulkDownloadDocuments(documentNames: string[]): Promise<void> {
    await this.selectDocuments(documentNames);
    await this.bulkActionsDropdown.click();
    
    const downloadPromise = this.page.waitForEvent('download');
    await this.page.locator('button:has-text("Download Selected")').click();
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toContain('.zip');
  }

  /**
   * Select all documents on current page
   */
  async selectAllDocuments(): Promise<void> {
    await this.navigateToDocuments();
    await this.selectAllCheckbox.check();
  }

  /**
   * Validate document upload success
   * @param documentName - Name of uploaded document
   */
  async validateDocumentUploaded(documentName: string): Promise<void> {
    const toast = await this.waitForToast('success');
    await expect(toast).toContainText(/uploaded|created/i);
    
    // Verify document appears in table
    await this.navigateToDocuments();
    const documentRow = this.page.locator(`tr:has-text("${documentName}")`);
    await expect(documentRow).toBeVisible();
  }

  /**
   * Validate document upload failure
   * @param expectedError - Expected error message
   */
  async validateDocumentUploadFailure(expectedError: string): Promise<void> {
    const toast = await this.waitForToast('error');
    await expect(toast).toContainText(expectedError);
  }

  /**
   * Get document row by name
   * @param documentName - Document name
   */
  getDocumentRow(documentName: string): Locator {
    return this.page.locator(`tr:has-text("${documentName}")`);
  }

  /**
   * Validate document details
   * @param documentName - Document name
   * @param expectedDetails - Expected document details
   */
  async validateDocumentDetails(documentName: string, expectedDetails: {
    category?: string;
    size?: string;
    uploadDate?: string;
    employee?: string;
  }): Promise<void> {
    await this.navigateToDocuments();
    const documentRow = this.getDocumentRow(documentName);
    
    if (expectedDetails.category) {
      await expect(documentRow.locator(`text=${expectedDetails.category}`)).toBeVisible();
    }
    
    if (expectedDetails.employee) {
      await expect(documentRow.locator(`text=${expectedDetails.employee}`)).toBeVisible();
    }
  }

  /**
   * Test file upload with different file types
   * @param filePaths - Array of file paths with different extensions
   */
  async testFileTypeUploads(filePaths: { path: string; shouldSucceed: boolean }[]): Promise<void> {
    for (const file of filePaths) {
      await this.navigateToDocuments();
      await this.clickByTestId('button-upload-document');
      
      await this.fileInput.setInputFiles(file.path);
      await this.documentNameInput.fill(`Test ${file.path.split('/').pop()}`);
      await this.documentCategorySelect.selectOption('Other');
      
      await this.clickByTestId('button-submit-upload');
      
      if (file.shouldSucceed) {
        await this.waitForToast('success');
      } else {
        await this.waitForToast('error');
      }
    }
  }

  /**
   * Test document permissions based on user role
   * @param userRole - User role to test with
   */
  async validateDocumentPermissions(userRole: 'admin' | 'hr' | 'viewer'): Promise<void> {
    await this.navigateToDocuments();
    
    if (userRole === 'viewer') {
      // Viewers should not be able to upload or delete
      await expect(this.uploadButton).toBeHidden();
      await expect(this.page.locator('[data-testid*="delete"]')).toHaveCount(0);
    } else if (userRole === 'hr') {
      // HR should be able to upload but with limited delete permissions
      await expect(this.uploadButton).toBeVisible();
    } else {
      // Admin should have full permissions
      await expect(this.uploadButton).toBeVisible();
      await expect(this.bulkActionsDropdown).toBeVisible();
    }
  }
}