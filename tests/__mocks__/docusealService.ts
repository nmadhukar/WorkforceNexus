/**
 * Mock DocuSeal Service for Testing
 * 
 * Simulates DocuSeal API interactions for document signing workflows including:
 * - Template management
 * - Form submission lifecycle
 * - Callback handling
 * - Status transitions
 * - Error scenarios
 */

import { vi } from 'vitest';
import type {
  DocusealConfiguration,
  DocusealTemplate,
  FormSubmission
} from '@shared/schema';

// Mock submission states
enum SubmissionStatus {
  PENDING = 'pending',
  SENT = 'sent',
  OPENED = 'opened',
  COMPLETED = 'completed',
  EXPIRED = 'expired',
  FAILED = 'failed'
}

// Mock storage for templates and submissions
const mockTemplates = new Map<string, any>();
const mockSubmissions = new Map<string, any>();
const mockCallbacks = new Map<string, Function>();

// Configuration for mock behavior
let mockConfig = {
  isInitialized: false,
  shouldFailInit: false,
  shouldFailTemplateSync: false,
  shouldFailSubmission: false,
  shouldFailCallback: false,
  apiKey: 'mock-api-key-123',
  baseUrl: 'https://api.docuseal.co',
  webhookUrl: 'https://localhost:5000/api/docuseal/webhook',
  submissionDelay: 100,
  callbackDelay: 200
};

// Mock DocuSeal Service Class
export class MockDocuSealService {
  private initialized = mockConfig.isInitialized;
  private apiKey: string | null = mockConfig.apiKey;
  private baseUrl = mockConfig.baseUrl;
  private config: DocusealConfiguration | null = null;

  async initialize(): Promise<boolean> {
    if (mockConfig.shouldFailInit) {
      console.error('DocuSeal Service: Failed to initialize');
      return false;
    }

    this.config = {
      id: 1,
      apiKey: mockConfig.apiKey,
      baseUrl: mockConfig.baseUrl,
      webhookUrl: mockConfig.webhookUrl,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSyncAt: null,
      lastTestAt: null,
      lastTestSuccess: null,
      lastTestError: null
    };

    this.initialized = true;
    console.log('DocuSeal Service: Initialized successfully');
    return true;
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.initialized) {
      return {
        success: false,
        message: 'DocuSeal service not initialized'
      };
    }

    if (mockConfig.shouldFailInit) {
      return {
        success: false,
        message: 'Connection test failed: Invalid API key'
      };
    }

    return {
      success: true,
      message: 'Successfully connected to DocuSeal API'
    };
  }

  async syncTemplates(): Promise<{ success: boolean; synced: number; message: string }> {
    if (!this.initialized) {
      return {
        success: false,
        synced: 0,
        message: 'Service not initialized'
      };
    }

    if (mockConfig.shouldFailTemplateSync) {
      return {
        success: false,
        synced: 0,
        message: 'Failed to sync templates: API error'
      };
    }

    // Add mock templates
    const templates = [
      {
        id: 'template_001',
        name: 'Employee Onboarding Form',
        description: 'Standard employee onboarding documentation',
        fields: [
          { name: 'full_name', type: 'text', required: true },
          { name: 'email', type: 'email', required: true },
          { name: 'phone', type: 'phone', required: false },
          { name: 'signature', type: 'signature', required: true }
        ]
      },
      {
        id: 'template_002',
        name: 'I-9 Employment Verification',
        description: 'Federal I-9 form for employment eligibility',
        fields: [
          { name: 'legal_name', type: 'text', required: true },
          { name: 'ssn', type: 'text', required: true },
          { name: 'birth_date', type: 'date', required: true }
        ]
      },
      {
        id: 'template_003',
        name: 'W-4 Tax Withholding',
        description: 'Federal W-4 tax withholding form',
        fields: [
          { name: 'filing_status', type: 'select', required: true },
          { name: 'dependents', type: 'number', required: false }
        ]
      }
    ];

    templates.forEach(template => {
      mockTemplates.set(template.id, template);
    });

    return {
      success: true,
      synced: templates.length,
      message: `Successfully synced ${templates.length} templates`
    };
  }

  async getTemplates(): Promise<any[]> {
    return Array.from(mockTemplates.values());
  }

  async getTemplate(templateId: string): Promise<any | null> {
    return mockTemplates.get(templateId) || null;
  }

  async createSubmission(options: {
    template_id: string;
    submitters: Array<{
      email: string;
      name?: string;
      phone?: string;
      role?: string;
    }>;
    send_email?: boolean;
    message?: string | { subject?: string; body: string };
  }): Promise<{ success: boolean; submission?: any; error?: string }> {
    if (!this.initialized) {
      return {
        success: false,
        error: 'Service not initialized'
      };
    }

    if (mockConfig.shouldFailSubmission) {
      return {
        success: false,
        error: 'Failed to create submission: API error'
      };
    }

    const template = mockTemplates.get(options.template_id);
    if (!template) {
      return {
        success: false,
        error: `Template not found: ${options.template_id}`
      };
    }

    const submissionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const submission = {
      id: submissionId,
      template_id: options.template_id,
      status: SubmissionStatus.PENDING,
      submitters: options.submitters.map((submitter, index) => ({
        id: `submitter_${index}`,
        ...submitter,
        status: 'pending',
        sent_at: options.send_email ? new Date().toISOString() : null,
        opened_at: null,
        completed_at: null,
        values: {}
      })),
      created_at: new Date().toISOString(),
      completed_at: null,
      documents_url: `https://docuseal.co/submissions/${submissionId}/documents`,
      submission_events: []
    };

    mockSubmissions.set(submissionId, submission);

    // Simulate async status updates
    if (options.send_email) {
      setTimeout(() => {
        const sub = mockSubmissions.get(submissionId);
        if (sub) {
          sub.status = SubmissionStatus.SENT;
          this.triggerCallback(submissionId, 'sent');
        }
      }, mockConfig.submissionDelay);

      setTimeout(() => {
        const sub = mockSubmissions.get(submissionId);
        if (sub) {
          sub.status = SubmissionStatus.OPENED;
          sub.submitters[0].opened_at = new Date().toISOString();
          this.triggerCallback(submissionId, 'opened');
        }
      }, mockConfig.submissionDelay * 2);
    }

    return {
      success: true,
      submission
    };
  }

  async getSubmission(submissionId: string): Promise<any | null> {
    return mockSubmissions.get(submissionId) || null;
  }

  async getSubmissionsByEmployeeId(employeeId: number): Promise<any[]> {
    // Filter submissions by employee ID (mock implementation)
    return Array.from(mockSubmissions.values()).filter(
      sub => sub.metadata?.employeeId === employeeId
    );
  }

  async completeSubmission(submissionId: string, values?: Record<string, any>): Promise<boolean> {
    const submission = mockSubmissions.get(submissionId);
    if (!submission) {
      return false;
    }

    submission.status = SubmissionStatus.COMPLETED;
    submission.completed_at = new Date().toISOString();
    submission.submitters.forEach((submitter: any) => {
      submitter.status = 'completed';
      submitter.completed_at = new Date().toISOString();
      submitter.values = values || {};
    });

    this.triggerCallback(submissionId, 'completed');
    return true;
  }

  async expireSubmission(submissionId: string): Promise<boolean> {
    const submission = mockSubmissions.get(submissionId);
    if (!submission) {
      return false;
    }

    submission.status = SubmissionStatus.EXPIRED;
    this.triggerCallback(submissionId, 'expired');
    return true;
  }

  async resendSubmission(submissionId: string): Promise<{ success: boolean; error?: string }> {
    const submission = mockSubmissions.get(submissionId);
    if (!submission) {
      return {
        success: false,
        error: 'Submission not found'
      };
    }

    submission.status = SubmissionStatus.SENT;
    submission.submitters.forEach((submitter: any) => {
      submitter.sent_at = new Date().toISOString();
    });

    return { success: true };
  }

  async downloadSubmissionDocuments(submissionId: string): Promise<{
    success: boolean;
    data?: Buffer;
    contentType?: string;
    error?: string;
  }> {
    const submission = mockSubmissions.get(submissionId);
    if (!submission) {
      return {
        success: false,
        error: 'Submission not found'
      };
    }

    if (submission.status !== SubmissionStatus.COMPLETED) {
      return {
        success: false,
        error: 'Documents not available - submission not completed'
      };
    }

    // Mock PDF data
    const mockPdfData = Buffer.from(`%PDF-1.4
Mock PDF Document
Submission ID: ${submissionId}
Template: ${submission.template_id}
Completed: ${submission.completed_at}
%%EOF`);

    return {
      success: true,
      data: mockPdfData,
      contentType: 'application/pdf'
    };
  }

  // Register callback for testing
  registerCallback(submissionId: string, callback: Function) {
    mockCallbacks.set(submissionId, callback);
  }

  // Trigger callback for testing
  private triggerCallback(submissionId: string, event: string) {
    if (mockConfig.shouldFailCallback) {
      return;
    }

    const callback = mockCallbacks.get(submissionId);
    if (callback) {
      setTimeout(() => {
        callback({
          event,
          submissionId,
          data: mockSubmissions.get(submissionId)
        });
      }, mockConfig.callbackDelay);
    }
  }

  // Helper to configure mock behavior
  static configureMock(config: Partial<typeof mockConfig>) {
    Object.assign(mockConfig, config);
  }

  // Helper to reset mock state
  static resetMock() {
    mockTemplates.clear();
    mockSubmissions.clear();
    mockCallbacks.clear();
    mockConfig = {
      isInitialized: false,
      shouldFailInit: false,
      shouldFailTemplateSync: false,
      shouldFailSubmission: false,
      shouldFailCallback: false,
      apiKey: 'mock-api-key-123',
      baseUrl: 'https://api.docuseal.co',
      webhookUrl: 'https://localhost:5000/api/docuseal/webhook',
      submissionDelay: 100,
      callbackDelay: 200
    };
  }

  // Helper to get mock state
  static getMockState() {
    return {
      templates: mockTemplates,
      submissions: mockSubmissions,
      callbacks: mockCallbacks,
      config: mockConfig
    };
  }
}

// Export mock instance
export const DocuSealService = MockDocuSealService;