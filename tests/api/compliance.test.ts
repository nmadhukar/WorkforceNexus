import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { testApp } from '../utils/test-app';
import { testDb } from '../utils/test-db';
import { hashPassword } from '../../server/auth';
import { 
  users, 
  locations, 
  licenseTypes, 
  responsiblePersons, 
  clinicLicenses,
  complianceDocuments 
} from '@shared/schema';
import { eq } from 'drizzle-orm';

let app: any;
let adminCookie: string;
let hrCookie: string;
let viewerCookie: string;

describe('Compliance API Tests', () => {
  beforeAll(async () => {
    app = await testApp();
    
    // Clear existing test data
    await testDb.delete(complianceDocuments);
    await testDb.delete(clinicLicenses);
    await testDb.delete(responsiblePersons);
    await testDb.delete(licenseTypes);
    await testDb.delete(locations);
    await testDb.delete(users);
    
    // Create test users
    const adminPassword = await hashPassword('Admin123!@#');
    const hrPassword = await hashPassword('Hr123!@#');
    const viewerPassword = await hashPassword('Viewer123!@#');
    
    await testDb.insert(users).values([
      { username: 'admin', passwordHash: adminPassword, role: 'admin' },
      { username: 'hr', passwordHash: hrPassword, role: 'hr' },
      { username: 'viewer', passwordHash: viewerPassword, role: 'viewer' }
    ]);
    
    // Login as each user type
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'Admin123!@#' });
    adminCookie = adminLogin.headers['set-cookie'][0];
    
    const hrLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'hr', password: 'Hr123!@#' });
    hrCookie = hrLogin.headers['set-cookie'][0];
    
    const viewerLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'viewer', password: 'Viewer123!@#' });
    viewerCookie = viewerLogin.headers['set-cookie'][0];
  });

  afterAll(async () => {
    // Clean up test data
    await testDb.delete(complianceDocuments);
    await testDb.delete(clinicLicenses);
    await testDb.delete(responsiblePersons);
    await testDb.delete(licenseTypes);
    await testDb.delete(locations);
    await testDb.delete(users);
  });

  describe('Locations API', () => {
    let locationId: number;
    let subLocationId: number;

    it('GET /api/compliance/locations - should return empty list initially', async () => {
      const res = await request(app)
        .get('/api/compliance/locations')
        .set('Cookie', adminCookie);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('locations');
      expect(res.body.locations).toEqual([]);
      expect(res.body.total).toBe(0);
    });

    it('POST /api/compliance/locations - should create new location', async () => {
      const locationData = {
        name: 'Main Medical Center',
        code: 'MMC001',
        type: 'main',
        address1: '123 Medical Way',
        city: 'Healthcare City',
        state: 'CA',
        zipCode: '90210',
        country: 'USA',
        phone: '555-0100',
        email: 'main@medical.com',
        status: 'active',
        isComplianceRequired: true
      };

      const res = await request(app)
        .post('/api/compliance/locations')
        .set('Cookie', adminCookie)
        .send(locationData);
      
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe(locationData.name);
      expect(res.body.code).toBe(locationData.code);
      locationId = res.body.id;
    });

    it('POST /api/compliance/locations - should validate required fields', async () => {
      const invalidData = {
        name: 'Invalid Location'
        // Missing required fields
      };

      const res = await request(app)
        .post('/api/compliance/locations')
        .set('Cookie', adminCookie)
        .send(invalidData);
      
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('errors');
    });

    it('POST /api/compliance/locations - should create sub-location with parent', async () => {
      const subLocationData = {
        name: 'Satellite Clinic A',
        code: 'SCA001',
        type: 'sub_location',
        parentId: locationId,
        address1: '456 Branch St',
        city: 'Healthcare City',
        state: 'CA',
        zipCode: '90211',
        country: 'USA',
        phone: '555-0101',
        email: 'satellite-a@medical.com',
        status: 'active',
        isComplianceRequired: true
      };

      const res = await request(app)
        .post('/api/compliance/locations')
        .set('Cookie', adminCookie)
        .send(subLocationData);
      
      expect(res.status).toBe(201);
      expect(res.body.parentId).toBe(locationId);
      subLocationId = res.body.id;
    });

    it('PATCH /api/compliance/locations/:id - should update location', async () => {
      const updateData = {
        name: 'Main Medical Center - Updated',
        phone: '555-0199'
      };

      const res = await request(app)
        .patch(`/api/compliance/locations/${locationId}`)
        .set('Cookie', adminCookie)
        .send(updateData);
      
      expect(res.status).toBe(200);
      expect(res.body.name).toBe(updateData.name);
      expect(res.body.phone).toBe(updateData.phone);
    });

    it('DELETE /api/compliance/locations/:id - should not delete location with children', async () => {
      const res = await request(app)
        .delete(`/api/compliance/locations/${locationId}`)
        .set('Cookie', adminCookie);
      
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('children');
    });

    it('DELETE /api/compliance/locations/:id - should delete location without children', async () => {
      const res = await request(app)
        .delete(`/api/compliance/locations/${subLocationId}`)
        .set('Cookie', adminCookie);
      
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('deleted');
    });

    it('should test hierarchy validation - prevent circular references', async () => {
      // Create location A
      const locA = await request(app)
        .post('/api/compliance/locations')
        .set('Cookie', adminCookie)
        .send({
          name: 'Location A',
          code: 'LOCA',
          type: 'main',
          address1: '1 A Street',
          city: 'City',
          state: 'ST',
          zipCode: '12345',
          country: 'USA',
          phone: '555-1111',
          status: 'active'
        });
      
      // Create location B as child of A
      const locB = await request(app)
        .post('/api/compliance/locations')
        .set('Cookie', adminCookie)
        .send({
          name: 'Location B',
          code: 'LOCB',
          type: 'sub_location',
          parentId: locA.body.id,
          address1: '2 B Street',
          city: 'City',
          state: 'ST',
          zipCode: '12345',
          country: 'USA',
          phone: '555-2222',
          status: 'active'
        });
      
      // Try to update A to have B as parent (circular)
      const circularUpdate = await request(app)
        .patch(`/api/compliance/locations/${locA.body.id}`)
        .set('Cookie', adminCookie)
        .send({
          parentId: locB.body.id
        });
      
      expect(circularUpdate.status).toBe(400);
      expect(circularUpdate.body.error).toContain('circular');
    });

    it('should test status transitions', async () => {
      const location = await request(app)
        .post('/api/compliance/locations')
        .set('Cookie', adminCookie)
        .send({
          name: 'Status Test Location',
          code: 'STL001',
          type: 'main',
          address1: '789 Status St',
          city: 'City',
          state: 'ST',
          zipCode: '12345',
          country: 'USA',
          phone: '555-3333',
          status: 'active'
        });

      // Transition to inactive
      const inactiveUpdate = await request(app)
        .patch(`/api/compliance/locations/${location.body.id}`)
        .set('Cookie', adminCookie)
        .send({ status: 'inactive' });
      
      expect(inactiveUpdate.status).toBe(200);
      expect(inactiveUpdate.body.status).toBe('inactive');

      // Transition to closed
      const closedUpdate = await request(app)
        .patch(`/api/compliance/locations/${location.body.id}`)
        .set('Cookie', adminCookie)
        .send({ status: 'closed' });
      
      expect(closedUpdate.status).toBe(200);
      expect(closedUpdate.body.status).toBe('closed');
    });
  });

  describe('License Types API', () => {
    let licenseTypeId: number;

    it('GET /api/compliance/license-types - should return empty list initially', async () => {
      const res = await request(app)
        .get('/api/compliance/license-types')
        .set('Cookie', hrCookie);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('licenseTypes');
      expect(Array.isArray(res.body.licenseTypes)).toBe(true);
    });

    it('POST /api/compliance/license-types - should create new license type', async () => {
      const licenseTypeData = {
        name: 'Medical License',
        code: 'MED',
        category: 'medical',
        renewalPeriodMonths: 24,
        renewalReminderDays: 90,
        isActive: true,
        requiredDocuments: ['Certificate', 'Insurance', 'Education'],
        customFields: {
          boardCertificationRequired: true,
          ceHoursRequired: 20
        },
        description: 'Standard medical practice license'
      };

      const res = await request(app)
        .post('/api/compliance/license-types')
        .set('Cookie', adminCookie)
        .send(licenseTypeData);
      
      expect(res.status).toBe(201);
      expect(res.body.name).toBe(licenseTypeData.name);
      expect(res.body.code).toBe(licenseTypeData.code);
      expect(res.body.customFields).toMatchObject(licenseTypeData.customFields);
      licenseTypeId = res.body.id;
    });

    it('should test JSONB schema validation', async () => {
      // Valid JSONB
      const validJsonb = await request(app)
        .post('/api/compliance/license-types')
        .set('Cookie', adminCookie)
        .send({
          name: 'Valid JSONB Type',
          code: 'VJT',
          category: 'facility',
          customFields: {
            nested: {
              level1: {
                level2: 'value'
              }
            },
            array: [1, 2, 3],
            boolean: true,
            number: 42
          }
        });
      
      expect(validJsonb.status).toBe(201);
      expect(validJsonb.body.customFields).toHaveProperty('nested');

      // Invalid JSONB (circular reference would be caught at stringify)
      // This test would need actual implementation to test properly
    });

    it('PATCH /api/compliance/license-types/:id - should update license type', async () => {
      const updateData = {
        renewalPeriodMonths: 36,
        customFields: {
          boardCertificationRequired: false,
          ceHoursRequired: 30,
          newField: 'new value'
        }
      };

      const res = await request(app)
        .patch(`/api/compliance/license-types/${licenseTypeId}`)
        .set('Cookie', adminCookie)
        .send(updateData);
      
      expect(res.status).toBe(200);
      expect(res.body.renewalPeriodMonths).toBe(36);
      expect(res.body.customFields.ceHoursRequired).toBe(30);
      expect(res.body.customFields.newField).toBe('new value');
    });

    it('DELETE /api/compliance/license-types/:id - should delete license type', async () => {
      const tempType = await request(app)
        .post('/api/compliance/license-types')
        .set('Cookie', adminCookie)
        .send({
          name: 'Temporary Type',
          code: 'TMP',
          category: 'other'
        });

      const res = await request(app)
        .delete(`/api/compliance/license-types/${tempType.body.id}`)
        .set('Cookie', adminCookie);
      
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('deleted');
    });
  });

  describe('Responsible Persons API', () => {
    let personId: number;
    let locationId: number;

    beforeEach(async () => {
      // Create a location for testing
      const location = await request(app)
        .post('/api/compliance/locations')
        .set('Cookie', adminCookie)
        .send({
          name: 'Test Location for Person',
          code: 'TLP001',
          type: 'main',
          address1: '123 Test St',
          city: 'City',
          state: 'ST',
          zipCode: '12345',
          country: 'USA',
          phone: '555-4444',
          status: 'active'
        });
      locationId = location.body.id;
    });

    it('GET /api/compliance/responsible-persons - should return list', async () => {
      const res = await request(app)
        .get('/api/compliance/responsible-persons')
        .set('Cookie', hrCookie);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('responsiblePersons');
    });

    it('POST /api/compliance/responsible-persons - should create person', async () => {
      const personData = {
        firstName: 'John',
        lastName: 'Doe',
        title: 'Compliance Officer',
        email: 'john.doe@medical.com',
        phone: '555-5555',
        locationId: locationId,
        isPrimary: true,
        licenseNumber: 'MED-123456',
        npiNumber: '1234567890',
        startDate: '2024-01-01',
        notificationPreferences: {
          email: true,
          sms: false,
          dashboard: true,
          daysBeforeExpiration: [30, 60, 90]
        }
      };

      const res = await request(app)
        .post('/api/compliance/responsible-persons')
        .set('Cookie', adminCookie)
        .send(personData);
      
      expect(res.status).toBe(201);
      expect(res.body.email).toBe(personData.email);
      expect(res.body.isPrimary).toBe(true);
      personId = res.body.id;
    });

    it('should test assignment rules', async () => {
      // Try to create another primary for same location
      const secondPrimary = await request(app)
        .post('/api/compliance/responsible-persons')
        .set('Cookie', adminCookie)
        .send({
          firstName: 'Jane',
          lastName: 'Smith',
          title: 'Second Officer',
          email: 'jane.smith@medical.com',
          phone: '555-6666',
          locationId: locationId,
          isPrimary: true,
          startDate: '2024-01-01'
        });
      
      // Should either fail or demote the previous primary
      if (secondPrimary.status === 201) {
        // Check if previous primary was demoted
        const firstPerson = await testDb
          .select()
          .from(responsiblePersons)
          .where(eq(responsiblePersons.id, personId));
        
        expect(firstPerson[0].isPrimary).toBe(false);
      } else {
        expect(secondPrimary.status).toBe(400);
        expect(secondPrimary.body.error).toContain('primary');
      }
    });

    it('PATCH /api/compliance/responsible-persons/:id - should update person', async () => {
      const updateData = {
        title: 'Senior Compliance Officer',
        notificationPreferences: {
          email: false,
          sms: true,
          dashboard: true,
          daysBeforeExpiration: [15, 30, 45]
        }
      };

      const res = await request(app)
        .patch(`/api/compliance/responsible-persons/${personId}`)
        .set('Cookie', adminCookie)
        .send(updateData);
      
      expect(res.status).toBe(200);
      expect(res.body.title).toBe(updateData.title);
    });

    it('DELETE /api/compliance/responsible-persons/:id - should delete person', async () => {
      const res = await request(app)
        .delete(`/api/compliance/responsible-persons/${personId}`)
        .set('Cookie', adminCookie);
      
      expect(res.status).toBe(200);
    });
  });

  describe('Clinic Licenses API', () => {
    let licenseId: number;
    let locationId: number;
    let licenseTypeId: number;

    beforeEach(async () => {
      // Create prerequisites
      const location = await request(app)
        .post('/api/compliance/locations')
        .set('Cookie', adminCookie)
        .send({
          name: 'License Test Location',
          code: 'LTL001',
          type: 'main',
          address1: '789 License Ave',
          city: 'City',
          state: 'ST',
          zipCode: '12345',
          country: 'USA',
          phone: '555-7777',
          status: 'active'
        });
      locationId = location.body.id;

      const licenseType = await request(app)
        .post('/api/compliance/license-types')
        .set('Cookie', adminCookie)
        .send({
          name: 'Test License Type',
          code: 'TLT',
          category: 'medical',
          renewalPeriodMonths: 12
        });
      licenseTypeId = licenseType.body.id;
    });

    it('GET /api/compliance/licenses - should return licenses', async () => {
      const res = await request(app)
        .get('/api/compliance/licenses')
        .set('Cookie', hrCookie);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('licenses');
      expect(res.body).toHaveProperty('total');
    });

    it('POST /api/compliance/licenses - should create license', async () => {
      const licenseData = {
        locationId: locationId,
        licenseTypeId: licenseTypeId,
        licenseNumber: 'LIC-2024-001',
        issueDate: '2024-01-01',
        expirationDate: '2025-01-01',
        status: 'active',
        complianceStatus: 'compliant',
        issuingAuthority: 'State Medical Board',
        issuingState: 'CA',
        fees: '500.00'
      };

      const res = await request(app)
        .post('/api/compliance/licenses')
        .set('Cookie', adminCookie)
        .send(licenseData);
      
      expect(res.status).toBe(201);
      expect(res.body.licenseNumber).toBe(licenseData.licenseNumber);
      licenseId = res.body.id;
    });

    it('should test expiration queries', async () => {
      // Create licenses with different expiration dates
      const today = new Date();
      const in30Days = new Date(today);
      in30Days.setDate(today.getDate() + 30);
      const in60Days = new Date(today);
      in60Days.setDate(today.getDate() + 60);
      const expired = new Date(today);
      expired.setDate(today.getDate() - 10);

      await request(app)
        .post('/api/compliance/licenses')
        .set('Cookie', adminCookie)
        .send({
          locationId,
          licenseTypeId,
          licenseNumber: 'EXP-30',
          issueDate: '2024-01-01',
          expirationDate: in30Days.toISOString().split('T')[0],
          status: 'active'
        });

      await request(app)
        .post('/api/compliance/licenses')
        .set('Cookie', adminCookie)
        .send({
          locationId,
          licenseTypeId,
          licenseNumber: 'EXP-60',
          issueDate: '2024-01-01',
          expirationDate: in60Days.toISOString().split('T')[0],
          status: 'active'
        });

      await request(app)
        .post('/api/compliance/licenses')
        .set('Cookie', adminCookie)
        .send({
          locationId,
          licenseTypeId,
          licenseNumber: 'EXP-PAST',
          issueDate: '2023-01-01',
          expirationDate: expired.toISOString().split('T')[0],
          status: 'expired'
        });

      // Query expiring in 30 days
      const exp30 = await request(app)
        .get('/api/compliance/licenses/expiring?days=30')
        .set('Cookie', hrCookie);
      
      expect(exp30.status).toBe(200);
      expect(exp30.body.some((l: any) => l.licenseNumber === 'EXP-30')).toBe(true);

      // Query expired
      const expiredRes = await request(app)
        .get('/api/compliance/licenses?status=expired')
        .set('Cookie', hrCookie);
      
      expect(expiredRes.status).toBe(200);
      expect(expiredRes.body.licenses.some((l: any) => l.licenseNumber === 'EXP-PAST')).toBe(true);
    });

    it('should test renewal workflows', async () => {
      // Create an expiring license
      const expiringLicense = await request(app)
        .post('/api/compliance/licenses')
        .set('Cookie', adminCookie)
        .send({
          locationId,
          licenseTypeId,
          licenseNumber: 'RENEW-001',
          issueDate: '2024-01-01',
          expirationDate: '2024-12-31',
          status: 'active',
          renewalStatus: 'pending'
        });

      // Initiate renewal
      const renewal = await request(app)
        .patch(`/api/compliance/licenses/${expiringLicense.body.id}/renew`)
        .set('Cookie', adminCookie)
        .send({
          newExpirationDate: '2025-12-31',
          renewalDate: '2024-11-01',
          renewalNotes: 'Annual renewal completed',
          fees: '600.00'
        });

      expect(renewal.status).toBe(200);
      expect(renewal.body.renewalStatus).toBe('completed');
      expect(renewal.body.expirationDate).toBe('2025-12-31');
    });

    it('PATCH /api/compliance/licenses/:id - should update license', async () => {
      const updateData = {
        complianceStatus: 'under_review',
        renewalStatus: 'in_progress'
      };

      const res = await request(app)
        .patch(`/api/compliance/licenses/${licenseId}`)
        .set('Cookie', adminCookie)
        .send(updateData);
      
      expect(res.status).toBe(200);
      expect(res.body.complianceStatus).toBe('under_review');
    });

    it('DELETE /api/compliance/licenses/:id - should delete license', async () => {
      const res = await request(app)
        .delete(`/api/compliance/licenses/${licenseId}`)
        .set('Cookie', adminCookie);
      
      expect(res.status).toBe(200);
    });
  });

  describe('Compliance Documents API', () => {
    let documentId: number;

    it('GET /api/compliance/documents - should return documents', async () => {
      const res = await request(app)
        .get('/api/compliance/documents')
        .set('Cookie', viewerCookie);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('documents');
    });

    it('POST /api/compliance/documents/upload - should upload document', async () => {
      const res = await request(app)
        .post('/api/compliance/documents/upload')
        .set('Cookie', adminCookie)
        .field('title', 'Compliance Policy 2024')
        .field('category', 'policy')
        .field('version', '1.0.0')
        .field('relatedEntityType', 'location')
        .field('relatedEntityId', '1')
        .attach('document', Buffer.from('test document content'), 'test-policy.pdf');
      
      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Compliance Policy 2024');
      expect(res.body.version).toBe('1.0.0');
      documentId = res.body.id;
    });

    it('should test S3 integration', async () => {
      // This would need mocked S3 service for testing
      // Check if document URL is S3 URL when S3 is enabled
      const s3Config = await request(app)
        .get('/api/admin/s3-config')
        .set('Cookie', adminCookie);
      
      if (s3Config.body.enabled) {
        const doc = await testDb
          .select()
          .from(complianceDocuments)
          .where(eq(complianceDocuments.id, documentId));
        
        expect(doc[0].s3Key).toBeTruthy();
        expect(doc[0].s3Url).toContain('amazonaws.com');
      }
    });

    it('should test versioning', async () => {
      // Upload new version of same document
      const v2 = await request(app)
        .post('/api/compliance/documents/upload')
        .set('Cookie', adminCookie)
        .field('title', 'Compliance Policy 2024')
        .field('category', 'policy')
        .field('version', '2.0.0')
        .field('previousVersionId', String(documentId))
        .attach('document', Buffer.from('updated document content'), 'test-policy-v2.pdf');
      
      expect(v2.status).toBe(201);
      expect(v2.body.version).toBe('2.0.0');
      expect(v2.body.previousVersionId).toBe(documentId);

      // Get document history
      const history = await request(app)
        .get(`/api/compliance/documents/${documentId}/versions`)
        .set('Cookie', hrCookie);
      
      expect(history.status).toBe(200);
      expect(history.body.length).toBeGreaterThanOrEqual(2);
    });

    it('GET /api/compliance/documents/:id/download - should download document', async () => {
      const res = await request(app)
        .get(`/api/compliance/documents/${documentId}/download`)
        .set('Cookie', viewerCookie);
      
      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toContain('attachment');
    });

    it('DELETE /api/compliance/documents/:id - should delete document', async () => {
      const res = await request(app)
        .delete(`/api/compliance/documents/${documentId}`)
        .set('Cookie', adminCookie);
      
      expect(res.status).toBe(200);
    });
  });

  describe('Dashboard API', () => {
    it('GET /api/compliance/dashboard - should return dashboard data', async () => {
      const res = await request(app)
        .get('/api/compliance/dashboard')
        .set('Cookie', viewerCookie);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalLocations');
      expect(res.body).toHaveProperty('activeLocations');
      expect(res.body).toHaveProperty('totalLicenses');
      expect(res.body).toHaveProperty('activeLicenses');
      expect(res.body).toHaveProperty('expiringIn30Days');
      expect(res.body).toHaveProperty('expiringIn60Days');
      expect(res.body).toHaveProperty('expiringIn90Days');
      expect(res.body).toHaveProperty('expiredLicenses');
      expect(res.body).toHaveProperty('documentsCount');
      expect(res.body).toHaveProperty('nonCompliantCount');
    });

    it('GET /api/compliance/alerts - should return alerts', async () => {
      const res = await request(app)
        .get('/api/compliance/alerts')
        .set('Cookie', hrCookie);
      
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty('id');
        expect(res.body[0]).toHaveProperty('type');
        expect(res.body[0]).toHaveProperty('severity');
        expect(res.body[0]).toHaveProperty('message');
      }
    });

    it('GET /api/compliance/export - should export CSV', async () => {
      const res = await request(app)
        .get('/api/compliance/export?format=csv')
        .set('Cookie', adminCookie);
      
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('csv');
      expect(res.headers['content-disposition']).toContain('compliance-report');
    });

    it('GET /api/compliance/export - should export JSON', async () => {
      const res = await request(app)
        .get('/api/compliance/export?format=json')
        .set('Cookie', adminCookie);
      
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('json');
      expect(res.body).toHaveProperty('exportDate');
      expect(res.body).toHaveProperty('data');
    });

    it('should test aggregation queries', async () => {
      // Test location-based aggregation
      const byLocation = await request(app)
        .get('/api/compliance/dashboard?groupBy=location')
        .set('Cookie', hrCookie);
      
      expect(byLocation.status).toBe(200);
      expect(byLocation.body).toHaveProperty('byLocation');
      
      // Test license type aggregation
      const byType = await request(app)
        .get('/api/compliance/dashboard?groupBy=licenseType')
        .set('Cookie', hrCookie);
      
      expect(byType.status).toBe(200);
      expect(byType.body).toHaveProperty('byLicenseType');
    });

    it('should test performance with large datasets', async () => {
      // This test would ideally be run with a pre-seeded large dataset
      // Measuring response time for dashboard with many records
      const startTime = Date.now();
      
      const res = await request(app)
        .get('/api/compliance/dashboard')
        .set('Cookie', viewerCookie);
      
      const responseTime = Date.now() - startTime;
      
      expect(res.status).toBe(200);
      expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds
    });
  });

  describe('Permission Tests', () => {
    it('viewer should have read-only access', async () => {
      // Viewer can read
      const readRes = await request(app)
        .get('/api/compliance/locations')
        .set('Cookie', viewerCookie);
      expect(readRes.status).toBe(200);

      // Viewer cannot create
      const createRes = await request(app)
        .post('/api/compliance/locations')
        .set('Cookie', viewerCookie)
        .send({
          name: 'Test',
          code: 'TST',
          type: 'main'
        });
      expect(createRes.status).toBe(403);

      // Viewer cannot update
      const updateRes = await request(app)
        .patch('/api/compliance/locations/1')
        .set('Cookie', viewerCookie)
        .send({ name: 'Updated' });
      expect(updateRes.status).toBe(403);

      // Viewer cannot delete
      const deleteRes = await request(app)
        .delete('/api/compliance/locations/1')
        .set('Cookie', viewerCookie);
      expect(deleteRes.status).toBe(403);
    });

    it('HR should have read/write access', async () => {
      // HR can read
      const readRes = await request(app)
        .get('/api/compliance/licenses')
        .set('Cookie', hrCookie);
      expect(readRes.status).toBe(200);

      // HR can create
      const createRes = await request(app)
        .post('/api/compliance/responsible-persons')
        .set('Cookie', hrCookie)
        .send({
          firstName: 'HR',
          lastName: 'Test',
          email: 'hr.test@example.com',
          phone: '555-8888',
          locationId: 1,
          startDate: '2024-01-01'
        });
      expect([200, 201]).toContain(createRes.status);

      // HR can update
      if (createRes.body.id) {
        const updateRes = await request(app)
          .patch(`/api/compliance/responsible-persons/${createRes.body.id}`)
          .set('Cookie', hrCookie)
          .send({ title: 'Updated Title' });
        expect(updateRes.status).toBe(200);
      }
    });

    it('admin should have full access', async () => {
      // Admin can do everything including system configuration
      const configRes = await request(app)
        .get('/api/admin/s3-config')
        .set('Cookie', adminCookie);
      expect(configRes.status).toBe(200);

      // Admin can delete
      const location = await request(app)
        .post('/api/compliance/locations')
        .set('Cookie', adminCookie)
        .send({
          name: 'Delete Test',
          code: 'DEL',
          type: 'main',
          address1: '1 Del St',
          city: 'City',
          state: 'ST',
          zipCode: '12345',
          country: 'USA',
          phone: '555-9999',
          status: 'active'
        });

      const deleteRes = await request(app)
        .delete(`/api/compliance/locations/${location.body.id}`)
        .set('Cookie', adminCookie);
      expect(deleteRes.status).toBe(200);
    });
  });
});