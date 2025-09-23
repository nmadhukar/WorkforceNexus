/**
 * AWS SES Service
 * 
 * Handles email sending through Amazon Simple Email Service (SES).
 * Manages configuration, sending, and tracking of email notifications
 * for employee onboarding invitations and reminders.
 */

import { SESClient, SendEmailCommand, VerifyEmailIdentityCommand } from "@aws-sdk/client-ses";
import { NodeHttpHandler } from "@aws-sdk/node-http-handler";
import { db } from "../db";
import { sesConfigurations, emailReminders } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import * as crypto from "crypto";

// Encryption key from environment or generate one
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex').slice(0, 32);
const ENCRYPTION_IV_LENGTH = 16;

/**
 * Encrypt sensitive data using AES-256
 */
function encrypt(text: string): string {
  const iv = crypto.randomBytes(ENCRYPTION_IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypt sensitive data
 */
function decrypt(text: string): string {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

export interface EmailOptions {
  to: string;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  replyTo?: string;
}

export interface EmailTemplateData {
  firstName: string;
  lastName: string;
  invitationLink: string;
  expiresIn?: string;
  reminderNumber?: number;
}

export class SESService {
  private client: SESClient | null = null;
  private config: any = null;
  private initialized = false;

  /**
   * Initialize SES client with configuration from database
   */
  async initialize(): Promise<boolean> {
    try {
      // Get SES configuration from database
      console.log("SES Service: Fetching configuration from database...");
      const configs = await db.select().from(sesConfigurations).where(eq(sesConfigurations.enabled, true));
      
      if (configs.length === 0) {
        console.log("SES Service: No enabled configuration found in database");
        // Try to get all configs to see what's there
        const allConfigs = await db.select().from(sesConfigurations);
        console.log("SES Service: Total configurations in database:", allConfigs.length);
        if (allConfigs.length > 0) {
          console.log("SES Service: Found disabled configuration(s). Enable SES in settings.");
        }
        return false;
      }

      this.config = configs[0];
      console.log("SES Service: Found configuration with ID:", this.config.id);
      console.log("SES Service: From email:", this.config.fromEmail);
      console.log("SES Service: Region:", this.config.region);
      
      // Decrypt credentials
      const accessKeyId = this.config.accessKeyId ? decrypt(this.config.accessKeyId) : process.env.AWS_SES_ACCESS_KEY_ID;
      const secretAccessKey = this.config.secretAccessKey ? decrypt(this.config.secretAccessKey) : process.env.AWS_SES_SECRET_ACCESS_KEY;
      
      if (!accessKeyId || !secretAccessKey) {
        console.error("SES Service: Missing AWS credentials");
        console.error("SES Service: Has encrypted accessKeyId:", !!this.config.accessKeyId);
        console.error("SES Service: Has encrypted secretAccessKey:", !!this.config.secretAccessKey);
        console.error("SES Service: Has env AWS_SES_ACCESS_KEY_ID:", !!process.env.AWS_SES_ACCESS_KEY_ID);
        console.error("SES Service: Has env AWS_SES_SECRET_ACCESS_KEY:", !!process.env.AWS_SES_SECRET_ACCESS_KEY);
        return false;
      }

      // For development environment, check if these look like dummy/test credentials
      if (accessKeyId.includes('dummy') || accessKeyId.includes('test') || secretAccessKey.includes('dummy') || secretAccessKey.includes('test')) {
        console.log("SES Service: Detected test/dummy credentials, skipping AWS SES initialization for development");
        return false;
      }

      // Initialize SES client with timeout configuration
      this.client = new SESClient({
        region: this.config.region || process.env.AWS_SES_REGION || "us-east-1",
        credentials: {
          accessKeyId,
          secretAccessKey
        },
        requestHandler: new NodeHttpHandler({
          requestTimeout: 10000, // 10 second timeout
          connectionTimeout: 5000 // 5 second connection timeout
        })
      });

      this.initialized = true;
      console.log("SES Service: Initialized successfully with region:", this.config.region || process.env.AWS_SES_REGION || "us-east-1");
      return true;
    } catch (error) {
      console.error("SES Service: Initialization failed", error);
      return false;
    }
  }

  /**
   * Save or update SES configuration in database
   */
  async saveConfiguration(config: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    fromEmail: string;
    fromName?: string;
    enabled?: boolean;
    updatedBy: number;
  }): Promise<boolean> {
    try {
      // Encrypt sensitive credentials
      const encryptedAccessKey = encrypt(config.accessKeyId);
      const encryptedSecretKey = encrypt(config.secretAccessKey);

      // Check if configuration exists
      const existing = await db.select().from(sesConfigurations);
      
      if (existing.length > 0) {
        // Update existing configuration
        await db.update(sesConfigurations)
          .set({
            region: config.region,
            accessKeyId: encryptedAccessKey,
            secretAccessKey: encryptedSecretKey,
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
          region: config.region,
          accessKeyId: encryptedAccessKey,
          secretAccessKey: encryptedSecretKey,
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
      console.error("SES Service: Failed to save configuration", error);
      return false;
    }
  }

  /**
   * Verify email address with AWS SES
   */
  async verifyEmailAddress(email: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.client) {
      console.error("SES Service: Client not initialized");
      return false;
    }

    try {
      const command = new VerifyEmailIdentityCommand({ EmailAddress: email });
      await this.client.send(command);
      console.log(`SES Service: Verification email sent to ${email}`);
      return true;
    } catch (error) {
      console.error("SES Service: Failed to verify email", error);
      return false;
    }
  }

  /**
   * Test SES configuration by sending a test email
   */
  async testConfiguration(testEmail: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.initialized) {
        const initialized = await this.initialize();
        if (!initialized) {
          return { success: false, error: "Failed to initialize SES service" };
        }
      }

      const result = await this.sendEmail({
        to: testEmail,
        subject: "Test Email from HR Management System",
        bodyText: "This is a test email to verify your AWS SES configuration is working correctly.",
        bodyHtml: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Test Email Successful!</h2>
            <p>This is a test email to verify your AWS SES configuration is working correctly.</p>
            <p style="color: #10B981;">✓ Your email configuration is properly set up.</p>
          </div>
        `
      });

      if (result.success) {
        // Update configuration as verified
        await db.update(sesConfigurations)
          .set({
            verified: true,
            lastVerifiedAt: new Date()
          })
          .where(eq(sesConfigurations.id, this.config.id));
      }

      return result;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate invitation email HTML template
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
                ⚠️ Important: This invitation will expire ${data.expiresIn || 'in 7 days'}.
              </p>
              
              <p>If you're unable to click the button above, copy and paste this link into your browser:</p>
              <p style="color: #2563EB; word-break: break-all;">${data.invitationLink}</p>
              
              <div class="footer">
                <p>If you have any questions or need assistance, please contact your HR department.</p>
                <p>This is an automated message. Please do not reply to this email.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate invitation email plain text template
   */
  private generateInvitationEmailText(data: EmailTemplateData): string {
    const isReminder = data.reminderNumber && data.reminderNumber > 0;
    
    return `
Hello ${data.firstName} ${data.lastName},

${isReminder ? 
  `REMINDER ${data.reminderNumber} of 3: ${data.reminderNumber === 3 ? 'FINAL REMINDER - ' : ''}Please complete your employee onboarding.\n\n` :
  'Congratulations on joining our organization!\n\n'
}

You've been invited to complete your employee onboarding process through our self-service portal.

Please visit the following link to:
- Create your account
- Complete your employee information
- Upload required documents
- Review and submit for approval

Onboarding Link: ${data.invitationLink}

IMPORTANT: This invitation will expire ${data.expiresIn || 'in 7 days'}.

If you have any questions or need assistance, please contact your HR department.

This is an automated message. Please do not reply to this email.

Best regards,
HR Management System
    `.trim();
  }

  /**
   * Send invitation email
   */
  async sendInvitationEmail(
    data: EmailTemplateData & { to: string },
    invitationId?: number,
    reminderNumber: number = 0
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const subject = reminderNumber > 0 
      ? `Reminder ${reminderNumber}: Complete Your Employee Onboarding`
      : "Welcome! Complete Your Employee Onboarding";

    const bodyHtml = this.generateInvitationEmailHtml({ ...data, reminderNumber });
    const bodyText = this.generateInvitationEmailText({ ...data, reminderNumber });

    const result = await this.sendEmail({
      to: data.to,
      subject,
      bodyText,
      bodyHtml
    });

    // Track email in database
    if (invitationId) {
      await db.insert(emailReminders).values({
        invitationId,
        recipientEmail: data.to,
        subject,
        bodyText,
        bodyHtml,
        status: result.success ? 'sent' : 'failed',
        sentAt: result.success ? new Date() : null,
        reminderNumber,
        messageId: result.messageId,
        errorMessage: result.error
      });
    }

    return result;
  }

  /**
   * Send email through AWS SES
   */
  async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (!this.initialized) {
        const initialized = await this.initialize();
        if (!initialized) {
          console.log("SES Service: Not configured, skipping email send in development environment");
          return { success: false, error: "SES service not configured - email would be sent in production" };
        }
      }

      if (!this.client || !this.config) {
        console.log("SES Service: Client not initialized, skipping email send");
        return { success: false, error: "SES client not initialized - email would be sent in production" };
      }

      const params = {
        Source: `${this.config.fromName} <${this.config.fromEmail}>`,
        Destination: {
          ToAddresses: [options.to]
        },
        Message: {
          Subject: {
            Data: options.subject,
            Charset: "UTF-8"
          },
          Body: {
            ...(options.bodyText && {
              Text: {
                Data: options.bodyText,
                Charset: "UTF-8"
              }
            }),
            ...(options.bodyHtml && {
              Html: {
                Data: options.bodyHtml,
                Charset: "UTF-8"
              }
            })
          }
        },
        ...(options.replyTo && { ReplyToAddresses: [options.replyTo] })
      };

      const command = new SendEmailCommand(params);
      
      // Add promise timeout wrapper to prevent hanging
      const sendEmailPromise = this.client.send(command);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Email send timeout after 15 seconds')), 15000)
      );
      
      const response = await Promise.race([sendEmailPromise, timeoutPromise]);
      
      console.log(`SES Service: Email sent successfully to ${options.to}`);
      return { success: true, messageId: response.MessageId };
    } catch (error: any) {
      console.error("SES Service: Failed to send email", error);
      return { 
        success: false, 
        error: error.message || "Failed to send email"
      };
    }
  }

  /**
   * Get current SES configuration status
   */
  async getConfigurationStatus(): Promise<{
    configured: boolean;
    enabled: boolean;
    verified: boolean;
    fromEmail?: string;
    region?: string;
  }> {
    try {
      const configs = await db.select().from(sesConfigurations);
      
      if (configs.length === 0) {
        return { configured: false, enabled: false, verified: false };
      }

      const config = configs[0];
      return {
        configured: true,
        enabled: config.enabled || false,
        verified: config.verified || false,
        fromEmail: config.fromEmail,
        region: config.region
      };
    } catch (error) {
      console.error("SES Service: Failed to get configuration status", error);
      return { configured: false, enabled: false, verified: false };
    }
  }
}

// Export singleton instance
export const sesService = new SESService();