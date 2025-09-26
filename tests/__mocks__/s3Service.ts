/**
 * Mock S3 Service for Testing
 * 
 * Provides comprehensive S3 service mocking with various scenarios including:
 * - Region detection and mismatch
 * - Access denied scenarios
 * - Successful uploads/downloads
 * - Fallback to local storage
 * - Signed URL generation
 */

import { vi } from 'vitest';
import type { 
  UploadResult, 
  DownloadResult, 
  FileInfo,
  ComplianceUploadOptions,
  ComplianceDownloadOptions,
  VersionedUploadResult
} from '../../server/services/s3Service';

// Mock storage for simulating different scenarios
const mockStorage = new Map<string, {
  data: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
  versionId?: string;
}>();

// Configuration for mock behavior
let mockConfig = {
  isConfigured: false,
  bucketExists: true,
  hasAccess: true,
  region: 'us-east-1',
  correctRegion: 'us-west-2',
  shouldFailUpload: false,
  shouldFailDownload: false,
  shouldUseFallback: false,
  signedUrlExpiry: 3600
};

// Mock S3 Service Class
class MockS3Service {
  private _isConfigured = mockConfig.isConfigured;
  private localFallbackPath = '/tmp/mock-uploads';

  async initialize(): Promise<void> {
    if (!mockConfig.isConfigured && !mockConfig.shouldUseFallback) {
      throw new Error('S3 Service: No configuration found');
    }
  }

  async checkBucketAccess(): Promise<{ hasAccess: boolean; error?: string }> {
    if (!mockConfig.bucketExists) {
      return {
        hasAccess: false,
        error: 'NoSuchBucket: The specified bucket does not exist'
      };
    }

    if (mockConfig.region !== mockConfig.correctRegion) {
      return {
        hasAccess: false,
        error: `PermanentRedirect: The bucket you are attempting to access must be addressed using the specified endpoint. Bucket is in region: ${mockConfig.correctRegion}`
      };
    }

    if (!mockConfig.hasAccess) {
      return {
        hasAccess: false,
        error: 'AccessDenied: Access denied to bucket'
      };
    }

    return { hasAccess: true };
  }

  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType?: string,
    employeeId?: number,
    documentType?: string,
    companyId?: number
  ): Promise<UploadResult> {
    if (mockConfig.shouldFailUpload) {
      return {
        success: false,
        storageType: 's3',
        storageKey: '',
        error: 'Upload failed due to network error'
      };
    }

    if (mockConfig.shouldUseFallback || !mockConfig.isConfigured) {
      // Simulate local storage fallback
      const localKey = `local_${Date.now()}_${fileName}`;
      mockStorage.set(localKey, {
        data: fileBuffer,
        contentType: mimeType || 'application/octet-stream'
      });

      return {
        success: true,
        storageType: 'local',
        storageKey: localKey,
        etag: `"${Date.now()}"`
      };
    }

    // Simulate S3 upload
    const s3Key = generateDocumentKey(fileName, employeeId, documentType, companyId);
    mockStorage.set(s3Key, {
      data: fileBuffer,
      contentType: mimeType || 'application/octet-stream'
    });

    return {
      success: true,
      storageType: 's3',
      storageKey: s3Key,
      etag: `"${Buffer.from(fileBuffer).toString('base64').slice(0, 32)}"`
    };
  }

  async uploadComplianceDocument(
    fileBuffer: Buffer,
    fileName: string,
    options: ComplianceUploadOptions
  ): Promise<VersionedUploadResult> {
    const baseResult = await this.uploadFile(
      fileBuffer,
      fileName,
      'application/pdf',
      undefined,
      options.documentType
    );

    const versionId = `v${options.version || 1}_${Date.now()}`;
    
    if (baseResult.success && baseResult.storageKey) {
      const stored = mockStorage.get(baseResult.storageKey);
      if (stored) {
        stored.versionId = versionId;
        stored.metadata = {
          documentType: options.documentType,
          version: String(options.version || 1),
          ...(options.tags || {})
        };
      }
    }

    return {
      ...baseResult,
      versionId,
      previousVersionKey: options.previousVersionId,
      metadata: options.tags
    };
  }

  async downloadFile(storageKey: string): Promise<DownloadResult> {
    if (mockConfig.shouldFailDownload) {
      return {
        success: false,
        error: 'Download failed due to network error'
      };
    }

    const file = mockStorage.get(storageKey);
    if (!file) {
      return {
        success: false,
        error: 'NoSuchKey: The specified key does not exist'
      };
    }

    return {
      success: true,
      data: file.data,
      contentType: file.contentType
    };
  }

  async deleteFile(storageKey: string): Promise<{ success: boolean; error?: string }> {
    if (!mockStorage.has(storageKey)) {
      return {
        success: false,
        error: 'NoSuchKey: The specified key does not exist'
      };
    }

    mockStorage.delete(storageKey);
    return { success: true };
  }

  async getSignedUrl(
    storageKey: string,
    expiresIn: number = 3600
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    if (!mockStorage.has(storageKey)) {
      return {
        success: false,
        error: 'NoSuchKey: The specified key does not exist'
      };
    }

    if (mockConfig.shouldUseFallback) {
      return {
        success: true,
        url: `/api/documents/download/local/${storageKey}`
      };
    }

    return {
      success: true,
      url: `https://mock-bucket.s3.${mockConfig.region}.amazonaws.com/${storageKey}?X-Amz-Expires=${expiresIn}`
    };
  }

  async listFiles(prefix?: string): Promise<{ success: boolean; files?: FileInfo[]; error?: string }> {
    const files: FileInfo[] = [];
    
    for (const [key, value] of mockStorage.entries()) {
      if (!prefix || key.startsWith(prefix)) {
        files.push({
          key,
          size: value.data.length,
          lastModified: new Date(),
          etag: `"${Buffer.from(value.data).toString('base64').slice(0, 32)}"`
        });
      }
    }

    return {
      success: true,
      files
    };
  }

  async testConfiguration(): Promise<{ success: boolean; message: string }> {
    const accessCheck = await this.checkBucketAccess();
    
    if (!accessCheck.hasAccess) {
      return {
        success: false,
        message: accessCheck.error || 'Configuration test failed'
      };
    }

    return {
      success: true,
      message: 'S3 configuration is valid and bucket is accessible'
    };
  }

  get isConfigured(): boolean {
    return this._isConfigured;
  }

  // Helper to configure mock behavior
  static configureMock(config: Partial<typeof mockConfig>) {
    Object.assign(mockConfig, config);
  }

  // Helper to reset mock state
  static resetMock() {
    mockStorage.clear();
    mockConfig = {
      isConfigured: false,
      bucketExists: true,
      hasAccess: true,
      region: 'us-east-1',
      correctRegion: 'us-west-2',
      shouldFailUpload: false,
      shouldFailDownload: false,
      shouldUseFallback: false,
      signedUrlExpiry: 3600
    };
  }

  // Helper to get mock storage state
  static getMockStorage() {
    return mockStorage;
  }
}

// Helper function to generate document keys
export function generateDocumentKey(
  fileName: string,
  employeeId?: number,
  documentType?: string,
  companyId?: number
): string {
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  
  if (companyId && documentType) {
    return `company/${companyId}/${documentType}/${timestamp}_${sanitizedFileName}`;
  } else if (employeeId && documentType) {
    return `employees/${employeeId}/${documentType}/${timestamp}_${sanitizedFileName}`;
  } else if (employeeId) {
    return `employees/${employeeId}/documents/${timestamp}_${sanitizedFileName}`;
  } else {
    return `documents/${timestamp}_${sanitizedFileName}`;
  }
}

// Export mock instance
export const s3Service = new MockS3Service();

// Export mock class for testing
export { MockS3Service };