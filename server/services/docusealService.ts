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
    values?: Record<string, any>; // Pre-filled field values (field name -> value mapping)
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

      const raw = await response.json();

      // Extract submission id from a variety of possible shapes
      let submissionId: string | undefined =
        (raw && raw.id) ||
        (raw && raw.uuid) ||
        (raw && raw.submission_uuid) ||
        (raw && raw.submission_id) ||
        (raw && raw.submission && (raw.submission.id || raw.submission.uuid || raw.submission.submission_uuid)) ||
        (raw && raw.data && (raw.data.id || raw.data.uuid || raw.data.submission_uuid)) ||
        (raw && raw.data && raw.data.submission && (raw.data.submission.id || raw.data.submission.uuid || raw.data.submission.submission_uuid)) ||
        (Array.isArray(raw?.submissions) && (raw.submissions[0]?.id || raw.submissions[0]?.uuid || raw.submissions[0]?.submission_uuid)) ||
        undefined;

      // Special-case: some DocuSeal responses return an array of submitters with submission_id
      let submittersArrayFromRaw: any[] | null = null;
      if (!submissionId && Array.isArray(raw) && raw.length > 0 && (raw[0]?.submission_id || raw[0]?.submission_uuid)) {
        submissionId = String(raw[0].submission_uuid || raw[0].submission_id);
        submittersArrayFromRaw = raw;
      }

      if (!submissionId) {
        console.error("DocuSeal createSubmission: unexpected response shape", {
          keys: raw ? Object.keys(raw) : [],
          preview: raw ? JSON.stringify(raw).slice(0, 600) : null
        });
        throw new Error("DocuSeal createSubmission returned no submission id");
      }

      // Extract submitters from common locations
      let submitters: DocuSealSubmitter[] =
        (raw && raw.submitters) ||
        (raw && raw.submission && raw.submission.submitters) ||
        (raw && raw.data && raw.data.submitters) ||
        (raw && raw.data && raw.data.submission && raw.data.submission.submitters) ||
        (Array.isArray(raw?.submissions) && raw.submissions[0]?.submitters) ||
        [];

      // Normalize submitters so id is always a URL token (slug if available), and strings where needed
      if (submittersArrayFromRaw) {
        submitters = submittersArrayFromRaw.map((s: any) => ({
          id: String(s.slug || s.id),
          email: s.email,
          name: s.name,
          phone: s.phone || undefined,
          status: s.status || 'sent',
          sent_at: s.sent_at || undefined,
          opened_at: s.opened_at || undefined,
          completed_at: s.completed_at || undefined,
          values: Array.isArray(s.values) ? {} : (s.values || {})
        })) as DocuSealSubmitter[];
      } else if (Array.isArray(submitters) && submitters.length > 0) {
        submitters = submitters.map((s: any) => ({
          id: String(s.slug || s.id),
          email: s.email,
          name: s.name,
          phone: s.phone || undefined,
          status: s.status || 'sent',
          sent_at: s.sent_at || undefined,
          opened_at: s.opened_at || undefined,
          completed_at: s.completed_at || undefined,
          values: Array.isArray(s.values) ? {} : (s.values || {})
        })) as DocuSealSubmitter[];
      }

      // Build a normalized submission object so callers can rely on .id and .submitters
      const normalized: DocuSealSubmission = {
        id: submissionId,
        template_id:
          (raw && raw.template_id) ||
          (raw && raw.submission && raw.submission.template_id) ||
          (raw && raw.data && raw.data.template_id) ||
          (raw && raw.data && raw.data.submission && raw.data.submission.template_id) ||
          (Array.isArray(raw?.submissions) && raw.submissions[0]?.template_id) ||
          (options.template_id as string),
        status:
          (raw && raw.status) ||
          (raw && raw.submission && raw.submission.status) ||
          (raw && raw.data && raw.data.status) ||
          (raw && raw.data && raw.data.submission && raw.data.submission.status) ||
          (Array.isArray(raw?.submissions) && raw.submissions[0]?.status) ||
          'sent',
        submitters: submitters as any,
        created_at:
          (raw && raw.created_at) ||
          (raw && raw.submission && raw.submission.created_at) ||
          (raw && raw.data && raw.data.created_at) ||
          (raw && raw.data && raw.data.submission && raw.data.submission.created_at) ||
          (Array.isArray(raw?.submissions) && raw.submissions[0]?.created_at) ||
          new Date().toISOString(),
        completed_at:
          (raw && raw.completed_at) ||
          (raw && raw.submission && raw.submission.completed_at) ||
          (raw && raw.data && raw.data.completed_at) ||
          (raw && raw.data && raw.data.submission && raw.data.submission.completed_at),
        documents_url:
          (raw && raw.documents_url) ||
          (raw && raw.submission && raw.submission.documents_url) ||
          (raw && raw.data && raw.data.documents_url) ||
          (raw && raw.data && raw.data.submission && raw.data.submission.documents_url)
      } as DocuSealSubmission;

      return normalized;
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
      // STEP 1: Get the document list (JSON, not PDF)
      const listResponse = await fetch(
        `${this.baseUrl}/submissions/${submissionId}/documents`,
        {
          method: "GET",
          headers: {
            "X-Auth-Token": this.apiKey,
          },
        }
      );
      if (!listResponse.ok) {
        throw new Error(
          `Failed to fetch document list: ${listResponse.status} ${listResponse.statusText}`
        );
      }
      const docs = await listResponse.json();
      if (!docs?.documents || docs?.documents?.length === 0) {
        throw new Error("No documents found for this submission.");
      }
      // STEP 2: Pick the first document's download URL
      const downloadUrl = docs?.documents[0]?.url;
      if (!downloadUrl) {
        throw new Error("Document does not have a download URL.");
      }
      // STEP 3: Download the actual PDF
      const pdfResponse = await fetch(downloadUrl, {
        method: "GET",
        headers: {
          "X-Auth-Token": this.apiKey,
        },
      });
  
      if (!pdfResponse.ok) {
        throw new Error(
          `Failed to download PDF: ${pdfResponse.status} ${pdfResponse.statusText}`
        );
      }
  
      const buffer = Buffer.from(await pdfResponse.arrayBuffer());
      return buffer;
  
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
      // Check if DocuSeal is properly configured
      if (!this.initialized) {
        const initResult = await this.initialize();
        if (!initResult) {
          const error = new Error("DocuSeal is not configured. Please configure DocuSeal API settings in Settings > API Keys.");
          (error as any).statusCode = 503;
          (error as any).errorType = 'SERVICE_UNAVAILABLE';
          throw error;
        }
      }

      // Get employee details
      const employee = await db.select()
        .from(employees)
        .where(eq(employees.id, employeeId))
        .limit(1);

      if (employee.length === 0) {
        const error = new Error(`Employee with ID ${employeeId} not found`);
        (error as any).statusCode = 404;
        (error as any).errorType = 'NOT_FOUND';
        throw error;
      }

      // Get template details
      const template = await db.select()
        .from(docusealTemplates)
        .where(eq(docusealTemplates.id, templateId))
        .limit(1);

      if (template.length === 0) {
        const error = new Error(`Form template not found. The template may have been deleted or is not available. Please contact your administrator to sync templates.`);
        (error as any).statusCode = 404;
        (error as any).errorType = 'TEMPLATE_NOT_FOUND';
        throw error;
      }

      const emp = employee[0];
      const tmpl = template[0];

      // Check if template requires multi-party signing
      // This can be configured in template metadata or determined by template name/category
      const requiresHrSignature = tmpl.category === 'employment_agreement' ||
                                 tmpl.name?.toLowerCase().includes('agreement') ||
                                 tmpl.name?.toLowerCase().includes('contract');

      // Determine correct roles from template's signer roles
      let employeeRole = 'Employee'; // Default to capitalized "Employee"
      let hrRole = 'Company'; // Default for HR/Company role
      
      if (tmpl.signerRoles) {
        try {
          const signerData = typeof tmpl.signerRoles === 'string' 
            ? JSON.parse(tmpl.signerRoles) 
            : tmpl.signerRoles;
          
          if (Array.isArray(signerData) && signerData.length > 0) {
            // Find employee role (case-insensitive match)
            const employeeRoleMatch = signerData.find((s: any) => {
              const roleName = typeof s === 'string' ? s : (s.name || s.role || '');
              return roleName.toLowerCase().includes('employee') || roleName.toLowerCase() === 'employee';
            });
            
            if (employeeRoleMatch) {
              employeeRole = typeof employeeRoleMatch === 'string' ? employeeRoleMatch : (employeeRoleMatch.name || employeeRoleMatch.role || 'Employee');
            } else {
              // Use first role as employee role
              employeeRole = typeof signerData[0] === 'string' ? signerData[0] : (signerData[0].name || signerData[0].role || 'Employee');
            }
            
            // Find HR/Company role (second role or one that contains company/hr)
            if (signerData.length > 1) {
              const hrRoleMatch = signerData.find((s: any, idx: number) => {
                if (idx === 0) return false; // Skip first (employee)
                const roleName = typeof s === 'string' ? s : (s.name || s.role || '');
                return roleName.toLowerCase().includes('company') || 
                       roleName.toLowerCase().includes('hr') || 
                       roleName.toLowerCase().includes('employer');
              });
              
              if (hrRoleMatch) {
                hrRole = typeof hrRoleMatch === 'string' ? hrRoleMatch : (hrRoleMatch.name || hrRoleMatch.role || 'Company');
              } else {
                hrRole = typeof signerData[1] === 'string' ? signerData[1] : (signerData[1].name || signerData[1].role || 'Company');
              }
            }
          }
        } catch (e) {
          console.warn('Failed to parse template signer roles in sendOnboardingForms, using defaults:', e);
        }
      }

      // Create submitters array based on signing requirements
      const submitters = [];
      let metadata: any = {
        requiresHrSignature,
        requiresEmployeeFirst: true,
        employeeSigned: false,
        hrSigned: false,
        signingUrls: {}
      };

      // Map employee data to DocuSeal form field values based on template
      const formValues: Record<string, any> = {};
      
      // Get template fields to determine which values to set
      let templateFields: any[] = [];
      if (tmpl.fields) {
        if (Array.isArray(tmpl.fields)) {
          templateFields = tmpl.fields;
        } else if (typeof tmpl.fields === 'object') {
          templateFields = (tmpl.fields as any).fields || (tmpl.fields as any).template_fields || [];
        } else if (typeof tmpl.fields === 'string') {
          try {
            const parsed = JSON.parse(tmpl.fields);
            templateFields = Array.isArray(parsed) ? parsed : (parsed.fields || parsed.template_fields || []);
          } catch (e) {
            // Not JSON string
          }
        }
      }
      
      // Extract field names from template
      const fieldNames = templateFields.map((f: any) => f.name || '').filter((n: string) => n);
      
      // EmpName - Employee Name (for PNM Admin Change Form and W9 Form)
      if (fieldNames.includes('EmpName') && (emp.firstName || emp.lastName)) {
        formValues.EmpName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
      }
      
      // EmpMedicaid ID - Note: field name has a space (for PNM Admin Change Form)
      if (fieldNames.includes('EmpMedicaid ID') && (emp.medicaidNumber || (emp as any).medicaidId)) {
        formValues['EmpMedicaid ID'] = emp.medicaidNumber || (emp as any).medicaidId;
      }
      
      // EmpNPI - Employee NPI (for PNM Admin Change Form)
      if (fieldNames.includes('EmpNPI') && (emp.npiNumber || (emp as any).npi)) {
        formValues.EmpNPI = emp.npiNumber || (emp as any).npi;
      }
      
      // EmpAddress - Employee Address (for W9 Form)
      if (fieldNames.includes('EmpAddress')) {
        const addressParts = [emp.homeAddress1, emp.homeAddress2].filter(Boolean);
        if (addressParts.length > 0) {
          formValues.EmpAddress = addressParts.join(', ');
        }
      }
      
      // EmpCityStateZip - City, State, ZIP (for W9 Form)
      if (fieldNames.includes('EmpCityStateZip')) {
        const cityStateZipParts = [
          emp.homeCity,
          emp.homeState,
          emp.homeZip
        ].filter(Boolean);
        if (cityStateZipParts.length > 0) {
          formValues.EmpCityStateZip = cityStateZipParts.join(', ');
        }
      }
      
      // SSN1, SSN2, SSN3 - Split SSN into 3 parts (for W9 Form)
      if (fieldNames.includes('SSN1') || fieldNames.includes('SSN2') || fieldNames.includes('SSN3')) {
        if (emp.ssn) {
          try {
            const decryptedSSN = decrypt(emp.ssn);
            // Remove any dashes or spaces
            const cleanSSN = decryptedSSN.replace(/[-\s]/g, '');
            if (cleanSSN.length >= 9) {
              // Split into 3 parts: XXX-XX-XXXX
              formValues.SSN1 = cleanSSN.substring(0, 3);
              formValues.SSN2 = cleanSSN.substring(3, 5);
              formValues.SSN3 = cleanSSN.substring(5, 9);
            }
          } catch (e) {
            console.warn('Failed to decrypt SSN for form pre-fill:', e);
          }
        }
      }
      
      // CompanyNameAddr - Company Name and Address (for W9 Form)
      if (fieldNames.includes('CompanyNameAddr')) {
        const companyParts = [
          (emp as any).companyName || (emp as any).company,
          (emp as any).companyAddress
        ].filter(Boolean);
        if (companyParts.length > 0) {
          formValues.CompanyNameAddr = companyParts.join(', ');
        }
      }
      
      // EmpSignDate - Set to current date in MM/DD/YYYY format (for both forms)
      if (fieldNames.includes('EmpSignDate')) {
        const today = new Date();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const year = today.getFullYear();
        formValues.EmpSignDate = `${month}/${day}/${year}`;
      }
      
      // CompName - Company Name (for PNM Admin Change Form)
      if (fieldNames.includes('CompName') && ((emp as any).companyName || (emp as any).company)) {
        formValues.CompName = (emp as any).companyName || (emp as any).company;
      }
      
      // CompOHID - Company OHID (for PNM Admin Change Form)
      if (fieldNames.includes('CompOHID') && ((emp as any).companyOHID || (emp as any).compOHID)) {
        formValues.CompOHID = (emp as any).companyOHID || (emp as any).compOHID;
      }

      // Always add employee as first submitter with pre-filled values
      submitters.push({
        email: emp.workEmail,
        name: `${emp.firstName} ${emp.lastName}`,
        phone: emp.cellPhone || undefined,
        role: employeeRole, // Use role from template (e.g., "Employee" with capital E)
        values: Object.keys(formValues).length > 0 ? formValues : undefined
      });

      // Add HR as second submitter if required
      if (requiresHrSignature) {
        // Get HR manager details (you might want to configure this)
        const hrEmail = process.env.HR_EMAIL || 'hr@company.com';
        const hrName = process.env.HR_NAME || 'HR Department';
        
        submitters.push({
          email: hrEmail,
          name: hrName,
          role: hrRole // Use role from template (e.g., "Company")
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
          const employeeToken = (apiSubmission.submitters[0] as any).slug || apiSubmission.submitters[0].id;
          metadata.signingUrls.employee = `https://docuseal.com/s/${employeeToken}`;
        }
        
        // HR signing URL (second submitter if exists)
        if (requiresHrSignature && apiSubmission.submitters[1]) {
          const hrToken = (apiSubmission.submitters[1] as any).slug || apiSubmission.submitters[1].id;
          metadata.signingUrls.hr = `https://docuseal.com/s/${hrToken}`;
        }
      }

      // Store the primary submission URL (for the employee)
      const submissionUrl = metadata.signingUrls.employee || 
                          `https://docuseal.com/submissions/${apiSubmission.id}`;

      // Save submission to database with metadata
      // Validate employee has email before sending
      if (!emp.workEmail) {
        const error = new Error(`Employee ${emp.firstName} ${emp.lastName} does not have a work email address configured. Please add an email address before sending forms.`);
        (error as any).statusCode = 400;
        (error as any).errorType = 'INVALID_REQUEST';
        throw error;
      }

      const dbSubmission = await db.insert(formSubmissions).values({
        employeeId: employeeId,
        templateId: tmpl.id,
        submissionId: apiSubmission.id,
        recipientEmail: emp.workEmail,
        recipientName: `${emp.firstName} ${emp.lastName}`,
        recipientPhone: emp.cellPhone || null,
        status: 'sent',
        sentAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        documentsUrl: submissionUrl,
        submissionData: metadata
      }).returning();

      return dbSubmission[0];
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      
      // Add status code if not already present
      if (!(err as any).statusCode) {
        // Check for specific DocuSeal API errors
        if (err.message.includes('401') || err.message.includes('Unauthorized')) {
          (err as any).statusCode = 401;
          (err as any).errorType = 'UNAUTHORIZED';
          err.message = 'DocuSeal API key is invalid or expired. Please update your API key in Settings > API Keys.';
        } else if (err.message.includes('404')) {
          (err as any).statusCode = 404;
          (err as any).errorType = 'NOT_FOUND';
        } else if (err.message.includes('Failed to create submission')) {
          (err as any).statusCode = 503;
          (err as any).errorType = 'DOCUSEAL_ERROR';
          err.message = 'Failed to create form submission in DocuSeal. Please check your DocuSeal configuration and try again.';
        } else {
          (err as any).statusCode = 500;
          (err as any).errorType = 'INTERNAL_ERROR';
        }
      }
      
      console.error("Failed to send form to employee:", {
        message: err.message,
        statusCode: (err as any).statusCode,
        errorType: (err as any).errorType,
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

  /**
   * Get signing URL for a specific signer
   * Generates a fresh signing URL for the specified signer email
   */
  async getSigningUrl(submissionId: string, signerEmail: string): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.apiKey) {
      throw new Error("DocuSeal API key not configured");
    }

    try {
      // Get submission details from DocuSeal API
      const submission = await this.getSubmission(submissionId);
      
      // Find the submitter by email
      const submitter = submission.submitters.find(
        s => s.email.toLowerCase() === signerEmail.toLowerCase()
      );

      if (!submitter) {
        console.error(`Signer ${signerEmail} not found in submission ${submissionId}`);
        return null;
      }

      // Prefer provider-provided embed_src, then slug token, then id as fallback
      const token = (submitter as any).slug || submitter.id;
      const signingUrl = (submitter as any).embed_src || `https://docuseal.com/s/${token}`;
      
      return signingUrl;
    } catch (error) {
      console.error(`Failed to get signing URL for submission ${submissionId}:`, error);
      throw error;
    }
  }

  /**
   * Send reminder to signer(s) for a submission
   */
  async sendReminder(submissionId: string, signerEmail?: string): Promise<{ success: boolean; message: string }> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.apiKey) {
      throw new Error("DocuSeal API key not configured");
    }

    try {
      // Build the reminder endpoint URL
      let reminderUrl = `${this.baseUrl}/submissions/${submissionId}/remind`;
      
      // Prepare request body based on whether a specific signer is targeted
      let requestBody = {};
      if (signerEmail) {
        // Get submission to find submitter ID
        const submission = await this.getSubmission(submissionId);
        const submitter = submission.submitters.find(
          s => s.email.toLowerCase() === signerEmail.toLowerCase()
        );
        
        if (!submitter) {
          return {
            success: false,
            message: `Signer ${signerEmail} not found in submission`
          };
        }

        // DocuSeal API expects submitter_id for targeted reminders
        requestBody = { submitter_id: submitter.id };
      }

      // Send reminder request to DocuSeal API
      const response = await fetch(reminderUrl, {
        method: 'POST',
        headers: {
          'X-Auth-Token': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to send reminder: ${response.status} ${errorText}`);
      }

      // Update reminder tracking in database
      const dbSubmissions = await db.select()
        .from(formSubmissions)
        .where(eq(formSubmissions.submissionId, submissionId))
        .limit(1);

      if (dbSubmissions.length > 0) {
        const submission = dbSubmissions[0];
        await db.update(formSubmissions)
          .set({
            remindersSent: (submission.remindersSent || 0) + 1,
            lastReminderAt: new Date(),
            nextReminderAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
            updatedAt: new Date()
          })
          .where(eq(formSubmissions.id, submission.id));
      }

      return {
        success: true,
        message: signerEmail 
          ? `Reminder sent to ${signerEmail}` 
          : 'Reminders sent to all pending signers'
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("Failed to send reminder:", {
        message: err.message,
        submissionId,
        signerEmail,
        error: err.stack || err.message
      });
      return {
        success: false,
        message: `Failed to send reminder: ${err.message}`
      };
    }
  }
}

// Export singleton instance
export const docuSealService = new DocuSealService();