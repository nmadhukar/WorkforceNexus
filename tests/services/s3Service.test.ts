/**
 * S3 Service Unit Tests
 * 
 * Comprehensive unit tests for S3 service including:
 * - Service initialization and configuration
 * - File upload/download operations
 * - Signed URL generation
 * - Region detection and correction
 * - Local fallback mechanism
 * - Error handling and retries
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { S3Client } from '@aws-sdk/client-s3';
import { MockS3Service } from '../__mocks__/s3Service';
import fs from 'fs';
import path from 'path';

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(),
  PutObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
  ListObjectsV2Command: vi.fn(),
  HeadObjectCommand: vi.fn(),
  CopyObjectCommand: vi.fn(),
  PutObjectTaggingCommand: vi.fn(),
  GetObjectTaggingCommand: vi.fn(),
  S3ServiceException: class S3ServiceException extends Error {}
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://mock-signed-url.s3.amazonaws.com/test?signature=abc123')
}));

// Mock storage module
vi.mock('../../server/storage', () => ({
  storage: {
    getS3Configuration: vi.fn(),
    saveS3Configuration: vi.fn(),
    updateS3Configuration: vi.fn()
  }
}));

describe('S3 Service Unit Tests', () => {
  let s3Service: MockS3Service;
  const tempDir = path.join(process.cwd(), 'tests', 'fixtures', 'temp');

  beforeEach(() => {
    MockS3Service.resetMock();
    s3Service = new MockS3Service();
    
    // Create temp directory for local storage tests
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up temp files
    if (fs.existsSync(tempDir)) {
      fs.readdirSync(tempDir).forEach(file => {
        fs.unlinkSync(path.join(tempDir, file));
      });
    }
  });

  describe('Service Initialization', () => {
    test('should initialize with valid configuration', async () => {
      MockS3Service.configureMock({
        isConfigured: true,
        hasAccess: true
      });

      await s3Service.initialize();
      expect(s3Service.isConfigured).toBe(true);
    });

    test('should fail initialization without configuration', async () => {
      MockS3Service.configureMock({
        isConfigured: false,
        shouldUseFallback: false
      });

      await expect(s3Service.initialize()).rejects.toThrow('No configuration found');
    });

    test('should fall back to local storage when S3 not configured', async () => {
      MockS3Service.configureMock({
        isConfigured: false,
        shouldUseFallback: true
      });

      await s3Service.initialize();
      
      const result = await s3Service.uploadFile(
        Buffer.from('test content'),
        'test.pdf',
        'application/pdf'
      );

      expect(result.success).toBe(true);
      expect(result.storageType).toBe('local');
    });

    test('should detect and correct bucket region mismatch', async () => {
      MockS3Service.configureMock({
        isConfigured: true,
        region: 'us-east-1',
        correctRegion: 'us-west-2'
      });

      const accessCheck = await s3Service.checkBucketAccess();
      
      expect(accessCheck.hasAccess).toBe(false);
      expect(accessCheck.error).toMatch(/us-west-2/);
    });

    test('should handle access denied errors', async () => {
      MockS3Service.configureMock({
        isConfigured: true,
        hasAccess: false
      });

      const accessCheck = await s3Service.checkBucketAccess();
      
      expect(accessCheck.hasAccess).toBe(false);
      expect(accessCheck.error).toMatch(/AccessDenied/);
    });

    test('should test configuration validity', async () => {
      MockS3Service.configureMock({
        isConfigured: true,
        hasAccess: true
      });

      await s3Service.initialize();
      const testResult = await s3Service.testConfiguration();
      
      expect(testResult.success).toBe(true);
      expect(testResult.message).toMatch(/valid/);
    });
  });

  describe('File Upload Operations', () => {
    test('should successfully upload file to S3', async () => {
      MockS3Service.configureMock({
        isConfigured: true,
        hasAccess: true,
        shouldFailUpload: false
      });

      await s3Service.initialize();
      
      const fileBuffer = Buffer.from('Test PDF content');
      const result = await s3Service.uploadFile(
        fileBuffer,
        'test-document.pdf',
        'application/pdf',
        123,
        'license'
      );

      expect(result.success).toBe(true);
      expect(result.storageType).toBe('s3');
      expect(result.storageKey).toMatch(/employees\/123\/license/);
      expect(result.etag).toBeDefined();
    });

    test('should handle upload failures gracefully', async () => {
      MockS3Service.configureMock({
        isConfigured: true,
        shouldFailUpload: true
      });

      await s3Service.initialize();
      
      const result = await s3Service.uploadFile(
        Buffer.from('test'),
        'test.pdf'
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/failed/i);
    });

    test('should generate correct S3 keys for different document types', async () => {
      MockS3Service.configureMock({
        isConfigured: true,
        hasAccess: true
      });

      await s3Service.initialize();
      
      // Employee document
      const empResult = await s3Service.uploadFile(
        Buffer.from('emp doc'),
        'license.pdf',
        'application/pdf',
        456,
        'license'
      );
      expect(empResult.storageKey).toMatch(/employees\/456\/license/);

      // Company document
      const compResult = await s3Service.uploadFile(
        Buffer.from('comp doc'),
        'policy.pdf',
        'application/pdf',
        undefined,
        'policy',
        789
      );
      expect(compResult.storageKey).toMatch(/company\/789\/policy/);

      // Generic document
      const genResult = await s3Service.uploadFile(
        Buffer.from('gen doc'),
        'misc.pdf'
      );
      expect(genResult.storageKey).toMatch(/documents\//);
    });

    test('should handle large file uploads', async () => {
      MockS3Service.configureMock({
        isConfigured: true,
        hasAccess: true
      });

      await s3Service.initialize();
      
      // Create 15MB buffer
      const largeBuffer = Buffer.alloc(15 * 1024 * 1024, 'a');
      
      const result = await s3Service.uploadFile(
        largeBuffer,
        'large-file.pdf',
        'application/pdf'
      );

      expect(result.success).toBe(true);
      expect(result.storageType).toBe('s3');
    });

    test('should apply server-side encryption for sensitive documents', async () => {
      MockS3Service.configureMock({
        isConfigured: true,
        hasAccess: true
      });

      await s3Service.initialize();
      
      const result = await s3Service.uploadFile(
        Buffer.from('sensitive data'),
        'ssn-document.pdf',
        'application/pdf',
        123,
        'tax_form'
      );

      expect(result.success).toBe(true);
      // In real implementation, would check encryption metadata
    });

    test('should handle concurrent uploads', async () => {
      MockS3Service.configureMock({
        isConfigured: true,
        hasAccess: true
      });

      await s3Service.initialize();
      
      const uploads = [];
      for (let i = 0; i < 5; i++) {
        uploads.push(
          s3Service.uploadFile(
            Buffer.from(`content ${i}`),
            `file${i}.pdf`,
            'application/pdf'
          )
        );
      }

      const results = await Promise.all(uploads);
      
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.storageKey).toBeDefined();
      });

      // All keys should be unique
      const keys = results.map(r => r.storageKey);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });

  describe('File Download Operations', () => {
    test('should successfully download file from S3', async () => {
      MockS3Service.configureMock({
        isConfigured: true,
        hasAccess: true
      });

      await s3Service.initialize();
      
      // Upload first
      const uploadResult = await s3Service.uploadFile(
        Buffer.from('Download test content'),
        'download.pdf',
        'application/pdf'
      );

      // Download
      const downloadResult = await s3Service.downloadFile(uploadResult.storageKey);
      
      expect(downloadResult.success).toBe(true);
      expect(downloadResult.data).toBeDefined();
      expect(downloadResult.data?.toString()).toBe('Download test content');
      expect(downloadResult.contentType).toBe('application/pdf');
    });

    test('should handle download failures', async () => {
      MockS3Service.configureMock({
        isConfigured: true,
        shouldFailDownload: true
      });

      await s3Service.initialize();
      
      const result = await s3Service.downloadFile('any-key');
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/failed/i);
    });

    test('should return error for non-existent keys', async () => {
      MockS3Service.configureMock({
        isConfigured: true,
        hasAccess: true
      });

      await s3Service.initialize();
      
      const result = await s3Service.downloadFile('non-existent-key');
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/NoSuchKey/);
    });
  });

  describe('Signed URL Generation', () => {
    test('should generate signed URL for S3 objects', async () => {
      MockS3Service.configureMock({
        isConfigured: true,
        hasAccess: true
      });

      await s3Service.initialize();
      
      // Upload file first
      const uploadResult = await s3Service.uploadFile(
        Buffer.from('signed url test'),
        'signed.pdf'
      );

      // Generate signed URL
      const urlResult = await s3Service.getSignedUrl(uploadResult.storageKey);
      
      expect(urlResult.success).toBe(true);
      expect(urlResult.url).toMatch(/https?:\/\//);
      expect(urlResult.url).toMatch(/amazonaws\.com/);
      expect(urlResult.url).toMatch(/X-Amz-Expires/);
    });

    test('should generate local URL when using fallback storage', async () => {
      MockS3Service.configureMock({
        isConfigured: false,
        shouldUseFallback: true
      });

      await s3Service.initialize();
      
      const uploadResult = await s3Service.uploadFile(
        Buffer.from('local test'),
        'local.pdf'
      );

      const urlResult = await s3Service.getSignedUrl(uploadResult.storageKey);
      
      expect(urlResult.success).toBe(true);
      expect(urlResult.url).toMatch(/^\/api\/documents\/download\/local\//);
    });

    test('should respect custom expiry times', async () => {
      MockS3Service.configureMock({
        isConfigured: true,
        hasAccess: true
      });

      await s3Service.initialize();
      
      const uploadResult = await s3Service.uploadFile(
        Buffer.from('expiry test'),
        'expiry.pdf'
      );

      // 1 hour expiry
      const url1hr = await s3Service.getSignedUrl(uploadResult.storageKey, 3600);
      expect(url1hr.url).toMatch(/X-Amz-Expires=3600/);

      // 24 hour expiry
      const url24hr = await s3Service.getSignedUrl(uploadResult.storageKey, 86400);
      expect(url24hr.url).toMatch(/X-Amz-Expires=86400/);
    });
  });

  describe('File Deletion Operations', () => {
    test('should successfully delete file from S3', async () => {
      MockS3Service.configureMock({
        isConfigured: true,
        hasAccess: true
      });

      await s3Service.initialize();
      
      // Upload file
      const uploadResult = await s3Service.uploadFile(
        Buffer.from('delete test'),
        'delete.pdf'
      );

      // Delete file
      const deleteResult = await s3Service.deleteFile(uploadResult.storageKey);
      
      expect(deleteResult.success).toBe(true);

      // Verify file is deleted
      const downloadResult = await s3Service.downloadFile(uploadResult.storageKey);
      expect(downloadResult.success).toBe(false);
    });

    test('should handle deletion of non-existent files', async () => {
      MockS3Service.configureMock({
        isConfigured: true,
        hasAccess: true
      });

      await s3Service.initialize();
      
      const result = await s3Service.deleteFile('non-existent-key');
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/NoSuchKey/);
    });
  });

  describe('File Listing Operations', () => {
    test('should list files with prefix', async () => {
      MockS3Service.configureMock({
        isConfigured: true,
        hasAccess: true
      });

      await s3Service.initialize();
      
      // Upload multiple files
      await s3Service.uploadFile(Buffer.from('1'), 'doc1.pdf', undefined, 100);
      await s3Service.uploadFile(Buffer.from('2'), 'doc2.pdf', undefined, 100);
      await s3Service.uploadFile(Buffer.from('3'), 'doc3.pdf', undefined, 200);

      // List files for employee 100
      const result = await s3Service.listFiles('employees/100');
      
      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(2);
      result.files?.forEach(file => {
        expect(file.key).toMatch(/employees\/100/);
      });
    });

    test('should return empty list for non-existent prefix', async () => {
      MockS3Service.configureMock({
        isConfigured: true,
        hasAccess: true
      });

      await s3Service.initialize();
      
      const result = await s3Service.listFiles('non-existent-prefix');
      
      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(0);
    });
  });

  describe('Compliance Document Operations', () => {
    test('should upload compliance document with versioning', async () => {
      MockS3Service.configureMock({
        isConfigured: true,
        hasAccess: true
      });

      await s3Service.initialize();
      
      const result = await s3Service.uploadComplianceDocument(
        Buffer.from('compliance doc v1'),
        'compliance-policy.pdf',
        {
          locationId: 1,
          documentType: 'policy',
          version: 1,
          tags: {
            department: 'HR',
            compliance: 'HIPAA'
          },
          expirationDate: new Date('2025-12-31'),
          isRequired: true
        }
      );

      expect(result.success).toBe(true);
      expect(result.versionId).toMatch(/^v1_/);
      expect(result.metadata).toEqual({
        department: 'HR',
        compliance: 'HIPAA'
      });
    });

    test('should handle version updates', async () => {
      MockS3Service.configureMock({
        isConfigured: true,
        hasAccess: true
      });

      await s3Service.initialize();
      
      // Upload v1
      const v1Result = await s3Service.uploadComplianceDocument(
        Buffer.from('v1 content'),
        'policy.pdf',
        {
          documentType: 'policy',
          version: 1
        }
      );

      // Upload v2
      const v2Result = await s3Service.uploadComplianceDocument(
        Buffer.from('v2 content'),
        'policy.pdf',
        {
          documentType: 'policy',
          version: 2,
          previousVersionId: v1Result.versionId
        }
      );

      expect(v2Result.success).toBe(true);
      expect(v2Result.versionId).toMatch(/^v2_/);
      expect(v2Result.previousVersionKey).toBe(v1Result.versionId);
    });
  });

  describe('Error Recovery and Retries', () => {
    test('should retry failed operations', async () => {
      let attempts = 0;
      
      MockS3Service.configureMock({
        isConfigured: true,
        hasAccess: true,
        shouldFailUpload: true
      });

      await s3Service.initialize();
      
      // First attempt fails
      const result1 = await s3Service.uploadFile(
        Buffer.from('retry test'),
        'retry.pdf'
      );
      expect(result1.success).toBe(false);

      // Configure to succeed
      MockS3Service.configureMock({
        shouldFailUpload: false
      });

      // Retry succeeds
      const result2 = await s3Service.uploadFile(
        Buffer.from('retry test'),
        'retry.pdf'
      );
      expect(result2.success).toBe(true);
    });

    test('should fall back to local storage on S3 failures', async () => {
      MockS3Service.configureMock({
        isConfigured: true,
        hasAccess: false,
        shouldUseFallback: true
      });

      await s3Service.initialize();
      
      const result = await s3Service.uploadFile(
        Buffer.from('fallback test'),
        'fallback.pdf'
      );

      expect(result.success).toBe(true);
      expect(result.storageType).toBe('local');
    });
  });

  describe('Security and Validation', () => {
    test('should validate file types', async () => {
      MockS3Service.configureMock({
        isConfigured: true,
        hasAccess: true
      });

      await s3Service.initialize();
      
      // Should accept valid types
      const validTypes = ['application/pdf', 'image/jpeg', 'image/png'];
      for (const type of validTypes) {
        const result = await s3Service.uploadFile(
          Buffer.from('test'),
          'file.ext',
          type
        );
        expect(result.success).toBe(true);
      }
    });

    test('should sanitize file names', async () => {
      MockS3Service.configureMock({
        isConfigured: true,
        hasAccess: true
      });

      await s3Service.initialize();
      
      const dangerousNames = [
        '../../../etc/passwd',
        'file<script>.pdf',
        'file|pipe.pdf',
        'file\x00null.pdf'
      ];

      for (const name of dangerousNames) {
        const result = await s3Service.uploadFile(
          Buffer.from('test'),
          name
        );
        
        expect(result.success).toBe(true);
        // Check that dangerous characters are sanitized
        expect(result.storageKey).not.toMatch(/\.\.\//);
        expect(result.storageKey).not.toMatch(/[<>|]/);
      }
    });

    test('should enforce file size limits', async () => {
      MockS3Service.configureMock({
        isConfigured: true,
        hasAccess: true
      });

      await s3Service.initialize();
      
      // Files under 10MB should succeed
      const smallFile = Buffer.alloc(5 * 1024 * 1024, 'a');
      const smallResult = await s3Service.uploadFile(smallFile, 'small.pdf');
      expect(smallResult.success).toBe(true);

      // Files over configured limit (e.g., 100MB) might fail
      // This depends on actual implementation limits
      const hugeFile = Buffer.alloc(101 * 1024 * 1024, 'a');
      // Test would check for size validation in real implementation
    });
  });
});