/**
 * @fileoverview Amazon S3 Storage Service
 * 
 * This module provides a comprehensive interface for interacting with Amazon S3
 * or S3-compatible storage services. It handles document storage, retrieval,
 * and management with built-in error handling and fallback mechanisms.
 * 
 * Features:
 * - Upload files to S3 with structured key paths
 * - Download files from S3
 * - Delete files from S3
 * - Generate time-limited signed URLs for secure access
 * - List files with prefix filtering
 * - Automatic fallback to local storage when S3 is not configured
 * - Server-side encryption support for sensitive documents
 * 
 * @module s3Service
 * @requires @aws-sdk/client-s3
 * @requires @aws-sdk/s3-request-presigner
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  type PutObjectCommandInput,
  type GetObjectCommandOutput,
  S3ServiceException
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';

/**
 * S3 configuration interface
 */
interface S3Config {
  region: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  endpoint?: string;
  bucketName: string;
}

/**
 * Upload result interface
 */
export interface UploadResult {
  success: boolean;
  storageType: 'local' | 's3';
  storageKey: string;
  etag?: string;
  error?: string;
}

/**
 * Download result interface
 */
export interface DownloadResult {
  success: boolean;
  data?: Buffer;
  contentType?: string;
  error?: string;
}

/**
 * File info interface for listing operations
 */
export interface FileInfo {
  key: string;
  size?: number;
  lastModified?: Date;
  etag?: string;
}

/**
 * S3 Service Class
 * 
 * Manages all interactions with Amazon S3 for document storage.
 * Provides fallback to local storage when S3 is not configured.
 */
class S3Service {
  private client: S3Client | null = null;
  private bucketName: string | null = null;
  private isConfigured: boolean = false;
  private localFallbackPath: string;

  constructor() {
    this.localFallbackPath = path.join(process.cwd(), 'server', 'uploads');
    this.initialize();
  }

  /**
   * Initialize S3 client with credentials from environment variables
   * @private
   */
  private initialize(): void {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || 'us-east-1';
    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    const endpoint = process.env.AWS_S3_ENDPOINT;

    if (!accessKeyId || !secretAccessKey || !bucketName) {
      console.log('S3 Service: AWS credentials not configured. Using local storage fallback.');
      this.isConfigured = false;
      return;
    }

    try {
      const config: any = {
        region,
        credentials: {
          accessKeyId,
          secretAccessKey
        },
        // Force path style to handle bucket endpoint issues
        forcePathStyle: true
      };

      // Add endpoint for S3-compatible services (e.g., MinIO, DigitalOcean Spaces)
      if (endpoint) {
        config.endpoint = endpoint;
      }

      this.client = new S3Client(config);
      this.bucketName = bucketName;
      
      // Check bucket access before marking as configured
      this.checkBucketAccess().then(isAccessible => {
        this.isConfigured = isAccessible;
        if (isAccessible) {
          console.log(`S3 Service: ✅ Initialized successfully with bucket ${bucketName}`);
        } else {
          console.error(`S3 Service: ⚠️ Bucket ${bucketName} is not accessible. Using local storage fallback.`);
          console.error(`S3 Service: This could be due to:`);
          console.error(`  1. Incorrect AWS_REGION (should be the region where your bucket is located)`);
          console.error(`  2. Missing IAM permissions for the bucket`);
          console.error(`  3. Bucket doesn't exist or wrong bucket name`);
          console.error(`S3 Service: Please check the logs above for more specific error details.`);
        }
      });
    } catch (error) {
      console.error('S3 Service: Failed to initialize:', error);
      this.isConfigured = false;
    }
  }

  /**
   * Check if S3 is properly configured
   * @returns {boolean} Configuration status
   */
  public isS3Configured(): boolean {
    return this.isConfigured;
  }

  /**
   * Check if S3 is configured (alias for isS3Configured)
   * @returns {boolean} Configuration status
   */
  public isConfigured(): boolean {
    return this.isConfigured;
  }

  /**
   * Get the configured bucket name (for safe display)
   * @returns {string | null} Bucket name or null if not configured
   */
  public getBucketName(): string | null {
    return this.bucketName;
  }

  /**
   * Check if the S3 bucket exists and is accessible
   * @returns {Promise<boolean>} True if bucket is accessible, false otherwise
   */
  public async checkBucketAccess(): Promise<boolean> {
    if (!this.client || !this.bucketName) {
      return false;
    }

    try {
      // Try to list objects with a limit of 1 to check bucket access
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        MaxKeys: 1
      });
      
      await this.client.send(command);
      return true;
    } catch (error: any) {
      if (error instanceof S3ServiceException) {
        console.error(`S3 Service: Bucket access check failed - ${error.name}: ${error.message}`);
        
        // Handle PermanentRedirect error by trying to parse the correct endpoint
        if (error.name === 'PermanentRedirect' && error.message) {
          console.error('S3 Service: Bucket requires specific endpoint. Error details:', {
            bucket: this.bucketName,
            currentRegion: process.env.AWS_REGION || 'us-east-1',
            errorMessage: error.message,
            errorCode: error.$metadata?.httpStatusCode,
            responseHeaders: error.$response?.headers
          });
          
          // Check response headers for x-amz-bucket-region
          const bucketRegion = error.$response?.headers?.['x-amz-bucket-region'] || 
                              error.$metadata?.headers?.['x-amz-bucket-region'];
          
          if (bucketRegion && bucketRegion !== (process.env.AWS_REGION || 'us-east-1')) {
            console.log(`S3 Service: Bucket '${this.bucketName}' is in region: ${bucketRegion}`);
            console.log(`S3 Service: Current configured region: ${process.env.AWS_REGION || 'us-east-1'}`);
            console.log(`S3 Service: Attempting to reinitialize client with correct region: ${bucketRegion}`);
            return await this.retryWithRegion(bucketRegion);
          }
          
          // Fallback: Try to extract the correct endpoint from the error message
          const endpointMatch = error.message.match(/endpoint:\s*([\w.-]+\.amazonaws\.com)/i);
          if (endpointMatch && endpointMatch[1]) {
            console.log(`S3 Service: Suggested endpoint from error: ${endpointMatch[1]}`);
            
            // Try to extract region from endpoint
            const regionMatch = endpointMatch[1].match(/s3\.([a-z]{2}-[a-z]+-\d+)\.amazonaws\.com/i) ||
                              endpointMatch[1].match(/([a-z]{2}-[a-z]+-\d+)\.amazonaws\.com/i);
            if (regionMatch && regionMatch[1]) {
              const detectedRegion = regionMatch[1];
              console.log(`S3 Service: Detected region from endpoint: ${detectedRegion}`);
              if (detectedRegion !== (process.env.AWS_REGION || 'us-east-1')) {
                console.log(`S3 Service: Attempting to reinitialize client with region ${detectedRegion}`);
                return await this.retryWithRegion(detectedRegion);
              }
            }
          }
          
          // If we can't determine the region, try common regions
          const commonRegions = ['us-west-2', 'us-west-1', 'eu-west-1', 'ap-southeast-1'];
          const currentRegion = process.env.AWS_REGION || 'us-east-1';
          
          for (const region of commonRegions) {
            if (region !== currentRegion) {
              console.log(`S3 Service: Trying common region: ${region}`);
              const success = await this.retryWithRegion(region);
              if (success) {
                return true;
              }
            }
          }
        } else if (error.name === 'NoSuchBucket') {
          console.error(`S3 Service: Bucket '${this.bucketName}' does not exist`);
        } else if (error.name === 'AccessDenied' || error.name === 'Forbidden') {
          console.error(`S3 Service: Access denied to bucket '${this.bucketName}'. Check IAM permissions.`);
        }
      } else {
        console.error('S3 Service: Bucket access check failed:', error);
      }
      return false;
    }
  }

  /**
   * Retry bucket access with a different region
   * @param {string} region - AWS region to try
   * @returns {Promise<boolean>} True if bucket is accessible with new region
   * @private
   */
  private async retryWithRegion(region: string): Promise<boolean> {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const endpoint = process.env.AWS_S3_ENDPOINT;

    if (!accessKeyId || !secretAccessKey || !this.bucketName) {
      return false;
    }

    // Create a new client with the correct region - moved outside try block
    const config: any = {
      region,
      credentials: {
        accessKeyId,
        secretAccessKey
      },
      forcePathStyle: true
    };

    if (endpoint) {
      config.endpoint = endpoint;
    }

    const tempClient = new S3Client(config);

    try {
      // Test with the new client
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        MaxKeys: 1
      });
      
      await tempClient.send(command);
      
      // If successful, update the main client
      this.client = tempClient;
      console.log(`S3 Service: Successfully connected to bucket '${this.bucketName}' in region ${region}`);
      console.log(`S3 Service: IMPORTANT: Update AWS_REGION environment variable to '${region}' for optimal performance`);
      
      return true;
    } catch (error: any) {
      if (error instanceof S3ServiceException) {
        if (error.name === 'AccessDenied') {
          console.error(`S3 Service: Access denied to bucket '${this.bucketName}' in region ${region}.`);
          console.error(`S3 Service: The bucket exists in region '${region}' but your AWS credentials don't have permission to access it.`);
          console.error(`S3 Service: Please check your IAM permissions for the bucket 'employeedocs'.`);
          
          // Even though we have AccessDenied, we now know the correct region
          // Update the client with correct region for future operations that might work
          this.client = tempClient;
          console.log(`S3 Service: Client updated with correct region '${region}', but access is currently denied.`);
          console.log(`S3 Service: RECOMMENDATION: Update AWS_REGION environment variable to '${region}'`);
          
          // Return false since we don't have actual access
          return false;
        }
      }
      console.error(`S3 Service: Retry with region ${region} failed:`, error);
      return false;
    }
  }

  /**
   * Generate structured S3 key for documents
   * @param {number} employeeId - Employee ID
   * @param {string} documentType - Type of document
   * @param {string} filename - Original filename
   * @returns {string} Structured S3 key
   */
  private generateS3Key(employeeId: number, documentType: string, filename: string): string {
    const timestamp = Date.now();
    const sanitizedType = documentType.replace(/[^a-zA-Z0-9-_]/g, '_');
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9-_.]/g, '_');
    return `documents/${employeeId}/${sanitizedType}/${timestamp}-${sanitizedFilename}`;
  }

  /**
   * Upload file to S3 with automatic fallback to local storage
   * 
   * @param {Buffer} buffer - File data buffer
   * @param {string} key - S3 key or local path
   * @param {string} contentType - MIME type of the file
   * @param {object} metadata - Additional metadata for the file
   * @returns {Promise<UploadResult>} Upload result with storage details
   */
  public async uploadFile(
    buffer: Buffer,
    key: string,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<UploadResult> {
    // Use S3 if configured
    if (this.isConfigured && this.client && this.bucketName) {
      try {
        const params: PutObjectCommandInput = {
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          Metadata: metadata,
          ServerSideEncryption: 'AES256', // Enable server-side encryption
          StorageClass: 'STANDARD_IA' // Use infrequent access for cost optimization
        };

        const command = new PutObjectCommand(params);
        const response = await this.client.send(command);
        
        console.log(`S3 Service: Successfully uploaded file to S3: ${key}`);
        
        return {
          success: true,
          storageType: 's3',
          storageKey: key,
          etag: response.ETag
        };
      } catch (error) {
        console.error('S3 Service: Upload failed, falling back to local storage:', error);
        // Fall through to local storage fallback
      }
    }

    // Fallback to local storage
    try {
      const localPath = path.join(this.localFallbackPath, key.replace(/\//g, '-'));
      await fs.promises.writeFile(localPath, buffer);
      
      console.log(`S3 Service: Saved file to local storage: ${localPath}`);
      
      return {
        success: true,
        storageType: 'local',
        storageKey: localPath
      };
    } catch (error) {
      console.error('S3 Service: Local storage fallback failed:', error);
      return {
        success: false,
        storageType: 'local',
        storageKey: '',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Download file from S3 or local storage
   * 
   * @param {string} key - S3 key or local path
   * @param {string} storageType - Storage type ('s3' or 'local')
   * @returns {Promise<DownloadResult>} Download result with file data
   */
  public async downloadFile(key: string, storageType: 'local' | 's3' = 's3'): Promise<DownloadResult> {
    // If storage type is local or S3 is not configured, read from local storage
    if (storageType === 'local' || !this.isConfigured) {
      try {
        const localPath = storageType === 'local' ? key : path.join(this.localFallbackPath, key.replace(/\//g, '-'));
        const data = await fs.promises.readFile(localPath);
        
        return {
          success: true,
          data,
          contentType: 'application/octet-stream'
        };
      } catch (error) {
        console.error('S3 Service: Failed to read local file:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to read file'
        };
      }
    }

    // Download from S3
    if (this.client && this.bucketName) {
      try {
        const command = new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key
        });

        const response: GetObjectCommandOutput = await this.client.send(command);
        
        if (response.Body) {
          const stream = response.Body as Readable;
          const chunks: Buffer[] = [];
          
          for await (const chunk of stream) {
            chunks.push(Buffer.from(chunk));
          }
          
          const data = Buffer.concat(chunks);
          
          return {
            success: true,
            data,
            contentType: response.ContentType || 'application/octet-stream'
          };
        }
        
        return {
          success: false,
          error: 'No data received from S3'
        };
      } catch (error) {
        console.error('S3 Service: Download failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Download failed'
        };
      }
    }

    return {
      success: false,
      error: 'S3 client not configured'
    };
  }

  /**
   * Delete file from S3 or local storage
   * 
   * @param {string} key - S3 key or local path
   * @param {string} storageType - Storage type ('s3' or 'local')
   * @returns {Promise<boolean>} Success status
   */
  public async deleteFile(key: string, storageType: 'local' | 's3' = 's3'): Promise<boolean> {
    // Delete from local storage
    if (storageType === 'local' || !this.isConfigured) {
      try {
        const localPath = storageType === 'local' ? key : path.join(this.localFallbackPath, key.replace(/\//g, '-'));
        await fs.promises.unlink(localPath);
        console.log(`S3 Service: Deleted local file: ${localPath}`);
        return true;
      } catch (error) {
        console.error('S3 Service: Failed to delete local file:', error);
        return false;
      }
    }

    // Delete from S3
    if (this.client && this.bucketName) {
      try {
        const command = new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key
        });

        await this.client.send(command);
        console.log(`S3 Service: Deleted S3 object: ${key}`);
        return true;
      } catch (error) {
        console.error('S3 Service: Failed to delete S3 object:', error);
        return false;
      }
    }

    return false;
  }

  /**
   * Generate a pre-signed URL for temporary access to S3 objects
   * 
   * @param {string} key - S3 key
   * @param {number} expirationSeconds - URL expiration time in seconds (default: 3600)
   * @returns {Promise<string | null>} Pre-signed URL or null if not available
   */
  public async getSignedUrl(key: string, expirationSeconds: number = 3600): Promise<string | null> {
    if (!this.isConfigured || !this.client || !this.bucketName) {
      console.log('S3 Service: Cannot generate signed URL - S3 not configured');
      return null;
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const url = await getSignedUrl(this.client, command, { expiresIn: expirationSeconds });
      console.log(`S3 Service: Generated signed URL for ${key}, expires in ${expirationSeconds}s`);
      return url;
    } catch (error) {
      console.error('S3 Service: Failed to generate signed URL:', error);
      return null;
    }
  }

  /**
   * List files in S3 with a specific prefix
   * 
   * @param {string} prefix - Prefix to filter files (e.g., 'documents/123/')
   * @param {number} maxResults - Maximum number of results (default: 1000)
   * @returns {Promise<FileInfo[]>} Array of file information
   */
  public async listFiles(prefix: string, maxResults: number = 1000): Promise<FileInfo[]> {
    if (!this.isConfigured || !this.client || !this.bucketName) {
      console.log('S3 Service: Cannot list files - S3 not configured');
      return [];
    }

    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxKeys: maxResults
      });

      const response = await this.client.send(command);
      
      if (!response.Contents) {
        return [];
      }

      return response.Contents.map(item => ({
        key: item.Key || '',
        size: item.Size,
        lastModified: item.LastModified,
        etag: item.ETag
      }));
    } catch (error) {
      console.error('S3 Service: Failed to list files:', error);
      return [];
    }
  }

  /**
   * Check if a file exists in S3
   * 
   * @param {string} key - S3 key
   * @returns {Promise<boolean>} True if file exists
   */
  public async fileExists(key: string): Promise<boolean> {
    if (!this.isConfigured || !this.client || !this.bucketName) {
      return false;
    }

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      if (error instanceof S3ServiceException && error.name === 'NotFound') {
        return false;
      }
      console.error('S3 Service: Error checking file existence:', error);
      return false;
    }
  }

  /**
   * Get storage statistics
   * 
   * @returns {object} Storage statistics including configuration status
   */
  public getStorageStats(): {
    isConfigured: boolean;
    bucketName: string | null;
    region: string;
    endpoint?: string;
  } {
    return {
      isConfigured: this.isConfigured,
      bucketName: this.bucketName,
      region: process.env.AWS_REGION || 'us-east-1',
      endpoint: process.env.AWS_S3_ENDPOINT
    };
  }

  /**
   * Get document storage statistics from the database
   * This method would typically be implemented in the storage layer
   * but is provided here as a stub for compatibility
   * 
   * @returns {Promise<object>} Document storage statistics
   */
  public async getDocumentStorageStats(): Promise<{
    totalCount: number;
    s3Count: number;
    localCount: number;
  }> {
    // This should be implemented by the storage layer
    // Returning default values for now
    return {
      totalCount: 0,
      s3Count: 0,
      localCount: 0
    };
  }

  /**
   * Migrate a local file to S3
   * 
   * @param {string} localPath - Path to local file
   * @param {string} s3Key - Target S3 key
   * @param {string} contentType - MIME type
   * @returns {Promise<UploadResult>} Upload result
   */
  public async migrateToS3(
    localPath: string,
    s3Key: string,
    contentType: string
  ): Promise<UploadResult> {
    try {
      const buffer = await fs.promises.readFile(localPath);
      const result = await this.uploadFile(buffer, s3Key, contentType, {
        originalPath: localPath,
        migrationDate: new Date().toISOString()
      });

      if (result.success && result.storageType === 's3') {
        console.log(`S3 Service: Successfully migrated ${localPath} to S3`);
      }

      return result;
    } catch (error) {
      console.error('S3 Service: Migration failed:', error);
      return {
        success: false,
        storageType: 'local',
        storageKey: localPath,
        error: error instanceof Error ? error.message : 'Migration failed'
      };
    }
  }
}

// Export singleton instance
export const s3Service = new S3Service();

// Export helper function for generating S3 keys
export function generateDocumentKey(
  employeeId: number,
  documentType: string,
  filename: string
): string {
  const timestamp = Date.now();
  const sanitizedType = documentType.replace(/[^a-zA-Z0-9-_]/g, '_');
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9-_.]/g, '_');
  return `documents/${employeeId}/${sanitizedType}/${timestamp}-${sanitizedFilename}`;
}