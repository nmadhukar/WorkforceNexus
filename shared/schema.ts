/**
 * HR Management System Database Schema
 * 
 * This file defines the complete database schema for a comprehensive HR management system
 * specifically designed for medical staff and healthcare professionals. The schema includes
 * employee management, credential tracking, compliance monitoring, and audit logging.
 * 
 * Key Features:
 * - Comprehensive employee profiles with medical licensing
 * - Educational background and employment history tracking
 * - Regulatory compliance monitoring (CAQH, DEA, state licenses)
 * - Document management with file upload support
 * - Full audit logging for compliance
 * - Role-based access control (RBAC) for HR security
 */

import { sql } from "drizzle-orm";
import { 
  pgTable, 
  serial, 
  varchar, 
  text, 
  date, 
  boolean, 
  timestamp,
  integer,
  jsonb,
  decimal,
  index
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * USERS TABLE
 * 
 * Manages authentication and authorization for the HR system.
 * Implements role-based access control with secure password hashing.
 * 
 * Roles:
 * - 'admin': System administrators with elevated privileges
 * - 'hr': Standard HR staff with full employee management access
 * - 'prospective_employee': New employees awaiting approval (limited access to onboarding)
 * - 'employee': Approved employees with self-service portal access
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(), // Auto-incrementing primary key
  username: varchar("username", { length: 50 }).unique().notNull(), // Unique login identifier
  passwordHash: varchar("password_hash", { length: 255 }).notNull(), // Scrypt-hashed password with salt
  role: varchar("role", { length: 20 }).notNull().default("hr"), // User role for RBAC
  status: varchar("status", { length: 20 }).default("active").notNull(), // User status: active | suspended | locked | disabled
  email: varchar("email", { length: 100 }).unique(), // Optional email field (unique but nullable)
  createdAt: timestamp("created_at").defaultNow().notNull(), // Account creation timestamp
  lastLoginAt: timestamp("last_login_at"), // Last successful login timestamp
  passwordResetToken: varchar("password_reset_token", { length: 255 }), // Password reset token for security
  passwordResetExpiresAt: timestamp("password_reset_expires_at"), // Reset token expiration timestamp
  failedLoginAttempts: integer("failed_login_attempts").default(0).notNull(), // Failed login counter for security
  lockedUntil: timestamp("locked_until"), // Temporary account lock expiration
  requirePasswordChange: boolean("require_password_change").default(false).notNull() // Force password change on next login
});

/**
 * EMPLOYEES TABLE - Core Entity
 * 
 * Central table storing comprehensive employee profiles for medical/healthcare professionals.
 * Designed to meet regulatory compliance requirements and support credential management.
 * Includes personal information, professional credentials, and regulatory system integrations.
 */
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(), // Auto-incrementing primary key
  
  // BASIC PERSONAL INFORMATION
  firstName: varchar("first_name", { length: 50 }).notNull(), // Legal first name
  middleName: varchar("middle_name", { length: 50 }), // Optional middle name
  lastName: varchar("last_name", { length: 50 }).notNull(), // Legal last name
  dateOfBirth: date("date_of_birth"), // Birth date for age verification and compliance
  
  // CONTACT INFORMATION
  personalEmail: varchar("personal_email", { length: 100 }).unique(), // Personal email (optional)
  workEmail: varchar("work_email", { length: 100 }).unique().notNull(), // Primary work email (required)
  cellPhone: varchar("cell_phone", { length: 20 }), // Mobile phone number
  workPhone: varchar("work_phone", { length: 20 }), // Work/office phone number
  
  // HOME ADDRESS INFORMATION
  homeAddress1: varchar("home_address1", { length: 100 }), // Primary address line
  homeAddress2: varchar("home_address2", { length: 100 }), // Secondary address line (apt, suite, etc.)
  homeCity: varchar("home_city", { length: 50 }), // City of residence
  homeState: varchar("home_state", { length: 50 }), // State/province of residence
  homeZip: varchar("home_zip", { length: 10 }), // ZIP/postal code
  
  // DEMOGRAPHIC INFORMATION
  gender: varchar("gender", { length: 20 }), // Gender identity for HR records
  birthCity: varchar("birth_city", { length: 50 }), // Birth city (for background checks)
  birthState: varchar("birth_state", { length: 50 }), // Birth state (for background checks)
  birthCountry: varchar("birth_country", { length: 50 }), // Birth country (for citizenship verification)
  
  // DRIVER'S LICENSE INFORMATION (Required for many medical positions)
  driversLicenseNumber: varchar("drivers_license_number", { length: 50 }), // DL number
  dlStateIssued: varchar("dl_state_issued", { length: 50 }), // Issuing state
  dlIssueDate: date("dl_issue_date"), // Issue date
  dlExpirationDate: date("dl_expiration_date"), // Expiration date (tracked for compliance)
  
  // SENSITIVE IDENTIFICATION (Encrypted fields)
  ssn: varchar("ssn", { length: 255 }), // Social Security Number (AES-256 encrypted)
  
  // NATIONAL PROVIDER IDENTIFIER (NPI) - CMS requirement for healthcare providers
  npiNumber: varchar("npi_number", { length: 20 }).unique(), // Unique NPI from NPPES
  enumerationDate: date("enumeration_date"), // Date NPI was issued
  
  // EMPLOYMENT INFORMATION
  jobTitle: varchar("job_title", { length: 100 }), // Current position/title
  workLocation: varchar("work_location", { length: 100 }), // Primary work location/facility
  qualification: text("qualification"), // Professional qualifications and specialties
  // Department/discipline classification used by credentials step
  departments: varchar("departments", { length: 100 }),
  
  // MEDICAL LICENSING INFORMATION
  medicalLicenseNumber: varchar("medical_license_number", { length: 50 }), // State medical license
  substanceUseLicenseNumber: varchar("substance_use_license_number", { length: 50 }), // Substance abuse counseling license
  substanceUseQualification: text("substance_use_qualification"), // Substance abuse treatment qualifications
  mentalHealthLicenseNumber: varchar("mental_health_license_number", { length: 50 }), // Mental health license
  mentalHealthQualification: text("mental_health_qualification"), // Mental health specializations
  // Additional license metadata captured in credentials form
  medicalLicenseState: varchar("medical_license_state", { length: 50 }),
  medicalLicenseIssueDate: date("medical_license_issue_date"),
  medicalLicenseExpirationDate: date("medical_license_expiration_date"),
  medicalLicenseStatus: varchar("medical_license_status", { length: 50 }),

  substanceUseLicenseState: varchar("substance_use_license_state", { length: 50 }),
  substanceUseLicenseIssueDate: date("substance_use_license_issue_date"),
  substanceUseLicenseExpirationDate: date("substance_use_license_expiration_date"),
  substanceUseLicenseStatus: varchar("substance_use_license_status", { length: 50 }),

  mentalHealthLicenseState: varchar("mental_health_license_state", { length: 50 }),
  mentalHealthLicenseIssueDate: date("mental_health_license_issue_date"),
  mentalHealthLicenseExpirationDate: date("mental_health_license_expiration_date"),
  mentalHealthLicenseStatus: varchar("mental_health_license_status", { length: 50 }),

  // DEA tracking when applicable to selected medical qualifications
  deaNumber: varchar("dea_number", { length: 50 }),
  // Granular medical qualification separate from general qualification field
  medicalQualification: varchar("medical_qualification", { length: 100 }),
  
  // PAYER/BILLING IDENTIFIERS
  medicaidNumber: varchar("medicaid_number", { length: 50 }), // State Medicaid provider number
  medicarePtanNumber: varchar("medicare_ptan_number", { length: 50 }), // Medicare PTAN number
  
  // CAQH (Council for Affordable Quality Healthcare) INTEGRATION
  // CAQH ProView is used for provider credentialing and enrollment
  caqhProviderId: varchar("caqh_provider_id", { length: 50 }), // CAQH Provider ID
  caqhIssueDate: date("caqh_issue_date"), // Date CAQH profile was created
  caqhLastAttestationDate: date("caqh_last_attestation_date"), // Last attestation date
  caqhEnabled: boolean("caqh_enabled").default(false), // Whether CAQH profile is active
  caqhReattestationDueDate: date("caqh_reattestation_due_date"), // Next attestation due date
  caqhLoginId: varchar("caqh_login_id", { length: 50 }), // CAQH login username
  caqhPassword: varchar("caqh_password", { length: 255 }), // CAQH password (AES-256 encrypted)
  
  // NPPES (National Plan and Provider Enumeration System) INTEGRATION
  // Used for NPI management and provider directory updates
  nppesLoginId: varchar("nppes_login_id", { length: 50 }), // NPPES login username
  nppesPassword: varchar("nppes_password", { length: 255 }), // NPPES password (AES-256 encrypted)
  
  // RECORD MANAGEMENT
  status: varchar("status", { length: 20 }).default("active"), // active | inactive | on_leave | terminated | onboarding
  applicationStatus: varchar("application_status", { length: 20 }).default("pending"), // pending | approved | rejected
  
  // ONBOARDING FIELDS
  onboardingStatus: varchar("onboarding_status", { length: 50 }), // invited | registered | in_progress | completed | approved
  invitationId: integer("invitation_id"), // Link to employee_invitations table
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }), // User account for self-service portal
  onboardingCompletedAt: timestamp("onboarding_completed_at"), // When employee completed their onboarding forms
  approvedAt: timestamp("approved_at"), // When HR approved the onboarding
  approvedBy: integer("approved_by").references(() => users.id, { onDelete: "set null" }), // HR user who approved
  
  createdAt: timestamp("created_at").defaultNow(), // Record creation timestamp
  updatedAt: timestamp("updated_at").defaultNow() // Last modification timestamp
}, (table) => ({
  // Database indexes for performance optimization
  workEmailIdx: index("idx_employees_work_email").on(table.workEmail), // Fast email lookups
  dlExpirationIdx: index("idx_dl_expiration").on(table.dlExpirationDate), // Expiration tracking
  caqhReattestationIdx: index("idx_caqh_reattestation").on(table.caqhReattestationDueDate) // Compliance monitoring
}));

/**
 * EDUCATIONS TABLE
 * 
 * Tracks educational background and academic credentials for each employee.
 * Supports multiple education entries per employee to capture diverse academic histories.
 * Essential for credentialing and professional qualification verification.
 */
export const educations = pgTable("educations", {
  id: serial("id").primaryKey(), // Auto-incrementing primary key
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }), // Foreign key to employees
  educationType: varchar("education_type", { length: 50 }), // Type: undergraduate, graduate, continuing education, etc.
  schoolInstitution: varchar("school_institution", { length: 100 }), // Name of educational institution
  degree: varchar("degree", { length: 50 }), // Degree obtained (MD, RN, BSN, PhD, etc.)
  specialtyMajor: varchar("specialty_major", { length: 100 }), // Field of study or medical specialty
  startDate: date("start_date"), // Program start date
  endDate: date("end_date") // Graduation/completion date
});

/**
 * EMPLOYMENTS TABLE
 * 
 * Maintains complete employment history for background verification and credentialing.
 * Tracks previous positions, responsibilities, and employment gaps.
 * Critical for malpractice insurance and hospital privileging processes.
 */
export const employments = pgTable("employments", {
  id: serial("id").primaryKey(), // Auto-incrementing primary key
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }), // Foreign key to employees
  employer: varchar("employer", { length: 100 }), // Name of employing organization/hospital
  position: varchar("position", { length: 100 }), // Job title or position held
  startDate: date("start_date"), // Employment start date
  endDate: date("end_date"), // Employment end date (null for current position)
  description: text("description") // Job duties, responsibilities, and achievements
});

/**
 * PEER REFERENCES TABLE
 * 
 * Stores professional references from colleagues and supervisors.
 * Required for credentialing applications and employment verification.
 * Maintains contact information for reference validation during audits.
 */
export const peerReferences = pgTable("peer_references", {
  id: serial("id").primaryKey(), // Auto-incrementing primary key
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }), // Foreign key to employees
  referenceName: varchar("reference_name", { length: 100 }), // Full name of the reference person
  contactInfo: varchar("contact_info", { length: 100 }), // Phone number, email, or address
  relationship: varchar("relationship", { length: 100 }), // Professional relationship (supervisor, colleague, etc.)
  comments: text("comments") // Additional notes about the reference
});

/**
 * STATE LICENSES TABLE
 * 
 * Manages state-issued professional licenses (medical, nursing, etc.).
 * Critical for regulatory compliance and practice authorization.
 * Monitored for expiration to ensure continuous licensure.
 */
export const stateLicenses = pgTable("state_licenses", {
  id: serial("id").primaryKey(), // Auto-incrementing primary key
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }), // Foreign key to employees
  licenseNumber: varchar("license_number", { length: 50 }).notNull(), // State-issued license number
  state: varchar("state", { length: 50 }).notNull(), // Issuing state (e.g., "CA", "NY", "TX")
  issueDate: date("issue_date"), // Date license was first issued
  expirationDate: date("expiration_date"), // License expiration date (compliance critical)
  status: varchar("status", { length: 50 }) // active | expired | suspended | pending_renewal
}, (table) => ({
  expirationIdx: index("idx_state_licenses_expiration").on(table.expirationDate) // Fast expiration queries
}));

/**
 * DEA LICENSES TABLE
 * 
 * Tracks Drug Enforcement Administration licenses for controlled substance prescribing.
 * Required for providers who prescribe controlled medications (Schedule II-V).
 * Subject to strict federal regulations and expiration monitoring.
 */
export const deaLicenses = pgTable("dea_licenses", {
  id: serial("id").primaryKey(), // Auto-incrementing primary key
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }), // Foreign key to employees
  licenseNumber: varchar("license_number", { length: 50 }).notNull(), // DEA registration number (e.g., "AB1234567")
  issueDate: date("issue_date"), // DEA registration issue date
  expirationDate: date("expiration_date"), // Registration expiration (typically 3 years)
  status: varchar("status", { length: 50 }) // active | expired | suspended | surrendered
}, (table) => ({
  expirationIdx: index("idx_dea_licenses_expiration").on(table.expirationDate) // Federal compliance tracking
}));

/**
 * BOARD CERTIFICATIONS TABLE
 * 
 * Maintains specialty board certifications and professional credentials.
 * Demonstrates advanced training and competency in medical specialties.
 * Important for hospital privileging and insurance credentialing.
 */
export const boardCertifications = pgTable("board_certifications", {
  id: serial("id").primaryKey(), // Auto-incrementing primary key
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }), // Foreign key to employees
  boardName: varchar("board_name", { length: 100 }), // Certifying board (e.g., "American Board of Internal Medicine")
  certification: varchar("certification", { length: 100 }), // Specific certification (e.g., "Internal Medicine", "Cardiology")
  issueDate: date("issue_date"), // Certification award date
  expirationDate: date("expiration_date"), // Maintenance of certification (MOC) due date
  status: varchar("status", { length: 50 }) // active | expired | maintenance_required | lapsed
}, (table) => ({
  expirationIdx: index("idx_board_certifications_expiration").on(table.expirationDate) // MOC compliance tracking
}));

/**
 * DOCUMENTS TABLE
 * 
 * Manages uploaded documents and file attachments for employees.
 * Supports various document types (contracts, certifications, forms, etc.).
 * Integrates with file upload system for secure document storage.
 * Supports both local file system and Amazon S3 storage with seamless migration.
 */
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(), // Auto-incrementing primary key
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }), // Foreign key to employees
  documentType: varchar("document_type", { length: 100 }).notNull(), // Document category (contract, certificate, form, etc.)
  documentName: varchar("document_name", { length: 255 }), // Display name/title of document
  fileName: varchar("file_name", { length: 255 }), // Original uploaded file name
  filePath: varchar("file_path", { length: 255 }), // Legacy: Server file path for local files
  storageType: varchar("storage_type", { length: 10 }).default("local"), // Storage type: 'local' or 's3'
  storageKey: varchar("storage_key", { length: 500 }), // S3 key or local file path (longer for S3 keys)
  fileSize: integer("file_size"), // File size in bytes
  mimeType: varchar("mime_type", { length: 100 }), // MIME type (application/pdf, image/jpeg, etc.)
  signedDate: date("signed_date"), // Date document was signed or executed
  uploadedDate: date("uploaded_date").defaultNow(), // Date document was uploaded
  expirationDate: date("expiration_date"), // Document expiration date (if applicable)
  isVerified: boolean("is_verified").default(false), // Whether document has been verified
  verifiedBy: varchar("verified_by", { length: 100 }), // Who verified the document
  verificationDate: date("verification_date"), // When document was verified
  notes: text("notes"), // Additional notes or comments about the document
  s3Etag: varchar("s3_etag", { length: 255 }), // S3 ETag for integrity verification
  s3VersionId: varchar("s3_version_id", { length: 255 }), // S3 version ID if versioning is enabled
  createdAt: timestamp("created_at").defaultNow() // Upload timestamp
}, (table) => ({
  employeeIdx: index("idx_documents_employee").on(table.employeeId), // Index for employee document queries
  typeIdx: index("idx_documents_type").on(table.documentType), // Index for document type filtering
  expirationIdx: index("idx_documents_expiration").on(table.expirationDate), // Index for expiration tracking
  storageTypeIdx: index("idx_documents_storage_type").on(table.storageType) // Index for storage type filtering
}));

/**
 * EMPLOYEE INVITATIONS TABLE
 * 
 * Manages invitations sent by HR to prospective employees for self-service onboarding.
 * Tracks invitation status, access tokens, and reminder schedules.
 */
export const employeeInvitations = pgTable("employee_invitations", {
  id: serial("id").primaryKey(), // Auto-incrementing primary key
  
  // Invitee information
  firstName: varchar("first_name", { length: 50 }).notNull(), // Prospective employee's first name
  lastName: varchar("last_name", { length: 50 }).notNull(), // Prospective employee's last name
  email: varchar("email", { length: 100 }).notNull().unique(), // Invitation email (must be unique)
  cellPhone: varchar("cell_phone", { length: 20 }), // Contact phone number
  
  // Invitation details
  invitationToken: varchar("invitation_token", { length: 255 }).notNull().unique(), // Unique token for secure access
  invitedBy: integer("invited_by").references(() => users.id, { onDelete: "set null" }), // HR user who sent invitation
  invitedAt: timestamp("invited_at").defaultNow(), // When invitation was sent
  
  // Status tracking
  status: varchar("status", { length: 50 }).default("pending"), // pending | registered | in_progress | completed | expired
  registeredAt: timestamp("registered_at"), // When invitee created their account
  completedAt: timestamp("completed_at"), // When onboarding forms were completed
  expiresAt: timestamp("expires_at").notNull(), // Invitation expiration (default 7 days)
  
  // Role assignment
  intendedRole: varchar("intended_role", { length: 20 }).notNull().default("viewer"), // Role to assign on registration: admin | hr | viewer
  
  // Reminder tracking
  remindersSent: integer("reminders_sent").default(0), // Number of reminders sent
  lastReminderAt: timestamp("last_reminder_at"), // Last reminder timestamp
  nextReminderAt: timestamp("next_reminder_at"), // Next scheduled reminder
  
  // Linked employee record
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }), // Created employee record
  
  // DocuSeal Forms Integration
  requiredFormTemplates: text("required_form_templates").array(), // Array of template IDs required for onboarding
  
  // Metadata
  metadata: jsonb("metadata") // Additional data (IP address, user agent, etc.)
}, (table) => ({
  emailIdx: index("idx_invitations_email").on(table.email),
  tokenIdx: index("idx_invitations_token").on(table.invitationToken),
  statusIdx: index("idx_invitations_status").on(table.status),
  nextReminderIdx: index("idx_invitations_next_reminder").on(table.nextReminderAt)
}));

/**
 * SES CONFIGURATIONS TABLE
 * 
 * Stores AWS SES configuration for email notifications.
 * Supports database-managed credentials for secure email sending.
 */
export const sesConfigurations = pgTable("ses_configurations", {
  id: serial("id").primaryKey(), // Auto-incrementing primary key
  
  // AWS SES Configuration
  region: varchar("region", { length: 50 }).notNull().default("us-east-1"), // AWS region
  accessKeyId: varchar("access_key_id", { length: 255 }), // AWS Access Key ID (encrypted)
  secretAccessKey: varchar("secret_access_key", { length: 255 }), // AWS Secret Access Key (encrypted)
  fromEmail: varchar("from_email", { length: 100 }).notNull(), // Verified sender email
  fromName: varchar("from_name", { length: 100 }).default("HR Management System"), // Sender display name
  
  // Configuration status
  enabled: boolean("enabled").default(false), // Whether SES is enabled
  verified: boolean("verified").default(false), // Whether configuration is verified
  lastVerifiedAt: timestamp("last_verified_at"), // Last successful verification
  
  // Metadata
  updatedAt: timestamp("updated_at").defaultNow(), // Last update timestamp
  updatedBy: integer("updated_by").references(() => users.id) // Admin who updated configuration
});

/**
 * SESSION TABLE (managed by connect-pg-simple)
 *
 * Defining this prevents Drizzle Push from proposing to drop the existing
 * session table created by the session store. We do not use it directly, but
 * keeping it in the schema ensures non-destructive diffs.
 */
export const session = pgTable("session", {
  sid: varchar("sid", { length: 255 }).primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull()
}, (table) => ({
  expireIdx: index("idx_session_expire").on(table.expire)
}));

/**
 * EMAIL REMINDERS TABLE
 * 
 * Tracks all email reminders sent for invitation follow-ups.
 * Provides audit trail for email communications and delivery status.
 */
export const emailReminders = pgTable("email_reminders", {
  id: serial("id").primaryKey(), // Auto-incrementing primary key
  
  // Reference to invitation
  invitationId: integer("invitation_id").references(() => employeeInvitations.id, { onDelete: "cascade" }), // Related invitation
  
  // Email details
  recipientEmail: varchar("recipient_email", { length: 100 }).notNull(), // Recipient email address
  subject: varchar("subject", { length: 255 }).notNull(), // Email subject
  bodyText: text("body_text"), // Plain text body
  bodyHtml: text("body_html"), // HTML body
  
  // Send status
  status: varchar("status", { length: 50 }).default("pending"), // pending | sent | failed | bounced
  sentAt: timestamp("sent_at"), // When email was sent
  reminderNumber: integer("reminder_number").notNull(), // Which reminder this is (1, 2, or 3)
  
  // AWS SES response
  messageId: varchar("message_id", { length: 255 }), // SES message ID
  errorMessage: text("error_message"), // Error details if failed
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow() // Record creation time
}, (table) => ({
  invitationIdx: index("idx_email_reminders_invitation").on(table.invitationId),
  statusIdx: index("idx_email_reminders_status").on(table.status)
}));

/**
 * DOCUSEAL CONFIGURATIONS TABLE
 * 
 * Stores DocuSeal API configuration for form management and e-signatures.
 * Supports multiple environments with encrypted API keys for security.
 * Only one configuration can be enabled at a time.
 */
export const docusealConfigurations = pgTable("docuseal_configurations", {
  id: serial("id").primaryKey(), // Auto-incrementing primary key
  
  // API Configuration
  apiKey: varchar("api_key", { length: 500 }), // Encrypted DocuSeal API key
  environment: varchar("environment", { length: 50 }).default("production"), // production | sandbox
  baseUrl: varchar("base_url", { length: 255 }).default("https://api.docuseal.co"), // API base URL
  
  // Configuration settings
  enabled: boolean("enabled").default(false).notNull(), // Whether this configuration is active
  name: varchar("name", { length: 100 }), // Configuration name for identification
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(), // When configuration was created
  updatedAt: timestamp("updated_at").defaultNow(), // Last update time
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }), // User who last updated
  
  // Testing and validation
  lastTestAt: timestamp("last_test_at"), // When connection was last tested
  lastTestSuccess: boolean("last_test_success"), // Whether last test was successful
  lastTestError: text("last_test_error") // Error message from last test
}, (table) => ({
  enabledIdx: index("idx_docuseal_config_enabled").on(table.enabled)
}));

/**
 * DOCUSEAL TEMPLATES TABLE
 * 
 * Caches DocuSeal form templates for quick access and management.
 * Tracks which templates are required for employee onboarding.
 * Syncs with DocuSeal API to keep template information up to date.
 */
export const docusealTemplates = pgTable("docuseal_templates", {
  id: serial("id").primaryKey(), // Auto-incrementing primary key
  
  // Template identification
  templateId: varchar("template_id", { length: 100 }).notNull().unique(), // DocuSeal template UUID
  name: varchar("name", { length: 255 }).notNull(), // Template name
  description: text("description"), // Template description
  
  // Template settings
  enabled: boolean("enabled").default(true).notNull(), // Whether template is available for use
  requiredForOnboarding: boolean("required_for_onboarding").default(false).notNull(), // Must be completed during onboarding
  category: varchar("category", { length: 100 }), // Template category (tax, compliance, policy, etc.)
  
  // Template metadata from DocuSeal
  fields: jsonb("fields"), // Template field definitions
  signerRoles: jsonb("signer_roles"), // Required signer roles and their properties
  documentCount: integer("document_count"), // Number of documents in template
  
  // Sync tracking
  lastSyncedAt: timestamp("last_synced_at"), // When template was last synced from DocuSeal
  syncError: text("sync_error"), // Error message if sync failed
  
  // Display settings
  sortOrder: integer("sort_order").default(0), // Display order in UI
  tags: text("tags").array(), // Tags for filtering and organization
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(), // When template was added
  updatedAt: timestamp("updated_at").defaultNow() // Last update time
}, (table) => ({
  templateIdIdx: index("idx_docuseal_template_id").on(table.templateId),
  enabledIdx: index("idx_docuseal_template_enabled").on(table.enabled),
  onboardingIdx: index("idx_docuseal_template_onboarding").on(table.requiredForOnboarding),
  categoryIdx: index("idx_docuseal_template_category").on(table.category)
}));

/**
 * FORM SUBMISSIONS TABLE
 * 
 * Tracks form submissions sent to employees through DocuSeal.
 * Manages submission status, completion tracking, and document storage.
 * Links submissions to employees and templates for comprehensive tracking.
 */
export const formSubmissions = pgTable("form_submissions", {
  id: serial("id").primaryKey(), // Auto-incrementing primary key
  
  // Submission identification
  submissionId: varchar("submission_id", { length: 100 }).notNull().unique(), // DocuSeal submission UUID
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(), // Employee who needs to complete
  templateId: integer("template_id").references(() => docusealTemplates.id, { onDelete: "restrict" }).notNull(), // Template used
  
  // Recipient information
  recipientEmail: varchar("recipient_email", { length: 100 }).notNull(), // Email where form was sent
  recipientName: varchar("recipient_name", { length: 100 }), // Name of recipient
  recipientPhone: varchar("recipient_phone", { length: 20 }), // Phone number for SMS notifications
  
  // Submission status
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending | sent | opened | in_progress | completed | expired | cancelled
  sentAt: timestamp("sent_at"), // When form was sent to recipient
  openedAt: timestamp("opened_at"), // When recipient first opened form
  startedAt: timestamp("started_at"), // When recipient started filling form
  completedAt: timestamp("completed_at"), // When form was fully completed and signed
  expiresAt: timestamp("expires_at"), // Submission expiration date
  
  // Document tracking
  documentsUrl: text("documents_url"), // URL to download completed documents
  documentsDownloadedAt: timestamp("documents_downloaded_at"), // When documents were downloaded
  documentsStorageKey: varchar("documents_storage_key", { length: 255 }), // S3 key if stored
  
  // Submission metadata
  submissionData: jsonb("submission_data"), // Form field values submitted
  ipAddress: varchar("ip_address", { length: 45 }), // IP address of submitter
  userAgent: text("user_agent"), // Browser/device information
  
  // Reminder tracking
  remindersSent: integer("reminders_sent").default(0), // Number of reminders sent
  lastReminderAt: timestamp("last_reminder_at"), // When last reminder was sent
  nextReminderAt: timestamp("next_reminder_at"), // When next reminder should be sent
  
  // Onboarding integration
  isOnboardingRequirement: boolean("is_onboarding_requirement").default(false), // Part of onboarding process
  invitationId: integer("invitation_id").references(() => employeeInvitations.id, { onDelete: "set null" }), // Link to invitation if onboarding
  
  // Audit fields
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }), // HR user who initiated
  createdAt: timestamp("created_at").defaultNow(), // When submission was created
  updatedAt: timestamp("updated_at").defaultNow(), // Last update time
  
  // Notes and comments
  notes: text("notes") // Internal notes about submission
}, (table) => ({
  submissionIdIdx: index("idx_form_submission_id").on(table.submissionId),
  employeeIdx: index("idx_form_submission_employee").on(table.employeeId),
  templateIdx: index("idx_form_submission_template").on(table.templateId),
  statusIdx: index("idx_form_submission_status").on(table.status),
  onboardingIdx: index("idx_form_submission_onboarding").on(table.isOnboardingRequirement),
  invitationIdx: index("idx_form_submission_invitation").on(table.invitationId),
  expiresIdx: index("idx_form_submission_expires").on(table.expiresAt)
}));

/**
 * ONBOARDING FORM SUBMISSIONS TABLE
 * 
 * Tracks DocuSeal form submissions specifically for the onboarding process.
 * Links submissions to employees and templates for tracking completion status.
 * Manages the signing status and completion timestamps.
 */
export const onboardingFormSubmissions = pgTable("onboarding_form_submissions", {
  id: serial("id").primaryKey(), // Auto-incrementing primary key
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }), // Foreign key to employees (nullable for prospective)
  onboardingId: integer("onboarding_id"), // Onboarding process ID (nullable)
  templateId: varchar("template_id", { length: 255 }).notNull(), // DocuSeal template ID
  submissionId: varchar("submission_id", { length: 255 }).notNull().unique(), // DocuSeal submission ID
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending | sent | opened | completed
  signedAt: timestamp("signed_at"), // When form was signed
  signerEmail: varchar("signer_email", { length: 255 }).notNull(), // Email of the signer
  createdAt: timestamp("created_at").defaultNow().notNull() // Record creation timestamp
}, (table) => ({
  submissionIdIdx: index("idx_onboarding_submission_id").on(table.submissionId),
  employeeIdx: index("idx_onboarding_submission_employee").on(table.employeeId),
  templateIdx: index("idx_onboarding_submission_template").on(table.templateId),
  statusIdx: index("idx_onboarding_submission_status").on(table.status),
  onboardingIdx: index("idx_onboarding_submission_onboarding").on(table.onboardingId)
}));

/**
 * EMERGENCY CONTACTS TABLE
 * 
 * Stores emergency contact information for each employee.
 * Critical for workplace safety and incident response procedures.
 * Required by most employment policies and insurance requirements.
 */
export const emergencyContacts = pgTable("emergency_contacts", {
  id: serial("id").primaryKey(), // Auto-incrementing primary key
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }), // Foreign key to employees
  name: varchar("name", { length: 100 }).notNull(), // Full name of emergency contact
  relationship: varchar("relationship", { length: 50 }), // Relationship to employee (spouse, parent, sibling, etc.)
  phone: varchar("phone", { length: 20 }), // Primary phone number for emergencies
  email: varchar("email", { length: 100 }) // Email address for non-urgent communications
});

/**
 * TAX FORMS TABLE
 * 
 * Manages tax-related documents and forms (W-2, W-4, 1099, etc.).
 * Ensures compliance with tax reporting requirements.
 * Tracks submission status and maintains audit trail.
 */
export const taxForms = pgTable("tax_forms", {
  id: serial("id").primaryKey(), // Auto-incrementing primary key
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }), // Foreign key to employees
  formType: varchar("form_type", { length: 50 }).notNull(), // Tax form type (W-2, W-4, 1099-MISC, etc.)
  filePath: varchar("file_path", { length: 255 }), // File storage path or URL
  submittedDate: date("submitted_date"), // Date form was submitted or completed
  status: varchar("status", { length: 50 }) // pending | completed | submitted | requires_update
});

/**
 * TRAININGS TABLE
 * 
 * Tracks continuing education units (CEUs) and professional training.
 * Essential for maintaining professional licenses and certifications.
 * Monitors training credits and renewal requirements.
 */
export const trainings = pgTable("trainings", {
  id: serial("id").primaryKey(), // Auto-incrementing primary key
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }), // Foreign key to employees
  trainingType: varchar("training_type", { length: 100 }), // Training category (CME, CEU, Safety, Compliance, etc.)
  provider: varchar("provider", { length: 100 }), // Organization or institution providing training
  completionDate: date("completion_date"), // Date training was completed
  expirationDate: date("expiration_date"), // Date when training credit expires
  credits: decimal("credits", { precision: 5, scale: 2 }), // Number of continuing education credits earned
  certificatePath: varchar("certificate_path", { length: 255 }) // Path to completion certificate file
}, (table) => ({
  expirationIdx: index("idx_trainings_expiration").on(table.expirationDate) // Training renewal monitoring
}));

/**
 * PAYER ENROLLMENTS TABLE
 * 
 * Tracks enrollment status with insurance payers and networks.
 * Manages provider participation in insurance plans and networks.
 * Critical for billing, reimbursement, and patient coverage verification.
 */
export const payerEnrollments = pgTable("payer_enrollments", {
  id: serial("id").primaryKey(), // Auto-incrementing primary key
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }), // Foreign key to employees
  payerName: varchar("payer_name", { length: 100 }), // Insurance company or payer name (e.g., "Blue Cross", "Aetna")
  enrollmentId: varchar("enrollment_id", { length: 50 }), // Provider enrollment ID with the payer
  enrollmentDate: date("enrollment_date"), // Date enrolled with the payer network
  effectiveDate: date("effective_date"), // Date when enrollment becomes effective
  terminationDate: date("termination_date"), // Date when enrollment terminates (if applicable)
  status: varchar("status", { length: 50 }) // active | pending | terminated | credentialing_required
});

/**
 * INCIDENT LOGS TABLE
 * 
 * Records workplace incidents, safety events, and disciplinary actions.
 * Maintains detailed incident history for risk management and compliance.
 * Essential for liability protection and performance management.
 */
export const incidentLogs = pgTable("incident_logs", {
  id: serial("id").primaryKey(), // Auto-incrementing primary key
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }), // Foreign key to employees
  incidentDate: date("incident_date").notNull(), // Date when incident occurred
  description: text("description"), // Detailed incident description and circumstances
  resolution: text("resolution"), // Actions taken to resolve or address the incident
  reportedBy: varchar("reported_by", { length: 50 }) // Name/ID of person reporting the incident
});

/**
 * AUDITS TABLE
 * 
 * Comprehensive audit logging system for all data changes.
 * Tracks who made changes, when, and what data was modified.
 * Essential for compliance, security, and change management.
 * Supports data recovery and forensic analysis.
 */
export const audits = pgTable("audits", {
  id: serial("id").primaryKey(), // Auto-incrementing primary key
  tableName: varchar("table_name", { length: 50 }).notNull(), // Name of table that was modified
  recordId: integer("record_id").notNull(), // Primary key of the modified record
  action: varchar("action", { length: 20 }).notNull(), // CREATE | UPDATE | DELETE
  changedBy: integer("changed_by").references(() => users.id), // User ID who made the change
  changedAt: timestamp("changed_at").defaultNow(), // Timestamp of the change
  oldData: jsonb("old_data"), // Previous values (JSON format for flexible storage)
  newData: jsonb("new_data") // New values (JSON format for flexible storage)
}, (table) => ({
  tableRecordIdx: index("idx_audits_table_record").on(table.tableName, table.recordId), // Fast record history lookup
  changedAtIdx: index("idx_audits_changed_at").on(table.changedAt) // Chronological audit queries
}));

/**
 * LOCATIONS TABLE
 * 
 * Hierarchical clinic locations supporting main organizations and sub-locations.
 * Enables multi-location compliance tracking and organizational structure management.
 * Supports parent-child relationships for complex organizational hierarchies.
 */
export const locations = pgTable("locations", {
  id: serial("id").primaryKey(), // Auto-incrementing primary key
  
  // Location identification
  name: varchar("name", { length: 255 }).notNull(), // Location name (e.g., "Main Clinic", "North Branch")
  code: varchar("code", { length: 50 }).unique(), // Unique location code/identifier
  type: varchar("type", { length: 50 }).notNull(), // main_org | sub_location | department | facility
  
  // Hierarchical structure
  parentId: integer("parent_id").references((): any => locations.id, { onDelete: "cascade" }), // Self-referencing for hierarchy
  level: integer("level").default(0).notNull(), // Hierarchy level (0 = root, 1 = first level, etc.)
  path: varchar("path", { length: 500 }), // Materialized path for efficient hierarchy queries
  
  // Location details
  address1: varchar("address1", { length: 200 }),
  address2: varchar("address2", { length: 200 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  zipCode: varchar("zip_code", { length: 20 }),
  country: varchar("country", { length: 100 }).default("USA"),
  phone: varchar("phone", { length: 30 }),
  fax: varchar("fax", { length: 30 }),
  email: varchar("email", { length: 100 }),
  website: varchar("website", { length: 255 }),
  
  // Operational information
  taxId: varchar("tax_id", { length: 50 }), // Federal Tax ID / EIN
  npiNumber: varchar("npi_number", { length: 20 }), // Organization NPI if applicable
  status: varchar("status", { length: 50 }).default("active").notNull(), // active | inactive | suspended | closed
  openedDate: date("opened_date"), // When location opened
  closedDate: date("closed_date"), // When location closed (if applicable)
  
  // Compliance tracking
  isComplianceRequired: boolean("is_compliance_required").default(true).notNull(), // Whether location needs compliance tracking
  complianceNotes: text("compliance_notes"), // Special compliance requirements or notes
  
  // Extensibility
  customFields: jsonb("custom_fields"), // Flexible field for location-specific data
  metadata: jsonb("metadata"), // Additional metadata (operating hours, specialties, etc.)
  
  // Audit fields
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" })
}, (table) => ({
  parentIdx: index("idx_locations_parent").on(table.parentId),
  statusIdx: index("idx_locations_status").on(table.status),
  pathIdx: index("idx_locations_path").on(table.path),
  codeIdx: index("idx_locations_code").on(table.code)
}));

/**
 * LICENSE TYPES TABLE
 * 
 * Defines types of licenses that clinics must maintain for compliance.
 * Serves as a master list of all possible license types across the organization.
 * Supports custom requirements and renewal cycles per license type.
 */
export const licenseTypes = pgTable("license_types", {
  id: serial("id").primaryKey(), // Auto-incrementing primary key
  
  // License type identification
  name: varchar("name", { length: 200 }).notNull().unique(), // License type name (e.g., "Medical License", "DEA Registration")
  code: varchar("code", { length: 50 }).unique().notNull(), // Unique code (e.g., "MED_LIC", "DEA_REG")
  category: varchar("category", { length: 100 }).notNull(), // Category: medical | pharmacy | facility | business | other
  
  // License requirements
  description: text("description"), // Detailed description of license type
  issuingAuthority: varchar("issuing_authority", { length: 200 }), // Who issues this license (e.g., "State Medical Board")
  renewalPeriodMonths: integer("renewal_period_months"), // Standard renewal period in months
  leadTimeDays: integer("lead_time_days").default(90), // Days before expiration to start renewal
  
  // Applicability
  appliesToLocation: boolean("applies_to_location").default(false).notNull(), // License for locations
  appliesToProvider: boolean("applies_to_provider").default(false).notNull(), // License for individual providers
  appliesToEquipment: boolean("applies_to_equipment").default(false).notNull(), // License for equipment
  
  // Requirements and documentation
  requiredDocuments: text("required_documents").array(), // List of required supporting documents
  requiresInspection: boolean("requires_inspection").default(false), // Whether inspection is required
  requiresTraining: boolean("requires_training").default(false), // Whether training/certification is required
  
  // Compliance tracking
  isCritical: boolean("is_critical").default(false).notNull(), // Critical for operations (requires immediate action)
  alertDaysBefore: integer("alert_days_before").default(60), // Days before expiration to alert
  escalationDaysBefore: integer("escalation_days_before").default(30), // Days before expiration to escalate
  
  // Status and configuration
  isActive: boolean("is_active").default(true).notNull(), // Whether this license type is currently active
  sortOrder: integer("sort_order").default(0), // Display order in UI
  
  // Extensibility
  validationRules: jsonb("validation_rules"), // Custom validation rules for this license type
  additionalData: jsonb("additional_data"), // Flexible field for type-specific requirements
  
  // Audit fields
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  categoryIdx: index("idx_license_types_category").on(table.category),
  activeIdx: index("idx_license_types_active").on(table.isActive),
  codeIdx: index("idx_license_types_code").on(table.code)
}));

/**
 * RESPONSIBLE PERSONS TABLE
 * 
 * Manages individuals responsible for license compliance and renewals.
 * Can link to existing employees or track external responsible parties.
 * Supports delegation and backup responsibilities for continuity.
 */
export const responsiblePersons = pgTable("responsible_persons", {
  id: serial("id").primaryKey(), // Auto-incrementing primary key
  
  // Person identification
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }), // Link to employee if internal
  
  // External person details (if not an employee)
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  title: varchar("title", { length: 100 }),
  email: varchar("email", { length: 150 }).notNull(),
  phone: varchar("phone", { length: 30 }),
  
  // Responsibility details
  isPrimary: boolean("is_primary").default(true).notNull(), // Primary responsible person
  isBackup: boolean("is_backup").default(false).notNull(), // Backup/secondary responsible
  department: varchar("department", { length: 100 }),
  
  // Contact preferences
  preferredContactMethod: varchar("preferred_contact_method", { length: 50 }).default("email"), // email | phone | sms
  notificationEnabled: boolean("notification_enabled").default(true).notNull(),
  reminderFrequency: varchar("reminder_frequency", { length: 50 }).default("weekly"), // daily | weekly | monthly
  
  // Access and permissions
  canApprove: boolean("can_approve").default(false), // Can approve license renewals
  canSubmit: boolean("can_submit").default(true), // Can submit renewal applications
  
  // Status
  status: varchar("status", { length: 50 }).default("active").notNull(), // active | inactive | on_leave
  startDate: date("start_date"), // When responsibility started
  endDate: date("end_date"), // When responsibility ended
  
  // Notes and metadata
  notes: text("notes"),
  additionalData: jsonb("additional_data"), // Flexible field for additional information
  
  // Audit fields
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  employeeIdx: index("idx_responsible_persons_employee").on(table.employeeId),
  emailIdx: index("idx_responsible_persons_email").on(table.email),
  statusIdx: index("idx_responsible_persons_status").on(table.status)
}));

/**
 * CLINIC LICENSES TABLE
 * 
 * Tracks actual licenses held by clinic locations.
 * Central table for compliance monitoring and renewal management.
 * Integrates with document storage for license certificates and supporting documents.
 */
export const clinicLicenses = pgTable("clinic_licenses", {
  id: serial("id").primaryKey(), // Auto-incrementing primary key
  
  // License identification
  locationId: integer("location_id").references(() => locations.id, { onDelete: "cascade" }).notNull(), // Which location holds this license
  licenseTypeId: integer("license_type_id").references(() => licenseTypes.id, { onDelete: "restrict" }).notNull(), // Type of license
  licenseNumber: varchar("license_number", { length: 100 }).notNull(), // Official license number
  
  // Responsible parties
  primaryResponsibleId: integer("primary_responsible_id").references(() => responsiblePersons.id, { onDelete: "set null" }), // Primary responsible person
  backupResponsibleId: integer("backup_responsible_id").references(() => responsiblePersons.id, { onDelete: "set null" }), // Backup responsible person
  
  // License validity
  issueDate: date("issue_date").notNull(), // When license was issued
  expirationDate: date("expiration_date").notNull(), // When license expires
  renewalDate: date("renewal_date"), // When renewal application was submitted
  
  // Status tracking
  status: varchar("status", { length: 50 }).default("active").notNull(), // active | expiring_soon | expired | suspended | revoked | pending_renewal
  renewalStatus: varchar("renewal_status", { length: 50 }), // not_started | in_progress | submitted | approved | rejected
  complianceStatus: varchar("compliance_status", { length: 50 }).default("compliant").notNull(), // compliant | warning | non_compliant
  
  // Issuing authority
  issuingAuthority: varchar("issuing_authority", { length: 200 }),
  issuingState: varchar("issuing_state", { length: 50 }),
  
  // Cost tracking
  initialCost: decimal("initial_cost", { precision: 10, scale: 2 }),
  renewalCost: decimal("renewal_cost", { precision: 10, scale: 2 }),
  lastPaymentDate: date("last_payment_date"),
  nextPaymentDue: date("next_payment_due"),
  
  // Inspection and compliance
  lastInspectionDate: date("last_inspection_date"),
  nextInspectionDue: date("next_inspection_due"),
  inspectionResult: varchar("inspection_result", { length: 50 }), // passed | failed | conditional | pending
  
  // Notes and documentation
  notes: text("notes"),
  complianceNotes: text("compliance_notes"),
  renewalNotes: text("renewal_notes"),
  
  // Alert tracking
  lastAlertSent: timestamp("last_alert_sent"),
  alertsSuppressed: boolean("alerts_suppressed").default(false),
  suppressionReason: text("suppression_reason"),
  
  // Extensibility
  customFields: jsonb("custom_fields"), // License-specific custom data
  metadata: jsonb("metadata"), // Additional metadata
  
  // Audit fields
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" })
}, (table) => ({
  locationIdx: index("idx_clinic_licenses_location").on(table.locationId),
  licenseTypeIdx: index("idx_clinic_licenses_type").on(table.licenseTypeId),
  expirationIdx: index("idx_clinic_licenses_expiration").on(table.expirationDate),
  statusIdx: index("idx_clinic_licenses_status").on(table.status),
  complianceIdx: index("idx_clinic_licenses_compliance").on(table.complianceStatus),
  licenseNumberIdx: index("idx_clinic_licenses_number").on(table.licenseNumber)
}));

/**
 * COMPLIANCE DOCUMENTS TABLE
 * 
 * Stores documents related to clinic licenses and compliance.
 * Integrates with S3 for secure document storage.
 * Maintains version history and audit trail for regulatory requirements.
 */
export const complianceDocuments = pgTable("compliance_documents", {
  id: serial("id").primaryKey(), // Auto-incrementing primary key
  
  // Document association
  clinicLicenseId: integer("clinic_license_id").references(() => clinicLicenses.id, { onDelete: "cascade" }).notNull(), // Which license this document relates to
  locationId: integer("location_id").references(() => locations.id, { onDelete: "cascade" }), // Optional direct location link
  
  // Document identification
  documentType: varchar("document_type", { length: 100 }).notNull(), // license_certificate | renewal_application | inspection_report | sop | policy | other
  documentName: varchar("document_name", { length: 255 }).notNull(), // Display name
  documentNumber: varchar("document_number", { length: 100 }), // Official document number if applicable
  
  // File storage (S3)
  storageType: varchar("storage_type", { length: 10 }).default("s3").notNull(), // Storage type (primarily s3)
  storageKey: varchar("storage_key", { length: 500 }).notNull(), // S3 key for document
  fileName: varchar("file_name", { length: 255 }), // Original file name
  fileSize: integer("file_size"), // File size in bytes
  mimeType: varchar("mime_type", { length: 100 }), // MIME type
  
  // S3 specific fields
  s3Bucket: varchar("s3_bucket", { length: 255 }), // S3 bucket name
  s3Region: varchar("s3_region", { length: 50 }), // S3 region
  s3Etag: varchar("s3_etag", { length: 255 }), // S3 ETag for integrity
  s3VersionId: varchar("s3_version_id", { length: 255 }), // S3 version ID if versioning enabled
  
  // Document validity
  effectiveDate: date("effective_date"), // When document becomes effective
  expirationDate: date("expiration_date"), // When document expires
  isCurrentVersion: boolean("is_current_version").default(true).notNull(), // Whether this is the current version
  versionNumber: integer("version_number").default(1), // Version number
  previousVersionId: integer("previous_version_id").references((): any => complianceDocuments.id), // Link to previous version
  
  // Verification and approval
  isVerified: boolean("is_verified").default(false),
  verifiedBy: integer("verified_by").references(() => users.id, { onDelete: "set null" }),
  verifiedAt: timestamp("verified_at"),
  verificationNotes: text("verification_notes"),
  
  // Compliance tracking
  isRequired: boolean("is_required").default(false), // Whether this document is required for compliance
  complianceCategory: varchar("compliance_category", { length: 100 }), // Compliance category
  regulatoryReference: varchar("regulatory_reference", { length: 200 }), // Regulatory requirement reference
  
  // Document status
  status: varchar("status", { length: 50 }).default("active").notNull(), // active | archived | superseded | draft | pending_approval
  
  // Access control
  confidentialityLevel: varchar("confidentiality_level", { length: 50 }).default("internal"), // public | internal | confidential | restricted
  accessNotes: text("access_notes"),
  
  // Notes and metadata
  description: text("description"),
  notes: text("notes"),
  tags: text("tags").array(), // Tags for categorization
  metadata: jsonb("metadata"), // Additional metadata
  
  // Audit fields
  uploadedBy: integer("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  lastAccessedAt: timestamp("last_accessed_at"),
  lastModifiedBy: integer("last_modified_by").references(() => users.id, { onDelete: "set null" }),
  lastModifiedAt: timestamp("last_modified_at")
}, (table) => ({
  licenseIdx: index("idx_compliance_docs_license").on(table.clinicLicenseId),
  locationIdx: index("idx_compliance_docs_location").on(table.locationId),
  typeIdx: index("idx_compliance_docs_type").on(table.documentType),
  expirationIdx: index("idx_compliance_docs_expiration").on(table.expirationDate),
  statusIdx: index("idx_compliance_docs_status").on(table.status),
  versionIdx: index("idx_compliance_docs_version").on(table.isCurrentVersion),
  storageKeyIdx: index("idx_compliance_docs_storage_key").on(table.storageKey)
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  audits: many(audits)
}));

export const employeesRelations = relations(employees, ({ many }) => ({
  educations: many(educations),
  employments: many(employments),
  peerReferences: many(peerReferences),
  stateLicenses: many(stateLicenses),
  deaLicenses: many(deaLicenses),
  boardCertifications: many(boardCertifications),
  documents: many(documents),
  emergencyContacts: many(emergencyContacts),
  taxForms: many(taxForms),
  trainings: many(trainings),
  payerEnrollments: many(payerEnrollments),
  incidentLogs: many(incidentLogs)
}));

export const educationsRelations = relations(educations, ({ one }) => ({
  employee: one(employees, { fields: [educations.employeeId], references: [employees.id] })
}));

export const employmentsRelations = relations(employments, ({ one }) => ({
  employee: one(employees, { fields: [employments.employeeId], references: [employees.id] })
}));

export const peerReferencesRelations = relations(peerReferences, ({ one }) => ({
  employee: one(employees, { fields: [peerReferences.employeeId], references: [employees.id] })
}));

export const stateLicensesRelations = relations(stateLicenses, ({ one }) => ({
  employee: one(employees, { fields: [stateLicenses.employeeId], references: [employees.id] })
}));

export const deaLicensesRelations = relations(deaLicenses, ({ one }) => ({
  employee: one(employees, { fields: [deaLicenses.employeeId], references: [employees.id] })
}));

export const boardCertificationsRelations = relations(boardCertifications, ({ one }) => ({
  employee: one(employees, { fields: [boardCertifications.employeeId], references: [employees.id] })
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  employee: one(employees, { fields: [documents.employeeId], references: [employees.id] })
}));

export const emergencyContactsRelations = relations(emergencyContacts, ({ one }) => ({
  employee: one(employees, { fields: [emergencyContacts.employeeId], references: [employees.id] })
}));

export const taxFormsRelations = relations(taxForms, ({ one }) => ({
  employee: one(employees, { fields: [taxForms.employeeId], references: [employees.id] })
}));

export const trainingsRelations = relations(trainings, ({ one }) => ({
  employee: one(employees, { fields: [trainings.employeeId], references: [employees.id] })
}));

export const payerEnrollmentsRelations = relations(payerEnrollments, ({ one }) => ({
  employee: one(employees, { fields: [payerEnrollments.employeeId], references: [employees.id] })
}));

export const incidentLogsRelations = relations(incidentLogs, ({ one }) => ({
  employee: one(employees, { fields: [incidentLogs.employeeId], references: [employees.id] })
}));

export const auditsRelations = relations(audits, ({ one }) => ({
  user: one(users, { fields: [audits.changedBy], references: [users.id] })
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  passwordHash: true,
  role: true,
  status: true,
  email: true,
  lastLoginAt: true,
  passwordResetToken: true,
  passwordResetExpiresAt: true,
  failedLoginAttempts: true,
  lockedUntil: true
}).partial({
  status: true,
  email: true,
  lastLoginAt: true,
  passwordResetToken: true,
  passwordResetExpiresAt: true,
  failedLoginAttempts: true,
  lockedUntil: true
});

export const insertEmployeeSchema = createInsertSchema(employees, {
  dateOfBirth: z.coerce.date().nullable().optional(),
  dlIssueDate: z.coerce.date().nullable().optional(),
  dlExpirationDate: z.coerce.date().nullable().optional(),
  enumerationDate: z.coerce.date().nullable().optional(),
  caqhIssueDate: z.coerce.date().nullable().optional(),
  caqhLastAttestationDate: z.coerce.date().nullable().optional(),
  caqhReattestationDueDate: z.coerce.date().nullable().optional(),
  medicalLicenseIssueDate: z.coerce.date().nullable().optional(),
  medicalLicenseExpirationDate: z.coerce.date().nullable().optional(),
  substanceUseLicenseIssueDate: z.coerce.date().nullable().optional(),
  substanceUseLicenseExpirationDate: z.coerce.date().nullable().optional(),
  mentalHealthLicenseIssueDate: z.coerce.date().nullable().optional(),
  mentalHealthLicenseExpirationDate: z.coerce.date().nullable().optional(),
  onboardingCompletedAt: z.coerce.date().nullable().optional(),
  approvedAt: z.coerce.date().nullable().optional()
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true
}).refine((data) => {
  if (data.dlExpirationDate && data.dlIssueDate) {
    return new Date(data.dlExpirationDate) >= new Date(data.dlIssueDate);
  }
  return true; // Allow if either date is missing
}, { message: "Driver's license expiration date cannot be before issue date", path: ["dlExpirationDate"] });

export const insertEducationSchema = createInsertSchema(educations, {
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional()
}).omit({ id: true }).refine((data) => {
  if (data.endDate && data.startDate) {
    return new Date(data.endDate) >= new Date(data.startDate);
  }
  return true; // Allow if either date is missing
}, { message: "End date cannot be before start date", path: ["endDate"] });
export const insertEmploymentSchema = createInsertSchema(employments, {
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional()
}).omit({ id: true }).refine((data) => {
  if (data.endDate && data.startDate) {
    return new Date(data.endDate) >= new Date(data.startDate);
  }
  return true; // Allow if either date is missing
}, { message: "End date cannot be before start date", path: ["endDate"] });
export const insertPeerReferenceSchema = createInsertSchema(peerReferences).omit({ id: true });
export const insertStateLicenseSchema = createInsertSchema(stateLicenses, {
  issueDate: z.coerce.date().nullable().optional(),
  expirationDate: z.coerce.date().nullable().optional(),
  state: z.string().max(2).regex(/^[A-Z]{2}$/).optional().or(z.literal("")).transform(val => val || null)
}).omit({ id: true }).refine((data) => {
  if (data.expirationDate && data.issueDate) {
    return new Date(data.expirationDate) >= new Date(data.issueDate);
  }
  return true; // Allow if either date is missing
}, { message: "Expiration date cannot be before issue date", path: ["expirationDate"] });
export const insertDeaLicenseSchema = createInsertSchema(deaLicenses, {
  issueDate: z.coerce.date().nullable().optional(),
  expirationDate: z.coerce.date().nullable().optional(),
  state: z.string().max(2).regex(/^[A-Z]{2}$/).optional().or(z.literal("")).transform(val => val || null)
}).omit({ id: true }).refine((data) => {
  if (data.expirationDate && data.issueDate) {
    return new Date(data.expirationDate) >= new Date(data.issueDate);
  }
  return true; // Allow if either date is missing
}, { message: "Expiration date cannot be before issue date", path: ["expirationDate"] });
export const insertBoardCertificationSchema = createInsertSchema(boardCertifications, {
  issueDate: z.coerce.date().nullable().optional(),
  expirationDate: z.coerce.date().nullable().optional()
}).omit({ id: true }).refine((data) => {
  if (data.expirationDate && data.issueDate) {
    return new Date(data.expirationDate) >= new Date(data.issueDate);
  }
  return true; // Allow if either date is missing
}, { message: "Expiration date cannot be before issue date", path: ["expirationDate"] });
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true });
export const insertEmergencyContactSchema = createInsertSchema(emergencyContacts).omit({ id: true });
export const insertTaxFormSchema = createInsertSchema(taxForms).omit({ id: true });
export const insertTrainingSchema = createInsertSchema(trainings, {
  completionDate: z.coerce.date().nullable().optional(),
  expirationDate: z.coerce.date().nullable().optional()
}).omit({ id: true }).refine((data) => {
  if (data.expirationDate && data.completionDate) {
    return new Date(data.expirationDate) >= new Date(data.completionDate);
  }
  return true; // Allow if either date is missing
}, { message: "Expiration date cannot be before completion date", path: ["expirationDate"] });
export const insertPayerEnrollmentSchema = createInsertSchema(payerEnrollments, {
  effectiveDate: z.coerce.date().nullable().optional(),
  terminationDate: z.coerce.date().nullable().optional()
}).omit({ id: true }).refine((data) => {
  if (data.terminationDate && data.effectiveDate) {
    return new Date(data.terminationDate) >= new Date(data.effectiveDate);
  }
  return true; // Allow if either date is missing
}, { message: "Termination date cannot be before effective date", path: ["terminationDate"] });
export const insertIncidentLogSchema = createInsertSchema(incidentLogs).omit({ id: true });
export const insertAuditSchema = createInsertSchema(audits).omit({ id: true, changedAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Education = typeof educations.$inferSelect;
export type InsertEducation = z.infer<typeof insertEducationSchema>;
export type Employment = typeof employments.$inferSelect;
export type InsertEmployment = z.infer<typeof insertEmploymentSchema>;
export type PeerReference = typeof peerReferences.$inferSelect;
export type InsertPeerReference = z.infer<typeof insertPeerReferenceSchema>;
export type StateLicense = typeof stateLicenses.$inferSelect;
export type InsertStateLicense = z.infer<typeof insertStateLicenseSchema>;
export type DeaLicense = typeof deaLicenses.$inferSelect;
export type InsertDeaLicense = z.infer<typeof insertDeaLicenseSchema>;
export type BoardCertification = typeof boardCertifications.$inferSelect;
export type InsertBoardCertification = z.infer<typeof insertBoardCertificationSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type EmergencyContact = typeof emergencyContacts.$inferSelect;
export type InsertEmergencyContact = z.infer<typeof insertEmergencyContactSchema>;
export type TaxForm = typeof taxForms.$inferSelect;
export type InsertTaxForm = z.infer<typeof insertTaxFormSchema>;
export type Training = typeof trainings.$inferSelect;
export type InsertTraining = z.infer<typeof insertTrainingSchema>;
export type PayerEnrollment = typeof payerEnrollments.$inferSelect;
export type InsertPayerEnrollment = z.infer<typeof insertPayerEnrollmentSchema>;
export type IncidentLog = typeof incidentLogs.$inferSelect;
export type InsertIncidentLog = z.infer<typeof insertIncidentLogSchema>;
export type Audit = typeof audits.$inferSelect;
export type InsertAudit = z.infer<typeof insertAuditSchema>;

/**
 * S3_CONFIGURATION TABLE
 * 
 * Stores AWS S3 configuration settings for document storage.
 * Sensitive fields (accessKeyId, secretAccessKey) are encrypted at rest.
 * Only admin users can view and modify this configuration.
 * Supports secure migration from environment variables to database storage.
 */
export const s3Configuration = pgTable("s3_configuration", {
  id: serial("id").primaryKey(), // Auto-incrementing primary key
  accessKeyId: text("access_key_id"), // AWS Access Key ID (AES-256 encrypted)
  secretAccessKey: text("secret_access_key"), // AWS Secret Access Key (AES-256 encrypted) 
  region: varchar("region", { length: 50 }), // AWS region (e.g., us-east-1)
  bucketName: varchar("bucket_name", { length: 100 }), // S3 bucket name
  endpoint: varchar("endpoint", { length: 255 }), // Optional S3-compatible endpoint
  enabled: boolean("enabled").default(true), // Whether S3 storage is enabled
  updatedAt: timestamp("updated_at").defaultNow(), // Last update timestamp
  updatedBy: integer("updated_by").references(() => users.id) // User who last updated
});

/**
 * API KEYS TABLE
 * 
 * Manages API keys for external application authentication.
 * Provides secure token-based access as an alternative to session authentication.
 * Supports key rotation, permission scopes, and usage tracking for security.
 */
export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(), // Auto-incrementing primary key
  name: varchar("name", { length: 100 }).notNull(), // Friendly name for the API key
  keyHash: varchar("key_hash", { length: 255 }).notNull(), // Hashed version of the API key (bcrypt)
  keyPrefix: varchar("key_prefix", { length: 16 }).notNull().unique(), // First 16 chars of key for identification (unique for collision prevention)
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(), // Owner of the API key
  permissions: text("permissions").array().notNull().default(sql`'{}'::text[]`), // Array of allowed endpoints/scopes
  lastUsedAt: timestamp("last_used_at"), // Track last usage timestamp
  expiresAt: timestamp("expires_at").notNull(), // Key expiration date
  createdAt: timestamp("created_at").defaultNow().notNull(), // Key creation timestamp
  revokedAt: timestamp("revoked_at"), // Soft delete timestamp (null if active)
  environment: varchar("environment", { length: 20 }).notNull().default("live"), // live or test
  rateLimitPerHour: integer("rate_limit_per_hour").default(1000), // Per-key rate limiting
  metadata: jsonb("metadata") // Additional metadata (IP restrictions, etc.)
}, (table) => ({
  userIdx: index("idx_api_keys_user").on(table.userId),
  keyPrefixIdx: index("idx_api_keys_prefix").on(table.keyPrefix),
  expiresAtIdx: index("idx_api_keys_expires").on(table.expiresAt),
  revokedAtIdx: index("idx_api_keys_revoked").on(table.revokedAt)
}));

/**
 * API KEY ROTATIONS TABLE
 * 
 * Tracks API key rotation history for security auditing.
 * Maintains a log of all key rotations including automatic and manual rotations.
 * Supports grace periods where both old and new keys can work temporarily.
 */
export const apiKeyRotations = pgTable("api_key_rotations", {
  id: serial("id").primaryKey(), // Auto-incrementing primary key
  apiKeyId: integer("api_key_id").references(() => apiKeys.id, { onDelete: "cascade" }).notNull(), // Original API key
  oldKeyId: integer("old_key_id").references(() => apiKeys.id), // Previous key ID (for rotation chain)
  newKeyId: integer("new_key_id").references(() => apiKeys.id), // New key ID after rotation
  rotationType: varchar("rotation_type", { length: 20 }).notNull(), // manual | automatic | emergency
  rotatedAt: timestamp("rotated_at").defaultNow().notNull(), // When rotation occurred
  rotatedBy: integer("rotated_by").references(() => users.id), // User who initiated rotation
  gracePeriodEnds: timestamp("grace_period_ends"), // When old key stops working
  reason: text("reason") // Reason for rotation
});

// Add relations for API keys
export const apiKeysRelations = relations(apiKeys, ({ one, many }) => ({
  user: one(users, { fields: [apiKeys.userId], references: [users.id] }),
  rotations: many(apiKeyRotations)
}));

export const apiKeyRotationsRelations = relations(apiKeyRotations, ({ one }) => ({
  apiKey: one(apiKeys, { fields: [apiKeyRotations.apiKeyId], references: [apiKeys.id] }),
  oldKey: one(apiKeys, { fields: [apiKeyRotations.oldKeyId], references: [apiKeys.id] }),
  newKey: one(apiKeys, { fields: [apiKeyRotations.newKeyId], references: [apiKeys.id] }),
  rotatedByUser: one(users, { fields: [apiKeyRotations.rotatedBy], references: [users.id] })
}));

// Update users relations to include API keys
export const usersRelationsUpdated = relations(users, ({ many }) => ({
  audits: many(audits),
  apiKeys: many(apiKeys),
  apiKeyRotations: many(apiKeyRotations)
}));

// Insert schemas for API keys
export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
  revokedAt: true
}).extend({
  permissions: z.array(z.string()).default([]),
  metadata: z.object({
    allowedIps: z.array(z.string()).optional(),
    description: z.string().optional()
  }).optional()
});

export const insertApiKeyRotationSchema = createInsertSchema(apiKeyRotations).omit({
  id: true,
  rotatedAt: true
});

// Insert schema for S3 configuration
export const insertS3ConfigurationSchema = createInsertSchema(s3Configuration).omit({
  id: true,
  updatedAt: true
});

// Types for S3 configuration
export type S3Configuration = typeof s3Configuration.$inferSelect;
export type InsertS3Configuration = z.infer<typeof insertS3ConfigurationSchema>;

// Types for API keys
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKeyRotation = typeof apiKeyRotations.$inferSelect;
export type InsertApiKeyRotation = z.infer<typeof insertApiKeyRotationSchema>;

// Insert schemas for employee invitations
export const insertEmployeeInvitationSchema = createInsertSchema(employeeInvitations).omit({
  id: true,
  invitedAt: true,
  remindersSent: true,
  lastReminderAt: true,
  nextReminderAt: true,
  registeredAt: true,
  completedAt: true,
  employeeId: true
});

// Insert schema for SES configurations
export const insertSesConfigurationSchema = createInsertSchema(sesConfigurations).omit({
  id: true,
  updatedAt: true,
  lastVerifiedAt: true,
  verified: true
});

// Insert schema for email reminders
export const insertEmailReminderSchema = createInsertSchema(emailReminders).omit({
  id: true,
  createdAt: true,
  sentAt: true,
  messageId: true,
  errorMessage: true
});

// Types for employee invitations
export type EmployeeInvitation = typeof employeeInvitations.$inferSelect;
export type InsertEmployeeInvitation = z.infer<typeof insertEmployeeInvitationSchema>;

// Types for SES configuration
export type SesConfiguration = typeof sesConfigurations.$inferSelect;
export type InsertSesConfiguration = z.infer<typeof insertSesConfigurationSchema>;

// Types for email reminders
export type EmailReminder = typeof emailReminders.$inferSelect;
export type InsertEmailReminder = z.infer<typeof insertEmailReminderSchema>;

// Insert schemas for DocuSeal
export const insertDocusealConfigurationSchema = createInsertSchema(docusealConfigurations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastTestAt: true,
  lastTestSuccess: true,
  lastTestError: true
});

export const insertDocusealTemplateSchema = createInsertSchema(docusealTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSyncedAt: true,
  syncError: true
});

export const insertFormSubmissionSchema = createInsertSchema(formSubmissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  sentAt: true,
  openedAt: true,
  startedAt: true,
  completedAt: true,
  documentsDownloadedAt: true,
  lastReminderAt: true,
  nextReminderAt: true
});

// Insert schemas for new DocuSeal tables
export const insertOnboardingFormSubmissionSchema = createInsertSchema(onboardingFormSubmissions).omit({
  id: true,
  createdAt: true,
  signedAt: true
});

// Types for DocuSeal
export type DocusealConfiguration = typeof docusealConfigurations.$inferSelect;
export type InsertDocusealConfiguration = z.infer<typeof insertDocusealConfigurationSchema>;
export type DocusealTemplate = typeof docusealTemplates.$inferSelect;
export type InsertDocusealTemplate = z.infer<typeof insertDocusealTemplateSchema>;
export type FormSubmission = typeof formSubmissions.$inferSelect;
export type InsertFormSubmission = z.infer<typeof insertFormSubmissionSchema>;
export type OnboardingFormSubmission = typeof onboardingFormSubmissions.$inferSelect;
export type InsertOnboardingFormSubmission = z.infer<typeof insertOnboardingFormSubmissionSchema>;

/**
 * REQUIRED DOCUMENT TYPES TABLE
 * 
 * Defines the types of documents required for employee onboarding and compliance.
 * Supports categorization and ordering of document requirements.
 * Used to ensure all necessary documentation is collected during onboarding.
 */
export const requiredDocumentTypes = pgTable("required_document_types", {
  id: serial("id").primaryKey(), // Auto-incrementing primary key
  name: varchar("name", { length: 100 }).notNull(), // Document type name (e.g., "W-4 Form", "I-9 Form")
  description: text("description"), // Optional description of the document
  isRequired: boolean("is_required").default(true).notNull(), // Whether document is mandatory
  category: varchar("category", { length: 50 }).notNull(), // Category: tax, compliance, payroll, identification
  sortOrder: integer("sort_order").default(0).notNull(), // Display order for UI
  createdAt: timestamp("created_at").defaultNow().notNull(), // Record creation timestamp
  updatedAt: timestamp("updated_at").defaultNow().notNull() // Last update timestamp
}, (table) => ({
  sortOrderIdx: index("idx_required_doc_types_sort").on(table.sortOrder),
  categoryIdx: index("idx_required_doc_types_category").on(table.category)
}));

/**
 * EMPLOYEE DOCUMENT UPLOADS TABLE
 * 
 * Tracks documents uploaded by employees during onboarding or employment.
 * Links uploaded files to document types and maintains approval workflow.
 * Essential for document management and compliance verification.
 */
export const employeeDocumentUploads = pgTable("employee_document_uploads", {
  id: serial("id").primaryKey(), // Auto-incrementing primary key
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(), // Foreign key to employees
  documentTypeId: integer("document_type_id").references(() => requiredDocumentTypes.id, { onDelete: "set null" }), // Foreign key to document types (nullable for custom docs)
  fileName: varchar("file_name", { length: 255 }).notNull(), // Original file name
  filePath: varchar("file_path", { length: 500 }).notNull(), // Storage path or S3 key
  fileSize: integer("file_size").notNull(), // File size in bytes
  mimeType: varchar("mime_type", { length: 100 }).notNull(), // MIME type of the file
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(), // Upload timestamp
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending | approved | rejected
  notes: text("notes") // Optional notes or rejection reason
}, (table) => ({
  employeeIdx: index("idx_doc_uploads_employee").on(table.employeeId),
  documentTypeIdx: index("idx_doc_uploads_type").on(table.documentTypeId),
  statusIdx: index("idx_doc_uploads_status").on(table.status),
  uploadedAtIdx: index("idx_doc_uploads_uploaded").on(table.uploadedAt)
}));

/**
 * EMPLOYEE APPROVAL CHECKLISTS TABLE
 * 
 * Stores approval checklist data for employees during the approval process.
 * Tracks yes/no selections for various onboarding requirements including
 * training completion, background checks, and system setup items.
 */
export const employeeApprovalChecklists = pgTable("employee_approval_checklists", {
  id: serial("id").primaryKey(), // Auto-incrementing primary key
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull().unique(), // Foreign key to employees (one per employee)
  
  // Optional Training Fields
  cpiTraining: varchar("cpi_training", { length: 3 }).default("no").notNull(), // yes | no
  cprTraining: varchar("cpr_training", { length: 3 }).default("no").notNull(), // yes | no
  crisisPrevention: varchar("crisis_prevention", { length: 3 }).default("no").notNull(), // yes | no
  
  // Required Background Checks & Screenings
  federalExclusions: varchar("federal_exclusions", { length: 3 }).default("no").notNull(), // yes | no
  stateExclusions: varchar("state_exclusions", { length: 3 }).default("no").notNull(), // yes | no
  samGovExclusion: varchar("sam_gov_exclusion", { length: 3 }).default("no").notNull(), // yes | no
  urineDrugScreen: varchar("urine_drug_screen", { length: 3 }).default("no").notNull(), // yes | no
  bciFbiCheck: varchar("bci_fbi_check", { length: 3 }).default("no").notNull(), // yes | no
  
  // Equipment & System Setup
  laptopSetup: varchar("laptop_setup", { length: 3 }).default("no").notNull(), // yes | no
  emailSetup: varchar("email_setup", { length: 3 }).default("no").notNull(), // yes | no
  emrSetup: varchar("emr_setup", { length: 3 }).default("no").notNull(), // yes | no
  phoneSetup: varchar("phone_setup", { length: 3 }).default("no").notNull(), // yes | no
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(), // Record creation timestamp
  updatedAt: timestamp("updated_at").defaultNow().notNull(), // Last update timestamp
  createdBy: integer("created_by").references(() => users.id), // User who created the checklist
  updatedBy: integer("updated_by").references(() => users.id) // User who last updated the checklist
}, (table) => ({
  employeeIdx: index("idx_approval_checklist_employee").on(table.employeeId)
}));

// =====================
// COMPLIANCE TRACKING SCHEMAS
// =====================

// Insert schemas for locations
export const insertLocationSchema = createInsertSchema(locations).omit({
  id: true,
  createdAt: true,
  updatedAt: true
}).extend({
  type: z.enum(["main_org", "sub_location", "department", "facility"]),
  status: z.enum(["active", "inactive", "suspended", "closed"]).default("active"),
  customFields: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional()
});

// Insert schemas for license types
export const insertLicenseTypeSchema = createInsertSchema(licenseTypes).omit({
  id: true,
  createdAt: true,
  updatedAt: true
}).extend({
  category: z.enum(["medical", "pharmacy", "facility", "business", "other"]),
  requiredDocuments: z.array(z.string()).optional(),
  validationRules: z.record(z.any()).optional(),
  additionalData: z.record(z.any()).optional()
});

// Insert schemas for responsible persons
export const insertResponsiblePersonSchema = createInsertSchema(responsiblePersons).omit({
  id: true,
  createdAt: true,
  updatedAt: true
}).extend({
  preferredContactMethod: z.enum(["email", "phone", "sms"]).default("email"),
  reminderFrequency: z.enum(["daily", "weekly", "monthly"]).default("weekly"),
  status: z.enum(["active", "inactive", "on_leave"]).default("active"),
  additionalData: z.record(z.any()).optional()
}).refine((data) => {
  if (data.endDate && data.startDate) {
    return new Date(data.endDate) >= new Date(data.startDate);
  }
  return true; // Allow if either date is missing
}, { message: "End date cannot be before start date", path: ["endDate"] });

// Insert schemas for clinic licenses  
export const insertClinicLicenseSchema = createInsertSchema(clinicLicenses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastAlertSent: true
}).extend({
  status: z.enum(["active", "expiring_soon", "expired", "suspended", "revoked", "pending_renewal"]).default("active"),
  renewalStatus: z.enum(["not_started", "in_progress", "submitted", "approved", "rejected"]).optional(),
  complianceStatus: z.enum(["compliant", "warning", "non_compliant"]).default("compliant"),
  inspectionResult: z.enum(["passed", "failed", "conditional", "pending"]).optional(),
  customFields: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional()
}).refine((data) => {
  if (data.expirationDate && data.issueDate) {
    return new Date(data.expirationDate) >= new Date(data.issueDate);
  }
  return true; // Allow if either date is missing
}, { message: "Expiration date cannot be before issue date", path: ["expirationDate"] });

// Insert schemas for compliance documents
export const insertComplianceDocumentSchema = createInsertSchema(complianceDocuments).omit({
  id: true,
  uploadedAt: true,
  lastAccessedAt: true,
  lastModifiedAt: true,
  verifiedAt: true
}).extend({
  documentType: z.enum(["license_certificate", "renewal_application", "inspection_report", "sop", "policy", "other"]),
  storageType: z.enum(["s3", "local"]).default("s3"),
  status: z.enum(["active", "archived", "superseded", "draft", "pending_approval"]).default("active"),
  confidentialityLevel: z.enum(["public", "internal", "confidential", "restricted"]).default("internal"),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
}).refine((data) => {
  if (data.expirationDate && data.effectiveDate) {
    return new Date(data.expirationDate) >= new Date(data.effectiveDate);
  }
  return true; // Allow if either date is missing
}, { message: "Expiration date cannot be before effective date", path: ["expirationDate"] });

// Types for locations
export type Location = typeof locations.$inferSelect;
export type InsertLocation = z.infer<typeof insertLocationSchema>;

// Types for license types
export type LicenseType = typeof licenseTypes.$inferSelect;
export type InsertLicenseType = z.infer<typeof insertLicenseTypeSchema>;

// Types for responsible persons
export type ResponsiblePerson = typeof responsiblePersons.$inferSelect;
export type InsertResponsiblePerson = z.infer<typeof insertResponsiblePersonSchema>;

// Types for clinic licenses
export type ClinicLicense = typeof clinicLicenses.$inferSelect;
export type InsertClinicLicense = z.infer<typeof insertClinicLicenseSchema>;

// Types for compliance documents
export type ComplianceDocument = typeof complianceDocuments.$inferSelect;
export type InsertComplianceDocument = z.infer<typeof insertComplianceDocumentSchema>;

// Insert schemas for required document types
export const insertRequiredDocumentTypeSchema = createInsertSchema(requiredDocumentTypes).omit({
  id: true,
  createdAt: true,
  updatedAt: true
}).extend({
  category: z.enum(["tax", "compliance", "payroll", "identification", "other"]),
  isRequired: z.boolean().default(true),
  sortOrder: z.number().int().default(0)
});

// Insert schemas for employee document uploads
export const insertEmployeeDocumentUploadSchema = createInsertSchema(employeeDocumentUploads).omit({
  id: true,
  uploadedAt: true
}).extend({
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
  fileSize: z.number().int().positive(),
  notes: z.string().optional()
});

// Types for required document types
export type RequiredDocumentType = typeof requiredDocumentTypes.$inferSelect;
export type InsertRequiredDocumentType = z.infer<typeof insertRequiredDocumentTypeSchema>;

// Types for employee document uploads
export type EmployeeDocumentUpload = typeof employeeDocumentUploads.$inferSelect;
export type InsertEmployeeDocumentUpload = z.infer<typeof insertEmployeeDocumentUploadSchema>;

// Insert schemas for employee approval checklists
export const insertEmployeeApprovalChecklistSchema = createInsertSchema(employeeApprovalChecklists).omit({
  id: true,
  createdAt: true,
  updatedAt: true
}).extend({
  cpiTraining: z.enum(["yes", "no"]).default("no"),
  cprTraining: z.enum(["yes", "no"]).default("no"),
  crisisPrevention: z.enum(["yes", "no"]).default("no"),
  federalExclusions: z.enum(["yes", "no"]).default("no"),
  stateExclusions: z.enum(["yes", "no"]).default("no"),
  samGovExclusion: z.enum(["yes", "no"]).default("no"),
  urineDrugScreen: z.enum(["yes", "no"]).default("no"),
  bciFbiCheck: z.enum(["yes", "no"]).default("no"),
  laptopSetup: z.enum(["yes", "no"]).default("no"),
  emailSetup: z.enum(["yes", "no"]).default("no"),
  emrSetup: z.enum(["yes", "no"]).default("no"),
  phoneSetup: z.enum(["yes", "no"]).default("no")
});

// Types for employee approval checklists
export type EmployeeApprovalChecklist = typeof employeeApprovalChecklists.$inferSelect;
export type InsertEmployeeApprovalChecklist = z.infer<typeof insertEmployeeApprovalChecklistSchema>;
