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
import { storage } from '../storage';
import { encrypt, decrypt } from '../utils/encryption';
import type { S3Configuration } from '@shared/schema';
import { CopyObjectCommand, PutObjectTaggingCommand, GetObjectTaggingCommand } from '@aws-sdk/client-s3';

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
 * Compliance upload options interface
 */
export interface ComplianceUploadOptions {
  locationId?: number;
  licenseId?: number;
  licenseTypeId?: number;
  documentType: string;
  version?: number;
  tags?: Record<string, string>;
  previousVersionId?: string;
  expirationDate?: Date;
  isRequired?: boolean;
  complianceCategory?: string;
  regulatoryReference?: string;
}

/**
 * Compliance download options interface
 */
export interface ComplianceDownloadOptions {
  presignedUrlExpiry?: number; // in seconds, default 3600 (1 hour)
  includeMetadata?: boolean;
  includeVersionInfo?: boolean;
}

/**
 * Versioned upload result interface
 */
export interface VersionedUploadResult extends UploadResult {
  versionId?: string;
  previousVersionKey?: string;
  metadata?: Record<string, string>;
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
  private _isConfigured: boolean = false;
  private localFallbackPath: string;
  private cachedConfig: S3Configuration | null = null;
  private configCacheTime: number = 0;
  private readonly CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes cache

  constructor() {
    this.localFallbackPath = path.join(process.cwd(), 'server', 'uploads');
    this.initialize();
  }

  /**
   * Initialize S3 client with credentials from database or environment variables
   * @private
   */
  private async initialize(): Promise<void> {
    try {
      // First try to load from database
      const dbConfig = await this.loadConfigFromDatabase();
      
      if (dbConfig) {
        await this.initializeFromConfig(dbConfig);
        return;
      }
      
      // Fall back to environment variables
      const envConfig = this.loadConfigFromEnv();
      if (envConfig) {
        await this.initializeFromConfig(envConfig);
        
        // Optionally save env config to database for future use
        if (envConfig.credentials?.accessKeyId && envConfig.credentials?.secretAccessKey && envConfig.bucketName) {
          console.log('S3 Service: Consider saving configuration to database for better security');
        }
      } else {
        console.log('S3 Service: No configuration found. Using local storage fallback.');
        this._isConfigured = false;
      }
    } catch (error) {
      console.error('S3 Service: Failed to initialize:', error);
      this._isConfigured = false;
    }
  }

  /**
   * Load S3 configuration from database
   * @private
   * @returns {Promise<S3Config | null>} Configuration or null
   */
  private async loadConfigFromDatabase(): Promise<S3Config | null> {
    try {
      // Check cache first
      if (this.cachedConfig && Date.now() - this.configCacheTime < this.CACHE_DURATION_MS) {
        const config = this.cachedConfig;
        if (!config.enabled) {
          return null;
        }
        
        return {
          region: config.region || 'us-east-1',
          bucketName: config.bucketName || '',
          endpoint: config.endpoint || undefined,
          credentials: config.accessKeyId && config.secretAccessKey ? {
            accessKeyId: decrypt(config.accessKeyId),
            secretAccessKey: decrypt(config.secretAccessKey)
          } : undefined
        };
      }
      
      // Load from database
      const config = await storage.getS3Configuration();
      if (!config || !config.enabled) {
        return null;
      }
      
      // Cache the config
      this.cachedConfig = config;
      this.configCacheTime = Date.now();
      
      // Decrypt sensitive fields
      const decryptedConfig: S3Config = {
        region: config.region || 'us-east-1',
        bucketName: config.bucketName || '',
        endpoint: config.endpoint || undefined,
        credentials: config.accessKeyId && config.secretAccessKey ? {
          accessKeyId: decrypt(config.accessKeyId),
          secretAccessKey: decrypt(config.secretAccessKey)
        } : undefined
      };
      
      return decryptedConfig;
    } catch (error) {
      console.error('S3 Service: Failed to load config from database:', error);
      return null;
    }
  }

  /**
   * Load S3 configuration from environment variables
   * @private
   * @returns {S3Config | null} Configuration or null
   */
  private loadConfigFromEnv(): S3Config | null {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || 'us-east-1';
    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    const endpoint = process.env.AWS_S3_ENDPOINT;

    if (!accessKeyId || !secretAccessKey || !bucketName) {
      return null;
    }

    return {
      region,
      bucketName,
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    };
  }

  /**
   * Initialize S3 client with provided configuration
   * @private
   * @param {S3Config} config - S3 configuration
   */
  private async initializeFromConfig(config: S3Config): Promise<void> {
    if (!config.credentials || !config.bucketName) {
      console.log('S3 Service: Incomplete configuration. Using local storage fallback.');
      this._isConfigured = false;
      return;
    }

    try {
      const clientConfig: any = {
        region: config.region,
        credentials: config.credentials,
        forcePathStyle: true
      };

      if (config.endpoint) {
        clientConfig.endpoint = config.endpoint;
      }

      this.client = new S3Client(clientConfig);
      this.bucketName = config.bucketName;
      
      // Check bucket access before marking as configured
      const isAccessible = await this.checkBucketAccess();
      this._isConfigured = isAccessible;
      
      if (isAccessible) {
        console.log(`S3 Service: ✅ Initialized successfully with bucket ${config.bucketName}`);
      } else {
        console.error(`S3 Service: ⚠️ Bucket ${config.bucketName} is not accessible. Using local storage fallback.`);
      }
    } catch (error) {
      console.error('S3 Service: Failed to initialize with config:', error);
      this._isConfigured = false;
    }
  }

  /**
   * Refresh configuration from database
   * @public
   */
  public async refreshConfiguration(): Promise<void> {
    // Clear cache to force reload
    this.cachedConfig = null;
    this.configCacheTime = 0;
    await this.initialize();
  }

  /**
   * Check if S3 is properly configured
   * @returns {boolean} Configuration status
   */
  public isS3Configured(): boolean {
    return this._isConfigured;
  }

  /**
   * Check if S3 is configured (alias for isS3Configured)
   * @returns {boolean} Configuration status
   */
  public isConfigured(): boolean {
    return this._isConfigured;
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
                              (error.$response as any)?.headers?.['x-amz-bucket-region'];
          
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
   * Generate structured S3 key for compliance documents
   * @param {string} filename - Original filename
   * @param {ComplianceUploadOptions} options - Compliance document options
   * @returns {string} Structured S3 key for compliance documents
   */
  public generateComplianceS3Key(filename: string, options: ComplianceUploadOptions): string {
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9-_.]/g, '_');
    const sanitizedType = options.documentType.replace(/[^a-zA-Z0-9-_]/g, '_');
    
    // Create hierarchical folder structure based on document association
    let keyPrefix = 'compliance';
    
    if (options.locationId) {
      keyPrefix += `/locations/${options.locationId}`;
    }
    
    if (options.licenseId) {
      keyPrefix += `/licenses/${options.licenseId}`;
    }
    
    if (options.licenseTypeId && options.documentType.toLowerCase().includes('sop')) {
      keyPrefix = `compliance/sop/${options.licenseTypeId}`;
    }
    
    // Add version to the key if provided
    const versionSuffix = options.version ? `_v${options.version}` : '';
    
    return `${keyPrefix}/${sanitizedType}/${timestamp}-${sanitizedFilename}${versionSuffix}`;
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
    if (this.isConfigured() && this.client && this.bucketName) {
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
      isConfigured: this.isConfigured(),
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

  /**
   * Upload compliance document to S3 with versioning and metadata
   * 
   * @param {Buffer} buffer - File data buffer
   * @param {string} filename - Original filename
   * @param {string} contentType - MIME type of the file
   * @param {ComplianceUploadOptions} options - Compliance-specific options
   * @returns {Promise<VersionedUploadResult>} Upload result with version info
   */
  public async uploadComplianceDocument(
    buffer: Buffer,
    filename: string,
    contentType: string,
    options: ComplianceUploadOptions
  ): Promise<VersionedUploadResult> {
    // Generate structured key for compliance document
    const s3Key = this.generateComplianceS3Key(filename, options);
    
    // Prepare metadata
    const metadata: Record<string, string> = {
      documentType: options.documentType,
      complianceCategory: options.complianceCategory || 'general',
      isRequired: String(options.isRequired || false),
      uploadDate: new Date().toISOString()
    };
    
    if (options.locationId) metadata.locationId = String(options.locationId);
    if (options.licenseId) metadata.licenseId = String(options.licenseId);
    if (options.licenseTypeId) metadata.licenseTypeId = String(options.licenseTypeId);
    if (options.version) metadata.version = String(options.version);
    if (options.expirationDate) metadata.expirationDate = options.expirationDate.toISOString();
    if (options.regulatoryReference) metadata.regulatoryReference = options.regulatoryReference;
    if (options.previousVersionId) metadata.previousVersionId = options.previousVersionId;
    
    // Handle version archiving if previous version exists
    let archivedPreviousKey: string | undefined;
    if (options.previousVersionId && this.isConfigured() && this.client && this.bucketName) {
      try {
        const archiveKey = `${s3Key}_archive_${Date.now()}`;
        const copyCommand = new CopyObjectCommand({
          Bucket: this.bucketName,
          CopySource: `${this.bucketName}/${options.previousVersionId}`,
          Key: archiveKey,
          MetadataDirective: 'COPY'
        });
        await this.client.send(copyCommand);
        archivedPreviousKey = archiveKey;
        console.log(`S3 Service: Archived previous version to ${archiveKey}`);
      } catch (error) {
        console.error('S3 Service: Failed to archive previous version:', error);
        // Continue with upload even if archiving fails
      }
    }
    
    // Upload with S3 if configured, with versioning support
    if (this.isConfigured() && this.client && this.bucketName) {
      try {
        const params: PutObjectCommandInput = {
          Bucket: this.bucketName,
          Key: s3Key,
          Body: buffer,
          ContentType: contentType,
          Metadata: metadata,
          ServerSideEncryption: 'AES256', // Enable server-side encryption for compliance
          StorageClass: 'STANDARD_IA', // Use infrequent access for cost optimization
          ContentDisposition: `inline; filename="${filename}"` // Preserve original filename
        };

        const command = new PutObjectCommand(params);
        const response = await this.client.send(command);
        
        // Add tags for enhanced categorization
        if (options.tags && Object.keys(options.tags).length > 0) {
          try {
            const tagCommand = new PutObjectTaggingCommand({
              Bucket: this.bucketName,
              Key: s3Key,
              Tagging: {
                TagSet: Object.entries(options.tags).map(([key, value]) => ({
                  Key: key,
                  Value: value
                }))
              }
            });
            await this.client.send(tagCommand);
          } catch (tagError) {
            console.error('S3 Service: Failed to add tags:', tagError);
            // Continue even if tagging fails
          }
        }
        
        console.log(`S3 Service: Successfully uploaded compliance document to S3: ${s3Key}`);
        
        return {
          success: true,
          storageType: 's3',
          storageKey: s3Key,
          etag: response.ETag,
          versionId: response.VersionId, // If versioning is enabled on the bucket
          previousVersionKey: archivedPreviousKey,
          metadata
        };
      } catch (error) {
        console.error('S3 Service: Compliance document upload failed, falling back to local:', error);
        // Fall through to local storage fallback
      }
    }

    // Fallback to local storage with metadata preserved
    try {
      const localPath = path.join(
        this.localFallbackPath,
        'compliance',
        s3Key.replace(/\//g, '-')
      );
      
      // Ensure directory exists
      await fs.promises.mkdir(path.dirname(localPath), { recursive: true });
      await fs.promises.writeFile(localPath, buffer);
      
      // Save metadata as a companion JSON file
      const metadataPath = `${localPath}.metadata.json`;
      await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      
      console.log(`S3 Service: Saved compliance document to local storage: ${localPath}`);
      
      return {
        success: true,
        storageType: 'local',
        storageKey: localPath,
        metadata
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
   * Download compliance document with metadata and versioning support
   * 
   * @param {string} key - S3 key or local path
   * @param {ComplianceDownloadOptions} options - Download options
   * @returns {Promise<DownloadResult & { metadata?: Record<string, string> }>} Download result with metadata
   */
  public async downloadComplianceDocument(
    key: string,
    storageType: 'local' | 's3' = 's3',
    options: ComplianceDownloadOptions = {}
  ): Promise<DownloadResult & { metadata?: Record<string, string>; tags?: Record<string, string> }> {
    // Download from local storage
    if (storageType === 'local' || !this.isConfigured) {
      try {
        const localPath = key;
        const data = await fs.promises.readFile(localPath);
        
        // Try to read metadata file
        let metadata: Record<string, string> | undefined;
        try {
          const metadataPath = `${localPath}.metadata.json`;
          const metadataContent = await fs.promises.readFile(metadataPath, 'utf-8');
          metadata = JSON.parse(metadataContent);
        } catch (metaError) {
          // Metadata file might not exist for older documents
          console.log('S3 Service: No metadata file found for local document');
        }
        
        return {
          success: true,
          data,
          contentType: 'application/octet-stream',
          metadata
        };
      } catch (error) {
        console.error('S3 Service: Failed to read local compliance document:', error);
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
          
          // Extract metadata if requested
          let metadata: Record<string, string> | undefined;
          if (options.includeMetadata && response.Metadata) {
            metadata = response.Metadata;
          }
          
          // Get tags if requested
          let tags: Record<string, string> | undefined;
          if (options.includeMetadata) {
            try {
              const tagCommand = new GetObjectTaggingCommand({
                Bucket: this.bucketName,
                Key: key
              });
              const tagResponse = await this.client.send(tagCommand);
              if (tagResponse.TagSet) {
                tags = {};
                tagResponse.TagSet.forEach(tag => {
                  if (tag.Key && tag.Value) {
                    tags![tag.Key] = tag.Value;
                  }
                });
              }
            } catch (tagError) {
              console.log('S3 Service: Could not retrieve tags:', tagError);
            }
          }
          
          return {
            success: true,
            data,
            contentType: response.ContentType || 'application/octet-stream',
            metadata,
            tags
          };
        }
        
        return {
          success: false,
          error: 'No data received from S3'
        };
      } catch (error) {
        console.error('S3 Service: Compliance document download failed:', error);
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
   * Generate a pre-signed URL for compliance document with custom expiration
   * 
   * @param {string} key - S3 key
   * @param {ComplianceDownloadOptions} options - Download options
   * @returns {Promise<string | null>} Pre-signed URL or null if not available
   */
  public async getComplianceDocumentSignedUrl(
    key: string,
    options: ComplianceDownloadOptions = {}
  ): Promise<string | null> {
    if (!this.isConfigured || !this.client || !this.bucketName) {
      console.log('S3 Service: Cannot generate signed URL - S3 not configured');
      return null;
    }

    try {
      // Default to 1 hour expiration for compliance documents
      const expirationSeconds = options.presignedUrlExpiry || 3600;
      
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ResponseContentDisposition: 'inline' // Allow viewing in browser
      });

      const url = await getSignedUrl(this.client, command, { expiresIn: expirationSeconds });
      console.log(`S3 Service: Generated compliance document signed URL for ${key}, expires in ${expirationSeconds}s`);
      return url;
    } catch (error) {
      console.error('S3 Service: Failed to generate compliance document signed URL:', error);
      return null;
    }
  }

  /**
   * List compliance documents with specific filters
   * 
   * @param {object} filters - Filter options
   * @param {number} filters.locationId - Location ID
   * @param {number} filters.licenseId - License ID
   * @param {number} filters.licenseTypeId - License Type ID
   * @param {string} filters.documentType - Document type
   * @param {number} maxResults - Maximum number of results
   * @returns {Promise<FileInfo[]>} Array of file information
   */
  public async listComplianceDocuments(
    filters: {
      locationId?: number;
      licenseId?: number;
      licenseTypeId?: number;
      documentType?: string;
    },
    maxResults: number = 1000
  ): Promise<FileInfo[]> {
    if (!this.isConfigured || !this.client || !this.bucketName) {
      console.log('S3 Service: Cannot list compliance documents - S3 not configured');
      return [];
    }

    // Build prefix based on filters
    let prefix = 'compliance/';
    
    if (filters.locationId) {
      prefix += `locations/${filters.locationId}/`;
    } else if (filters.licenseId) {
      prefix += `licenses/${filters.licenseId}/`;
    } else if (filters.licenseTypeId) {
      prefix += `sop/${filters.licenseTypeId}/`;
    }
    
    if (filters.documentType) {
      const sanitizedType = filters.documentType.replace(/[^a-zA-Z0-9-_]/g, '_');
      prefix += `${sanitizedType}/`;
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
      console.error('S3 Service: Failed to list compliance documents:', error);
      return [];
    }
  }

  /**
   * Delete compliance document with version archiving
   * 
   * @param {string} key - S3 key or local path
   * @param {string} storageType - Storage type ('s3' or 'local')
   * @param {boolean} archiveBeforeDelete - Whether to archive before deletion
   * @returns {Promise<{ success: boolean; archivedKey?: string; error?: string }>} Deletion result
   */
  public async deleteComplianceDocument(
    key: string,
    storageType: 'local' | 's3' = 's3',
    archiveBeforeDelete: boolean = true
  ): Promise<{ success: boolean; archivedKey?: string; error?: string }> {
    // Delete from local storage
    if (storageType === 'local' || !this.isConfigured) {
      try {
        const localPath = key;
        
        // Archive local file if requested
        if (archiveBeforeDelete) {
          const archivePath = `${localPath}.deleted_${Date.now()}`;
          await fs.promises.rename(localPath, archivePath);
          
          // Also move metadata file if it exists
          try {
            const metadataPath = `${localPath}.metadata.json`;
            const archiveMetadataPath = `${archivePath}.metadata.json`;
            await fs.promises.rename(metadataPath, archiveMetadataPath);
          } catch (metaError) {
            // Metadata file might not exist
          }
          
          console.log(`S3 Service: Archived local compliance document to: ${archivePath}`);
          return { success: true, archivedKey: archivePath };
        } else {
          await fs.promises.unlink(localPath);
          
          // Also delete metadata file if it exists
          try {
            const metadataPath = `${localPath}.metadata.json`;
            await fs.promises.unlink(metadataPath);
          } catch (metaError) {
            // Metadata file might not exist
          }
          
          console.log(`S3 Service: Deleted local compliance document: ${localPath}`);
          return { success: true };
        }
      } catch (error) {
        console.error('S3 Service: Failed to delete local compliance document:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete file'
        };
      }
    }

    // Delete from S3
    if (this.client && this.bucketName) {
      try {
        let archivedKey: string | undefined;
        
        // Archive in S3 if requested
        if (archiveBeforeDelete) {
          try {
            archivedKey = `${key}_deleted_${Date.now()}`;
            const copyCommand = new CopyObjectCommand({
              Bucket: this.bucketName,
              CopySource: `${this.bucketName}/${key}`,
              Key: archivedKey,
              MetadataDirective: 'COPY'
            });
            await this.client.send(copyCommand);
            console.log(`S3 Service: Archived compliance document to ${archivedKey}`);
          } catch (archiveError) {
            console.error('S3 Service: Failed to archive before deletion:', archiveError);
            // Continue with deletion even if archiving fails
          }
        }
        
        // Delete the original
        const command = new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key
        });

        await this.client.send(command);
        console.log(`S3 Service: Deleted S3 compliance document: ${key}`);
        
        return { success: true, archivedKey };
      } catch (error) {
        console.error('S3 Service: Failed to delete S3 compliance document:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete from S3'
        };
      }
    }

    return {
      success: false,
      error: 'S3 client not configured'
    };
  }

  /**
   * Validate compliance document before upload
   * 
   * @param {Buffer} buffer - File data buffer
   * @param {string} contentType - MIME type
   * @param {ComplianceUploadOptions} options - Upload options
   * @returns {object} Validation result
   */
  public validateComplianceDocument(
    buffer: Buffer,
    contentType: string,
    options: ComplianceUploadOptions
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check file size (max 50MB for compliance documents)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (buffer.length > maxSize) {
      errors.push(`File size exceeds maximum allowed size of 50MB (current: ${(buffer.length / 1024 / 1024).toFixed(2)}MB)`);
    }
    
    // Validate MIME type
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'application/zip'
    ];
    
    if (!allowedMimeTypes.includes(contentType)) {
      errors.push(`File type '${contentType}' is not allowed for compliance documents`);
    }
    
    // Validate required fields
    if (!options.documentType) {
      errors.push('Document type is required');
    }
    
    if (!options.locationId && !options.licenseId && !options.licenseTypeId) {
      errors.push('At least one of locationId, licenseId, or licenseTypeId must be provided');
    }
    
    // Check expiration date if provided
    if (options.expirationDate && options.expirationDate < new Date()) {
      errors.push('Expiration date cannot be in the past');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
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

/**
 * Generate compliance document S3 key helper
 * @param {string} filename - Original filename
 * @param {ComplianceUploadOptions} options - Compliance document options
 * @returns {string} Structured S3 key for compliance documents
 */
export function generateComplianceDocumentKey(
  filename: string,
  options: ComplianceUploadOptions
): string {
  return s3Service.generateComplianceS3Key(filename, options);
}