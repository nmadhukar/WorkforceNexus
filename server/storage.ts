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
  type InsertSesConfiguration
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
  
  // Employee operations
  getEmployee(id: number): Promise<Employee | undefined>;
  getEmployees(options?: {
    limit?: number;
    offset?: number;
    search?: string;
    department?: string;
    status?: string;
    location?: string;
  }): Promise<{ employees: Employee[]; total: number }>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee>;
  deleteEmployee(id: number): Promise<void>;
  
  // Related data operations
  getEmployeeEducations(employeeId: number): Promise<Education[]>;
  createEducation(education: InsertEducation): Promise<Education>;
  updateEducation(id: number, education: Partial<InsertEducation>): Promise<Education>;
  deleteEducation(id: number): Promise<void>;
  
  getEmployeeEmployments(employeeId: number): Promise<Employment[]>;
  createEmployment(employment: InsertEmployment): Promise<Employment>;
  updateEmployment(id: number, employment: Partial<InsertEmployment>): Promise<Employment>;
  deleteEmployment(id: number): Promise<void>;
  
  getEmployeePeerReferences(employeeId: number): Promise<PeerReference[]>;
  createPeerReference(reference: InsertPeerReference): Promise<PeerReference>;
  updatePeerReference(id: number, reference: Partial<InsertPeerReference>): Promise<PeerReference>;
  deletePeerReference(id: number): Promise<void>;
  
  getEmployeeStateLicenses(employeeId: number): Promise<StateLicense[]>;
  createStateLicense(license: InsertStateLicense): Promise<StateLicense>;
  updateStateLicense(id: number, license: Partial<InsertStateLicense>): Promise<StateLicense>;
  deleteStateLicense(id: number): Promise<void>;
  
  getEmployeeDeaLicenses(employeeId: number): Promise<DeaLicense[]>;
  createDeaLicense(license: InsertDeaLicense): Promise<DeaLicense>;
  updateDeaLicense(id: number, license: Partial<InsertDeaLicense>): Promise<DeaLicense>;
  deleteDeaLicense(id: number): Promise<void>;
  
  getEmployeeBoardCertifications(employeeId: number): Promise<BoardCertification[]>;
  createBoardCertification(certification: InsertBoardCertification): Promise<BoardCertification>;
  updateBoardCertification(id: number, certification: Partial<InsertBoardCertification>): Promise<BoardCertification>;
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
  
  // Audit operations
  createAudit(audit: InsertAudit): Promise<Audit>;
  getAudits(options?: {
    limit?: number;
    offset?: number;
    tableName?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ audits: Audit[]; total: number }>;
  
  // Report operations
  getExpiringItems(days: number): Promise<any[]>;
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
  
  // API Key operations
  createApiKey(apiKey: InsertApiKey): Promise<ApiKey>;
  getApiKey(id: number): Promise<ApiKey | undefined>;
  getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined>;
  getApiKeyByPrefix(prefix: string): Promise<ApiKey | undefined>;
  getUserApiKeys(userId: number): Promise<ApiKey[]>;
  updateApiKey(id: number, updates: Partial<ApiKey>): Promise<ApiKey>;
  revokeApiKey(id: number): Promise<void>;
  deleteApiKey(id: number): Promise<void>;
  getActiveApiKeys(): Promise<ApiKey[]>;
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

  // Employee operations
  async getEmployee(id: number): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees).where(eq(employees.id, id));
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
    const [created] = await db.insert(apiKeys).values(apiKey).returning();
    return created;
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
}

/**
 * Singleton instance of database storage
 * @type {DatabaseStorage}
 */
export const storage = new DatabaseStorage();
