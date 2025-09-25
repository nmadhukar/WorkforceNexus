/**
 * Document Testing Helpers
 * @description Utility functions for document upload and management testing
 */

import { Page, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Generate test file with specific content and size
 * @param type - File type (pdf, txt, docx, jpg, png, xlsx, etc.)
 * @param size - Size in bytes
 * @returns Object with file path and cleanup function
 */
export function generateTestFile(type: string, size: number): { path: string; cleanup: () => void } {
  const tempDir = path.join(process.cwd(), 'tests', 'ui', 'fixtures', 'temp');
  
  // Create temp directory if it doesn't exist
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const fileName = `test-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${type}`;
  const filePath = path.join(tempDir, fileName);
  
  // Generate content based on file type
  let content: Buffer;
  
  switch (type) {
    case 'pdf':
      // Create a simple PDF header and content
      const pdfHeader = '%PDF-1.4\n';
      const pdfContent = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
      const padding = Buffer.alloc(Math.max(0, size - pdfHeader.length - pdfContent.length), ' ');
      content = Buffer.concat([Buffer.from(pdfHeader), Buffer.from(pdfContent), padding]);
      break;
      
    case 'jpg':
    case 'jpeg':
      // Create a minimal JPEG with proper headers
      const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]); // JPEG SOI and APP0 marker
      const jpegPadding = Buffer.alloc(Math.max(0, size - jpegHeader.length), 0);
      content = Buffer.concat([jpegHeader, jpegPadding]);
      break;
      
    case 'png':
      // Create a minimal PNG with proper headers
      const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // PNG signature
      const pngPadding = Buffer.alloc(Math.max(0, size - pngHeader.length), 0);
      content = Buffer.concat([pngHeader, pngPadding]);
      break;
      
    case 'docx':
      // Create a minimal DOCX (which is a ZIP file)
      const zipHeader = Buffer.from([0x50, 0x4B, 0x03, 0x04]); // ZIP header
      const docxPadding = Buffer.alloc(Math.max(0, size - zipHeader.length), 0);
      content = Buffer.concat([zipHeader, docxPadding]);
      break;
      
    case 'exe':
      // Create a minimal EXE header (for testing rejection)
      const exeHeader = Buffer.from('MZ'); // DOS header
      const exePadding = Buffer.alloc(Math.max(0, size - exeHeader.length), 0);
      content = Buffer.concat([exeHeader, exePadding]);
      break;
      
    case 'sh':
      // Create a shell script (for testing rejection)
      const shHeader = '#!/bin/bash\n';
      const shContent = 'echo "test script"\n';
      const shPadding = ' '.repeat(Math.max(0, size - shHeader.length - shContent.length));
      content = Buffer.from(shHeader + shContent + shPadding);
      break;
      
    default:
      // Generic text file
      content = Buffer.alloc(size, 'Test content for file upload. ');
  }
  
  // Ensure content matches requested size
  if (content.length > size) {
    content = content.subarray(0, size);
  } else if (content.length < size) {
    const padding = Buffer.alloc(size - content.length, ' ');
    content = Buffer.concat([content, padding]);
  }
  
  fs.writeFileSync(filePath, content);
  
  return {
    path: filePath,
    cleanup: () => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  };
}

/**
 * Create file with specific size in MB
 * @param sizeInMB - Size in megabytes
 * @returns Object with file path and cleanup function
 */
export function createFileOfSize(sizeInMB: number): { path: string; cleanup: () => void } {
  const sizeInBytes = sizeInMB * 1024 * 1024;
  return generateTestFile('txt', sizeInBytes);
}

/**
 * Upload document helper for Playwright tests
 * @param page - Playwright page object
 * @param file - File path to upload
 * @param employeeId - Optional employee ID to associate document with
 * @returns Document ID if available
 */
export async function uploadDocument(
  page: Page, 
  file: string, 
  employeeId?: string
): Promise<string | undefined> {
  // Navigate to documents page if not already there
  if (!page.url().includes('/documents')) {
    await page.goto('/documents');
    await page.waitForSelector('h1:has-text("Documents")', { timeout: 10000 });
  }
  
  // Click upload button
  await page.click('[data-testid="button-upload-document"]');
  
  // Wait for upload dialog
  await page.waitForSelector('[data-testid="input-file-upload"]', { timeout: 5000 });
  
  // Set file input
  const fileInput = page.locator('[data-testid="input-file-upload"]');
  await fileInput.setInputFiles(file);
  
  // Fill in document name
  const fileName = path.basename(file);
  await page.fill('[data-testid="input-document-name"]', fileName);
  
  // Select category
  await page.selectOption('[data-testid="select-document-category"]', 'Other');
  
  // Associate with employee if provided
  if (employeeId) {
    await page.selectOption('[data-testid="select-document-employee"]', employeeId);
  }
  
  // Submit upload
  await page.click('[data-testid="button-submit-upload"]');
  
  // Wait for success toast
  await page.waitForSelector('.toast:has-text("success")', { timeout: 10000 });
  
  // Try to extract document ID from response or table
  try {
    const latestRow = page.locator('table tbody tr').first();
    const docIdElement = await latestRow.getAttribute('data-document-id');
    return docIdElement || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Verify document appears in list
 * @param page - Playwright page object
 * @param fileName - Name of file to verify
 * @returns True if document found, false otherwise
 */
export async function verifyDocumentInList(page: Page, fileName: string): Promise<boolean> {
  // Navigate to documents page if not already there
  if (!page.url().includes('/documents')) {
    await page.goto('/documents');
    await page.waitForSelector('h1:has-text("Documents")', { timeout: 10000 });
  }
  
  // Search for document
  await page.fill('[data-testid="input-document-search"]', fileName);
  await page.press('[data-testid="input-document-search"]', 'Enter');
  
  // Wait for table to update
  await page.waitForTimeout(1000);
  
  // Check if document exists in table
  const documentRow = page.locator(`tr:has-text("${fileName}")`);
  const count = await documentRow.count();
  
  return count > 0;
}

/**
 * Download document and verify content
 * @param page - Playwright page object
 * @param docId - Document ID or name
 * @returns Downloaded file path
 */
export async function downloadAndVerify(page: Page, docId: string): Promise<string> {
  // Navigate to documents page if not already there
  if (!page.url().includes('/documents')) {
    await page.goto('/documents');
    await page.waitForSelector('h1:has-text("Documents")', { timeout: 10000 });
  }
  
  // Find document row
  const documentRow = page.locator(`tr:has-text("${docId}")`);
  const downloadButton = documentRow.locator('[data-testid*="download"], button:has-text("Download")');
  
  // Start waiting for download before clicking
  const downloadPromise = page.waitForEvent('download');
  await downloadButton.click();
  const download = await downloadPromise;
  
  // Save to temp location
  const tempPath = path.join(process.cwd(), 'tests', 'ui', 'fixtures', 'temp', `download-${Date.now()}.tmp`);
  await download.saveAs(tempPath);
  
  // Verify file exists and has content
  expect(fs.existsSync(tempPath)).toBeTruthy();
  const stats = fs.statSync(tempPath);
  expect(stats.size).toBeGreaterThan(0);
  
  return tempPath;
}

/**
 * Clean up test documents from database
 * @param documentIds - Array of document IDs to clean up
 */
export async function cleanupTestDocuments(documentIds: string[]): Promise<void> {
  if (!documentIds || documentIds.length === 0) return;
  
  // This would typically call an API endpoint or database cleanup function
  // For now, we'll use the test database utilities
  try {
    const { testDb } = await import('./test-db');
    // Clean up documents by IDs if the method exists
    // This is a placeholder - actual implementation depends on test-db structure
    console.log(`Cleaning up ${documentIds.length} test documents`);
  } catch (error) {
    console.error('Failed to cleanup test documents:', error);
  }
}

/**
 * Create a file with special characters in name
 * @param specialChars - String of special characters to include
 * @returns Object with file path and cleanup function
 */
export function createFileWithSpecialName(specialChars: string): { path: string; cleanup: () => void } {
  const tempDir = path.join(process.cwd(), 'tests', 'ui', 'fixtures', 'temp');
  
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // Sanitize filename for filesystem but keep special chars for testing
  const safeName = `test${specialChars.replace(/[<>:"/\\|?*]/g, '_')}${Date.now()}.txt`;
  const filePath = path.join(tempDir, safeName);
  
  fs.writeFileSync(filePath, 'Test content with special filename');
  
  return {
    path: filePath,
    cleanup: () => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  };
}

/**
 * Create a file with very long name
 * @param length - Desired length of filename
 * @returns Object with file path and cleanup function
 */
export function createFileWithLongName(length: number): { path: string; cleanup: () => void } {
  const tempDir = path.join(process.cwd(), 'tests', 'ui', 'fixtures', 'temp');
  
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // Create long filename
  const longName = 'a'.repeat(Math.max(1, length - 4)) + '.txt'; // Reserve 4 chars for extension
  const filePath = path.join(tempDir, longName);
  
  try {
    fs.writeFileSync(filePath, 'Test content with long filename');
  } catch (error) {
    // If filename is too long for filesystem, create with max allowed length
    const maxName = 'a'.repeat(250) + '.txt';
    const altPath = path.join(tempDir, maxName);
    fs.writeFileSync(altPath, 'Test content with long filename');
    return {
      path: altPath,
      cleanup: () => {
        if (fs.existsSync(altPath)) {
          fs.unlinkSync(altPath);
        }
      }
    };
  }
  
  return {
    path: filePath,
    cleanup: () => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  };
}

/**
 * Simulate network interruption during upload
 * @param page - Playwright page object
 */
export async function simulateNetworkInterruption(page: Page): Promise<void> {
  // Use Chrome DevTools Protocol to simulate offline mode
  const client = await page.context().newCDPSession(page);
  await client.send('Network.emulateNetworkConditions', {
    offline: true,
    downloadThroughput: 0,
    uploadThroughput: 0,
    latency: 0
  });
  
  // Wait a moment for the condition to take effect
  await page.waitForTimeout(500);
}

/**
 * Restore network connection
 * @param page - Playwright page object
 */
export async function restoreNetwork(page: Page): Promise<void> {
  const client = await page.context().newCDPSession(page);
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: -1,
    uploadThroughput: -1,
    latency: 0
  });
  
  await page.waitForTimeout(500);
}

/**
 * Upload multiple files simultaneously
 * @param page - Playwright page object
 * @param files - Array of file paths
 * @returns Array of upload results
 */
export async function uploadMultipleFiles(
  page: Page,
  files: string[]
): Promise<{ fileName: string; success: boolean }[]> {
  const results: { fileName: string; success: boolean }[] = [];
  
  // Navigate to documents page
  if (!page.url().includes('/documents')) {
    await page.goto('/documents');
    await page.waitForSelector('h1:has-text("Documents")', { timeout: 10000 });
  }
  
  // Click upload button
  await page.click('[data-testid="button-upload-document"]');
  
  // Wait for upload dialog
  await page.waitForSelector('[data-testid="input-file-upload"]', { timeout: 5000 });
  
  // Set multiple files at once if supported
  const fileInput = page.locator('[data-testid="input-file-upload"]');
  
  // Check if multiple file upload is supported
  const multiple = await fileInput.getAttribute('multiple');
  
  if (multiple !== null) {
    // Upload all at once
    await fileInput.setInputFiles(files);
    await page.click('[data-testid="button-submit-upload"]');
    
    // Wait for completion and check results
    await page.waitForTimeout(2000);
    
    for (const file of files) {
      const fileName = path.basename(file);
      const found = await verifyDocumentInList(page, fileName);
      results.push({ fileName, success: found });
    }
  } else {
    // Upload one by one
    for (const file of files) {
      const fileName = path.basename(file);
      try {
        await uploadDocument(page, file);
        results.push({ fileName, success: true });
      } catch (error) {
        results.push({ fileName, success: false });
      }
    }
  }
  
  return results;
}

/**
 * Check S3 storage status
 * @param page - Playwright page object
 * @returns Object indicating S3 configuration status
 */
export async function checkS3StorageStatus(page: Page): Promise<{
  configured: boolean;
  enabled: boolean;
  bucketName?: string;
}> {
  // Make API call to check S3 status
  const response = await page.evaluate(async () => {
    const res = await fetch('/api/storage/status', { credentials: 'include' });
    return res.json();
  });
  
  return {
    configured: response.configured || false,
    enabled: response.enabled || false,
    bucketName: response.bucketName
  };
}

/**
 * Configure S3 storage for testing
 * @param page - Playwright page object
 * @param config - S3 configuration
 */
export async function configureS3Storage(page: Page, config: {
  accessKey: string;
  secretKey: string;
  region: string;
  bucket: string;
}): Promise<void> {
  // Navigate to admin settings
  await page.goto('/settings');
  
  // Click on S3 configuration tab
  await page.click('text=S3 Storage');
  
  // Fill in S3 configuration
  await page.fill('[data-testid="input-s3-access-key"]', config.accessKey);
  await page.fill('[data-testid="input-s3-secret-key"]', config.secretKey);
  await page.fill('[data-testid="input-s3-region"]', config.region);
  await page.fill('[data-testid="input-s3-bucket"]', config.bucket);
  
  // Save configuration
  await page.click('[data-testid="button-save-s3-config"]');
  
  // Wait for success
  await page.waitForSelector('.toast:has-text("success")', { timeout: 10000 });
}

/**
 * Generate test files of different types
 * @returns Array of test file objects with paths and metadata
 */
export function generateVariousTestFiles(): Array<{
  path: string;
  type: string;
  name: string;
  size: number;
  shouldSucceed: boolean;
  cleanup: () => void;
}> {
  const files = [];
  
  // PDF file
  const pdf = generateTestFile('pdf', 1024 * 100); // 100KB
  files.push({
    ...pdf,
    type: 'pdf',
    name: 'test-document.pdf',
    size: 1024 * 100,
    shouldSucceed: true
  });
  
  // Word document
  const docx = generateTestFile('docx', 1024 * 150); // 150KB
  files.push({
    ...docx,
    type: 'docx',
    name: 'test-document.docx',
    size: 1024 * 150,
    shouldSucceed: true
  });
  
  // JPEG image
  const jpg = generateTestFile('jpg', 1024 * 200); // 200KB
  files.push({
    ...jpg,
    type: 'jpg',
    name: 'test-image.jpg',
    size: 1024 * 200,
    shouldSucceed: true
  });
  
  // PNG image
  const png = generateTestFile('png', 1024 * 180); // 180KB
  files.push({
    ...png,
    type: 'png',
    name: 'test-image.png',
    size: 1024 * 180,
    shouldSucceed: true
  });
  
  // Text file
  const txt = generateTestFile('txt', 1024 * 50); // 50KB
  files.push({
    ...txt,
    type: 'txt',
    name: 'test-document.txt',
    size: 1024 * 50,
    shouldSucceed: true
  });
  
  // Executable (should fail)
  const exe = generateTestFile('exe', 1024 * 100); // 100KB
  files.push({
    ...exe,
    type: 'exe',
    name: 'malicious.exe',
    size: 1024 * 100,
    shouldSucceed: false
  });
  
  // Shell script (should fail)
  const sh = generateTestFile('sh', 1024 * 10); // 10KB
  files.push({
    ...sh,
    type: 'sh',
    name: 'script.sh',
    size: 1024 * 10,
    shouldSucceed: false
  });
  
  return files;
}

/**
 * Clean up all temporary test files
 */
export function cleanupTempFiles(): void {
  const tempDir = path.join(process.cwd(), 'tests', 'ui', 'fixtures', 'temp');
  
  if (fs.existsSync(tempDir)) {
    const files = fs.readdirSync(tempDir);
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      try {
        fs.unlinkSync(filePath);
      } catch (error) {
        console.error(`Failed to delete ${filePath}:`, error);
      }
    }
  }
}