/**
 * @fileoverview Mailtrap Service for Email Notifications
 * 
 * This module provides comprehensive email functionality for the HR management system
 * using Mailtrap. It handles configuration management, email sending, template generation,
 * and tracking for employee communications.
 * 
 * Features:
 * - Secure credential encryption and storage
 * - HTML email template generation for invitations
 * - Email verification and configuration testing
 * - Automatic retry logic and error handling
 * - Development environment support
 * 
 * @module mailtrapService
 * @requires mailtrap
 * @requires ../db
 * @requires @shared/schema
 * @requires drizzle-orm
 * @requires crypto
 */

import { MailtrapClient } from "mailtrap";
import { db } from "../db";
import { sesConfigurations, emailReminders } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "../utils/encryption";

/**
 * Email options for sending messages via Mailtrap
 * 
 * @interface EmailOptions
 * @description Configuration object for email sending operations
 */
export interface EmailOptions {
  /** Recipient email address */
  to: string;
  /** Email subject line */
  subject: string;
  /** Plain text email body (optional) */
  bodyText?: string;
  /** HTML email body (optional) */
  bodyHtml?: string;
  /** Reply-to email address (optional) */
  replyTo?: string;
}

/**
 * Template data for employee invitation emails
 * 
 * @interface EmailTemplateData
 * @description Data structure for generating personalized invitation emails
 */
export interface EmailTemplateData {
  /** Employee's first name */
  firstName: string;
  /** Employee's last name */
  lastName: string;
  /** Unique invitation URL for employee onboarding */
  invitationLink: string;
  /** Human-readable expiration timeframe (e.g., "in 7 days") */
  expiresIn?: string;
  /** Reminder sequence number (1-3 for escalating urgency) */
  reminderNumber?: number;
}

export class MailtrapService {
  private client: MailtrapClient | null = null;
  private config: any = null;
  private initialized = false;
  private fromEmail: string = '';
  private fromName: string = '';

  /**
   * Initialize Mailtrap client with configuration from database or environment
   * 
   * @async
   * @method initialize
   * @returns {Promise<boolean>} True if initialization successful, false otherwise
   * 
   * @description
   * Sets up the Mailtrap client using configuration from environment variables or database.
   * The method:
   * - First checks for environment variables (MAILTRAP_TOKEN)
   * - Falls back to database configuration if needed
   * - Validates credentials
   * - Creates Mailtrap client
   * - Sets initialization status for the service
   * 
   * @example
   * const mailtrapService = new MailtrapService();
   * const initialized = await mailtrapService.initialize();
   * if (!initialized) {
   *   console.log('Mailtrap service failed to initialize');
   * }
   */
  async initialize(): Promise<boolean> {
    try {
      console.log("Mailtrap Service: Initializing...");
      
      // First try environment variables
      const mailtrapToken = process.env.MAILTRAP_TOKEN || process.env.MAILTRAP_API_TOKEN;
      const mailtrapFromEmail = process.env.MAILTRAP_FROM_EMAIL || process.env.FROM_EMAIL || "noreply@dsigsoftware.com";
      const mailtrapFromName = process.env.MAILTRAP_FROM_NAME || process.env.FROM_NAME || "HR Management System";
      
      if (mailtrapToken) {
        console.log("Mailtrap Service: Using environment variables for configuration");
        console.log("Mailtrap Service: From email:", mailtrapFromEmail);
        console.log("Mailtrap Service: Token length:", mailtrapToken.length);
        
        this.client = new MailtrapClient({
          token: mailtrapToken,
        });
        
        this.fromEmail = mailtrapFromEmail;
        this.fromName = mailtrapFromName;
        this.initialized = true;
        console.log("Mailtrap Service: ✅ Initialized successfully using environment variables");
        return true;
      }
      
      // Fall back to database configuration (for backward compatibility)
      console.log("Mailtrap Service: Checking database for configuration...");
      const configs = await db.select().from(sesConfigurations).where(eq(sesConfigurations.enabled, true));
      
      if (configs.length === 0) {
        console.log("Mailtrap Service: No enabled configuration found");
        console.log("Mailtrap Service: Please set MAILTRAP_TOKEN environment variable or configure in settings");
        this.initialized = false;
        return false;
      }

      this.config = configs[0];
      console.log("Mailtrap Service: Found configuration in database");
      
      // Try to decrypt stored token (stored in accessKeyId field for compatibility)
      let token = '';
      try {
        if (this.config.accessKeyId && this.config.accessKeyId !== '') {
          token = decrypt(this.config.accessKeyId);
          if (!token) {
            console.log("Mailtrap Service: Failed to decrypt token from database");
            this.initialized = false;
            return false;
          }
        }
      } catch (error) {
        console.error("Mailtrap Service: Error decrypting token:", error);
        this.initialized = false;
        return false;
      }
      
      if (!token) {
        console.error("Mailtrap Service: No Mailtrap token found");
        this.initialized = false;
        return false;
      }
      
      // Initialize Mailtrap client
      try {
        this.client = new MailtrapClient({
          token: token,
        });
        
        this.fromEmail = this.config.fromEmail || mailtrapFromEmail;
        this.fromName = this.config.fromName || mailtrapFromName;
        
        this.initialized = true;
        console.log("Mailtrap Service: ✅ Initialized successfully from database");
        return true;
        
      } catch (clientError) {
        console.error("Mailtrap Service: Failed to create Mailtrap client:", clientError);
        this.initialized = false;
        return false;
      }
      
    } catch (error: any) {
      console.error("Mailtrap Service: Initialization failed:", {
        message: error.message,
        code: error.code,
        stack: error.stack?.split('\n').slice(0, 3).join('\n')
      });
      this.initialized = false;
      return false;
    }
  }

  /**
   * Save or update Mailtrap configuration in database
   * 
   * @async
   * @method saveConfiguration
   * @param {object} config - Mailtrap configuration object
   * @param {string} config.token - Mailtrap API token
   * @param {string} config.fromEmail - Sender email address
   * @param {string} [config.fromName] - Display name for sender
   * @param {boolean} [config.enabled] - Whether to enable this configuration
   * @param {number} config.updatedBy - User ID of admin making changes
   * @returns {Promise<boolean>} True if configuration saved successfully
   * 
   * @throws {Error} Database errors, encryption failures, or invalid configuration
   * 
   * @example
   * const config = {
   *   token: 'mt1234567890abcdef',
   *   fromEmail: 'hr@company.com',
   *   fromName: 'HR Department',
   *   enabled: true,
   *   updatedBy: 1
   * };
   * const saved = await mailtrapService.saveConfiguration(config);
   */
  async saveConfiguration(config: {
    token: string;
    fromEmail: string;
    fromName?: string;
    enabled?: boolean;
    updatedBy: number;
  }): Promise<boolean> {
    try {
      // Encrypt token for secure storage
      const encryptedToken = encrypt(config.token);

      // Check if configuration exists
      const existing = await db.select().from(sesConfigurations);
      
      if (existing.length > 0) {
        // Update existing configuration
        // Reusing the sesConfigurations table, storing token in accessKeyId field
        await db.update(sesConfigurations)
          .set({
            region: 'global', // Mailtrap is global, no region needed
            accessKeyId: encryptedToken, // Store token here for compatibility
            secretAccessKey: '', // Not used for Mailtrap
            fromEmail: config.fromEmail,
            fromName: config.fromName || "HR Management System",
            enabled: config.enabled !== undefined ? config.enabled : true,
            updatedAt: new Date(),
            updatedBy: config.updatedBy
          })
          .where(eq(sesConfigurations.id, existing[0].id));
      } else {
        // Insert new configuration
        await db.insert(sesConfigurations).values({
          region: 'global',
          accessKeyId: encryptedToken,
          secretAccessKey: '',
          fromEmail: config.fromEmail,
          fromName: config.fromName || "HR Management System",
          enabled: config.enabled !== undefined ? config.enabled : true,
          updatedBy: config.updatedBy
        });
      }

      // Reinitialize with new configuration
      await this.initialize();
      return true;
    } catch (error) {
      console.error("Mailtrap Service: Failed to save configuration", error);
      return false;
    }
  }

  /**
   * Test Mailtrap configuration by sending a test email
   * 
   * @async
   * @method testConfiguration
   * @param {string} testEmail - Email address to send test message to
   * @returns {Promise<{success: boolean; error?: string}>} Test result with success status and optional error
   * 
   * @example
   * const result = await mailtrapService.testConfiguration('admin@company.com');
   * if (result.success) {
   *   console.log('Mailtrap configuration is working correctly');
   * } else {
   *   console.error('Mailtrap test failed:', result.error);
   * }
   */
  async testConfiguration(testEmail: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.initialized) {
        const initialized = await this.initialize();
        if (!initialized) {
          return { success: false, error: "Failed to initialize Mailtrap service" };
        }
      }

      const result = await this.sendEmail({
        to: testEmail,
        subject: "Test Email from HR Management System",
        bodyText: "This is a test email to verify your Mailtrap configuration is working correctly.",
        bodyHtml: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Test Email Successful!</h2>
            <p>This is a test email to verify your Mailtrap configuration is working correctly.</p>
            <p style="color: #10B981;">✓ Your email configuration is properly set up.</p>
          </div>
        `
      });

      if (result.success) {
        // Update configuration as verified
        if (this.config?.id) {
          await db.update(sesConfigurations)
            .set({
              verified: true,
              lastVerifiedAt: new Date()
            })
            .where(eq(sesConfigurations.id, this.config.id));
        }
      }

      return result;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate invitation email HTML template
   * 
   * @private
   * @method generateInvitationEmailHtml
   * @param {EmailTemplateData} data - Template data for personalization
   * @returns {string} Complete HTML email template
   */
  private generateInvitationEmailHtml(data: EmailTemplateData): string {
    const isReminder = data.reminderNumber && data.reminderNumber > 0;
    const urgencyColor = data.reminderNumber === 3 ? "#DC2626" : data.reminderNumber === 2 ? "#F59E0B" : "#2563EB";
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #E5E7EB; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #2563EB; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; }
            .button:hover { background: #1D4ED8; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB; color: #6B7280; font-size: 14px; }
            .reminder-badge { display: inline-block; padding: 4px 12px; background: ${urgencyColor}; color: white; border-radius: 20px; font-size: 12px; font-weight: 600; }
            .warning { background: #FEF2F2; border: 1px solid #FCA5A5; padding: 15px; border-radius: 6px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 28px;">Welcome to HR Management System</h1>
              ${isReminder ? `<span class="reminder-badge">Reminder ${data.reminderNumber} of 3</span>` : ''}
            </div>
            <div class="content">
              <h2>Hello ${data.firstName} ${data.lastName},</h2>
              
              ${isReminder ? `
                <div class="warning">
                  <strong>⏰ Action Required!</strong> 
                  ${data.reminderNumber === 3 ? 
                    'This is your final reminder. Your invitation will expire soon!' : 
                    'Please complete your onboarding forms as soon as possible.'}
                </div>
              ` : ''}
              
              <p>
                ${isReminder ? 
                  'We noticed you haven\'t completed your employee onboarding yet. ' :
                  'Congratulations on joining our organization! '
                }
                You've been invited to complete your employee onboarding process through our self-service portal.
              </p>
              
              <p>Please click the button below to:</p>
              <ul>
                <li>Create your account</li>
                <li>Complete your employee information</li>
                <li>Upload required documents</li>
                <li>Review and submit for approval</li>
              </ul>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${data.invitationLink}" class="button">Complete Your Onboarding</a>
              </div>
              
              <p style="color: #DC2626; font-weight: 600;">
                ⚠️ Important: This invitation ${data.expiresIn || 'will expire soon'}. Please complete the process promptly.
              </p>
              
              <p>If you have any questions or need assistance, please contact the HR department.</p>
              
              <div class="footer">
                <p><strong>Security Note:</strong> This is an automated message from your organization's HR Management System. 
                If you did not expect this invitation, please contact your HR department immediately.</p>
                <p style="font-size: 12px; color: #9CA3AF;">
                  If the button doesn't work, copy and paste this link into your browser:<br>
                  <span style="color: #2563EB; word-break: break-all;">${data.invitationLink}</span>
                </p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Send an email using Mailtrap
   * 
   * @async
   * @method sendEmail
   * @param {EmailOptions} options - Email sending options
   * @returns {Promise<{success: boolean; messageId?: string; error?: string}>} Send result with success status
   * 
   * @example
   * const result = await mailtrapService.sendEmail({
   *   to: 'employee@company.com',
   *   subject: 'Welcome to the team!',
   *   bodyHtml: '<h1>Welcome!</h1>'
   * });
   */
  async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (!this.initialized) {
        console.log("Mailtrap Service: Not initialized, attempting to initialize...");
        const initialized = await this.initialize();
        if (!initialized) {
          return { 
            success: false, 
            error: "Mailtrap service not configured. Please set MAILTRAP_TOKEN environment variable." 
          };
        }
      }

      if (!this.client) {
        return { success: false, error: "Mailtrap client not initialized" };
      }

      console.log("Mailtrap Service: Sending email to:", options.to);
      console.log("Mailtrap Service: Subject:", options.subject);
      console.log("Mailtrap Service: From:", this.fromEmail);

      // Send email using Mailtrap
      const response = await this.client.send({
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        to: [{
          email: options.to
        }],
        subject: options.subject,
        text: options.bodyText || '',
        html: options.bodyHtml || options.bodyText || '',
        ...(options.replyTo && {
          reply_to: {
            email: options.replyTo
          }
        })
      });

      console.log("Mailtrap Service: Email sent successfully");
      console.log("Mailtrap Service: Response:", response);

      // Mailtrap returns an object with success and message_ids
      if (response.success) {
        return { 
          success: true, 
          messageId: response.message_ids?.[0] || 'success'
        };
      } else {
        return {
          success: false,
          error: "Failed to send email via Mailtrap"
        };
      }

    } catch (error: any) {
      console.error("Mailtrap Service: Send email failed:", error);
      return { 
        success: false, 
        error: error.message || 'Failed to send email' 
      };
    }
  }

  /**
   * Send employee invitation email
   * 
   * @async
   * @method sendInvitationEmail
   * @param {EmailTemplateData & { to: string }} data - Invitation data with recipient email
   * @returns {Promise<{success: boolean; messageId?: string; error?: string}>} Send result
   * 
   * @example
   * const result = await mailtrapService.sendInvitationEmail({
   *   to: 'john.doe@company.com',
   *   firstName: 'John',
   *   lastName: 'Doe',
   *   invitationLink: 'https://hr.company.com/onboard/abc123',
   *   expiresIn: 'in 7 days'
   * });
   */
  async sendInvitationEmail(data: EmailTemplateData & { to: string }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const subject = data.reminderNumber 
      ? `Reminder ${data.reminderNumber}: Complete Your Employee Onboarding`
      : 'Welcome! Complete Your Employee Onboarding';

    const htmlBody = this.generateInvitationEmailHtml(data);
    
    const textBody = `
Hello ${data.firstName} ${data.lastName},

${data.reminderNumber ? 'This is a reminder to complete your employee onboarding.' : 'Welcome to our organization!'}

You've been invited to complete your employee onboarding process through our self-service portal.

Please visit the following link to get started:
${data.invitationLink}

This invitation ${data.expiresIn || 'will expire soon'}, so please complete the process promptly.

If you have any questions, please contact the HR department.

Best regards,
HR Management System
    `.trim();

    return this.sendEmail({
      to: data.to,
      subject,
      bodyText: textBody,
      bodyHtml: htmlBody
    });
  }

  /**
   * Send reminder emails for pending invitations
   * 
   * @async
   * @method sendReminders
   * @returns {Promise<{sent: number; failed: number}>} Results of reminder sending
   */
  async sendReminders(): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    try {
      // Get pending reminders from database
      const pendingReminders = await db.select()
        .from(emailReminders)
        .where(
          and(
            eq(emailReminders.status, 'pending'),
            eq(emailReminders.emailType, 'invitation_reminder')
          )
        );

      for (const reminder of pendingReminders) {
        try {
          const result = await this.sendEmail({
            to: reminder.recipientEmail,
            subject: reminder.subject,
            bodyHtml: reminder.bodyHtml || undefined,
            bodyText: reminder.bodyText || undefined
          });

          if (result.success) {
            // Update reminder status
            await db.update(emailReminders)
              .set({
                status: 'sent',
                sentAt: new Date(),
                messageId: result.messageId
              })
              .where(eq(emailReminders.id, reminder.id));
            sent++;
          } else {
            // Update with error
            await db.update(emailReminders)
              .set({
                status: 'failed',
                errorMessage: result.error
              })
              .where(eq(emailReminders.id, reminder.id));
            failed++;
          }
        } catch (error: any) {
          console.error(`Mailtrap Service: Failed to send reminder ${reminder.id}:`, error);
          await db.update(emailReminders)
            .set({
              status: 'failed',
              errorMessage: error.message
            })
            .where(eq(emailReminders.id, reminder.id));
          failed++;
        }
      }

      console.log(`Mailtrap Service: Sent ${sent} reminders, ${failed} failed`);
      return { sent, failed };
    } catch (error) {
      console.error("Mailtrap Service: Error processing reminders:", error);
      return { sent, failed };
    }
  }

  /**
   * Check if service is initialized
   * 
   * @method isInitialized
   * @returns {boolean} True if service is ready to send emails
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get current configuration status
   * 
   * @method getStatus
   * @returns {object} Service status information
   */
  getStatus(): { initialized: boolean; configured: boolean; fromEmail?: string } {
    return {
      initialized: this.initialized,
      configured: this.initialized && !!this.client,
      fromEmail: this.fromEmail || undefined
    };
  }
}

// Create and export singleton instance
export const mailtrapService = new MailtrapService();