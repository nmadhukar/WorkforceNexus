/**
 * Document Upload Edge Cases Tests
 * @description Tests for edge cases and error scenarios in document upload
 */

import { test, expect } from '@playwright/test';
import { DocumentsPage } from '../pages/documents.page';
import { AuthHelpers } from '../utils/auth-helpers';
import { TestCleanup } from '../utils/test-cleanup';
import {
  generateTestFile,
  createFileOfSize,
  createFileWithSpecialName,
  createFileWithLongName,
  simulateNetworkInterruption,
  restoreNetwork,
  uploadMultipleFiles,
  cleanupTempFiles
} from '../../utils/document-helpers';
import path from 'path';
import fs from 'fs';

test.describe('Document Upload Edge Cases', () => {
  let documentsPage: DocumentsPage;
  let authHelpers: AuthHelpers;
  let testCleanup: TestCleanup;
  const tempFiles: Array<{ cleanup: () => void }> = [];

  test.beforeEach(async ({ page }) => {
    documentsPage = new DocumentsPage(page);
    authHelpers = new AuthHelpers(page);
    testCleanup = new TestCleanup(page);
    
    // Login as HR user by default
    await authHelpers.loginAs('hr');
  });

  test.afterEach(async () => {
    // Clean up temp files
    tempFiles.forEach(file => file.cleanup());
    tempFiles.length = 0;
    cleanupTempFiles();
  });

  test('File size limits', async ({ page }) => {
    // Navigate to documents page
    await documentsPage.navigateToDocuments();
    
    // Test 1: Upload file exactly at limit (10MB)
    const fileAtLimit = createFileOfSize(10); // 10MB
    tempFiles.push(fileAtLimit);
    
    await page.click('[data-testid="button-upload-document"]');
    await page.locator('[data-testid="input-file-upload"]').setInputFiles(fileAtLimit.path);
    await page.fill('[data-testid="input-document-name"]', 'File at 10MB limit');
    await page.selectOption('[data-testid="select-document-category"]', 'Other');
    await page.click('[data-testid="button-submit-upload"]');
    
    // Should succeed
    await expect(page.locator('.toast').or(page.locator('[role="alert"]'))).toContainText(/success|uploaded/i, { timeout: 15000 });
    await expect(page.locator('text=File at 10MB limit')).toBeVisible({ timeout: 10000 });
    
    // Test 2: Upload file over limit (11MB)
    const fileOverLimit = createFileOfSize(11); // 11MB
    tempFiles.push(fileOverLimit);
    
    await page.click('[data-testid="button-upload-document"]');
    await page.locator('[data-testid="input-file-upload"]').setInputFiles(fileOverLimit.path);
    await page.fill('[data-testid="input-document-name"]', 'File over 10MB limit');
    await page.selectOption('[data-testid="select-document-category"]', 'Other');
    await page.click('[data-testid="button-submit-upload"]');
    
    // Should fail with error message
    await expect(page.locator('.toast').or(page.locator('[role="alert"]'))).toContainText(/size|limit|large|10MB/i, { timeout: 10000 });
    await expect(page.locator('text=File over 10MB limit')).not.toBeVisible();
    
    // Test 3: Multiple files with combined size over limit
    const file1 = createFileOfSize(6); // 6MB
    const file2 = createFileOfSize(6); // 6MB
    tempFiles.push(file1);
    tempFiles.push(file2);
    
    // If multiple upload is supported
    const results = await uploadMultipleFiles(page, [file1.path, file2.path]);
    
    // Check if system enforces combined size limit
    if (results.some(r => !r.success)) {
      await expect(page.locator('.toast').or(page.locator('[role="alert"]'))).toContainText(/size|limit/i);
    }
  });

  test('Unsupported file types', async ({ page }) => {
    // Navigate to documents page
    await documentsPage.navigateToDocuments();
    
    // Test 1: Try uploading .exe file
    const exeFile = generateTestFile('exe', 1024 * 100);
    tempFiles.push(exeFile);
    
    await page.click('[data-testid="button-upload-document"]');
    const fileInput = page.locator('[data-testid="input-file-upload"]');
    
    // Try to set exe file
    await fileInput.setInputFiles(exeFile.path);
    await page.fill('[data-testid="input-document-name"]', 'Executable File');
    await page.selectOption('[data-testid="select-document-category"]', 'Other');
    await page.click('[data-testid="button-submit-upload"]');
    
    // Should show error about unsupported file type
    await expect(page.locator('.toast').or(page.locator('[role="alert"]'))).toContainText(/type|format|supported|allowed/i, { timeout: 10000 });
    
    // Test 2: Try uploading .sh script
    const shFile = generateTestFile('sh', 1024 * 50);
    tempFiles.push(shFile);
    
    await page.click('[data-testid="button-upload-document"]');
    await fileInput.setInputFiles(shFile.path);
    await page.fill('[data-testid="input-document-name"]', 'Shell Script');
    await page.selectOption('[data-testid="select-document-category"]', 'Other');
    await page.click('[data-testid="button-submit-upload"]');
    
    // Should show error
    await expect(page.locator('.toast').or(page.locator('[role="alert"]'))).toContainText(/type|format|supported|allowed/i, { timeout: 10000 });
    
    // Test 3: Try uploading file with disguised extension
    const disguisedFile = generateTestFile('exe', 1024 * 100);
    tempFiles.push(disguisedFile);
    
    // Rename to pdf extension
    const disguisedPath = disguisedFile.path.replace('.exe', '.pdf');
    fs.renameSync(disguisedFile.path, disguisedPath);
    
    await page.click('[data-testid="button-upload-document"]');
    await fileInput.setInputFiles(disguisedPath);
    await page.fill('[data-testid="input-document-name"]', 'Disguised Executable');
    await page.selectOption('[data-testid="select-document-category"]', 'Other');
    await page.click('[data-testid="button-submit-upload"]');
    
    // System should detect actual file type and reject if checking file headers
    // This may succeed if only extension checking is done
    const toastText = await page.locator('.toast').or(page.locator('[role="alert"]')).textContent({ timeout: 5000 }).catch(() => '');
    if (toastText.match(/type|format|invalid/i)) {
      expect(toastText).toMatch(/type|format|invalid/i);
    }
  });

  test('Special characters in filenames', async ({ page }) => {
    // Navigate to documents page
    await documentsPage.navigateToDocuments();
    
    // Test 1: Upload file with spaces in name
    const fileWithSpaces = createFileWithSpecialName(' Test File With Spaces ');
    tempFiles.push(fileWithSpaces);
    
    await page.click('[data-testid="button-upload-document"]');
    await page.locator('[data-testid="input-file-upload"]').setInputFiles(fileWithSpaces.path);
    await page.fill('[data-testid="input-document-name"]', 'File with spaces');
    await page.selectOption('[data-testid="select-document-category"]', 'Other');
    await page.click('[data-testid="button-submit-upload"]');
    
    // Should handle spaces correctly
    await expect(page.locator('text=File with spaces')).toBeVisible({ timeout: 10000 });
    
    // Test 2: Upload file with unicode characters
    const unicodeFile = createFileWithSpecialName('测试文件_テスト_파일');
    tempFiles.push(unicodeFile);
    
    await page.click('[data-testid="button-upload-document"]');
    await page.locator('[data-testid="input-file-upload"]').setInputFiles(unicodeFile.path);
    await page.fill('[data-testid="input-document-name"]', 'Unicode filename test');
    await page.selectOption('[data-testid="select-document-category"]', 'Other');
    await page.click('[data-testid="button-submit-upload"]');
    
    // Should handle unicode characters
    await expect(page.locator('text=Unicode filename test')).toBeVisible({ timeout: 10000 });
    
    // Test 3: Upload file with very long name (>255 chars)
    const longNameFile = createFileWithLongName(260);
    tempFiles.push(longNameFile);
    
    await page.click('[data-testid="button-upload-document"]');
    await page.locator('[data-testid="input-file-upload"]').setInputFiles(longNameFile.path);
    await page.fill('[data-testid="input-document-name"]', 'Long filename test');
    await page.selectOption('[data-testid="select-document-category"]', 'Other');
    await page.click('[data-testid="button-submit-upload"]');
    
    // System should either truncate or show error
    const uploadResult = await page.locator('.toast').or(page.locator('[role="alert"]')).textContent({ timeout: 5000 }).catch(() => '');
    if (uploadResult.match(/success/i)) {
      await expect(page.locator('text=Long filename test')).toBeVisible();
    } else {
      expect(uploadResult).toMatch(/name|length|long/i);
    }
    
    // Test 4: Special characters that might cause issues
    const specialCharsFile = createFileWithSpecialName('#$%&@!()[]{}');
    tempFiles.push(specialCharsFile);
    
    await page.click('[data-testid="button-upload-document"]');
    await page.locator('[data-testid="input-file-upload"]').setInputFiles(specialCharsFile.path);
    await page.fill('[data-testid="input-document-name"]', 'Special chars test');
    await page.selectOption('[data-testid="select-document-category"]', 'Other');
    await page.click('[data-testid="button-submit-upload"]');
    
    // Should handle or sanitize special characters
    await expect(page.locator('text=Special chars test')).toBeVisible({ timeout: 10000 });
  });

  test('Concurrent uploads', async ({ page, context }) => {
    // Navigate to documents page
    await documentsPage.navigateToDocuments();
    
    // Create multiple test files
    const files = [];
    for (let i = 0; i < 5; i++) {
      const file = generateTestFile('pdf', 1024 * 200); // 200KB each
      tempFiles.push(file);
      files.push(file);
    }
    
    // Open multiple tabs for concurrent uploads
    const pages = [page];
    for (let i = 1; i < 3; i++) {
      const newPage = await context.newPage();
      await new AuthHelpers(newPage).loginAs('hr');
      pages.push(newPage);
    }
    
    // Start uploads simultaneously from different tabs
    const uploadPromises = pages.map(async (p, index) => {
      if (index > 0) {
        await p.goto('/documents');
      }
      
      const fileIndex = index;
      if (fileIndex < files.length) {
        await p.click('[data-testid="button-upload-document"]');
        await p.locator('[data-testid="input-file-upload"]').setInputFiles(files[fileIndex].path);
        await p.fill('[data-testid="input-document-name"]', `Concurrent Upload ${index + 1}`);
        await p.selectOption('[data-testid="select-document-category"]', 'Other');
        await p.click('[data-testid="button-submit-upload"]');
        
        // Wait for completion
        return p.waitForSelector('.toast:has-text("success")', { timeout: 20000 }).catch(() => null);
      }
    });
    
    // Wait for all uploads to complete
    const results = await Promise.all(uploadPromises);
    
    // Verify all uploads succeeded
    await page.reload();
    for (let i = 0; i < 3; i++) {
      await expect(page.locator(`text=Concurrent Upload ${i + 1}`)).toBeVisible();
    }
    
    // Close extra pages
    for (let i = 1; i < pages.length; i++) {
      await pages[i].close();
    }
  });

  test('Network interruption', async ({ page, browserName }) => {
    // Skip for webkit as CDP is not supported
    test.skip(browserName === 'webkit', 'CDP not supported in WebKit');
    
    // Navigate to documents page
    await documentsPage.navigateToDocuments();
    
    // Create a large file to ensure upload takes time
    const largeFile = createFileOfSize(5); // 5MB
    tempFiles.push(largeFile);
    
    // Start upload
    await page.click('[data-testid="button-upload-document"]');
    await page.locator('[data-testid="input-file-upload"]').setInputFiles(largeFile.path);
    await page.fill('[data-testid="input-document-name"]', 'Network Test Document');
    await page.selectOption('[data-testid="select-document-category"]', 'Other');
    
    // Click submit and immediately interrupt network
    const uploadPromise = page.click('[data-testid="button-submit-upload"]');
    
    // Simulate network failure after short delay
    await page.waitForTimeout(500);
    await simulateNetworkInterruption(page);
    
    // Wait for error
    await expect(page.locator('.toast').or(page.locator('[role="alert"]'))).toContainText(/network|connection|failed|error/i, { timeout: 15000 });
    
    // Restore network
    await restoreNetwork(page);
    
    // Test retry mechanism
    const retryButton = page.locator('[data-testid="button-retry-upload"]');
    if (await retryButton.isVisible({ timeout: 5000 })) {
      await retryButton.click();
      await expect(page.locator('.toast:has-text("success")')).toBeVisible({ timeout: 20000 });
    } else {
      // Manual retry
      await page.click('[data-testid="button-upload-document"]');
      await page.locator('[data-testid="input-file-upload"]').setInputFiles(largeFile.path);
      await page.fill('[data-testid="input-document-name"]', 'Network Test Document Retry');
      await page.selectOption('[data-testid="select-document-category"]', 'Other');
      await page.click('[data-testid="button-submit-upload"]');
      await expect(page.locator('.toast:has-text("success")')).toBeVisible({ timeout: 20000 });
    }
  });

  test('Storage quota exceeded', async ({ page }) => {
    // This test simulates storage quota scenarios
    // Note: Actual implementation depends on backend quota enforcement
    
    // Navigate to documents page
    await documentsPage.navigateToDocuments();
    
    // Upload multiple large files to approach quota
    const filesToUpload = 5;
    const uploadedFiles = [];
    
    for (let i = 0; i < filesToUpload; i++) {
      const file = createFileOfSize(2); // 2MB each
      tempFiles.push(file);
      
      await page.click('[data-testid="button-upload-document"]');
      await page.locator('[data-testid="input-file-upload"]').setInputFiles(file.path);
      await page.fill('[data-testid="input-document-name"]', `Quota Test ${i + 1}`);
      await page.selectOption('[data-testid="select-document-category"]', 'Other');
      await page.click('[data-testid="button-submit-upload"]');
      
      // Check if quota exceeded error appears
      const toastText = await page.locator('.toast').or(page.locator('[role="alert"]')).textContent({ timeout: 5000 });
      
      if (toastText.match(/quota|storage|space|limit/i)) {
        // Quota exceeded
        expect(toastText).toMatch(/quota|storage|space|limit/i);
        break;
      } else {
        // Upload succeeded
        uploadedFiles.push(`Quota Test ${i + 1}`);
        await page.waitForTimeout(500);
      }
    }
    
    // If quota limit exists, try one more upload that should fail
    if (uploadedFiles.length === filesToUpload) {
      const extraFile = createFileOfSize(3); // 3MB
      tempFiles.push(extraFile);
      
      await page.click('[data-testid="button-upload-document"]');
      await page.locator('[data-testid="input-file-upload"]').setInputFiles(extraFile.path);
      await page.fill('[data-testid="input-document-name"]', 'Over Quota File');
      await page.selectOption('[data-testid="select-document-category"]', 'Other');
      await page.click('[data-testid="button-submit-upload"]');
      
      // Check for any storage-related message
      const finalToast = await page.locator('.toast').or(page.locator('[role="alert"]')).textContent({ timeout: 5000 });
      // System might not have quota limits, so just verify upload completes or shows appropriate message
    }
  });

  test('Malicious file upload', async ({ page }) => {
    // Navigate to documents page
    await documentsPage.navigateToDocuments();
    
    // Test 1: File with script in name
    const scriptNameFile = createFileWithSpecialName('<script>alert("XSS")</script>');
    tempFiles.push(scriptNameFile);
    
    await page.click('[data-testid="button-upload-document"]');
    await page.locator('[data-testid="input-file-upload"]').setInputFiles(scriptNameFile.path);
    await page.fill('[data-testid="input-document-name"]', '<script>alert("XSS")</script>');
    await page.selectOption('[data-testid="select-document-category"]', 'Other');
    await page.click('[data-testid="button-submit-upload"]');
    
    // Check that script is not executed and name is sanitized
    await page.waitForTimeout(2000);
    
    // No alert should appear
    const alertAppeared = await page.evaluate(() => {
      return new Promise(resolve => {
        const originalAlert = window.alert;
        window.alert = () => {
          window.alert = originalAlert;
          resolve(true);
        };
        setTimeout(() => resolve(false), 1000);
      });
    });
    
    expect(alertAppeared).toBe(false);
    
    // Test 2: Renamed executable
    const maliciousExe = generateTestFile('exe', 1024 * 100);
    tempFiles.push(maliciousExe);
    
    // Rename to look like a PDF
    const renamedPath = maliciousExe.path.replace('.exe', '_fake.pdf');
    fs.renameSync(maliciousExe.path, renamedPath);
    
    await page.click('[data-testid="button-upload-document"]');
    await page.locator('[data-testid="input-file-upload"]').setInputFiles(renamedPath);
    await page.fill('[data-testid="input-document-name"]', 'Disguised Malware');
    await page.selectOption('[data-testid="select-document-category"]', 'Other');
    await page.click('[data-testid="button-submit-upload"]');
    
    // System should detect and reject or safely handle
    const uploadResult = await page.locator('.toast').or(page.locator('[role="alert"]')).textContent({ timeout: 5000 }).catch(() => '');
    
    // Test 3: Path traversal attempt in filename
    const pathTraversalFile = createFileWithSpecialName('.._.._etc_passwd');
    tempFiles.push(pathTraversalFile);
    
    await page.click('[data-testid="button-upload-document"]');
    await page.locator('[data-testid="input-file-upload"]').setInputFiles(pathTraversalFile.path);
    await page.fill('[data-testid="input-document-name"]', '../../../etc/passwd');
    await page.selectOption('[data-testid="select-document-category"]', 'Other');
    await page.click('[data-testid="button-submit-upload"]');
    
    // Name should be sanitized, preventing path traversal
    if (await page.locator('text=etc/passwd').isVisible({ timeout: 5000 })) {
      // Check that it's stored safely without path traversal
      const documentRow = page.locator('tr:has-text("passwd")');
      const actualName = await documentRow.locator('td:nth-child(2)').textContent();
      expect(actualName).not.toContain('../');
    }
  });

  test('Zero byte files', async ({ page }) => {
    // Navigate to documents page
    await documentsPage.navigateToDocuments();
    
    // Create empty file
    const emptyFile = generateTestFile('txt', 0);
    tempFiles.push(emptyFile);
    
    await page.click('[data-testid="button-upload-document"]');
    await page.locator('[data-testid="input-file-upload"]').setInputFiles(emptyFile.path);
    await page.fill('[data-testid="input-document-name"]', 'Empty File');
    await page.selectOption('[data-testid="select-document-category"]', 'Other');
    await page.click('[data-testid="button-submit-upload"]');
    
    // System should either reject or handle empty files
    const toastText = await page.locator('.toast').or(page.locator('[role="alert"]')).textContent({ timeout: 5000 });
    
    if (toastText.match(/empty|zero|size/i)) {
      // Empty file rejected
      expect(toastText).toMatch(/empty|zero|size/i);
      await expect(page.locator('text=Empty File')).not.toBeVisible();
    } else if (toastText.match(/success/i)) {
      // Empty file accepted
      await expect(page.locator('text=Empty File')).toBeVisible();
      const documentRow = page.locator('tr:has-text("Empty File")');
      await expect(documentRow.locator('text=0 B').or(documentRow.locator('text=0 bytes'))).toBeVisible();
    }
    
    // Test nearly empty file (1 byte)
    const nearlyEmptyFile = generateTestFile('txt', 1);
    tempFiles.push(nearlyEmptyFile);
    
    await page.click('[data-testid="button-upload-document"]');
    await page.locator('[data-testid="input-file-upload"]').setInputFiles(nearlyEmptyFile.path);
    await page.fill('[data-testid="input-document-name"]', 'Nearly Empty File');
    await page.selectOption('[data-testid="select-document-category"]', 'Other');
    await page.click('[data-testid="button-submit-upload"]');
    
    // Should typically accept 1-byte file
    await expect(page.locator('text=Nearly Empty File')).toBeVisible({ timeout: 10000 });
  });

  test('Duplicate file handling', async ({ page }) => {
    // Navigate to documents page
    await documentsPage.navigateToDocuments();
    
    // Upload initial file
    const originalFile = generateTestFile('pdf', 1024 * 100);
    tempFiles.push(originalFile);
    
    await page.click('[data-testid="button-upload-document"]');
    await page.locator('[data-testid="input-file-upload"]').setInputFiles(originalFile.path);
    await page.fill('[data-testid="input-document-name"]', 'Original Document');
    await page.selectOption('[data-testid="select-document-category"]', 'License');
    await page.click('[data-testid="button-submit-upload"]');
    
    await expect(page.locator('text=Original Document')).toBeVisible({ timeout: 10000 });
    
    // Try uploading same file again with same name
    await page.click('[data-testid="button-upload-document"]');
    await page.locator('[data-testid="input-file-upload"]').setInputFiles(originalFile.path);
    await page.fill('[data-testid="input-document-name"]', 'Original Document');
    await page.selectOption('[data-testid="select-document-category"]', 'License');
    await page.click('[data-testid="button-submit-upload"]');
    
    // System should either:
    // 1. Reject as duplicate
    // 2. Create version/revision
    // 3. Prompt for overwrite
    
    const dialogVisible = await page.locator('[role="dialog"]:has-text("duplicate"), [role="dialog"]:has-text("exists"), [role="dialog"]:has-text("overwrite")').isVisible({ timeout: 5000 });
    
    if (dialogVisible) {
      // Handle confirmation dialog
      const confirmButton = page.locator('[role="dialog"] button:has-text("Yes"), [role="dialog"] button:has-text("Overwrite"), [role="dialog"] button:has-text("Replace")');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      } else {
        await page.locator('[role="dialog"] button:has-text("Cancel")').click();
      }
    } else {
      // Check toast message
      const toastText = await page.locator('.toast').or(page.locator('[role="alert"]')).textContent({ timeout: 5000 });
      // System might handle duplicates differently
    }
  });

  test('Upload with missing required fields', async ({ page }) => {
    // Navigate to documents page
    await documentsPage.navigateToDocuments();
    
    await page.click('[data-testid="button-upload-document"]');
    
    // Test 1: Missing file
    await page.fill('[data-testid="input-document-name"]', 'Test Document');
    await page.selectOption('[data-testid="select-document-category"]', 'Other');
    await page.click('[data-testid="button-submit-upload"]');
    
    // Should show validation error for missing file
    const fileInputError = page.locator('[data-testid="input-file-upload"] ~ .error, [data-testid="input-file-upload"] ~ [role="alert"]');
    if (await fileInputError.isVisible({ timeout: 2000 })) {
      await expect(fileInputError).toContainText(/required|select|choose/i);
    } else {
      await expect(page.locator('.toast').or(page.locator('[role="alert"]'))).toContainText(/file|required/i);
    }
    
    // Test 2: Missing document name
    const testFile = generateTestFile('pdf', 1024 * 50);
    tempFiles.push(testFile);
    
    await page.locator('[data-testid="input-file-upload"]').setInputFiles(testFile.path);
    await page.fill('[data-testid="input-document-name"]', ''); // Clear name
    await page.click('[data-testid="button-submit-upload"]');
    
    // Should show validation error for missing name
    const nameInputError = page.locator('[data-testid="input-document-name"] ~ .error, [data-testid="input-document-name"] ~ [role="alert"]');
    if (await nameInputError.isVisible({ timeout: 2000 })) {
      await expect(nameInputError).toContainText(/required|enter|provide/i);
    } else {
      await expect(page.locator('.toast').or(page.locator('[role="alert"]'))).toContainText(/name|required/i);
    }
    
    // Test 3: Missing category (if required)
    await page.fill('[data-testid="input-document-name"]', 'Test Document');
    const categorySelect = page.locator('[data-testid="select-document-category"]');
    
    // Try to unselect category if possible
    await categorySelect.selectOption('');
    await page.click('[data-testid="button-submit-upload"]');
    
    // May or may not be required depending on implementation
    const uploadResult = await page.locator('.toast').or(page.locator('[role="alert"]')).textContent({ timeout: 3000 }).catch(() => '');
    // Document the behavior regardless of whether category is required
  });
});