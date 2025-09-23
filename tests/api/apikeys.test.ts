/**
 * API Key Management Tests
 * 
 * Tests all API key CRUD operations and authentication flows.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { getTestApp } from '../utils/test-app';
import { testDb } from '../utils/test-db';
import { createTestUsers, testApiKeyData } from '../utils/auth-helpers';

describe('API Key Management API', () => {
  let app: any;

  beforeEach(async () => {
    app = await getTestApp();
    await testDb.cleanupBetweenTests();
  });

  afterEach(async () => {
    await testDb.cleanupBetweenTests();
  });

  describe('POST /api/admin/api-keys', () => {
    test('should create new API key successfully', async () => {
      const { adminUser } = await createTestUsers(app);

      const response = await adminUser.agent
        .post('/api/admin/api-keys')
        .send(testApiKeyData.readOnly)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('key'); // Actual key should be returned only on creation
      expect(response.body.name).toBe(testApiKeyData.readOnly.name);
      expect(response.body.permissions).toEqual(testApiKeyData.readOnly.permissions);
      expect(response.body.isActive).toBe(true);
      expect(response.body.createdBy).toBe(adminUser.user.id);
    });

    test('should create API key with full permissions', async () => {
      const { adminUser } = await createTestUsers(app);

      const response = await adminUser.agent
        .post('/api/admin/api-keys')
        .send(testApiKeyData.fullAccess)
        .expect(201);

      expect(response.body.permissions).toEqual(testApiKeyData.fullAccess.permissions);
      expect(response.body.permissions).toContain('delete:employees');
    });

    test('should reject duplicate API key names', async () => {
      const { adminUser } = await createTestUsers(app);

      // Create first API key
      await adminUser.agent
        .post('/api/admin/api-keys')
        .send(testApiKeyData.readOnly)
        .expect(201);

      // Try to create another with same name
      await adminUser.agent
        .post('/api/admin/api-keys')
        .send(testApiKeyData.readOnly)
        .expect(400);
    });

    test('should validate permissions format', async () => {
      const { adminUser } = await createTestUsers(app);

      const invalidData = {
        name: 'Invalid Key',
        permissions: ['invalid:permission']
      };

      await adminUser.agent
        .post('/api/admin/api-keys')
        .send(invalidData)
        .expect(400);
    });

    test('should require admin role', async () => {
      const { hrUser } = await createTestUsers(app);

      await hrUser.agent
        .post('/api/admin/api-keys')
        .send(testApiKeyData.readOnly)
        .expect(403);
    });

    test('should validate required fields', async () => {
      const { adminUser } = await createTestUsers(app);

      await adminUser.agent
        .post('/api/admin/api-keys')
        .send({})
        .expect(400);
    });

    test('should respect rate limiting', async () => {
      const { adminUser } = await createTestUsers(app);

      // Make multiple rapid requests (assuming rate limit is 5 per hour)
      const requests = Array.from({ length: 6 }, (_, i) => 
        adminUser.agent
          .post('/api/admin/api-keys')
          .send({
            name: `Test Key ${i}`,
            permissions: ['read:employees']
          })
      );

      const responses = await Promise.allSettled(requests);
      
      // At least one should be rate limited
      const rateLimitedResponses = responses.filter(
        (response) => response.status === 'fulfilled' && 
        (response as any).value.status === 429
      );
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/admin/api-keys', () => {
    test('should list all API keys with masked keys', async () => {
      const { adminUser } = await createTestUsers(app);

      // Create test API keys
      await testDb.createTestApiKey({
        name: 'Test Key 1',
        permissions: ['read:employees'],
        createdBy: adminUser.user.id
      });

      await testDb.createTestApiKey({
        name: 'Test Key 2',
        permissions: ['read:licenses'],
        createdBy: adminUser.user.id
      });

      const response = await adminUser.agent
        .get('/api/admin/api-keys')
        .expect(200);

      expect(response.body).toHaveProperty('apiKeys');
      expect(response.body).toHaveProperty('total');
      expect(response.body.apiKeys).toHaveLength(2);
      
      // Keys should be masked in list view
      response.body.apiKeys.forEach((key: any) => {
        expect(key.key).toMatch(/^\*+$/);
      });
    });

    test('should filter API keys by status', async () => {
      const { adminUser } = await createTestUsers(app);

      await testDb.createTestApiKey({
        name: 'Active Key',
        permissions: ['read:employees'],
        createdBy: adminUser.user.id
      });

      // Create inactive key (would need to be updated via API)
      const inactiveKey = await testDb.createTestApiKey({
        name: 'Inactive Key',
        permissions: ['read:employees'],
        createdBy: adminUser.user.id
      });

      // First disable the key
      await adminUser.agent
        .put(`/api/admin/api-keys/${inactiveKey.id}`)
        .send({ isActive: false })
        .expect(200);

      const response = await adminUser.agent
        .get('/api/admin/api-keys?status=active')
        .expect(200);

      expect(response.body.apiKeys).toHaveLength(1);
      expect(response.body.apiKeys[0].name).toBe('Active Key');
    });

    test('should require admin role', async () => {
      const { hrUser } = await createTestUsers(app);

      await hrUser.agent
        .get('/api/admin/api-keys')
        .expect(403);
    });
  });

  describe('GET /api/admin/api-keys/:id', () => {
    test('should get API key details', async () => {
      const { adminUser } = await createTestUsers(app);

      const apiKey = await testDb.createTestApiKey({
        name: 'Test Key',
        permissions: ['read:employees'],
        createdBy: adminUser.user.id
      });

      const response = await adminUser.agent
        .get(`/api/admin/api-keys/${apiKey.id}`)
        .expect(200);

      expect(response.body.id).toBe(apiKey.id);
      expect(response.body.name).toBe('Test Key');
      expect(response.body.permissions).toEqual(['read:employees']);
      // Key should be masked in detail view too
      expect(response.body.key).toMatch(/^\*+$/);
    });

    test('should return 404 for non-existent API key', async () => {
      const { adminUser } = await createTestUsers(app);

      await adminUser.agent
        .get('/api/admin/api-keys/99999')
        .expect(404);
    });
  });

  describe('PUT /api/admin/api-keys/:id', () => {
    test('should update API key name and permissions', async () => {
      const { adminUser } = await createTestUsers(app);

      const apiKey = await testDb.createTestApiKey({
        name: 'Original Name',
        permissions: ['read:employees'],
        createdBy: adminUser.user.id
      });

      const updateData = {
        name: 'Updated Name',
        permissions: ['read:employees', 'read:licenses']
      };

      const response = await adminUser.agent
        .put(`/api/admin/api-keys/${apiKey.id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe('Updated Name');
      expect(response.body.permissions).toEqual(['read:employees', 'read:licenses']);
    });

    test('should disable API key', async () => {
      const { adminUser } = await createTestUsers(app);

      const apiKey = await testDb.createTestApiKey({
        name: 'Disable Me',
        permissions: ['read:employees'],
        createdBy: adminUser.user.id
      });

      const response = await adminUser.agent
        .put(`/api/admin/api-keys/${apiKey.id}`)
        .send({ isActive: false })
        .expect(200);

      expect(response.body.isActive).toBe(false);
    });

    test('should return 404 for non-existent API key', async () => {
      const { adminUser } = await createTestUsers(app);

      await adminUser.agent
        .put('/api/admin/api-keys/99999')
        .send({ name: 'Updated' })
        .expect(404);
    });

    test('should require admin role', async () => {
      const { hrUser } = await createTestUsers(app);

      const apiKey = await testDb.createTestApiKey({
        name: 'Test Key',
        permissions: ['read:employees'],
        createdBy: hrUser.user.id
      });

      await hrUser.agent
        .put(`/api/admin/api-keys/${apiKey.id}`)
        .send({ name: 'Updated' })
        .expect(403);
    });
  });

  describe('DELETE /api/admin/api-keys/:id', () => {
    test('should delete API key', async () => {
      const { adminUser } = await createTestUsers(app);

      const apiKey = await testDb.createTestApiKey({
        name: 'Delete Me',
        permissions: ['read:employees'],
        createdBy: adminUser.user.id
      });

      await adminUser.agent
        .delete(`/api/admin/api-keys/${apiKey.id}`)
        .expect(204);

      // Verify key is deleted
      await adminUser.agent
        .get(`/api/admin/api-keys/${apiKey.id}`)
        .expect(404);
    });

    test('should return 404 for non-existent API key', async () => {
      const { adminUser } = await createTestUsers(app);

      await adminUser.agent
        .delete('/api/admin/api-keys/99999')
        .expect(404);
    });

    test('should require admin role', async () => {
      const { hrUser } = await createTestUsers(app);

      const apiKey = await testDb.createTestApiKey({
        name: 'Test Key',
        permissions: ['read:employees'],
        createdBy: hrUser.user.id
      });

      await hrUser.agent
        .delete(`/api/admin/api-keys/${apiKey.id}`)
        .expect(403);
    });
  });

  describe('API Key Authentication', () => {
    test('should authenticate with valid API key', async () => {
      const adminUser = await testDb.createTestUser({
        username: 'admin@test.com',
        password: 'AdminPass123!',
        role: 'admin'
      });

      const apiKey = await testDb.createTestApiKey({
        name: 'Auth Test Key',
        permissions: ['read:employees'],
        createdBy: adminUser.id
      });

      // Create an employee to test against
      await testDb.createTestEmployee({
        firstName: 'API',
        lastName: 'Test',
        workEmail: 'api@hospital.com'
      });

      const response = await request(app)
        .get('/api/employees')
        .set('X-API-Key', 'test-key-hash') // Using the test hash from createTestApiKey
        .expect(200);

      expect(response.body.employees).toHaveLength(1);
    });

    test('should reject invalid API key', async () => {
      await request(app)
        .get('/api/employees')
        .set('X-API-Key', 'invalid-key')
        .expect(401);
    });

    test('should reject disabled API key', async () => {
      const adminUser = await testDb.createTestUser({
        username: 'admin@test.com',
        password: 'AdminPass123!',
        role: 'admin'
      });

      // Create inactive API key by updating after creation
      const apiKey = await testDb.createTestApiKey({
        name: 'Inactive Key',
        permissions: ['read:employees'],
        createdBy: adminUser.id
      });

      // Disable the key (would normally be done through the API)
      const { db } = await import('../../server/db');
      const { apiKeys } = await import('../../shared/schema');
      const { eq } = await import('drizzle-orm');
      
      await db.update(apiKeys)
        .set({ revokedAt: new Date() })
        .where(eq(apiKeys.id, apiKey.id));

      await request(app)
        .get('/api/employees')
        .set('X-API-Key', 'test-key-hash')
        .expect(401);
    });

    test('should enforce API key permissions', async () => {
      const adminUser = await testDb.createTestUser({
        username: 'admin@test.com',
        password: 'AdminPass123!',
        role: 'admin'
      });

      // Create API key with only read permissions
      const apiKey = await testDb.createTestApiKey({
        name: 'Read Only Key',
        permissions: ['read:employees'], // No write permissions
        createdBy: adminUser.id
      });

      // Should be able to read
      await request(app)
        .get('/api/employees')
        .set('X-API-Key', 'test-key-hash')
        .expect(200);

      // Should not be able to write
      await request(app)
        .post('/api/employees')
        .set('X-API-Key', 'test-key-hash')
        .send({
          firstName: 'Test',
          lastName: 'User',
          workEmail: 'test@hospital.com'
        })
        .expect(403);
    });
  });
});