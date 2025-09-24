/**
 * @fileoverview Database Storage Interface and Implementation
 * 
 * This module provides a comprehensive storage layer for the HR management system.
 * It implements all CRUD operations for employees and their related entities using
 * Drizzle ORM with PostgreSQL. The interface supports both in-memory storage (for testing)
 * and production database storage.
 * 
 * @module storage
 * @requires @shared/schema
 * @requires drizzle-orm
 * @requires express-session
 */

import { 
  users, 
  employees, 
  educations,
  employments,
  peerReferences,
  stateLicenses,
  deaLicenses,
  boardCertifications,
  documents,
  complianceDocuments,
  locations,
  licenseTypes,
  responsiblePersons,
  clinicLicenses,
  emergencyContacts,
  taxForms,
  trainings,
  payerEnrollments,
  incidentLogs,
  audits,
  apiKeys,
  apiKeyRotations,
  s3Configuration,
  employeeInvitations,
  emailReminders,
  sesConfigurations,
  docusealConfigurations,
  docusealTemplates,
  formSubmissions,
  type User, 
  type InsertUser,
  type Employee,
  type InsertEmployee,
  type Education,
  type InsertEducation,
  type Employment,
  type InsertEmployment,
  type PeerReference,
  type InsertPeerReference,
  type StateLicense,
  type InsertStateLicense,
  type DeaLicense,
  type InsertDeaLicense,
  type BoardCertification,
  type InsertBoardCertification,
  type Document,
  type InsertDocument,
  type EmergencyContact,
  type InsertEmergencyContact,
  type TaxForm,
  type InsertTaxForm,
  type Training,
  type InsertTraining,
  type PayerEnrollment,
  type InsertPayerEnrollment,
  type IncidentLog,
  type InsertIncidentLog,
  type Audit,
  type InsertAudit,
  type ApiKey,
  type InsertApiKey,
  type ApiKeyRotation,
  type InsertApiKeyRotation,
  type S3Configuration,
  type InsertS3Configuration,
  type EmployeeInvitation,
  type InsertEmployeeInvitation,
  type EmailReminder,
  type InsertEmailReminder,
  type SesConfiguration,
  type InsertSesConfiguration,
  type DocusealConfiguration,
  type InsertDocusealConfiguration,
  type DocusealTemplate,
  type InsertDocusealTemplate,
  type FormSubmission,
  type InsertFormSubmission,
  type ComplianceDocument,
  type InsertComplianceDocument,
  type Location,
  type InsertLocation,
  type LicenseType,
  type InsertLicenseType,
  type ResponsiblePerson,
  type InsertResponsiblePerson,
  type ClinicLicense,
  type InsertClinicLicense
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, like, and, or, lte, sql, count } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";

/**
 * PostgreSQL session store for Express sessions
 * Used to persist user sessions in the database
 */
const PostgresSessionStore = connectPg(session);

/**
 * Storage Interface for HR Management System
 * 
 * @interface IStorage
 * @description Defines the contract for all storage operations in the HR system.
 * This interface abstracts the database layer and supports multiple implementations
 * (PostgreSQL via Drizzle ORM for production, in-memory for testing).
 * 
 * All methods return Promises and handle data validation internally.
 * Sensitive data encryption/decryption is handled at the route layer.
 */
export interface IStorage {
  /**
   * User Authentication & Management Operations
   */
  
  /**
   * Retrieve a user by their ID
   * @param {number} id - User's unique identifier
   * @returns {Promise<User | undefined>} User object or undefined if not found
   */
  getUser(id: number): Promise<User | undefined>;
  
  /**
   * Retrieve a user by their username (for authentication)
   * @param {string} username - User's unique username
   * @returns {Promise<User | undefined>} User object with hashed password or undefined
   */
  getUserByUsername(username: string): Promise<User | undefined>;
  
  /**
   * Create a new user account
   * @param {InsertUser} user - User data including username, passwordHash, and role
   * @returns {Promise<User>} Newly created user object
   */
  createUser(user: InsertUser): Promise<User>;
  
  /**
   * Update an existing user account
   * @param {number} id - User ID to update
   * @param {Partial<InsertUser>} updates - Partial user data for updates
   * @returns {Promise<User>} Updated user object
   */
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User>;
  
  /**
   * Retrieve a user by their email address
   * @param {string} email - User's email address
   * @returns {Promise<User | undefined>} User object or undefined if not found
   */
  getUserByEmail(email: string): Promise<User | undefined>;
  
  /**
   * Update user status (active, suspended, locked, disabled)
   * @param {number} id - User ID
   * @param {string} status - New status value
   * @returns {Promise<User>} Updated user object
   */
  updateUserStatus(id: number, status: string): Promise<User>;
  
  /**
   * Get users by status for admin management
   * @param {string} status - Status to filter by
   * @returns {Promise<User[]>} Array of users with the specified status
   */
  getUsersByStatus(status: string): Promise<User[]>;
  
  /**
   * Update password reset token and expiration
   * @param {number} id - User ID
   * @param {string} token - Password reset token
   * @param {Date} expiresAt - Token expiration date
   * @returns {Promise<User>} Updated user object
   */
  updatePasswordResetToken(id: number, token: string, expiresAt: Date): Promise<User>;
  
  /**
   * Retrieve user by password reset token
   * @param {string} token - Password reset token
   * @returns {Promise<User | undefined>} User object or undefined if token not found/expired
   */
  getUserByPasswordResetToken(token: string): Promise<User | undefined>;
  
  /**
   * Clear password reset token after successful reset
   * @param {number} id - User ID
   * @returns {Promise<User>} Updated user object
   */
  clearPasswordResetToken(id: number): Promise<User>;
  
  /**
   * Increment failed login attempts counter
   * @param {number} id - User ID
   * @returns {Promise<User>} Updated user object
   */
  incrementFailedLoginAttempts(id: number): Promise<User>;
  
  /**
   * Reset failed login attempts counter (after successful login)
   * @param {number} id - User ID
   * @returns {Promise<User>} Updated user object
   */
  resetFailedLoginAttempts(id: number): Promise<User>;
  
  /**
   * Lock user account until specified time
   * @param {number} id - User ID
   * @param {Date} lockedUntil - Lock expiration date
   * @returns {Promise<User>} Updated user object
   */
  lockUserUntil(id: number, lockedUntil: Date): Promise<User>;
  
  /**
   * Update last login timestamp
   * @param {number} id - User ID
   * @returns {Promise<User>} Updated user object
   */
  updateLastLoginAt(id: number): Promise<User>;
  
  /**
   * Get paginated list of all users with filtering
   * @param {object} [options] - Query options for filtering and pagination
   * @param {number} [options.limit=10] - Maximum number of users to return
   * @param {number} [options.offset=0] - Number of users to skip
   * @param {string} [options.search] - Search term for username or email
   * @param {string} [options.role] - Filter by role
   * @param {string} [options.status] - Filter by status
   * @returns {Promise<{users: User[]; total: number}>} Paginated user list with total count
   */
  getAllUsers(options?: {
    limit?: number;
    offset?: number;
    search?: string;
    role?: string;
    status?: string;
  }): Promise<{ users: User[]; total: number }>;
  
  /**
   * Delete user account (admin only, with business rules)
   * @param {number} id - User ID to delete
   * @returns {Promise<void>} Resolves when deletion is complete
   * @throws {Error} User not found or deletion not allowed
   */
  deleteUser(id: number): Promise<void>;
  
  /**
   * Employee Management Operations
   */
  
  /**
   * Retrieve employee by ID
   * @param {number} id - Employee's unique identifier
   * @returns {Promise<Employee | undefined>} Employee object or undefined if not found
   * @throws {Error} Database connection or query errors
   * @example
   * const employee = await storage.getEmployee(123);
   * if (employee) {
   *   console.log(`Found ${employee.firstName} ${employee.lastName}`);
   * }
   */
  getEmployee(id: number): Promise<Employee | undefined>;
  
  /**
   * Retrieve paginated list of employees with filtering
   * @param {object} [options] - Query options for filtering and pagination
   * @param {number} [options.limit=10] - Maximum number of employees to return
   * @param {number} [options.offset=0] - Number of employees to skip
   * @param {string} [options.search] - Search term for name, email, or ID
   * @param {string} [options.department] - Filter by department
   * @param {string} [options.status] - Filter by employment status
   * @param {string} [options.location] - Filter by work location
   * @returns {Promise<{employees: Employee[]; total: number}>} Paginated employee list with total count
   * @throws {Error} Database query errors or invalid pagination parameters
   * @example
   * const result = await storage.getEmployees({
   *   limit: 20,
   *   search: 'john',
   *   department: 'Nursing',
   *   status: 'active'
   * });
   * console.log(`Found ${result.total} employees, showing ${result.employees.length}`);
   */
  getEmployees(options?: {
    limit?: number;
    offset?: number;
    search?: string;
    department?: string;
    status?: string;
    location?: string;
  }): Promise<{ employees: Employee[]; total: number }>;
  
  /**
   * Retrieve employee by work email address
   * @param {string} workEmail - Employee's work email address
   * @returns {Promise<Employee | undefined>} Employee object or undefined if not found
   * @throws {Error} Database query errors
   * @example
   * const employee = await storage.getEmployeeByWorkEmail('john.doe@hospital.com');
   * if (employee) {
   *   console.log(`Found employee: ${employee.firstName} ${employee.lastName}`);
   * }
   */
  getEmployeeByWorkEmail(workEmail: string): Promise<Employee | undefined>;

  /**
   * Create a new employee record
   * @param {InsertEmployee} employee - Employee data for creation
   * @returns {Promise<Employee>} Newly created employee with generated ID
   * @throws {Error} Validation errors, constraint violations, or database errors
   * @example
   * const newEmployee = await storage.createEmployee({
   *   firstName: 'Jane',
   *   lastName: 'Smith',
   *   workEmail: 'jane.smith@hospital.com',
   *   department: 'Emergency Medicine',
   *   status: 'active'
   * });
   */
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  
  /**
   * Update existing employee record
   * @param {number} id - Employee ID to update
   * @param {Partial<InsertEmployee>} employee - Partial employee data for updates
   * @returns {Promise<Employee>} Updated employee object
   * @throws {Error} Employee not found, validation errors, or database errors
   * @example
   * const updated = await storage.updateEmployee(123, {
   *   department: 'Cardiology',
   *   status: 'active'
   * });
   */
  updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee>;
  
  /**
   * Delete employee record and all related data
   * @param {number} id - Employee ID to delete
   * @returns {Promise<void>} Resolves when deletion is complete
   * @throws {Error} Employee not found, foreign key constraints, or database errors
   * @example
   * await storage.deleteEmployee(123);
   * console.log('Employee and all related records deleted');
   */
  deleteEmployee(id: number): Promise<void>;
  
  /**
   * Employee Education Management
   */
  
  /**
   * Get all education records for an employee
   * @param {number} employeeId - Employee's unique identifier
   * @returns {Promise<Education[]>} Array of education records
   * @throws {Error} Database errors or invalid employee ID
   * @example
   * const educations = await storage.getEmployeeEducations(123);
   * educations.forEach(edu => {
   *   console.log(`${edu.degree} from ${edu.schoolInstitution}`);
   * });
   */
  getEmployeeEducations(employeeId: number): Promise<Education[]>;
  
  /**
   * Create new education record for employee
   * @param {InsertEducation} education - Education data including employee ID
   * @returns {Promise<Education>} Created education record
   * @throws {Error} Validation errors or database constraints
   * @example
   * const education = await storage.createEducation({
   *   employeeId: 123,
   *   schoolInstitution: 'Johns Hopkins University',
   *   degree: 'MD',
   *   graduationYear: 2015
   * });
   */
  createEducation(education: InsertEducation): Promise<Education>;
  
  /**
   * Update existing education record
   * @param {number} id - Education record ID
   * @param {Partial<InsertEducation>} education - Partial education data
   * @returns {Promise<Education>} Updated education record
   * @throws {Error} Record not found or validation errors
   */
  updateEducation(id: number, education: Partial<InsertEducation>): Promise<Education>;
  
  /**
   * Delete education record
   * @param {number} id - Education record ID to delete
   * @returns {Promise<void>} Resolves when deletion is complete
   * @throws {Error} Record not found or database errors
   */
  deleteEducation(id: number): Promise<void>;
  
  /**
   * Employee Employment History Management
   */
  
  /**
   * Get employment history for an employee
   * @param {number} employeeId - Employee's unique identifier
   * @returns {Promise<Employment[]>} Array of employment records
   * @throws {Error} Database errors or invalid employee ID
   * @example
   * const employments = await storage.getEmployeeEmployments(123);
   * employments.forEach(emp => {
   *   console.log(`${emp.position} at ${emp.employer} (${emp.startDate} - ${emp.endDate || 'present'})`);
   * });
   */
  getEmployeeEmployments(employeeId: number): Promise<Employment[]>;
  
  /**
   * Create new employment record
   * @param {InsertEmployment} employment - Employment data
   * @returns {Promise<Employment>} Created employment record
   * @throws {Error} Validation errors or database constraints
   */
  createEmployment(employment: InsertEmployment): Promise<Employment>;
  
  /**
   * Update existing employment record
   * @param {number} id - Employment record ID
   * @param {Partial<InsertEmployment>} employment - Partial employment data
   * @returns {Promise<Employment>} Updated employment record
   * @throws {Error} Record not found or validation errors
   */
  updateEmployment(id: number, employment: Partial<InsertEmployment>): Promise<Employment>;
  
  /**
   * Delete employment record
   * @param {number} id - Employment record ID to delete
   * @returns {Promise<void>} Resolves when deletion is complete
   * @throws {Error} Record not found or database errors
   */
  deleteEmployment(id: number): Promise<void>;
  
  getEmployeePeerReferences(employeeId: number): Promise<PeerReference[]>;
  createPeerReference(reference: InsertPeerReference): Promise<PeerReference>;
  updatePeerReference(id: number, reference: Partial<InsertPeerReference>): Promise<PeerReference>;
  deletePeerReference(id: number): Promise<void>;
  
  /**
   * State Medical License Management
   */
  
  /**
   * Get all state medical licenses for an employee
   * @param {number} employeeId - Employee's unique identifier
   * @returns {Promise<StateLicense[]>} Array of state license records with expiration tracking
   * @throws {Error} Database errors or invalid employee ID
   * @example
   * const licenses = await storage.getEmployeeStateLicenses(123);
   * licenses.forEach(license => {
   *   console.log(`${license.state} License: ${license.licenseNumber} (expires: ${license.expirationDate})`);
   * });
   */
  getEmployeeStateLicenses(employeeId: number): Promise<StateLicense[]>;
  
  /**
   * Create new state medical license record
   * @param {InsertStateLicense} license - State license data with expiration tracking
   * @returns {Promise<StateLicense>} Created license record
   * @throws {Error} Validation errors, duplicate license numbers, or database constraints
   * @example
   * const license = await storage.createStateLicense({
   *   employeeId: 123,
   *   state: 'CA',
   *   licenseNumber: 'A12345',
   *   issueDate: new Date('2020-01-15'),
   *   expirationDate: new Date('2025-01-15')
   * });
   */
  createStateLicense(license: InsertStateLicense): Promise<StateLicense>;
  
  /**
   * Update state medical license record
   * @param {number} id - License record ID
   * @param {Partial<InsertStateLicense>} license - Partial license data for updates
   * @returns {Promise<StateLicense>} Updated license record
   * @throws {Error} Record not found, validation errors, or duplicate license numbers
   */
  updateStateLicense(id: number, license: Partial<InsertStateLicense>): Promise<StateLicense>;
  
  /**
   * Delete state medical license record
   * @param {number} id - License record ID to delete
   * @returns {Promise<void>} Resolves when deletion is complete
   * @throws {Error} Record not found or database errors
   */
  deleteStateLicense(id: number): Promise<void>;
  
  /**
   * DEA License Management (Controlled Substances)
   */
  
  /**
   * Get all DEA licenses for an employee
   * @param {number} employeeId - Employee's unique identifier
   * @returns {Promise<DeaLicense[]>} Array of DEA license records for controlled substance prescriptions
   * @throws {Error} Database errors or invalid employee ID
   * @example
   * const deaLicenses = await storage.getEmployeeDeaLicenses(123);
   * deaLicenses.forEach(dea => {
   *   console.log(`DEA: ${dea.licenseNumber} (expires: ${dea.expirationDate})`);
   * });
   */
  getEmployeeDeaLicenses(employeeId: number): Promise<DeaLicense[]>;
  
  /**
   * Create new DEA license record
   * @param {InsertDeaLicense} license - DEA license data for controlled substance authorization
   * @returns {Promise<DeaLicense>} Created DEA license record
   * @throws {Error} Validation errors, duplicate DEA numbers, or database constraints
   */
  createDeaLicense(license: InsertDeaLicense): Promise<DeaLicense>;
  
  /**
   * Update DEA license record
   * @param {number} id - DEA license record ID
   * @param {Partial<InsertDeaLicense>} license - Partial DEA license data
   * @returns {Promise<DeaLicense>} Updated DEA license record
   * @throws {Error} Record not found or validation errors
   */
  updateDeaLicense(id: number, license: Partial<InsertDeaLicense>): Promise<DeaLicense>;
  
  /**
   * Delete DEA license record
   * @param {number} id - DEA license record ID to delete
   * @returns {Promise<void>} Resolves when deletion is complete
   * @throws {Error} Record not found or database errors
   */
  deleteDeaLicense(id: number): Promise<void>;
  
  /**
   * Board Certification Management
   */
  
  /**
   * Get all board certifications for an employee
   * @param {number} employeeId - Employee's unique identifier
   * @returns {Promise<BoardCertification[]>} Array of specialty board certifications
   * @throws {Error} Database errors or invalid employee ID
   * @example
   * const certs = await storage.getEmployeeBoardCertifications(123);
   * certs.forEach(cert => {
   *   console.log(`${cert.boardName}: ${cert.certification} (expires: ${cert.expirationDate})`);
   * });
   */
  getEmployeeBoardCertifications(employeeId: number): Promise<BoardCertification[]>;
  
  /**
   * Create new board certification record
   * @param {InsertBoardCertification} certification - Board certification data
   * @returns {Promise<BoardCertification>} Created certification record
   * @throws {Error} Validation errors or database constraints
   */
  createBoardCertification(certification: InsertBoardCertification): Promise<BoardCertification>;
  
  /**
   * Update board certification record
   * @param {number} id - Certification record ID
   * @param {Partial<InsertBoardCertification>} certification - Partial certification data
   * @returns {Promise<BoardCertification>} Updated certification record
   * @throws {Error} Record not found or validation errors
   */
  updateBoardCertification(id: number, certification: Partial<InsertBoardCertification>): Promise<BoardCertification>;
  
  /**
   * Delete board certification record
   * @param {number} id - Certification record ID to delete
   * @returns {Promise<void>} Resolves when deletion is complete
   * @throws {Error} Record not found or database errors
   */
  deleteBoardCertification(id: number): Promise<void>;
  
  getEmployeeDocuments(employeeId: number): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: number, document: Partial<InsertDocument>): Promise<Document>;
  deleteDocument(id: number): Promise<void>;
  
  getEmployeeEmergencyContacts(employeeId: number): Promise<EmergencyContact[]>;
  createEmergencyContact(contact: InsertEmergencyContact): Promise<EmergencyContact>;
  updateEmergencyContact(id: number, contact: Partial<InsertEmergencyContact>): Promise<EmergencyContact>;
  deleteEmergencyContact(id: number): Promise<void>;
  
  getEmployeeTaxForms(employeeId: number): Promise<TaxForm[]>;
  createTaxForm(form: InsertTaxForm): Promise<TaxForm>;
  updateTaxForm(id: number, form: Partial<InsertTaxForm>): Promise<TaxForm>;
  deleteTaxForm(id: number): Promise<void>;
  
  getEmployeeTrainings(employeeId: number): Promise<Training[]>;
  createTraining(training: InsertTraining): Promise<Training>;
  updateTraining(id: number, training: Partial<InsertTraining>): Promise<Training>;
  deleteTraining(id: number): Promise<void>;
  
  getEmployeePayerEnrollments(employeeId: number): Promise<PayerEnrollment[]>;
  createPayerEnrollment(enrollment: InsertPayerEnrollment): Promise<PayerEnrollment>;
  updatePayerEnrollment(id: number, enrollment: Partial<InsertPayerEnrollment>): Promise<PayerEnrollment>;
  deletePayerEnrollment(id: number): Promise<void>;
  
  getEmployeeIncidentLogs(employeeId: number): Promise<IncidentLog[]>;
  createIncidentLog(log: InsertIncidentLog): Promise<IncidentLog>;
  updateIncidentLog(id: number, log: Partial<InsertIncidentLog>): Promise<IncidentLog>;
  deleteIncidentLog(id: number): Promise<void>;
  
  /**
   * Audit Trail Management
   */
  
  /**
   * Create new audit record for compliance tracking
   * @param {InsertAudit} audit - Audit data with change details
   * @returns {Promise<Audit>} Created audit record with timestamp
   * @throws {Error} Validation errors or database constraints
   * @example
   * const audit = await storage.createAudit({
   *   tableName: 'employees',
   *   recordId: 123,
   *   action: 'UPDATE',
   *   changedBy: 456,
   *   oldData: { status: 'inactive' },
   *   newData: { status: 'active' }
   * });
   */
  createAudit(audit: InsertAudit): Promise<Audit>;
  
  /**
   * Retrieve audit records with filtering for compliance reporting
   * @param {object} [options] - Query options for audit filtering
   * @param {number} [options.limit=50] - Maximum number of audit records
   * @param {number} [options.offset=0] - Number of records to skip
   * @param {string} [options.tableName] - Filter by specific table
   * @param {string} [options.action] - Filter by action type (CREATE/UPDATE/DELETE)
   * @param {Date} [options.startDate] - Filter audits after this date
   * @param {Date} [options.endDate] - Filter audits before this date
   * @returns {Promise<{audits: Audit[]; total: number}>} Paginated audit records with total count
   * @throws {Error} Database query errors or invalid date ranges
   * @example
   * const auditReport = await storage.getAudits({
   *   tableName: 'employees',
   *   startDate: new Date('2024-01-01'),
   *   endDate: new Date('2024-12-31'),
   *   limit: 100
   * });
   */
  getAudits(options?: {
    limit?: number;
    offset?: number;
    tableName?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ audits: Audit[]; total: number }>;
  
  /**
   * Compliance Reporting Operations
   */
  
  /**
   * Get licenses and certifications expiring within specified days
   * @param {number} days - Number of days ahead to check for expirations
   * @returns {Promise<any[]>} Array of expiring items with employee details
   * @throws {Error} Database query errors or invalid day parameter
   * @example
   * const expiring = await storage.getExpiringItems(30);
   * expiring.forEach(item => {
   *   console.log(`${item.employeeName}: ${item.itemType} expires in ${item.daysRemaining} days`);
   * });
   */
  getExpiringItems(days: number): Promise<any[]>;
  
  /**
   * Get comprehensive employee statistics for management dashboard
   * @returns {Promise<object>} Employee statistics including compliance metrics
   * @throws {Error} Database aggregation errors
   * @example
   * const stats = await storage.getEmployeeStats();
   * console.log(`Total: ${stats.totalEmployees}, Active: ${stats.activeEmployees}`);
   * console.log(`Expiring Soon: ${stats.expiringSoon}, Pending Docs: ${stats.pendingDocs}`);
   */
  getEmployeeStats(): Promise<{
    totalEmployees: number;
    activeEmployees: number;
    expiringSoon: number;
    pendingDocs: number;
  }>;
  
  // Dashboard operations
  getDashboardStats(): Promise<{
    totalEmployees: number;
    activeLicenses: number;
    expiringSoon: number;
    complianceRate: number;
  }>;
  getRecentActivities(limit?: number): Promise<any[]>;
  getDocumentStats(): Promise<{
    licenses: number;
    certifications: number;
    taxForms: number;
    other: number;
    expiringSoon: number;
  }>;
  
  // Document operations
  getDocuments(options?: {
    limit?: number;
    offset?: number;
    search?: string;
    type?: string;
    employeeId?: number;
  }): Promise<{ documents: Document[]; total: number }>;
  getDocument(id: number): Promise<Document | undefined>;
  
  // Document statistics operations
  getDocumentStorageStats(): Promise<{
    totalCount: number;
    s3Count: number;
    localCount: number;
  }>;
  
  /**
   * Compliance Document Management
   */
  
  /**
   * Create new compliance document record
   * @param {InsertComplianceDocument} document - Compliance document data
   * @returns {Promise<ComplianceDocument>} Created compliance document
   */
  createComplianceDocument(document: InsertComplianceDocument): Promise<ComplianceDocument>;
  
  /**
   * Get compliance document by ID
   * @param {number} id - Document ID
   * @returns {Promise<ComplianceDocument | undefined>} Compliance document or undefined
   */
  getComplianceDocument(id: number): Promise<ComplianceDocument | undefined>;
  
  /**
   * Get compliance documents for a clinic license
   * @param {number} clinicLicenseId - Clinic license ID
   * @returns {Promise<ComplianceDocument[]>} Array of compliance documents
   */
  getClinicLicenseDocuments(clinicLicenseId: number): Promise<ComplianceDocument[]>;
  
  /**
   * Get compliance documents for a location
   * @param {number} locationId - Location ID
   * @returns {Promise<ComplianceDocument[]>} Array of compliance documents
   */
  getLocationComplianceDocuments(locationId: number): Promise<ComplianceDocument[]>;
  
  /**
   * Get compliance documents by type
   * @param {string} documentType - Document type
   * @param {object} options - Query options
   * @returns {Promise<ComplianceDocument[]>} Array of compliance documents
   */
  getComplianceDocumentsByType(
    documentType: string,
    options?: {
      locationId?: number;
      clinicLicenseId?: number;
      isCurrentVersion?: boolean;
    }
  ): Promise<ComplianceDocument[]>;
  
  /**
   * Update compliance document
   * @param {number} id - Document ID
   * @param {Partial<InsertComplianceDocument>} updates - Updates to apply
   * @returns {Promise<ComplianceDocument>} Updated compliance document
   */
  updateComplianceDocument(id: number, updates: Partial<InsertComplianceDocument>): Promise<ComplianceDocument>;
  
  /**
   * Delete compliance document
   * @param {number} id - Document ID
   * @returns {Promise<void>} Resolves when deletion is complete
   */
  deleteComplianceDocument(id: number): Promise<void>;
  
  /**
   * Get document versions
   * @param {number} documentId - Current document ID
   * @returns {Promise<ComplianceDocument[]>} Array of document versions
   */
  getComplianceDocumentVersions(documentId: number): Promise<ComplianceDocument[]>;
  
  /**
   * Get expiring compliance documents
   * @param {number} days - Number of days ahead to check
   * @returns {Promise<ComplianceDocument[]>} Array of expiring documents
   */
  getExpiringComplianceDocuments(days: number): Promise<ComplianceDocument[]>;
  
  /**
   * API Key Security Management
   */
  
  /**
   * Create new API key with secure hash storage
   * @param {InsertApiKey} apiKey - API key data with permissions and expiration
   * @returns {Promise<ApiKey>} Created API key record (hash stored, not plain key)
   * @throws {Error} Validation errors, duplicate names, or database constraints
   * @example
   * const apiKey = await storage.createApiKey({
   *   name: 'Integration API Key',
   *   keyHash: '$2b$10$...', // bcrypt hash
   *   keyPrefix: 'hrms_live_abc123',
   *   userId: 1,
   *   permissions: ['read:employees', 'write:employees'],
   *   expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
   * });
   */
  createApiKey(apiKey: InsertApiKey): Promise<ApiKey>;
  
  /**
   * Retrieve API key by ID
   * @param {number} id - API key's unique identifier
   * @returns {Promise<ApiKey | undefined>} API key record or undefined if not found
   * @throws {Error} Database query errors
   */
  getApiKey(id: number): Promise<ApiKey | undefined>;
  
  /**
   * Find API key by hash for authentication
   * @param {string} keyHash - Bcrypt hash of the API key
   * @returns {Promise<ApiKey | undefined>} API key record or undefined if not found
   * @throws {Error} Database query errors
   */
  getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined>;
  
  /**
   * Find API key by prefix for efficient lookup
   * @param {string} prefix - First 16 characters of the API key
   * @returns {Promise<ApiKey | undefined>} API key record or undefined if not found
   * @throws {Error} Database query errors
   * @example
   * const apiKey = await storage.getApiKeyByPrefix('hrms_live_abc123');
   * if (apiKey && !apiKey.revokedAt) {
   *   // Proceed with full hash verification
   * }
   */
  getApiKeyByPrefix(prefix: string): Promise<ApiKey | undefined>;
  
  /**
   * Get all API keys for a specific user
   * @param {number} userId - User's unique identifier
   * @returns {Promise<ApiKey[]>} Array of API keys owned by the user
   * @throws {Error} Database query errors
   */
  getUserApiKeys(userId: number): Promise<ApiKey[]>;
  
  /**
   * Update API key properties (permissions, expiration, etc.)
   * @param {number} id - API key ID to update
   * @param {Partial<ApiKey>} updates - Partial API key data for updates
   * @returns {Promise<ApiKey>} Updated API key record
   * @throws {Error} API key not found or validation errors
   */
  updateApiKey(id: number, updates: Partial<ApiKey>): Promise<ApiKey>;
  
  /**
   * Revoke API key (sets revokedAt timestamp)
   * @param {number} id - API key ID to revoke
   * @returns {Promise<void>} Resolves when revocation is complete
   * @throws {Error} API key not found or database errors
   * @example
   * await storage.revokeApiKey(123);
   * console.log('API key revoked - access immediately terminated');
   */
  revokeApiKey(id: number): Promise<void>;
  
  /**
   * Permanently delete API key record
   * @param {number} id - API key ID to delete
   * @returns {Promise<void>} Resolves when deletion is complete
   * @throws {Error} API key not found or database errors
   */
  deleteApiKey(id: number): Promise<void>;
  
  /**
   * Get all active (non-revoked, non-expired) API keys
   * @returns {Promise<ApiKey[]>} Array of active API keys
   * @throws {Error} Database query errors
   */
  getActiveApiKeys(): Promise<ApiKey[]>;
  
  /**
   * Get API keys expiring within specified days
   * @param {number} days - Number of days ahead to check for expiring keys
   * @returns {Promise<ApiKey[]>} Array of API keys expiring soon
   * @throws {Error} Database query errors
   * @example
   * const expiring = await storage.getExpiringApiKeys(7);
   * // Send notification emails for keys expiring in 7 days
   */
  getExpiringApiKeys(days: number): Promise<ApiKey[]>;
  
  // API Key Rotation operations
  createApiKeyRotation(rotation: InsertApiKeyRotation): Promise<ApiKeyRotation>;
  getApiKeyRotations(apiKeyId: number): Promise<ApiKeyRotation[]>;
  
  // S3 Configuration operations
  getS3Configuration(): Promise<S3Configuration | undefined>;
  createS3Configuration(config: InsertS3Configuration): Promise<S3Configuration>;
  updateS3Configuration(config: Partial<InsertS3Configuration>): Promise<S3Configuration>;
  
  // Employee Invitation operations
  createInvitation(invitation: any): Promise<any>;
  getInvitationById(id: number): Promise<any | undefined>;
  getInvitationByEmail(email: string): Promise<any | undefined>;
  getInvitationByToken(token: string): Promise<any | undefined>;
  getAllInvitations(): Promise<any[]>;
  updateInvitation(id: number, updates: any): Promise<any>;
  
  // Email Reminder operations
  createEmailReminder(reminder: any): Promise<any>;
  getEmailRemindersByInvitationId(invitationId: number): Promise<any[]>;
  
  // DocuSeal Configuration operations
  getDocusealConfiguration(): Promise<DocusealConfiguration | undefined>;
  createDocusealConfiguration(config: InsertDocusealConfiguration): Promise<DocusealConfiguration>;
  updateDocusealConfiguration(id: number, config: Partial<InsertDocusealConfiguration>): Promise<DocusealConfiguration>;
  deleteDocusealConfiguration(id: number): Promise<void>;
  
  // DocuSeal Template operations
  getDocusealTemplates(enabled?: boolean): Promise<DocusealTemplate[]>;
  getDocusealTemplate(id: number): Promise<DocusealTemplate | undefined>;
  createDocusealTemplate(template: InsertDocusealTemplate): Promise<DocusealTemplate>;
  updateDocusealTemplate(id: number, template: Partial<InsertDocusealTemplate>): Promise<DocusealTemplate>;
  deleteDocusealTemplate(id: number): Promise<void>;
  getOnboardingTemplates(): Promise<DocusealTemplate[]>;
  
  // Form Submission operations
  getFormSubmissions(employeeId: number): Promise<FormSubmission[]>;
  getFormSubmission(id: number): Promise<FormSubmission | undefined>;
  createFormSubmission(submission: InsertFormSubmission): Promise<FormSubmission>;
  updateFormSubmission(id: number, submission: Partial<InsertFormSubmission>): Promise<FormSubmission>;
  deleteFormSubmission(id: number): Promise<void>;
  getFormSubmissionsByInvitation(invitationId: number): Promise<FormSubmission[]>;
  getPendingFormSubmissions(): Promise<FormSubmission[]>;
  
  // Location Management operations
  getLocations(options?: {
    limit?: number;
    offset?: number;
    search?: string;
    type?: string;
    status?: string;
    parentId?: number | null;
  }): Promise<{ locations: Location[]; total: number }>;
  getLocation(id: number): Promise<Location | undefined>;
  createLocation(location: InsertLocation): Promise<Location>;
  updateLocation(id: number, location: Partial<InsertLocation>): Promise<Location>;
  deleteLocation(id: number): Promise<void>;
  getLocationHierarchy(): Promise<Location[]>;
  getSubLocations(parentId: number): Promise<Location[]>;
  getLocationsByStatus(status: string): Promise<Location[]>;
  
  // License Type Management operations
  getLicenseTypes(options?: {
    limit?: number;
    offset?: number;
    search?: string;
    category?: string;
  }): Promise<{ licenseTypes: LicenseType[]; total: number }>;
  getLicenseType(id: number): Promise<LicenseType | undefined>;
  createLicenseType(licenseType: InsertLicenseType): Promise<LicenseType>;
  updateLicenseType(id: number, licenseType: Partial<InsertLicenseType>): Promise<LicenseType>;
  deleteLicenseType(id: number): Promise<void>;
  getLicenseTypesByCategory(category: string): Promise<LicenseType[]>;
  
  // Responsible Person Management operations
  getResponsiblePersons(options?: {
    limit?: number;
    offset?: number;
    search?: string;
    isPrimary?: boolean;
  }): Promise<{ persons: ResponsiblePerson[]; total: number }>;
  getResponsiblePerson(id: number): Promise<ResponsiblePerson | undefined>;
  createResponsiblePerson(person: InsertResponsiblePerson): Promise<ResponsiblePerson>;
  updateResponsiblePerson(id: number, person: Partial<InsertResponsiblePerson>): Promise<ResponsiblePerson>;
  deleteResponsiblePerson(id: number): Promise<void>;
  getResponsiblePersonByEmployee(employeeId: number): Promise<ResponsiblePerson | undefined>;
  
  // Clinic License Management operations
  getClinicLicenses(options?: {
    limit?: number;
    offset?: number;
    search?: string;
    status?: string;
    locationId?: number;
    licenseTypeId?: number;
    responsiblePersonId?: number;
  }): Promise<{ licenses: ClinicLicense[]; total: number }>;
  getClinicLicense(id: number): Promise<ClinicLicense | undefined>;
  createClinicLicense(license: InsertClinicLicense): Promise<ClinicLicense>;
  updateClinicLicense(id: number, license: Partial<InsertClinicLicense>): Promise<ClinicLicense>;
  deleteClinicLicense(id: number): Promise<void>;
  getClinicLicensesByLocation(locationId: number): Promise<ClinicLicense[]>;
  getExpiringClinicLicenses(days: number): Promise<ClinicLicense[]>;
  renewClinicLicense(id: number, renewalData: {
    newIssueDate: Date;
    newExpirationDate: Date;
    renewalCost?: number;
  }): Promise<ClinicLicense>;
  getClinicLicensesComplianceStatus(): Promise<{
    compliant: number;
    warning: number;
    nonCompliant: number;
    expiringSoon: number;
    expired: number;
  }>;
  
  // Compliance Document Management operations
  getComplianceDocuments(options?: {
    limit?: number;
    offset?: number;
    search?: string;
    documentType?: string;
    clinicLicenseId?: number;
    locationId?: number;
    status?: string;
  }): Promise<{ documents: ComplianceDocument[]; total: number }>;
  getComplianceDocument(id: number): Promise<ComplianceDocument | undefined>;
  createComplianceDocument(document: InsertComplianceDocument): Promise<ComplianceDocument>;
  updateComplianceDocument(id: number, document: Partial<InsertComplianceDocument>): Promise<ComplianceDocument>;
  deleteComplianceDocument(id: number): Promise<void>;
  getComplianceDocumentsByLicense(clinicLicenseId: number): Promise<ComplianceDocument[]>;
  getComplianceDocumentsByLocation(locationId: number): Promise<ComplianceDocument[]>;
  getComplianceDocumentVersions(documentNumber: string): Promise<ComplianceDocument[]>;
  
  // Compliance Dashboard & Reporting operations
  getComplianceDashboard(): Promise<{
    totalLocations: number;
    activeLocations: number;
    totalLicenses: number;
    activeLicenses: number;
    expiringIn30Days: number;
    expiringIn60Days: number;
    expiringIn90Days: number;
    expiredLicenses: number;
    documentsCount: number;
    nonCompliantCount: number;
  }>;
  getComplianceSummaryByLocation(): Promise<Array<{
    locationId: number;
    locationName: string;
    totalLicenses: number;
    activeLicenses: number;
    expiringLicenses: number;
    expiredLicenses: number;
    complianceStatus: string;
  }>>;
  getComplianceAlerts(): Promise<Array<{
    id: number;
    type: string;
    severity: string;
    message: string;
    entityId: number;
    entityType: string;
    dueDate?: Date;
  }>>;
  
  sessionStore: session.Store;
}

/**
 * Database Storage Implementation using PostgreSQL
 * 
 * @class DatabaseStorage
 * @implements {IStorage}
 * @description Production implementation of the storage interface using PostgreSQL
 * with Drizzle ORM. Handles all database operations for the HR management system.
 * 
 * Features:
 * - Connection pooling for optimal performance
 * - Transaction support for data consistency
 * - Automatic session management
 * - Query optimization with proper indexing
 * - Full text search capabilities
 * - Audit logging for compliance
 */
export class DatabaseStorage implements IStorage {
  /**
   * Express session store for persistent sessions
   */
  sessionStore: session.Store;

  /**
   * Initialize database storage with PostgreSQL connection
   * Creates session table if it doesn't exist
   */
  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true 
    });
  }

  /**
   * User Operations Implementation
   */
  
  /**
   * Get user by ID for session deserialization
   * @param {number} id - User ID
   * @returns {Promise<User | undefined>} User object or undefined
   */
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    if (!user) {
      throw new Error(`User with id ${id} not found`);
    }
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async updateUserStatus(id: number, status: string): Promise<User> {
    const [user] = await db.update(users).set({ status }).where(eq(users.id, id)).returning();
    if (!user) {
      throw new Error(`User with id ${id} not found`);
    }
    return user;
  }

  async getUsersByStatus(status: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.status, status));
  }

  async updatePasswordResetToken(id: number, token: string, expiresAt: Date): Promise<User> {
    const [user] = await db.update(users)
      .set({ 
        passwordResetToken: token,
        passwordResetExpiresAt: expiresAt
      })
      .where(eq(users.id, id))
      .returning();
    if (!user) {
      throw new Error(`User with id ${id} not found`);
    }
    return user;
  }

  async getUserByPasswordResetToken(token: string): Promise<User | undefined> {
    const [user] = await db.select()
      .from(users)
      .where(
        and(
          eq(users.passwordResetToken, token),
          sql`${users.passwordResetExpiresAt} > NOW()`
        )
      );
    return user;
  }

  async clearPasswordResetToken(id: number): Promise<User> {
    const [user] = await db.update(users)
      .set({ 
        passwordResetToken: null,
        passwordResetExpiresAt: null
      })
      .where(eq(users.id, id))
      .returning();
    if (!user) {
      throw new Error(`User with id ${id} not found`);
    }
    return user;
  }

  async incrementFailedLoginAttempts(id: number): Promise<User> {
    const [user] = await db.update(users)
      .set({ 
        failedLoginAttempts: sql`${users.failedLoginAttempts} + 1`
      })
      .where(eq(users.id, id))
      .returning();
    if (!user) {
      throw new Error(`User with id ${id} not found`);
    }
    return user;
  }

  async resetFailedLoginAttempts(id: number): Promise<User> {
    const [user] = await db.update(users)
      .set({ 
        failedLoginAttempts: 0,
        lockedUntil: null
      })
      .where(eq(users.id, id))
      .returning();
    if (!user) {
      throw new Error(`User with id ${id} not found`);
    }
    return user;
  }

  async lockUserUntil(id: number, lockedUntil: Date): Promise<User> {
    const [user] = await db.update(users)
      .set({ lockedUntil })
      .where(eq(users.id, id))
      .returning();
    if (!user) {
      throw new Error(`User with id ${id} not found`);
    }
    return user;
  }

  async updateLastLoginAt(id: number): Promise<User> {
    const [user] = await db.update(users)
      .set({ lastLoginAt: sql`NOW()` })
      .where(eq(users.id, id))
      .returning();
    if (!user) {
      throw new Error(`User with id ${id} not found`);
    }
    return user;
  }

  async getAllUsers(options?: {
    limit?: number;
    offset?: number;
    search?: string;
    role?: string;
    status?: string;
  }): Promise<{ users: User[]; total: number }> {
    const { limit = 10, offset = 0, search, role, status } = options || {};
    
    let conditions = [];
    
    if (search) {
      conditions.push(
        or(
          like(users.username, `%${search}%`),
          like(users.email, `%${search}%`)
        )
      );
    }
    
    if (role) {
      conditions.push(eq(users.role, role));
    }
    
    if (status) {
      conditions.push(eq(users.status, status));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(users)
      .where(whereClause);
    
    // Get paginated results  
    const usersResult = await db
      .select({
        id: users.id,
        username: users.username,
        role: users.role,
        status: users.status,
        email: users.email,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
        failedLoginAttempts: users.failedLoginAttempts,
        lockedUntil: users.lockedUntil
      })
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);
    
    return {
      users: usersResult as User[],
      total: totalResult.count
    };
  }

  async deleteUser(id: number): Promise<void> {
    // Prevent deletion of user ID 1 (system admin)
    if (id === 1) {
      throw new Error('Cannot delete system admin user');
    }
    
    const result = await db.delete(users).where(eq(users.id, id));
    if (result.rowCount === 0) {
      throw new Error(`User with id ${id} not found`);
    }
  }

  // Employee operations
  async getEmployee(id: number): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees).where(eq(employees.id, id));
    return employee;
  }

  async getEmployeeByWorkEmail(workEmail: string): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees).where(eq(employees.workEmail, workEmail));
    return employee;
  }

  async getEmployees(options?: {
    limit?: number;
    offset?: number;
    search?: string;
    department?: string;
    status?: string;
    location?: string;
  }): Promise<{ employees: Employee[]; total: number }> {
    const { limit = 10, offset = 0, search, department, status, location } = options || {};
    
    let conditions = [];
    
    if (search) {
      conditions.push(
        or(
          like(employees.firstName, `%${search}%`),
          like(employees.lastName, `%${search}%`),
          like(employees.workEmail, `%${search}%`)
        )
      );
    }
    
    if (department) {
      conditions.push(like(employees.jobTitle, `%${department}%`));
    }
    
    if (status) {
      conditions.push(eq(employees.status, status));
    }
    
    if (location) {
      conditions.push(eq(employees.workLocation, location));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [employeesList, totalResult] = await Promise.all([
      db.select()
        .from(employees)
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(asc(employees.lastName), asc(employees.firstName)),
      db.select({ count: count() }).from(employees).where(whereClause)
    ]);

    return {
      employees: employeesList,
      total: totalResult[0].count
    };
  }

  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    const [newEmployee] = await db.insert(employees).values(employee).returning();
    return newEmployee;
  }

  async updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee> {
    const [updatedEmployee] = await db
      .update(employees)
      .set({ ...employee, updatedAt: new Date() })
      .where(eq(employees.id, id))
      .returning();
    return updatedEmployee;
  }

  async deleteEmployee(id: number): Promise<void> {
    await db.delete(employees).where(eq(employees.id, id));
  }

  // Education operations
  async getEmployeeEducations(employeeId: number): Promise<Education[]> {
    return await db.select().from(educations).where(eq(educations.employeeId, employeeId));
  }

  async createEducation(education: InsertEducation): Promise<Education> {
    const [newEducation] = await db.insert(educations).values(education).returning();
    return newEducation;
  }

  async updateEducation(id: number, education: Partial<InsertEducation>): Promise<Education> {
    const [updatedEducation] = await db
      .update(educations)
      .set(education)
      .where(eq(educations.id, id))
      .returning();
    return updatedEducation;
  }

  async deleteEducation(id: number): Promise<void> {
    await db.delete(educations).where(eq(educations.id, id));
  }

  // Employment operations
  async getEmployeeEmployments(employeeId: number): Promise<Employment[]> {
    return await db.select().from(employments).where(eq(employments.employeeId, employeeId));
  }

  async createEmployment(employment: InsertEmployment): Promise<Employment> {
    const [newEmployment] = await db.insert(employments).values(employment).returning();
    return newEmployment;
  }

  async updateEmployment(id: number, employment: Partial<InsertEmployment>): Promise<Employment> {
    const [updatedEmployment] = await db
      .update(employments)
      .set(employment)
      .where(eq(employments.id, id))
      .returning();
    return updatedEmployment;
  }

  async deleteEmployment(id: number): Promise<void> {
    await db.delete(employments).where(eq(employments.id, id));
  }

  // Peer reference operations
  async getEmployeePeerReferences(employeeId: number): Promise<PeerReference[]> {
    return await db.select().from(peerReferences).where(eq(peerReferences.employeeId, employeeId));
  }

  async createPeerReference(reference: InsertPeerReference): Promise<PeerReference> {
    const [newReference] = await db.insert(peerReferences).values(reference).returning();
    return newReference;
  }

  async updatePeerReference(id: number, reference: Partial<InsertPeerReference>): Promise<PeerReference> {
    const [updatedReference] = await db
      .update(peerReferences)
      .set(reference)
      .where(eq(peerReferences.id, id))
      .returning();
    return updatedReference;
  }

  async deletePeerReference(id: number): Promise<void> {
    await db.delete(peerReferences).where(eq(peerReferences.id, id));
  }

  // State license operations
  async getEmployeeStateLicenses(employeeId: number): Promise<StateLicense[]> {
    return await db.select().from(stateLicenses).where(eq(stateLicenses.employeeId, employeeId));
  }

  async createStateLicense(license: InsertStateLicense): Promise<StateLicense> {
    const [newLicense] = await db.insert(stateLicenses).values(license).returning();
    return newLicense;
  }

  async updateStateLicense(id: number, license: Partial<InsertStateLicense>): Promise<StateLicense> {
    const [updatedLicense] = await db
      .update(stateLicenses)
      .set(license)
      .where(eq(stateLicenses.id, id))
      .returning();
    return updatedLicense;
  }

  async deleteStateLicense(id: number): Promise<void> {
    await db.delete(stateLicenses).where(eq(stateLicenses.id, id));
  }

  // DEA license operations
  async getEmployeeDeaLicenses(employeeId: number): Promise<DeaLicense[]> {
    return await db.select().from(deaLicenses).where(eq(deaLicenses.employeeId, employeeId));
  }

  async createDeaLicense(license: InsertDeaLicense): Promise<DeaLicense> {
    const [newLicense] = await db.insert(deaLicenses).values(license).returning();
    return newLicense;
  }

  async updateDeaLicense(id: number, license: Partial<InsertDeaLicense>): Promise<DeaLicense> {
    const [updatedLicense] = await db
      .update(deaLicenses)
      .set(license)
      .where(eq(deaLicenses.id, id))
      .returning();
    return updatedLicense;
  }

  async deleteDeaLicense(id: number): Promise<void> {
    await db.delete(deaLicenses).where(eq(deaLicenses.id, id));
  }

  // Board certification operations
  async getEmployeeBoardCertifications(employeeId: number): Promise<BoardCertification[]> {
    return await db.select().from(boardCertifications).where(eq(boardCertifications.employeeId, employeeId));
  }

  async createBoardCertification(certification: InsertBoardCertification): Promise<BoardCertification> {
    const [newCertification] = await db.insert(boardCertifications).values(certification).returning();
    return newCertification;
  }

  async updateBoardCertification(id: number, certification: Partial<InsertBoardCertification>): Promise<BoardCertification> {
    const [updatedCertification] = await db
      .update(boardCertifications)
      .set(certification)
      .where(eq(boardCertifications.id, id))
      .returning();
    return updatedCertification;
  }

  async deleteBoardCertification(id: number): Promise<void> {
    await db.delete(boardCertifications).where(eq(boardCertifications.id, id));
  }

  // Document operations
  async getEmployeeDocuments(employeeId: number): Promise<Document[]> {
    return await db.select().from(documents).where(eq(documents.employeeId, employeeId));
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    // Set default values for backward compatibility
    const documentWithDefaults = {
      ...document,
      storageType: document.storageType || 'local',
      storageKey: document.storageKey || document.filePath
    };
    const [newDocument] = await db.insert(documents).values(documentWithDefaults).returning();
    return newDocument;
  }

  async updateDocument(id: number, document: Partial<InsertDocument>): Promise<Document> {
    const [updatedDocument] = await db
      .update(documents)
      .set(document)
      .where(eq(documents.id, id))
      .returning();
    return updatedDocument;
  }

  async deleteDocument(id: number): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  async getDocuments(options?: {
    limit?: number;
    offset?: number;
    search?: string;
    type?: string;
    employeeId?: number;
  }): Promise<{ documents: Document[]; total: number }> {
    const { limit = 10, offset = 0, search, type, employeeId } = options || {};
    
    let conditions = [];
    
    if (search) {
      conditions.push(like(documents.documentType, `%${search}%`));
    }
    
    if (type) {
      conditions.push(eq(documents.documentType, type));
    }
    
    if (employeeId) {
      conditions.push(eq(documents.employeeId, employeeId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [documentsList, totalResult] = await Promise.all([
      db.select()
        .from(documents)
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(documents.createdAt)),
      db.select({ count: count() }).from(documents).where(whereClause)
    ]);

    return {
      documents: documentsList,
      total: totalResult[0].count
    };
  }
  
  async getDocument(id: number): Promise<Document | undefined> {
    const [document] = await db.select()
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);
    return document;
  }
  
  async getDocumentStorageStats(): Promise<{
    totalCount: number;
    s3Count: number;
    localCount: number;
  }> {
    const [s3Docs, localDocs, totalDocs] = await Promise.all([
      db.select({ count: count() })
        .from(documents)
        .where(eq(documents.storageType, 's3')),
      db.select({ count: count() })
        .from(documents)
        .where(or(
          eq(documents.storageType, 'local'),
          sql`${documents.storageType} IS NULL`
        )),
      db.select({ count: count() })
        .from(documents)
    ]);
    
    return {
      totalCount: totalDocs[0]?.count || 0,
      s3Count: s3Docs[0]?.count || 0,
      localCount: localDocs[0]?.count || 0
    };
  }
  
  // Compliance Document operations
  async createComplianceDocument(document: InsertComplianceDocument): Promise<ComplianceDocument> {
    const [newDocument] = await db.insert(complianceDocuments).values(document).returning();
    return newDocument;
  }
  
  async getComplianceDocument(id: number): Promise<ComplianceDocument | undefined> {
    const [document] = await db.select()
      .from(complianceDocuments)
      .where(eq(complianceDocuments.id, id))
      .limit(1);
    return document;
  }
  
  async getClinicLicenseDocuments(clinicLicenseId: number): Promise<ComplianceDocument[]> {
    return await db.select()
      .from(complianceDocuments)
      .where(eq(complianceDocuments.clinicLicenseId, clinicLicenseId))
      .orderBy(desc(complianceDocuments.uploadedAt));
  }
  
  async getLocationComplianceDocuments(locationId: number): Promise<ComplianceDocument[]> {
    return await db.select()
      .from(complianceDocuments)
      .where(eq(complianceDocuments.locationId, locationId))
      .orderBy(desc(complianceDocuments.uploadedAt));
  }
  
  async getComplianceDocumentsByType(
    documentType: string,
    options?: {
      locationId?: number;
      clinicLicenseId?: number;
      isCurrentVersion?: boolean;
    }
  ): Promise<ComplianceDocument[]> {
    let conditions = [eq(complianceDocuments.documentType, documentType)];
    
    if (options?.locationId) {
      conditions.push(eq(complianceDocuments.locationId, options.locationId));
    }
    
    if (options?.clinicLicenseId) {
      conditions.push(eq(complianceDocuments.clinicLicenseId, options.clinicLicenseId));
    }
    
    if (options?.isCurrentVersion !== undefined) {
      conditions.push(eq(complianceDocuments.isCurrentVersion, options.isCurrentVersion));
    }
    
    return await db.select()
      .from(complianceDocuments)
      .where(and(...conditions))
      .orderBy(desc(complianceDocuments.versionNumber));
  }
  
  async updateComplianceDocument(id: number, updates: Partial<InsertComplianceDocument>): Promise<ComplianceDocument> {
    const [updatedDocument] = await db
      .update(complianceDocuments)
      .set(updates)
      .where(eq(complianceDocuments.id, id))
      .returning();
    return updatedDocument;
  }
  
  async deleteComplianceDocument(id: number): Promise<void> {
    await db.delete(complianceDocuments).where(eq(complianceDocuments.id, id));
  }
  
  async getComplianceDocumentVersions(documentId: number): Promise<ComplianceDocument[]> {
    // First get the current document to find previous versions
    const currentDoc = await this.getComplianceDocument(documentId);
    if (!currentDoc) {
      return [];
    }
    
    const versions: ComplianceDocument[] = [currentDoc];
    let previousId = currentDoc.previousVersionId;
    
    // Traverse the version chain
    while (previousId) {
      const [previousDoc] = await db.select()
        .from(complianceDocuments)
        .where(eq(complianceDocuments.id, previousId))
        .limit(1);
      
      if (previousDoc) {
        versions.push(previousDoc);
        previousId = previousDoc.previousVersionId;
      } else {
        break;
      }
    }
    
    return versions;
  }
  
  async getExpiringComplianceDocuments(days: number): Promise<ComplianceDocument[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    
    return await db.select()
      .from(complianceDocuments)
      .where(
        and(
          lte(complianceDocuments.expirationDate, futureDate.toISOString().split('T')[0]),
          eq(complianceDocuments.isCurrentVersion, true)
        )
      )
      .orderBy(asc(complianceDocuments.expirationDate));
  }

  // Emergency contact operations
  async getEmployeeEmergencyContacts(employeeId: number): Promise<EmergencyContact[]> {
    return await db.select().from(emergencyContacts).where(eq(emergencyContacts.employeeId, employeeId));
  }

  async createEmergencyContact(contact: InsertEmergencyContact): Promise<EmergencyContact> {
    const [newContact] = await db.insert(emergencyContacts).values(contact).returning();
    return newContact;
  }

  async updateEmergencyContact(id: number, contact: Partial<InsertEmergencyContact>): Promise<EmergencyContact> {
    const [updatedContact] = await db
      .update(emergencyContacts)
      .set(contact)
      .where(eq(emergencyContacts.id, id))
      .returning();
    return updatedContact;
  }

  async deleteEmergencyContact(id: number): Promise<void> {
    await db.delete(emergencyContacts).where(eq(emergencyContacts.id, id));
  }

  // Tax form operations
  async getEmployeeTaxForms(employeeId: number): Promise<TaxForm[]> {
    return await db.select().from(taxForms).where(eq(taxForms.employeeId, employeeId));
  }

  async createTaxForm(form: InsertTaxForm): Promise<TaxForm> {
    const [newForm] = await db.insert(taxForms).values(form).returning();
    return newForm;
  }

  async updateTaxForm(id: number, form: Partial<InsertTaxForm>): Promise<TaxForm> {
    const [updatedForm] = await db
      .update(taxForms)
      .set(form)
      .where(eq(taxForms.id, id))
      .returning();
    return updatedForm;
  }

  async deleteTaxForm(id: number): Promise<void> {
    await db.delete(taxForms).where(eq(taxForms.id, id));
  }

  // Training operations
  async getEmployeeTrainings(employeeId: number): Promise<Training[]> {
    return await db.select().from(trainings).where(eq(trainings.employeeId, employeeId));
  }

  async createTraining(training: InsertTraining): Promise<Training> {
    const [newTraining] = await db.insert(trainings).values(training).returning();
    return newTraining;
  }

  async updateTraining(id: number, training: Partial<InsertTraining>): Promise<Training> {
    const [updatedTraining] = await db
      .update(trainings)
      .set(training)
      .where(eq(trainings.id, id))
      .returning();
    return updatedTraining;
  }

  async deleteTraining(id: number): Promise<void> {
    await db.delete(trainings).where(eq(trainings.id, id));
  }

  // Payer enrollment operations
  async getEmployeePayerEnrollments(employeeId: number): Promise<PayerEnrollment[]> {
    return await db.select().from(payerEnrollments).where(eq(payerEnrollments.employeeId, employeeId));
  }

  async createPayerEnrollment(enrollment: InsertPayerEnrollment): Promise<PayerEnrollment> {
    const [newEnrollment] = await db.insert(payerEnrollments).values(enrollment).returning();
    return newEnrollment;
  }

  async updatePayerEnrollment(id: number, enrollment: Partial<InsertPayerEnrollment>): Promise<PayerEnrollment> {
    const [updatedEnrollment] = await db
      .update(payerEnrollments)
      .set(enrollment)
      .where(eq(payerEnrollments.id, id))
      .returning();
    return updatedEnrollment;
  }

  async deletePayerEnrollment(id: number): Promise<void> {
    await db.delete(payerEnrollments).where(eq(payerEnrollments.id, id));
  }

  // Incident log operations
  async getEmployeeIncidentLogs(employeeId: number): Promise<IncidentLog[]> {
    return await db.select().from(incidentLogs).where(eq(incidentLogs.employeeId, employeeId));
  }

  async createIncidentLog(log: InsertIncidentLog): Promise<IncidentLog> {
    const [newLog] = await db.insert(incidentLogs).values(log).returning();
    return newLog;
  }

  async updateIncidentLog(id: number, log: Partial<InsertIncidentLog>): Promise<IncidentLog> {
    const [updatedLog] = await db
      .update(incidentLogs)
      .set(log)
      .where(eq(incidentLogs.id, id))
      .returning();
    return updatedLog;
  }

  async deleteIncidentLog(id: number): Promise<void> {
    await db.delete(incidentLogs).where(eq(incidentLogs.id, id));
  }

  // Audit operations
  async createAudit(audit: InsertAudit): Promise<Audit> {
    const [newAudit] = await db.insert(audits).values(audit).returning();
    return newAudit;
  }

  async getAudits(options?: {
    limit?: number;
    offset?: number;
    tableName?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ audits: Audit[]; total: number }> {
    const { limit = 25, offset = 0, tableName, action, startDate, endDate } = options || {};
    
    let conditions = [];
    
    if (tableName) {
      conditions.push(eq(audits.tableName, tableName));
    }
    
    if (action) {
      conditions.push(eq(audits.action, action));
    }
    
    if (startDate) {
      conditions.push(sql`${audits.changedAt} >= ${startDate}`);
    }
    
    if (endDate) {
      conditions.push(sql`${audits.changedAt} <= ${endDate}`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [auditsList, totalResult] = await Promise.all([
      db.select({
        id: audits.id,
        tableName: audits.tableName,
        recordId: audits.recordId,
        action: audits.action,
        changedBy: audits.changedBy,
        changedAt: audits.changedAt,
        oldData: audits.oldData,
        newData: audits.newData,
        username: users.username
      })
        .from(audits)
        .leftJoin(users, eq(audits.changedBy, users.id))
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(audits.changedAt)),
      db.select({ count: count() }).from(audits).where(whereClause)
    ]);

    return {
      audits: auditsList.map(audit => ({
        id: audit.id,
        tableName: audit.tableName,
        recordId: audit.recordId,
        action: audit.action,
        changedBy: audit.changedBy,
        changedAt: audit.changedAt,
        oldData: audit.oldData,
        newData: audit.newData
      })),
      total: totalResult[0].count
    };
  }

  /**
   * Report Operations - License Expiration Monitoring
   */
  
  /**
   * Get all licenses and certifications expiring within specified days
   * Used by cron jobs for automated notification system
   * 
   * @param {number} days - Number of days to look ahead
   * @returns {Promise<any[]>} Array of expiring items with employee info
   * 
   * @example
   * // Get items expiring in next 30 days
   * const expiringItems = await storage.getExpiringItems(30);
   */
  async getExpiringItems(days: number): Promise<any[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const expiringStateLicenses = await db
      .select({
        employeeId: stateLicenses.employeeId,
        employeeName: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
        itemType: sql<string>`'State License'`,
        licenseNumber: stateLicenses.licenseNumber,
        expirationDate: stateLicenses.expirationDate,
        daysRemaining: sql<number>`${stateLicenses.expirationDate}::date - CURRENT_DATE`
      })
      .from(stateLicenses)
      .innerJoin(employees, eq(stateLicenses.employeeId, employees.id))
      .where(and(
        lte(stateLicenses.expirationDate, futureDate.toISOString().split('T')[0]),
        sql`${stateLicenses.expirationDate} > CURRENT_DATE`
      ));

    const expiringDeaLicenses = await db
      .select({
        employeeId: deaLicenses.employeeId,
        employeeName: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
        itemType: sql<string>`'DEA License'`,
        licenseNumber: deaLicenses.licenseNumber,
        expirationDate: deaLicenses.expirationDate,
        daysRemaining: sql<number>`${deaLicenses.expirationDate}::date - CURRENT_DATE`
      })
      .from(deaLicenses)
      .innerJoin(employees, eq(deaLicenses.employeeId, employees.id))
      .where(and(
        lte(deaLicenses.expirationDate, futureDate.toISOString().split('T')[0]),
        sql`${deaLicenses.expirationDate} > CURRENT_DATE`
      ));

    const expiringBoardCerts = await db
      .select({
        employeeId: boardCertifications.employeeId,
        employeeName: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
        itemType: sql<string>`'Board Certification'`,
        licenseNumber: boardCertifications.certification,
        expirationDate: boardCertifications.expirationDate,
        daysRemaining: sql<number>`${boardCertifications.expirationDate}::date - CURRENT_DATE`
      })
      .from(boardCertifications)
      .innerJoin(employees, eq(boardCertifications.employeeId, employees.id))
      .where(and(
        lte(boardCertifications.expirationDate, futureDate.toISOString().split('T')[0]),
        sql`${boardCertifications.expirationDate} > CURRENT_DATE`
      ));

    return [...expiringStateLicenses, ...expiringDeaLicenses, ...expiringBoardCerts];
  }

  /**
   * Get dashboard statistics for HR overview
   * 
   * @returns {Promise<Object>} Statistics object containing:
   * - totalEmployees: Total number of employees in system
   * - activeEmployees: Number of active employees
   * - expiringSoon: Count of licenses expiring in 30 days
   * - pendingDocs: Estimated pending document count
   */
  async getEmployeeStats(): Promise<{
    totalEmployees: number;
    activeEmployees: number;
    expiringSoon: number;
    pendingDocs: number;
  }> {
    const [totalResult] = await db.select({ count: count() }).from(employees);
    const [activeResult] = await db
      .select({ count: count() })
      .from(employees)
      .where(eq(employees.status, 'active'));

    const expiringItems = await this.getExpiringItems(30);
    const expiringSoon = expiringItems.length;

    // For demo purposes, using a simple count of documents without status
    const [pendingDocsResult] = await db
      .select({ count: count() })
      .from(documents);

    return {
      totalEmployees: totalResult.count,
      activeEmployees: activeResult.count,
      expiringSoon,
      pendingDocs: Math.floor(pendingDocsResult.count * 0.1) // Simulate 10% pending
    };
  }

  /**
   * Get dashboard statistics for main dashboard
   */
  async getDashboardStats(): Promise<{
    totalEmployees: number;
    activeLicenses: number;
    expiringSoon: number;
    complianceRate: number;
  }> {
    // Get total employees count
    const [totalResult] = await db.select({ count: count() }).from(employees);
    
    // Get active licenses count (state + DEA licenses with active status)
    const [stateActiveLicenses] = await db
      .select({ count: count() })
      .from(stateLicenses)
      .where(eq(stateLicenses.status, 'active'));
    
    const [deaActiveLicenses] = await db
      .select({ count: count() })
      .from(deaLicenses)
      .where(eq(deaLicenses.status, 'active'));
    
    const activeLicenses = stateActiveLicenses.count + deaActiveLicenses.count;
    
    // Get expiring soon count (30 days)
    const expiringItems = await this.getExpiringItems(30);
    
    // Calculate compliance rate
    // Count employees with all required documents
    const [compliantEmployees] = await db
      .select({ count: count() })
      .from(employees)
      .where(and(
        sql`${employees.npiNumber} IS NOT NULL`,
        sql`${employees.medicalLicenseNumber} IS NOT NULL`
      ));
    
    const complianceRate = totalResult.count > 0 
      ? Math.round((compliantEmployees.count / totalResult.count) * 100) 
      : 0;
    
    return {
      totalEmployees: totalResult.count,
      activeLicenses,
      expiringSoon: expiringItems.length,
      complianceRate
    };
  }

  /**
   * Get recent activities from audit log
   */
  async getRecentActivities(limit: number = 10): Promise<any[]> {
    const activities = await db
      .select({
        id: audits.id,
        type: audits.action,
        description: sql<string>`
          CASE 
            WHEN ${audits.action} = 'CREATE_EMPLOYEE' THEN 'New employee added'
            WHEN ${audits.action} = 'UPDATE_EMPLOYEE' THEN 'Employee profile updated'
            WHEN ${audits.action} = 'CREATE_DOCUMENT' THEN 'Document uploaded'
            WHEN ${audits.action} = 'CREATE_LICENSE' THEN 'License added'
            WHEN ${audits.action} = 'UPDATE_LICENSE' THEN 'License updated'
            ELSE ${audits.action}
          END
        `,
        entityType: audits.tableName,
        entityId: audits.recordId,
        timestamp: audits.changedAt,
        userId: audits.changedBy
      })
      .from(audits)
      .orderBy(desc(audits.changedAt))
      .limit(limit);
    
    return activities;
  }

  /**
   * Get document statistics by category
   */
  async getDocumentStats(): Promise<{
    licenses: number;
    certifications: number;
    taxForms: number;
    other: number;
    expiringSoon: number;
  }> {
    // Count licenses
    const [licenseDocs] = await db
      .select({ count: count() })
      .from(documents)
      .where(or(
        like(documents.documentType, '%License%'),
        like(documents.documentType, '%license%')
      ));
    
    // Count certifications
    const [certDocs] = await db
      .select({ count: count() })
      .from(documents)
      .where(or(
        like(documents.documentType, '%Certification%'),
        like(documents.documentType, '%certification%'),
        like(documents.documentType, '%Certificate%'),
        like(documents.documentType, '%certificate%')
      ));
    
    // Count tax forms
    const [taxDocs] = await db
      .select({ count: count() })
      .from(documents)
      .where(or(
        like(documents.documentType, '%I-9%'),
        like(documents.documentType, '%W-4%'),
        like(documents.documentType, '%W-2%'),
        like(documents.documentType, '%1099%'),
        like(documents.documentType, '%Tax%'),
        like(documents.documentType, '%tax%')
      ));
    
    // Count total documents
    const [totalDocs] = await db
      .select({ count: count() })
      .from(documents);
    
    // Calculate other documents
    const otherCount = totalDocs.count - licenseDocs.count - certDocs.count - taxDocs.count;
    
    // Count documents expiring soon (30 days)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    
    const [expiringSoonDocs] = await db
      .select({ count: count() })
      .from(documents)
      .where(and(
        lte(documents.expirationDate, futureDate.toISOString().split('T')[0]),
        sql`${documents.expirationDate} > CURRENT_DATE`
      ));
    
    return {
      licenses: licenseDocs.count,
      certifications: certDocs.count,
      taxForms: taxDocs.count,
      other: Math.max(0, otherCount),
      expiringSoon: expiringSoonDocs.count
    };
  }

  /**
   * API Key Operations Implementation
   */
  
  /**
   * Create a new API key for a user
   * @param {InsertApiKey} apiKey - API key data with hashed key
   * @returns {Promise<ApiKey>} Created API key record
   */
  async createApiKey(apiKey: InsertApiKey): Promise<ApiKey> {
    try {
      // Ensure permissions is properly formatted for text[] field
      // PostgreSQL text[] fields work directly with JavaScript arrays
      const permissionsArray = Array.isArray(apiKey.permissions) ? apiKey.permissions : [];
      
      // For text[] fields, Drizzle can handle JavaScript arrays directly
      // No need for raw SQL casting - use the standard insert method
      const [created] = await db.insert(apiKeys).values({
        name: apiKey.name,
        keyHash: apiKey.keyHash,
        keyPrefix: apiKey.keyPrefix,
        userId: apiKey.userId,
        permissions: permissionsArray,
        expiresAt: apiKey.expiresAt,
        environment: apiKey.environment,
        rateLimitPerHour: apiKey.rateLimitPerHour,
        metadata: apiKey.metadata
      }).returning();
      
      return created;
    } catch (error) {
      console.error('Error creating API key:', error);
      throw error;
    }
  }
  
  /**
   * Get API key by ID
   * @param {number} id - API key ID
   * @returns {Promise<ApiKey | undefined>} API key if found
   */
  async getApiKey(id: number): Promise<ApiKey | undefined> {
    const [key] = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
    return key;
  }
  
  /**
   * Get API key by hash (for authentication)
   * @param {string} keyHash - Hashed API key
   * @returns {Promise<ApiKey | undefined>} API key if found
   */
  async getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined> {
    const [key] = await db.select()
      .from(apiKeys)
      .where(and(
        eq(apiKeys.keyHash, keyHash),
        sql`${apiKeys.revokedAt} IS NULL`
      ));
    return key;
  }
  
  /**
   * Get API key by prefix for identification
   * @param {string} prefix - First 8 characters of the API key
   * @returns {Promise<ApiKey | undefined>} API key if found
   */
  async getApiKeyByPrefix(prefix: string): Promise<ApiKey | undefined> {
    const [key] = await db.select()
      .from(apiKeys)
      .where(eq(apiKeys.keyPrefix, prefix));
    return key;
  }
  
  /**
   * Get all API keys for a user
   * @param {number} userId - User ID
   * @returns {Promise<ApiKey[]>} Array of user's API keys
   */
  async getUserApiKeys(userId: number): Promise<ApiKey[]> {
    return await db.select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId))
      .orderBy(desc(apiKeys.createdAt));
  }
  
  /**
   * Update an API key (e.g., lastUsedAt)
   * @param {number} id - API key ID
   * @param {Partial<ApiKey>} updates - Fields to update
   * @returns {Promise<ApiKey>} Updated API key
   */
  async updateApiKey(id: number, updates: Partial<ApiKey>): Promise<ApiKey> {
    const [updated] = await db.update(apiKeys)
      .set(updates)
      .where(eq(apiKeys.id, id))
      .returning();
    return updated;
  }
  
  /**
   * Revoke an API key (soft delete)
   * @param {number} id - API key ID
   */
  async revokeApiKey(id: number): Promise<void> {
    await db.update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(eq(apiKeys.id, id));
  }
  
  /**
   * Delete an API key (hard delete)
   * @param {number} id - API key ID
   */
  async deleteApiKey(id: number): Promise<void> {
    await db.delete(apiKeys).where(eq(apiKeys.id, id));
  }
  
  /**
   * Get all active API keys
   * @returns {Promise<ApiKey[]>} Array of active API keys
   */
  async getActiveApiKeys(): Promise<ApiKey[]> {
    return await db.select()
      .from(apiKeys)
      .where(and(
        sql`${apiKeys.revokedAt} IS NULL`,
        sql`${apiKeys.expiresAt} > NOW()`
      ))
      .orderBy(desc(apiKeys.createdAt));
  }
  
  /**
   * Get API keys expiring within specified days
   * @param {number} days - Number of days to look ahead
   * @returns {Promise<ApiKey[]>} Array of expiring API keys
   */
  async getExpiringApiKeys(days: number): Promise<ApiKey[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    
    return await db.select()
      .from(apiKeys)
      .where(and(
        sql`${apiKeys.revokedAt} IS NULL`,
        lte(apiKeys.expiresAt, futureDate),
        sql`${apiKeys.expiresAt} > NOW()`
      ))
      .orderBy(asc(apiKeys.expiresAt));
  }
  
  /**
   * Create API key rotation record
   * @param {InsertApiKeyRotation} rotation - Rotation data
   * @returns {Promise<ApiKeyRotation>} Created rotation record
   */
  async createApiKeyRotation(rotation: InsertApiKeyRotation): Promise<ApiKeyRotation> {
    const [created] = await db.insert(apiKeyRotations).values(rotation).returning();
    return created;
  }
  
  /**
   * Get rotation history for an API key
   * @param {number} apiKeyId - API key ID
   * @returns {Promise<ApiKeyRotation[]>} Array of rotation records
   */
  async getApiKeyRotations(apiKeyId: number): Promise<ApiKeyRotation[]> {
    return await db.select()
      .from(apiKeyRotations)
      .where(eq(apiKeyRotations.apiKeyId, apiKeyId))
      .orderBy(desc(apiKeyRotations.rotatedAt));
  }
  
  /**
   * S3 Configuration Operations Implementation
   */
  
  /**
   * Get current S3 configuration from database
   * @returns {Promise<S3Configuration | undefined>} S3 configuration or undefined
   */
  async getS3Configuration(): Promise<S3Configuration | undefined> {
    const [config] = await db.select()
      .from(s3Configuration)
      .orderBy(desc(s3Configuration.updatedAt))
      .limit(1);
    return config;
  }
  
  /**
   * Create S3 configuration in database
   * @param {InsertS3Configuration} config - S3 configuration data
   * @returns {Promise<S3Configuration>} Created configuration
   */
  async createS3Configuration(config: InsertS3Configuration): Promise<S3Configuration> {
    const [created] = await db.insert(s3Configuration).values(config).returning();
    return created;
  }
  
  /**
   * Update S3 configuration in database
   * @param {Partial<InsertS3Configuration>} config - S3 configuration updates
   * @returns {Promise<S3Configuration>} Updated configuration
   */
  async updateS3Configuration(config: Partial<InsertS3Configuration>): Promise<S3Configuration> {
    // Get the most recent configuration
    const existingConfig = await this.getS3Configuration();
    
    if (!existingConfig) {
      // If no config exists, create a new one
      return await this.createS3Configuration(config as InsertS3Configuration);
    }
    
    // Update existing config with new updated timestamp
    const [updated] = await db.update(s3Configuration)
      .set({
        ...config,
        updatedAt: new Date()
      })
      .where(eq(s3Configuration.id, existingConfig.id))
      .returning();
    
    return updated;
  }
  
  /**
   * Employee Invitation Operations Implementation
   */
  
  /**
   * Create a new employee invitation
   * @param {any} invitation - Invitation data
   * @returns {Promise<any>} Created invitation
   */
  async createInvitation(invitation: any): Promise<any> {
    const [newInvitation] = await db.insert(employeeInvitations).values(invitation).returning();
    return newInvitation;
  }
  
  /**
   * Get invitation by ID
   * @param {number} id - Invitation ID
   * @returns {Promise<any | undefined>} Invitation or undefined
   */
  async getInvitationById(id: number): Promise<any | undefined> {
    const [invitation] = await db.select()
      .from(employeeInvitations)
      .where(eq(employeeInvitations.id, id));
    return invitation;
  }
  
  /**
   * Get invitation by email
   * @param {string} email - Email address
   * @returns {Promise<any | undefined>} Invitation or undefined
   */
  async getInvitationByEmail(email: string): Promise<any | undefined> {
    const [invitation] = await db.select()
      .from(employeeInvitations)
      .where(eq(employeeInvitations.email, email));
    return invitation;
  }
  
  /**
   * Get invitation by token
   * @param {string} token - Invitation token
   * @returns {Promise<any | undefined>} Invitation or undefined
   */
  async getInvitationByToken(token: string): Promise<any | undefined> {
    const [invitation] = await db.select()
      .from(employeeInvitations)
      .where(eq(employeeInvitations.invitationToken, token));
    return invitation;
  }
  
  /**
   * Get all invitations
   * @returns {Promise<any[]>} Array of invitations
   */
  async getAllInvitations(): Promise<any[]> {
    return await db.select()
      .from(employeeInvitations)
      .orderBy(desc(employeeInvitations.invitedAt));
  }
  
  /**
   * Update invitation
   * @param {number} id - Invitation ID
   * @param {any} updates - Updates to apply
   * @returns {Promise<any>} Updated invitation
   */
  async updateInvitation(id: number, updates: any): Promise<any> {
    const [updated] = await db.update(employeeInvitations)
      .set(updates)
      .where(eq(employeeInvitations.id, id))
      .returning();
    return updated;
  }
  
  /**
   * Email Reminder Operations Implementation
   */
  
  /**
   * Create email reminder record
   * @param {any} reminder - Reminder data
   * @returns {Promise<any>} Created reminder
   */
  async createEmailReminder(reminder: any): Promise<any> {
    const [newReminder] = await db.insert(emailReminders).values(reminder).returning();
    return newReminder;
  }
  
  /**
   * Get email reminders by invitation ID
   * @param {number} invitationId - Invitation ID
   * @returns {Promise<any[]>} Array of reminders
   */
  async getEmailRemindersByInvitationId(invitationId: number): Promise<any[]> {
    return await db.select()
      .from(emailReminders)
      .where(eq(emailReminders.invitationId, invitationId))
      .orderBy(desc(emailReminders.createdAt));
  }

  /**
   * DocuSeal Configuration Operations
   */
  
  async getDocusealConfiguration(): Promise<DocusealConfiguration | undefined> {
    const [config] = await db.select()
      .from(docusealConfigurations)
      .where(eq(docusealConfigurations.enabled, true))
      .limit(1);
    return config;
  }

  async createDocusealConfiguration(config: InsertDocusealConfiguration): Promise<DocusealConfiguration> {
    // Disable all other configurations first
    await db.update(docusealConfigurations)
      .set({ enabled: false });
    
    const [newConfig] = await db.insert(docusealConfigurations)
      .values(config)
      .returning();
    return newConfig;
  }

  async updateDocusealConfiguration(id: number, config: Partial<InsertDocusealConfiguration>): Promise<DocusealConfiguration> {
    // If enabling this config, disable all others
    if (config.enabled === true) {
      await db.update(docusealConfigurations)
        .set({ enabled: false })
        .where(eq(docusealConfigurations.enabled, true));
    }
    
    const [updated] = await db.update(docusealConfigurations)
      .set({ ...config, updatedAt: new Date() })
      .where(eq(docusealConfigurations.id, id))
      .returning();
    return updated;
  }

  async deleteDocusealConfiguration(id: number): Promise<void> {
    await db.delete(docusealConfigurations)
      .where(eq(docusealConfigurations.id, id));
  }

  /**
   * DocuSeal Template Operations
   */
  
  async getDocusealTemplates(enabled?: boolean): Promise<DocusealTemplate[]> {
    let query = db.select().from(docusealTemplates);
    
    if (enabled !== undefined) {
      return await query.where(eq(docusealTemplates.enabled, enabled))
        .orderBy(docusealTemplates.sortOrder, docusealTemplates.name);
    }
    
    return await query.orderBy(docusealTemplates.sortOrder, docusealTemplates.name);
  }

  async getDocusealTemplate(id: number): Promise<DocusealTemplate | undefined> {
    const [template] = await db.select()
      .from(docusealTemplates)
      .where(eq(docusealTemplates.id, id));
    return template;
  }

  async createDocusealTemplate(template: InsertDocusealTemplate): Promise<DocusealTemplate> {
    const [newTemplate] = await db.insert(docusealTemplates)
      .values(template)
      .returning();
    return newTemplate;
  }

  async updateDocusealTemplate(id: number, template: Partial<InsertDocusealTemplate>): Promise<DocusealTemplate> {
    const [updated] = await db.update(docusealTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(docusealTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteDocusealTemplate(id: number): Promise<void> {
    await db.delete(docusealTemplates)
      .where(eq(docusealTemplates.id, id));
  }

  async getOnboardingTemplates(): Promise<DocusealTemplate[]> {
    return await db.select()
      .from(docusealTemplates)
      .where(and(
        eq(docusealTemplates.enabled, true),
        eq(docusealTemplates.requiredForOnboarding, true)
      ))
      .orderBy(docusealTemplates.sortOrder, docusealTemplates.name);
  }

  /**
   * Form Submission Operations
   */
  
  async getFormSubmissions(employeeId: number): Promise<FormSubmission[]> {
    return await db.select()
      .from(formSubmissions)
      .where(eq(formSubmissions.employeeId, employeeId))
      .orderBy(desc(formSubmissions.createdAt));
  }

  async getFormSubmission(id: number): Promise<FormSubmission | undefined> {
    const [submission] = await db.select()
      .from(formSubmissions)
      .where(eq(formSubmissions.id, id));
    return submission;
  }

  async createFormSubmission(submission: InsertFormSubmission): Promise<FormSubmission> {
    const [newSubmission] = await db.insert(formSubmissions)
      .values(submission)
      .returning();
    return newSubmission;
  }

  async updateFormSubmission(id: number, submission: Partial<InsertFormSubmission>): Promise<FormSubmission> {
    const [updated] = await db.update(formSubmissions)
      .set({ ...submission, updatedAt: new Date() })
      .where(eq(formSubmissions.id, id))
      .returning();
    return updated;
  }

  async deleteFormSubmission(id: number): Promise<void> {
    await db.delete(formSubmissions)
      .where(eq(formSubmissions.id, id));
  }

  async getFormSubmissionsByInvitation(invitationId: number): Promise<FormSubmission[]> {
    return await db.select()
      .from(formSubmissions)
      .where(eq(formSubmissions.invitationId, invitationId))
      .orderBy(desc(formSubmissions.createdAt));
  }

  async getPendingFormSubmissions(): Promise<FormSubmission[]> {
    return await db.select()
      .from(formSubmissions)
      .where(and(
        eq(formSubmissions.status, 'pending'),
        lte(formSubmissions.expiresAt, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) // Within 7 days of expiry
      ))
      .orderBy(formSubmissions.expiresAt);
  }
  
  // =====================
  // LOCATION MANAGEMENT IMPLEMENTATION
  // =====================
  
  async getLocations(options?: {
    limit?: number;
    offset?: number;
    search?: string;
    type?: string;
    status?: string;
    parentId?: number | null;
  }): Promise<{ locations: Location[]; total: number }> {
    const limit = options?.limit || 10;
    const offset = options?.offset || 0;
    
    let query = db.select().from(locations);
    let countQuery = db.select({ count: count() }).from(locations);
    
    const conditions = [];
    
    if (options?.search) {
      conditions.push(or(
        like(locations.name, `%${options.search}%`),
        like(locations.code, `%${options.search}%`),
        like(locations.city, `%${options.search}%`)
      ));
    }
    
    if (options?.type) {
      conditions.push(eq(locations.type, options.type));
    }
    
    if (options?.status) {
      conditions.push(eq(locations.status, options.status));
    }
    
    if (options?.parentId !== undefined) {
      conditions.push(options.parentId === null 
        ? sql`${locations.parentId} IS NULL`
        : eq(locations.parentId, options.parentId));
    }
    
    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [totalResult] = whereCondition 
      ? await countQuery.where(whereCondition)
      : await countQuery;
    
    const locationsList = whereCondition
      ? await query.where(whereCondition).limit(limit).offset(offset).orderBy(locations.level, locations.name)
      : await query.limit(limit).offset(offset).orderBy(locations.level, locations.name);
    
    return {
      locations: locationsList,
      total: totalResult?.count || 0
    };
  }
  
  async getLocation(id: number): Promise<Location | undefined> {
    const [location] = await db.select()
      .from(locations)
      .where(eq(locations.id, id));
    return location;
  }
  
  async createLocation(location: InsertLocation): Promise<Location> {
    const [newLocation] = await db.insert(locations)
      .values(location)
      .returning();
    return newLocation;
  }
  
  async updateLocation(id: number, location: Partial<InsertLocation>): Promise<Location> {
    const [updatedLocation] = await db.update(locations)
      .set({
        ...location,
        updatedAt: new Date()
      })
      .where(eq(locations.id, id))
      .returning();
    return updatedLocation;
  }
  
  async deleteLocation(id: number): Promise<void> {
    // Check for dependencies first
    const [hasSubLocations] = await db.select({ count: count() })
      .from(locations)
      .where(eq(locations.parentId, id));
    
    if (hasSubLocations?.count > 0) {
      throw new Error('Cannot delete location with sub-locations');
    }
    
    const [hasLicenses] = await db.select({ count: count() })
      .from(clinicLicenses)
      .where(eq(clinicLicenses.locationId, id));
    
    if (hasLicenses?.count > 0) {
      throw new Error('Cannot delete location with associated licenses');
    }
    
    await db.delete(locations).where(eq(locations.id, id));
  }
  
  async getLocationHierarchy(): Promise<Location[]> {
    return await db.select()
      .from(locations)
      .orderBy(locations.level, locations.parentId, locations.name);
  }
  
  async getSubLocations(parentId: number): Promise<Location[]> {
    return await db.select()
      .from(locations)
      .where(eq(locations.parentId, parentId))
      .orderBy(locations.name);
  }
  
  async getLocationsByStatus(status: string): Promise<Location[]> {
    return await db.select()
      .from(locations)
      .where(eq(locations.status, status))
      .orderBy(locations.name);
  }
  
  // =====================
  // LICENSE TYPE MANAGEMENT IMPLEMENTATION
  // =====================
  
  async getLicenseTypes(options?: {
    limit?: number;
    offset?: number;
    search?: string;
    category?: string;
  }): Promise<{ licenseTypes: LicenseType[]; total: number }> {
    const limit = options?.limit || 10;
    const offset = options?.offset || 0;
    
    let query = db.select().from(licenseTypes);
    let countQuery = db.select({ count: count() }).from(licenseTypes);
    
    const conditions = [];
    
    if (options?.search) {
      conditions.push(or(
        like(licenseTypes.name, `%${options.search}%`),
        like(licenseTypes.code, `%${options.search}%`),
        like(licenseTypes.description, `%${options.search}%`)
      ));
    }
    
    if (options?.category) {
      conditions.push(eq(licenseTypes.category, options.category));
    }
    
    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [totalResult] = whereCondition 
      ? await countQuery.where(whereCondition)
      : await countQuery;
    
    const licenseTypesList = whereCondition
      ? await query.where(whereCondition).limit(limit).offset(offset).orderBy(licenseTypes.name)
      : await query.limit(limit).offset(offset).orderBy(licenseTypes.name);
    
    return {
      licenseTypes: licenseTypesList,
      total: totalResult?.count || 0
    };
  }
  
  async getLicenseType(id: number): Promise<LicenseType | undefined> {
    const [licenseType] = await db.select()
      .from(licenseTypes)
      .where(eq(licenseTypes.id, id));
    return licenseType;
  }
  
  async createLicenseType(licenseType: InsertLicenseType): Promise<LicenseType> {
    const [newLicenseType] = await db.insert(licenseTypes)
      .values(licenseType)
      .returning();
    return newLicenseType;
  }
  
  async updateLicenseType(id: number, licenseType: Partial<InsertLicenseType>): Promise<LicenseType> {
    const [updatedLicenseType] = await db.update(licenseTypes)
      .set({
        ...licenseType,
        updatedAt: new Date()
      })
      .where(eq(licenseTypes.id, id))
      .returning();
    return updatedLicenseType;
  }
  
  async deleteLicenseType(id: number): Promise<void> {
    // Check for dependencies
    const [hasLicenses] = await db.select({ count: count() })
      .from(clinicLicenses)
      .where(eq(clinicLicenses.licenseTypeId, id));
    
    if (hasLicenses?.count > 0) {
      throw new Error('Cannot delete license type with associated licenses');
    }
    
    await db.delete(licenseTypes).where(eq(licenseTypes.id, id));
  }
  
  async getLicenseTypesByCategory(category: string): Promise<LicenseType[]> {
    return await db.select()
      .from(licenseTypes)
      .where(eq(licenseTypes.category, category))
      .orderBy(licenseTypes.name);
  }
  
  // =====================
  // RESPONSIBLE PERSON MANAGEMENT IMPLEMENTATION
  // =====================
  
  async getResponsiblePersons(options?: {
    limit?: number;
    offset?: number;
    search?: string;
    isPrimary?: boolean;
  }): Promise<{ persons: ResponsiblePerson[]; total: number }> {
    const limit = options?.limit || 10;
    const offset = options?.offset || 0;
    
    let query = db.select().from(responsiblePersons);
    let countQuery = db.select({ count: count() }).from(responsiblePersons);
    
    const conditions = [];
    
    if (options?.search) {
      conditions.push(or(
        like(responsiblePersons.firstName, `%${options.search}%`),
        like(responsiblePersons.lastName, `%${options.search}%`),
        like(responsiblePersons.email, `%${options.search}%`)
      ));
    }
    
    if (options?.isPrimary !== undefined) {
      conditions.push(eq(responsiblePersons.isPrimary, options.isPrimary));
    }
    
    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [totalResult] = whereCondition 
      ? await countQuery.where(whereCondition)
      : await countQuery;
    
    const personsList = whereCondition
      ? await query.where(whereCondition).limit(limit).offset(offset).orderBy(responsiblePersons.lastName, responsiblePersons.firstName)
      : await query.limit(limit).offset(offset).orderBy(responsiblePersons.lastName, responsiblePersons.firstName);
    
    return {
      persons: personsList,
      total: totalResult?.count || 0
    };
  }
  
  async getResponsiblePerson(id: number): Promise<ResponsiblePerson | undefined> {
    const [person] = await db.select()
      .from(responsiblePersons)
      .where(eq(responsiblePersons.id, id));
    return person;
  }
  
  async createResponsiblePerson(person: InsertResponsiblePerson): Promise<ResponsiblePerson> {
    const [newPerson] = await db.insert(responsiblePersons)
      .values(person)
      .returning();
    return newPerson;
  }
  
  async updateResponsiblePerson(id: number, person: Partial<InsertResponsiblePerson>): Promise<ResponsiblePerson> {
    const [updatedPerson] = await db.update(responsiblePersons)
      .set({
        ...person,
        updatedAt: new Date()
      })
      .where(eq(responsiblePersons.id, id))
      .returning();
    return updatedPerson;
  }
  
  async deleteResponsiblePerson(id: number): Promise<void> {
    // Check for dependencies
    const [hasLicenses] = await db.select({ count: count() })
      .from(clinicLicenses)
      .where(eq(clinicLicenses.responsiblePersonId, id));
    
    if (hasLicenses?.count > 0) {
      throw new Error('Cannot delete responsible person with associated licenses');
    }
    
    await db.delete(responsiblePersons).where(eq(responsiblePersons.id, id));
  }
  
  async getResponsiblePersonByEmployee(employeeId: number): Promise<ResponsiblePerson | undefined> {
    const [person] = await db.select()
      .from(responsiblePersons)
      .where(eq(responsiblePersons.employeeId, employeeId));
    return person;
  }
  
  // =====================
  // CLINIC LICENSE MANAGEMENT IMPLEMENTATION
  // =====================
  
  async getClinicLicenses(options?: {
    limit?: number;
    offset?: number;
    search?: string;
    status?: string;
    locationId?: number;
    licenseTypeId?: number;
    responsiblePersonId?: number;
  }): Promise<{ licenses: ClinicLicense[]; total: number }> {
    const limit = options?.limit || 10;
    const offset = options?.offset || 0;
    
    let query = db.select().from(clinicLicenses);
    let countQuery = db.select({ count: count() }).from(clinicLicenses);
    
    const conditions = [];
    
    if (options?.search) {
      conditions.push(or(
        like(clinicLicenses.licenseNumber, `%${options.search}%`),
        like(clinicLicenses.notes, `%${options.search}%`)
      ));
    }
    
    if (options?.status) {
      conditions.push(eq(clinicLicenses.status, options.status));
    }
    
    if (options?.locationId) {
      conditions.push(eq(clinicLicenses.locationId, options.locationId));
    }
    
    if (options?.licenseTypeId) {
      conditions.push(eq(clinicLicenses.licenseTypeId, options.licenseTypeId));
    }
    
    if (options?.responsiblePersonId) {
      conditions.push(eq(clinicLicenses.responsiblePersonId, options.responsiblePersonId));
    }
    
    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [totalResult] = whereCondition 
      ? await countQuery.where(whereCondition)
      : await countQuery;
    
    const licensesList = whereCondition
      ? await query.where(whereCondition).limit(limit).offset(offset).orderBy(clinicLicenses.expirationDate)
      : await query.limit(limit).offset(offset).orderBy(clinicLicenses.expirationDate);
    
    return {
      licenses: licensesList,
      total: totalResult?.count || 0
    };
  }
  
  async getClinicLicense(id: number): Promise<ClinicLicense | undefined> {
    const [license] = await db.select()
      .from(clinicLicenses)
      .where(eq(clinicLicenses.id, id));
    return license;
  }
  
  async createClinicLicense(license: InsertClinicLicense): Promise<ClinicLicense> {
    // Auto-set status based on expiration date
    const today = new Date();
    const expDate = new Date(license.expirationDate);
    const daysDiff = Math.floor((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    let status = 'active';
    if (daysDiff < 0) {
      status = 'expired';
    } else if (daysDiff <= 30) {
      status = 'expiring_soon';
    }
    
    const [newLicense] = await db.insert(clinicLicenses)
      .values({
        ...license,
        status
      })
      .returning();
    return newLicense;
  }
  
  async updateClinicLicense(id: number, license: Partial<InsertClinicLicense>): Promise<ClinicLicense> {
    // Auto-update status if expiration date changed
    let status = license.status;
    if (license.expirationDate) {
      const today = new Date();
      const expDate = new Date(license.expirationDate);
      const daysDiff = Math.floor((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff < 0) {
        status = 'expired';
      } else if (daysDiff <= 30) {
        status = 'expiring_soon';
      } else if (!status) {
        status = 'active';
      }
    }
    
    const [updatedLicense] = await db.update(clinicLicenses)
      .set({
        ...license,
        status,
        updatedAt: new Date()
      })
      .where(eq(clinicLicenses.id, id))
      .returning();
    return updatedLicense;
  }
  
  async deleteClinicLicense(id: number): Promise<void> {
    // Check for dependent documents
    const [hasDocuments] = await db.select({ count: count() })
      .from(complianceDocuments)
      .where(eq(complianceDocuments.clinicLicenseId, id));
    
    if (hasDocuments?.count > 0) {
      throw new Error('Cannot delete license with associated documents. Delete documents first.');
    }
    
    await db.delete(clinicLicenses).where(eq(clinicLicenses.id, id));
  }
  
  async getClinicLicensesByLocation(locationId: number): Promise<ClinicLicense[]> {
    return await db.select()
      .from(clinicLicenses)
      .where(eq(clinicLicenses.locationId, locationId))
      .orderBy(clinicLicenses.expirationDate);
  }
  
  async getExpiringClinicLicenses(days: number): Promise<ClinicLicense[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    
    return await db.select()
      .from(clinicLicenses)
      .where(and(
        lte(clinicLicenses.expirationDate, futureDate.toISOString()),
        sql`${clinicLicenses.status} != 'expired'`
      ))
      .orderBy(clinicLicenses.expirationDate);
  }
  
  async renewClinicLicense(id: number, renewalData: {
    newIssueDate: Date;
    newExpirationDate: Date;
    renewalCost?: number;
  }): Promise<ClinicLicense> {
    const today = new Date();
    const expDate = new Date(renewalData.newExpirationDate);
    const daysDiff = Math.floor((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    let status = 'active';
    if (daysDiff <= 30) {
      status = 'expiring_soon';
    }
    
    const [renewedLicense] = await db.update(clinicLicenses)
      .set({
        issueDate: renewalData.newIssueDate,
        expirationDate: renewalData.newExpirationDate,
        renewalDate: today,
        renewalCost: renewalData.renewalCost,
        lastPaymentDate: today,
        status,
        renewalStatus: 'approved',
        updatedAt: today
      })
      .where(eq(clinicLicenses.id, id))
      .returning();
      
    return renewedLicense;
  }
  
  async getClinicLicensesComplianceStatus(): Promise<{
    compliant: number;
    warning: number;
    nonCompliant: number;
    expiringSoon: number;
    expired: number;
  }> {
    const results = await db.select({
      status: clinicLicenses.status,
      complianceStatus: clinicLicenses.complianceStatus,
      count: count()
    })
    .from(clinicLicenses)
    .groupBy(clinicLicenses.status, clinicLicenses.complianceStatus);
    
    const summary = {
      compliant: 0,
      warning: 0,
      nonCompliant: 0,
      expiringSoon: 0,
      expired: 0
    };
    
    results.forEach(row => {
      if (row.complianceStatus === 'compliant') summary.compliant += row.count;
      if (row.complianceStatus === 'warning') summary.warning += row.count;
      if (row.complianceStatus === 'non_compliant') summary.nonCompliant += row.count;
      if (row.status === 'expiring_soon') summary.expiringSoon += row.count;
      if (row.status === 'expired') summary.expired += row.count;
    });
    
    return summary;
  }
  
  // =====================
  // COMPLIANCE DOCUMENT MANAGEMENT IMPLEMENTATION
  // =====================
  
  async getComplianceDocuments(options?: {
    limit?: number;
    offset?: number;
    search?: string;
    documentType?: string;
    clinicLicenseId?: number;
    locationId?: number;
    status?: string;
  }): Promise<{ documents: ComplianceDocument[]; total: number }> {
    const limit = options?.limit || 10;
    const offset = options?.offset || 0;
    
    let query = db.select().from(complianceDocuments);
    let countQuery = db.select({ count: count() }).from(complianceDocuments);
    
    const conditions = [];
    
    if (options?.search) {
      conditions.push(or(
        like(complianceDocuments.documentName, `%${options.search}%`),
        like(complianceDocuments.documentNumber, `%${options.search}%`),
        like(complianceDocuments.fileName, `%${options.search}%`)
      ));
    }
    
    if (options?.documentType) {
      conditions.push(eq(complianceDocuments.documentType, options.documentType));
    }
    
    if (options?.clinicLicenseId) {
      conditions.push(eq(complianceDocuments.clinicLicenseId, options.clinicLicenseId));
    }
    
    if (options?.locationId) {
      conditions.push(eq(complianceDocuments.locationId, options.locationId));
    }
    
    if (options?.status) {
      conditions.push(eq(complianceDocuments.status, options.status));
    }
    
    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [totalResult] = whereCondition 
      ? await countQuery.where(whereCondition)
      : await countQuery;
    
    const documentsList = whereCondition
      ? await query.where(whereCondition).limit(limit).offset(offset).orderBy(desc(complianceDocuments.uploadedAt))
      : await query.limit(limit).offset(offset).orderBy(desc(complianceDocuments.uploadedAt));
    
    return {
      documents: documentsList,
      total: totalResult?.count || 0
    };
  }
  
  async getComplianceDocument(id: number): Promise<ComplianceDocument | undefined> {
    const [document] = await db.select()
      .from(complianceDocuments)
      .where(eq(complianceDocuments.id, id));
    return document;
  }
  
  async createComplianceDocument(document: InsertComplianceDocument): Promise<ComplianceDocument> {
    const [newDocument] = await db.insert(complianceDocuments)
      .values(document)
      .returning();
    return newDocument;
  }
  
  async updateComplianceDocument(id: number, document: Partial<InsertComplianceDocument>): Promise<ComplianceDocument> {
    const [updatedDocument] = await db.update(complianceDocuments)
      .set({
        ...document,
        lastModifiedAt: new Date()
      })
      .where(eq(complianceDocuments.id, id))
      .returning();
    return updatedDocument;
  }
  
  async deleteComplianceDocument(id: number): Promise<void> {
    await db.delete(complianceDocuments).where(eq(complianceDocuments.id, id));
  }
  
  async getComplianceDocumentsByLicense(clinicLicenseId: number): Promise<ComplianceDocument[]> {
    return await db.select()
      .from(complianceDocuments)
      .where(eq(complianceDocuments.clinicLicenseId, clinicLicenseId))
      .orderBy(desc(complianceDocuments.uploadedAt));
  }
  
  async getComplianceDocumentsByLocation(locationId: number): Promise<ComplianceDocument[]> {
    return await db.select()
      .from(complianceDocuments)
      .where(eq(complianceDocuments.locationId, locationId))
      .orderBy(desc(complianceDocuments.uploadedAt));
  }
  
  async getComplianceDocumentVersions(documentNumber: string): Promise<ComplianceDocument[]> {
    return await db.select()
      .from(complianceDocuments)
      .where(eq(complianceDocuments.documentNumber, documentNumber))
      .orderBy(desc(complianceDocuments.version));
  }
  
  // =====================
  // COMPLIANCE DASHBOARD & REPORTING IMPLEMENTATION
  // =====================
  
  async getComplianceDashboard(): Promise<{
    totalLocations: number;
    activeLocations: number;
    totalLicenses: number;
    activeLicenses: number;
    expiringIn30Days: number;
    expiringIn60Days: number;
    expiringIn90Days: number;
    expiredLicenses: number;
    documentsCount: number;
    nonCompliantCount: number;
  }> {
    const [locationStats] = await db.select({
      total: count(),
      active: sql<number>`sum(case when ${locations.status} = 'active' then 1 else 0 end)`
    }).from(locations);
    
    const [licenseStats] = await db.select({
      total: count(),
      active: sql<number>`sum(case when ${clinicLicenses.status} = 'active' then 1 else 0 end)`,
      expired: sql<number>`sum(case when ${clinicLicenses.status} = 'expired' then 1 else 0 end)`,
      nonCompliant: sql<number>`sum(case when ${clinicLicenses.complianceStatus} = 'non_compliant' then 1 else 0 end)`
    }).from(clinicLicenses);
    
    const [documentStats] = await db.select({
      total: count()
    }).from(complianceDocuments);
    
    // Get expiring licenses counts
    const today = new Date();
    const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in60Days = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
    const in90Days = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
    
    const [expiring30] = await db.select({ count: count() })
      .from(clinicLicenses)
      .where(and(
        lte(clinicLicenses.expirationDate, in30Days.toISOString()),
        sql`${clinicLicenses.status} != 'expired'`
      ));
    
    const [expiring60] = await db.select({ count: count() })
      .from(clinicLicenses)
      .where(and(
        lte(clinicLicenses.expirationDate, in60Days.toISOString()),
        sql`${clinicLicenses.status} != 'expired'`
      ));
    
    const [expiring90] = await db.select({ count: count() })
      .from(clinicLicenses)
      .where(and(
        lte(clinicLicenses.expirationDate, in90Days.toISOString()),
        sql`${clinicLicenses.status} != 'expired'`
      ));
    
    return {
      totalLocations: locationStats?.total || 0,
      activeLocations: locationStats?.active || 0,
      totalLicenses: licenseStats?.total || 0,
      activeLicenses: licenseStats?.active || 0,
      expiringIn30Days: expiring30?.count || 0,
      expiringIn60Days: expiring60?.count || 0,
      expiringIn90Days: expiring90?.count || 0,
      expiredLicenses: licenseStats?.expired || 0,
      documentsCount: documentStats?.total || 0,
      nonCompliantCount: licenseStats?.nonCompliant || 0
    };
  }
  
  async getComplianceSummaryByLocation(): Promise<Array<{
    locationId: number;
    locationName: string;
    totalLicenses: number;
    activeLicenses: number;
    expiringLicenses: number;
    expiredLicenses: number;
    complianceStatus: string;
  }>> {
    const results = await db.select({
      locationId: locations.id,
      locationName: locations.name,
      totalLicenses: sql<number>`count(${clinicLicenses.id})`,
      activeLicenses: sql<number>`sum(case when ${clinicLicenses.status} = 'active' then 1 else 0 end)`,
      expiringLicenses: sql<number>`sum(case when ${clinicLicenses.status} = 'expiring_soon' then 1 else 0 end)`,
      expiredLicenses: sql<number>`sum(case when ${clinicLicenses.status} = 'expired' then 1 else 0 end)`,
      nonCompliant: sql<number>`sum(case when ${clinicLicenses.complianceStatus} = 'non_compliant' then 1 else 0 end)`
    })
    .from(locations)
    .leftJoin(clinicLicenses, eq(locations.id, clinicLicenses.locationId))
    .groupBy(locations.id, locations.name)
    .orderBy(locations.name);
    
    return results.map(row => ({
      locationId: row.locationId,
      locationName: row.locationName,
      totalLicenses: row.totalLicenses || 0,
      activeLicenses: row.activeLicenses || 0,
      expiringLicenses: row.expiringLicenses || 0,
      expiredLicenses: row.expiredLicenses || 0,
      complianceStatus: row.nonCompliant > 0 ? 'non_compliant' : 
                       row.expiredLicenses > 0 ? 'warning' : 
                       row.expiringLicenses > 0 ? 'warning' : 'compliant'
    }));
  }
  
  async getComplianceAlerts(): Promise<Array<{
    id: number;
    type: string;
    severity: string;
    message: string;
    entityId: number;
    entityType: string;
    dueDate?: Date;
  }>> {
    const alerts: Array<{
      id: number;
      type: string;
      severity: string;
      message: string;
      entityId: number;
      entityType: string;
      dueDate?: Date;
    }> = [];
    
    // Get expired licenses
    const expiredLicenses = await db.select({
      id: clinicLicenses.id,
      licenseNumber: clinicLicenses.licenseNumber,
      expirationDate: clinicLicenses.expirationDate,
      locationId: clinicLicenses.locationId
    })
    .from(clinicLicenses)
    .where(eq(clinicLicenses.status, 'expired'));
    
    expiredLicenses.forEach(license => {
      alerts.push({
        id: alerts.length + 1,
        type: 'license_expired',
        severity: 'critical',
        message: `License ${license.licenseNumber} has expired`,
        entityId: license.id,
        entityType: 'clinicLicense',
        dueDate: new Date(license.expirationDate)
      });
    });
    
    // Get expiring licenses (within 30 days)
    const expiringLicenses = await this.getExpiringClinicLicenses(30);
    
    expiringLicenses.forEach(license => {
      const daysUntilExpiry = Math.floor((new Date(license.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      alerts.push({
        id: alerts.length + 1,
        type: 'license_expiring',
        severity: daysUntilExpiry <= 7 ? 'high' : 'medium',
        message: `License ${license.licenseNumber} expires in ${daysUntilExpiry} days`,
        entityId: license.id,
        entityType: 'clinicLicense',
        dueDate: new Date(license.expirationDate)
      });
    });
    
    // Get licenses missing documents
    const licensesWithoutDocs = await db.select({
      id: clinicLicenses.id,
      licenseNumber: clinicLicenses.licenseNumber,
      docCount: sql<number>`count(${complianceDocuments.id})`
    })
    .from(clinicLicenses)
    .leftJoin(complianceDocuments, eq(clinicLicenses.id, complianceDocuments.clinicLicenseId))
    .groupBy(clinicLicenses.id, clinicLicenses.licenseNumber)
    .having(sql`count(${complianceDocuments.id}) = 0`);
    
    licensesWithoutDocs.forEach(license => {
      if (license.docCount === 0) {
        alerts.push({
          id: alerts.length + 1,
          type: 'missing_documents',
          severity: 'medium',
          message: `License ${license.licenseNumber} has no supporting documents`,
          entityId: license.id,
          entityType: 'clinicLicense'
        });
      }
    });
    
    // Sort alerts by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    alerts.sort((a, b) => severityOrder[a.severity as keyof typeof severityOrder] - severityOrder[b.severity as keyof typeof severityOrder]);
    
    return alerts;
  }
}

/**
 * Singleton instance of database storage
 * @type {DatabaseStorage}
 */
export const storage = new DatabaseStorage();
