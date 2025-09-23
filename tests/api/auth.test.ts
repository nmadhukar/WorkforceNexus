/**
 * Authentication API Tests
 * 
 * Tests all authentication endpoints including login, logout, registration,
 * and user session management.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { getTestApp } from '../utils/test-app';
import { testDb } from '../utils/test-db';

describe('Authentication API', () => {
  let app: any;

  beforeEach(async () => {
    app = await getTestApp();
    await testDb.cleanupBetweenTests();
  });

  afterEach(async () => {
    await testDb.cleanupBetweenTests();
  });

  describe('POST /api/register', () => {
    test('should register a new user successfully', async () => {
      const userData = {
        username: 'testuser@example.com',
        password: 'TestPass123!',
        role: 'hr'
      };

      const response = await request(app)
        .post('/api/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.username).toBe(userData.username);
      expect(response.body.role).toBe(userData.role);
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    test('should reject registration with existing username', async () => {
      const userData = {
        username: 'duplicate@example.com',
        password: 'TestPass123!',
        role: 'hr'
      };

      // First registration should succeed
      await request(app)
        .post('/api/register')
        .send(userData)
        .expect(201);

      // Second registration with same username should fail
      await request(app)
        .post('/api/register')
        .send(userData)
        .expect(400);
    });

    test('should register with invitation token', async () => {
      // Create an invitation first
      const adminUser = await testDb.createTestUser({
        username: 'admin@test.com',
        password: 'AdminPass123!',
        role: 'admin'
      });

      // Create invitation (simplified - in real app this would be done through API)
      const invitation = await testDb.createTestInvitation({
        firstName: 'Invited',
        lastName: 'User',
        email: 'invited@example.com',
        cellPhone: '555-123-4567',
        invitedBy: adminUser.id,
        status: 'pending'
      });

      const userData = {
        username: 'invited@example.com',
        password: 'TestPass123!',
        invitationToken: invitation.invitationToken
      };

      const response = await request(app)
        .post('/api/register')
        .send(userData)
        .expect(201);

      expect(response.body.isOnboarding).toBe(true);
      expect(response.body.role).toBe('viewer'); // Onboarding users start as viewers
      expect(response.body).toHaveProperty('employeeId');
    });

    test('should reject invalid invitation token', async () => {
      const userData = {
        username: 'invalid@example.com',
        password: 'TestPass123!',
        invitationToken: 'invalid-token'
      };

      const response = await request(app)
        .post('/api/register')
        .send(userData)
        .expect(400);

      expect(response.body.error).toBe('Invalid invitation token');
    });
  });

  describe('POST /api/login', () => {
    beforeEach(async () => {
      // Create a test user for login tests
      await testDb.createTestUser({
        username: 'logintest@example.com',
        password: 'LoginPass123!',
        role: 'hr'
      });
    });

    test('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({
          username: 'logintest@example.com',
          password: 'LoginPass123!'
        })
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.username).toBe('logintest@example.com');
      expect(response.body.role).toBe('hr');
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    test('should reject invalid username', async () => {
      await request(app)
        .post('/api/login')
        .send({
          username: 'nonexistent@example.com',
          password: 'AnyPassword123!'
        })
        .expect(401);
    });

    test('should reject invalid password', async () => {
      await request(app)
        .post('/api/login')
        .send({
          username: 'logintest@example.com',
          password: 'WrongPassword123!'
        })
        .expect(401);
    });

    test('should reject empty credentials', async () => {
      await request(app)
        .post('/api/login')
        .send({})
        .expect(400);
    });
  });

  describe('GET /api/user', () => {
    test('should return current user when authenticated', async () => {
      // Create and login user
      await testDb.createTestUser({
        username: 'sessiontest@example.com',
        password: 'SessionPass123!',
        role: 'admin'
      });

      const agent = request.agent(app);
      
      // Login first
      await agent
        .post('/api/login')
        .send({
          username: 'sessiontest@example.com',
          password: 'SessionPass123!'
        })
        .expect(200);

      // Now check user endpoint
      const response = await agent
        .get('/api/user')
        .expect(200);

      expect(response.body.username).toBe('sessiontest@example.com');
      expect(response.body.role).toBe('admin');
    });

    test('should return 401 when not authenticated', async () => {
      await request(app)
        .get('/api/user')
        .expect(401);
    });
  });

  describe('POST /api/logout', () => {
    test('should logout successfully', async () => {
      // Create and login user
      await testDb.createTestUser({
        username: 'logouttest@example.com',
        password: 'LogoutPass123!',
        role: 'hr'
      });

      const agent = request.agent(app);
      
      // Login first
      await agent
        .post('/api/login')
        .send({
          username: 'logouttest@example.com',
          password: 'LogoutPass123!'
        })
        .expect(200);

      // Verify we're logged in
      await agent
        .get('/api/user')
        .expect(200);

      // Logout
      await agent
        .post('/api/logout')
        .expect(200);

      // Verify we're logged out
      await agent
        .get('/api/user')
        .expect(401);
    });

    test('should handle logout when not logged in', async () => {
      await request(app)
        .post('/api/logout')
        .expect(200); // Should still return 200 even if not logged in
    });
  });
});