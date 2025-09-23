/**
 * Authentication Test Helpers
 * 
 * Provides utilities for testing authentication flows and managing
 * authenticated sessions in tests.
 */

import request from 'supertest';
import type { Application } from 'express';
import { testDb } from './test-db';

export interface TestUser {
  id: number;
  username: string;
  role: string;
  passwordHash: string;
  createdAt: Date | null;
}

export interface AuthenticatedAgent {
  agent: request.Agent;
  user: TestUser;
}

/**
 * Create a user and get an authenticated supertest agent
 */
export async function createAuthenticatedUser(
  app: Application,
  userData: { username: string; password: string; role?: string }
): Promise<AuthenticatedAgent> {
  // Create user in database
  const user = await testDb.createTestUser(userData);
  
  // Create agent and authenticate
  const agent = request.agent(app);
  
  await agent
    .post('/api/login')
    .send({
      username: userData.username,
      password: userData.password,
    })
    .expect(200);

  return { agent, user };
}

/**
 * Create multiple test users with different roles
 */
export async function createTestUsers(app: Application) {
  const [adminUser, hrUser, viewerUser] = await Promise.all([
    createAuthenticatedUser(app, {
      username: 'admin@test.com',
      password: 'AdminPass123!',
      role: 'admin'
    }),
    createAuthenticatedUser(app, {
      username: 'hr@test.com', 
      password: 'HrPass123!',
      role: 'hr'
    }),
    createAuthenticatedUser(app, {
      username: 'viewer@test.com',
      password: 'ViewerPass123!',
      role: 'viewer'
    })
  ]);

  return { adminUser, hrUser, viewerUser };
}

/**
 * Test data factory for creating employees
 */
export const testEmployeeData = {
  minimal: {
    firstName: 'John',
    lastName: 'Doe',
    workEmail: 'john.doe@hospital.com',
  },
  
  complete: {
    firstName: 'Jane',
    lastName: 'Smith', 
    middleName: 'Marie',
    workEmail: 'jane.smith@hospital.com',
    personalEmail: 'jane.smith@gmail.com',
    cellPhone: '555-123-4567',
    workPhone: '555-987-6543',
    dateOfBirth: '1990-05-15',
    gender: 'Female',
    homeAddress1: '123 Main St',
    homeCity: 'Anytown',
    homeState: 'CA',
    homeZip: '12345',
    jobTitle: 'Physician',
    workLocation: 'Main Hospital',
    npiNumber: '1234567890',
    medicalLicenseNumber: 'MD123456',
    status: 'active'
  }
};

/**
 * Test data factory for API keys
 */
export const testApiKeyData = {
  readOnly: {
    name: 'Read Only Test Key',
    permissions: ['read:employees', 'read:licenses']
  },
  
  fullAccess: {
    name: 'Full Access Test Key',
    permissions: [
      'read:employees', 'write:employees', 'delete:employees',
      'read:licenses', 'write:licenses', 'delete:licenses',
      'read:documents', 'write:documents', 'delete:documents'
    ]
  }
};

/**
 * Test data factory for invitations
 */
export const testInvitationData = {
  basic: {
    firstName: 'New',
    lastName: 'Employee',
    email: 'new.employee@hospital.com',
    cellPhone: '555-555-5555',
    jobTitle: 'Nurse',
    workLocation: 'ICU',
    expectedStartDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
  }
};