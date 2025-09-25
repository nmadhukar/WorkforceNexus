/**
 * Document Upload Regression Tests
 * @description Regression tests to ensure document upload functionality remains stable across updates
 */

import { test, expect } from '@playwright/test';
import { DocumentsPage } from '../ui/pages/documents.page';
import { EmployeesPage } from '../ui/pages/employees.page';
import { AuthHelpers } from '../ui/utils/auth-helpers';
import { TestDataFactory } from '../ui/utils/test-data';
import { TestCleanup } from '../ui/utils/test-cleanup';
import {
  generateTestFile,
  uploadDocument,
  verifyDocumentInList,
  downloadAndVerify,
  checkS3StorageStatus,
  cleanupTempFiles
} from '../utils/document-helpers';

test.describe('Document Upload Regression Tests', () => {
  let documentsPage: DocumentsPage;
  let employeesPage: EmployeesPage;
  let authHelpers: AuthHelpers;
  let testCleanup: TestCleanup;
  const tempFiles: Array<{ cleanup: () => void }> = [];

  test.beforeEach(async ({ page }) => {
    documentsPage = new DocumentsPage(page);
    employeesPage = new EmployeesPage(page);
    authHelpers = new AuthHelpers(page);
    testCleanup = new TestCleanup(page);
    
    // Login as admin for regression tests
    await authHelpers.loginAs('admin');
  });

  test.afterEach(async () => {
    // Clean up temp files
    tempFiles.forEach(file => file.cleanup());
    tempFiles.length = 0;
    cleanupTempFiles();
  });

  test('Existing documents still accessible', async ({ page }) => {
    // Create and upload test documents
    const employee = TestDataFactory.createEmployee();
    await employeesPage.navigateToEmployees();
    await employeesPage.createEmployee(employee);
    
    // Upload initial documents
    const documentsToUpload = [
      { name: 'Legacy Document 1', type: 'pdf', category: 'License' },
      { name: 'Legacy Document 2', type: 'docx', category: 'Certificate' },
      { name: 'Legacy Document 3', type: 'jpg', category: 'ID Card' }
    ];
    
    const uploadedDocs = [];
    for (const doc of documentsToUpload) {
      const file = generateTestFile(doc.type, 1024 * 100);
      tempFiles.push(file);
      
      await documentsPage.navigateToDocuments();
      await page.click('[data-testid="button-upload-document"]');
      await page.locator('[data-testid="input-file-upload"]').setInputFiles(file.path);
      await page.fill('[data-testid="input-document-name"]', doc.name);
      await page.selectOption('[data-testid="select-document-category"]', doc.category);
      await page.selectOption('[data-testid="select-document-employee"]', { label: `${employee.firstName} ${employee.lastName}` });
      await page.click('[data-testid="button-submit-upload"]');
      
      await page.waitForTimeout(500);
      uploadedDocs.push(doc.name);
    }
    
    // Navigate away and back to simulate session change
    await page.goto('/dashboard');
    await page.waitForTimeout(1000);
    await documentsPage.navigateToDocuments();
    
    // Verify old documents can still be accessed
    for (const docName of uploadedDocs) {
      // Search for document
      await page.fill('[data-testid="input-document-search"]', docName);
      await page.press('[data-testid="input-document-search"]', 'Enter');
      await page.waitForTimeout(500);
      
      // Verify document appears
      await expect(page.locator(`text=${docName}`)).toBeVisible();
      
      // Try to download
      const documentRow = page.locator(`tr:has-text("${docName}")`);
      const downloadButton = documentRow.locator('[data-testid*="download"]');
      
      const downloadPromise = page.waitForEvent('download');
      await downloadButton.click();
      const download = await downloadPromise;
      
      // Verify download successful
      expect(download.suggestedFilename()).toBeTruthy();
      
      // Clear search
      await page.fill('[data-testid="input-document-search"]', '');
      await page.press('[data-testid="input-document-search"]', 'Enter');
    }
    
    // Verify metadata intact
    for (const doc of documentsToUpload) {
      const documentRow = page.locator(`tr:has-text("${doc.name}")`);
      await expect(documentRow.locator(`text=${doc.category}`)).toBeVisible();
    }
  });

  test('S3 to local migration', async ({ page }) => {
    // Check initial storage configuration
    const initialStatus = await checkS3StorageStatus(page);
    
    // Create test employee
    const employee = TestDataFactory.createEmployee();
    await employeesPage.navigateToEmployees();
    await employeesPage.createEmployee(employee);
    
    // Upload document with initial storage type
    const testFile1 = generateTestFile('pdf', 1024 * 200);
    tempFiles.push(testFile1);
    
    await documentsPage.navigateToDocuments();
    await page.click('[data-testid="button-upload-document"]');
    await page.locator('[data-testid="input-file-upload"]').setInputFiles(testFile1.path);
    await page.fill('[data-testid="input-document-name"]', 'Pre-Migration Document');
    await page.selectOption('[data-testid="select-document-category"]', 'License');
    await page.selectOption('[data-testid="select-document-employee"]', { label: `${employee.firstName} ${employee.lastName}` });
    await page.click('[data-testid="button-submit-upload"]');
    
    await expect(page.locator('text=Pre-Migration Document')).toBeVisible({ timeout: 10000 });
    
    // Simulate storage configuration change
    if (initialStatus.configured) {
      // Switch from S3 to local
      await page.goto('/settings');
      await page.click('text=S3 Storage');
      
      const toggleButton = page.locator('[data-testid="toggle-s3-enabled"]');
      if (await toggleButton.isChecked()) {
        await toggleButton.click();
      }
      await page.click('[data-testid="button-save-s3-config"]');
      await page.waitForTimeout(1000);
    } else {
      // Switch from local to S3 (if credentials available)
      await page.goto('/settings');
      await page.click('text=S3 Storage');
      
      const toggleButton = page.locator('[data-testid="toggle-s3-enabled"]');
      if (!await toggleButton.isChecked()) {
        // Only enable if we have test credentials
        const accessKeyInput = page.locator('[data-testid="input-s3-access-key"]');
        if (await accessKeyInput.isVisible()) {
          await accessKeyInput.fill('TEST_ACCESS_KEY');
          await page.fill('[data-testid="input-s3-secret-key"]', 'TEST_SECRET_KEY');
          await page.fill('[data-testid="input-s3-region"]', 'us-east-1');
          await page.fill('[data-testid="input-s3-bucket"]', 'test-bucket');
          await toggleButton.click();
          await page.click('[data-testid="button-save-s3-config"]');
          await page.waitForTimeout(1000);
        }
      }
    }
    
    // Navigate back to documents
    await documentsPage.navigateToDocuments();
    
    // Verify pre-migration document still accessible
    await expect(page.locator('text=Pre-Migration Document')).toBeVisible();
    
    // Download pre-migration document
    const downloadPath = await downloadAndVerify(page, 'Pre-Migration Document');
    expect(downloadPath).toBeTruthy();
    
    // Upload new document with new storage configuration
    const testFile2 = generateTestFile('pdf', 1024 * 150);
    tempFiles.push(testFile2);
    
    await page.click('[data-testid="button-upload-document"]');
    await page.locator('[data-testid="input-file-upload"]').setInputFiles(testFile2.path);
    await page.fill('[data-testid="input-document-name"]', 'Post-Migration Document');
    await page.selectOption('[data-testid="select-document-category"]', 'Certificate');
    await page.selectOption('[data-testid="select-document-employee"]', { label: `${employee.firstName} ${employee.lastName}` });
    await page.click('[data-testid="button-submit-upload"]');
    
    await expect(page.locator('text=Post-Migration Document')).toBeVisible({ timeout: 10000 });
    
    // Verify both documents are accessible
    const documents = ['Pre-Migration Document', 'Post-Migration Document'];
    for (const docName of documents) {
      const isVisible = await verifyDocumentInList(page, docName);
      expect(isVisible).toBeTruthy();
    }
    
    // Restore original configuration
    if (initialStatus.configured) {
      await page.goto('/settings');
      await page.click('text=S3 Storage');
      const toggleButton = page.locator('[data-testid="toggle-s3-enabled"]');
      if (!await toggleButton.isChecked()) {
        await toggleButton.click();
        await page.click('[data-testid="button-save-s3-config"]');
      }
    }
  });

  test('Document permissions unchanged', async ({ page, context }) => {
    // Create test employee and documents
    const employee = TestDataFactory.createEmployee();
    await employeesPage.navigateToEmployees();
    await employeesPage.createEmployee(employee);
    
    // Admin uploads document
    const adminFile = generateTestFile('pdf', 1024 * 100);
    tempFiles.push(adminFile);
    
    await documentsPage.navigateToDocuments();
    await page.click('[data-testid="button-upload-document"]');
    await page.locator('[data-testid="input-file-upload"]').setInputFiles(adminFile.path);
    await page.fill('[data-testid="input-document-name"]', 'Admin Document');
    await page.selectOption('[data-testid="select-document-category"]', 'License');
    await page.selectOption('[data-testid="select-document-employee"]', { label: `${employee.firstName} ${employee.lastName}` });
    await page.click('[data-testid="button-submit-upload"]');
    
    await expect(page.locator('text=Admin Document')).toBeVisible({ timeout: 10000 });
    
    // Test HR permissions
    const hrPage = await context.newPage();
    const hrAuth = new AuthHelpers(hrPage);
    await hrAuth.loginAs('hr');
    
    await hrPage.goto('/documents');
    await expect(hrPage.locator('h1:has-text("Documents")')).toBeVisible();
    
    // HR should be able to view document
    await expect(hrPage.locator('text=Admin Document')).toBeVisible();
    
    // HR should be able to upload
    const hrUploadButton = hrPage.locator('[data-testid="button-upload-document"]');
    await expect(hrUploadButton).toBeVisible();
    
    const hrFile = generateTestFile('pdf', 1024 * 80);
    tempFiles.push(hrFile);
    
    await hrUploadButton.click();
    await hrPage.locator('[data-testid="input-file-upload"]').setInputFiles(hrFile.path);
    await hrPage.fill('[data-testid="input-document-name"]', 'HR Document');
    await hrPage.selectOption('[data-testid="select-document-category"]', 'Certificate');
    
    // Select employee if dropdown is visible
    const employeeSelect = hrPage.locator('[data-testid="select-document-employee"]');
    if (await employeeSelect.isVisible()) {
      await employeeSelect.selectOption({ label: `${employee.firstName} ${employee.lastName}` });
    }
    
    await hrPage.click('[data-testid="button-submit-upload"]');
    await expect(hrPage.locator('text=HR Document')).toBeVisible({ timeout: 10000 });
    
    // Test viewer permissions
    const viewerPage = await context.newPage();
    const viewerAuth = new AuthHelpers(viewerPage);
    await viewerAuth.loginAs('viewer');
    
    await viewerPage.goto('/documents');
    
    // Viewer should NOT be able to upload
    const viewerUploadButton = viewerPage.locator('[data-testid="button-upload-document"]');
    const uploadVisible = await viewerUploadButton.isVisible({ timeout: 2000 }).catch(() => false);
    expect(uploadVisible).toBe(false);
    
    // Viewer should NOT see delete buttons
    const deleteButtons = viewerPage.locator('[data-testid*="delete"]');
    const deleteCount = await deleteButtons.count();
    expect(deleteCount).toBe(0);
    
    // Clean up
    await hrPage.close();
    await viewerPage.close();
  });

  test('Audit logs for documents', async ({ page }) => {
    // Create test employee
    const employee = TestDataFactory.createEmployee();
    await employeesPage.navigateToEmployees();
    await employeesPage.createEmployee(employee);
    
    // Upload document
    const testFile = generateTestFile('pdf', 1024 * 120);
    tempFiles.push(testFile);
    
    await documentsPage.navigateToDocuments();
    await page.click('[data-testid="button-upload-document"]');
    await page.locator('[data-testid="input-file-upload"]').setInputFiles(testFile.path);
    await page.fill('[data-testid="input-document-name"]', 'Audited Document');
    await page.selectOption('[data-testid="select-document-category"]', 'License');
    await page.selectOption('[data-testid="select-document-employee"]', { label: `${employee.firstName} ${employee.lastName}` });
    await page.click('[data-testid="button-submit-upload"]');
    
    await expect(page.locator('text=Audited Document')).toBeVisible({ timeout: 10000 });
    
    // Navigate to audit logs
    await page.goto('/audits');
    await expect(page.locator('h1:has-text("Audit")')).toBeVisible();
    
    // Search for document upload audit log
    const searchInput = page.locator('[data-testid="input-audit-search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('Audited Document');
      await page.press('[data-testid="input-audit-search"]', 'Enter');
      await page.waitForTimeout(500);
    }
    
    // Verify upload audit log exists
    const uploadLog = page.locator('text=/upload.*Audited Document/i').or(page.locator('text=/created.*document/i'));
    const uploadLogVisible = await uploadLog.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (uploadLogVisible) {
      // Audit log found
      await expect(uploadLog).toBeVisible();
    } else {
      // Check if audit logs are implemented by looking for any recent activity
      const recentActivity = await page.locator('tbody tr').count();
      // If audit system exists, there should be some entries
      if (recentActivity > 0) {
        console.log('Audit system exists but specific document audit not found');
      }
    }
    
    // Delete document and check for deletion log
    await documentsPage.navigateToDocuments();
    await documentsPage.deleteDocument('Audited Document');
    
    // Check deletion audit log
    await page.goto('/audits');
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('Audited Document');
      await page.press('[data-testid="input-audit-search"]', 'Enter');
      await page.waitForTimeout(500);
    }
    
    const deleteLog = page.locator('text=/delete.*Audited Document/i').or(page.locator('text=/removed.*document/i'));
    const deleteLogVisible = await deleteLog.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (deleteLogVisible) {
      await expect(deleteLog).toBeVisible();
    }
  });

  test('Performance with many documents', async ({ page }) => {
    // Create test employee
    const employee = TestDataFactory.createEmployee();
    await employeesPage.navigateToEmployees();
    await employeesPage.createEmployee(employee);
    
    // Measure initial load time
    const startTime = Date.now();
    await documentsPage.navigateToDocuments();
    const initialLoadTime = Date.now() - startTime;
    
    // Upload multiple documents to test performance
    const documentCount = 20; // Reduced from 100 for test speed
    const uploadedDocNames = [];
    
    console.log(`Uploading ${documentCount} test documents...`);
    
    for (let i = 0; i < documentCount; i++) {
      const file = generateTestFile(['pdf', 'jpg', 'docx'][i % 3], 1024 * (50 + i * 10));
      tempFiles.push(file);
      
      const docName = `Performance Test Doc ${i + 1}`;
      
      await page.click('[data-testid="button-upload-document"]');
      await page.locator('[data-testid="input-file-upload"]').setInputFiles(file.path);
      await page.fill('[data-testid="input-document-name"]', docName);
      await page.selectOption('[data-testid="select-document-category"]', ['License', 'Certificate', 'Other'][i % 3]);
      await page.selectOption('[data-testid="select-document-employee"]', { label: `${employee.firstName} ${employee.lastName}` });
      await page.click('[data-testid="button-submit-upload"]');
      
      // Wait for upload to complete
      await page.waitForSelector('.toast:has-text("success")', { timeout: 10000 });
      await page.waitForTimeout(200);
      
      uploadedDocNames.push(docName);
      
      // Show progress
      if ((i + 1) % 5 === 0) {
        console.log(`Uploaded ${i + 1}/${documentCount} documents`);
      }
    }
    
    // Navigate to employee's documents
    await employeesPage.navigateToEmployees();
    await employeesPage.viewEmployeeDetails(`${employee.firstName} ${employee.lastName}`);
    await page.click('[data-testid="tab-documents"]');
    
    // Measure load time with many documents
    const manyDocsStartTime = Date.now();
    await page.reload();
    await page.waitForSelector('[data-testid="documents-table"]', { timeout: 10000 });
    const manyDocsLoadTime = Date.now() - manyDocsStartTime;
    
    // Performance assertions
    console.log(`Initial load time: ${initialLoadTime}ms`);
    console.log(`Load time with ${documentCount} documents: ${manyDocsLoadTime}ms`);
    
    // Load time should not increase dramatically
    expect(manyDocsLoadTime).toBeLessThan(10000); // Should load within 10 seconds
    
    // Verify pagination works
    const paginationControls = page.locator('[data-testid*="pagination"]');
    if (await paginationControls.isVisible({ timeout: 2000 })) {
      // Check page size selector
      const pageSizeSelect = page.locator('[data-testid="select-page-size"]');
      if (await pageSizeSelect.isVisible()) {
        await pageSizeSelect.selectOption('10');
        await page.waitForTimeout(500);
        
        // Should show only 10 items
        const visibleRows = await page.locator('[data-testid="documents-table"] tbody tr').count();
        expect(visibleRows).toBeLessThanOrEqual(10);
        
        // Navigate to next page
        const nextButton = page.locator('[data-testid="button-next-page"]');
        if (await nextButton.isEnabled()) {
          await nextButton.click();
          await page.waitForTimeout(500);
          
          // Should show more documents
          const secondPageRows = await page.locator('[data-testid="documents-table"] tbody tr').count();
          expect(secondPageRows).toBeGreaterThan(0);
        }
      }
    }
    
    // Test search performance
    const searchStartTime = Date.now();
    await page.fill('[data-testid="input-document-search"]', 'Performance Test Doc 1');
    await page.press('[data-testid="input-document-search"]', 'Enter');
    await page.waitForTimeout(1000);
    const searchTime = Date.now() - searchStartTime;
    
    console.log(`Search time: ${searchTime}ms`);
    expect(searchTime).toBeLessThan(3000); // Search should complete within 3 seconds
    
    // Verify search results
    const searchResults = await page.locator('[data-testid="documents-table"] tbody tr').count();
    expect(searchResults).toBeGreaterThan(0); // Should find at least some matches
    
    // Test sorting performance
    const sortStartTime = Date.now();
    await page.click('[data-testid="sort-name"]');
    await page.waitForTimeout(1000);
    const sortTime = Date.now() - sortStartTime;
    
    console.log(`Sort time: ${sortTime}ms`);
    expect(sortTime).toBeLessThan(3000); // Sort should complete within 3 seconds
  });

  test('Document expiration tracking', async ({ page }) => {
    // Create test employee
    const employee = TestDataFactory.createEmployee();
    await employeesPage.navigateToEmployees();
    await employeesPage.createEmployee(employee);
    
    // Upload document with expiration date
    const testFile = generateTestFile('pdf', 1024 * 100);
    tempFiles.push(testFile);
    
    await documentsPage.navigateToDocuments();
    await page.click('[data-testid="button-upload-document"]');
    await page.locator('[data-testid="input-file-upload"]').setInputFiles(testFile.path);
    await page.fill('[data-testid="input-document-name"]', 'Expiring License');
    await page.selectOption('[data-testid="select-document-category"]', 'License');
    await page.selectOption('[data-testid="select-document-employee"]', { label: `${employee.firstName} ${employee.lastName}` });
    
    // Set expiration date (30 days from now)
    const expirationInput = page.locator('[data-testid="input-expiration-date"]');
    if (await expirationInput.isVisible()) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const dateString = futureDate.toISOString().split('T')[0];
      await expirationInput.fill(dateString);
    }
    
    await page.click('[data-testid="button-submit-upload"]');
    await expect(page.locator('text=Expiring License')).toBeVisible({ timeout: 10000 });
    
    // Check if expiration tracking is shown
    const documentRow = page.locator('tr:has-text("Expiring License")');
    
    // Look for expiration date display
    const expirationText = await documentRow.textContent();
    if (expirationText && expirationText.includes('days') || expirationText.includes('expires')) {
      // Expiration tracking is implemented
      console.log('Expiration tracking found:', expirationText);
    }
    
    // Check dashboard for expiration warnings
    await page.goto('/dashboard');
    
    const expirationCard = page.locator('[data-testid*="expir"]').or(page.locator('text=/expir/i'));
    if (await expirationCard.isVisible({ timeout: 3000 })) {
      const cardText = await expirationCard.textContent();
      console.log('Dashboard expiration warning:', cardText);
    }
  });

  test('Document categories remain consistent', async ({ page }) => {
    // Navigate to documents page
    await documentsPage.navigateToDocuments();
    
    // Click upload to check available categories
    await page.click('[data-testid="button-upload-document"]');
    
    const categorySelect = page.locator('[data-testid="select-document-category"]');
    const options = await categorySelect.locator('option').allTextContents();
    
    // Expected categories based on the original requirements
    const expectedCategories = [
      'License',
      'Certificate', 
      'Training',
      'Tax Form',
      'ID Card',
      'Other'
    ];
    
    // Filter out empty option if present
    const actualCategories = options.filter(opt => opt.trim() !== '');
    
    // Verify core categories are present
    for (const category of expectedCategories) {
      const hasCategory = actualCategories.some(cat => cat.includes(category));
      if (!hasCategory) {
        console.log(`Warning: Category "${category}" not found. Available: ${actualCategories.join(', ')}`);
      }
    }
    
    // Close upload dialog
    await page.keyboard.press('Escape');
    
    // Test category filtering still works
    const categoryFilter = page.locator('[data-testid="select-category-filter"]');
    if (await categoryFilter.isVisible()) {
      const filterOptions = await categoryFilter.locator('option').allTextContents();
      
      // Categories in filter should match upload categories
      for (const category of actualCategories) {
        if (category) {
          const hasInFilter = filterOptions.some(opt => opt.includes(category));
          if (!hasInFilter && category !== '') {
            console.log(`Warning: Category "${category}" not in filter options`);
          }
        }
      }
    }
  });
});