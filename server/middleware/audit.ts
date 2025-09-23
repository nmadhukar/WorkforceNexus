/**
 * @fileoverview Audit Middleware for HR Management System
 * 
 * This module provides comprehensive audit logging functionality for tracking
 * all data changes in the system. It ensures compliance with healthcare
 * regulations by maintaining detailed records of who changed what and when.
 * 
 * Features:
 * - Automatic audit trail generation for CRUD operations
 * - User attribution for all changes
 * - Before/after data snapshots for updates
 * - Integration with database storage layer
 * 
 * @module audit
 * @requires express
 * @requires ./storage
 * @requires @shared/schema
 */

import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { User } from "@shared/schema";

/**
 * Extended Express Request interface for audit logging
 * 
 * @interface AuditRequest
 * @extends {Request}
 * @description Extends the standard Express Request object to include
 * user authentication data and audit metadata for tracking changes.
 * Used throughout the application to maintain audit trails.
 */
export interface AuditRequest extends Request {
  /**
   * Authenticated user making the request
   * @type {User} - User object with id, username, and role
   */
  user?: User;
  
  /**
   * Audit metadata for the current operation
   * @type {object} - Contains audit trail information
   */
  auditData?: {
    /** Database table being modified */
    tableName: string;
    /** Primary key of the record being modified */
    recordId: number;
    /** Type of operation being performed */
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    /** Original data before modification (for UPDATE operations) */
    oldData?: any;
    /** New data after modification (for CREATE/UPDATE operations) */
    newData?: any;
  };
}

/**
 * Create audit middleware for tracking database table changes
 * 
 * @function auditMiddleware
 * @param {string} tableName - Name of the database table being audited
 * @returns {Function} Express middleware function
 * 
 * @description
 * Creates middleware that prepares audit metadata for tracking changes to
 * a specific database table. This middleware should be applied to routes
 * that modify data to ensure all changes are logged for compliance.
 * 
 * The middleware analyzes the HTTP method to determine the operation type:
 * - POST requests → CREATE action
 * - PUT/PATCH requests → UPDATE action  
 * - DELETE requests → DELETE action
 * 
 * @example
 * // Apply audit middleware to employee routes
 * app.post('/api/employees', auditMiddleware('employees'), ...)
 * app.put('/api/employees/:id', auditMiddleware('employees'), ...)
 * app.delete('/api/employees/:id', auditMiddleware('employees'), ...)
 */
export const auditMiddleware = (tableName: string) => {
  return (req: AuditRequest, res: Response, next: NextFunction) => {
    req.auditData = {
      tableName,
      recordId: 0, // Will be set in the route handler
      action: req.method === 'POST' ? 'CREATE' : req.method === 'PUT' || req.method === 'PATCH' ? 'UPDATE' : 'DELETE'
    };
    next();
  };
};

/**
 * Log an audit record for a database operation
 * 
 * @async
 * @function logAudit
 * @param {AuditRequest} req - Express request with audit metadata and user info
 * @param {number} recordId - Primary key of the modified record
 * @param {any} [oldData] - Original data before modification (for UPDATE/DELETE)
 * @param {any} [newData] - New data after modification (for CREATE/UPDATE)
 * @returns {Promise<void>} Resolves when audit log is created
 * 
 * @description
 * Creates a comprehensive audit record in the database tracking:
 * - What table was modified
 * - Which specific record was affected
 * - What type of operation was performed
 * - Who made the change (user attribution)
 * - Before and after data snapshots
 * - Timestamp of the change
 * 
 * This function provides the complete audit trail required for healthcare
 * compliance and regulatory reporting. It safely handles missing data
 * and logs errors without throwing to avoid disrupting the main operation.
 * 
 * @throws {Error} Does not throw - logs errors and continues silently
 * 
 * @example
 * // Log employee creation
 * const newEmployee = await storage.createEmployee(employeeData);
 * await logAudit(req, newEmployee.id, null, newEmployee);
 * 
 * @example
 * // Log employee update with before/after data
 * const oldEmployee = await storage.getEmployee(id);
 * const updatedEmployee = await storage.updateEmployee(id, updates);
 * await logAudit(req, id, oldEmployee, updatedEmployee);
 */
export const logAudit = async (req: AuditRequest, recordId: number, oldData?: any, newData?: any) => {
  if (!req.auditData || !req.user) return;
  
  try {
    await storage.createAudit({
      tableName: req.auditData.tableName,
      recordId,
      action: req.auditData.action,
      changedBy: req.user.id,
      oldData: oldData ? JSON.parse(JSON.stringify(oldData)) : null,
      newData: newData ? JSON.parse(JSON.stringify(newData)) : null
    });
  } catch (error) {
    console.error('Failed to log audit:', error);
  }
};
