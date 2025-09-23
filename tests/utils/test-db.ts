/**
 * Test Database Utilities
 * 
 * Provides utilities for setting up and cleaning up the test database.
 * Uses the same database as development but with table truncation between tests.
 */

import { db } from '../../server/db';
import { 
  users, 
  employees, 
  educations, 
  employments, 
  peerReferences, 
  stateLicenses,
  deaLicenses,
  boardCertifications,
  emergencyContacts,
  taxForms,
  trainings,
  payerEnrollments,
  incidentLogs,
  documents,
  apiKeys,
  employeeInvitations,
  audits
} from '../../shared/schema';
import { sql } from 'drizzle-orm';

export const testDb = {
  /**
   * Setup test database - ensure all tables exist
   */
  async setup() {
    // Test database connection
    try {
      await db.select().from(users).limit(1);
    } catch (error) {
      console.error('Failed to connect to test database:', error);
      throw error;
    }
  },

  /**
   * Clean up all test data from database tables
   * This is called after all tests complete
   */
  async cleanup() {
    try {
      // Clear all tables in reverse dependency order
      const tables = [
        audits,
        documents,
        incidentLogs,
        payerEnrollments,
        trainings,
        taxForms,
        emergencyContacts,
        boardCertifications,
        deaLicenses,
        stateLicenses,
        peerReferences,
        employments,
        educations,
        employeeInvitations,
        employees,
        apiKeys,
        users,
      ];

      for (const table of tables) {
        await db.delete(table);
      }
    } catch (error) {
      console.error('Failed to cleanup test database:', error);
      throw error;
    }
  },

  /**
   * Clean up test data between individual tests
   * This preserves structure but removes test data
   */
  async cleanupBetweenTests() {
    try {
      // Clear all data tables but keep settings
      // Order matters due to foreign key constraints
      const tables = [
        audits,
        documents,
        incidentLogs,
        payerEnrollments,
        trainings,
        taxForms,
        emergencyContacts,
        boardCertifications,
        deaLicenses,
        stateLicenses,
        peerReferences,
        employments,
        educations,
        employeeInvitations,
        employees,
        apiKeys,
        users,
      ];

      for (const table of tables) {
        await db.delete(table);
      }
    } catch (error) {
      console.error('Failed to cleanup between tests:', error);
      throw error;
    }
  },

  /**
   * Create a test user with specified role
   */
  async createTestUser(userData: { username: string; password: string; role?: string }) {
    // Use bcrypt directly instead of importing from auth module to avoid circular imports
    const bcrypt = await import('bcrypt');
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(userData.password, saltRounds);
    
    const [user] = await db.insert(users).values({
      username: userData.username,
      passwordHash: passwordHash,
      role: userData.role || 'hr',
    }).returning();

    return user;
  },

  /**
   * Create a test employee with minimal required fields
   */
  async createTestEmployee(employeeData: {
    firstName: string;
    lastName: string;
    workEmail: string;
    status?: string;
  }) {
    const [employee] = await db.insert(employees).values({
      firstName: employeeData.firstName,
      lastName: employeeData.lastName,
      workEmail: employeeData.workEmail,
      status: employeeData.status || 'active',
    }).returning();

    return employee;
  },

  /**
   * Create a test API key
   */
  async createTestApiKey(keyData: {
    name: string;
    permissions: string[];
    createdBy: number;
  }) {
    const [apiKey] = await db.insert(apiKeys).values({
      name: keyData.name,
      keyHash: 'test-key-hash',
      keyPrefix: 'tk_123456',
      userId: keyData.createdBy,
      permissions: keyData.permissions,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
    }).returning();

    return apiKey;
  },

  /**
   * Create a test invitation
   */
  async createTestInvitation(invitationData: {
    firstName: string;
    lastName: string;
    email: string;
    cellPhone: string;
    invitedBy: number;
    status?: string;
    jobTitle?: string;
    workLocation?: string;
  }) {
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    const [invitation] = await db.insert(employeeInvitations).values({
      firstName: invitationData.firstName,
      lastName: invitationData.lastName,
      email: invitationData.email,
      cellPhone: invitationData.cellPhone,
      invitedBy: invitationData.invitedBy,
      status: invitationData.status || 'pending',
      invitationToken: token,
      expiresAt: expiresAt,
    }).returning();

    return invitation;
  },

  /**
   * Create a test document
   */
  async createTestDocument(documentData: {
    employeeId: number;
    fileName: string;
    originalFileName?: string;
    documentType: string;
    description?: string;
    fileSize: number;
    uploadedBy: number;
  }) {
    const [document] = await db.insert(documents).values({
      employeeId: documentData.employeeId,
      fileName: documentData.fileName,
      documentType: documentData.documentType,
      fileSize: documentData.fileSize,
    }).returning();

    return document;
  }
};