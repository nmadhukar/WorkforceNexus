/**
 * Employee Management API Tests
 * 
 * Tests all employee CRUD operations and related entity management.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { getTestApp } from '../utils/test-app';
import { testDb } from '../utils/test-db';
import { createAuthenticatedUser, createTestUsers, testEmployeeData } from '../utils/auth-helpers';

describe('Employee Management API', () => {
  let app: any;

  beforeEach(async () => {
    app = await getTestApp();
    await testDb.cleanupBetweenTests();
  });

  afterEach(async () => {
    await testDb.cleanupBetweenTests();
  });

  describe('GET /api/employees', () => {
    test('should list employees with pagination', async () => {
      const { hrUser } = await createTestUsers(app);
      
      // Create test employees
      await testDb.createTestEmployee({
        firstName: 'Alice',
        lastName: 'Johnson',
        workEmail: 'alice@hospital.com'
      });
      
      await testDb.createTestEmployee({
        firstName: 'Bob',
        lastName: 'Smith', 
        workEmail: 'bob@hospital.com'
      });

      const response = await hrUser.agent
        .get('/api/employees')
        .expect(200);

      expect(response.body).toHaveProperty('employees');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('totalPages');
      expect(response.body.employees).toHaveLength(2);
      expect(response.body.total).toBe(2);
    });

    test('should filter employees by search term', async () => {
      const { hrUser } = await createTestUsers(app);
      
      await testDb.createTestEmployee({
        firstName: 'Alice',
        lastName: 'Johnson',
        workEmail: 'alice@hospital.com'
      });
      
      await testDb.createTestEmployee({
        firstName: 'Bob',
        lastName: 'Smith',
        workEmail: 'bob@hospital.com'
      });

      const response = await hrUser.agent
        .get('/api/employees?search=Alice')
        .expect(200);

      expect(response.body.employees).toHaveLength(1);
      expect(response.body.employees[0].firstName).toBe('Alice');
    });

    test('should mask sensitive data in employee list', async () => {
      const { hrUser } = await createTestUsers(app);
      
      await testDb.createTestEmployee({
        firstName: 'Test',
        lastName: 'User',
        workEmail: 'test@hospital.com'
      });

      const response = await hrUser.agent
        .get('/api/employees')
        .expect(200);

      const employee = response.body.employees[0];
      if (employee.ssn) {
        expect(employee.ssn).toMatch(/\*\*\*-\*\*-\d{4}/);
      }
    });

    test('should require authentication', async () => {
      await request(app)
        .get('/api/employees')
        .expect(401);
    });

    test('should work with API key authentication', async () => {
      const adminUser = await testDb.createTestUser({
        username: 'admin@test.com',
        password: 'AdminPass123!',
        role: 'admin'
      });

      const apiKey = await testDb.createTestApiKey({
        name: 'Test API Key',
        permissions: ['read:employees'],
        createdBy: adminUser.id
      });

      await testDb.createTestEmployee({
        firstName: 'API',
        lastName: 'Test',
        workEmail: 'api@hospital.com'
      });

      const response = await request(app)
        .get('/api/employees')
        .set('X-API-Key', 'test-key-hash')
        .expect(200);

      expect(response.body.employees).toHaveLength(1);
    });
  });

  describe('GET /api/employees/:id', () => {
    test('should get employee by ID', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'John',
        lastName: 'Doe',
        workEmail: 'john@hospital.com'
      });

      const response = await hrUser.agent
        .get(`/api/employees/${employee.id}`)
        .expect(200);

      expect(response.body.id).toBe(employee.id);
      expect(response.body.firstName).toBe('John');
      expect(response.body.lastName).toBe('Doe');
    });

    test('should return 404 for non-existent employee', async () => {
      const { hrUser } = await createTestUsers(app);

      await hrUser.agent
        .get('/api/employees/99999')
        .expect(404);
    });
  });

  describe('POST /api/employees', () => {
    test('should create new employee with minimal data', async () => {
      const { hrUser } = await createTestUsers(app);

      const response = await hrUser.agent
        .post('/api/employees')
        .send(testEmployeeData.minimal)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.firstName).toBe(testEmployeeData.minimal.firstName);
      expect(response.body.lastName).toBe(testEmployeeData.minimal.lastName);
      expect(response.body.workEmail).toBe(testEmployeeData.minimal.workEmail);
    });

    test('should create new employee with complete data', async () => {
      const { hrUser } = await createTestUsers(app);

      const response = await hrUser.agent
        .post('/api/employees')
        .send(testEmployeeData.complete)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.firstName).toBe(testEmployeeData.complete.firstName);
      expect(response.body.jobTitle).toBe(testEmployeeData.complete.jobTitle);
      expect(response.body.npiNumber).toBe(testEmployeeData.complete.npiNumber);
    });

    test('should reject duplicate work email', async () => {
      const { hrUser } = await createTestUsers(app);

      // Create first employee
      await hrUser.agent
        .post('/api/employees')
        .send(testEmployeeData.minimal)
        .expect(201);

      // Try to create another with same email
      await hrUser.agent
        .post('/api/employees')
        .send(testEmployeeData.minimal)
        .expect(500); // Should fail due to unique constraint
    });

    test('should require admin or hr role', async () => {
      const { viewerUser } = await createTestUsers(app);

      await viewerUser.agent
        .post('/api/employees')
        .send(testEmployeeData.minimal)
        .expect(403);
    });

    test('should validate required fields', async () => {
      const { hrUser } = await createTestUsers(app);

      await hrUser.agent
        .post('/api/employees')
        .send({})
        .expect(400);
    });
  });

  describe('PUT /api/employees/:id', () => {
    test('should update existing employee', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'Original',
        lastName: 'Name',
        workEmail: 'original@hospital.com'
      });

      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        workEmail: 'original@hospital.com',
        jobTitle: 'Senior Physician'
      };

      const response = await hrUser.agent
        .put(`/api/employees/${employee.id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.firstName).toBe('Updated');
      expect(response.body.jobTitle).toBe('Senior Physician');
    });

    test('should return 404 for non-existent employee', async () => {
      const { hrUser } = await createTestUsers(app);

      await hrUser.agent
        .put('/api/employees/99999')
        .send(testEmployeeData.minimal)
        .expect(404);
    });

    test('should require admin or hr role', async () => {
      const { viewerUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'Test',
        lastName: 'User',
        workEmail: 'test@hospital.com'
      });

      await viewerUser.agent
        .put(`/api/employees/${employee.id}`)
        .send(testEmployeeData.minimal)
        .expect(403);
    });
  });

  describe('DELETE /api/employees/:id', () => {
    test('should delete employee (admin only)', async () => {
      const { adminUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'Delete',
        lastName: 'Me',
        workEmail: 'delete@hospital.com'
      });

      await adminUser.agent
        .delete(`/api/employees/${employee.id}`)
        .expect(204);

      // Verify employee is deleted
      await adminUser.agent
        .get(`/api/employees/${employee.id}`)
        .expect(404);
    });

    test('should require admin role', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'Test',
        lastName: 'User',
        workEmail: 'test@hospital.com'
      });

      await hrUser.agent
        .delete(`/api/employees/${employee.id}`)
        .expect(403);
    });

    test('should return 404 for non-existent employee', async () => {
      const { adminUser } = await createTestUsers(app);

      await adminUser.agent
        .delete('/api/employees/99999')
        .expect(404);
    });
  });
});