/**
 * @fileoverview S3 Migration Service
 * 
 * This service handles the migration of documents from local filesystem storage to S3.
 * It provides safe, resumable migration with progress tracking and error handling.
 * 
 * Features:
 * - Migrate documents from local storage to S3
 * - Progress tracking with console logging
 * - Skip already migrated documents
 * - Batch processing to avoid overwhelming S3
 * - Dry-run mode for preview
 * - Validation and rollback capabilities
 * - Comprehensive error handling
 * 
 * @module s3MigrationService
 */

import fs from 'fs/promises';
import path from 'path';
import { storage } from '../../storage';
import { s3Service } from '../s3Service';
import type { Document, ComplianceDocument, EmployeeDocumentUpload } from '@shared/schema';

/**
 * Migration result interface
 */
export interface MigrationResult {
  total: number;
  migrated: number;
  failed: number;
  skipped: number;
  errors: Array<{
    documentId: number;
    tableName: string;
    error: string;
  }>;
  duration: number;
}

/**
 * Migration options interface
 */
interface MigrationOptions {
  dryRun?: boolean;
  deleteLocal?: boolean;
  batchSize?: number;
  validateUpload?: boolean;
}

/**
 * Document migration info
 */
interface DocumentMigrationInfo {
  id: number;
  tableName: string;
  fileName: string;
  filePath: string;
  fileSize?: number;
  employeeId?: number;
  documentType?: string;
  locationId?: number;
  clinicLicenseId?: number;
}

/**
 * S3 Migration Service Class
 * 
 * Handles migration of documents from local filesystem to S3 storage.
 * Provides safe, resumable migration with comprehensive error handling.
 */
export class S3MigrationService {
  private readonly BATCH_SIZE = 15;
  private readonly localStoragePath: string;

  constructor() {
    this.localStoragePath = path.join(process.cwd(), 'server', 'uploads');
  }

  /**
   * Migrate all employee documents (from documents table)
   * @param {number} [employeeId] - Optional employee ID to migrate specific employee's documents
   * @param {MigrationOptions} [options] - Migration options
   * @returns {Promise<MigrationResult>} Migration result with statistics
   */
  async migrateEmployeeDocuments(
    employeeId?: number,
    options: MigrationOptions = {}
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    const { dryRun = false, deleteLocal = false, batchSize = this.BATCH_SIZE, validateUpload = true } = options;

    console.log(`\n=== Starting Employee Documents Migration ===`);
    console.log(`Employee ID: ${employeeId || 'ALL'}`);
    console.log(`Dry Run: ${dryRun}`);
    console.log(`Delete Local: ${deleteLocal}`);
    console.log(`Batch Size: ${batchSize}\n`);

    const result: MigrationResult = {
      total: 0,
      migrated: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      duration: 0
    };

    try {
      if (!s3Service.isConfigured()) {
        throw new Error('S3 is not configured. Please configure S3 before running migration.');
      }

      let allDocuments: Document[] = [];
      let offset = 0;
      const limit = 100;

      while (true) {
        const { documents: batch } = await storage.getDocuments({
          limit,
          offset,
          employeeId
        });

        if (batch.length === 0) break;
        allDocuments = allDocuments.concat(batch);
        offset += limit;
      }

      result.total = allDocuments.length;
      console.log(`Found ${result.total} employee documents to process`);

      for (let i = 0; i < allDocuments.length; i += batchSize) {
        const batch = allDocuments.slice(i, i + batchSize);
        await this.processBatch(
          batch.map(doc => ({
            id: doc.id,
            tableName: 'documents',
            fileName: doc.fileName || 'unknown',
            filePath: doc.filePath || '',
            fileSize: doc.fileSize || undefined,
            employeeId: doc.employeeId || undefined,
            documentType: doc.documentType || 'general'
          })),
          result,
          dryRun,
          deleteLocal,
          validateUpload,
          async (info, s3Key, etag, versionId) => {
            await storage.updateDocument(info.id, {
              storageType: 's3',
              storageKey: s3Key,
              s3Etag: etag,
              s3VersionId: versionId
            });
          }
        );

        const progress = Math.round(((i + batch.length) / result.total) * 100);
        console.log(`Progress: ${i + batch.length}/${result.total} (${progress}%)`);
      }

    } catch (error) {
      console.error('Employee documents migration failed:', error);
      result.errors.push({
        documentId: 0,
        tableName: 'documents',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    result.duration = Date.now() - startTime;
    this.logMigrationSummary('Employee Documents', result);
    return result;
  }

  /**
   * Migrate compliance documents (from complianceDocuments table)
   * @param {number} [locationId] - Optional location ID to migrate specific location's documents
   * @param {MigrationOptions} [options] - Migration options
   * @returns {Promise<MigrationResult>} Migration result with statistics
   */
  async migrateComplianceDocuments(
    locationId?: number,
    options: MigrationOptions = {}
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    const { dryRun = false, deleteLocal = false, batchSize = this.BATCH_SIZE, validateUpload = true } = options;

    console.log(`\n=== Starting Compliance Documents Migration ===`);
    console.log(`Location ID: ${locationId || 'ALL'}`);
    console.log(`Dry Run: ${dryRun}`);
    console.log(`Delete Local: ${deleteLocal}`);
    console.log(`Batch Size: ${batchSize}\n`);

    const result: MigrationResult = {
      total: 0,
      migrated: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      duration: 0
    };

    try {
      if (!s3Service.isConfigured()) {
        throw new Error('S3 is not configured. Please configure S3 before running migration.');
      }

      let allDocuments: ComplianceDocument[] = [];
      let offset = 0;
      const limit = 100;

      while (true) {
        const { documents: batch } = await storage.getComplianceDocuments({
          limit,
          offset,
          locationId
        });

        if (batch.length === 0) break;
        allDocuments = allDocuments.concat(batch);
        offset += limit;
      }

      result.total = allDocuments.length;
      console.log(`Found ${result.total} compliance documents to process`);

      for (let i = 0; i < allDocuments.length; i += batchSize) {
        const batch = allDocuments.slice(i, i + batchSize);
        await this.processBatch(
          batch.map(doc => ({
            id: doc.id,
            tableName: 'complianceDocuments',
            fileName: doc.fileName || 'unknown',
            filePath: doc.storageKey || '',
            fileSize: doc.fileSize || undefined,
            locationId: doc.locationId || undefined,
            clinicLicenseId: doc.clinicLicenseId,
            documentType: doc.documentType
          })),
          result,
          dryRun,
          deleteLocal,
          validateUpload,
          async (info, s3Key, etag, versionId) => {
            await storage.updateComplianceDocument(info.id, {
              storageType: 's3',
              storageKey: s3Key,
              s3Etag: etag,
              s3VersionId: versionId
            });
          }
        );

        const progress = Math.round(((i + batch.length) / result.total) * 100);
        console.log(`Progress: ${i + batch.length}/${result.total} (${progress}%)`);
      }

    } catch (error) {
      console.error('Compliance documents migration failed:', error);
      result.errors.push({
        documentId: 0,
        tableName: 'complianceDocuments',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    result.duration = Date.now() - startTime;
    this.logMigrationSummary('Compliance Documents', result);
    return result;
  }

  /**
   * Migrate onboarding documents (from employeeDocumentUploads table)
   * @param {number} [employeeId] - Optional employee ID to migrate specific employee's documents
   * @param {MigrationOptions} [options] - Migration options
   * @returns {Promise<MigrationResult>} Migration result with statistics
   */
  async migrateOnboardingDocuments(
    employeeId?: number,
    options: MigrationOptions = {}
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    const { dryRun = false, deleteLocal = false, batchSize = this.BATCH_SIZE, validateUpload = true } = options;

    console.log(`\n=== Starting Onboarding Documents Migration ===`);
    console.log(`Employee ID: ${employeeId || 'ALL'}`);
    console.log(`Dry Run: ${dryRun}`);
    console.log(`Delete Local: ${deleteLocal}`);
    console.log(`Batch Size: ${batchSize}\n`);

    const result: MigrationResult = {
      total: 0,
      migrated: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      duration: 0
    };

    try {
      if (!s3Service.isConfigured()) {
        throw new Error('S3 is not configured. Please configure S3 before running migration.');
      }

      let allDocuments: EmployeeDocumentUpload[] = [];

      if (employeeId) {
        allDocuments = await storage.getEmployeeDocumentUploads(employeeId);
      } else {
        const allEmployees = await storage.getAllEmployees();
        for (const employee of allEmployees) {
          const docs = await storage.getEmployeeDocumentUploads(employee.id);
          allDocuments = allDocuments.concat(docs);
        }
      }

      result.total = allDocuments.length;
      console.log(`Found ${result.total} onboarding documents to process`);

      for (let i = 0; i < allDocuments.length; i += batchSize) {
        const batch = allDocuments.slice(i, i + batchSize);
        await this.processBatch(
          batch.map(doc => ({
            id: doc.id,
            tableName: 'employeeDocumentUploads',
            fileName: doc.fileName,
            filePath: doc.filePath,
            fileSize: doc.fileSize,
            employeeId: doc.employeeId,
            documentType: 'onboarding'
          })),
          result,
          dryRun,
          deleteLocal,
          validateUpload,
          async (info, s3Key, etag, _versionId) => {
            await storage.updateEmployeeDocumentUpload(info.id, {
              filePath: s3Key
            });
          }
        );

        const progress = Math.round(((i + batch.length) / result.total) * 100);
        console.log(`Progress: ${i + batch.length}/${result.total} (${progress}%)`);
      }

    } catch (error) {
      console.error('Onboarding documents migration failed:', error);
      result.errors.push({
        documentId: 0,
        tableName: 'employeeDocumentUploads',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    result.duration = Date.now() - startTime;
    this.logMigrationSummary('Onboarding Documents', result);
    return result;
  }

  /**
   * Migrate facility documents (compliance documents for a specific facility)
   * @param {number} [facilityId] - Optional facility ID
   * @param {MigrationOptions} [options] - Migration options
   * @returns {Promise<MigrationResult>} Migration result with statistics
   */
  async migrateFacilityDocuments(
    facilityId?: number,
    options: MigrationOptions = {}
  ): Promise<MigrationResult> {
    return this.migrateComplianceDocuments(facilityId, options);
  }

  /**
   * Migrate ALL documents from all tables
   * @param {MigrationOptions} [options] - Migration options
   * @returns {Promise<MigrationResult>} Combined migration result with statistics
   */
  async migrateAllDocuments(
    options: MigrationOptions = {}
  ): Promise<MigrationResult> {
    const startTime = Date.now();

    console.log(`\n========================================`);
    console.log(`   MIGRATING ALL DOCUMENTS TO S3`);
    console.log(`========================================\n`);

    const combinedResult: MigrationResult = {
      total: 0,
      migrated: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      duration: 0
    };

    const employeeResult = await this.migrateEmployeeDocuments(undefined, options);
    this.mergeResults(combinedResult, employeeResult);

    const complianceResult = await this.migrateComplianceDocuments(undefined, options);
    this.mergeResults(combinedResult, complianceResult);

    const onboardingResult = await this.migrateOnboardingDocuments(undefined, options);
    this.mergeResults(combinedResult, onboardingResult);

    combinedResult.duration = Date.now() - startTime;

    console.log(`\n========================================`);
    console.log(`   MIGRATION COMPLETE`);
    console.log(`========================================`);
    this.logMigrationSummary('ALL DOCUMENTS', combinedResult);

    return combinedResult;
  }

  /**
   * Process a batch of documents for migration
   * @private
   */
  private async processBatch(
    documents: DocumentMigrationInfo[],
    result: MigrationResult,
    dryRun: boolean,
    deleteLocal: boolean,
    validateUpload: boolean,
    updateDatabase: (info: DocumentMigrationInfo, s3Key: string, etag?: string, versionId?: string) => Promise<void>
  ): Promise<void> {
    for (const doc of documents) {
      try {
        await this.migrateDocument(doc, result, dryRun, deleteLocal, validateUpload, updateDatabase);
      } catch (error) {
        result.failed++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push({
          documentId: doc.id,
          tableName: doc.tableName,
          error: errorMessage
        });
        console.error(`Error migrating document ${doc.id} from ${doc.tableName}: ${errorMessage}`);
      }
    }
  }

  /**
   * Migrate a single document
   * @private
   */
  private async migrateDocument(
    docInfo: DocumentMigrationInfo,
    result: MigrationResult,
    dryRun: boolean,
    deleteLocal: boolean,
    validateUpload: boolean,
    updateDatabase: (info: DocumentMigrationInfo, s3Key: string, etag?: string, versionId?: string) => Promise<void>
  ): Promise<void> {
    if (!docInfo.filePath) {
      result.skipped++;
      console.log(`Skipped ${docInfo.tableName}:${docInfo.id} - No file path`);
      return;
    }

    if (docInfo.tableName === 'documents') {
      const doc = await storage.getDocument(docInfo.id);
      if (doc?.storageType === 's3') {
        result.skipped++;
        console.log(`Skipped ${docInfo.tableName}:${docInfo.id} - Already on S3`);
        return;
      }
    } else if (docInfo.tableName === 'complianceDocuments') {
      const doc = await storage.getComplianceDocument(docInfo.id);
      if (doc?.storageType === 's3') {
        result.skipped++;
        console.log(`Skipped ${docInfo.tableName}:${docInfo.id} - Already on S3`);
        return;
      }
    }

    const localPath = path.isAbsolute(docInfo.filePath)
      ? docInfo.filePath
      : path.join(this.localStoragePath, docInfo.filePath);

    try {
      await fs.access(localPath);
    } catch (error) {
      result.skipped++;
      console.log(`Skipped ${docInfo.tableName}:${docInfo.id} - File not found: ${localPath}`);
      return;
    }

    if (dryRun) {
      result.migrated++;
      console.log(`[DRY RUN] Would migrate ${docInfo.tableName}:${docInfo.id} - ${docInfo.fileName}`);
      return;
    }

    const fileBuffer = await fs.readFile(localPath);
    const stats = await fs.stat(localPath);

    let s3Key: string;
    if (docInfo.tableName === 'documents' && docInfo.employeeId) {
      s3Key = s3Service.generateEmployeeDocumentKey(
        docInfo.employeeId,
        docInfo.documentType || 'general',
        docInfo.fileName
      );
    } else if (docInfo.tableName === 'complianceDocuments') {
      s3Key = s3Service.generateComplianceS3Key(docInfo.fileName, {
        locationId: docInfo.locationId,
        licenseId: docInfo.clinicLicenseId,
        documentType: docInfo.documentType || 'general'
      });
    } else if (docInfo.tableName === 'employeeDocumentUploads' && docInfo.employeeId) {
      s3Key = s3Service.generateEmployeeDocumentKey(
        docInfo.employeeId,
        'onboarding',
        docInfo.fileName
      );
    } else {
      s3Key = `migrated/${docInfo.tableName}/${Date.now()}-${docInfo.fileName}`;
    }

    const mimeType = this.getMimeType(docInfo.fileName);
    const uploadResult = await s3Service.uploadFile(
      fileBuffer,
      s3Key,
      mimeType,
      {
        originalPath: docInfo.filePath,
        migrationDate: new Date().toISOString(),
        tableName: docInfo.tableName,
        documentId: String(docInfo.id)
      }
    );

    if (!uploadResult.success || uploadResult.storageType !== 's3') {
      throw new Error(`Upload failed: ${uploadResult.error || 'Unknown error'}`);
    }

    if (validateUpload && docInfo.fileSize && stats.size !== docInfo.fileSize) {
      console.warn(`Warning: File size mismatch for ${docInfo.tableName}:${docInfo.id}. Expected ${docInfo.fileSize}, got ${stats.size}`);
    }

    await updateDatabase(docInfo, uploadResult.storageKey, uploadResult.etag, uploadResult.versionId);

    if (deleteLocal) {
      await fs.unlink(localPath);
      console.log(`Deleted local file: ${localPath}`);
    }

    result.migrated++;
    console.log(`Migrated ${docInfo.tableName}:${docInfo.id} - ${docInfo.fileName} -> ${s3Key}`);
  }

  /**
   * Get MIME type from filename
   * @private
   */
  private getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.zip': 'application/zip'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Merge migration results
   * @private
   */
  private mergeResults(target: MigrationResult, source: MigrationResult): void {
    target.total += source.total;
    target.migrated += source.migrated;
    target.failed += source.failed;
    target.skipped += source.skipped;
    target.errors.push(...source.errors);
  }

  /**
   * Log migration summary
   * @private
   */
  private logMigrationSummary(category: string, result: MigrationResult): void {
    console.log(`\n--- ${category} Migration Summary ---`);
    console.log(`Total Documents: ${result.total}`);
    console.log(`Migrated: ${result.migrated} ✅`);
    console.log(`Skipped: ${result.skipped} ⏭️`);
    console.log(`Failed: ${result.failed} ❌`);
    console.log(`Duration: ${(result.duration / 1000).toFixed(2)}s`);
    
    if (result.errors.length > 0) {
      console.log(`\nErrors (${result.errors.length}):`);
      result.errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. [${err.tableName}:${err.documentId}] ${err.error}`);
      });
    }
    console.log('');
  }

  /**
   * Rollback a document from S3 to local storage
   * @param {string} tableName - Table name ('documents', 'complianceDocuments', 'employeeDocumentUploads')
   * @param {number} documentId - Document ID
   * @returns {Promise<boolean>} Success status
   */
  async rollbackDocument(tableName: string, documentId: number): Promise<boolean> {
    try {
      console.log(`Rolling back ${tableName}:${documentId} from S3 to local storage`);

      let storageKey: string | null = null;
      let originalPath: string | null = null;

      if (tableName === 'documents') {
        const doc = await storage.getDocument(documentId);
        if (!doc) throw new Error('Document not found');
        if (doc.storageType !== 's3') throw new Error('Document is not on S3');
        storageKey = doc.storageKey;
        originalPath = doc.filePath;
      } else if (tableName === 'complianceDocuments') {
        const doc = await storage.getComplianceDocument(documentId);
        if (!doc) throw new Error('Document not found');
        if (doc.storageType !== 's3') throw new Error('Document is not on S3');
        storageKey = doc.storageKey;
      } else if (tableName === 'employeeDocumentUploads') {
        const uploads = await storage.getEmployeeDocumentUploads(0);
        const doc = uploads.find(u => u.id === documentId);
        if (!doc) throw new Error('Document not found');
        storageKey = doc.filePath;
      } else {
        throw new Error('Invalid table name');
      }

      if (!storageKey) {
        throw new Error('No storage key found');
      }

      const downloadResult = await s3Service.downloadFile(storageKey);
      if (!downloadResult.success || !downloadResult.data) {
        throw new Error(`Failed to download from S3: ${downloadResult.error}`);
      }

      const localPath = originalPath && path.isAbsolute(originalPath)
        ? originalPath
        : path.join(this.localStoragePath, originalPath || `rollback-${Date.now()}-${documentId}`);

      await fs.mkdir(path.dirname(localPath), { recursive: true });
      await fs.writeFile(localPath, downloadResult.data);

      if (tableName === 'documents') {
        await storage.updateDocument(documentId, {
          storageType: 'local',
          filePath: localPath,
          storageKey: null
        });
      } else if (tableName === 'complianceDocuments') {
        await storage.updateComplianceDocument(documentId, {
          storageType: 'local',
          storageKey: localPath
        });
      } else if (tableName === 'employeeDocumentUploads') {
        await storage.updateEmployeeDocumentUpload(documentId, {
          filePath: localPath
        });
      }

      console.log(`Successfully rolled back ${tableName}:${documentId} to ${localPath}`);
      return true;

    } catch (error) {
      console.error(`Rollback failed for ${tableName}:${documentId}:`, error);
      return false;
    }
  }

  /**
   * Get migration statistics
   * @returns {Promise<object>} Migration statistics
   */
  async getMigrationStats(): Promise<{
    documents: { total: number; s3: number; local: number };
    estimatedSize: string;
  }> {
    try {
      const stats = await storage.getDocumentStorageStats();
      
      const totalSize = 0;
      const estimatedSize = totalSize > 0 
        ? `${(totalSize / (1024 * 1024)).toFixed(2)} MB`
        : 'Unknown';

      return {
        documents: {
          total: stats.totalCount,
          s3: stats.s3Count,
          local: stats.localCount
        },
        estimatedSize
      };
    } catch (error) {
      console.error('Failed to get migration stats:', error);
      throw error;
    }
  }
}

const s3MigrationService = new S3MigrationService();
export { s3MigrationService };
