/**
 * DocuSeal API Service
 * 
 * Handles document signing and form management through DocuSeal API.
 * Manages templates, submissions, and document tracking for employee onboarding
 * and compliance requirements.
 */

import { db } from "../db";
import { 
  docusealConfigurations, 
  docusealTemplates, 
  formSubmissions,
  employees,
  employeeInvitations,
  type DocusealConfiguration,
  type DocusealTemplate,
  type FormSubmission,
  type InsertDocusealTemplate,
  type InsertFormSubmission
} from "@shared/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { encrypt, decrypt } from "../utils/encryption";

/**
 * DocuSeal API response types
 */
interface DocuSealTemplate {
  id: string;
  name: string;
  description?: string;
  fields?: any[];
  submitters?: any[];
  documents?: any[];
  created_at: string;
  updated_at: string;
}

interface DocuSealSubmission {
  id: string;
  template_id: string;
  status: 'pending' | 'sent' | 'opened' | 'completed' | 'expired';
  submitters: DocuSealSubmitter[];
  created_at: string;
  completed_at?: string;
  documents_url?: string;
  submission_events?: any[];
}

interface DocuSealSubmitter {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  status: string;
  sent_at?: string;
  opened_at?: string;
  completed_at?: string;
  values?: Record<string, any>;
}

interface CreateSubmissionOptions {
  template_id: string;
  submitters: {
    email: string;
    name?: string;
    phone?: string;
    role?: string;
  }[];
  send_email?: boolean;
  message?: {
    subject?: string;
    body: string;
  } | string;
}

/**
 * DocuSeal Service Class
 * Manages all interactions with DocuSeal API for document signing
 */
export class DocuSealService {
  private apiKey: string | null = null;
  private baseUrl: string = "https://api.docuseal.co";
  private config: DocusealConfiguration | null = null;
  private initialized = false;

  /**
   * Initialize DocuSeal client with configuration from database
   */
  async initialize(): Promise<boolean> {
    try {
      // Get DocuSeal configuration from database
      const configs = await db.select()
        .from(docusealConfigurations)
        .where(eq(docusealConfigurations.enabled, true))
        .limit(1);
      
      if (configs.length === 0) {
        console.log("DocuSeal Service: No enabled configuration found");
        return false;
      }

      this.config = configs[0];
      
      // Decrypt API key
      if (this.config.apiKey) {
        this.apiKey = decrypt(this.config.apiKey);
      } else {
        console.error("DocuSeal Service: No API key configured");
        return false;
      }

      // Set base URL
      if (this.config.baseUrl) {
        this.baseUrl = this.config.baseUrl;
      }

      this.initialized = true;
      console.log("DocuSeal Service: Initialized successfully");
      return true;
    } catch (error) {
      console.error("DocuSeal Service: Failed to initialize", error);
      return false;
    }
  }

  /**
   * Test the API connection with current configuration
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.initialized) {
      const initSuccess = await this.initialize();
      if (!initSuccess) {
        return {
          success: false,
          message: "Failed to initialize DocuSeal service"
        };
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/templates`, {
        method: 'GET',
        headers: {
          'X-Auth-Token': this.apiKey!,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Update last test results
        await db.update(docusealConfigurations)
          .set({
            lastTestAt: new Date(),
            lastTestSuccess: true,
            lastTestError: null
          })
          .where(eq(docusealConfigurations.id, this.config!.id));

        return {
          success: true,
          message: "Successfully connected to DocuSeal API"
        };
      } else {
        const errorText = await response.text();
        
        // Update last test results
        await db.update(docusealConfigurations)
          .set({
            lastTestAt: new Date(),
            lastTestSuccess: false,
            lastTestError: errorText
          })
          .where(eq(docusealConfigurations.id, this.config!.id));

        return {
          success: false,
          message: `Failed to connect to DocuSeal API: ${response.status} ${response.statusText}`
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Update last test results
      if (this.config) {
        await db.update(docusealConfigurations)
          .set({
            lastTestAt: new Date(),
            lastTestSuccess: false,
            lastTestError: errorMessage
          })
          .where(eq(docusealConfigurations.id, this.config.id));
      }

      return {
        success: false,
        message: `Connection test failed: ${errorMessage}`
      };
    }
  }

  /**
   * Fetch all templates from DocuSeal API
   */
  async fetchTemplates(): Promise<DocuSealTemplate[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.apiKey) {
      throw new Error("DocuSeal API key not configured");
    }

    try {
      const response = await fetch(`${this.baseUrl}/templates`, {
        method: 'GET',
        headers: {
          'X-Auth-Token': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch templates: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : data.data || [];
    } catch (error) {
      console.error("Failed to fetch templates from DocuSeal:", error);
      throw error;
    }
  }

  /**
   * Sync templates from DocuSeal API to database
   */
  async syncTemplates(): Promise<{ synced: number; failed: number; message: string }> {
    try {
      const apiTemplates = await this.fetchTemplates();
      let syncedCount = 0;
      let failedCount = 0;

      for (const apiTemplate of apiTemplates) {
        try {
          // Check if template already exists
          const existingTemplate = await db.select()
            .from(docusealTemplates)
            .where(eq(docusealTemplates.templateId, apiTemplate.id))
            .limit(1);

          const templateData: Partial<InsertDocusealTemplate> = {
            templateId: apiTemplate.id,
            name: apiTemplate.name,
            description: apiTemplate.description || null,
            fields: apiTemplate.fields || null,
            signerRoles: apiTemplate.submitters || null,
            documentCount: apiTemplate.documents?.length || 0
          };

          if (existingTemplate.length > 0) {
            // Update existing template
            await db.update(docusealTemplates)
              .set({
                ...templateData,
                lastSyncedAt: new Date(),
                updatedAt: new Date()
              })
              .where(eq(docusealTemplates.id, existingTemplate[0].id));
          } else {
            // Insert new template
            await db.insert(docusealTemplates).values({
              ...templateData,
              enabled: true,
              requiredForOnboarding: false,
              sortOrder: 0
            } as InsertDocusealTemplate);
          }
          
          syncedCount++;
        } catch (error) {
          console.error(`Failed to sync template ${apiTemplate.id}:`, error);
          failedCount++;
        }
      }

      return {
        synced: syncedCount,
        failed: failedCount,
        message: `Successfully synced ${syncedCount} templates${failedCount > 0 ? `, ${failedCount} failed` : ''}`
      };
    } catch (error) {
      return {
        synced: 0,
        failed: 0,
        message: `Failed to sync templates: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Create a new submission for a template
   */
  async createSubmission(options: CreateSubmissionOptions): Promise<DocuSealSubmission> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.apiKey) {
      throw new Error("DocuSeal API key not configured");
    }

    try {
      // Format message for DocuSeal API - must be an object
      let formattedMessage;
      if (options.message) {
        if (typeof options.message === 'string') {
          // Convert string message to object format for DocuSeal API
          formattedMessage = {
            subject: "Form Completion Required",
            body: options.message
          };
        } else {
          formattedMessage = options.message;
        }
      } else {
        // Default message if none provided
        formattedMessage = {
          subject: "Form Completion Required",
          body: "Please complete and sign this form at your earliest convenience."
        };
      }

      const payload = {
        template_id: options.template_id,
        send_email: options.send_email !== false, // Default to true
        submitters: options.submitters,
        message: formattedMessage
      };

      const response = await fetch(`${this.baseUrl}/submissions`, {
        method: 'POST',
        headers: {
          'X-Auth-Token': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`DocuSeal API error (${response.status}):`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          payload: JSON.stringify(payload, null, 2)
        });
        throw new Error(`Failed to create submission: ${response.status} ${errorText}`);
      }

      const submission = await response.json();
      return submission;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("Failed to create DocuSeal submission:", {
        message: err.message,
        template_id: options.template_id,
        submitters: options.submitters?.map(s => ({ email: s.email, name: s.name })),
        error: err.stack || err.message
      });
      throw err;
    }
  }

  /**
   * Get submission status from DocuSeal
   */
  async getSubmission(submissionId: string): Promise<DocuSealSubmission> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.apiKey) {
      throw new Error("DocuSeal API key not configured");
    }

    try {
      const response = await fetch(`${this.baseUrl}/submissions/${submissionId}`, {
        method: 'GET',
        headers: {
          'X-Auth-Token': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get submission: ${response.status} ${response.statusText}`);
      }

      const submission = await response.json();
      return submission;
    } catch (error) {
      console.error(`Failed to get submission ${submissionId}:`, error);
      throw error;
    }
  }

  /**
   * Download completed documents for a submission
   */
  async downloadDocuments(submissionId: string): Promise<Buffer> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.apiKey) {
      throw new Error("DocuSeal API key not configured");
    }

    try {
      const response = await fetch(`${this.baseUrl}/submissions/${submissionId}/documents`, {
        method: 'GET',
        headers: {
          'X-Auth-Token': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to download documents: ${response.status} ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      return Buffer.from(buffer);
    } catch (error) {
      console.error(`Failed to download documents for submission ${submissionId}:`, error);
      throw error;
    }
  }

  /**
   * Update submission status in database based on DocuSeal API
   */
  async updateSubmissionStatus(submissionId: string): Promise<FormSubmission | null> {
    try {
      // Get submission from DocuSeal
      const apiSubmission = await this.getSubmission(submissionId);
      
      // Find submission in database
      const dbSubmissions = await db.select()
        .from(formSubmissions)
        .where(eq(formSubmissions.submissionId, submissionId))
        .limit(1);

      if (dbSubmissions.length === 0) {
        console.warn(`Submission ${submissionId} not found in database`);
        return null;
      }

      const dbSubmission = dbSubmissions[0];
      
      // Map DocuSeal status to our status
      const statusMap: Record<string, string> = {
        'pending': 'pending',
        'sent': 'sent',
        'opened': 'opened',
        'completed': 'completed',
        'expired': 'expired'
      };

      // Get primary submitter info (assuming first submitter is primary)
      const primarySubmitter = apiSubmission.submitters[0];
      
      // Update submission in database
      const updatedSubmission = await db.update(formSubmissions)
        .set({
          status: statusMap[apiSubmission.status] || apiSubmission.status,
          sentAt: primarySubmitter?.sent_at ? new Date(primarySubmitter.sent_at) : dbSubmission.sentAt,
          openedAt: primarySubmitter?.opened_at ? new Date(primarySubmitter.opened_at) : dbSubmission.openedAt,
          completedAt: apiSubmission.completed_at ? new Date(apiSubmission.completed_at) : dbSubmission.completedAt,
          documentsUrl: apiSubmission.documents_url || dbSubmission.documentsUrl,
          submissionData: primarySubmitter?.values || dbSubmission.submissionData,
          updatedAt: new Date()
        })
        .where(eq(formSubmissions.id, dbSubmission.id))
        .returning();

      return updatedSubmission[0];
    } catch (error) {
      console.error(`Failed to update submission status for ${submissionId}:`, error);
      throw error;
    }
  }

  /**
   * Send form to employee with support for multi-party signing
   */
  async sendFormToEmployee(
    employeeId: number, 
    templateId: number,
    createdBy: number,
    isOnboarding: boolean = false,
    invitationId?: number
  ): Promise<FormSubmission> {
    try {
      // Get employee details
      const employee = await db.select()
        .from(employees)
        .where(eq(employees.id, employeeId))
        .limit(1);

      if (employee.length === 0) {
        throw new Error("Employee not found");
      }

      // Get template details
      const template = await db.select()
        .from(docusealTemplates)
        .where(eq(docusealTemplates.id, templateId))
        .limit(1);

      if (template.length === 0) {
        throw new Error("Template not found");
      }

      const emp = employee[0];
      const tmpl = template[0];

      // Check if template requires multi-party signing
      // This can be configured in template metadata or determined by template name/category
      const requiresHrSignature = tmpl.metadata?.requiresHrSignature || 
                                 tmpl.category === 'employment_agreement' ||
                                 tmpl.name?.toLowerCase().includes('agreement') ||
                                 tmpl.name?.toLowerCase().includes('contract');

      // Create submitters array based on signing requirements
      const submitters = [];
      let metadata: any = {
        requiresHrSignature,
        requiresEmployeeFirst: true,
        employeeSigned: false,
        hrSigned: false,
        signingUrls: {}
      };

      // Always add employee as first submitter
      submitters.push({
        email: emp.workEmail,
        name: `${emp.firstName} ${emp.lastName}`,
        phone: emp.cellPhone || undefined,
        role: 'employee'
      });

      // Add HR as second submitter if required
      if (requiresHrSignature) {
        // Get HR manager details (you might want to configure this)
        const hrEmail = process.env.HR_EMAIL || 'hr@company.com';
        const hrName = process.env.HR_NAME || 'HR Department';
        
        submitters.push({
          email: hrEmail,
          name: hrName,
          role: 'hr'
        });
      }

      // Create submission in DocuSeal with properly formatted message
      const messageContent = isOnboarding 
        ? "Please complete this form as part of your onboarding process. This is required to complete your employee onboarding."
        : "Please complete and sign this form at your earliest convenience.";
      
      const apiSubmission = await this.createSubmission({
        template_id: tmpl.templateId,
        submitters,
        send_email: true,
        message: {
          subject: isOnboarding ? "Onboarding Form Completion Required" : "Form Completion Required",
          body: messageContent
        }
      });

      // Extract signing URLs from the API submission
      if (apiSubmission.submitters) {
        // Employee signing URL (first submitter)
        if (apiSubmission.submitters[0]) {
          metadata.signingUrls.employee = `https://docuseal.co/s/${apiSubmission.submitters[0].id}`;
        }
        
        // HR signing URL (second submitter if exists)
        if (requiresHrSignature && apiSubmission.submitters[1]) {
          metadata.signingUrls.hr = `https://docuseal.co/s/${apiSubmission.submitters[1].id}`;
        }
      }

      // Store the primary submission URL (for the employee)
      const submissionUrl = metadata.signingUrls.employee || 
                          `https://docuseal.co/submissions/${apiSubmission.id}`;

      // Save submission to database with metadata
      const dbSubmission = await db.insert(formSubmissions).values({
        submissionId: apiSubmission.id,
        employeeId: employeeId,
        templateId: templateId,
        templateName: tmpl.name,
        recipientEmail: emp.workEmail,
        recipientName: `${emp.firstName} ${emp.lastName}`,
        recipientPhone: emp.cellPhone,
        status: 'sent',
        sentAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        isOnboardingRequirement: isOnboarding,
        invitationId: invitationId,
        createdBy: createdBy,
        submissionUrl,
        metadata
      }).returning();

      return dbSubmission[0];
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("Failed to send form to employee:", {
        message: err.message,
        employeeId,
        templateId,
        isOnboarding,
        error: err.stack || err.message
      });
      throw err;
    }
  }

  /**
   * Send required onboarding forms to new employee
   */
  async sendOnboardingForms(invitationId: number, employeeId: number, createdBy: number): Promise<FormSubmission[]> {
    try {
      // Get invitation details
      const invitation = await db.select()
        .from(employeeInvitations)
        .where(eq(employeeInvitations.id, invitationId))
        .limit(1);

      if (invitation.length === 0) {
        throw new Error("Invitation not found");
      }

      // Get required onboarding templates
      const requiredTemplateIds = invitation[0].requiredFormTemplates || [];
      
      if (requiredTemplateIds.length === 0) {
        // If no specific templates in invitation, use all templates marked as required for onboarding
        const requiredTemplates = await db.select()
          .from(docusealTemplates)
          .where(and(
            eq(docusealTemplates.requiredForOnboarding, true),
            eq(docusealTemplates.enabled, true)
          ));
        
        const submissions: FormSubmission[] = [];
        for (const template of requiredTemplates) {
          const submission = await this.sendFormToEmployee(
            employeeId, 
            template.id, 
            createdBy, 
            true, 
            invitationId
          );
          submissions.push(submission);
        }
        return submissions;
      } else {
        // Send specific templates from invitation
        const templates = await db.select()
          .from(docusealTemplates)
          .where(and(
            inArray(docusealTemplates.templateId, requiredTemplateIds),
            eq(docusealTemplates.enabled, true)
          ));
        
        const submissions: FormSubmission[] = [];
        for (const template of templates) {
          const submission = await this.sendFormToEmployee(
            employeeId, 
            template.id, 
            createdBy, 
            true, 
            invitationId
          );
          submissions.push(submission);
        }
        return submissions;
      }
    } catch (error) {
      console.error("Failed to send onboarding forms:", error);
      throw error;
    }
  }

  /**
   * Check if all onboarding forms are completed
   */
  async areOnboardingFormsCompleted(invitationId: number): Promise<boolean> {
    try {
      const submissions = await db.select()
        .from(formSubmissions)
        .where(and(
          eq(formSubmissions.invitationId, invitationId),
          eq(formSubmissions.isOnboardingRequirement, true)
        ));

      if (submissions.length === 0) {
        return true; // No forms required
      }

      // Check if all submissions are completed
      return submissions.every(s => s.status === 'completed');
    } catch (error) {
      console.error("Failed to check onboarding form completion:", error);
      return false;
    }
  }
}

// Export singleton instance
export const docuSealService = new DocuSealService();