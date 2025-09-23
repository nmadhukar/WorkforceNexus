/**
 * Document Management API Tests
 * 
 * Tests all document-related endpoints including upload, download, 
 * listing, and management operations.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { getTestApp } from '../utils/test-app';
import { testDb } from '../utils/test-db';
import { createTestUsers } from '../utils/auth-helpers';
import path from 'path';
import fs from 'fs';

describe('Document Management API', () => {
  let app: any;
  const testFilePath = path.join(__dirname, '../utils/test-file.pdf');

  beforeEach(async () => {
    app = await getTestApp();
    await testDb.cleanupBetweenTests();
    
    // Create a test file for upload tests
    if (!fs.existsSync(testFilePath)) {
      fs.writeFileSync(testFilePath, 'Test PDF content for upload testing');
    }
  });

  afterEach(async () => {
    await testDb.cleanupBetweenTests();
    
    // Clean up test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  describe('POST /api/documents/upload', () => {
    test('should upload document successfully', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'Document',
        lastName: 'Test',
        workEmail: 'docs@hospital.com'
      });

      const response = await hrUser.agent
        .post('/api/documents/upload')
        .field('employeeId', employee.id.toString())
        .field('documentType', 'license')
        .field('description', 'Medical License Document')
        .attach('document', testFilePath)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.employeeId).toBe(employee.id);
      expect(response.body.documentType).toBe('license');
      expect(response.body.description).toBe('Medical License Document');
      expect(response.body).toHaveProperty('fileName');
      expect(response.body).toHaveProperty('fileSize');
      expect(response.body).toHaveProperty('uploadedAt');
    });

    test('should reject unsupported file types', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'Document',
        lastName: 'Test',
        workEmail: 'docs@hospital.com'
      });

      // Create a test file with unsupported extension
      const unsupportedFile = path.join(__dirname, '../utils/test.txt');
      fs.writeFileSync(unsupportedFile, 'Unsupported file type');

      await hrUser.agent
        .post('/api/documents/upload')
        .field('employeeId', employee.id.toString())
        .field('documentType', 'license')
        .attach('document', unsupportedFile)
        .expect(400);

      // Clean up
      fs.unlinkSync(unsupportedFile);
    });

    test('should reject files exceeding size limit', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'Document',
        lastName: 'Test',
        workEmail: 'docs@hospital.com'
      });

      // Create a large test file (>10MB)
      const largeFile = path.join(__dirname, '../utils/large-test.pdf');
      const largeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
      fs.writeFileSync(largeFile, largeContent);

      await hrUser.agent
        .post('/api/documents/upload')
        .field('employeeId', employee.id.toString())
        .field('documentType', 'license')
        .attach('document', largeFile)
        .expect(400);

      // Clean up
      fs.unlinkSync(largeFile);
    });

    test('should require authentication', async () => {
      await request(app)
        .post('/api/documents/upload')
        .field('employeeId', '1')
        .field('documentType', 'license')
        .attach('document', testFilePath)
        .expect(401);
    });

    test('should require admin or hr role', async () => {
      const { viewerUser } = await createTestUsers(app);

      await viewerUser.agent
        .post('/api/documents/upload')
        .field('employeeId', '1')
        .field('documentType', 'license')
        .attach('document', testFilePath)
        .expect(403);
    });

    test('should validate required fields', async () => {
      const { hrUser } = await createTestUsers(app);

      await hrUser.agent
        .post('/api/documents/upload')
        .attach('document', testFilePath)
        .expect(400);
    });
  });

  describe('GET /api/documents', () => {
    test('should list documents with pagination', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'Doc',
        lastName: 'Test',
        workEmail: 'doctest@hospital.com'
      });

      // Create test documents directly in database
      await testDb.createTestDocument({
        employeeId: employee.id,
        fileName: 'license.pdf',
        originalFileName: 'Medical License.pdf',
        documentType: 'license',
        fileSize: 1024,
        uploadedBy: hrUser.user.id
      });

      await testDb.createTestDocument({
        employeeId: employee.id,
        fileName: 'certification.pdf',
        originalFileName: 'Board Certification.pdf',
        documentType: 'certification',
        fileSize: 2048,
        uploadedBy: hrUser.user.id
      });

      const response = await hrUser.agent
        .get('/api/documents')
        .expect(200);

      expect(response.body).toHaveProperty('documents');
      expect(response.body).toHaveProperty('total');
      expect(response.body.documents).toHaveLength(2);
      expect(response.body.total).toBe(2);
    });

    test('should filter documents by employee', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const employee1 = await testDb.createTestEmployee({
        firstName: 'Employee',
        lastName: 'One',
        workEmail: 'emp1@hospital.com'
      });

      const employee2 = await testDb.createTestEmployee({
        firstName: 'Employee',
        lastName: 'Two',
        workEmail: 'emp2@hospital.com'
      });

      await testDb.createTestDocument({
        employeeId: employee1.id,
        fileName: 'doc1.pdf',
        originalFileName: 'Document 1.pdf',
        documentType: 'license',
        fileSize: 1024,
        uploadedBy: hrUser.user.id
      });

      await testDb.createTestDocument({
        employeeId: employee2.id,
        fileName: 'doc2.pdf',
        originalFileName: 'Document 2.pdf',
        documentType: 'certification',
        fileSize: 2048,
        uploadedBy: hrUser.user.id
      });

      const response = await hrUser.agent
        .get(`/api/documents?employeeId=${employee1.id}`)
        .expect(200);

      expect(response.body.documents).toHaveLength(1);
      expect(response.body.documents[0].employeeId).toBe(employee1.id);
    });

    test('should filter documents by type', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'Doc',
        lastName: 'Filter',
        workEmail: 'filter@hospital.com'
      });

      await testDb.createTestDocument({
        employeeId: employee.id,
        fileName: 'license.pdf',
        documentType: 'license',
        fileSize: 1024,
        uploadedBy: hrUser.user.id
      });

      await testDb.createTestDocument({
        employeeId: employee.id,
        fileName: 'cert.pdf',
        documentType: 'certification',
        fileSize: 2048,
        uploadedBy: hrUser.user.id
      });

      const response = await hrUser.agent
        .get('/api/documents?documentType=license')
        .expect(200);

      expect(response.body.documents).toHaveLength(1);
      expect(response.body.documents[0].documentType).toBe('license');
    });

    test('should require authentication', async () => {
      await request(app)
        .get('/api/documents')
        .expect(401);
    });
  });

  describe('GET /api/documents/:id', () => {
    test('should get document details', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'Doc',
        lastName: 'Detail',
        workEmail: 'detail@hospital.com'
      });

      const document = await testDb.createTestDocument({
        employeeId: employee.id,
        fileName: 'test-doc.pdf',
        originalFileName: 'Test Document.pdf',
        documentType: 'license',
        fileSize: 1024,
        uploadedBy: hrUser.user.id
      });

      const response = await hrUser.agent
        .get(`/api/documents/${document.id}`)
        .expect(200);

      expect(response.body.id).toBe(document.id);
      expect(response.body.employeeId).toBe(employee.id);
      expect(response.body.documentType).toBe('license');
      expect(response.body.originalFileName).toBe('Test Document.pdf');
    });

    test('should return 404 for non-existent document', async () => {
      const { hrUser } = await createTestUsers(app);

      await hrUser.agent
        .get('/api/documents/99999')
        .expect(404);
    });
  });

  describe('GET /api/documents/:id/download', () => {
    test('should download document file', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'Download',
        lastName: 'Test',
        workEmail: 'download@hospital.com'
      });

      const document = await testDb.createTestDocument({
        employeeId: employee.id,
        fileName: 'download-test.pdf',
        originalFileName: 'Download Test.pdf',
        documentType: 'license',
        fileSize: 1024,
        uploadedBy: hrUser.user.id
      });

      const response = await hrUser.agent
        .get(`/api/documents/${document.id}/download`)
        .expect(200);

      expect(response.headers['content-type']).toContain('application');
      expect(response.headers['content-disposition']).toContain('attachment');
    });

    test('should return 404 for non-existent document', async () => {
      const { hrUser } = await createTestUsers(app);

      await hrUser.agent
        .get('/api/documents/99999/download')
        .expect(404);
    });

    test('should require authentication', async () => {
      await request(app)
        .get('/api/documents/1/download')
        .expect(401);
    });
  });

  describe('PUT /api/documents/:id', () => {
    test('should update document metadata', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'Update',
        lastName: 'Test',
        workEmail: 'update@hospital.com'
      });

      const document = await testDb.createTestDocument({
        employeeId: employee.id,
        fileName: 'update-test.pdf',
        originalFileName: 'Original Name.pdf',
        documentType: 'license',
        description: 'Original description',
        fileSize: 1024,
        uploadedBy: hrUser.user.id
      });

      const updateData = {
        description: 'Updated description',
        documentType: 'certification'
      };

      const response = await hrUser.agent
        .put(`/api/documents/${document.id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.description).toBe('Updated description');
      expect(response.body.documentType).toBe('certification');
    });

    test('should return 404 for non-existent document', async () => {
      const { hrUser } = await createTestUsers(app);

      await hrUser.agent
        .put('/api/documents/99999')
        .send({ description: 'Updated' })
        .expect(404);
    });

    test('should require admin or hr role', async () => {
      const { viewerUser } = await createTestUsers(app);

      await viewerUser.agent
        .put('/api/documents/1')
        .send({ description: 'Updated' })
        .expect(403);
    });
  });

  describe('DELETE /api/documents/:id', () => {
    test('should delete document (admin only)', async () => {
      const { adminUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'Delete',
        lastName: 'Test',
        workEmail: 'delete@hospital.com'
      });

      const document = await testDb.createTestDocument({
        employeeId: employee.id,
        fileName: 'delete-test.pdf',
        documentType: 'license',
        fileSize: 1024,
        uploadedBy: adminUser.user.id
      });

      await adminUser.agent
        .delete(`/api/documents/${document.id}`)
        .expect(204);

      // Verify document is deleted
      await adminUser.agent
        .get(`/api/documents/${document.id}`)
        .expect(404);
    });

    test('should require admin role', async () => {
      const { hrUser } = await createTestUsers(app);

      await hrUser.agent
        .delete('/api/documents/1')
        .expect(403);
    });

    test('should return 404 for non-existent document', async () => {
      const { adminUser } = await createTestUsers(app);

      await adminUser.agent
        .delete('/api/documents/99999')
        .expect(404);
    });
  });

  describe('GET /api/employees/:id/documents', () => {
    test('should get all documents for an employee', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'Employee',
        lastName: 'Docs',
        workEmail: 'empdocs@hospital.com'
      });

      // Create multiple documents for the employee
      await testDb.createTestDocument({
        employeeId: employee.id,
        fileName: 'license.pdf',
        documentType: 'license',
        fileSize: 1024,
        uploadedBy: hrUser.user.id
      });

      await testDb.createTestDocument({
        employeeId: employee.id,
        fileName: 'cert.pdf',
        documentType: 'certification',
        fileSize: 2048,
        uploadedBy: hrUser.user.id
      });

      const response = await hrUser.agent
        .get(`/api/employees/${employee.id}/documents`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.every((doc: any) => doc.employeeId === employee.id)).toBe(true);
    });

    test('should return empty array for employee with no documents', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'No',
        lastName: 'Docs',
        workEmail: 'nodocs@hospital.com'
      });

      const response = await hrUser.agent
        .get(`/api/employees/${employee.id}/documents`)
        .expect(200);

      expect(response.body).toHaveLength(0);
    });

    test('should return 404 for non-existent employee', async () => {
      const { hrUser } = await createTestUsers(app);

      await hrUser.agent
        .get('/api/employees/99999/documents')
        .expect(404);
    });
  });
});