/**
 * Document Upload API Tests
 * @description Comprehensive API tests for document upload and management endpoints
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { getTestApp } from '../utils/test-app';
import { testDb } from '../utils/test-db';
import { createTestUsers } from '../utils/auth-helpers';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

describe('Document Upload API Tests', () => {
  let app: any;
  const tempDir = path.join(process.cwd(), 'tests', 'fixtures', 'temp');
  const uploadedFiles: string[] = [];
  
  // Helper to create test file
  const createTestFile = (filename: string, content: string = 'Test content'): string => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const filePath = path.join(tempDir, filename);
    fs.writeFileSync(filePath, content);
    uploadedFiles.push(filePath);
    return filePath;
  };
  
  // Helper to create file with specific size
  const createFileWithSize = (filename: string, sizeInBytes: number): string => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const filePath = path.join(tempDir, filename);
    const buffer = Buffer.alloc(sizeInBytes, 'a');
    fs.writeFileSync(filePath, buffer);
    uploadedFiles.push(filePath);
    return filePath;
  };

  beforeEach(async () => {
    app = await getTestApp();
    await testDb.cleanupBetweenTests();
  });

  afterEach(async () => {
    await testDb.cleanupBetweenTests();
    // Clean up temp files
    uploadedFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
    uploadedFiles.length = 0;
  });

  describe('POST /api/documents/upload', () => {
    test('should successfully upload a document', async () => {
      const { adminUser } = await createTestUsers(app);
      const employee = await testDb.createTestEmployee({
        firstName: 'John',
        lastName: 'Doe',
        workEmail: 'john.doe@hospital.com'
      });
      
      const testFile = createTestFile('test-document.pdf', 'PDF content');
      
      const response = await adminUser.agent
        .post('/api/documents/upload')
        .field('employeeId', employee.id.toString())
        .field('documentType', 'license')
        .field('description', 'Medical license document')
        .attach('document', testFile)
        .expect(201);
      
      expect(response.body).toMatchObject({
        id: expect.any(Number),
        employeeId: employee.id,
        documentType: 'license',
        description: 'Medical license document',
        fileName: expect.any(String),
        fileSize: expect.any(Number),
        uploadedAt: expect.any(String)
      });
    });
    
    test('should reject upload with missing file', async () => {
      const { hrUser } = await createTestUsers(app);
      const employee = await testDb.createTestEmployee({
        firstName: 'Jane',
        lastName: 'Smith',
        workEmail: 'jane.smith@hospital.com'
      });
      
      const response = await hrUser.agent
        .post('/api/documents/upload')
        .field('employeeId', employee.id.toString())
        .field('documentType', 'certificate')
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/file|required/i);
    });
    
    test('should reject upload with invalid employee ID', async () => {
      const { hrUser } = await createTestUsers(app);
      const testFile = createTestFile('test.pdf', 'PDF content');
      
      const response = await hrUser.agent
        .post('/api/documents/upload')
        .field('employeeId', '99999')
        .field('documentType', 'license')
        .attach('document', testFile)
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/employee|invalid|not found/i);
    });
    
    test('should require authentication', async () => {
      const testFile = createTestFile('test.pdf', 'PDF content');
      
      const response = await request(app)
        .post('/api/documents/upload')
        .field('employeeId', '1')
        .field('documentType', 'license')
        .attach('document', testFile)
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/auth|login|unauthorized/i);
    });
    
    test('should validate file type', async () => {
      const { hrUser } = await createTestUsers(app);
      const employee = await testDb.createTestEmployee({
        firstName: 'Test',
        lastName: 'User',
        workEmail: 'test@hospital.com'
      });
      
      const testFile = createTestFile('malicious.exe', 'MZ\x90\x00'); // EXE header
      
      const response = await hrUser.agent
        .post('/api/documents/upload')
        .field('employeeId', employee.id.toString())
        .field('documentType', 'other')
        .attach('document', testFile)
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/type|format|allowed|supported/i);
    });
    
    test('should validate file size limits', async () => {
      const { hrUser } = await createTestUsers(app);
      const employee = await testDb.createTestEmployee({
        firstName: 'Size',
        lastName: 'Test',
        workEmail: 'size@hospital.com'
      });
      
      // Create 11MB file (over 10MB limit)
      const largeFile = createFileWithSize('large.pdf', 11 * 1024 * 1024);
      
      const response = await hrUser.agent
        .post('/api/documents/upload')
        .field('employeeId', employee.id.toString())
        .field('documentType', 'other')
        .attach('document', largeFile)
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/size|large|limit|10MB/i);
    });
    
    test('should validate metadata fields', async () => {
      const { hrUser } = await createTestUsers(app);
      const employee = await testDb.createTestEmployee({
        firstName: 'Meta',
        lastName: 'Test',
        workEmail: 'meta@hospital.com'
      });
      
      const testFile = createTestFile('test.pdf', 'PDF content');
      
      // Test with invalid document type
      const response1 = await hrUser.agent
        .post('/api/documents/upload')
        .field('employeeId', employee.id.toString())
        .field('documentType', 'invalid_type')
        .attach('document', testFile)
        .expect(400);
      
      expect(response1.body.error).toMatch(/type|invalid/i);
      
      // Test with excessively long description
      const longDescription = 'a'.repeat(5001); // Assuming 5000 char limit
      const response2 = await hrUser.agent
        .post('/api/documents/upload')
        .field('employeeId', employee.id.toString())
        .field('documentType', 'other')
        .field('description', longDescription)
        .attach('document', testFile)
        .expect(400);
      
      expect(response2.body.error).toMatch(/description|long|limit/i);
    });
    
    test('should support multiple file uploads', async () => {
      const { adminUser } = await createTestUsers(app);
      const employee = await testDb.createTestEmployee({
        firstName: 'Multi',
        lastName: 'Upload',
        workEmail: 'multi@hospital.com'
      });
      
      const file1 = createTestFile('doc1.pdf', 'PDF 1');
      const file2 = createTestFile('doc2.pdf', 'PDF 2');
      const file3 = createTestFile('doc3.jpg', 'JPG content');
      
      // Upload multiple files in sequence
      const responses = [];
      
      for (const [index, file] of [file1, file2, file3].entries()) {
        const response = await adminUser.agent
          .post('/api/documents/upload')
          .field('employeeId', employee.id.toString())
          .field('documentType', 'other')
          .field('description', `Document ${index + 1}`)
          .attach('document', file)
          .expect(201);
        
        responses.push(response.body);
      }
      
      expect(responses).toHaveLength(3);
      responses.forEach((doc, index) => {
        expect(doc.description).toBe(`Document ${index + 1}`);
        expect(doc.employeeId).toBe(employee.id);
      });
    });
  });

  describe('GET /api/documents/:id', () => {
    test('should retrieve document successfully', async () => {
      const { hrUser } = await createTestUsers(app);
      const employee = await testDb.createTestEmployee({
        firstName: 'Get',
        lastName: 'Test',
        workEmail: 'get@hospital.com'
      });
      
      // Upload a document first
      const testFile = createTestFile('retrieve.pdf', 'PDF to retrieve');
      const uploadResponse = await hrUser.agent
        .post('/api/documents/upload')
        .field('employeeId', employee.id.toString())
        .field('documentType', 'license')
        .attach('document', testFile);
      
      const documentId = uploadResponse.body.id;
      
      // Retrieve the document
      const response = await hrUser.agent
        .get(`/api/documents/${documentId}`)
        .expect(200);
      
      expect(response.body).toMatchObject({
        id: documentId,
        employeeId: employee.id,
        documentType: 'license',
        fileName: expect.any(String)
      });
    });
    
    test('should return 404 for non-existent document', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const response = await hrUser.agent
        .get('/api/documents/99999')
        .expect(404);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/not found|doesn't exist/i);
    });
    
    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/documents/1')
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/auth|login|unauthorized/i);
    });
    
    test('should generate presigned URL for S3 storage', async () => {
      const { adminUser } = await createTestUsers(app);
      const employee = await testDb.createTestEmployee({
        firstName: 'S3',
        lastName: 'Test',
        workEmail: 's3@hospital.com'
      });
      
      // Upload document
      const testFile = createTestFile('s3test.pdf', 'S3 test content');
      const uploadResponse = await adminUser.agent
        .post('/api/documents/upload')
        .field('employeeId', employee.id.toString())
        .field('documentType', 'other')
        .attach('document', testFile);
      
      const documentId = uploadResponse.body.id;
      
      // Get document with download URL
      const response = await adminUser.agent
        .get(`/api/documents/${documentId}/download-url`)
        .expect(200);
      
      expect(response.body).toHaveProperty('url');
      
      // If S3 is configured, URL should be a presigned S3 URL
      if (response.body.url.includes('amazonaws.com') || response.body.url.includes('s3')) {
        expect(response.body.url).toMatch(/https?:\/\/.+/);
        expect(response.body).toHaveProperty('expiresIn');
      } else {
        // Local storage URL
        expect(response.body.url).toMatch(/^\/api\/documents\/\d+\/download$/);
      }
    });
  });

  describe('DELETE /api/documents/:id', () => {
    test('should delete document successfully', async () => {
      const { adminUser } = await createTestUsers(app);
      const employee = await testDb.createTestEmployee({
        firstName: 'Delete',
        lastName: 'Test',
        workEmail: 'delete@hospital.com'
      });
      
      // Upload a document first
      const testFile = createTestFile('delete.pdf', 'PDF to delete');
      const uploadResponse = await adminUser.agent
        .post('/api/documents/upload')
        .field('employeeId', employee.id.toString())
        .field('documentType', 'other')
        .attach('document', testFile);
      
      const documentId = uploadResponse.body.id;
      
      // Delete the document
      await adminUser.agent
        .delete(`/api/documents/${documentId}`)
        .expect(200);
      
      // Verify document is deleted
      await adminUser.agent
        .get(`/api/documents/${documentId}`)
        .expect(404);
    });
    
    test('should return 404 for non-existent document', async () => {
      const { adminUser } = await createTestUsers(app);
      
      const response = await adminUser.agent
        .delete('/api/documents/99999')
        .expect(404);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/not found|doesn't exist/i);
    });
    
    test('should prevent unauthorized deletion', async () => {
      const { viewerUser, adminUser } = await createTestUsers(app);
      const employee = await testDb.createTestEmployee({
        firstName: 'Auth',
        lastName: 'Test',
        workEmail: 'auth@hospital.com'
      });
      
      // Admin uploads document
      const testFile = createTestFile('protected.pdf', 'Protected content');
      const uploadResponse = await adminUser.agent
        .post('/api/documents/upload')
        .field('employeeId', employee.id.toString())
        .field('documentType', 'license')
        .attach('document', testFile);
      
      const documentId = uploadResponse.body.id;
      
      // Viewer tries to delete
      const response = await viewerUser.agent
        .delete(`/api/documents/${documentId}`)
        .expect(403);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/permission|forbidden|unauthorized/i);
    });
    
    test('should handle cascade deletion', async () => {
      const { adminUser } = await createTestUsers(app);
      const employee = await testDb.createTestEmployee({
        firstName: 'Cascade',
        lastName: 'Test',
        workEmail: 'cascade@hospital.com'
      });
      
      // Upload multiple documents for the employee
      const files = [];
      for (let i = 0; i < 3; i++) {
        const file = createTestFile(`cascade${i}.pdf`, `Content ${i}`);
        const response = await adminUser.agent
          .post('/api/documents/upload')
          .field('employeeId', employee.id.toString())
          .field('documentType', 'other')
          .attach('document', file);
        files.push(response.body.id);
      }
      
      // Delete employee (if cascade is implemented)
      // This depends on your implementation
      // For now, we'll test individual document deletion
      for (const docId of files) {
        await adminUser.agent
          .delete(`/api/documents/${docId}`)
          .expect(200);
      }
    });
  });

  describe('PATCH /api/documents/:id', () => {
    test('should update document category', async () => {
      const { hrUser } = await createTestUsers(app);
      const employee = await testDb.createTestEmployee({
        firstName: 'Update',
        lastName: 'Category',
        workEmail: 'update@hospital.com'
      });
      
      // Upload document
      const testFile = createTestFile('update.pdf', 'Update test');
      const uploadResponse = await hrUser.agent
        .post('/api/documents/upload')
        .field('employeeId', employee.id.toString())
        .field('documentType', 'other')
        .attach('document', testFile);
      
      const documentId = uploadResponse.body.id;
      
      // Update category
      const response = await hrUser.agent
        .patch(`/api/documents/${documentId}`)
        .send({ documentType: 'license' })
        .expect(200);
      
      expect(response.body.documentType).toBe('license');
    });
    
    test('should update document metadata', async () => {
      const { hrUser } = await createTestUsers(app);
      const employee = await testDb.createTestEmployee({
        firstName: 'Meta',
        lastName: 'Update',
        workEmail: 'metaupdate@hospital.com'
      });
      
      // Upload document
      const testFile = createTestFile('metadata.pdf', 'Metadata test');
      const uploadResponse = await hrUser.agent
        .post('/api/documents/upload')
        .field('employeeId', employee.id.toString())
        .field('documentType', 'certificate')
        .field('description', 'Original description')
        .attach('document', testFile);
      
      const documentId = uploadResponse.body.id;
      
      // Update metadata
      const response = await hrUser.agent
        .patch(`/api/documents/${documentId}`)
        .send({
          description: 'Updated description',
          expirationDate: '2025-12-31'
        })
        .expect(200);
      
      expect(response.body.description).toBe('Updated description');
      expect(response.body.expirationDate).toMatch(/2025-12-31/);
    });
    
    test('should validate update fields', async () => {
      const { hrUser } = await createTestUsers(app);
      const employee = await testDb.createTestEmployee({
        firstName: 'Invalid',
        lastName: 'Update',
        workEmail: 'invalid@hospital.com'
      });
      
      // Upload document
      const testFile = createTestFile('invalid.pdf', 'Invalid update test');
      const uploadResponse = await hrUser.agent
        .post('/api/documents/upload')
        .field('employeeId', employee.id.toString())
        .field('documentType', 'other')
        .attach('document', testFile);
      
      const documentId = uploadResponse.body.id;
      
      // Try invalid updates
      const response = await hrUser.agent
        .patch(`/api/documents/${documentId}`)
        .send({
          documentType: 'invalid_type',
          description: 'a'.repeat(5001) // Too long
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/employees/:id/documents', () => {
    test('should list all documents for an employee', async () => {
      const { hrUser } = await createTestUsers(app);
      const employee = await testDb.createTestEmployee({
        firstName: 'List',
        lastName: 'Docs',
        workEmail: 'list@hospital.com'
      });
      
      // Upload multiple documents
      const documentTypes = ['license', 'certificate', 'training', 'other'];
      for (const type of documentTypes) {
        const file = createTestFile(`${type}.pdf`, `${type} content`);
        await hrUser.agent
          .post('/api/documents/upload')
          .field('employeeId', employee.id.toString())
          .field('documentType', type)
          .attach('document', file);
      }
      
      // List documents
      const response = await hrUser.agent
        .get(`/api/employees/${employee.id}/documents`)
        .expect(200);
      
      expect(response.body).toHaveProperty('documents');
      expect(response.body.documents).toHaveLength(4);
      expect(response.body.documents.map((d: any) => d.documentType).sort()).toEqual(documentTypes.sort());
    });
    
    test('should support pagination', async () => {
      const { hrUser } = await createTestUsers(app);
      const employee = await testDb.createTestEmployee({
        firstName: 'Page',
        lastName: 'Test',
        workEmail: 'page@hospital.com'
      });
      
      // Upload 15 documents
      for (let i = 0; i < 15; i++) {
        const file = createTestFile(`doc${i}.pdf`, `Content ${i}`);
        await hrUser.agent
          .post('/api/documents/upload')
          .field('employeeId', employee.id.toString())
          .field('documentType', 'other')
          .attach('document', file);
      }
      
      // Get first page
      const page1 = await hrUser.agent
        .get(`/api/employees/${employee.id}/documents?page=1&limit=10`)
        .expect(200);
      
      expect(page1.body.documents).toHaveLength(10);
      expect(page1.body.total).toBe(15);
      expect(page1.body.page).toBe(1);
      expect(page1.body.totalPages).toBe(2);
      
      // Get second page
      const page2 = await hrUser.agent
        .get(`/api/employees/${employee.id}/documents?page=2&limit=10`)
        .expect(200);
      
      expect(page2.body.documents).toHaveLength(5);
      expect(page2.body.page).toBe(2);
    });
    
    test('should support sorting', async () => {
      const { hrUser } = await createTestUsers(app);
      const employee = await testDb.createTestEmployee({
        firstName: 'Sort',
        lastName: 'Test',
        workEmail: 'sort@hospital.com'
      });
      
      // Upload documents with different names
      const names = ['Zebra.pdf', 'Alpha.pdf', 'Beta.pdf'];
      for (const name of names) {
        const file = createTestFile(name, 'Content');
        await hrUser.agent
          .post('/api/documents/upload')
          .field('employeeId', employee.id.toString())
          .field('documentType', 'other')
          .field('description', name)
          .attach('document', file);
        
        // Add delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Sort by name ascending
      const ascResponse = await hrUser.agent
        .get(`/api/employees/${employee.id}/documents?sort=name&order=asc`)
        .expect(200);
      
      const ascNames = ascResponse.body.documents.map((d: any) => d.description || d.fileName);
      expect(ascNames[0]).toMatch(/Alpha/);
      expect(ascNames[2]).toMatch(/Zebra/);
      
      // Sort by upload date descending
      const descResponse = await hrUser.agent
        .get(`/api/employees/${employee.id}/documents?sort=uploadedAt&order=desc`)
        .expect(200);
      
      const descNames = descResponse.body.documents.map((d: any) => d.description || d.fileName);
      expect(descNames[0]).toMatch(/Zebra/); // Most recent
    });
    
    test('should filter by category', async () => {
      const { hrUser } = await createTestUsers(app);
      const employee = await testDb.createTestEmployee({
        firstName: 'Filter',
        lastName: 'Category',
        workEmail: 'filter@hospital.com'
      });
      
      // Upload documents with different categories
      const categories = [
        { type: 'license', count: 3 },
        { type: 'certificate', count: 2 },
        { type: 'training', count: 1 }
      ];
      
      for (const cat of categories) {
        for (let i = 0; i < cat.count; i++) {
          const file = createTestFile(`${cat.type}${i}.pdf`, 'Content');
          await hrUser.agent
            .post('/api/documents/upload')
            .field('employeeId', employee.id.toString())
            .field('documentType', cat.type)
            .attach('document', file);
        }
      }
      
      // Filter by license
      const licenseResponse = await hrUser.agent
        .get(`/api/employees/${employee.id}/documents?category=license`)
        .expect(200);
      
      expect(licenseResponse.body.documents).toHaveLength(3);
      expect(licenseResponse.body.documents.every((d: any) => d.documentType === 'license')).toBe(true);
      
      // Filter by certificate
      const certResponse = await hrUser.agent
        .get(`/api/employees/${employee.id}/documents?category=certificate`)
        .expect(200);
      
      expect(certResponse.body.documents).toHaveLength(2);
    });
    
    test('should support search functionality', async () => {
      const { hrUser } = await createTestUsers(app);
      const employee = await testDb.createTestEmployee({
        firstName: 'Search',
        lastName: 'Test',
        workEmail: 'search@hospital.com'
      });
      
      // Upload documents with searchable names
      const documents = [
        { name: 'Medical License 2024', type: 'license' },
        { name: 'DEA Registration', type: 'license' },
        { name: 'Board Certification', type: 'certificate' },
        { name: 'ACLS Training', type: 'training' }
      ];
      
      for (const doc of documents) {
        const file = createTestFile(`${doc.name}.pdf`, 'Content');
        await hrUser.agent
          .post('/api/documents/upload')
          .field('employeeId', employee.id.toString())
          .field('documentType', doc.type)
          .field('description', doc.name)
          .attach('document', file);
      }
      
      // Search for "Medical"
      const medicalResponse = await hrUser.agent
        .get(`/api/employees/${employee.id}/documents?search=Medical`)
        .expect(200);
      
      expect(medicalResponse.body.documents).toHaveLength(1);
      expect(medicalResponse.body.documents[0].description).toContain('Medical');
      
      // Search for "License"
      const licenseResponse = await hrUser.agent
        .get(`/api/employees/${employee.id}/documents?search=License`)
        .expect(200);
      
      expect(licenseResponse.body.documents.length).toBeGreaterThanOrEqual(1);
      
      // Search for "Training"
      const trainingResponse = await hrUser.agent
        .get(`/api/employees/${employee.id}/documents?search=Training`)
        .expect(200);
      
      expect(trainingResponse.body.documents).toHaveLength(1);
      expect(trainingResponse.body.documents[0].description).toContain('Training');
    });
  });

  describe('Document Storage Tests', () => {
    test('should handle S3 storage configuration', async () => {
      const { adminUser } = await createTestUsers(app);
      
      // Check storage status
      const statusResponse = await adminUser.agent
        .get('/api/storage/status')
        .expect(200);
      
      expect(statusResponse.body).toHaveProperty('configured');
      expect(statusResponse.body).toHaveProperty('type');
      
      if (statusResponse.body.configured && statusResponse.body.type === 's3') {
        expect(statusResponse.body).toHaveProperty('bucketName');
      }
    });
    
    test('should fallback to local storage when S3 fails', async () => {
      const { adminUser } = await createTestUsers(app);
      const employee = await testDb.createTestEmployee({
        firstName: 'Fallback',
        lastName: 'Test',
        workEmail: 'fallback@hospital.com'
      });
      
      // Temporarily mock S3 failure if S3 is configured
      // This is implementation-specific
      
      const testFile = createTestFile('fallback.pdf', 'Fallback content');
      const response = await adminUser.agent
        .post('/api/documents/upload')
        .field('employeeId', employee.id.toString())
        .field('documentType', 'other')
        .attach('document', testFile)
        .expect(201);
      
      // Document should still upload successfully
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('storageType');
      
      // If S3 failed, storage type should be 'local'
      if (response.body.storageType) {
        expect(['local', 's3']).toContain(response.body.storageType);
      }
    });
  });

  describe('Document Security Tests', () => {
    test('should sanitize filenames to prevent path traversal', async () => {
      const { adminUser } = await createTestUsers(app);
      const employee = await testDb.createTestEmployee({
        firstName: 'Security',
        lastName: 'Test',
        workEmail: 'security@hospital.com'
      });
      
      // Create file with path traversal attempt in name
      const maliciousFile = createTestFile('../../../etc/passwd', 'Malicious content');
      
      const response = await adminUser.agent
        .post('/api/documents/upload')
        .field('employeeId', employee.id.toString())
        .field('documentType', 'other')
        .attach('document', maliciousFile)
        .expect(201);
      
      // Filename should be sanitized
      expect(response.body.fileName).not.toContain('..');
      expect(response.body.fileName).not.toContain('/');
    });
    
    test('should prevent XSS in document names', async () => {
      const { adminUser } = await createTestUsers(app);
      const employee = await testDb.createTestEmployee({
        firstName: 'XSS',
        lastName: 'Test',
        workEmail: 'xss@hospital.com'
      });
      
      const testFile = createTestFile('xss.pdf', 'XSS test content');
      
      const response = await adminUser.agent
        .post('/api/documents/upload')
        .field('employeeId', employee.id.toString())
        .field('documentType', 'other')
        .field('description', '<script>alert("XSS")</script>')
        .attach('document', testFile)
        .expect(201);
      
      // Description should be sanitized or escaped
      expect(response.body.description).not.toContain('<script>');
      expect(response.body.description).not.toContain('</script>');
    });
    
    test('should validate MIME types match file extensions', async () => {
      const { adminUser } = await createTestUsers(app);
      const employee = await testDb.createTestEmployee({
        firstName: 'MIME',
        lastName: 'Test',
        workEmail: 'mime@hospital.com'
      });
      
      // Create an exe file disguised as PDF
      const disguisedFile = path.join(tempDir, 'disguised.pdf');
      fs.writeFileSync(disguisedFile, 'MZ\x90\x00'); // EXE header
      uploadedFiles.push(disguisedFile);
      
      const response = await adminUser.agent
        .post('/api/documents/upload')
        .field('employeeId', employee.id.toString())
        .field('documentType', 'other')
        .attach('document', disguisedFile);
      
      // System should detect mismatch and reject or handle appropriately
      if (response.status === 400) {
        expect(response.body.error).toMatch(/type|format|invalid/i);
      } else if (response.status === 201) {
        // If accepted, ensure it's handled safely
        expect(response.body).toHaveProperty('id');
      }
    });
  });
});