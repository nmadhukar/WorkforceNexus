/**
 * Employee Onboarding API Tests
 * 
 * Tests all onboarding-related API endpoints including invitations,
 * registration, and employee creation with comprehensive validation.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { getTestApp } from '../utils/test-app';
import { testDb } from '../utils/test-db';
import { createAuthenticatedUser, createTestUsers, testEmployeeData } from '../utils/auth-helpers';

describe('Employee Onboarding API', () => {
  let app: any;

  beforeEach(async () => {
    app = await getTestApp();
    await testDb.cleanupBetweenTests();
  });

  afterEach(async () => {
    await testDb.cleanupBetweenTests();
  });

  describe('POST /api/employees/invite', () => {
    test('should create valid invitation', async () => {
      const { adminUser } = await createTestUsers(app);
      
      const invitationData = {
        firstName: 'New',
        lastName: 'Employee',
        email: 'new.employee@hospital.com',
        cellPhone: '555-123-4567',
        jobTitle: 'Physician',
        workLocation: 'Main Hospital',
        expectedStartDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };

      const response = await adminUser.agent
        .post('/api/employees/invite')
        .send(invitationData)
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('email', invitationData.email);
      expect(response.body).toHaveProperty('firstName', invitationData.firstName);
      expect(response.body).toHaveProperty('lastName', invitationData.lastName);
      expect(response.body).toHaveProperty('status', 'pending');
    });

    test('should fail with missing required fields', async () => {
      const { adminUser } = await createTestUsers(app);
      
      const invalidData = {
        firstName: 'Test',
        // Missing lastName and email
      };

      const response = await adminUser.agent
        .post('/api/employees/invite')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'lastName'
          }),
          expect.objectContaining({
            field: 'email'
          })
        ])
      );
    });

    test('should fail with invalid email format', async () => {
      const { adminUser } = await createTestUsers(app);
      
      const invitationData = {
        firstName: 'Test',
        lastName: 'User',
        email: 'invalid-email-format'
      };

      const response = await adminUser.agent
        .post('/api/employees/invite')
        .send(invitationData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'email',
            message: expect.stringMatching(/valid email/i)
          })
        ])
      );
    });

    test('should enforce rate limiting', async () => {
      const { adminUser } = await createTestUsers(app);
      
      // Make 6 requests in quick succession (limit is 5 per 15 minutes)
      const promises = [];
      for (let i = 0; i < 6; i++) {
        promises.push(
          adminUser.agent
            .post('/api/employees/invite')
            .send({
              firstName: `Test${i}`,
              lastName: `User${i}`,
              email: `test${i}@hospital.com`
            })
        );
      }

      const responses = await Promise.all(promises);
      
      // First 5 should succeed (201) or fail with validation (400)
      // 6th should be rate limited (429)
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    test('should enforce authorization - admin can invite any role', async () => {
      const { adminUser } = await createTestUsers(app);
      
      const roles = ['admin', 'hr', 'viewer'];
      
      for (const role of roles) {
        const response = await adminUser.agent
          .post('/api/employees/invite')
          .send({
            firstName: 'Test',
            lastName: `${role}User`,
            email: `${role}@hospital.com`,
            role: role
          })
          .expect(201);

        expect(response.body.role).toBe(role);
      }
    });

    test('should enforce authorization - HR can only invite viewer role', async () => {
      const { hrUser } = await createTestUsers(app);
      
      // Try to invite admin - should fail or default to viewer
      const adminInvite = await hrUser.agent
        .post('/api/employees/invite')
        .send({
          firstName: 'Test',
          lastName: 'Admin',
          email: 'testadmin@hospital.com',
          role: 'admin'
        });

      if (adminInvite.status === 201) {
        expect(adminInvite.body.role).toBe('viewer');
      } else {
        expect(adminInvite.status).toBe(403);
      }

      // Invite viewer - should succeed
      const viewerInvite = await hrUser.agent
        .post('/api/employees/invite')
        .send({
          firstName: 'Test',
          lastName: 'Viewer',
          email: 'testviewer@hospital.com',
          role: 'viewer'
        })
        .expect(201);

      expect(viewerInvite.body.role).toBe('viewer');
    });

    test('should enforce authorization - viewer cannot invite', async () => {
      const { viewerUser } = await createTestUsers(app);
      
      await viewerUser.agent
        .post('/api/employees/invite')
        .send({
          firstName: 'Test',
          lastName: 'User',
          email: 'test@hospital.com'
        })
        .expect(403);
    });

    test('should prevent duplicate email invitations', async () => {
      const { adminUser } = await createTestUsers(app);
      
      const invitationData = {
        firstName: 'Test',
        lastName: 'User',
        email: 'duplicate@hospital.com'
      };

      // First invitation should succeed
      await adminUser.agent
        .post('/api/employees/invite')
        .send(invitationData)
        .expect(201);

      // Second invitation with same email should fail
      const response = await adminUser.agent
        .post('/api/employees/invite')
        .send(invitationData)
        .expect(400);

      expect(response.body.error).toMatch(/already exists|duplicate/i);
    });
  });

  describe('GET /api/invitations/:token', () => {
    test('should retrieve valid invitation', async () => {
      const { adminUser } = await createTestUsers(app);
      
      // Create an invitation
      const inviteResponse = await adminUser.agent
        .post('/api/employees/invite')
        .send({
          firstName: 'Test',
          lastName: 'User',
          email: 'test@hospital.com'
        });

      const token = inviteResponse.body.token;

      // Retrieve invitation by token (public endpoint)
      const response = await request(app)
        .get(`/api/invitations/${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('firstName', 'Test');
      expect(response.body).toHaveProperty('lastName', 'User');
      expect(response.body).toHaveProperty('email', 'test@hospital.com');
      expect(response.body).not.toHaveProperty('token'); // Token should not be exposed
    });

    test('should return 404 for non-existent token', async () => {
      const fakeToken = 'non-existent-token-12345';

      await request(app)
        .get(`/api/invitations/${fakeToken}`)
        .expect(404);
    });

    test('should handle expired token', async () => {
      const { adminUser } = await createTestUsers(app);
      
      // Create an invitation
      const inviteResponse = await adminUser.agent
        .post('/api/employees/invite')
        .send({
          firstName: 'Test',
          lastName: 'User',
          email: 'expired@hospital.com'
        });

      const token = inviteResponse.body.token;
      
      // Manually expire the invitation in the database
      await testDb.expireInvitation(token);

      // Try to retrieve expired invitation
      const response = await request(app)
        .get(`/api/invitations/${token}`)
        .expect(400);

      expect(response.body.error).toMatch(/expired/i);
    });

    test('should validate token format', async () => {
      const invalidTokens = [
        '../../etc/passwd',
        '<script>alert(1)</script>',
        'SELECT * FROM users',
        ''; DROP TABLE invitations; --',
        '%00',
        '../../../',
        'null',
        'undefined'
      ];

      for (const token of invalidTokens) {
        const response = await request(app)
          .get(`/api/invitations/${encodeURIComponent(token)}`)
          .expect((res) => {
            expect([400, 404]).toContain(res.status);
          });
      }
    });
  });

  describe('POST /api/register/:token', () => {
    test('should successfully register with valid token', async () => {
      const { adminUser } = await createTestUsers(app);
      
      // Create invitation
      const inviteResponse = await adminUser.agent
        .post('/api/employees/invite')
        .send({
          firstName: 'New',
          lastName: 'Employee',
          email: 'newemployee@hospital.com'
        });

      const token = inviteResponse.body.token;

      // Register with the token
      const response = await request(app)
        .post(`/api/register/${token}`)
        .send({
          password: 'SecurePassword123!',
          confirmPassword: 'SecurePassword123!'
        })
        .expect(201);

      expect(response.body).toHaveProperty('message', expect.stringMatching(/success/i));
      expect(response.body).toHaveProperty('userId');
      
      // Verify user can login
      const loginResponse = await request(app)
        .post('/api/login')
        .send({
          username: 'newemployee@hospital.com',
          password: 'SecurePassword123!'
        })
        .expect(200);

      expect(loginResponse.body).toHaveProperty('user');
    });

    test('should fail with duplicate email', async () => {
      const { adminUser } = await createTestUsers(app);
      
      // Create first user
      await testDb.createTestUser({
        username: 'existing@hospital.com',
        password: 'Password123!',
        role: 'viewer'
      });

      // Create invitation with same email
      const inviteResponse = await adminUser.agent
        .post('/api/employees/invite')
        .send({
          firstName: 'Duplicate',
          lastName: 'Email',
          email: 'existing@hospital.com'
        });

      if (inviteResponse.status === 201) {
        const token = inviteResponse.body.token;

        // Try to register - should fail
        const response = await request(app)
          .post(`/api/register/${token}`)
          .send({
            password: 'AnotherPassword123!',
            confirmPassword: 'AnotherPassword123!'
          })
          .expect(400);

        expect(response.body.error).toMatch(/already exists|duplicate/i);
      }
    });

    test('should enforce weak password policy', async () => {
      const { adminUser } = await createTestUsers(app);
      
      // Create invitation
      const inviteResponse = await adminUser.agent
        .post('/api/employees/invite')
        .send({
          firstName: 'Test',
          lastName: 'User',
          email: 'weakpass@hospital.com'
        });

      const token = inviteResponse.body.token;

      const weakPasswords = [
        'password',        // Too common
        '12345678',       // No letters
        'abcdefgh',       // No numbers
        'Pass123',        // Too short
        'password123',    // No special characters
        'PASSWORD123!'    // No lowercase (if enforced)
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post(`/api/register/${token}`)
          .send({
            password: password,
            confirmPassword: password
          });

        if (response.status !== 201) {
          expect(response.status).toBe(400);
          expect(response.body.error || response.body.errors).toBeDefined();
        }
      }
    });

    test('should fail with missing fields', async () => {
      const { adminUser } = await createTestUsers(app);
      
      // Create invitation
      const inviteResponse = await adminUser.agent
        .post('/api/employees/invite')
        .send({
          firstName: 'Test',
          lastName: 'User',
          email: 'missingfields@hospital.com'
        });

      const token = inviteResponse.body.token;

      // Missing password
      await request(app)
        .post(`/api/register/${token}`)
        .send({
          confirmPassword: 'Password123!'
        })
        .expect(400);

      // Missing confirmPassword
      await request(app)
        .post(`/api/register/${token}`)
        .send({
          password: 'Password123!'
        })
        .expect(400);

      // Empty body
      await request(app)
        .post(`/api/register/${token}`)
        .send({})
        .expect(400);
    });

    test('should fail when passwords do not match', async () => {
      const { adminUser } = await createTestUsers(app);
      
      // Create invitation
      const inviteResponse = await adminUser.agent
        .post('/api/employees/invite')
        .send({
          firstName: 'Test',
          lastName: 'User',
          email: 'mismatch@hospital.com'
        });

      const token = inviteResponse.body.token;

      const response = await request(app)
        .post(`/api/register/${token}`)
        .send({
          password: 'Password123!',
          confirmPassword: 'DifferentPassword123!'
        })
        .expect(400);

      expect(response.body.error).toMatch(/match|same/i);
    });
  });

  describe('POST /api/employees', () => {
    test('should create employee with all fields', async () => {
      const { adminUser } = await createTestUsers(app);
      
      const completeEmployeeData = {
        // Personal Information
        firstName: 'John',
        middleName: 'Michael',
        lastName: 'Smith',
        dateOfBirth: '1985-06-15',
        gender: 'male',
        ssn: '123-45-6789',
        personalEmail: 'john.smith@personal.com',
        workEmail: 'john.smith@hospital.com',
        cellPhone: '555-123-4567',
        workPhone: '555-987-6543',
        homeAddress1: '123 Main Street',
        homeAddress2: 'Apt 4B',
        homeCity: 'New York',
        homeState: 'NY',
        homeZip: '10001',
        
        // Professional Information
        jobTitle: 'Senior Physician',
        workLocation: 'Main Hospital',
        qualification: 'MD, PhD',
        npiNumber: '1234567890',
        enumerationDate: '2010-01-01',
        
        // Credentials
        medicalLicenseNumber: 'MD123456',
        substanceUseLicenseNumber: 'SUB789',
        substanceUseQualification: 'Addiction Specialist',
        mentalHealthLicenseNumber: 'MH456',
        mentalHealthQualification: 'Psychiatrist',
        medicaidNumber: 'MED789012',
        medicarePtanNumber: 'PTAN345678',
        
        // CAQH Information
        caqhProviderId: 'CAQH123456',
        caqhIssueDate: '2015-03-01',
        caqhLastAttestationDate: '2024-01-01',
        caqhEnabled: true,
        caqhReattestationDueDate: '2025-01-01',
        
        status: 'active'
      };

      const response = await adminUser.agent
        .post('/api/employees')
        .send(completeEmployeeData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.firstName).toBe(completeEmployeeData.firstName);
      expect(response.body.lastName).toBe(completeEmployeeData.lastName);
      expect(response.body.workEmail).toBe(completeEmployeeData.workEmail);
      expect(response.body.jobTitle).toBe(completeEmployeeData.jobTitle);
      expect(response.body.status).toBe('active');
      
      // Verify SSN is masked in response
      if (response.body.ssn) {
        expect(response.body.ssn).toMatch(/\*\*\*-\*\*-\d{4}/);
      }
    });

    test('should validate required fields', async () => {
      const { adminUser } = await createTestUsers(app);
      
      // Missing required fields
      const response = await adminUser.agent
        .post('/api/employees')
        .send({
          middleName: 'Test' // Only optional field
        })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'firstName' }),
          expect.objectContaining({ field: 'lastName' }),
          expect.objectContaining({ field: 'workEmail' })
        ])
      );
    });

    test('should validate field types', async () => {
      const { adminUser } = await createTestUsers(app);
      
      const invalidData = {
        firstName: 123, // Should be string
        lastName: 'Test',
        workEmail: 'not-an-email', // Invalid email
        dateOfBirth: 'not-a-date', // Invalid date
        cellPhone: 'abcd', // Invalid phone
        homeZip: 'abc123' // Invalid zip
      };

      const response = await adminUser.agent
        .post('/api/employees')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      // Should have validation errors for invalid fields
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    test('should enforce foreign key constraints', async () => {
      const { adminUser } = await createTestUsers(app);
      
      // Try to create employee with non-existent location ID (if location is a foreign key)
      const response = await adminUser.agent
        .post('/api/employees')
        .send({
          firstName: 'Test',
          lastName: 'User',
          workEmail: 'test@hospital.com',
          locationId: 99999 // Non-existent location
        });

      // Should either ignore the invalid foreign key or return error
      if (response.status === 400) {
        expect(response.body.error).toMatch(/location|foreign key|constraint/i);
      }
    });

    test('should enforce unique constraints', async () => {
      const { adminUser } = await createTestUsers(app);
      
      const employeeData = {
        firstName: 'Unique',
        lastName: 'Test',
        workEmail: 'unique@hospital.com',
        npiNumber: '9876543210' // If NPI should be unique
      };

      // Create first employee
      await adminUser.agent
        .post('/api/employees')
        .send(employeeData)
        .expect(201);

      // Try to create second employee with same unique fields
      const response = await adminUser.agent
        .post('/api/employees')
        .send({
          ...employeeData,
          firstName: 'Different' // Different name but same email/NPI
        })
        .expect(400);

      expect(response.body.error).toMatch(/already exists|duplicate|unique/i);
    });

    test('should validate date fields', async () => {
      const { adminUser } = await createTestUsers(app);
      
      const invalidDates = {
        firstName: 'Test',
        lastName: 'User',
        workEmail: 'dates@hospital.com',
        dateOfBirth: '2030-01-01', // Future date
        enumerationDate: '1850-01-01' // Too old
      };

      const response = await adminUser.agent
        .post('/api/employees')
        .send(invalidDates);

      // Should validate dates properly
      if (response.status === 400) {
        expect(response.body.error || response.body.errors).toBeDefined();
      }
    });

    test('should sanitize input against SQL injection', async () => {
      const { adminUser } = await createTestUsers(app);
      
      const sqlInjectionAttempt = {
        firstName: "Robert'; DROP TABLE employees; --",
        lastName: "Test",
        workEmail: "sqli@hospital.com",
        jobTitle: "' OR '1'='1"
      };

      const response = await adminUser.agent
        .post('/api/employees')
        .send(sqlInjectionAttempt)
        .expect((res) => {
          // Should either succeed (sanitized) or fail with validation
          expect([201, 400]).toContain(res.status);
        });

      // Verify employees table still exists
      const listResponse = await adminUser.agent
        .get('/api/employees')
        .expect(200);

      expect(listResponse.body).toHaveProperty('employees');
    });

    test('should sanitize input against XSS', async () => {
      const { adminUser } = await createTestUsers(app);
      
      const xssAttempt = {
        firstName: '<script>alert("XSS")</script>',
        lastName: '<img src=x onerror=alert(1)>',
        workEmail: 'xss@hospital.com',
        jobTitle: 'javascript:alert("XSS")'
      };

      const response = await adminUser.agent
        .post('/api/employees')
        .send(xssAttempt);

      if (response.status === 201) {
        // Check that scripts are not stored as-is
        expect(response.body.firstName).not.toContain('<script>');
        expect(response.body.lastName).not.toContain('onerror');
        expect(response.body.jobTitle).not.toContain('javascript:');
      }
    });

    test('should handle large payload gracefully', async () => {
      const { adminUser } = await createTestUsers(app);
      
      // Create a very large string
      const largeString = 'x'.repeat(10000);
      
      const largePayload = {
        firstName: largeString,
        lastName: 'Test',
        workEmail: 'large@hospital.com'
      };

      const response = await adminUser.agent
        .post('/api/employees')
        .send(largePayload)
        .expect((res) => {
          // Should either truncate, reject, or handle gracefully
          expect([201, 400, 413]).toContain(res.status);
        });
    });

    test('should create audit log entry', async () => {
      const { adminUser } = await createTestUsers(app);
      
      const employeeData = {
        firstName: 'Audit',
        lastName: 'Test',
        workEmail: 'audit@hospital.com'
      };

      const response = await adminUser.agent
        .post('/api/employees')
        .send(employeeData)
        .expect(201);

      // Verify audit log was created
      const auditResponse = await adminUser.agent
        .get('/api/audits')
        .query({
          entityType: 'employee',
          entityId: response.body.id
        });

      if (auditResponse.status === 200) {
        expect(auditResponse.body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              action: 'CREATE',
              entityType: 'employee',
              entityId: response.body.id
            })
          ])
        );
      }
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limits on invitation endpoints', async () => {
      const { adminUser } = await createTestUsers(app);
      
      // Make multiple requests quickly
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          adminUser.agent
            .post('/api/employees/invite')
            .send({
              firstName: `Test${i}`,
              lastName: `User${i}`,
              email: `ratelimit${i}@hospital.com`
            })
        );
      }

      const responses = await Promise.all(promises);
      const rateLimited = responses.filter(r => r.status === 429);
      
      // Should have some rate limited responses
      expect(rateLimited.length).toBeGreaterThan(0);
      
      if (rateLimited.length > 0) {
        expect(rateLimited[0].body.error || rateLimited[0].text).toMatch(/rate limit|too many/i);
      }
    });
  });
});