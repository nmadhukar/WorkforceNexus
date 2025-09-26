/**
 * HR Approval API Tests
 * 
 * Comprehensive tests for HR approval workflows including:
 * - Employee approval/rejection processes
 * - Status transitions
 * - Role-based access control
 * - Audit trail creation
 * - Notification triggers
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { getTestApp } from '../utils/test-app';
import { testDb } from '../utils/test-db';
import { createTestUsers } from '../utils/auth-helpers';
import { MockSESService } from '../__mocks__/sesService';
import { MockDocuSealService } from '../__mocks__/docusealService';

// Mock external services
vi.mock('../../server/services/sesService', () => ({
  SESService: MockSESService
}));

vi.mock('../../server/services/docusealService', () => ({
  DocuSealService: MockDocuSealService
}));

describe('HR Approval API Tests', () => {
  let app: any;

  beforeEach(async () => {
    app = await getTestApp();
    await testDb.cleanupBetweenTests();
    MockSESService.resetMock();
    MockDocuSealService.resetMock();
  });

  afterEach(async () => {
    await testDb.cleanupBetweenTests();
  });

  describe('GET /api/hr/pending-approvals', () => {
    test('should list pending employee approvals', async () => {
      const { hrUser } = await createTestUsers(app);
      
      // Create employees with different statuses
      const pendingEmployee1 = await testDb.createTestEmployee({
        firstName: 'Pending',
        lastName: 'One',
        workEmail: 'pending1@hospital.com',
        status: 'pending_approval'
      });
      
      const pendingEmployee2 = await testDb.createTestEmployee({
        firstName: 'Pending',
        lastName: 'Two',
        workEmail: 'pending2@hospital.com',
        status: 'pending_approval'
      });
      
      const activeEmployee = await testDb.createTestEmployee({
        firstName: 'Active',
        lastName: 'Employee',
        workEmail: 'active@hospital.com',
        status: 'active'
      });

      const response = await hrUser.agent
        .get('/api/hr/pending-approvals')
        .expect(200);

      expect(response.body).toHaveProperty('approvals');
      expect(response.body.approvals).toHaveLength(2);
      
      const ids = response.body.approvals.map((a: any) => a.id);
      expect(ids).toContain(pendingEmployee1.id);
      expect(ids).toContain(pendingEmployee2.id);
      expect(ids).not.toContain(activeEmployee.id);
    });

    test('should support pagination for pending approvals', async () => {
      const { hrUser } = await createTestUsers(app);
      
      // Create 15 pending employees
      for (let i = 0; i < 15; i++) {
        await testDb.createTestEmployee({
          firstName: `Pending`,
          lastName: `Employee${i}`,
          workEmail: `pending${i}@hospital.com`,
          status: 'pending_approval'
        });
      }

      // First page
      const page1 = await hrUser.agent
        .get('/api/hr/pending-approvals?page=1&limit=10')
        .expect(200);

      expect(page1.body.approvals).toHaveLength(10);
      expect(page1.body.total).toBe(15);
      expect(page1.body.page).toBe(1);
      expect(page1.body.totalPages).toBe(2);

      // Second page
      const page2 = await hrUser.agent
        .get('/api/hr/pending-approvals?page=2&limit=10')
        .expect(200);

      expect(page2.body.approvals).toHaveLength(5);
      expect(page2.body.page).toBe(2);
    });

    test('should filter by date range', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);

      // Create employees with different submission dates
      const recentEmployee = await testDb.createTestEmployee({
        firstName: 'Recent',
        lastName: 'Employee',
        workEmail: 'recent@hospital.com',
        status: 'pending_approval',
        createdAt: yesterday
      });

      const oldEmployee = await testDb.createTestEmployee({
        firstName: 'Old',
        lastName: 'Employee',
        workEmail: 'old@hospital.com',
        status: 'pending_approval',
        createdAt: lastWeek
      });

      // Filter for last 3 days
      const response = await hrUser.agent
        .get(`/api/hr/pending-approvals?fromDate=${yesterday.toISOString().split('T')[0]}&toDate=${today.toISOString().split('T')[0]}`)
        .expect(200);

      const ids = response.body.approvals.map((a: any) => a.id);
      expect(ids).toContain(recentEmployee.id);
      expect(ids).not.toContain(oldEmployee.id);
    });

    test('should filter by department/location', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const mainHospital = await testDb.createTestEmployee({
        firstName: 'Main',
        lastName: 'Employee',
        workEmail: 'main@hospital.com',
        status: 'pending_approval',
        workLocation: 'Main Hospital'
      });

      const satellite = await testDb.createTestEmployee({
        firstName: 'Satellite',
        lastName: 'Employee',
        workEmail: 'satellite@hospital.com',
        status: 'pending_approval',
        workLocation: 'Satellite Clinic'
      });

      const response = await hrUser.agent
        .get('/api/hr/pending-approvals?location=Main Hospital')
        .expect(200);

      const ids = response.body.approvals.map((a: any) => a.id);
      expect(ids).toContain(mainHospital.id);
      expect(ids).not.toContain(satellite.id);
    });

    test('should include completion status for each employee', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'Complete',
        lastName: 'Check',
        workEmail: 'complete@hospital.com',
        status: 'pending_approval'
      });

      // Add some documents and licenses
      await testDb.createTestDocument({
        employeeId: employee.id,
        documentType: 'license',
        fileName: 'medical-license.pdf'
      });

      await testDb.createTestLicense({
        employeeId: employee.id,
        licenseType: 'medical',
        licenseNumber: 'MD123456'
      });

      const response = await hrUser.agent
        .get('/api/hr/pending-approvals')
        .expect(200);

      const approval = response.body.approvals.find((a: any) => a.id === employee.id);
      expect(approval).toHaveProperty('completionStatus');
      expect(approval.completionStatus).toHaveProperty('documentsUploaded');
      expect(approval.completionStatus).toHaveProperty('licensesVerified');
      expect(approval.completionStatus).toHaveProperty('formsCompleted');
      expect(approval.completionStatus).toHaveProperty('overallProgress');
    });

    test('should require HR or Admin role', async () => {
      const { viewerUser } = await createTestUsers(app);
      
      await viewerUser.agent
        .get('/api/hr/pending-approvals')
        .expect(403);
    });

    test('should sort by submission date', async () => {
      const { hrUser } = await createTestUsers(app);
      
      // Create employees with different dates
      const employees = [];
      for (let i = 0; i < 5; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        
        const emp = await testDb.createTestEmployee({
          firstName: `Employee`,
          lastName: `${i}`,
          workEmail: `emp${i}@hospital.com`,
          status: 'pending_approval',
          createdAt: date
        });
        employees.push(emp);
      }

      // Sort ascending (oldest first)
      const ascResponse = await hrUser.agent
        .get('/api/hr/pending-approvals?sort=createdAt&order=asc')
        .expect(200);

      expect(ascResponse.body.approvals[0].id).toBe(employees[4].id); // Oldest

      // Sort descending (newest first)
      const descResponse = await hrUser.agent
        .get('/api/hr/pending-approvals?sort=createdAt&order=desc')
        .expect(200);

      expect(descResponse.body.approvals[0].id).toBe(employees[0].id); // Newest
    });
  });

  describe('POST /api/hr/approve/:employeeId', () => {
    test('should approve employee and update status', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'Approve',
        lastName: 'Test',
        workEmail: 'approve@hospital.com',
        status: 'pending_approval'
      });

      const response = await hrUser.agent
        .post(`/api/hr/approve/${employee.id}`)
        .send({
          comments: 'All documents verified, approved for employment',
          effectiveDate: new Date().toISOString()
        })
        .expect(200);

      expect(response.body).toHaveProperty('message', expect.stringMatching(/approved/i));
      expect(response.body).toHaveProperty('employee');
      expect(response.body.employee.status).toBe('active');
    });

    test('should transition user role from onboarding to assigned role', async () => {
      const { adminUser } = await createTestUsers(app);
      
      // Create employee with associated user account
      const employee = await testDb.createTestEmployee({
        firstName: 'Role',
        lastName: 'Transition',
        workEmail: 'role.transition@hospital.com',
        status: 'pending_approval'
      });

      const user = await testDb.createTestUser({
        username: 'role.transition@hospital.com',
        password: 'TestPass123!',
        role: 'viewer', // Onboarding role
        employeeId: employee.id
      });

      const response = await adminUser.agent
        .post(`/api/hr/approve/${employee.id}`)
        .send({
          comments: 'Approved',
          assignedRole: 'hr' // New role after approval
        })
        .expect(200);

      // Verify role was updated
      const updatedUser = await testDb.getUserById(user.id);
      expect(updatedUser?.role).toBe('hr');
    });

    test('should send approval notification email', async () => {
      const { hrUser } = await createTestUsers(app);
      
      // Configure SES mock
      MockSESService.configureMock({
        isInitialized: true,
        shouldFailSend: false
      });
      
      const sesService = new MockSESService();
      await sesService.initialize();

      const employee = await testDb.createTestEmployee({
        firstName: 'Email',
        lastName: 'Notification',
        workEmail: 'notification@hospital.com',
        personalEmail: 'personal@example.com',
        status: 'pending_approval'
      });

      await hrUser.agent
        .post(`/api/hr/approve/${employee.id}`)
        .send({
          comments: 'Welcome to the team!',
          sendNotification: true
        })
        .expect(200);

      // Check that email was sent
      const sentEmails = MockSESService.getSentEmails('notification@hospital.com');
      if (sentEmails.length === 0) {
        // Try personal email
        const personalEmails = MockSESService.getSentEmails('personal@example.com');
        expect(personalEmails).toHaveLength(1);
        expect(personalEmails[0].subject).toMatch(/approved|welcome/i);
      } else {
        expect(sentEmails).toHaveLength(1);
        expect(sentEmails[0].subject).toMatch(/approved|welcome/i);
      }
    });

    test('should create audit trail for approval', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'Audit',
        lastName: 'Trail',
        workEmail: 'audit@hospital.com',
        status: 'pending_approval'
      });

      await hrUser.agent
        .post(`/api/hr/approve/${employee.id}`)
        .send({
          comments: 'Approved after verification'
        })
        .expect(200);

      // Check audit log
      const audits = await testDb.getAuditLogs({
        entityType: 'employee',
        entityId: employee.id,
        action: 'approve'
      });

      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({
        action: 'approve',
        entityType: 'employee',
        entityId: employee.id,
        performedBy: hrUser.user.id,
        details: expect.stringContaining('Approved after verification')
      });
    });

    test('should fail if employee is already approved', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'Already',
        lastName: 'Approved',
        workEmail: 'already@hospital.com',
        status: 'active'
      });

      const response = await hrUser.agent
        .post(`/api/hr/approve/${employee.id}`)
        .send({
          comments: 'Trying to approve again'
        })
        .expect(400);

      expect(response.body.error).toMatch(/already approved|active/i);
    });

    test('should validate required approval fields', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'Validate',
        lastName: 'Fields',
        workEmail: 'validate@hospital.com',
        status: 'pending_approval'
      });

      // Missing required comments
      const response = await hrUser.agent
        .post(`/api/hr/approve/${employee.id}`)
        .send({})
        .expect(400);

      expect(response.body.error).toMatch(/comments|required/i);
    });

    test('should handle non-existent employee', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const response = await hrUser.agent
        .post('/api/hr/approve/99999')
        .send({
          comments: 'Approving non-existent employee'
        })
        .expect(404);

      expect(response.body.error).toMatch(/not found|doesn't exist/i);
    });

    test('should require HR or Admin role for approval', async () => {
      const { viewerUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'No',
        lastName: 'Permission',
        workEmail: 'noperm@hospital.com',
        status: 'pending_approval'
      });

      await viewerUser.agent
        .post(`/api/hr/approve/${employee.id}`)
        .send({
          comments: 'Unauthorized approval attempt'
        })
        .expect(403);
    });

    test('should activate related accounts and services', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'Activate',
        lastName: 'Services',
        workEmail: 'activate@hospital.com',
        status: 'pending_approval'
      });

      // Create related user account
      const user = await testDb.createTestUser({
        username: 'activate@hospital.com',
        password: 'TestPass123!',
        role: 'viewer',
        isActive: false,
        employeeId: employee.id
      });

      await hrUser.agent
        .post(`/api/hr/approve/${employee.id}`)
        .send({
          comments: 'Approved, activate all services',
          activateAccounts: true
        })
        .expect(200);

      // Verify user account is activated
      const updatedUser = await testDb.getUserById(user.id);
      expect(updatedUser?.isActive).toBe(true);
    });
  });

  describe('POST /api/hr/reject/:employeeId', () => {
    test('should reject employee and update status', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'Reject',
        lastName: 'Test',
        workEmail: 'reject@hospital.com',
        status: 'pending_approval'
      });

      const response = await hrUser.agent
        .post(`/api/hr/reject/${employee.id}`)
        .send({
          reason: 'Failed background check',
          details: 'Criminal record found'
        })
        .expect(200);

      expect(response.body).toHaveProperty('message', expect.stringMatching(/rejected/i));
      expect(response.body).toHaveProperty('employee');
      expect(response.body.employee.status).toBe('rejected');
    });

    test('should deactivate user account on rejection', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'Deactivate',
        lastName: 'Account',
        workEmail: 'deactivate@hospital.com',
        status: 'pending_approval'
      });

      const user = await testDb.createTestUser({
        username: 'deactivate@hospital.com',
        password: 'TestPass123!',
        role: 'viewer',
        isActive: true,
        employeeId: employee.id
      });

      await hrUser.agent
        .post(`/api/hr/reject/${employee.id}`)
        .send({
          reason: 'Documentation issues',
          deactivateAccount: true
        })
        .expect(200);

      // Verify account is deactivated
      const updatedUser = await testDb.getUserById(user.id);
      expect(updatedUser?.isActive).toBe(false);
    });

    test('should send rejection notification email', async () => {
      const { hrUser } = await createTestUsers(app);
      
      MockSESService.configureMock({
        isInitialized: true,
        shouldFailSend: false
      });
      
      const sesService = new MockSESService();
      await sesService.initialize();

      const employee = await testDb.createTestEmployee({
        firstName: 'Rejection',
        lastName: 'Email',
        workEmail: 'rejection@hospital.com',
        status: 'pending_approval'
      });

      await hrUser.agent
        .post(`/api/hr/reject/${employee.id}`)
        .send({
          reason: 'Incomplete documentation',
          sendNotification: true
        })
        .expect(200);

      const sentEmails = MockSESService.getSentEmails('rejection@hospital.com');
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].subject).toMatch(/rejected|unable to proceed/i);
      expect(sentEmails[0].bodyText).toMatch(/Incomplete documentation/);
    });

    test('should create audit trail for rejection', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'Reject',
        lastName: 'Audit',
        workEmail: 'reject.audit@hospital.com',
        status: 'pending_approval'
      });

      await hrUser.agent
        .post(`/api/hr/reject/${employee.id}`)
        .send({
          reason: 'Failed verification'
        })
        .expect(200);

      const audits = await testDb.getAuditLogs({
        entityType: 'employee',
        entityId: employee.id,
        action: 'reject'
      });

      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({
        action: 'reject',
        entityType: 'employee',
        entityId: employee.id,
        performedBy: hrUser.user.id,
        details: expect.stringContaining('Failed verification')
      });
    });

    test('should require reason for rejection', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'No',
        lastName: 'Reason',
        workEmail: 'noreason@hospital.com',
        status: 'pending_approval'
      });

      const response = await hrUser.agent
        .post(`/api/hr/reject/${employee.id}`)
        .send({})
        .expect(400);

      expect(response.body.error).toMatch(/reason|required/i);
    });

    test('should handle already rejected employee', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'Already',
        lastName: 'Rejected',
        workEmail: 'already.rejected@hospital.com',
        status: 'rejected'
      });

      const response = await hrUser.agent
        .post(`/api/hr/reject/${employee.id}`)
        .send({
          reason: 'Trying to reject again'
        })
        .expect(400);

      expect(response.body.error).toMatch(/already rejected/i);
    });

    test('should archive employee documents on rejection', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'Archive',
        lastName: 'Docs',
        workEmail: 'archive@hospital.com',
        status: 'pending_approval'
      });

      // Add documents
      const doc1 = await testDb.createTestDocument({
        employeeId: employee.id,
        documentType: 'license',
        fileName: 'license.pdf'
      });

      const doc2 = await testDb.createTestDocument({
        employeeId: employee.id,
        documentType: 'certificate',
        fileName: 'cert.pdf'
      });

      await hrUser.agent
        .post(`/api/hr/reject/${employee.id}`)
        .send({
          reason: 'Failed checks',
          archiveDocuments: true
        })
        .expect(200);

      // Verify documents are archived/marked
      const archivedDocs = await testDb.getDocumentsByEmployeeId(employee.id);
      archivedDocs.forEach(doc => {
        expect(doc.archived || doc.status === 'archived').toBe(true);
      });
    });
  });

  describe('POST /api/hr/request-info/:employeeId', () => {
    test('should request additional information from employee', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'Need',
        lastName: 'Info',
        workEmail: 'needinfo@hospital.com',
        status: 'pending_approval'
      });

      const response = await hrUser.agent
        .post(`/api/hr/request-info/${employee.id}`)
        .send({
          requestedItems: [
            'Updated medical license',
            'Proof of malpractice insurance',
            'Additional reference'
          ],
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          message: 'Please provide the following additional documentation'
        })
        .expect(200);

      expect(response.body).toHaveProperty('message', expect.stringMatching(/request sent/i));
      expect(response.body).toHaveProperty('request');
      expect(response.body.request.status).toBe('pending');
    });

    test('should send email notification for info request', async () => {
      const { hrUser } = await createTestUsers(app);
      
      MockSESService.configureMock({
        isInitialized: true,
        shouldFailSend: false
      });
      
      const sesService = new MockSESService();
      await sesService.initialize();

      const employee = await testDb.createTestEmployee({
        firstName: 'Info',
        lastName: 'Request',
        workEmail: 'inforequest@hospital.com',
        status: 'pending_approval'
      });

      await hrUser.agent
        .post(`/api/hr/request-info/${employee.id}`)
        .send({
          requestedItems: ['License update'],
          message: 'Please update your license information'
        })
        .expect(200);

      const sentEmails = MockSESService.getSentEmails('inforequest@hospital.com');
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].subject).toMatch(/additional information|action required/i);
      expect(sentEmails[0].bodyText).toMatch(/License update/);
    });

    test('should update employee status to information_needed', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'Status',
        lastName: 'Update',
        workEmail: 'statusupdate@hospital.com',
        status: 'pending_approval'
      });

      await hrUser.agent
        .post(`/api/hr/request-info/${employee.id}`)
        .send({
          requestedItems: ['Missing document'],
          message: 'Please provide missing documentation'
        })
        .expect(200);

      const updatedEmployee = await testDb.getEmployeeById(employee.id);
      expect(updatedEmployee?.status).toBe('information_needed');
    });
  });

  describe('GET /api/hr/approval-history', () => {
    test('should list approval history with filters', async () => {
      const { hrUser } = await createTestUsers(app);
      
      // Create approved and rejected employees
      const approved = await testDb.createTestEmployee({
        firstName: 'Approved',
        lastName: 'History',
        workEmail: 'approved.history@hospital.com',
        status: 'active',
        approvedAt: new Date(),
        approvedBy: hrUser.user.id
      });

      const rejected = await testDb.createTestEmployee({
        firstName: 'Rejected',
        lastName: 'History',
        workEmail: 'rejected.history@hospital.com',
        status: 'rejected',
        rejectedAt: new Date(),
        rejectedBy: hrUser.user.id
      });

      // Get all history
      const allHistory = await hrUser.agent
        .get('/api/hr/approval-history')
        .expect(200);

      expect(allHistory.body.history).toHaveLength(2);

      // Filter by status
      const approvedOnly = await hrUser.agent
        .get('/api/hr/approval-history?status=approved')
        .expect(200);

      expect(approvedOnly.body.history).toHaveLength(1);
      expect(approvedOnly.body.history[0].id).toBe(approved.id);

      // Filter by date range
      const today = new Date().toISOString().split('T')[0];
      const dateFiltered = await hrUser.agent
        .get(`/api/hr/approval-history?fromDate=${today}&toDate=${today}`)
        .expect(200);

      expect(dateFiltered.body.history).toHaveLength(2);
    });

    test('should include approval/rejection details', async () => {
      const { hrUser, adminUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'Detail',
        lastName: 'Test',
        workEmail: 'detail@hospital.com',
        status: 'active',
        approvedAt: new Date(),
        approvedBy: adminUser.user.id,
        approvalComments: 'All checks passed'
      });

      const response = await hrUser.agent
        .get('/api/hr/approval-history')
        .expect(200);

      const record = response.body.history.find((h: any) => h.id === employee.id);
      expect(record).toMatchObject({
        id: employee.id,
        firstName: 'Detail',
        lastName: 'Test',
        status: 'active',
        approvedBy: expect.objectContaining({
          id: adminUser.user.id,
          username: adminUser.user.username
        }),
        approvalComments: 'All checks passed'
      });
    });
  });

  describe('Batch Approval Operations', () => {
    test('should approve multiple employees in batch', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const employees = [];
      for (let i = 0; i < 3; i++) {
        const emp = await testDb.createTestEmployee({
          firstName: `Batch${i}`,
          lastName: 'Approve',
          workEmail: `batch${i}@hospital.com`,
          status: 'pending_approval'
        });
        employees.push(emp.id);
      }

      const response = await hrUser.agent
        .post('/api/hr/approve-batch')
        .send({
          employeeIds: employees,
          comments: 'Batch approval for orientation group',
          effectiveDate: new Date().toISOString()
        })
        .expect(200);

      expect(response.body).toHaveProperty('approved', 3);
      expect(response.body).toHaveProperty('failed', 0);
      expect(response.body.results).toHaveLength(3);
      
      response.body.results.forEach((result: any) => {
        expect(result.success).toBe(true);
        expect(result.status).toBe('active');
      });
    });

    test('should handle partial batch failures gracefully', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const pending = await testDb.createTestEmployee({
        firstName: 'Batch',
        lastName: 'Pending',
        workEmail: 'batch.pending@hospital.com',
        status: 'pending_approval'
      });

      const active = await testDb.createTestEmployee({
        firstName: 'Batch',
        lastName: 'Active',
        workEmail: 'batch.active@hospital.com',
        status: 'active' // Already approved
      });

      const response = await hrUser.agent
        .post('/api/hr/approve-batch')
        .send({
          employeeIds: [pending.id, active.id, 99999], // Include non-existent ID
          comments: 'Mixed batch approval'
        })
        .expect(200);

      expect(response.body.approved).toBe(1); // Only pending should succeed
      expect(response.body.failed).toBe(2); // Active and non-existent should fail
      
      const pendingResult = response.body.results.find((r: any) => r.employeeId === pending.id);
      expect(pendingResult.success).toBe(true);
      
      const activeResult = response.body.results.find((r: any) => r.employeeId === active.id);
      expect(activeResult.success).toBe(false);
      expect(activeResult.error).toMatch(/already approved/i);
    });
  });

  describe('Approval Workflow Validations', () => {
    test('should validate minimum document requirements before approval', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'Missing',
        lastName: 'Docs',
        workEmail: 'missing.docs@hospital.com',
        status: 'pending_approval'
      });

      // Try to approve without required documents
      const response = await hrUser.agent
        .post(`/api/hr/approve/${employee.id}`)
        .send({
          comments: 'Approving without docs',
          enforceRequirements: true
        })
        .expect(400);

      expect(response.body.error).toMatch(/required documents|missing|incomplete/i);
    });

    test('should check license validity before approval', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'Expired',
        lastName: 'License',
        workEmail: 'expired.license@hospital.com',
        status: 'pending_approval'
      });

      // Add expired license
      await testDb.createTestLicense({
        employeeId: employee.id,
        licenseType: 'medical',
        licenseNumber: 'MD999999',
        expirationDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
      });

      const response = await hrUser.agent
        .post(`/api/hr/approve/${employee.id}`)
        .send({
          comments: 'Approving with expired license',
          validateLicenses: true
        })
        .expect(400);

      expect(response.body.error).toMatch(/expired|license|invalid/i);
    });

    test('should validate background check completion', async () => {
      const { hrUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'No',
        lastName: 'Background',
        workEmail: 'no.background@hospital.com',
        status: 'pending_approval',
        backgroundCheckStatus: 'pending'
      });

      const response = await hrUser.agent
        .post(`/api/hr/approve/${employee.id}`)
        .send({
          comments: 'Approving without background check',
          requireBackgroundCheck: true
        })
        .expect(400);

      expect(response.body.error).toMatch(/background check|incomplete|pending/i);
    });
  });

  describe('Concurrent Approval Handling', () => {
    test('should handle concurrent approval attempts', async () => {
      const { hrUser, adminUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'Concurrent',
        lastName: 'Test',
        workEmail: 'concurrent@hospital.com',
        status: 'pending_approval'
      });

      // Attempt concurrent approvals
      const [response1, response2] = await Promise.all([
        hrUser.agent
          .post(`/api/hr/approve/${employee.id}`)
          .send({ comments: 'HR approval' }),
        adminUser.agent
          .post(`/api/hr/approve/${employee.id}`)
          .send({ comments: 'Admin approval' })
      ]);

      // One should succeed, one should fail
      const responses = [response1, response2];
      const success = responses.filter(r => r.status === 200);
      const failure = responses.filter(r => r.status === 400);

      expect(success).toHaveLength(1);
      expect(failure).toHaveLength(1);
      
      if (failure[0]) {
        expect(failure[0].body.error).toMatch(/already|processed|approved/i);
      }
    });

    test('should prevent approval-rejection race conditions', async () => {
      const { hrUser, adminUser } = await createTestUsers(app);
      
      const employee = await testDb.createTestEmployee({
        firstName: 'Race',
        lastName: 'Condition',
        workEmail: 'race@hospital.com',
        status: 'pending_approval'
      });

      // Attempt concurrent approval and rejection
      const [approveResponse, rejectResponse] = await Promise.all([
        hrUser.agent
          .post(`/api/hr/approve/${employee.id}`)
          .send({ comments: 'Approving' }),
        adminUser.agent
          .post(`/api/hr/reject/${employee.id}`)
          .send({ reason: 'Rejecting' })
      ]);

      // Only one should succeed
      const successCount = [approveResponse, rejectResponse]
        .filter(r => r.status === 200).length;
      
      expect(successCount).toBe(1);

      // Check final status is consistent
      const finalEmployee = await testDb.getEmployeeById(employee.id);
      expect(['active', 'rejected']).toContain(finalEmployee?.status);
    });
  });
});