/**
 * Employee Entity Management API Tests
 * 
 * Tests all employee-related entity endpoints including educations,
 * employments, licenses, certifications, references, and other sub-entities.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { getTestApp } from '../utils/test-app';
import { testDb } from '../utils/test-db';
import { createTestUsers } from '../utils/auth-helpers';

describe('Employee Entity Management API', () => {
  let app: any;
  let employee: any;

  beforeEach(async () => {
    app = await getTestApp();
    await testDb.cleanupBetweenTests();
    
    // Create a test employee for entity tests
    employee = await testDb.createTestEmployee({
      firstName: 'Entity',
      lastName: 'Test',
      workEmail: 'entity@hospital.com'
    });
  });

  afterEach(async () => {
    await testDb.cleanupBetweenTests();
  });

  describe('Education Management', () => {
    describe('GET /api/employees/:id/educations', () => {
      test('should get employee educations', async () => {
        const { hrUser } = await createTestUsers(app);

        const response = await hrUser.agent
          .get(`/api/employees/${employee.id}/educations`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });

      test('should return 404 for non-existent employee', async () => {
        const { hrUser } = await createTestUsers(app);

        await hrUser.agent
          .get('/api/employees/99999/educations')
          .expect(404);
      });
    });

    describe('POST /api/employees/:id/educations', () => {
      test('should create new education record', async () => {
        const { hrUser } = await createTestUsers(app);

        const educationData = {
          institutionName: 'Harvard Medical School',
          degree: 'Doctor of Medicine',
          fieldOfStudy: 'Medicine',
          startDate: '2015-09-01',
          endDate: '2019-05-31',
          graduationDate: '2019-05-31',
          gpa: '3.8'
        };

        const response = await hrUser.agent
          .post(`/api/employees/${employee.id}/educations`)
          .send(educationData)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.institutionName).toBe(educationData.institutionName);
        expect(response.body.degree).toBe(educationData.degree);
        expect(response.body.employeeId).toBe(employee.id);
      });

      test('should require admin or hr role', async () => {
        const { viewerUser } = await createTestUsers(app);

        const educationData = {
          institutionName: 'Test University',
          degree: 'Bachelor',
          fieldOfStudy: 'Biology'
        };

        await viewerUser.agent
          .post(`/api/employees/${employee.id}/educations`)
          .send(educationData)
          .expect(403);
      });

      test('should validate required fields', async () => {
        const { hrUser } = await createTestUsers(app);

        await hrUser.agent
          .post(`/api/employees/${employee.id}/educations`)
          .send({})
          .expect(400);
      });
    });
  });

  describe('Employment History Management', () => {
    describe('GET /api/employees/:id/employments', () => {
      test('should get employee employment history', async () => {
        const { hrUser } = await createTestUsers(app);

        const response = await hrUser.agent
          .get(`/api/employees/${employee.id}/employments`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('POST /api/employees/:id/employments', () => {
      test('should create new employment record', async () => {
        const { hrUser } = await createTestUsers(app);

        const employmentData = {
          organizationName: 'General Hospital',
          jobTitle: 'Resident Physician',
          department: 'Internal Medicine',
          startDate: '2019-07-01',
          endDate: '2022-06-30',
          supervisorName: 'Dr. Smith',
          supervisorTitle: 'Attending Physician',
          supervisorPhone: '555-123-4567',
          supervisorEmail: 'dr.smith@hospital.com',
          reasonForLeaving: 'Completed residency'
        };

        const response = await hrUser.agent
          .post(`/api/employees/${employee.id}/employments`)
          .send(employmentData)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.organizationName).toBe(employmentData.organizationName);
        expect(response.body.jobTitle).toBe(employmentData.jobTitle);
        expect(response.body.employeeId).toBe(employee.id);
      });

      test('should validate required fields', async () => {
        const { hrUser } = await createTestUsers(app);

        await hrUser.agent
          .post(`/api/employees/${employee.id}/employments`)
          .send({})
          .expect(400);
      });
    });
  });

  describe('State License Management', () => {
    describe('GET /api/employees/:id/state-licenses', () => {
      test('should get employee state licenses', async () => {
        const { hrUser } = await createTestUsers(app);

        const response = await hrUser.agent
          .get(`/api/employees/${employee.id}/state-licenses`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('POST /api/employees/:id/state-licenses', () => {
      test('should create new state license', async () => {
        const { hrUser } = await createTestUsers(app);

        const licenseData = {
          state: 'California',
          licenseNumber: 'CA12345',
          licenseType: 'Medical Doctor',
          issueDate: '2019-08-15',
          expirationDate: '2023-08-15',
          isActive: true
        };

        const response = await hrUser.agent
          .post(`/api/employees/${employee.id}/state-licenses`)
          .send(licenseData)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.state).toBe(licenseData.state);
        expect(response.body.licenseNumber).toBe(licenseData.licenseNumber);
        expect(response.body.employeeId).toBe(employee.id);
      });

      test('should validate required fields', async () => {
        const { hrUser } = await createTestUsers(app);

        await hrUser.agent
          .post(`/api/employees/${employee.id}/state-licenses`)
          .send({})
          .expect(400);
      });
    });
  });

  describe('DEA License Management', () => {
    describe('GET /api/employees/:id/dea-licenses', () => {
      test('should get employee DEA licenses', async () => {
        const { hrUser } = await createTestUsers(app);

        const response = await hrUser.agent
          .get(`/api/employees/${employee.id}/dea-licenses`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('POST /api/employees/:id/dea-licenses', () => {
      test('should create new DEA license', async () => {
        const { hrUser } = await createTestUsers(app);

        const deaData = {
          deaNumber: 'AD1234567',
          issueDate: '2020-01-15',
          expirationDate: '2023-01-15',
          businessActivityCode: '1',
          isActive: true
        };

        const response = await hrUser.agent
          .post(`/api/employees/${employee.id}/dea-licenses`)
          .send(deaData)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.deaNumber).toBe(deaData.deaNumber);
        expect(response.body.employeeId).toBe(employee.id);
      });

      test('should validate DEA number format', async () => {
        const { hrUser } = await createTestUsers(app);

        const invalidDeaData = {
          deaNumber: 'INVALID', // Invalid DEA format
          issueDate: '2020-01-15',
          expirationDate: '2023-01-15'
        };

        await hrUser.agent
          .post(`/api/employees/${employee.id}/dea-licenses`)
          .send(invalidDeaData)
          .expect(400);
      });
    });
  });

  describe('Board Certification Management', () => {
    describe('GET /api/employees/:id/board-certifications', () => {
      test('should get employee board certifications', async () => {
        const { hrUser } = await createTestUsers(app);

        const response = await hrUser.agent
          .get(`/api/employees/${employee.id}/board-certifications`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('POST /api/employees/:id/board-certifications', () => {
      test('should create new board certification', async () => {
        const { hrUser } = await createTestUsers(app);

        const certData = {
          boardName: 'American Board of Internal Medicine',
          specialty: 'Internal Medicine',
          certificationNumber: 'ABIM123456',
          issueDate: '2019-09-01',
          expirationDate: '2029-09-01',
          isActive: true
        };

        const response = await hrUser.agent
          .post(`/api/employees/${employee.id}/board-certifications`)
          .send(certData)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.boardName).toBe(certData.boardName);
        expect(response.body.specialty).toBe(certData.specialty);
        expect(response.body.employeeId).toBe(employee.id);
      });
    });
  });

  describe('Emergency Contact Management', () => {
    describe('GET /api/employees/:id/emergency-contacts', () => {
      test('should get employee emergency contacts', async () => {
        const { hrUser } = await createTestUsers(app);

        const response = await hrUser.agent
          .get(`/api/employees/${employee.id}/emergency-contacts`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('POST /api/employees/:id/emergency-contacts', () => {
      test('should create new emergency contact', async () => {
        const { hrUser } = await createTestUsers(app);

        const contactData = {
          firstName: 'Jane',
          lastName: 'Doe',
          relationship: 'Spouse',
          phoneNumber: '555-987-6543',
          email: 'jane.doe@example.com',
          address1: '456 Oak St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345'
        };

        const response = await hrUser.agent
          .post(`/api/employees/${employee.id}/emergency-contacts`)
          .send(contactData)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.firstName).toBe(contactData.firstName);
        expect(response.body.relationship).toBe(contactData.relationship);
        expect(response.body.employeeId).toBe(employee.id);
      });

      test('should validate required fields', async () => {
        const { hrUser } = await createTestUsers(app);

        await hrUser.agent
          .post(`/api/employees/${employee.id}/emergency-contacts`)
          .send({})
          .expect(400);
      });
    });
  });

  describe('Professional Reference Management', () => {
    describe('GET /api/employees/:id/peer-references', () => {
      test('should get employee peer references', async () => {
        const { hrUser } = await createTestUsers(app);

        const response = await hrUser.agent
          .get(`/api/employees/${employee.id}/peer-references`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('POST /api/employees/:id/peer-references', () => {
      test('should create new peer reference', async () => {
        const { hrUser } = await createTestUsers(app);

        const referenceData = {
          firstName: 'Dr. Robert',
          lastName: 'Johnson',
          title: 'Chief of Medicine',
          organization: 'City Medical Center',
          phoneNumber: '555-246-8135',
          email: 'dr.johnson@citymed.com',
          relationship: 'Supervisor',
          yearsKnown: 3
        };

        const response = await hrUser.agent
          .post(`/api/employees/${employee.id}/peer-references`)
          .send(referenceData)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.firstName).toBe(referenceData.firstName);
        expect(response.body.title).toBe(referenceData.title);
        expect(response.body.employeeId).toBe(employee.id);
      });
    });
  });

  describe('Training Management', () => {
    describe('GET /api/employees/:id/trainings', () => {
      test('should get employee trainings', async () => {
        const { hrUser } = await createTestUsers(app);

        const response = await hrUser.agent
          .get(`/api/employees/${employee.id}/trainings`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('POST /api/employees/:id/trainings', () => {
      test('should create new training record', async () => {
        const { hrUser } = await createTestUsers(app);

        const trainingData = {
          trainingName: 'HIPAA Compliance Training',
          provider: 'Hospital Education Department',
          completionDate: '2023-01-15',
          expirationDate: '2024-01-15',
          certificateNumber: 'HIPAA2023001'
        };

        const response = await hrUser.agent
          .post(`/api/employees/${employee.id}/trainings`)
          .send(trainingData)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.trainingName).toBe(trainingData.trainingName);
        expect(response.body.provider).toBe(trainingData.provider);
        expect(response.body.employeeId).toBe(employee.id);
      });
    });
  });

  describe('Payer Enrollment Management', () => {
    describe('GET /api/employees/:id/payer-enrollments', () => {
      test('should get employee payer enrollments', async () => {
        const { hrUser } = await createTestUsers(app);

        const response = await hrUser.agent
          .get(`/api/employees/${employee.id}/payer-enrollments`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('POST /api/employees/:id/payer-enrollments', () => {
      test('should create new payer enrollment', async () => {
        const { hrUser } = await createTestUsers(app);

        const enrollmentData = {
          payerName: 'Blue Cross Blue Shield',
          providerId: 'BCBS123456',
          enrollmentDate: '2022-01-01',
          status: 'active',
          effectiveDate: '2022-01-01'
        };

        const response = await hrUser.agent
          .post(`/api/employees/${employee.id}/payer-enrollments`)
          .send(enrollmentData)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.payerName).toBe(enrollmentData.payerName);
        expect(response.body.providerId).toBe(enrollmentData.providerId);
        expect(response.body.employeeId).toBe(employee.id);
      });
    });
  });

  describe('Generic Entity Operations', () => {
    test('should update entity records', async () => {
      const { hrUser } = await createTestUsers(app);

      // Create an education record first
      const educationResponse = await hrUser.agent
        .post(`/api/employees/${employee.id}/educations`)
        .send({
          institutionName: 'Original University',
          degree: 'Bachelor',
          fieldOfStudy: 'Biology'
        })
        .expect(201);

      const educationId = educationResponse.body.id;

      // Update the education record
      const updateData = {
        institutionName: 'Updated University',
        degree: 'Master'
      };

      const updateResponse = await hrUser.agent
        .put(`/api/educations/${educationId}`)
        .send(updateData)
        .expect(200);

      expect(updateResponse.body.institutionName).toBe('Updated University');
      expect(updateResponse.body.degree).toBe('Master');
    });

    test('should delete entity records (admin only)', async () => {
      const { adminUser, hrUser } = await createTestUsers(app);

      // Create an education record
      const educationResponse = await hrUser.agent
        .post(`/api/employees/${employee.id}/educations`)
        .send({
          institutionName: 'Delete University',
          degree: 'Bachelor',
          fieldOfStudy: 'Biology'
        })
        .expect(201);

      const educationId = educationResponse.body.id;

      // Delete the education record (admin only)
      await adminUser.agent
        .delete(`/api/educations/${educationId}`)
        .expect(204);

      // Verify it's deleted
      await hrUser.agent
        .get(`/api/educations/${educationId}`)
        .expect(404);
    });

    test('should require proper permissions for deletion', async () => {
      const { hrUser } = await createTestUsers(app);

      // Create an education record
      const educationResponse = await hrUser.agent
        .post(`/api/employees/${employee.id}/educations`)
        .send({
          institutionName: 'Test University',
          degree: 'Bachelor',
          fieldOfStudy: 'Biology'
        })
        .expect(201);

      const educationId = educationResponse.body.id;

      // HR user should not be able to delete
      await hrUser.agent
        .delete(`/api/educations/${educationId}`)
        .expect(403);
    });
  });
});