/**
 * DocuSeal Service Unit Tests
 * 
 * Comprehensive unit tests for DocuSeal integration including:
 * - Service initialization and configuration
 * - Template management
 * - Submission creation and tracking
 * - Webhook handling
 * - Status transitions
 * - Error scenarios
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockDocuSealService } from '../__mocks__/docusealService';

// Mock database
vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis()
  }
}));

// Mock encryption
vi.mock('../../server/utils/encryption', () => ({
  encrypt: vi.fn(text => `encrypted:${text}`),
  decrypt: vi.fn(text => text.replace('encrypted:', ''))
}));

describe('DocuSeal Service Unit Tests', () => {
  let docuSealService: MockDocuSealService;

  beforeEach(() => {
    MockDocuSealService.resetMock();
    docuSealService = new MockDocuSealService();
  });

  afterEach(() => {
    MockDocuSealService.resetMock();
  });

  describe('Service Initialization', () => {
    test('should initialize successfully with valid configuration', async () => {
      MockDocuSealService.configureMock({
        isInitialized: false,
        shouldFailInit: false
      });

      const result = await docuSealService.initialize();
      expect(result).toBe(true);
    });

    test('should fail initialization with invalid configuration', async () => {
      MockDocuSealService.configureMock({
        shouldFailInit: true
      });

      const result = await docuSealService.initialize();
      expect(result).toBe(false);
    });

    test('should test connection to DocuSeal API', async () => {
      await docuSealService.initialize();
      
      const result = await docuSealService.testConnection();
      expect(result.success).toBe(true);
      expect(result.message).toMatch(/connected/i);
    });

    test('should handle connection test failures', async () => {
      MockDocuSealService.configureMock({
        shouldFailInit: true
      });

      const result = await docuSealService.testConnection();
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/not initialized|failed/i);
    });
  });

  describe('Template Management', () => {
    test('should sync templates from DocuSeal', async () => {
      await docuSealService.initialize();
      
      const result = await docuSealService.syncTemplates();
      
      expect(result.success).toBe(true);
      expect(result.synced).toBe(3); // Mock returns 3 templates
      expect(result.message).toMatch(/Successfully synced 3 templates/);
    });

    test('should handle template sync failures', async () => {
      MockDocuSealService.configureMock({
        shouldFailTemplateSync: true
      });

      await docuSealService.initialize();
      
      const result = await docuSealService.syncTemplates();
      
      expect(result.success).toBe(false);
      expect(result.synced).toBe(0);
      expect(result.message).toMatch(/Failed|error/i);
    });

    test('should retrieve all templates', async () => {
      await docuSealService.initialize();
      await docuSealService.syncTemplates();
      
      const templates = await docuSealService.getTemplates();
      
      expect(templates).toHaveLength(3);
      expect(templates[0]).toHaveProperty('id');
      expect(templates[0]).toHaveProperty('name');
      expect(templates[0]).toHaveProperty('fields');
    });

    test('should retrieve specific template by ID', async () => {
      await docuSealService.initialize();
      await docuSealService.syncTemplates();
      
      const template = await docuSealService.getTemplate('template_001');
      
      expect(template).toBeDefined();
      expect(template?.name).toBe('Employee Onboarding Form');
      expect(template?.fields).toHaveLength(4);
    });

    test('should return null for non-existent template', async () => {
      await docuSealService.initialize();
      
      const template = await docuSealService.getTemplate('non_existent');
      
      expect(template).toBeNull();
    });

    test('should validate template fields', async () => {
      await docuSealService.initialize();
      await docuSealService.syncTemplates();
      
      const template = await docuSealService.getTemplate('template_001');
      
      expect(template?.fields).toContainEqual(
        expect.objectContaining({
          name: 'full_name',
          type: 'text',
          required: true
        })
      );
      
      expect(template?.fields).toContainEqual(
        expect.objectContaining({
          name: 'signature',
          type: 'signature',
          required: true
        })
      );
    });
  });

  describe('Submission Creation', () => {
    test('should create submission successfully', async () => {
      await docuSealService.initialize();
      await docuSealService.syncTemplates();
      
      const result = await docuSealService.createSubmission({
        template_id: 'template_001',
        submitters: [{
          email: 'test@example.com',
          name: 'Test User'
        }],
        send_email: true
      });
      
      expect(result.success).toBe(true);
      expect(result.submission).toBeDefined();
      expect(result.submission?.id).toMatch(/^sub_/);
      expect(result.submission?.status).toBe('pending');
      expect(result.submission?.submitters).toHaveLength(1);
    });

    test('should fail submission with invalid template', async () => {
      await docuSealService.initialize();
      
      const result = await docuSealService.createSubmission({
        template_id: 'invalid_template',
        submitters: [{
          email: 'test@example.com'
        }]
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Template not found/);
    });

    test('should handle submission creation failures', async () => {
      MockDocuSealService.configureMock({
        shouldFailSubmission: true
      });

      await docuSealService.initialize();
      await docuSealService.syncTemplates();
      
      const result = await docuSealService.createSubmission({
        template_id: 'template_001',
        submitters: [{
          email: 'test@example.com'
        }]
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Failed|API error/);
    });

    test('should create submission with multiple submitters', async () => {
      await docuSealService.initialize();
      await docuSealService.syncTemplates();
      
      const result = await docuSealService.createSubmission({
        template_id: 'template_001',
        submitters: [
          { email: 'user1@example.com', name: 'User One' },
          { email: 'user2@example.com', name: 'User Two' },
          { email: 'user3@example.com', name: 'User Three' }
        ]
      });
      
      expect(result.success).toBe(true);
      expect(result.submission?.submitters).toHaveLength(3);
    });

    test('should handle submission without email sending', async () => {
      await docuSealService.initialize();
      await docuSealService.syncTemplates();
      
      const result = await docuSealService.createSubmission({
        template_id: 'template_001',
        submitters: [{
          email: 'test@example.com'
        }],
        send_email: false
      });
      
      expect(result.success).toBe(true);
      expect(result.submission?.submitters[0].sent_at).toBeNull();
    });

    test('should include custom message in submission', async () => {
      await docuSealService.initialize();
      await docuSealService.syncTemplates();
      
      const result = await docuSealService.createSubmission({
        template_id: 'template_001',
        submitters: [{
          email: 'test@example.com'
        }],
        message: {
          subject: 'Please complete your onboarding',
          body: 'Welcome to the team!'
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.submission).toBeDefined();
    });
  });

  describe('Submission Status Management', () => {
    test('should track status transitions', async () => {
      MockDocuSealService.configureMock({
        submissionDelay: 10,
        callbackDelay: 20
      });

      await docuSealService.initialize();
      await docuSealService.syncTemplates();
      
      const result = await docuSealService.createSubmission({
        template_id: 'template_001',
        submitters: [{
          email: 'status@example.com'
        }],
        send_email: true
      });
      
      const submissionId = result.submission!.id;
      
      // Initial status
      expect(result.submission?.status).toBe('pending');
      
      // Wait for status transitions
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const submission = await docuSealService.getSubmission(submissionId);
      expect(submission?.status).toBe('opened');
    });

    test('should complete submission', async () => {
      await docuSealService.initialize();
      await docuSealService.syncTemplates();
      
      const result = await docuSealService.createSubmission({
        template_id: 'template_001',
        submitters: [{
          email: 'complete@example.com'
        }]
      });
      
      const submissionId = result.submission!.id;
      
      const completed = await docuSealService.completeSubmission(submissionId, {
        full_name: 'John Doe',
        signature: 'JD'
      });
      
      expect(completed).toBe(true);
      
      const submission = await docuSealService.getSubmission(submissionId);
      expect(submission?.status).toBe('completed');
      expect(submission?.completed_at).toBeDefined();
      expect(submission?.submitters[0].values).toEqual({
        full_name: 'John Doe',
        signature: 'JD'
      });
    });

    test('should expire submission', async () => {
      await docuSealService.initialize();
      await docuSealService.syncTemplates();
      
      const result = await docuSealService.createSubmission({
        template_id: 'template_001',
        submitters: [{
          email: 'expire@example.com'
        }]
      });
      
      const submissionId = result.submission!.id;
      
      const expired = await docuSealService.expireSubmission(submissionId);
      expect(expired).toBe(true);
      
      const submission = await docuSealService.getSubmission(submissionId);
      expect(submission?.status).toBe('expired');
    });

    test('should resend submission', async () => {
      await docuSealService.initialize();
      await docuSealService.syncTemplates();
      
      const result = await docuSealService.createSubmission({
        template_id: 'template_001',
        submitters: [{
          email: 'resend@example.com'
        }]
      });
      
      const submissionId = result.submission!.id;
      
      // Expire first
      await docuSealService.expireSubmission(submissionId);
      
      // Resend
      const resendResult = await docuSealService.resendSubmission(submissionId);
      expect(resendResult.success).toBe(true);
      
      const submission = await docuSealService.getSubmission(submissionId);
      expect(submission?.status).toBe('sent');
    });

    test('should handle resend for non-existent submission', async () => {
      await docuSealService.initialize();
      
      const result = await docuSealService.resendSubmission('non_existent');
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found/i);
    });
  });

  describe('Submission Retrieval', () => {
    test('should retrieve submission by ID', async () => {
      await docuSealService.initialize();
      await docuSealService.syncTemplates();
      
      const createResult = await docuSealService.createSubmission({
        template_id: 'template_001',
        submitters: [{
          email: 'retrieve@example.com'
        }]
      });
      
      const submission = await docuSealService.getSubmission(createResult.submission!.id);
      
      expect(submission).toBeDefined();
      expect(submission?.id).toBe(createResult.submission!.id);
    });

    test('should return null for non-existent submission', async () => {
      await docuSealService.initialize();
      
      const submission = await docuSealService.getSubmission('non_existent');
      
      expect(submission).toBeNull();
    });

    test('should retrieve submissions by employee ID', async () => {
      await docuSealService.initialize();
      await docuSealService.syncTemplates();
      
      // Create submissions with employee metadata
      for (let i = 0; i < 3; i++) {
        const result = await docuSealService.createSubmission({
          template_id: 'template_001',
          submitters: [{
            email: `emp${i}@example.com`
          }]
        });
        
        // Add metadata (in real implementation)
        if (result.submission) {
          result.submission.metadata = { employeeId: 123 };
        }
      }
      
      const submissions = await docuSealService.getSubmissionsByEmployeeId(123);
      expect(submissions).toHaveLength(3);
    });
  });

  describe('Document Download', () => {
    test('should download completed submission documents', async () => {
      await docuSealService.initialize();
      await docuSealService.syncTemplates();
      
      const result = await docuSealService.createSubmission({
        template_id: 'template_001',
        submitters: [{
          email: 'download@example.com'
        }]
      });
      
      const submissionId = result.submission!.id;
      
      // Complete submission first
      await docuSealService.completeSubmission(submissionId);
      
      const downloadResult = await docuSealService.downloadSubmissionDocuments(submissionId);
      
      expect(downloadResult.success).toBe(true);
      expect(downloadResult.data).toBeDefined();
      expect(downloadResult.contentType).toBe('application/pdf');
      expect(downloadResult.data?.toString()).toMatch(/PDF/);
    });

    test('should fail download for incomplete submission', async () => {
      await docuSealService.initialize();
      await docuSealService.syncTemplates();
      
      const result = await docuSealService.createSubmission({
        template_id: 'template_001',
        submitters: [{
          email: 'incomplete@example.com'
        }]
      });
      
      const downloadResult = await docuSealService.downloadSubmissionDocuments(result.submission!.id);
      
      expect(downloadResult.success).toBe(false);
      expect(downloadResult.error).toMatch(/not completed/i);
    });

    test('should handle download for non-existent submission', async () => {
      await docuSealService.initialize();
      
      const result = await docuSealService.downloadSubmissionDocuments('non_existent');
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found/i);
    });
  });

  describe('Webhook Callbacks', () => {
    test('should register and trigger callbacks', async () => {
      await docuSealService.initialize();
      await docuSealService.syncTemplates();
      
      const callbackData: any[] = [];
      
      const result = await docuSealService.createSubmission({
        template_id: 'template_001',
        submitters: [{
          email: 'callback@example.com'
        }],
        send_email: true
      });
      
      const submissionId = result.submission!.id;
      
      // Register callback
      docuSealService.registerCallback(submissionId, (data) => {
        callbackData.push(data);
      });
      
      // Wait for callbacks
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Should have received 'sent' and 'opened' callbacks
      expect(callbackData.length).toBeGreaterThanOrEqual(1);
      expect(callbackData[0].event).toBe('sent');
    });

    test('should handle callback failures gracefully', async () => {
      MockDocuSealService.configureMock({
        shouldFailCallback: true
      });

      await docuSealService.initialize();
      await docuSealService.syncTemplates();
      
      const callbackData: any[] = [];
      
      const result = await docuSealService.createSubmission({
        template_id: 'template_001',
        submitters: [{
          email: 'fail-callback@example.com'
        }],
        send_email: true
      });
      
      docuSealService.registerCallback(result.submission!.id, (data) => {
        callbackData.push(data);
      });
      
      // Wait for potential callbacks
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // No callbacks should be triggered
      expect(callbackData).toHaveLength(0);
    });

    test('should trigger completion callback', async () => {
      await docuSealService.initialize();
      await docuSealService.syncTemplates();
      
      let completionData: any = null;
      
      const result = await docuSealService.createSubmission({
        template_id: 'template_001',
        submitters: [{
          email: 'complete-callback@example.com'
        }]
      });
      
      const submissionId = result.submission!.id;
      
      docuSealService.registerCallback(submissionId, (data) => {
        if (data.event === 'completed') {
          completionData = data;
        }
      });
      
      // Complete submission
      await docuSealService.completeSubmission(submissionId);
      
      // Wait for callback
      await new Promise(resolve => setTimeout(resolve, 250));
      
      expect(completionData).toBeDefined();
      expect(completionData.event).toBe('completed');
      expect(completionData.data.status).toBe('completed');
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      MockDocuSealService.configureMock({
        shouldFailSubmission: true
      });

      await docuSealService.initialize();
      await docuSealService.syncTemplates();
      
      const result = await docuSealService.createSubmission({
        template_id: 'template_001',
        submitters: [{
          email: 'network-error@example.com'
        }]
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should validate required fields', async () => {
      await docuSealService.initialize();
      
      // Missing template_id
      const result1 = await docuSealService.createSubmission({
        template_id: '',
        submitters: [{
          email: 'test@example.com'
        }]
      });
      
      expect(result1.success).toBe(false);
      
      // Missing submitters
      const result2 = await docuSealService.createSubmission({
        template_id: 'template_001',
        submitters: []
      });
      
      expect(result2.success).toBe(false);
    });

    test('should handle service not initialized', async () => {
      const result = await docuSealService.createSubmission({
        template_id: 'template_001',
        submitters: [{
          email: 'test@example.com'
        }]
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not initialized/i);
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle concurrent submissions', async () => {
      await docuSealService.initialize();
      await docuSealService.syncTemplates();
      
      const submissions = [];
      
      for (let i = 0; i < 5; i++) {
        submissions.push(
          docuSealService.createSubmission({
            template_id: 'template_001',
            submitters: [{
              email: `concurrent${i}@example.com`
            }]
          })
        );
      }
      
      const results = await Promise.all(submissions);
      
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.submission).toBeDefined();
      });
      
      // All submission IDs should be unique
      const ids = results.map(r => r.submission?.id).filter(Boolean);
      expect(new Set(ids).size).toBe(ids.length);
    });

    test('should handle concurrent status updates', async () => {
      await docuSealService.initialize();
      await docuSealService.syncTemplates();
      
      const result = await docuSealService.createSubmission({
        template_id: 'template_001',
        submitters: [{
          email: 'concurrent-status@example.com'
        }]
      });
      
      const submissionId = result.submission!.id;
      
      // Try concurrent operations
      const operations = [
        docuSealService.completeSubmission(submissionId),
        docuSealService.expireSubmission(submissionId),
        docuSealService.resendSubmission(submissionId)
      ];
      
      await Promise.all(operations);
      
      // Final status should be deterministic
      const submission = await docuSealService.getSubmission(submissionId);
      expect(['completed', 'expired', 'sent']).toContain(submission?.status);
    });
  });
});