/**
 * Mock SES Service for Testing
 * 
 * Simulates AWS SES email functionality including:
 * - Email sending with success/failure scenarios
 * - Template rendering
 * - Configuration management
 * - Email verification
 * - Retry logic simulation
 * - Development environment fallback
 */

import { vi } from 'vitest';
import type { EmailOptions, EmailTemplateData } from '../../server/services/sesService';

// Mock email storage for tracking sent emails
const mockSentEmails = new Map<string, any[]>();
const mockVerifiedEmails = new Set<string>();
const mockBouncedEmails = new Set<string>();
const mockComplaintEmails = new Set<string>();

// Configuration for mock behavior
let mockConfig = {
  isInitialized: false,
  shouldFailInit: false,
  shouldFailSend: false,
  shouldBounce: false,
  shouldComplain: false,
  shouldThrottle: false,
  shouldDelayDelivery: false,
  fromEmail: 'noreply@test.company.com',
  region: 'us-east-1',
  sandboxMode: true,
  sendDelay: 100,
  maxRetries: 3,
  rateLimit: 14, // SES default
  dailyQuota: 200 // SES sandbox default
};

// Track send statistics
let sendStats = {
  totalSent: 0,
  totalFailed: 0,
  totalBounced: 0,
  totalComplained: 0,
  dailySent: 0,
  lastResetTime: Date.now()
};

export class MockSESService {
  private initialized = mockConfig.isInitialized;
  private config: any = null;

  async initialize(): Promise<boolean> {
    if (mockConfig.shouldFailInit) {
      console.log('SES Service: Failed to initialize - Invalid credentials');
      return false;
    }

    this.config = {
      id: 1,
      accessKeyId: 'mock-access-key',
      secretAccessKey: 'mock-secret-key',
      region: mockConfig.region,
      fromEmail: mockConfig.fromEmail,
      enabled: true,
      sandboxMode: mockConfig.sandboxMode,
      verifiedEmails: Array.from(mockVerifiedEmails),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Add default verified emails for testing
    mockVerifiedEmails.add(mockConfig.fromEmail);
    mockVerifiedEmails.add('test@example.com');
    mockVerifiedEmails.add('hr@test.company.com');
    mockVerifiedEmails.add('admin@test.company.com');

    this.initialized = true;
    console.log('SES Service: Initialized successfully');
    return true;
  }

  async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.initialized) {
      return {
        success: false,
        error: 'SES Service not initialized'
      };
    }

    // Check daily quota
    this.resetDailyQuotaIfNeeded();
    if (sendStats.dailySent >= mockConfig.dailyQuota) {
      return {
        success: false,
        error: 'Daily sending quota exceeded'
      };
    }

    // Check rate limit (throttling)
    if (mockConfig.shouldThrottle) {
      return {
        success: false,
        error: 'Throttling - Maximum sending rate exceeded'
      };
    }

    // Validate sender email in sandbox mode
    if (mockConfig.sandboxMode && !mockVerifiedEmails.has(mockConfig.fromEmail)) {
      return {
        success: false,
        error: `Email address not verified: ${mockConfig.fromEmail}`
      };
    }

    // Validate recipient email in sandbox mode
    if (mockConfig.sandboxMode && !mockVerifiedEmails.has(options.to)) {
      return {
        success: false,
        error: `Recipient email not verified in sandbox mode: ${options.to}`
      };
    }

    // Check if email should bounce
    if (mockConfig.shouldBounce || mockBouncedEmails.has(options.to)) {
      sendStats.totalBounced++;
      return {
        success: false,
        error: `Email bounced: ${options.to}`
      };
    }

    // Check if email should generate complaint
    if (mockConfig.shouldComplain || mockComplaintEmails.has(options.to)) {
      sendStats.totalComplained++;
      // Still send but mark as complaint
    }

    // Simulate send failure
    if (mockConfig.shouldFailSend) {
      sendStats.totalFailed++;
      return {
        success: false,
        error: 'Failed to send email: Network error'
      };
    }

    // Generate message ID
    const messageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@${mockConfig.region}.amazonses.com`;

    // Store sent email
    const sentEmail = {
      messageId,
      from: mockConfig.fromEmail,
      to: options.to,
      subject: options.subject,
      bodyText: options.bodyText,
      bodyHtml: options.bodyHtml,
      replyTo: options.replyTo,
      sentAt: new Date(),
      status: 'sent',
      region: mockConfig.region
    };

    if (!mockSentEmails.has(options.to)) {
      mockSentEmails.set(options.to, []);
    }
    mockSentEmails.get(options.to)!.push(sentEmail);

    // Update statistics
    sendStats.totalSent++;
    sendStats.dailySent++;

    // Simulate delivery delay
    if (mockConfig.shouldDelayDelivery) {
      await new Promise(resolve => setTimeout(resolve, mockConfig.sendDelay));
    }

    return {
      success: true,
      messageId
    };
  }

  async sendInvitationEmail(
    to: string,
    templateData: EmailTemplateData
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const reminderText = templateData.reminderNumber ? 
      ` (Reminder ${templateData.reminderNumber})` : '';
    
    const subject = `Complete Your Employee Onboarding${reminderText}`;
    
    const bodyHtml = this.generateInvitationHtml(templateData);
    const bodyText = this.generateInvitationText(templateData);

    return this.sendEmail({
      to,
      subject,
      bodyText,
      bodyHtml,
      replyTo: 'hr@test.company.com'
    });
  }

  async sendPasswordResetEmail(
    to: string,
    resetLink: string,
    expiresIn: string = '1 hour'
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const subject = 'Password Reset Request';
    
    const bodyHtml = `
      <h2>Password Reset Request</h2>
      <p>You requested a password reset. Click the link below to reset your password:</p>
      <p><a href="${resetLink}">Reset Password</a></p>
      <p>This link will expire in ${expiresIn}.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `;
    
    const bodyText = `
      Password Reset Request
      
      You requested a password reset. Copy and paste this link to reset your password:
      ${resetLink}
      
      This link will expire in ${expiresIn}.
      If you didn't request this, please ignore this email.
    `;

    return this.sendEmail({
      to,
      subject,
      bodyText,
      bodyHtml
    });
  }

  async verifyEmailIdentity(email: string): Promise<{ success: boolean; error?: string }> {
    if (!this.initialized) {
      return {
        success: false,
        error: 'SES Service not initialized'
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        success: false,
        error: 'Invalid email format'
      };
    }

    mockVerifiedEmails.add(email);
    return { success: true };
  }

  async testConfiguration(): Promise<{ success: boolean; message: string; details?: any }> {
    if (!this.initialized) {
      return {
        success: false,
        message: 'SES Service not initialized'
      };
    }

    // Simulate test email
    const testResult = await this.sendEmail({
      to: mockConfig.fromEmail,
      subject: 'SES Configuration Test',
      bodyText: 'This is a test email to verify SES configuration.',
      bodyHtml: '<p>This is a test email to verify SES configuration.</p>'
    });

    if (testResult.success) {
      return {
        success: true,
        message: 'SES configuration test successful',
        details: {
          region: mockConfig.region,
          fromEmail: mockConfig.fromEmail,
          sandboxMode: mockConfig.sandboxMode,
          verifiedEmails: Array.from(mockVerifiedEmails),
          dailyQuota: mockConfig.dailyQuota,
          sendRate: mockConfig.rateLimit
        }
      };
    }

    return {
      success: false,
      message: testResult.error || 'Configuration test failed'
    };
  }

  private generateInvitationHtml(data: EmailTemplateData): string {
    const reminderClass = data.reminderNumber ? 'reminder' : '';
    const urgencyText = data.reminderNumber === 3 ? 
      '<p style="color: red; font-weight: bold;">URGENT: Final Reminder</p>' : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4A90E2; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9f9f9; padding: 30px; }
          .button { display: inline-block; padding: 12px 30px; background-color: #4A90E2; 
                   color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .reminder { border-left: 4px solid #FFA500; padding-left: 10px; }
        </style>
      </head>
      <body>
        <div class="container ${reminderClass}">
          <div class="header">
            <h1>Welcome to Our Team!</h1>
          </div>
          <div class="content">
            ${urgencyText}
            <h2>Hello ${data.firstName} ${data.lastName},</h2>
            <p>We're excited to have you join our organization! To get started with your 
               onboarding process, please click the button below:</p>
            <a href="${data.invitationLink}" class="button">Complete Onboarding</a>
            <p>This link will expire ${data.expiresIn || 'in 7 days'}.</p>
            <p>If you have any questions, please contact HR.</p>
          </div>
          <div class="footer">
            <p>© 2025 Test Company. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateInvitationText(data: EmailTemplateData): string {
    const urgencyText = data.reminderNumber === 3 ? 'URGENT - FINAL REMINDER\n\n' : '';
    
    return `
${urgencyText}Hello ${data.firstName} ${data.lastName},

Welcome to our organization!

To complete your onboarding process, please visit:
${data.invitationLink}

This link will expire ${data.expiresIn || 'in 7 days'}.

If you have any questions, please contact HR.

Best regards,
The HR Team
    `.trim();
  }

  private resetDailyQuotaIfNeeded(): void {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    if (now - sendStats.lastResetTime > oneDayMs) {
      sendStats.dailySent = 0;
      sendStats.lastResetTime = now;
    }
  }

  // Test helper methods
  static getSentEmails(recipient?: string): any[] {
    if (recipient) {
      return mockSentEmails.get(recipient) || [];
    }
    
    const allEmails: any[] = [];
    mockSentEmails.forEach(emails => allEmails.push(...emails));
    return allEmails;
  }

  static getStatistics() {
    return { ...sendStats };
  }

  static addBouncedEmail(email: string) {
    mockBouncedEmails.add(email);
  }

  static addComplaintEmail(email: string) {
    mockComplaintEmails.add(email);
  }

  static configureMock(config: Partial<typeof mockConfig>) {
    Object.assign(mockConfig, config);
  }

  static resetMock() {
    mockSentEmails.clear();
    mockVerifiedEmails.clear();
    mockBouncedEmails.clear();
    mockComplaintEmails.clear();
    
    sendStats = {
      totalSent: 0,
      totalFailed: 0,
      totalBounced: 0,
      totalComplained: 0,
      dailySent: 0,
      lastResetTime: Date.now()
    };
    
    mockConfig = {
      isInitialized: false,
      shouldFailInit: false,
      shouldFailSend: false,
      shouldBounce: false,
      shouldComplain: false,
      shouldThrottle: false,
      shouldDelayDelivery: false,
      fromEmail: 'noreply@test.company.com',
      region: 'us-east-1',
      sandboxMode: true,
      sendDelay: 100,
      maxRetries: 3,
      rateLimit: 14,
      dailyQuota: 200
    };
  }

  get isInitialized(): boolean {
    return this.initialized;
  }
}

// Export mock instance
export const SESService = MockSESService;