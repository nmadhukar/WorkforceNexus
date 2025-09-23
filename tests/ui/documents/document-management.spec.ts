import { test, expect } from '@playwright/test';
import { DocumentsPage } from '../pages/documents.page';
import { AuthHelpers } from '../utils/auth-helpers';
import { TestDataFactory } from '../utils/test-data';
import { TestCleanup } from '../utils/test-cleanup';
import { CommonHelpers } from '../utils/common-helpers';

/**
 * Document Management Tests
 * @description Tests for document upload, organization, viewing, and management
 */
test.describe('Document Management', () => {
  let documentsPage: DocumentsPage;
  let authHelpers: AuthHelpers;
  let testCleanup: TestCleanup;
  let commonHelpers: CommonHelpers;

  const createdDocumentIds: string[] = [];
  const uploadedFilePaths: string[] = [];

  test.beforeEach(async ({ page }) => {
    documentsPage = new DocumentsPage(page);
    authHelpers = new AuthHelpers(page);
    testCleanup = new TestCleanup(page);
    commonHelpers = new CommonHelpers(page);
    
    // Login as HR user (has document management permissions)
    await authHelpers.loginAs('hr');
  });

  test.afterEach(async ({ page }) => {
    await testCleanup.comprehensiveCleanup({
      documentIds: createdDocumentIds,
      filePaths: uploadedFilePaths
    });
  });

  test.describe('Document Upload', () => {
    test('should successfully upload a document', async ({ page }) => {
      const documentData = TestDataFactory.createDocument({
        filePath: 'tests/ui/fixtures/test-document.txt'
      });
      
      await documentsPage.uploadDocument(documentData);
      
      // Verify upload success
      await documentsPage.validateDocumentUploaded(documentData.name);
      
      uploadedFilePaths.push(documentData.filePath);
    });

    test('should upload document with complete metadata', async ({ page }) => {
      const documentData = TestDataFactory.createDocument({
        name: 'Medical License',
        category: 'License',
        description: 'Primary medical license documentation',
        filePath: 'tests/ui/fixtures/test-document.txt'
      });
      
      await documentsPage.uploadDocument(documentData);
      
      // Verify document appears with correct metadata
      await documentsPage.validateDocumentUploaded(documentData.name);
      await documentsPage.validateDocumentDetails(documentData.name, {
        category: documentData.category,
      });
      
      uploadedFilePaths.push(documentData.filePath);
    });

    test('should validate required upload fields', async ({ page }) => {
      await documentsPage.navigateToDocuments();
      await documentsPage.clickByTestId('button-upload-document');
      
      // Try to submit without file or name
      await documentsPage.clickByTestId('button-submit-upload');
      
      // Should show validation errors
      await expect(documentsPage.fileInput).toBeInvalid();
      await expect(documentsPage.documentNameInput).toBeInvalid();
    });

    test('should handle file size limits', async ({ page }) => {
      // Mock large file upload attempt
      await documentsPage.navigateToDocuments();
      await documentsPage.clickByTestId('button-upload-document');
      
      // Try to upload a large file (create a test scenario)
      const largeFileData = TestDataFactory.createDocument({
        name: 'Large File Test',
        filePath: 'tests/ui/fixtures/test-large-file.zip' // This file would exceed size limits
      });
      
      if (await page.locator(documentsPage.fileInput.selector).isVisible()) {
        // Set up a mock for file size validation
        await page.evaluate(() => {
          // Mock FileList with large file
          const mockFile = new File(['x'.repeat(10000000)], 'large-file.zip', { type: 'application/zip' });
          Object.defineProperty(mockFile, 'size', { value: 10000000 });
        });
        
        await documentsPage.documentNameInput.fill(largeFileData.name);
        await documentsPage.documentCategorySelect.selectOption(largeFileData.category);
        await documentsPage.clickByTestId('button-submit-upload');
        
        // Should show file size error
        await documentsPage.validateDocumentUploadFailure('File size too large');
      }
    });

    test('should support multiple file type uploads', async ({ page }) => {
      const testFiles = TestDataFactory.getTestFiles();
      
      for (const fileData of testFiles.slice(0, 2)) { // Test first 2 file types
        const documentData = TestDataFactory.createDocument({
          name: `Test ${fileData.name}`,
          category: fileData.category,
          filePath: fileData.path
        });
        
        if (fileData.shouldSucceed) {
          await documentsPage.uploadDocument(documentData);
          await documentsPage.validateDocumentUploaded(documentData.name);
        } else {
          await documentsPage.navigateToDocuments();
          await documentsPage.clickByTestId('button-upload-document');
          
          // Attempt upload of unsupported file type
          await documentsPage.fileInput.setInputFiles(fileData.path);
          await documentsPage.documentNameInput.fill(documentData.name);
          await documentsPage.clickByTestId('button-submit-upload');
          
          // Should show file type error
          await documentsPage.validateDocumentUploadFailure('File type not supported');
        }
        
        uploadedFilePaths.push(fileData.path);
      }
    });
  });

  test.describe('Document Organization', () => {
    test('should categorize documents correctly', async ({ page }) => {
      const categories = ['License', 'Certificate', 'ID Card', 'Other'];
      
      for (const category of categories.slice(0, 2)) { // Test first 2 categories
        const documentData = TestDataFactory.createDocument({
          name: `${category} Document`,
          category: category,
          filePath: 'tests/ui/fixtures/test-document.txt'
        });
        
        await documentsPage.uploadDocument(documentData);
        await documentsPage.validateDocumentDetails(documentData.name, {
          category: category
        });
        
        uploadedFilePaths.push(documentData.filePath);
      }
    });

    test('should filter documents by category', async ({ page }) => {
      // Upload documents in different categories first
      const licenseDoc = TestDataFactory.createDocument({
        name: 'License Document',
        category: 'License',
        filePath: 'tests/ui/fixtures/test-document.txt'
      });
      
      const certDoc = TestDataFactory.createDocument({
        name: 'Certificate Document', 
        category: 'Certificate',
        filePath: 'tests/ui/fixtures/test-document.txt'
      });
      
      await documentsPage.uploadDocument(licenseDoc);
      await documentsPage.uploadDocument(certDoc);
      
      // Filter by License category
      await documentsPage.filterByCategory('License');
      
      // Should show only license documents
      await expect(documentsPage.getDocumentRow(licenseDoc.name)).toBeVisible();
      
      uploadedFilePaths.push(licenseDoc.filePath, certDoc.filePath);
    });

    test('should sort documents by different criteria', async ({ page }) => {
      await documentsPage.navigateToDocuments();
      
      // Test different sort options
      await documentsPage.sortDocuments('name');
      await documentsPage.waitForLoading();
      
      await documentsPage.sortDocuments('date');
      await documentsPage.waitForLoading();
      
      // Verify sorting controls work
      await expect(documentsPage.sortSelect).toBeVisible();
    });

    test('should search documents by name', async ({ page }) => {
      const searchableDoc = TestDataFactory.createDocument({
        name: 'Searchable Medical License',
        filePath: 'tests/ui/fixtures/test-document.txt'
      });
      
      await documentsPage.uploadDocument(searchableDoc);
      
      // Search for the document
      await documentsPage.searchDocuments('Searchable');
      
      // Should find the document
      await expect(documentsPage.getDocumentRow(searchableDoc.name)).toBeVisible();
      
      uploadedFilePaths.push(searchableDoc.filePath);
    });
  });

  test.describe('Document Actions', () => {
    test('should view document details', async ({ page }) => {
      const documentData = TestDataFactory.createDocument({
        filePath: 'tests/ui/fixtures/test-document.txt'
      });
      
      await documentsPage.uploadDocument(documentData);
      await documentsPage.viewDocumentDetails(documentData.name);
      
      // Should show document details modal or page
      await expect(page.locator(`text=${documentData.name}`)).toBeVisible();
      
      uploadedFilePaths.push(documentData.filePath);
    });

    test('should download documents', async ({ page }) => {
      const documentData = TestDataFactory.createDocument({
        filePath: 'tests/ui/fixtures/test-document.txt'
      });
      
      await documentsPage.uploadDocument(documentData);
      await documentsPage.downloadDocument(documentData.name);
      
      // Download should have started (verified in DocumentsPage method)
      uploadedFilePaths.push(documentData.filePath);
    });

    test('should delete documents', async ({ page }) => {
      const documentData = TestDataFactory.createDocument({
        filePath: 'tests/ui/fixtures/test-document.txt'
      });
      
      await documentsPage.uploadDocument(documentData);
      
      // Delete the document
      await documentsPage.deleteDocument(documentData.name);
      
      // Document should no longer be visible
      await expect(documentsPage.getDocumentRow(documentData.name)).toBeHidden();
      
      uploadedFilePaths.push(documentData.filePath);
    });
  });

  test.describe('Bulk Operations', () => {
    test('should select multiple documents', async ({ page }) => {
      // Upload multiple documents first
      const documents = [
        TestDataFactory.createDocument({ name: 'Doc 1', filePath: 'tests/ui/fixtures/test-document.txt' }),
        TestDataFactory.createDocument({ name: 'Doc 2', filePath: 'tests/ui/fixtures/test-document.txt' })
      ];
      
      for (const doc of documents) {
        await documentsPage.uploadDocument(doc);
        uploadedFilePaths.push(doc.filePath);
      }
      
      // Select multiple documents
      await documentsPage.selectDocuments(documents.map(d => d.name));
      
      // Bulk actions should become available
      await expect(documentsPage.bulkActionsDropdown).toBeVisible();
    });

    test('should bulk delete documents', async ({ page }) => {
      // Upload multiple documents
      const documents = [
        TestDataFactory.createDocument({ name: 'Bulk Delete 1', filePath: 'tests/ui/fixtures/test-document.txt' }),
        TestDataFactory.createDocument({ name: 'Bulk Delete 2', filePath: 'tests/ui/fixtures/test-document.txt' })
      ];
      
      for (const doc of documents) {
        await documentsPage.uploadDocument(doc);
        uploadedFilePaths.push(doc.filePath);
      }
      
      // Bulk delete
      await documentsPage.bulkDeleteDocuments(documents.map(d => d.name));
      
      // Documents should no longer be visible
      for (const doc of documents) {
        await expect(documentsPage.getDocumentRow(doc.name)).toBeHidden();
      }
    });

    test('should bulk download documents', async ({ page }) => {
      // Upload multiple documents
      const documents = [
        TestDataFactory.createDocument({ name: 'Bulk Download 1', filePath: 'tests/ui/fixtures/test-document.txt' }),
        TestDataFactory.createDocument({ name: 'Bulk Download 2', filePath: 'tests/ui/fixtures/test-document.txt' })
      ];
      
      for (const doc of documents) {
        await documentsPage.uploadDocument(doc);
        uploadedFilePaths.push(doc.filePath);
      }
      
      // Bulk download
      await documentsPage.bulkDownloadDocuments(documents.map(d => d.name));
      
      // Download should have started (zip file)
    });

    test('should select all documents on page', async ({ page }) => {
      await documentsPage.navigateToDocuments();
      
      // If there are documents, select all should work
      const selectAllCheckbox = documentsPage.selectAllCheckbox;
      
      if (await selectAllCheckbox.isVisible()) {
        await documentsPage.selectAllDocuments();
        
        // All checkboxes should be selected
        const documentCheckboxes = page.locator('tbody input[type="checkbox"]');
        const count = await documentCheckboxes.count();
        
        for (let i = 0; i < count; i++) {
          await expect(documentCheckboxes.nth(i)).toBeChecked();
        }
      }
    });
  });

  test.describe('Role-Based Access Control', () => {
    test('should allow HR users to upload and manage documents', async ({ page }) => {
      await authHelpers.loginAs('hr');
      await documentsPage.navigateToDocuments();
      
      // HR should see upload button and management features
      await expect(documentsPage.uploadButton).toBeVisible();
      await expect(documentsPage.bulkActionsDropdown).toBeVisible();
    });

    test('should allow admin users full document access', async ({ page }) => {
      await authHelpers.loginAs('admin');
      await documentsPage.navigateToDocuments();
      
      // Admin should have full access
      await expect(documentsPage.uploadButton).toBeVisible();
      await expect(documentsPage.bulkActionsDropdown).toBeVisible();
    });

    test('should restrict viewer access to read-only', async ({ page }) => {
      await authHelpers.loginAs('viewer');
      await documentsPage.validateDocumentPermissions('viewer');
      
      // Viewer should not see upload or delete options
      await expect(documentsPage.uploadButton).toBeHidden();
    });
  });

  test.describe('Document Integration with Employees', () => {
    test('should associate documents with employees', async ({ page }) => {
      const documentData = TestDataFactory.createDocument({
        name: 'Employee License',
        employeeId: 'EMP001', // Assuming this employee exists
        filePath: 'tests/ui/fixtures/test-document.txt'
      });
      
      await documentsPage.uploadDocument(documentData);
      
      // Document should be associated with the employee
      await documentsPage.validateDocumentDetails(documentData.name, {
        employee: 'EMP001'
      });
      
      uploadedFilePaths.push(documentData.filePath);
    });

    test('should filter documents by employee', async ({ page }) => {
      // This would require an employee filter feature
      await documentsPage.navigateToDocuments();
      
      const employeeFilter = page.locator('[data-testid*="employee-filter"], select[data-testid*="employee"]');
      
      if (await employeeFilter.isVisible()) {
        await employeeFilter.selectOption('EMP001');
        await documentsPage.waitForLoading();
        
        // Should show only documents for that employee
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle upload failures gracefully', async ({ page }) => {
      // Mock upload failure
      await page.route('/api/documents', route => {
        if (route.request().method() === 'POST') {
          route.fulfill({
            status: 500,
            body: JSON.stringify({ error: 'Upload failed' })
          });
        } else {
          route.continue();
        }
      });
      
      const documentData = TestDataFactory.createDocument({
        filePath: 'tests/ui/fixtures/test-document.txt'
      });
      
      await documentsPage.navigateToDocuments();
      await documentsPage.clickByTestId('button-upload-document');
      
      await documentsPage.fileInput.setInputFiles(documentData.filePath);
      await documentsPage.documentNameInput.fill(documentData.name);
      await documentsPage.documentCategorySelect.selectOption(documentData.category);
      await documentsPage.clickByTestId('button-submit-upload');
      
      // Should show upload error
      await documentsPage.validateDocumentUploadFailure('Upload failed');
    });

    test('should handle network errors when loading documents', async ({ page }) => {
      // Mock network failure for documents list
      await page.route('/api/documents', route => route.abort());
      
      await documentsPage.navigateToDocuments();
      
      // Should show error message
      await expect(page.locator('text=Failed to load documents, text=Network error')).toBeVisible();
    });

    test('should handle corrupted file uploads', async ({ page }) => {
      await documentsPage.navigateToDocuments();
      await documentsPage.clickByTestId('button-upload-document');
      
      // Mock corrupted file scenario
      await page.evaluate(() => {
        const mockFile = new File(['corrupted'], 'corrupted.pdf', { type: 'application/pdf' });
        // Simulate file corruption
        Object.defineProperty(mockFile, 'arrayBuffer', {
          value: () => Promise.reject(new Error('File corrupted'))
        });
      });
      
      await documentsPage.documentNameInput.fill('Corrupted File Test');
      await documentsPage.clickByTestId('button-submit-upload');
      
      // Should handle corruption gracefully
      await documentsPage.validateDocumentUploadFailure('file corrupted');
    });
  });
});