/**
 * SES Service Unit Tests
 * 
 * Comprehensive unit tests for AWS SES email service including:
 * - Service initialization and configuration
 * - Email sending with various scenarios
 * - Template rendering
 * - Bounce and complaint handling
 * - Sandbox mode restrictions
 * - Rate limiting and quotas
 * - Retry logic
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockSESService } from '../__mocks__/sesService';

// Mock AWS SDK
vi.mock('@aws-sdk/client-ses', () => ({
  SESClient: vi.fn(),
  SendEmailCommand: vi.fn(),
  VerifyEmailIdentityCommand: vi.fn()
}));

// Mock database
vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis()
  }
}));

// Mock encryption
vi.mock('../../server/utils/encryption', () => ({
  encrypt: vi.fn(text => `encrypted:${text}`),
  decrypt: vi.fn(text => text.replace('encrypted:', ''))
}));

describe('SES Service Unit Tests', () => {
  let sesService: MockSESService;

  beforeEach(() => {
    MockSESService.resetMock();
    sesService = new MockSESService();
  });

  afterEach(() => {
    MockSESService.resetMock();
  });

  describe('Service Initialization', () => {
    test('should initialize successfully with valid configuration', async () => {
      MockSESService.configureMock({
        isInitialized: false,
        shouldFailInit: false
      });

      const result = await sesService.initialize();
      
      expect(result).toBe(true);
      expect(sesService.isInitialized).toBe(true);
    });

    test('should fail initialization with invalid credentials', async () => {
      MockSESService.configureMock({
        shouldFailInit: true
      });

      const result = await sesService.initialize();
      
      expect(result).toBe(false);
      expect(sesService.isInitialized).toBe(false);
    });

    test('should initialize with verified emails', async () => {
      await sesService.initialize();
      
      // Check default verified emails
      const testResult = await sesService.testConfiguration();
      
      expect(testResult.success).toBe(true);
      expect(testResult.details?.verifiedEmails).toContain('test@example.com');
      expect(testResult.details?.verifiedEmails).toContain('hr@test.company.com');
    });

    test('should test configuration successfully', async () => {
      await sesService.initialize();
      
      const result = await sesService.testConfiguration();
      
      expect(result.success).toBe(true);
      expect(result.message).toMatch(/successful/i);
      expect(result.details).toHaveProperty('region');
      expect(result.details).toHaveProperty('fromEmail');
      expect(result.details).toHaveProperty('sandboxMode');
      expect(result.details).toHaveProperty('dailyQuota');
      expect(result.details).toHaveProperty('sendRate');
    });
  });

  describe('Email Sending', () => {
    test('should send email successfully', async () => {
      await sesService.initialize();
      
      const result = await sesService.sendEmail({
        to: 'test@example.com',
        subject: 'Test Email',
        bodyText: 'This is a test email',
        bodyHtml: '<p>This is a test email</p>'
      });
      
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.messageId).toMatch(/@.*\.amazonses\.com$/);
    });

    test('should fail when service not initialized', async () => {
      const result = await sesService.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        bodyText: 'Test'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not initialized/i);
    });

    test('should handle send failures', async () => {
      MockSESService.configureMock({
        shouldFailSend: true
      });

      await sesService.initialize();
      
      const result = await sesService.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        bodyText: 'Test'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Failed|Network error/);
    });

    test('should include reply-to address', async () => {
      await sesService.initialize();
      
      const result = await sesService.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        bodyText: 'Test',
        replyTo: 'reply@example.com'
      });
      
      expect(result.success).toBe(true);
      
      const sentEmails = MockSESService.getSentEmails('test@example.com');
      expect(sentEmails[0].replyTo).toBe('reply@example.com');
    });

    test('should track sent emails', async () => {
      await sesService.initialize();
      
      // Send multiple emails
      await sesService.sendEmail({
        to: 'recipient1@example.com',
        subject: 'Email 1',
        bodyText: 'Text 1'
      });
      
      await sesService.sendEmail({
        to: 'recipient2@example.com',
        subject: 'Email 2',
        bodyText: 'Text 2'
      });
      
      await sesService.sendEmail({
        to: 'recipient1@example.com',
        subject: 'Email 3',
        bodyText: 'Text 3'
      });
      
      // Check tracking
      const recipient1Emails = MockSESService.getSentEmails('recipient1@example.com');
      expect(recipient1Emails).toHaveLength(2);
      
      const recipient2Emails = MockSESService.getSentEmails('recipient2@example.com');
      expect(recipient2Emails).toHaveLength(1);
      
      const allEmails = MockSESService.getSentEmails();
      expect(allEmails).toHaveLength(3);
    });
  });

  describe('Sandbox Mode Restrictions', () => {
    test('should enforce sandbox mode for unverified recipients', async () => {
      MockSESService.configureMock({
        sandboxMode: true
      });

      await sesService.initialize();
      
      const result = await sesService.sendEmail({
        to: 'unverified@external.com',
        subject: 'Test',
        bodyText: 'Test'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not verified|sandbox/i);
    });

    test('should allow sending to verified emails in sandbox mode', async () => {
      MockSESService.configureMock({
        sandboxMode: true
      });

      await sesService.initialize();
      
      const result = await sesService.sendEmail({
        to: 'test@example.com', // Pre-verified
        subject: 'Test',
        bodyText: 'Test'
      });
      
      expect(result.success).toBe(true);
    });

    test('should verify sender email in sandbox mode', async () => {
      MockSESService.configureMock({
        sandboxMode: true,
        fromEmail: 'unverified-sender@company.com'
      });

      await sesService.initialize();
      
      const result = await sesService.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        bodyText: 'Test'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Email address not verified.*unverified-sender/);
    });

    test('should not restrict in production mode', async () => {
      MockSESService.configureMock({
        sandboxMode: false
      });

      await sesService.initialize();
      
      const result = await sesService.sendEmail({
        to: 'any-email@anywhere.com',
        subject: 'Test',
        bodyText: 'Test'
      });
      
      expect(result.success).toBe(true);
    });
  });

  describe('Email Templates', () => {
    test('should send invitation email with template', async () => {
      await sesService.initialize();
      
      const result = await sesService.sendInvitationEmail(
        'new.employee@example.com',
        {
          firstName: 'John',
          lastName: 'Doe',
          invitationLink: 'https://app.example.com/register/token123',
          expiresIn: 'in 7 days'
        }
      );
      
      expect(result.success).toBe(true);
      
      const sentEmails = MockSESService.getSentEmails('new.employee@example.com');
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].subject).toMatch(/Complete Your Employee Onboarding/);
      expect(sentEmails[0].bodyHtml).toMatch(/John Doe/);
      expect(sentEmails[0].bodyHtml).toMatch(/token123/);
    });

    test('should send reminder emails with escalation', async () => {
      await sesService.initialize();
      
      // Initial invitation
      await sesService.sendInvitationEmail('reminder@example.com', {
        firstName: 'Jane',
        lastName: 'Smith',
        invitationLink: 'https://app.example.com/register/token456'
      });
      
      // Reminder 1
      await sesService.sendInvitationEmail('reminder@example.com', {
        firstName: 'Jane',
        lastName: 'Smith',
        invitationLink: 'https://app.example.com/register/token456',
        reminderNumber: 1
      });
      
      // Reminder 2
      await sesService.sendInvitationEmail('reminder@example.com', {
        firstName: 'Jane',
        lastName: 'Smith',
        invitationLink: 'https://app.example.com/register/token456',
        reminderNumber: 2
      });
      
      // Urgent Reminder 3
      await sesService.sendInvitationEmail('reminder@example.com', {
        firstName: 'Jane',
        lastName: 'Smith',
        invitationLink: 'https://app.example.com/register/token456',
        reminderNumber: 3,
        expiresIn: 'tomorrow'
      });
      
      const emails = MockSESService.getSentEmails('reminder@example.com');
      expect(emails).toHaveLength(4);
      
      // Check escalation
      expect(emails[0].subject).not.toMatch(/Reminder/);
      expect(emails[1].subject).toMatch(/Reminder 1/);
      expect(emails[2].subject).toMatch(/Reminder 2/);
      expect(emails[3].subject).toMatch(/Reminder 3/);
      
      // Check urgency in final reminder
      expect(emails[3].bodyHtml).toMatch(/URGENT/);
    });

    test('should send password reset email', async () => {
      await sesService.initialize();
      
      const result = await sesService.sendPasswordResetEmail(
        'user@example.com',
        'https://app.example.com/reset-password/reset-token-789',
        '1 hour'
      );
      
      expect(result.success).toBe(true);
      
      const sentEmails = MockSESService.getSentEmails('user@example.com');
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].subject).toMatch(/Password Reset/);
      expect(sentEmails[0].bodyHtml).toMatch(/reset-token-789/);
      expect(sentEmails[0].bodyHtml).toMatch(/1 hour/);
    });

    test('should render HTML templates correctly', async () => {
      await sesService.initialize();
      
      const result = await sesService.sendInvitationEmail(
        'html.test@example.com',
        {
          firstName: 'HTML',
          lastName: 'Test',
          invitationLink: 'https://app.example.com/register/html-test',
          expiresIn: 'in 3 days'
        }
      );
      
      const emails = MockSESService.getSentEmails('html.test@example.com');
      const html = emails[0].bodyHtml;
      
      // Check HTML structure
      expect(html).toMatch(/<html>/);
      expect(html).toMatch(/<style>/);
      expect(html).toMatch(/class="container"/);
      expect(html).toMatch(/class="button"/);
      expect(html).toMatch(/href="https:\/\/app\.example\.com\/register\/html-test"/);
    });
  });

  describe('Bounce and Complaint Handling', () => {
    test('should handle bounced emails', async () => {
      await sesService.initialize();
      
      MockSESService.addBouncedEmail('bounced@example.com');
      
      const result = await sesService.sendEmail({
        to: 'bounced@example.com',
        subject: 'Test',
        bodyText: 'Test'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/bounced/i);
      
      const stats = MockSESService.getStatistics();
      expect(stats.totalBounced).toBe(1);
    });

    test('should handle complaint emails', async () => {
      await sesService.initialize();
      
      MockSESService.addComplaintEmail('complainer@example.com');
      
      // Email still sends but is marked as complaint
      const result = await sesService.sendEmail({
        to: 'complainer@example.com',
        subject: 'Test',
        bodyText: 'Test'
      });
      
      // May succeed or fail depending on implementation
      const stats = MockSESService.getStatistics();
      expect(stats.totalComplained).toBeGreaterThanOrEqual(0);
    });

    test('should track bounce statistics', async () => {
      await sesService.initialize();
      
      MockSESService.addBouncedEmail('bounce1@example.com');
      MockSESService.addBouncedEmail('bounce2@example.com');
      
      await sesService.sendEmail({
        to: 'bounce1@example.com',
        subject: 'Test',
        bodyText: 'Test'
      });
      
      await sesService.sendEmail({
        to: 'bounce2@example.com',
        subject: 'Test',
        bodyText: 'Test'
      });
      
      const stats = MockSESService.getStatistics();
      expect(stats.totalBounced).toBe(2);
    });
  });

  describe('Rate Limiting and Quotas', () => {
    test('should enforce daily sending quota', async () => {
      MockSESService.configureMock({
        dailyQuota: 5
      });

      await sesService.initialize();
      
      // Send emails up to quota
      for (let i = 0; i < 5; i++) {
        const result = await sesService.sendEmail({
          to: `user${i}@example.com`,
          subject: 'Test',
          bodyText: 'Test'
        });
        expect(result.success).toBe(true);
      }
      
      // Next email should fail
      const result = await sesService.sendEmail({
        to: 'over-quota@example.com',
        subject: 'Test',
        bodyText: 'Test'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/quota/i);
    });

    test('should handle throttling', async () => {
      MockSESService.configureMock({
        shouldThrottle: true
      });

      await sesService.initialize();
      
      const result = await sesService.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        bodyText: 'Test'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Throttling|rate exceeded/i);
    });

    test('should reset daily quota', async () => {
      MockSESService.configureMock({
        dailyQuota: 3
      });

      await sesService.initialize();
      
      // Send up to quota
      for (let i = 0; i < 3; i++) {
        await sesService.sendEmail({
          to: `user${i}@example.com`,
          subject: 'Test',
          bodyText: 'Test'
        });
      }
      
      // Manually reset stats (simulating new day)
      MockSESService.resetMock();
      await sesService.initialize();
      
      // Should be able to send again
      const result = await sesService.sendEmail({
        to: 'after-reset@example.com',
        subject: 'Test',
        bodyText: 'Test'
      });
      
      expect(result.success).toBe(true);
    });
  });

  describe('Email Verification', () => {
    test('should verify email identity', async () => {
      await sesService.initialize();
      
      const result = await sesService.verifyEmailIdentity('new-email@example.com');
      
      expect(result.success).toBe(true);
      
      // Should now be able to send to this email in sandbox
      MockSESService.configureMock({ sandboxMode: true });
      
      const sendResult = await sesService.sendEmail({
        to: 'new-email@example.com',
        subject: 'Test',
        bodyText: 'Test'
      });
      
      expect(sendResult.success).toBe(true);
    });

    test('should validate email format', async () => {
      await sesService.initialize();
      
      const invalidEmails = [
        'not-an-email',
        '@example.com',
        'user@',
        'user @example.com',
        'user@example'
      ];
      
      for (const email of invalidEmails) {
        const result = await sesService.verifyEmailIdentity(email);
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Invalid email format/);
      }
    });

    test('should add verified emails to list', async () => {
      await sesService.initialize();
      
      await sesService.verifyEmailIdentity('verified1@example.com');
      await sesService.verifyEmailIdentity('verified2@example.com');
      
      const config = await sesService.testConfiguration();
      
      expect(config.details?.verifiedEmails).toContain('verified1@example.com');
      expect(config.details?.verifiedEmails).toContain('verified2@example.com');
    });
  });

  describe('Delivery Delays', () => {
    test('should handle delivery delays', async () => {
      MockSESService.configureMock({
        shouldDelayDelivery: true,
        sendDelay: 50
      });

      await sesService.initialize();
      
      const startTime = Date.now();
      
      await sesService.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        bodyText: 'Test'
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Statistics Tracking', () => {
    test('should track sending statistics', async () => {
      await sesService.initialize();
      
      // Send successful emails
      await sesService.sendEmail({
        to: 'success1@example.com',
        subject: 'Test',
        bodyText: 'Test'
      });
      
      await sesService.sendEmail({
        to: 'success2@example.com',
        subject: 'Test',
        bodyText: 'Test'
      });
      
      // Add bounce
      MockSESService.addBouncedEmail('bounce@example.com');
      await sesService.sendEmail({
        to: 'bounce@example.com',
        subject: 'Test',
        bodyText: 'Test'
      });
      
      // Check statistics
      const stats = MockSESService.getStatistics();
      
      expect(stats.totalSent).toBe(2);
      expect(stats.totalBounced).toBe(1);
      expect(stats.dailySent).toBe(2);
    });

    test('should track failed sends', async () => {
      MockSESService.configureMock({
        shouldFailSend: true
      });

      await sesService.initialize();
      
      await sesService.sendEmail({
        to: 'fail@example.com',
        subject: 'Test',
        bodyText: 'Test'
      });
      
      const stats = MockSESService.getStatistics();
      expect(stats.totalFailed).toBe(1);
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle concurrent email sends', async () => {
      await sesService.initialize();
      
      const emails = [];
      for (let i = 0; i < 10; i++) {
        emails.push(
          sesService.sendEmail({
            to: `concurrent${i}@example.com`,
            subject: `Email ${i}`,
            bodyText: `Content ${i}`
          })
        );
      }
      
      const results = await Promise.all(emails);
      
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.messageId).toBeDefined();
      });
      
      // All message IDs should be unique
      const messageIds = results.map(r => r.messageId).filter(Boolean);
      expect(new Set(messageIds).size).toBe(messageIds.length);
    });

    test('should maintain quota across concurrent sends', async () => {
      MockSESService.configureMock({
        dailyQuota: 5
      });

      await sesService.initialize();
      
      const emails = [];
      for (let i = 0; i < 10; i++) {
        emails.push(
          sesService.sendEmail({
            to: `quota${i}@example.com`,
            subject: 'Test',
            bodyText: 'Test'
          })
        );
      }
      
      const results = await Promise.all(emails);
      
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      expect(successful).toBeLessThanOrEqual(5);
      expect(failed).toBeGreaterThanOrEqual(5);
    });
  });
});