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
 * - 'hr': Standard HR staff with full employee management access
 * - 'admin': System administrators with elevated privileges
 * - 'viewer': Read-only access for reporting and viewing
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(), // Auto-incrementing primary key
  username: varchar("username", { length: 50 }).unique().notNull(), // Unique login identifier
  passwordHash: varchar("password_hash", { length: 255 }).notNull(), // Scrypt-hashed password with salt
  role: varchar("role", { length: 20 }).notNull().default("hr"), // User role for RBAC
  createdAt: timestamp("created_at").defaultNow() // Account creation timestamp
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
  ssn: varchar("ssn", { length: 20 }), // Social Security Number (AES-256 encrypted)
  
  // NATIONAL PROVIDER IDENTIFIER (NPI) - CMS requirement for healthcare providers
  npiNumber: varchar("npi_number", { length: 20 }).unique(), // Unique NPI from NPPES
  enumerationDate: date("enumeration_date"), // Date NPI was issued
  
  // EMPLOYMENT INFORMATION
  jobTitle: varchar("job_title", { length: 100 }), // Current position/title
  workLocation: varchar("work_location", { length: 100 }), // Primary work location/facility
  qualification: text("qualification"), // Professional qualifications and specialties
  
  // MEDICAL LICENSING INFORMATION
  medicalLicenseNumber: varchar("medical_license_number", { length: 50 }), // State medical license
  substanceUseLicenseNumber: varchar("substance_use_license_number", { length: 50 }), // Substance abuse counseling license
  substanceUseQualification: text("substance_use_qualification"), // Substance abuse treatment qualifications
  mentalHealthLicenseNumber: varchar("mental_health_license_number", { length: 50 }), // Mental health license
  mentalHealthQualification: text("mental_health_qualification"), // Mental health specializations
  
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
  caqhPassword: varchar("caqh_password", { length: 100 }), // CAQH password (AES-256 encrypted)
  
  // NPPES (National Plan and Provider Enumeration System) INTEGRATION
  // Used for NPI management and provider directory updates
  nppesLoginId: varchar("nppes_login_id", { length: 50 }), // NPPES login username
  nppesPassword: varchar("nppes_password", { length: 100 }), // NPPES password (AES-256 encrypted)
  
  // RECORD MANAGEMENT
  status: varchar("status", { length: 20 }).default("active"), // active | inactive | on_leave | terminated
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
  role: true
});

export const insertEmployeeSchema = createInsertSchema(employees).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertEducationSchema = createInsertSchema(educations).omit({ id: true });
export const insertEmploymentSchema = createInsertSchema(employments).omit({ id: true });
export const insertPeerReferenceSchema = createInsertSchema(peerReferences).omit({ id: true });
export const insertStateLicenseSchema = createInsertSchema(stateLicenses).omit({ id: true });
export const insertDeaLicenseSchema = createInsertSchema(deaLicenses).omit({ id: true });
export const insertBoardCertificationSchema = createInsertSchema(boardCertifications).omit({ id: true });
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true });
export const insertEmergencyContactSchema = createInsertSchema(emergencyContacts).omit({ id: true });
export const insertTaxFormSchema = createInsertSchema(taxForms).omit({ id: true });
export const insertTrainingSchema = createInsertSchema(trainings).omit({ id: true });
export const insertPayerEnrollmentSchema = createInsertSchema(payerEnrollments).omit({ id: true });
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
  permissions: jsonb("permissions").notNull().default([]), // Array of allowed endpoints/scopes
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

// Types for API keys
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKeyRotation = typeof apiKeyRotations.$inferSelect;
export type InsertApiKeyRotation = z.infer<typeof insertApiKeyRotationSchema>;
