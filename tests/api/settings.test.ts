/**
 * Settings and Configuration API Tests
 * 
 * Tests admin settings endpoints for system configuration including
 * S3, SES, DocuSeal, and other integrations.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { getTestApp } from '../utils/test-app';
import { testDb } from '../utils/test-db';
import { createTestUsers } from '../utils/auth-helpers';

describe('Settings and Configuration API', () => {
  let app: any;

  beforeEach(async () => {
    app = await getTestApp();
    await testDb.cleanupBetweenTests();
  });

  afterEach(async () => {
    await testDb.cleanupBetweenTests();
  });

  describe('GET /api/admin/settings', () => {
    test('should return all settings for admin', async () => {
      const { adminUser } = await createTestUsers(app);

      const response = await adminUser.agent
        .get('/api/admin/settings')
        .expect(200);

      expect(response.body).toHaveProperty('s3');
      expect(response.body).toHaveProperty('ses');
      expect(response.body).toHaveProperty('docuseal');
      expect(response.body).toHaveProperty('app');
    });

    test('should mask sensitive configuration values', async () => {
      const { adminUser } = await createTestUsers(app);

      const response = await adminUser.agent
        .get('/api/admin/settings')
        .expect(200);

      // Check that sensitive values are masked
      if (response.body.s3?.accessKeyId) {
        expect(response.body.s3.accessKeyId).toMatch(/^\*+$/);
      }
      if (response.body.s3?.secretAccessKey) {
        expect(response.body.s3.secretAccessKey).toMatch(/^\*+$/);
      }
      if (response.body.docuseal?.apiKey) {
        expect(response.body.docuseal.apiKey).toMatch(/^\*+$/);
      }
    });

    test('should require admin role', async () => {
      const { hrUser } = await createTestUsers(app);

      await hrUser.agent
        .get('/api/admin/settings')
        .expect(403);
    });

    test('should require authentication', async () => {
      await request(app)
        .get('/api/admin/settings')
        .expect(401);
    });
  });

  describe('PUT /api/admin/settings', () => {
    test('should update S3 configuration', async () => {
      const { adminUser } = await createTestUsers(app);

      const s3Settings = {
        s3: {
          region: 'us-west-2',
          bucket: 'test-bucket',
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
          enabled: true
        }
      };

      const response = await adminUser.agent
        .put('/api/admin/settings')
        .send(s3Settings)
        .expect(200);

      expect(response.body.message).toContain('updated');
      
      // Verify settings were saved
      const getResponse = await adminUser.agent
        .get('/api/admin/settings')
        .expect(200);

      expect(getResponse.body.s3.region).toBe('us-west-2');
      expect(getResponse.body.s3.bucket).toBe('test-bucket');
      expect(getResponse.body.s3.enabled).toBe(true);
    });

    test('should update SES configuration', async () => {
      const { adminUser } = await createTestUsers(app);

      const sesSettings = {
        ses: {
          region: 'us-east-1',
          accessKeyId: 'ses-access-key',
          secretAccessKey: 'ses-secret-key',
          fromEmail: 'hr@company.com',
          enabled: true
        }
      };

      const response = await adminUser.agent
        .put('/api/admin/settings')
        .send(sesSettings)
        .expect(200);

      expect(response.body.message).toContain('updated');

      // Verify settings were saved
      const getResponse = await adminUser.agent
        .get('/api/admin/settings')
        .expect(200);

      expect(getResponse.body.ses.region).toBe('us-east-1');
      expect(getResponse.body.ses.fromEmail).toBe('hr@company.com');
      expect(getResponse.body.ses.enabled).toBe(true);
    });

    test('should update DocuSeal configuration', async () => {
      const { adminUser } = await createTestUsers(app);

      const docusealSettings = {
        docuseal: {
          apiKey: 'docuseal-api-key',
          baseUrl: 'https://api.docuseal.co',
          templateId: 'template-123',
          enabled: true
        }
      };

      const response = await adminUser.agent
        .put('/api/admin/settings')
        .send(docusealSettings)
        .expect(200);

      expect(response.body.message).toContain('updated');

      // Verify settings were saved
      const getResponse = await adminUser.agent
        .get('/api/admin/settings')
        .expect(200);

      expect(getResponse.body.docuseal.baseUrl).toBe('https://api.docuseal.co');
      expect(getResponse.body.docuseal.templateId).toBe('template-123');
      expect(getResponse.body.docuseal.enabled).toBe(true);
    });

    test('should update app configuration', async () => {
      const { adminUser } = await createTestUsers(app);

      const appSettings = {
        app: {
          companyName: 'Test Hospital',
          timezone: 'America/New_York',
          dateFormat: 'MM/DD/YYYY',
          theme: 'light'
        }
      };

      const response = await adminUser.agent
        .put('/api/admin/settings')
        .send(appSettings)
        .expect(200);

      expect(response.body.message).toContain('updated');

      // Verify settings were saved
      const getResponse = await adminUser.agent
        .get('/api/admin/settings')
        .expect(200);

      expect(getResponse.body.app.companyName).toBe('Test Hospital');
      expect(getResponse.body.app.timezone).toBe('America/New_York');
      expect(getResponse.body.app.dateFormat).toBe('MM/DD/YYYY');
    });

    test('should validate S3 configuration structure', async () => {
      const { adminUser } = await createTestUsers(app);

      const invalidS3Settings = {
        s3: {
          region: '', // Invalid - empty region
          bucket: 'test-bucket'
        }
      };

      await adminUser.agent
        .put('/api/admin/settings')
        .send(invalidS3Settings)
        .expect(400);
    });

    test('should validate email format in SES settings', async () => {
      const { adminUser } = await createTestUsers(app);

      const invalidSesSettings = {
        ses: {
          fromEmail: 'invalid-email' // Invalid email format
        }
      };

      await adminUser.agent
        .put('/api/admin/settings')
        .send(invalidSesSettings)
        .expect(400);
    });

    test('should require admin role', async () => {
      const { hrUser } = await createTestUsers(app);

      const settings = {
        app: {
          companyName: 'Test'
        }
      };

      await hrUser.agent
        .put('/api/admin/settings')
        .send(settings)
        .expect(403);
    });

    test('should require authentication', async () => {
      const settings = {
        app: {
          companyName: 'Test'
        }
      };

      await request(app)
        .put('/api/admin/settings')
        .send(settings)
        .expect(401);
    });
  });

  describe('POST /api/admin/settings/test-s3', () => {
    test('should test S3 connection', async () => {
      const { adminUser } = await createTestUsers(app);

      const s3Config = {
        region: 'us-west-2',
        bucket: 'test-bucket',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret'
      };

      const response = await adminUser.agent
        .post('/api/admin/settings/test-s3')
        .send(s3Config)
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('message');
    });

    test('should require admin role', async () => {
      const { hrUser } = await createTestUsers(app);

      await hrUser.agent
        .post('/api/admin/settings/test-s3')
        .send({})
        .expect(403);
    });
  });

  describe('POST /api/admin/settings/test-ses', () => {
    test('should test SES connection', async () => {
      const { adminUser } = await createTestUsers(app);

      const sesConfig = {
        region: 'us-east-1',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
        fromEmail: 'test@example.com',
        testEmail: 'admin@example.com'
      };

      const response = await adminUser.agent
        .post('/api/admin/settings/test-ses')
        .send(sesConfig)
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('message');
    });

    test('should require admin role', async () => {
      const { hrUser } = await createTestUsers(app);

      await hrUser.agent
        .post('/api/admin/settings/test-ses')
        .send({})
        .expect(403);
    });
  });

  describe('POST /api/admin/settings/test-docuseal', () => {
    test('should test DocuSeal connection', async () => {
      const { adminUser } = await createTestUsers(app);

      const docusealConfig = {
        apiKey: 'test-api-key',
        baseUrl: 'https://api.docuseal.co'
      };

      const response = await adminUser.agent
        .post('/api/admin/settings/test-docuseal')
        .send(docusealConfig)
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('message');
    });

    test('should require admin role', async () => {
      const { hrUser } = await createTestUsers(app);

      await hrUser.agent
        .post('/api/admin/settings/test-docuseal')
        .send({})
        .expect(403);
    });
  });
});