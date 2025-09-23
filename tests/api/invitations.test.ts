/**
 * Invitation System API Tests
 * 
 * Tests all invitation-related endpoints including sending invitations,
 * resending, listing, and acceptance flows.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { getTestApp } from '../utils/test-app';
import { testDb } from '../utils/test-db';
import { createAuthenticatedUser, createTestUsers, testInvitationData } from '../utils/auth-helpers';

describe('Invitation System API', () => {
  let app: any;

  beforeEach(async () => {
    app = await getTestApp();
    await testDb.cleanupBetweenTests();
  });

  afterEach(async () => {
    await testDb.cleanupBetweenTests();
  });

  describe('POST /api/employees/invite', () => {
    test('should send invitation successfully', async () => {
      const { adminUser } = await createTestUsers(app);

      const response = await adminUser.agent
        .post('/api/employees/invite')
        .send(testInvitationData.basic)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('token');
      expect(response.body.firstName).toBe(testInvitationData.basic.firstName);
      expect(response.body.email).toBe(testInvitationData.basic.email);
      expect(response.body.status).toBe('pending');
      expect(response.body).toHaveProperty('expiresAt');
    });

    test('should reject duplicate email invitation', async () => {
      const { adminUser } = await createTestUsers(app);

      // Send first invitation
      await adminUser.agent
        .post('/api/employees/invite')
        .send(testInvitationData.basic)
        .expect(201);

      // Try to send another to same email
      await adminUser.agent
        .post('/api/employees/invite')
        .send(testInvitationData.basic)
        .expect(400);
    });

    test('should require admin role', async () => {
      const { hrUser } = await createTestUsers(app);

      await hrUser.agent
        .post('/api/employees/invite')
        .send(testInvitationData.basic)
        .expect(403);
    });

    test('should validate required fields', async () => {
      const { adminUser } = await createTestUsers(app);

      await adminUser.agent
        .post('/api/employees/invite')
        .send({})
        .expect(400);
    });

    test('should validate email format', async () => {
      const { adminUser } = await createTestUsers(app);

      const invalidData = {
        ...testInvitationData.basic,
        email: 'invalid-email'
      };

      await adminUser.agent
        .post('/api/employees/invite')
        .send(invalidData)
        .expect(400);
    });
  });

  describe('GET /api/invitations', () => {
    test('should list all invitations with pagination', async () => {
      const { adminUser } = await createTestUsers(app);

      // Create test invitations
      await testDb.createTestInvitation({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        cellPhone: '555-123-4567',
        invitedBy: adminUser.user.id
      });

      await testDb.createTestInvitation({
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        cellPhone: '555-987-6543',
        invitedBy: adminUser.user.id
      });

      const response = await adminUser.agent
        .get('/api/invitations')
        .expect(200);

      expect(response.body).toHaveProperty('invitations');
      expect(response.body).toHaveProperty('total');
      expect(response.body.invitations).toHaveLength(2);
      expect(response.body.total).toBe(2);
    });

    test('should filter invitations by status', async () => {
      const { adminUser } = await createTestUsers(app);

      await testDb.createTestInvitation({
        firstName: 'Pending',
        lastName: 'User',
        email: 'pending@example.com',
        cellPhone: '555-123-4567',
        invitedBy: adminUser.user.id,
        status: 'pending'
      });

      await testDb.createTestInvitation({
        firstName: 'Expired',
        lastName: 'User',
        email: 'expired@example.com',
        cellPhone: '555-987-6543',
        invitedBy: adminUser.user.id,
        status: 'expired'
      });

      const response = await adminUser.agent
        .get('/api/invitations?status=pending')
        .expect(200);

      expect(response.body.invitations).toHaveLength(1);
      expect(response.body.invitations[0].status).toBe('pending');
    });

    test('should require admin role', async () => {
      const { hrUser } = await createTestUsers(app);

      await hrUser.agent
        .get('/api/invitations')
        .expect(403);
    });
  });

  describe('POST /api/invitations/:id/resend', () => {
    test('should resend invitation successfully', async () => {
      const { adminUser } = await createTestUsers(app);

      const invitation = await testDb.createTestInvitation({
        firstName: 'Resend',
        lastName: 'Test',
        email: 'resend@example.com',
        cellPhone: '555-123-4567',
        invitedBy: adminUser.user.id
      });

      const response = await adminUser.agent
        .post(`/api/invitations/${invitation.id}/resend`)
        .expect(200);

      expect(response.body.message).toContain('resent');
    });

    test('should return 404 for non-existent invitation', async () => {
      const { adminUser } = await createTestUsers(app);

      await adminUser.agent
        .post('/api/invitations/99999/resend')
        .expect(404);
    });

    test('should reject resending non-pending invitations', async () => {
      const { adminUser } = await createTestUsers(app);

      const invitation = await testDb.createTestInvitation({
        firstName: 'Expired',
        lastName: 'Test',
        email: 'expired@example.com',
        cellPhone: '555-123-4567',
        invitedBy: adminUser.user.id,
        status: 'expired'
      });

      await adminUser.agent
        .post(`/api/invitations/${invitation.id}/resend`)
        .expect(400);
    });

    test('should require admin role', async () => {
      const { hrUser } = await createTestUsers(app);

      const invitation = await testDb.createTestInvitation({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        cellPhone: '555-123-4567',
        invitedBy: hrUser.user.id
      });

      await hrUser.agent
        .post(`/api/invitations/${invitation.id}/resend`)
        .expect(403);
    });
  });

  describe('PUT /api/invitations/:id', () => {
    test('should update invitation details', async () => {
      const { adminUser } = await createTestUsers(app);

      const invitation = await testDb.createTestInvitation({
        firstName: 'Original',
        lastName: 'Name',
        email: 'original@example.com',
        cellPhone: '555-123-4567',
        invitedBy: adminUser.user.id
      });

      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        jobTitle: 'Senior Nurse'
      };

      const response = await adminUser.agent
        .put(`/api/invitations/${invitation.id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.firstName).toBe('Updated');
      expect(response.body.jobTitle).toBe('Senior Nurse');
    });

    test('should return 404 for non-existent invitation', async () => {
      const { adminUser } = await createTestUsers(app);

      await adminUser.agent
        .put('/api/invitations/99999')
        .send({ firstName: 'Test' })
        .expect(404);
    });
  });

  describe('DELETE /api/invitations/:id', () => {
    test('should cancel invitation', async () => {
      const { adminUser } = await createTestUsers(app);

      const invitation = await testDb.createTestInvitation({
        firstName: 'Cancel',
        lastName: 'Me',
        email: 'cancel@example.com',
        cellPhone: '555-123-4567',
        invitedBy: adminUser.user.id
      });

      await adminUser.agent
        .delete(`/api/invitations/${invitation.id}`)
        .expect(204);

      // Verify invitation is deleted/cancelled
      await adminUser.agent
        .get(`/api/invitations/${invitation.id}`)
        .expect(404);
    });

    test('should return 404 for non-existent invitation', async () => {
      const { adminUser } = await createTestUsers(app);

      await adminUser.agent
        .delete('/api/invitations/99999')
        .expect(404);
    });

    test('should require admin role', async () => {
      const { hrUser } = await createTestUsers(app);

      const invitation = await testDb.createTestInvitation({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        cellPhone: '555-123-4567',
        invitedBy: hrUser.user.id
      });

      await hrUser.agent
        .delete(`/api/invitations/${invitation.id}`)
        .expect(403);
    });
  });

  describe('GET /api/invitations/validate/:token', () => {
    test('should validate invitation token', async () => {
      const { adminUser } = await createTestUsers(app);

      const invitation = await testDb.createTestInvitation({
        firstName: 'Validate',
        lastName: 'Token',
        email: 'validate@example.com',
        cellPhone: '555-123-4567',
        invitedBy: adminUser.user.id
      });

      const response = await request(app)
        .get(`/api/invitations/validate/${invitation.invitationToken}`)
        .expect(200);

      expect(response.body.firstName).toBe('Validate');
      expect(response.body.email).toBe('validate@example.com');
      expect(response.body.status).toBe('pending');
    });

    test('should return 404 for invalid token', async () => {
      await request(app)
        .get('/api/invitations/validate/invalid-token')
        .expect(404);
    });

    test('should return 400 for expired invitation', async () => {
      const { adminUser } = await createTestUsers(app);

      const invitation = await testDb.createTestInvitation({
        firstName: 'Expired',
        lastName: 'Token',
        email: 'expired@example.com',
        cellPhone: '555-123-4567',
        invitedBy: adminUser.user.id,
        status: 'expired'
      });

      await request(app)
        .get(`/api/invitations/validate/${invitation.invitationToken}`)
        .expect(400);
    });
  });
});