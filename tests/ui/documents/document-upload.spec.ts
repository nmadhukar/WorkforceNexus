/**
 * Document Upload E2E Tests
 * @description Comprehensive end-to-end tests for document upload functionality
 */

import { test, expect } from '@playwright/test';
import { DocumentsPage } from '../pages/documents.page';
import { EmployeesPage } from '../pages/employees.page';
import { AuthHelpers } from '../utils/auth-helpers';
import { TestDataFactory } from '../utils/test-data';
import { TestCleanup } from '../utils/test-cleanup';
import {
  generateTestFile,
  uploadDocument,
  verifyDocumentInList,
  downloadAndVerify,
  cleanupTestDocuments,
  uploadMultipleFiles,
  checkS3StorageStatus,
  configureS3Storage,
  generateVariousTestFiles,
  cleanupTempFiles
} from '../../utils/document-helpers';
import path from 'path';

test.describe('Document Upload E2E Tests', () => {
  let documentsPage: DocumentsPage;
  let employeesPage: EmployeesPage;
  let authHelpers: AuthHelpers;
  let testCleanup: TestCleanup;
  const uploadedDocumentIds: string[] = [];
  const tempFiles: Array<{ cleanup: () => void }> = [];

  test.beforeEach(async ({ page }) => {
    documentsPage = new DocumentsPage(page);
    employeesPage = new EmployeesPage(page);
    authHelpers = new AuthHelpers(page);
    testCleanup = new TestCleanup(page);
  });

  test.afterEach(async () => {
    // Clean up uploaded documents
    await cleanupTestDocuments(uploadedDocumentIds);
    uploadedDocumentIds.length = 0;
    
    // Clean up temp files
    tempFiles.forEach(file => file.cleanup());
    tempFiles.length = 0;
    cleanupTempFiles();
  });

  test('Admin uploads employee document', async ({ page }) => {
    // Login as admin
    await authHelpers.loginAs('admin');
    
    // Create test employee
    const employeeData = TestDataFactory.createEmployee();
    await employeesPage.navigateToEmployees();
    await employeesPage.createEmployee(employeeData);
    
    // Navigate to employee profile
    await employeesPage.viewEmployeeDetails(`${employeeData.firstName} ${employeeData.lastName}`);
    
    // Click Documents tab
    await page.click('[data-testid="tab-documents"]');
    
    // Generate and upload PDF document
    const pdfFile = generateTestFile('pdf', 1024 * 500); // 500KB PDF
    tempFiles.push(pdfFile);
    
    await page.click('[data-testid="button-upload-document"]');
    await page.locator('[data-testid="input-file-upload"]').setInputFiles(pdfFile.path);
    await page.fill('[data-testid="input-document-name"]', 'Medical License');
    await page.selectOption('[data-testid="select-document-category"]', 'License');
    await page.fill('[data-testid="textarea-document-description"]', 'Primary medical license for state practice');
    await page.click('[data-testid="button-submit-upload"]');
    
    // Verify document appears in list
    await expect(page.locator('text=Medical License')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=License')).toBeVisible();
    await expect(page.locator('text=500 KB').or(page.locator('text=0.5 MB'))).toBeVisible();
    
    // Download document and verify content
    const downloadPath = await downloadAndVerify(page, 'Medical License');
    expect(downloadPath).toBeTruthy();
    
    // Delete document
    await documentsPage.deleteDocument('Medical License');
    
    // Verify document removed from list
    await expect(page.locator('text=Medical License')).not.toBeVisible();
  });

  test('Multiple file upload', async ({ page }) => {
    // Login as HR user
    await authHelpers.loginAs('hr');
    
    // Navigate to documents page
    await documentsPage.navigateToDocuments();
    
    // Generate multiple test files
    const files = [];
    for (let i = 0; i < 3; i++) {
      const file = generateTestFile(['pdf', 'jpg', 'docx'][i], 1024 * (100 + i * 50));
      tempFiles.push(file);
      files.push(file.path);
    }
    
    // Upload all files simultaneously
    const results = await uploadMultipleFiles(page, files);
    
    // Verify all files appear in list
    for (const result of results) {
      expect(result.success).toBeTruthy();
      await expect(page.locator(`text=${result.fileName}`)).toBeVisible();
    }
    
    // Verify file sizes and types
    await expect(page.locator('text=100 KB').or(page.locator('text=0.1 MB'))).toBeVisible();
    await expect(page.locator('text=150 KB').or(page.locator('text=0.15 MB'))).toBeVisible();
    await expect(page.locator('text=200 KB').or(page.locator('text=0.2 MB'))).toBeVisible();
    
    // Verify file type icons or labels
    await expect(page.locator('[data-testid*="pdf"]').or(page.locator('text=PDF'))).toBeVisible();
    await expect(page.locator('[data-testid*="jpg"]').or(page.locator('text=JPG'))).toBeVisible();
    await expect(page.locator('[data-testid*="docx"]').or(page.locator('text=DOCX'))).toBeVisible();
  });

  test('Document categorization', async ({ page }) => {
    // Login as admin
    await authHelpers.loginAs('admin');
    
    // Navigate to documents page
    await documentsPage.navigateToDocuments();
    
    // Generate test file
    const testFile = generateTestFile('pdf', 1024 * 200);
    tempFiles.push(testFile);
    
    // Upload document with category selection
    await page.click('[data-testid="button-upload-document"]');
    await page.locator('[data-testid="input-file-upload"]').setInputFiles(testFile.path);
    await page.fill('[data-testid="input-document-name"]', 'Board Certification');
    await page.selectOption('[data-testid="select-document-category"]', 'Certificate');
    await page.click('[data-testid="button-submit-upload"]');
    
    // Wait for upload to complete
    await expect(page.locator('text=Board Certification')).toBeVisible({ timeout: 10000 });
    
    // Verify category saved correctly
    const documentRow = page.locator('tr:has-text("Board Certification")');
    await expect(documentRow.locator('text=Certificate')).toBeVisible();
    
    // Filter documents by category
    await page.selectOption('[data-testid="select-category-filter"]', 'Certificate');
    await page.waitForTimeout(500);
    
    // Verify filtered results
    await expect(page.locator('text=Board Certification')).toBeVisible();
    
    // Change document category
    await documentRow.locator('[data-testid*="edit"]').click();
    await page.selectOption('[data-testid="select-edit-category"]', 'License');
    await page.click('[data-testid="button-save-category"]');
    
    // Verify category updated
    await expect(documentRow.locator('text=License')).toBeVisible({ timeout: 5000 });
  });

  test('Document search and filtering', async ({ page }) => {
    // Login as HR user
    await authHelpers.loginAs('hr');
    
    // Navigate to documents page
    await documentsPage.navigateToDocuments();
    
    // Upload multiple documents with different names and types
    const testDocuments = [
      { name: 'Medical License 2024', type: 'pdf', category: 'License' },
      { name: 'DEA Registration', type: 'pdf', category: 'License' },
      { name: 'Board Certification', type: 'docx', category: 'Certificate' },
      { name: 'Employee ID Photo', type: 'jpg', category: 'ID Card' },
      { name: 'Training Certificate', type: 'pdf', category: 'Certificate' }
    ];
    
    for (const doc of testDocuments) {
      const file = generateTestFile(doc.type, 1024 * 100);
      tempFiles.push(file);
      
      await page.click('[data-testid="button-upload-document"]');
      await page.locator('[data-testid="input-file-upload"]').setInputFiles(file.path);
      await page.fill('[data-testid="input-document-name"]', doc.name);
      await page.selectOption('[data-testid="select-document-category"]', doc.category);
      await page.click('[data-testid="button-submit-upload"]');
      await page.waitForTimeout(500);
    }
    
    // Search by document name
    await page.fill('[data-testid="input-document-search"]', 'Medical');
    await page.press('[data-testid="input-document-search"]', 'Enter');
    await page.waitForTimeout(500);
    await expect(page.locator('text=Medical License 2024')).toBeVisible();
    await expect(page.locator('text=DEA Registration')).not.toBeVisible();
    
    // Clear search
    await page.fill('[data-testid="input-document-search"]', '');
    await page.press('[data-testid="input-document-search"]', 'Enter');
    await page.waitForTimeout(500);
    
    // Filter by file type
    await page.selectOption('[data-testid="select-type-filter"]', 'pdf');
    await page.waitForTimeout(500);
    await expect(page.locator('text=Medical License 2024')).toBeVisible();
    await expect(page.locator('text=DEA Registration')).toBeVisible();
    await expect(page.locator('text=Training Certificate')).toBeVisible();
    await expect(page.locator('text=Board Certification')).not.toBeVisible();
    await expect(page.locator('text=Employee ID Photo')).not.toBeVisible();
    
    // Clear type filter
    await page.selectOption('[data-testid="select-type-filter"]', '');
    
    // Sort by different columns
    // Sort by name ascending
    await page.click('[data-testid="sort-name"]');
    await page.waitForTimeout(500);
    const firstRowNameAsc = await page.locator('tbody tr:first-child td:nth-child(2)').textContent();
    expect(firstRowNameAsc).toContain('Board Certification');
    
    // Sort by name descending
    await page.click('[data-testid="sort-name"]');
    await page.waitForTimeout(500);
    const firstRowNameDesc = await page.locator('tbody tr:first-child td:nth-child(2)').textContent();
    expect(firstRowNameDesc).toContain('Training Certificate');
    
    // Sort by date (most recent first)
    await page.click('[data-testid="sort-date"]');
    await page.waitForTimeout(500);
    const firstRowDate = await page.locator('tbody tr:first-child td:nth-child(2)').textContent();
    expect(firstRowDate).toContain('Training Certificate'); // Last uploaded
  });

  test('S3 storage integration', async ({ page }) => {
    // Login as admin
    await authHelpers.loginAs('admin');
    
    // Check current S3 status
    const initialStatus = await checkS3StorageStatus(page);
    
    // If S3 not configured, configure it for testing
    if (!initialStatus.configured) {
      await configureS3Storage(page, {
        accessKey: 'TEST_ACCESS_KEY',
        secretKey: 'TEST_SECRET_KEY',
        region: 'us-east-1',
        bucket: 'test-bucket'
      });
    }
    
    // Navigate to documents page
    await documentsPage.navigateToDocuments();
    
    // Upload document when S3 configured
    const testFile = generateTestFile('pdf', 1024 * 300);
    tempFiles.push(testFile);
    
    await page.click('[data-testid="button-upload-document"]');
    await page.locator('[data-testid="input-file-upload"]').setInputFiles(testFile.path);
    await page.fill('[data-testid="input-document-name"]', 'S3 Test Document');
    await page.selectOption('[data-testid="select-document-category"]', 'Other');
    await page.click('[data-testid="button-submit-upload"]');
    
    // Wait for upload to complete
    await expect(page.locator('text=S3 Test Document')).toBeVisible({ timeout: 10000 });
    
    // Verify S3 storage used (check for S3 indicator or storage type in document details)
    const documentRow = page.locator('tr:has-text("S3 Test Document")');
    await documentRow.locator('[data-testid*="view"]').click();
    
    // Check document details modal for storage type
    const modalContent = await page.locator('[role="dialog"]').textContent();
    
    if (initialStatus.configured) {
      // If S3 was configured, verify it's using S3
      expect(modalContent).toContain('S3');
    }
    
    // Test presigned URL generation (download should work)
    await page.click('[data-testid="button-close-modal"]');
    const downloadPath = await downloadAndVerify(page, 'S3 Test Document');
    expect(downloadPath).toBeTruthy();
    
    // Test fallback to local storage (simulate S3 failure)
    // This would typically be done by disabling S3 in settings
    if (initialStatus.configured) {
      // Navigate to settings to disable S3
      await page.goto('/settings');
      await page.click('text=S3 Storage');
      await page.click('[data-testid="toggle-s3-enabled"]');
      await page.click('[data-testid="button-save-s3-config"]');
      
      // Upload another document
      await documentsPage.navigateToDocuments();
      const localFile = generateTestFile('pdf', 1024 * 200);
      tempFiles.push(localFile);
      
      await page.click('[data-testid="button-upload-document"]');
      await page.locator('[data-testid="input-file-upload"]').setInputFiles(localFile.path);
      await page.fill('[data-testid="input-document-name"]', 'Local Storage Document');
      await page.selectOption('[data-testid="select-document-category"]', 'Other');
      await page.click('[data-testid="button-submit-upload"]');
      
      // Verify document uploaded successfully with local storage
      await expect(page.locator('text=Local Storage Document')).toBeVisible({ timeout: 10000 });
      
      // Re-enable S3 if it was originally enabled
      await page.goto('/settings');
      await page.click('text=S3 Storage');
      await page.click('[data-testid="toggle-s3-enabled"]');
      await page.click('[data-testid="button-save-s3-config"]');
    }
  });

  test('Document upload with employee association', async ({ page }) => {
    // Login as HR user
    await authHelpers.loginAs('hr');
    
    // Create test employees
    const employee1 = TestDataFactory.createEmployee({ firstName: 'John', lastName: 'Smith' });
    const employee2 = TestDataFactory.createEmployee({ firstName: 'Jane', lastName: 'Doe' });
    
    await employeesPage.navigateToEmployees();
    await employeesPage.createEmployee(employee1);
    await employeesPage.createEmployee(employee2);
    
    // Navigate to documents page
    await documentsPage.navigateToDocuments();
    
    // Upload document for specific employee
    const testFile = generateTestFile('pdf', 1024 * 150);
    tempFiles.push(testFile);
    
    await page.click('[data-testid="button-upload-document"]');
    await page.locator('[data-testid="input-file-upload"]').setInputFiles(testFile.path);
    await page.fill('[data-testid="input-document-name"]', 'Employee Contract');
    await page.selectOption('[data-testid="select-document-category"]', 'Other');
    
    // Select employee from dropdown
    await page.selectOption('[data-testid="select-document-employee"]', { label: 'John Smith' });
    await page.click('[data-testid="button-submit-upload"]');
    
    // Verify document appears with employee association
    await expect(page.locator('text=Employee Contract')).toBeVisible({ timeout: 10000 });
    const documentRow = page.locator('tr:has-text("Employee Contract")');
    await expect(documentRow.locator('text=John Smith')).toBeVisible();
    
    // Filter by employee
    await page.selectOption('[data-testid="select-employee-filter"]', { label: 'John Smith' });
    await page.waitForTimeout(500);
    await expect(page.locator('text=Employee Contract')).toBeVisible();
    
    // Change filter to different employee
    await page.selectOption('[data-testid="select-employee-filter"]', { label: 'Jane Doe' });
    await page.waitForTimeout(500);
    await expect(page.locator('text=Employee Contract')).not.toBeVisible();
  });

  test('Document versioning and replacement', async ({ page }) => {
    // Login as admin
    await authHelpers.loginAs('admin');
    
    // Navigate to documents page
    await documentsPage.navigateToDocuments();
    
    // Upload initial version
    const version1 = generateTestFile('pdf', 1024 * 100);
    tempFiles.push(version1);
    
    await page.click('[data-testid="button-upload-document"]');
    await page.locator('[data-testid="input-file-upload"]').setInputFiles(version1.path);
    await page.fill('[data-testid="input-document-name"]', 'Policy Document');
    await page.selectOption('[data-testid="select-document-category"]', 'Other');
    await page.click('[data-testid="button-submit-upload"]');
    
    // Wait for upload
    await expect(page.locator('text=Policy Document')).toBeVisible({ timeout: 10000 });
    
    // Upload new version (replace existing)
    const documentRow = page.locator('tr:has-text("Policy Document")');
    await documentRow.locator('[data-testid*="replace"]').click();
    
    const version2 = generateTestFile('pdf', 1024 * 150);
    tempFiles.push(version2);
    
    await page.locator('[data-testid="input-file-replace"]').setInputFiles(version2.path);
    await page.click('[data-testid="button-confirm-replace"]');
    
    // Verify document updated
    await expect(page.locator('text=Policy Document')).toBeVisible();
    await expect(documentRow.locator('text=150 KB').or(documentRow.locator('text=0.15 MB'))).toBeVisible({ timeout: 5000 });
  });

  test('Bulk document operations', async ({ page }) => {
    // Login as admin
    await authHelpers.loginAs('admin');
    
    // Navigate to documents page
    await documentsPage.navigateToDocuments();
    
    // Upload multiple documents
    const documents = [];
    for (let i = 0; i < 5; i++) {
      const file = generateTestFile('pdf', 1024 * (100 + i * 10));
      tempFiles.push(file);
      documents.push({
        file: file.path,
        name: `Document ${i + 1}`
      });
      
      await page.click('[data-testid="button-upload-document"]');
      await page.locator('[data-testid="input-file-upload"]').setInputFiles(file.path);
      await page.fill('[data-testid="input-document-name"]', `Document ${i + 1}`);
      await page.selectOption('[data-testid="select-document-category"]', 'Other');
      await page.click('[data-testid="button-submit-upload"]');
      await page.waitForTimeout(500);
    }
    
    // Select multiple documents
    await page.click('[data-testid="checkbox-select-all"]');
    
    // Verify all checkboxes checked
    const checkboxes = page.locator('tbody input[type="checkbox"]');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      await expect(checkboxes.nth(i)).toBeChecked();
    }
    
    // Perform bulk download
    await page.click('[data-testid="dropdown-bulk-actions"]');
    const downloadPromise = page.waitForEvent('download');
    await page.click('text=Download Selected');
    const download = await downloadPromise;
    
    // Verify download is a zip file
    expect(download.suggestedFilename()).toContain('.zip');
    
    // Deselect all
    await page.click('[data-testid="checkbox-select-all"]');
    
    // Select specific documents for deletion
    await page.click(`tr:has-text("Document 1") input[type="checkbox"]`);
    await page.click(`tr:has-text("Document 2") input[type="checkbox"]`);
    
    // Bulk delete
    await page.click('[data-testid="dropdown-bulk-actions"]');
    await page.click('text=Delete Selected');
    await page.click('[data-testid="button-confirm-bulk-delete"]');
    
    // Verify documents deleted
    await expect(page.locator('text=Document 1')).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Document 2')).not.toBeVisible();
    await expect(page.locator('text=Document 3')).toBeVisible();
  });
});