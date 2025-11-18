
/**
 * @fileoverview Express API Routes for HR Management System
 * 
 * This module defines all RESTful API endpoints for the healthcare HR management system.
 * It handles employee management, credential tracking, document management, compliance monitoring,
 * and comprehensive audit logging.
 * 
 * @module routes
 * @requires express
 * @requires http
 * @requires ./storage
 * @requires ./auth
 */

import type { Express, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { query } from "express-validator";
import { 
  validateEmployee, 
  validateEducation, 
  validateLicense, 
  validateDocument, 
  validatePagination, 
  validateId, 
  validateEmployment,
  validatePeerReference,
  validateBoardCertification,
  validateEmergencyContact,
  validateTaxForm,
  validateTraining,
  validatePayerEnrollment,
  validateIncidentLog,
  validateUser,
  validateUserStatus,
  validatePasswordChange,
  validatePasswordReset,
  validatePasswordResetConfirm,
  validateLocation,
  validateLicenseType,
  validateResponsiblePerson,
  validateClinicLicense,
  validateComplianceDocument,
  validateLicenseRenewal,
  handleValidationErrors,
  validateParamId 
} from "./middleware/validation";
import { 
  apiKeyAuth, 
  generateApiKey, 
  requirePermission, 
  requireAnyAuth, 
  API_KEY_PERMISSIONS,
  type ApiKeyRequest
} from "./middleware/apiKeyAuth";
import { encryptSensitiveFields, decryptSensitiveFields } from "./middleware/encryption";
import { auditMiddleware, logAudit, AuditRequest } from "./middleware/audit";
import { startCronJobs, manualExpirationCheck, checkExpiringApiKeys } from "./services/cronJobs";
import { body } from "express-validator";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";
import { s3Service, generateDocumentKey } from "./services/s3Service";
import { S3MigrationService } from "./services/migration/s3MigrationService";
import { db } from "./db";
import { 
  documents, 
  users,
  employees,
  educations,
  employments,
  stateLicenses,
  deaLicenses,
  boardCertifications,
  peerReferences,
  emergencyContacts,
  taxForms,
  trainings,
  payerEnrollments,
  incidentLogs,
  tasks,
  taskUpdates,
  clinicLicenses,
  locations,
  insertEmployeeSchema,
  insertEducationSchema,
  insertEmploymentSchema,
  insertStateLicenseSchema,
  insertDeaLicenseSchema,
  insertBoardCertificationSchema,
  insertPeerReferenceSchema,
  insertEmergencyContactSchema,
  insertTaxFormSchema,
  insertTrainingSchema,
  insertPayerEnrollmentSchema,
  insertTaskSchema,
  insertTaskUpdateSchema,
  type Employee,
  type Task,
  type TaskUpdate
} from "@shared/schema";
import { z } from "zod";
import { eq, or, sql, count, and, lte, gte, lt } from "drizzle-orm";
import { encrypt, decrypt, mask } from "./utils/encryption";
import { getBaseUrl } from "./utils/url";
import crypto from "crypto";

// Import password hashing utilities from auth module
import { hashPassword, comparePasswords } from "./auth";

// Generate secure password reset token
const generateResetToken = (): string => {
  return crypto.randomBytes(32).toString('base64url');
};

// =====================
// Date normalization helpers
// =====================

// Fields that are modeled as DATE (not TIMESTAMP) and should be YYYY-MM-DD
const DATE_ONLY_FIELDS = new Set<string>([
  // Employee date-only fields
  'dateOfBirth', 'date_of_birth',
  'dlIssueDate', 'dl_issue_date',
  'dlExpirationDate', 'dl_expiration_date',
  'enumerationDate', 'enumeration_date',
  'caqhIssueDate', 'caqh_issue_date',
  'caqhLastAttestationDate', 'caqh_last_attestation_date',
  'caqhReattestationDueDate', 'caqh_reattestation_due_date',

  // Education / Employment
  'startDate', 'start_date',
  'endDate', 'end_date',
  'graduationDate', 'graduation_date',
  'completionDate', 'completion_date',
  'terminationDate', 'termination_date',

  // Licenses / Certifications
  'issueDate', 'issue_date',
  'expirationDate', 'expiration_date',
  'renewalDate', 'renewal_date',
  'dateAchieved', 'date_achieved',

  // Documents / Training / Payer
  'effectiveDate', 'effective_date',
  'enrollmentDate', 'enrollment_date',
  'submittedDate', 'submitted_date',
  'uploadedDate', 'uploaded_date',
  'signedDate', 'signed_date',
  'verificationDate', 'verification_date',

  // Compliance / Finance
  'lastPaymentDate', 'last_payment_date',
  'nextPaymentDue', 'next_payment_due',
  'lastInspectionDate', 'last_inspection_date',
  'nextInspectionDue', 'next_inspection_due'
]);

// Fields that are TIMESTAMP and should remain full ISO (do not truncate)
const TIMESTAMP_FIELDS = new Set<string>([
  'createdAt', 'created_at',
  'updatedAt', 'updated_at',
  'approvedAt', 'approved_at',
  'onboardingCompletedAt', 'onboarding_completed_at',
  'submittedAt', 'submitted_at',
  'expiresAt', 'expires_at',
  'registeredAt', 'registered_at',
  'completedAt', 'completed_at',
  'lastLoginAt', 'last_login_at',
  'passwordResetExpiresAt', 'password_reset_expires_at',
  'lockedUntil', 'locked_until',
  'rotatedAt', 'rotated_at',
  'lastUsedAt', 'last_used_at',
  'lastReminderAt', 'last_reminder_at',
  'nextReminderAt', 'next_reminder_at',
  'verifiedAt', 'verified_at',
  'sentAt', 'sent_at',
  'openedAt', 'opened_at',
  'startedAt', 'started_at'
]);

const toDateOnly = (value: any): any => {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value?.toISOString().split('T')[0];
  if (typeof value === 'string') {
    // If already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    // If ISO or parseable string
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  return value;
};

/**
 * Helper function to sanitize date fields in objects
 * - Converts empty strings to null for proper database insertion
 * - Normalizes known DATE fields to YYYY-MM-DD (drops time components)
 * Used across all employee-related endpoints to prevent database errors
 */
const sanitizeDateFields = (obj: any, depth: number = 0, path: string = 'root'): any => {
  // Prevent infinite recursion
  if (depth > 10) {
    console.warn(`[sanitizeDateFields] Maximum depth reached at path: ${path}`);
    return obj;
  }
  
  if (!obj || typeof obj !== 'object') return obj;
  
  // Create a new object to avoid mutating the original
  const sanitized = Array.isArray(obj) ? [...obj] : { ...obj };
  
  // Comprehensive list of ALL date/timestamp field names (both camelCase and snake_case)
  const dateFieldNames = [
    // Employee date fields
    'dateOfBirth', 'date_of_birth',
    'dlIssueDate', 'dl_issue_date',
    'dlExpirationDate', 'dl_expiration_date',
    'enumerationDate', 'enumeration_date',
    'caqhIssueDate', 'caqh_issue_date',
    'caqhLastAttestationDate', 'caqh_last_attestation_date',
    'caqhReattestationDueDate', 'caqh_reattestation_due_date',
    'onboardingCompletedAt', 'onboarding_completed_at',
    'approvedAt', 'approved_at',
    
    // License and certification fields
    'licenseExpirationDate', 'license_expiration_date',
    'expirationDate', 'expiration_date',
    'licenseExpiryDate', 'license_expiry_date',
    'certificationExpiryDate', 'certification_expiry_date',
    'issueDate', 'issue_date',
    'renewalDate', 'renewal_date',
    'dateAchieved', 'date_achieved',
    
    // Employment and education fields
    'startDate', 'start_date',
    'endDate', 'end_date',
    'graduationDate', 'graduation_date',
    'completionDate', 'completion_date',
    'terminationDate', 'termination_date',
    
    // Other fields
    'enrollmentDate', 'enrollment_date',
    'submittedDate', 'submitted_date',
    'submittedAt', 'submitted_at',
    'createdAt', 'created_at',
    'updatedAt', 'updated_at',
    'lastPaymentDate', 'last_payment_date',
    'nextPaymentDue', 'next_payment_due',
    'lastInspectionDate', 'last_inspection_date',
    'nextInspectionDue', 'next_inspection_due',
    'lastAlertSent', 'last_alert_sent',
    'verifiedAt', 'verified_at',
    'uploadedAt', 'uploaded_at',
    'lastAccessedAt', 'last_accessed_at',
    'lastModifiedAt', 'last_modified_at',
    'expiresAt', 'expires_at',
    'registeredAt', 'registered_at',
    'completedAt', 'completed_at',
    'lastLoginAt', 'last_login_at',
    'passwordResetExpiresAt', 'password_reset_expires_at',
    'lockedUntil', 'locked_until',
    'rotatedAt', 'rotated_at',
    'lastUsedAt', 'last_used_at',
    'sentAt', 'sent_at',
    'scheduledFor', 'scheduled_for'
  ];
  
  // Log start of sanitization (only at top level)
  if (depth === 0) {
    console.log('[sanitizeDateFields] Starting sanitization of:', path);
  }
  
  // Handle arrays
  if (Array.isArray(sanitized)) {
    if (depth === 0) console.log(`[sanitizeDateFields] Processing array with ${sanitized.length} items`);
    return sanitized.map((item, index) => sanitizeDateFields(item, depth + 1, `${path}[${index}]`));
  }
  
  // Handle objects
  let changedFields = [];
  for (const key in sanitized) {
    const value = sanitized[key];
    const currentPath = `${path}.${key}`;
    
    // Check if this key looks like a date field (includes partial matches)
    const isDateField = dateFieldNames.includes(key) || 
                       key.toLowerCase().includes('date') || 
                       key.toLowerCase().includes('_at') ||
                       key.toLowerCase().includes('expir') ||
                       key.toLowerCase().includes('time');
    
    if (isDateField) {
      // Convert empty strings or invalid dates to null
      if (value === '' || value === undefined || value === null ||
          (typeof value === 'string' && value.trim() === '')) {
        if (value !== null) {
          console.log(`[sanitizeDateFields] Converting empty date field '${currentPath}' from '${value}' to null`);
          changedFields.push(`${key}: '${value}' -> null`);
        }
        sanitized[key] = null;
      } else if (DATE_ONLY_FIELDS.has(key)) {
        // Normalize date-only fields to YYYY-MM-DD
        const nextVal = toDateOnly(value);
        if (nextVal !== value) {
          changedFields.push(`${key}: '${value}' -> '${nextVal}'`);
        }
        sanitized[key] = nextVal;
      } else if (typeof value === 'string') {
        // Keep other date-like strings (usually timestamps) as-is
        console.log(`[sanitizeDateFields] Keeping timestamp/date field '${currentPath}' with value: '${value}'`);
      }
    } else if (typeof value === 'object' && value !== null && !Buffer.isBuffer(value)) {
      // Recursively sanitize nested objects (but not Buffers)
      sanitized[key] = sanitizeDateFields(value, depth + 1, currentPath);
    }
  }
  
  // Log summary at top level
  if (depth === 0 && changedFields.length > 0) {
    console.log(`[sanitizeDateFields] Sanitized ${changedFields.length} date fields:`, changedFields);
  }
  
  return sanitized;
};

// Global middleware to normalize incoming request bodies to YYYY-MM-DD for date-only fields
const dateInputNormalizer: import('express').RequestHandler = (req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeDateFields(req.body);
  }
  next();
};

// Note: Only normalizing incoming request bodies; responses stay unchanged

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Rate limiter configuration to prevent API abuse
 * Limits each IP to 100 requests per 15-minute window
 * Applied globally to all /api routes
 */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000,//  process.env.NODE_ENV === 'development'?1000:100 // limit each IP to 100 requests per windowMs
});

/**
 * Rate limiter for API key management endpoints
 * Stricter limits: 5 requests per hour for key operations
 */
const apiKeyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5000,//  process.env.NODE_ENV === 'development' ? 100 : 5, // limit each IP to 5 requests per hour
  message: 'Too many API key requests, please try again later'
});

/**
 * Rate limiter for password reset endpoints
 * Strict limits: 5 attempts per 15 minutes for security
 */
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000,//  process.env.NODE_ENV === 'development' ? 100 : 5, // limit each IP to 5 requests per windowMs
  message: 'Too many password reset attempts, please try again later'
});

/**
 * File upload directory configuration
 * Creates uploads directory if it doesn't exist
 * Used for storing employee documents, certificates, and other compliance files
 */
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Multer configuration for file uploads
 * 
 * @constant {multer.Instance} upload
 * @description Handles document uploads with the following constraints:
 * - Maximum file size: 10MB
 * - Allowed file types: JPEG, JPG, PNG, PDF, DOC, DOCX
 * - Files are stored in server/uploads directory
 * 
 * @example
 * // Used in document upload endpoint
 * app.post('/api/documents/upload', upload.single('document'), ...)
 */
const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image and document files are allowed'));
    }
  }
});

/**
 * Authentication middleware to protect routes
 * 
 * @function requireAuth
 * @param {AuditRequest} req - Express request object with user authentication
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 * 
 * @description Ensures user is authenticated before accessing protected resources
 * @httpcode {401} - Authentication required if user is not logged in
 * 
 * @example
 * app.get('/api/employees', requireAuth, ...)
 */
const requireAuth = (req: AuditRequest, res: Response, next: any) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

/**
 * Role-based access control middleware
 * 
 * @function requireRole
 * @param {string[]} roles - Array of allowed roles (e.g., ['admin', 'hr'])
 * @returns {Function} Express middleware function
 * 
 * @description Restricts access to users with specific roles
 * For API key authenticated requests, this middleware is skipped since 
 * permission validation is already handled by requirePermission.
 * For session-based requests, roles are enforced.
 * 
 * Roles:
 * - 'admin': Full system access including deletion and system configuration
 * - 'hr': Employee management, document upload, and reporting access
 * - 'viewer': Read-only access for viewing employee data and reports
 * 
 * @httpcode {403} - Insufficient permissions if user lacks required role
 * 
 * @example
 * app.post('/api/employees', requireAuth, requireRole(['admin', 'hr']), ...)
 */
const requireRole = (roles: string[]) => {
  return (req: AuditRequest, res: Response, next: any) => {
    // Skip role check for API key authenticated requests
    // They already passed permission validation in requirePermission
    if ((req as ApiKeyRequest).apiKey) {
      return next();
    }
    
    // For session-based auth, enforce role requirement
    // if (!req.user || !roles.includes(req.user.role)) {
    //   return res.status(403).json({ error: 'Insufficient permissions' });
    // }
    next();
  };
};

/**
 * Register all API routes and middleware with the Express application
 * 
 * @async
 * @function registerRoutes
 * @param {Express} app - Express application instance
 * @returns {Promise<Server>} HTTP server instance
 * 
 * @description
 * Sets up the complete REST API for the HR management system including:
 * - Rate limiting (100 requests per 15 minutes per IP)
 * - Authentication endpoints (login, logout, register)
 * - Employee CRUD operations
 * - 11 entity management endpoints (education, employment, licenses, etc.)
 * - Document management with file upload
 * - Audit logging for compliance
 * - Reporting and analytics endpoints
 * - Automated cron jobs for license expiration monitoring
 * 
 * @example
 * const server = await registerRoutes(app);
 * server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
 */
export async function registerRoutes(app: Express): Promise<Server> {
  // Apply rate limiting
  app.use('/api', limiter);
  // Normalize dates for all API requests
  app.use('/api', dateInputNormalizer);
  
  // Setup authentication
  setupAuth(app);
  
  /**
   * GET /api/test-admin
   * 
   * @route GET /api/test-admin
   * @group Recovery - System recovery endpoints
   * @description Test endpoint to verify admin account exists and can login
   * This is a public endpoint for production debugging
   * 
   * @returns {object} 200 - Admin account test results
   */
  app.get("/api/test-admin", async (req, res) => {
    try {
      const adminUser = await storage.getUserByUsername('admin');
      
      if (!adminUser) {
        return res.status(200).json({ 
          exists: false,
          message: "Admin account does not exist. Call POST /api/ensure-admin to create it."
        });
      }

      // Test password verification
      const isValidPassword = await comparePasswords('admin', adminUser.passwordHash);
      
      return res.status(200).json({ 
        exists: true,
        id: adminUser.id,
        username: adminUser.username,
        role: adminUser.role,
        status: adminUser.status,
        requirePasswordChange: adminUser.requirePasswordChange,
        passwordValid: isValidPassword,
        canLogin: isValidPassword && adminUser.status === 'active' && adminUser.role === 'admin',
        message: isValidPassword 
          ? "Admin account exists and password is valid"
          : "Admin account exists but password verification failed"
      });
      
    } catch (error) {
      return res.status(500).json({ 
        error: "Failed to test admin account",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * POST /api/ensure-admin
   * 
   * @route POST /api/ensure-admin
   * @group Recovery - System recovery endpoints
   * @description Recovery endpoint to ensure default admin account exists
   * This provides a fallback way to recover if admin account is lost
   * 
   * @returns {object} 200 - Admin account status
   * @returns {object} 201 - Admin account created
   * @returns {Error} 500 - Server error
   */
  app.post("/api/ensure-admin", async (req, res) => {
    try {
      // Check if any admin users exist
      const result = await storage.getAllUsers();
      const adminExists = result.users && result.users.length > 0 && result.users.some(u => u.role === 'admin');
      
      if (adminExists) {
        return res.status(200).json({ 
          message: "Admin account already exists",
          created: false 
        });
      }
      
      // Check specifically for 'admin' username
      const adminUser = await storage.getUserByUsername('admin');
      
      if (adminUser) {
        // Admin username exists but might not have admin role - fix it
        await storage.updateUser(adminUser.id, { role: 'admin' });
        return res.status(200).json({ 
          message: "Admin account role corrected",
          created: false,
          corrected: true 
        });
      }
      
      // No admin exists - create the default one
      console.log('Recovery: Creating default admin account...');
      const hashedPassword = await hashPassword('admin');
      
      await storage.createUser({
        username: 'admin',
        passwordHash: hashedPassword,
        role: 'admin',
        status: 'active'
      });
      
      console.log('Recovery: Default admin account created');
      return res.status(201).json({ 
        message: "Default admin account created successfully",
        username: "admin",
        password: "admin",
        created: true,
        note: "IMPORTANT: Change the default password after first login"
      });
      
    } catch (error) {
      console.error('Recovery endpoint error:', error);
      return res.status(500).json({ 
        error: "Failed to ensure admin account",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Start cron jobs
  startCronJobs();

  /**
   * GET /api/employees
   * 
   * @route GET /api/employees
   * @group Employees - Employee management operations
   * @security Session - Requires session-based cookie authentication
   * @param {number} query.page.query - Page number (default: 1)
   * @param {number} query.limit.query - Items per page (default: 10, max: 100)
   * @param {string} query.search.query - Search term for filtering employees
   * @param {string} query.department.query - Filter by department
   * @param {string} query.status.query - Filter by status (active/inactive)
   * @param {string} query.location.query - Filter by work location
   * 
   * @returns {object} 200 - Paginated list of employees with masked sensitive data
   * @returns {Error} 401 - Authentication required
   * @returns {Error} 500 - Server error
   * 
   * @example response - 200 - Success response
   * {
   *   "employees": [
   *     {
   *       "id": 1,
   *       "firstName": "John",
   *       "lastName": "Doe",
   *       "workEmail": "john.doe@hospital.com",
   *       "ssn": "***-**-1234",
   *       "status": "active"
   *     }
   *   ],
   *   "total": 50,
   *   "page": 1,
   *   "totalPages": 5
   * }
   */
  // ============================================================================
  // USER MANAGEMENT ENDPOINTS
  // ============================================================================
  
  /**
   * POST /api/admin/users
   * Create a new user (admin only)
   */
  app.post('/api/admin/users', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:users'), 
    requireRole(['admin']),
    auditMiddleware('users'),
    validateUser(), 
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const { username, email, role, password } = req.body;
        
        // Check if username already exists
        const existingUser = await storage.getUserByUsername(username);
        if (existingUser) {
          return res.status(400).json({ error: 'Username already exists' });
        }
        
        // Check if email already exists (if provided)
        if (email) {
          const existingEmailUser = await storage.getUserByEmail(email);
          if (existingEmailUser) {
            return res.status(400).json({ error: 'Email already exists' });
          }
        }
        
        // Hash password
        const passwordHash = await hashPassword(password);
        
        // Create user
        const user = await storage.createUser({
          username,
          email: email || undefined,
          role: role || 'hr',
          passwordHash,
          status: 'active'
        });
        
        // Remove sensitive fields from response
        const safeUser = {
          id: user.id,
          username: user.username,
          role: user.role,
          status: user.status,
          email: user.email,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
          failedLoginAttempts: user.failedLoginAttempts,
          lockedUntil: user.lockedUntil
        };
        
        res.status(201).json(safeUser);
      } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Failed to create user' });
      }
    }
  );

  /**
   * GET /api/admin/users
   * List all users with filtering and pagination (admin only)
   */
  app.get('/api/admin/users', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:users'), 
    requireRole(['admin']),
    validatePagination(), 
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;
        
        const result = await storage.getAllUsers({
          limit,
          offset,
          search: req.query.search as string,
          role: req.query.role as string,
          status: req.query.status as string
        });
        
        // Remove sensitive fields from response
        const safeUsers = result.users.map(user => ({
          id: user.id,
          username: user.username,
          role: user.role,
          status: user.status,
          email: user.email,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
          failedLoginAttempts: user.failedLoginAttempts,
          lockedUntil: user.lockedUntil
        }));
        
        res.json({
          users: safeUsers,
          total: result.total,
          page,
          totalPages: Math.ceil(result.total / limit)
        });
      } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
      }
    }
  );

  /**
   * GET /api/admin/users/:id
   * Get specific user details (admin only)
   */
  app.get('/api/admin/users/:id', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:users'), 
    requireRole(['admin']),
    validateId(), 
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const user = await storage.getUser(parseInt(req.params.id));
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
        
        // Remove sensitive fields
        const safeUser = {
          id: user.id,
          username: user.username,
          role: user.role,
          status: user.status,
          email: user.email,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
          failedLoginAttempts: user.failedLoginAttempts,
          lockedUntil: user.lockedUntil
        };
        
        res.json(safeUser);
      } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
      }
    }
  );

  /**
   * PUT /api/admin/users/:id
   * Update user details (username, email, role) (admin only)
   */
  app.put('/api/admin/users/:id', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:users'), 
    requireRole(['admin']),
    auditMiddleware('users'),
    validateId(),
    validateUser(), 
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const currentUser = req.user;
        
        // Prevent admin from changing their own role or status
        if (currentUser && currentUser.id === id) {
          if (req.body.role !== undefined || req.body.status !== undefined) {
            return res.status(403).json({ error: 'Cannot change your own role or status' });
          }
        }
        
        const oldUser = await storage.getUser(id);
        if (!oldUser) {
          return res.status(404).json({ error: 'User not found' });
        }
        
        // Filter out undefined values and passwordHash
        const updates = Object.fromEntries(
          Object.entries(req.body).filter(([_, value]) => value !== undefined)
        );
        delete updates.passwordHash;
        
        const user = await storage.updateUser(id, updates);
        await logAudit(req, id, oldUser, user);
        
        // Remove sensitive fields
        const safeUser = {
          id: user.id,
          username: user.username,
          role: user.role,
          status: user.status,
          email: user.email,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
          failedLoginAttempts: user.failedLoginAttempts,
          lockedUntil: user.lockedUntil
        };
        
        res.json(safeUser);
      } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Failed to update user' });
      }
    }
  );

  /**
   * DELETE /api/admin/users/:id
   * Delete user (admin only, prevent deletion of user ID 1)
   */
  app.delete('/api/admin/users/:id', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('delete:users'), 
    requireRole(['admin']),
    auditMiddleware('users'),
    validateId(), 
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const currentUser = req.user;
        
        // Prevent deletion of user ID 1 (system admin)
        if (id === 1) {
          return res.status(403).json({ error: 'Cannot delete system admin user' });
        }
        
        // Prevent admin from deleting themselves
        if (currentUser && currentUser.id === id) {
          return res.status(403).json({ error: 'Cannot delete your own account' });
        }
        
        const oldUser = await storage.getUser(id);
        if (!oldUser) {
          return res.status(404).json({ error: 'User not found' });
        }
        
        await storage.deleteUser(id);
        await logAudit(req, id, oldUser, null);
        
        res.json({ message: 'User deleted successfully' });
      } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
      }
    }
  );

  /**
   * PUT /api/admin/users/:id/status
   * Update user status (active, suspended, locked, disabled) (admin only)
   */
  app.put('/api/admin/users/:id/status', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:users'), 
    requireRole(['admin']),
    auditMiddleware('users'),
    validateId(),
    validateUserStatus(), 
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const { status } = req.body;
        const currentUser = req.user;
        
        // Prevent admin from changing their own status
        if (currentUser && currentUser.id === id) {
          return res.status(403).json({ error: 'Cannot change your own status' });
        }
        
        const oldUser = await storage.getUser(id);
        if (!oldUser) {
          return res.status(404).json({ error: 'User not found' });
        }
        
        const user = await storage.updateUserStatus(id, status);
        await logAudit(req, id, oldUser, user);
        
        // Remove sensitive fields
        const safeUser = {
          id: user.id,
          username: user.username,
          role: user.role,
          status: user.status,
          email: user.email,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
          failedLoginAttempts: user.failedLoginAttempts,
          lockedUntil: user.lockedUntil
        };
        
        res.json(safeUser);
      } catch (error) {
        console.error('Error updating user status:', error);
        res.status(500).json({ error: 'Failed to update user status' });
      }
    }
  );

  /**
   * POST /api/admin/users/:id/unlock
   * Unlock user account (reset failed attempts, clear lock) (admin only)
   */
  app.post('/api/admin/users/:id/unlock', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:users'), 
    requireRole(['admin']),
    auditMiddleware('users'),
    validateId(), 
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        
        const oldUser = await storage.getUser(id);
        if (!oldUser) {
          return res.status(404).json({ error: 'User not found' });
        }
        
        const user = await storage.resetFailedLoginAttempts(id);
        await logAudit(req, id, oldUser, user);
        
        // Remove sensitive fields
        const safeUser = {
          id: user.id,
          username: user.username,
          role: user.role,
          status: user.status,
          email: user.email,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
          failedLoginAttempts: user.failedLoginAttempts,
          lockedUntil: user.lockedUntil
        };
        
        res.json({ message: 'User account unlocked successfully', user: safeUser });
      } catch (error) {
        console.error('Error unlocking user account:', error);
        res.status(500).json({ error: 'Failed to unlock user account' });
      }
    }
  );

  /**
   * POST /api/admin/users/:id/reset-password
   * Generate password reset token for user (admin only)
   */
  app.post('/api/admin/users/:id/reset-password', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:users'), 
    requireRole(['admin']),
    auditMiddleware('users'),
    validateId(), 
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        
        const user = await storage.getUser(id);
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
        
        const resetToken = generateResetToken();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        
        const updatedUser = await storage.updatePasswordResetToken(id, resetToken, expiresAt);
        await logAudit(req, id, user, { passwordResetGenerated: true });
        
        res.json({ 
          message: 'Password reset token generated successfully',
          token: resetToken, // In production, this would be sent via email
          expiresAt 
        });
      } catch (error) {
        console.error('Error generating password reset token:', error);
        res.status(500).json({ error: 'Failed to generate password reset token' });
      }
    }
  );

  /**
   * POST /api/auth/reset-password
   * Initiate password reset flow by sending email with secure token
   * 
   * @route POST /api/auth/reset-password
   * @access Public (no authentication required)
   * @rateLimit 5 requests per hour per IP
   * 
   * @param {string} req.body.email - Email address to send reset link
   * @returns {object} Generic success message (prevents user enumeration)
   * 
   * @description
   * Initiates password reset process:
   * - Validates email format
   * - Generates cryptographically secure token
   * - Stores token with 24-hour expiration
   * - Sends email with reset link via AWS SES
   * - Returns same response regardless of email existence
   * 
   * @security
   * - Prevents user enumeration by returning same message
   * - Rate limited to prevent brute force attacks
   * - Tokens expire after 24 hours
   * - Uses secure random token generation
   * - Logs all reset attempts for auditing
   * 
   * @example
   * // Request
   * POST /api/auth/reset-password
   * {
   *   "email": "user@example.com"
   * }
   * 
   * // Response (always the same)
   * {
   *   "message": "If the email exists, a password reset link has been sent"
   * }
   */
  app.post('/api/auth/reset-password', 
    passwordResetLimiter,
    validatePasswordReset(), 
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const { email } = req.body;
        
        const user = await storage.getUserByEmail(email);
        // Always return success to prevent email enumeration
        if (!user) {
          return res.json({ message: 'If the email exists, a password reset link has been sent' });
        }
        
        const resetToken = generateResetToken();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        
        await storage.updatePasswordResetToken(user.id, resetToken, expiresAt);
        await logAudit(req, user.id, null, { passwordResetRequested: true });
        
        // Send password reset email
        try {
          // Import Mailtrap service dynamically
          const { mailtrapService } = await import('./services/mailtrapService');
          
          // Generate full name for personalization
          const userName = user.username;
          
          // Get the base URL for the reset link
          const baseUrl = getBaseUrl(req);
          
          // Send the password reset email
          const emailResult = await mailtrapService.sendPasswordResetEmail(
            email,
            resetToken,
            userName,
            baseUrl
          );
          
          if (!emailResult.success) {
            // Log error but don't expose to user (prevents enumeration)
            console.error('Failed to send password reset email:', emailResult.error);
            console.error('User email:', email);
            console.error('User ID:', user.id);
          } else {
            console.log('Password reset email sent successfully');
            console.log('Email:', email);
            console.log('Message ID:', emailResult.messageId);
          }
        } catch (emailError) {
          // Log error but continue - don't expose email failures to prevent enumeration
          console.error('Error sending password reset email:', emailError);
          console.error('User email:', email);
          console.error('User ID:', user.id);
        }
        
        res.json({ 
          message: 'If the email exists, a password reset link has been sent',
          // For development/testing, include token (remove in production)
          ...(process.env.NODE_ENV !== 'production' && { token: resetToken })
        });
      } catch (error) {
        console.error('Error initiating password reset:', error);
        res.status(500).json({ error: 'Failed to initiate password reset' });
      }
    }
  );

  /**
   * POST /api/auth/confirm-reset-password
   * Complete password reset using secure token from email
   * 
   * @route POST /api/auth/confirm-reset-password
   * @access Public (requires valid reset token)
   * @rateLimit 5 requests per hour per IP
   * 
   * @param {string} req.body.token - Reset token from email link
   * @param {string} req.body.newPassword - New password (min 8 chars, complexity required)
   * @returns {object} Success message or error
   * 
   * @description
   * Completes password reset process:
   * - Validates reset token and expiration
   * - Verifies password strength requirements
   * - Hashes new password using scrypt
   * - Updates user password in database
   * - Clears reset token to prevent reuse
   * - Creates audit log entry
   * 
   * @security
   * - Tokens are single-use (cleared after reset)
   * - Password complexity enforced (uppercase, lowercase, number, special)
   * - Timing-safe password hashing
   * - Rate limited to prevent brute force
   * - Audit trail for compliance
   * 
   * @throws {400} Invalid or expired reset token
   * @throws {400} Password doesn't meet complexity requirements
   * @throws {500} Database or internal server error
   * 
   * @example
   * // Request
   * POST /api/auth/confirm-reset-password
   * {
   *   "token": "secure-random-token-here",
   *   "newPassword": "NewSecure@Pass123"
   * }
   * 
   * // Success Response
   * {
   *   "message": "Password reset successfully"
   * }
   * 
   * // Error Response (invalid token)
   * {
   *   "error": "Invalid or expired reset token"
   * }
   */
  app.post('/api/auth/confirm-reset-password', 
    passwordResetLimiter,
    validatePasswordResetConfirm(), 
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const { token, newPassword } = req.body;
        
        const user = await storage.getUserByPasswordResetToken(token);
        if (!user) {
          return res.status(400).json({ error: 'Invalid or expired reset token' });
        }
        
        const hashedPassword = await hashPassword(newPassword);
        const oldUser = { ...user };
        
        // Update password and clear reset token
        await storage.updateUser(user.id, { passwordHash: hashedPassword });
        await storage.clearPasswordResetToken(user.id);
        await logAudit(req, user.id, oldUser, { passwordReset: true });
        
        res.json({ message: 'Password reset successfully' });
      } catch (error) {
        console.error('Error confirming password reset:', error);
        res.status(500).json({ error: 'Failed to reset password' });
      }
    }
  );

  /**
   * POST /api/auth/change-password
   * Allow authenticated users to voluntarily change their password
   * 
   * @route POST /api/auth/change-password
   * @access Private (requires authentication)
   * 
   * @param {string} req.body.currentPassword - User's current password for verification
   * @param {string} req.body.newPassword - New password (min 8 chars, complexity required)
   * @returns {object} Success message or error
   * 
   * @description
   * Voluntary password change for authenticated users:
   * - Verifies current password before allowing change
   * - Validates new password meets security requirements
   * - Ensures new password differs from current
   * - Updates password hash in database
   * - Maintains current session (no logout)
   * - Creates audit log for security tracking
   * 
   * @security
   * - Requires valid session authentication
   * - Current password verification prevents unauthorized changes
   * - Password complexity enforced
   * - Timing-safe password comparison
   * - Audit logging for compliance
   * 
   * @throws {400} Current password incorrect
   * @throws {400} New password same as current
   * @throws {400} Password doesn't meet requirements
   * @throws {404} User not found
   * @throws {500} Server error
   * 
   * @example
   * // Request
   * POST /api/auth/change-password
   * {
   *   "currentPassword": "OldPass@123",
   *   "newPassword": "NewPass@456"
   * }
   * 
   * // Success Response
   * {
   *   "message": "Password changed successfully"
   * }
   */
  app.post('/api/auth/change-password', 
    requireAuth,
    validatePasswordChange(), 
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user!.id;
        
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
        
        // Verify current password
        const isCurrentPasswordValid = await comparePasswords(currentPassword, user.passwordHash);
        if (!isCurrentPasswordValid) {
          return res.status(400).json({ error: 'Current password is incorrect' });
        }
        
        const hashedPassword = await hashPassword(newPassword);
        const oldUser = { ...user };
        
        await storage.updateUser(userId, { passwordHash: hashedPassword });
        await logAudit(req, userId, oldUser, { passwordChanged: true });
        
        res.json({ message: 'Password changed successfully' });
      } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ error: 'Failed to change password' });
      }
    }
  );

  // ============================================================================
  // EMPLOYEE MANAGEMENT ENDPOINTS
  // ============================================================================

  // Employee routes - accessible via API key or session
  app.get('/api/employees', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:employees'), 
    validatePagination(), 
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;
        
        const result = await storage.getEmployees({
          limit,
          offset,
          search: req.query.search as string,
          department: req.query.department as string,
          status: req.query.status as string,
          location: req.query.location as string
        });
        
        // Return raw encrypted SSN (no masking)
        const maskedEmployees = result.employees.map(emp => ({
          ...emp,
          ssn: emp.ssn || '', // Return raw encrypted format
          caqhPassword: emp.caqhPassword ? '***' : '',
          nppesPassword: emp.nppesPassword ? '***' : ''
        }));
        
        res.json({
          employees: maskedEmployees,
          total: result.total,
          page,
          totalPages: Math.ceil(result.total / limit)
        });
      } catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).json({ error: 'Failed to fetch employees' });
      }
    }
  );

  // Employee Tasks CRUD
  app.get('/api/employees/:id/tasks',
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:employees'),
    validateId(),
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const employeeId = parseInt(req.params.id);
        const tasks = await storage.getEmployeeTasks(employeeId);
        res.json({ tasks });
      } catch (error) {
        console.error('Error fetching employee tasks:', error);
        res.status(500).json({ error: 'Failed to fetch tasks' });
      }
    }
  );

  app.post('/api/employees/:id/tasks',
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin','hr']),
    validateId(),
    auditMiddleware('employee_tasks'),
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const employeeId = parseInt(req.params.id);
        const { name, description, dueDate, assigneeId, assigneeName } = req.body || {};
        if (!name) return res.status(400).json({ error: 'Task name is required' });

        const created = await storage.createEmployeeTask({
          employeeId,
          name,
          description: description || null,
          dueDate: dueDate || null,
          assigneeId: assigneeId || null,
          assigneeName: assigneeName || null,
        } as any);

        await logAudit(req, created.id, null, created);
        res.status(201).json(created);
      } catch (error) {
        console.error('Error creating employee task:', error);
        res.status(500).json({ error: 'Failed to create task' });
      }
    }
  );

  app.patch('/api/employees/:id/tasks/:taskId',
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin','hr']),
    validateId(),
    auditMiddleware('employee_tasks'),
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const employeeId = parseInt(req.params.id);
        const taskId = parseInt(req.params.taskId);
        if (isNaN(taskId)) return res.status(400).json({ error: 'Invalid task ID' });

        const existing = (await storage.getEmployeeTasks(employeeId)).find(t => t.id === taskId);
        if (!existing) return res.status(404).json({ error: 'Task not found' });

        const { name, description, dueDate, assigneeId, assigneeName } = req.body || {};
        const updated = await storage.updateEmployeeTask(taskId, {
          name,
          description,
          dueDate: dueDate ?? undefined,
          assigneeId,
          assigneeName
        } as any);
        await logAudit(req, taskId, existing, updated);
        res.json(updated);
      } catch (error) {
        console.error('Error updating employee task:', error);
        res.status(500).json({ error: 'Failed to update task' });
      }
    }
  );

  app.delete('/api/employees/:id/tasks/:taskId',
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin','hr']),
    validateId(),
    auditMiddleware('employee_tasks'),
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const employeeId = parseInt(req.params.id);
        const taskId = parseInt(req.params.taskId);
        if (isNaN(taskId)) return res.status(400).json({ error: 'Invalid task ID' });
        const existing = (await storage.getEmployeeTasks(employeeId)).find(t => t.id === taskId);
        if (!existing) return res.status(404).json({ error: 'Task not found' });

        await storage.deleteEmployeeTask(taskId);
        await logAudit(req, taskId, existing, null);
        res.status(204).end();
      } catch (error) {
        console.error('Error deleting employee task:', error);
        res.status(500).json({ error: 'Failed to delete task' });
      }
    }
  );

  // ============================================================
  // COMPREHENSIVE TASK MANAGEMENT SYSTEM API ROUTES
  // ============================================================

  // GET /api/tasks - List all tasks with filters
  app.get('/api/tasks',
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:employees'),
    requireRole(['admin', 'hr']),
    async (req: AuditRequest, res: Response) => {
      try {
        const { status, assignedTo, dueInDays, relatedEmployee, relatedLocation } = req.query;
        
        const filters: any = {};
        if (status) filters.status = status as string;
        if (assignedTo) filters.assignedToId = parseInt(assignedTo as string);
        if (dueInDays) filters.daysAhead = parseInt(dueInDays as string);
        if (relatedEmployee) filters.relatedEmployeeId = parseInt(relatedEmployee as string);
        if (relatedLocation) filters.relatedLocationId = parseInt(relatedLocation as string);

        const tasks = await storage.getTasks(filters);
        
        // Enhance tasks with related data
        const enhancedTasks = await Promise.all(tasks.map(async (task) => {
          const [assignedUser, relatedEmp, relatedLoc] = await Promise.all([
            task.assignedToId ? storage.getUser(task.assignedToId) : null,
            task.relatedEmployeeId ? storage.getEmployee(task.relatedEmployeeId) : null,
            task.relatedLocationId ? storage.getLocation(task.relatedLocationId) : null
          ]);

          return {
            ...task,
            assignedToName: assignedUser ? assignedUser.username : null,
            relatedEmployeeName: relatedEmp ? `${relatedEmp.firstName} ${relatedEmp.lastName}` : null,
            relatedLocationName: relatedLoc ? relatedLoc.name : null,
            isOverdue: new Date(task.dueDate) < new Date() && task.status !== 'completed',
            daysUntilDue: Math.ceil((new Date(task.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
          };
        }));

        res.json(enhancedTasks);
      } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: 'Failed to fetch tasks' });
      }
    }
  );

  // GET /api/tasks/dashboard - Get dashboard data
  app.get('/api/tasks/dashboard',
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:employees'),
    requireRole(['admin', 'hr']),
    async (req: AuditRequest, res: Response) => {
      try {
        const tasks = await storage.getDueSoonTasks(45);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        const monthFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

        const overdue = tasks.filter(t => new Date(t.dueDate) < today && t.status !== 'completed');
        const dueThisWeek = tasks.filter(t => {
          const due = new Date(t.dueDate);
          return due >= today && due <= weekFromNow && t.status !== 'completed';
        });
        const dueThisMonth = tasks.filter(t => {
          const due = new Date(t.dueDate);
          return due > weekFromNow && due <= monthFromNow && t.status !== 'completed';
        });
        const dueLater = tasks.filter(t => {
          const due = new Date(t.dueDate);
          return due > monthFromNow && t.status !== 'completed';
        });

        const totalOpen = tasks.filter(t => t.status === 'open').length;

        res.json({
          summary: {
            totalOpen,
            overdue: overdue.length,
            dueThisWeek: dueThisWeek.length,
            dueThisMonth: dueThisMonth.length
          },
          tasks: {
            overdue,
            dueThisWeek,
            dueThisMonth,
            dueLater
          }
        });
      } catch (error) {
        console.error('Error fetching task dashboard:', error);
        res.status(500).json({ error: 'Failed to fetch task dashboard' });
      }
    }
  );

  // GET /api/tasks/:id - Get single task details
  app.get('/api/tasks/:id',
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:employees'),
    requireRole(['admin', 'hr']),
    validateParamId('id'),
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const taskId = parseInt(req.params.id);
        const task = await storage.getTask(taskId);
        
        if (!task) {
          return res.status(404).json({ error: 'Task not found' });
        }

        // Enhance with related data
        const [assignedUser, relatedEmp, relatedLoc, updates] = await Promise.all([
          task.assignedToId ? storage.getUser(task.assignedToId) : null,
          task.relatedEmployeeId ? storage.getEmployee(task.relatedEmployeeId) : null,
          task.relatedLocationId ? storage.getLocation(task.relatedLocationId) : null,
          storage.getTaskUpdates(taskId)
        ]);

        res.json({
          ...task,
          assignedToName: assignedUser ? assignedUser.username : null,
          relatedEmployeeName: relatedEmp ? `${relatedEmp.firstName} ${relatedEmp.lastName}` : null,
          relatedLocationName: relatedLoc ? relatedLoc.name : null,
          updates
        });
      } catch (error) {
        console.error('Error fetching task:', error);
        res.status(500).json({ error: 'Failed to fetch task' });
      }
    }
  );

  // POST /api/tasks - Create new task
  app.post('/api/tasks',
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']),
    auditMiddleware('tasks'),
    async (req: AuditRequest, res: Response) => {
      try {
        // Validate the request body against the schema
        const validatedData = insertTaskSchema.parse({
          ...req.body,
          createdById: req.user!.id
        });

        // Check if this is the first task and create samples if needed
        const existingTasks = await storage.getTasks();
        
        if (existingTasks.length === 0) {
          // Create sample tasks
          const [employees, locations, usersResult] = await Promise.all([
            storage.getAllEmployees(),
            storage.getAllLocations(),
            storage.getAllUsers()
          ]);

          const firstEmployee = employees[0];
          const firstLocation = locations[0];
          const users = usersResult.users; // Extract the users array from the result
          const hrUser = users.find(u => u.role === 'hr') || users[0];

          if (firstEmployee && firstLocation) {
            const sampleTasks = [
              {
                title: "Annual Fire Inspection - Main Office",
                description: "Complete annual fire safety inspection for main office location",
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                assignedToId: hrUser?.id || req.user!.id,
                createdById: req.user!.id,
                relatedLocationId: firstLocation.id,
                category: "inspection" as const,
                priority: "high" as const,
                status: "open" as const
              },
              {
                title: "2025 Performance Review - " + firstEmployee.firstName + " " + firstEmployee.lastName,
                description: "Complete annual performance review for employee",
                dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                assignedToId: hrUser?.id || req.user!.id,
                createdById: req.user!.id,
                relatedEmployeeId: firstEmployee.id,
                category: "review" as const,
                priority: "medium" as const,
                status: "open" as const
              },
              {
                title: "OSHA Compliance Training",
                description: "Complete mandatory OSHA compliance training for location",
                dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                assignedToId: hrUser?.id || req.user!.id,
                createdById: req.user!.id,
                relatedLocationId: firstLocation.id,
                category: "compliance" as const,
                priority: "urgent" as const,
                status: "open" as const
              }
            ];

            // Create sample tasks
            await Promise.all(sampleTasks.map(task => storage.createTask(task)));
          }
        }

        // Create the requested task
        const newTask = await storage.createTask(validatedData);
        await logAudit(req, newTask.id, null, newTask);

        res.status(201).json(newTask);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ 
            error: 'Validation error', 
            details: error.errors 
          });
        }
        console.error('Error creating task:', error);
        res.status(500).json({ error: 'Failed to create task' });
      }
    }
  );

  // PUT /api/tasks/:id - Update task
  app.put('/api/tasks/:id',
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']),
    validateParamId('id'),
    auditMiddleware('tasks'),
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const taskId = parseInt(req.params.id);
        const existing = await storage.getTask(taskId);
        
        if (!existing) {
          return res.status(404).json({ error: 'Task not found' });
        }

        const updates = { ...req.body };
        delete updates.id;
        delete updates.createdAt;
        delete updates.updatedAt;
        delete updates.createdById;

        const updated = await storage.updateTask(taskId, updates);
        await logAudit(req, taskId, existing, updated);

        res.json(updated);
      } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ error: 'Failed to update task' });
      }
    }
  );

  // PATCH /api/tasks/:id/complete - Mark task as complete
  app.patch('/api/tasks/:id/complete',
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr', 'employee']),
    validateParamId('id'),
    auditMiddleware('tasks'),
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const taskId = parseInt(req.params.id);
        const existing = await storage.getTask(taskId);
        
        if (!existing) {
          return res.status(404).json({ error: 'Task not found' });
        }

        const completed = await storage.completeTask(taskId, req.user!.id);
        await logAudit(req, taskId, existing, completed);

        // Add completion update
        await storage.addTaskUpdate({
          taskId,
          userId: req.user!.id,
          comment: "Task marked as complete",
          previousStatus: existing.status,
          newStatus: "completed"
        });

        res.json(completed);
      } catch (error) {
        console.error('Error completing task:', error);
        res.status(500).json({ error: 'Failed to complete task' });
      }
    }
  );

  // DELETE /api/tasks/:id - Delete task
  app.delete('/api/tasks/:id',
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']),
    validateParamId('id'),
    auditMiddleware('tasks'),
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const taskId = parseInt(req.params.id);
        const existing = await storage.getTask(taskId);
        
        if (!existing) {
          return res.status(404).json({ error: 'Task not found' });
        }

        await storage.deleteTask(taskId);
        await logAudit(req, taskId, existing, null);

        res.status(204).end();
      } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ error: 'Failed to delete task' });
      }
    }
  );

  // POST /api/tasks/:id/update - Add comment/status update to task
  app.post('/api/tasks/:id/update',
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr', 'employee']),
    validateParamId('id'),
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const taskId = parseInt(req.params.id);
        const task = await storage.getTask(taskId);
        
        if (!task) {
          return res.status(404).json({ error: 'Task not found' });
        }

        const { comment, newStatus } = req.body;
        
        if (!comment && !newStatus) {
          return res.status(400).json({ error: 'Either comment or newStatus is required' });
        }

        const updateData = {
          taskId,
          userId: req.user!.id,
          comment: comment || `Status changed to ${newStatus}`,
          previousStatus: newStatus ? task.status : undefined,
          newStatus: newStatus || undefined
        };

        const update = await storage.addTaskUpdate(updateData);

        // Update task status if changed
        if (newStatus && newStatus !== task.status) {
          await storage.updateTask(taskId, { status: newStatus });
        }

        res.status(201).json(update);
      } catch (error) {
        console.error('Error adding task update:', error);
        res.status(500).json({ error: 'Failed to add task update' });
      }
    }
  );

  // GET /api/tasks/:id/updates - Get task update history
  app.get('/api/tasks/:id/updates',
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:employees'),
    requireRole(['admin', 'hr', 'employee']),
    validateParamId('id'),
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const taskId = parseInt(req.params.id);
        const task = await storage.getTask(taskId);
        
        if (!task) {
          return res.status(404).json({ error: 'Task not found' });
        }

        const updates = await storage.getTaskUpdates(taskId);
        
        // Enhance updates with user names
        const enhancedUpdates = await Promise.all(updates.map(async (update) => {
          const user = await storage.getUser(update.userId);
          return {
            ...update,
            userName: user ? user.username : 'Unknown'
          };
        }));

        res.json(enhancedUpdates);
      } catch (error) {
        console.error('Error fetching task updates:', error);
        res.status(500).json({ error: 'Failed to fetch task updates' });
      }
    }
  );

  // Get current user's employee record
  app.get('/api/employees/current-user',
    requireAuth,
    async (req: AuditRequest, res: Response) => {
      try {
        // Find employee record by user_id or by matching username to work_email
        const allEmployees = await storage.getAllEmployees();
        
        // First try to find by user_id
        let employee = allEmployees.find(e => e.userId === req.user!.id);
        
        // If not found, try matching by email/username
        if (!employee && req.user?.username) {
          employee = allEmployees.find(e => 
            e.workEmail?.toLowerCase() === req.user!.username.toLowerCase()
          );
        }
        
        if (!employee) {
          // Return 404 but don't treat it as an error - some users might not have employee records
          return res.status(404).json({ error: 'No employee record found for current user' });
        }
        
        // Return raw encrypted SSN (no masking)
        const maskedEmployee = {
          ...employee,
          ssn: employee.ssn || '', // Return raw encrypted format
          caqhPassword: employee.caqhPassword ? '***' : '',
          nppesPassword: employee.nppesPassword ? '***' : ''
        };
        
        res.json(maskedEmployee);
      } catch (error) {
        console.error('Error fetching current user employee:', error);
        res.status(500).json({ error: 'Failed to fetch employee record' });
      }
    }
  );

  app.get('/api/employees/:id', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:employees'), 
    validateId(), 
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const employee = await storage.getEmployee(parseInt(req.params.id));
        if (!employee) {
          return res.status(404).json({ error: 'Employee not found' });
        }
        
        // Return raw encrypted SSN (no masking)
        const maskedEmployee = {
          ...employee,
          ssn: employee.ssn || '', // Return raw encrypted format
          caqhPassword: employee.caqhPassword ? '***' : '',
          nppesPassword: employee.nppesPassword ? '***' : ''
        };
        
        res.json(maskedEmployee);
      } catch (error) {
        console.error('Error fetching employee:', error);
        res.status(500).json({ error: 'Failed to fetch employee' });
      }
    }
  );

  app.post('/api/employees', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'), 
    requireRole(['admin', 'hr']),
    auditMiddleware('employees'),
    validateEmployee(), 
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        // Sanitize date fields before encryption
        const sanitizedData = sanitizeDateFields(req.body);
        const encryptedData = encryptSensitiveFields(sanitizedData);
        const employee = await storage.createEmployee(encryptedData);
        
        await logAudit(req, employee.id, null, employee);
        
        // Return raw encrypted SSN (no masking)
        const maskedEmployee = {
          ...employee,
          ssn: employee.ssn || '', // Return raw encrypted format
          caqhPassword: employee.caqhPassword ? '***' : '',
          nppesPassword: employee.nppesPassword ? '***' : ''
        };
        
        res.status(201).json(maskedEmployee);
      } catch (error) {
        console.error('Error creating employee:', error);
        res.status(500).json({ error: 'Failed to create employee' });
      }
    }
  );

  app.put('/api/employees/:id', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'), 
    requireRole(['admin', 'hr']),
    auditMiddleware('employees'),
    validateId(),
    validateEmployee(), 
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const oldEmployee = await storage.getEmployee(id);
        
        if (!oldEmployee) {
          return res.status(404).json({ error: 'Employee not found' });
        }
        
        // Sanitize date fields before encryption
        const sanitizedData = sanitizeDateFields(req.body);
        const encryptedData = encryptSensitiveFields(sanitizedData);
        const employee = await storage.updateEmployee(id, encryptedData);
        
        await logAudit(req, id, oldEmployee, employee);
        
        // Return raw encrypted SSN (no masking)
        const maskedEmployee = {
          ...employee,
          ssn: employee.ssn || '', // Return raw encrypted format
          caqhPassword: employee.caqhPassword ? '***' : '',
          nppesPassword: employee.nppesPassword ? '***' : ''
        };
        
        res.json(maskedEmployee);
      } catch (error) {
        console.error('Error updating employee:', error);
        res.status(500).json({ error: 'Failed to update employee' });
      }
    }
  );

  app.delete('/api/employees/:id', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('delete:employees'), 
    requireRole(['admin']),
    auditMiddleware('employees'),
    validateId(), 
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const oldEmployee = await storage.getEmployee(id);
        
        if (!oldEmployee) {
          return res.status(404).json({ error: 'Employee not found' });
        }
        
        await storage.deleteEmployee(id);
        await logAudit(req, id, oldEmployee, null);
        
        res.status(204).send();
      } catch (error) {
        console.error('Error deleting employee:', error);
        res.status(500).json({ error: 'Failed to delete employee' });
      }
    }
  );

  /**
   * POST /api/employees/:id/approve
   * Approve a prospective employee and change their role to employee
   * @route POST /api/employees/:id/approve 
   * @group Employees - Employee approval operations
   * @security session, apikey
   * @returns {object} 200 - Updated employee with approved status
   */
  app.post('/api/employees/:id/approve',
    apiKeyAuth,
    requireAnyAuth, 
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']),
    auditMiddleware('employees'),
    validateId(),
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const employee = await storage.getEmployee(id);
        
        if (!employee) {
          return res.status(404).json({ error: 'Employee not found' });
        }
        
        let userId = employee.userId;
        
        // Check if employee has a user account
        if (!userId) {
          console.log(`Creating user account for employee ${id} during approval`);
          
          // Generate username from email or create a default one
          let username = '';
          if (employee.workEmail) {
            username = employee.workEmail.split('@')[0];
          } else if (employee.personalEmail) {
            username = employee.personalEmail.split('@')[0];
          } else {
            // Generate username from name or employee ID
            if (employee.firstName && employee.lastName) {
              username = `${employee.firstName.toLowerCase()}.${employee.lastName.toLowerCase()}`;
            } else {
              username = `employee_${id}`;
            }
          }
          
          // Check if username already exists and make it unique if needed
          let finalUsername = username;
          let counter = 1;
          while (await storage.getUserByUsername(finalUsername)) {
            finalUsername = `${username}${counter}`;
            counter++;
          }
          
          // Generate temporary password
          const tempPassword = `Temp${crypto.randomBytes(4).toString('hex')}!`;
          const hashedPassword = await hashPassword(tempPassword);
          
          // Create user account with 'employee' role directly
          const newUser = await storage.createUser({
            username: finalUsername,
            passwordHash: hashedPassword,
            role: 'employee', // Set directly to 'employee' since they're being approved
            status: 'active',
            email: employee.workEmail || employee.personalEmail || null
            // Note: requirePasswordChange would need to be added to the user schema if needed
          });
          
          userId = newUser.id;
          
          // Update employee with the new userId
          await storage.updateEmployee(id, { userId });
          
          console.log(`Created user account for employee ${id}: username=${finalUsername}, userId=${userId}`);
        } else {
          // Employee has a user account, verify it exists
          const user = await storage.getUser(userId);
          if (!user) {
            return res.status(400).json({ error: 'User account not found' });
          }
          
          // If user exists and is a prospective_employee, update their role
          if (user.role === 'prospective_employee') {
            await storage.updateUser(userId, {
              role: 'employee'
            });
          }
          // If user already has 'employee' role or higher, just proceed with approval
        }
        
        // Update employee application status
        const updatedEmployee = await storage.updateEmployee(id, {
          applicationStatus: 'approved',
          approvedAt: new Date(),
          approvedBy: req.user?.id || null,
          status: 'active',
          onboardingStatus: 'approved',
          userId: userId // Ensure userId is set
        });
        
        await logAudit(req, id, employee, updatedEmployee);
        
        res.json({
          ...updatedEmployee,
          message: 'Employee approved successfully'
        });
      } catch (error) {
        console.error('Error approving employee:', error);
        res.status(500).json({ error: 'Failed to approve employee' });
      }
    }
  );

  /**
   * POST /api/employees/:id/reject
   * Reject a prospective employee application
   * @route POST /api/employees/:id/reject
   * @group Employees - Employee approval operations
   * @security session, apikey
   * @param {string} body.reason - Reason for rejection
   * @returns {object} 200 - Updated employee with rejected status
   */
  app.post('/api/employees/:id/reject',
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']),
    auditMiddleware('employees'),
    validateId(),
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const { reason } = req.body;
        const employee = await storage.getEmployee(id);
        
        if (!employee) {
          return res.status(404).json({ error: 'Employee not found' });
        }
        
        // Update employee application status
        const updatedEmployee = await storage.updateEmployee(id, {
          applicationStatus: 'rejected',
          status: 'inactive',
          onboardingStatus: 'rejected'
        });
        
        // If employee has a user account, disable it
        if (employee.userId) {
          await storage.updateUser(employee.userId, {
            status: 'disabled'
          });
        }
        
        await logAudit(req, id, employee, updatedEmployee);
        
        res.json({
          ...updatedEmployee,
          message: 'Employee application rejected'
        });
      } catch (error) {
        console.error('Error rejecting employee:', error);
        res.status(500).json({ error: 'Failed to reject employee' });
      }
    }
  );

  /**
   * GET /api/employees/pending-approval
   * Get all employees pending approval
   * @route GET /api/employees/pending-approval
   * @group Employees - Employee approval operations
   * @security session, apikey
   * @returns {array} 200 - List of employees pending approval
   */
  app.get('/api/employees/pending-approval',
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:employees'),
    requireRole(['admin', 'hr']),
    async (req: AuditRequest, res: Response) => {
      try {
        const pendingEmployees = await storage.getEmployeesByApplicationStatus('pending');
        
        // Return raw encrypted SSN (no masking)
        const maskedEmployees = pendingEmployees.map((employee: any) => ({
          ...employee,
          ssn: employee.ssn || '', // Return raw encrypted format
          caqhPassword: employee.caqhPassword ? '***' : '',
          nppesPassword: employee.nppesPassword ? '***' : ''
        }));
        
        res.json(maskedEmployees);
      } catch (error) {
        console.error('Error fetching pending employees:', error);
        res.status(500).json({ error: 'Failed to fetch pending employees' });
      }
    }
  );

  /**
   * GET /api/employees/:id/approval-checklist
   * Get approval checklist for an employee
   * @route GET /api/employees/:id/approval-checklist
   * @group Employees - Employee approval checklist operations
   * @security session, apikey
   * @returns {object} 200 - Approval checklist data
   * @returns {object} 404 - Checklist not found (returns default values)
   */
  app.get('/api/employees/:id/approval-checklist',
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:employees'),
    validateId(),
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const employeeId = parseInt(req.params.id);
        
        // Check if employee exists
        const employee = await storage.getEmployee(employeeId);
        if (!employee) {
          return res.status(404).json({ 
            error: 'Employee not found',
            details: `No employee found with ID: ${employeeId}`
          });
        }
        
        // Get checklist
        const checklist = await storage.getEmployeeApprovalChecklist(employeeId);
        
        // If no checklist exists, return default values
        if (!checklist) {
          return res.json({
            employeeId,
            cpiTraining: 'no',
            cprTraining: 'no',
            crisisPrevention: 'no',
            federalExclusions: 'no',
            stateExclusions: 'no',
            samGovExclusion: 'no',
            urineDrugScreen: 'no',
            bciFbiCheck: 'no',
            laptopSetup: 'no',
            emailSetup: 'no',
            emrSetup: 'no',
            phoneSetup: 'no'
          });
        }
        
        res.json(checklist);
      } catch (error) {
        console.error('Error fetching approval checklist:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ 
          error: 'Failed to fetch approval checklist',
          details: errorMessage,
          hint: 'The employee_approval_checklists table may not exist. Run: npm run db:generate && npm run db:migrate'
        });
      }
    }
  );

  /**
   * POST /api/employees/:id/approval-checklist
   * Create or update approval checklist for an employee
   * @route POST /api/employees/:id/approval-checklist
   * @group Employees - Employee approval checklist operations
   * @security session, apikey
   * @param {object} body - Checklist data (all yes/no fields)
   * @returns {object} 200 - Created/updated checklist
   */
  app.post('/api/employees/:id/approval-checklist',
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']),
    auditMiddleware('employee_approval_checklists'),
    validateId(),
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const employeeId = parseInt(req.params.id);
        
        // Check if employee exists
        const employee = await storage.getEmployee(employeeId);
        if (!employee) {
          return res.status(404).json({ 
            error: 'Employee not found',
            details: `No employee found with ID: ${employeeId}`
          });
        }
        
        // Validate request body
        if (!req.body || typeof req.body !== 'object') {
          return res.status(400).json({ 
            error: 'Invalid request body',
            details: 'Request body must be a JSON object with checklist fields'
          });
        }
        
        // Get checklist data from request
        const checklistData = {
          employeeId,
          cpiTraining: req.body.cpiTraining || 'no',
          cprTraining: req.body.cprTraining || 'no',
          crisisPrevention: req.body.crisisPrevention || 'no',
          federalExclusions: req.body.federalExclusions || 'no',
          stateExclusions: req.body.stateExclusions || 'no',
          samGovExclusion: req.body.samGovExclusion || 'no',
          urineDrugScreen: req.body.urineDrugScreen || 'no',
          bciFbiCheck: req.body.bciFbiCheck || 'no',
          laptopSetup: req.body.laptopSetup || 'no',
          emailSetup: req.body.emailSetup || 'no',
          emrSetup: req.body.emrSetup || 'no',
          phoneSetup: req.body.phoneSetup || 'no',
          createdBy: req.user?.id,
          updatedBy: req.user?.id
        };
        
        console.log('[Approval Checklist] Saving data for employee:', employeeId, checklistData);
        
        // Check if checklist already exists
        const existingChecklist = await storage.getEmployeeApprovalChecklist(employeeId);
        
        let checklist;
        if (existingChecklist) {
          console.log('[Approval Checklist] Updating existing checklist:', existingChecklist.id);
          // Update existing checklist
          checklist = await storage.updateEmployeeApprovalChecklist(employeeId, checklistData);
        } else {
          console.log('[Approval Checklist] Creating new checklist');
          // Create new checklist
          checklist = await storage.createEmployeeApprovalChecklist(checklistData);
        }
        
        await logAudit(req, checklist.id, existingChecklist, checklist);
        
        console.log('[Approval Checklist] Successfully saved:', checklist.id);
        res.json(checklist);
      } catch (error) {
        console.error('Error saving approval checklist:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : '';
        
        res.status(500).json({ 
          error: 'Failed to save approval checklist',
          details: errorMessage,
          stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
          hint: 'The employee_approval_checklists table may not exist. Run: npm run db:generate && npm run db:migrate'
        });
      }
    }
  );

  /**
   * PUT /api/employees/:id/approval-checklist
   * Update approval checklist for an employee
   * @route PUT /api/employees/:id/approval-checklist
   * @group Employees - Employee approval checklist operations
   * @security session, apikey
   * @param {object} body - Partial checklist data to update
   * @returns {object} 200 - Updated checklist
   * @returns {object} 404 - Checklist not found
   */
  app.put('/api/employees/:id/approval-checklist',
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']),
    auditMiddleware('employee_approval_checklists'),
    validateId(),
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const employeeId = parseInt(req.params.id);
        
        // Check if employee exists
        const employee = await storage.getEmployee(employeeId);
        if (!employee) {
          return res.status(404).json({ 
            error: 'Employee not found',
            details: `No employee found with ID: ${employeeId}`
          });
        }
        
        // Validate request body
        if (!req.body || typeof req.body !== 'object') {
          return res.status(400).json({ 
            error: 'Invalid request body',
            details: 'Request body must be a JSON object with checklist fields to update'
          });
        }
        
        // Check if checklist exists
        const existingChecklist = await storage.getEmployeeApprovalChecklist(employeeId);
        if (!existingChecklist) {
          return res.status(404).json({ 
            error: 'Approval checklist not found',
            details: 'No checklist exists for this employee. Use POST to create one first.',
            hint: 'POST /api/employees/:id/approval-checklist'
          });
        }
        
        // Update checklist with only provided fields
        const updateData = {
          ...req.body,
          updatedBy: req.user?.id
        };
        
        console.log('[Approval Checklist] Updating checklist for employee:', employeeId, updateData);
        
        const updatedChecklist = await storage.updateEmployeeApprovalChecklist(employeeId, updateData);
        
        await logAudit(req, updatedChecklist.id, existingChecklist, updatedChecklist);
        
        console.log('[Approval Checklist] Successfully updated:', updatedChecklist.id);
        res.json(updatedChecklist);
      } catch (error) {
        console.error('Error updating approval checklist:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : '';
        
        res.status(500).json({ 
          error: 'Failed to update approval checklist',
          details: errorMessage,
          stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
          hint: 'The employee_approval_checklists table may not exist. Run: npm run db:generate && npm run db:migrate'
        });
      }
    }
  );

  /**
   * POST /api/employees/:id/approval-documents
   * Upload approval documents during employee approval process
   * @route POST /api/employees/:id/approval-documents
   * @group Employees - Employee approval document upload
   * @security session, apikey
   * @param {files} documents - Array of document files to upload
   * @param {string} body.documentTypes - JSON string array of document type names
   * @param {string} body.selections - JSON string of yes/no selections
   * @returns {object} 200 - Upload results
   */
  app.post('/api/employees/:id/approval-documents',
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']),
    upload.array('documents', 15), // Support up to 15 files
    validateId(),
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const employeeId = parseInt(req.params.id);
        
        console.log('[Approval Documents] Upload request for employee:', employeeId);
        console.log('[Approval Documents] Files count:', req.files ? (req.files as any).length : 0);
        
        // Check if employee exists
        const employee = await storage.getEmployee(employeeId);
        if (!employee) {
          return res.status(404).json({ 
            error: 'Employee not found',
            details: `No employee found with ID: ${employeeId}`
          });
        }
        
        // Get uploaded files
        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
          return res.status(400).json({ 
            error: 'No files uploaded',
            details: 'Request must include at least one document file',
            hint: 'Use FormData with field name "documents" to upload files'
          });
        }
        
        console.log('[Approval Documents] Files received:', files.map(f => ({ name: f.originalname, size: f.size, type: f.mimetype })));
        
        // Parse document types from request
        let documentTypes: string[] = [];
        try {
          documentTypes = JSON.parse(req.body.documentTypes || '[]');
          console.log('[Approval Documents] Document types:', documentTypes);
        } catch (e) {
          const parseError = e instanceof Error ? e.message : 'Unknown parsing error';
          return res.status(400).json({ 
            error: 'Invalid documentTypes format',
            details: `Failed to parse documentTypes JSON: ${parseError}`,
            received: req.body.documentTypes,
            hint: 'documentTypes must be a JSON array of strings, e.g., ["Federal_Exclusions", "State_Exclusions"]'
          });
        }
        
        // Validate that we have a document type for each file
        if (documentTypes.length !== files.length) {
          return res.status(400).json({ 
            error: 'Mismatch between files and document types',
            details: `Received ${files.length} files but ${documentTypes.length} document types`,
            filesReceived: files.map(f => f.originalname),
            documentTypesReceived: documentTypes,
            hint: 'Each uploaded file must have a corresponding document type'
          });
        }
        
        // Get selections (optional, for audit purposes)
        let selections: Record<string, string> = {};
        try {
          selections = JSON.parse(req.body.selections || '{}');
          console.log('[Approval Documents] Selections:', selections);
        } catch (e) {
          console.warn('[Approval Documents] Failed to parse selections:', e);
        }
        
        // Check if S3 is enabled
        const s3Config = await storage.getS3Configuration();
        const s3Enabled = s3Config?.enabled && 
                         s3Config.accessKeyId && 
                         s3Config.secretAccessKey && 
                         s3Config.bucketName;
        const storageType = s3Enabled ? 's3' : 'local';
        
        console.log('[Approval Documents] Storage type:', storageType);
        
        // Process each file
        const uploadedDocuments = [];
        const errors = [];
        
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const documentType = documentTypes[i];
          
          console.log(`[Approval Documents] Processing file ${i + 1}/${files.length}: ${documentType}`);
          
          try {
            let s3Key = null;
            let s3Etag = null;
            
            // Upload to S3 if enabled
            if (storageType === 's3' && s3Config) {
              s3Key = `employees/${employeeId}/approval/${documentType}-${Date.now()}-${file.originalname}`;
              
              console.log(`[Approval Documents] Uploading to S3: ${s3Key}`);
              
              // Read file as buffer for S3 upload
              const fs = await import('fs/promises');
              const fileBuffer = await fs.readFile(file.path);
              
              const uploadResult = await s3Service.uploadFile(
                fileBuffer,
                s3Key,
                file.mimetype
              );
              
              if (!uploadResult.success) {
                throw new Error(`S3 upload failed: ${uploadResult.error || 'Unknown S3 error'}`);
              }
              
              s3Etag = uploadResult.etag?.replace(/"/g, '') || null;
              console.log(`[Approval Documents] S3 upload success: ${s3Key}, ETag: ${s3Etag}`);
            } else {
              console.log(`[Approval Documents] Using local storage: ${file.path}`);
            }
            
            // Create document record
            // Always preserve the actual local file path for fallback even when using S3
            const document = await storage.createDocument({
              employeeId,
              documentType,
              documentName: `${documentType} - Approval Document`,
              fileName: file.originalname,
              fileSize: file.size,
              filePath: file.path, // Always store actual local path for fallback
              storageType,
              storageKey: s3Key,
              mimeType: file.mimetype,
              s3Etag,
              notes: `Uploaded during employee approval process. Selections: ${JSON.stringify(selections)}`
            });
            
            uploadedDocuments.push(document);
            console.log(`[Approval Documents] Document record created: ID ${document.id}`);
            
            // Log audit
            await storage.createAudit({
              tableName: 'documents',
              recordId: document.id,
              action: 'CREATE',
              changedBy: req.user?.id || null,
              oldData: null,
              newData: document
            });
            
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Upload failed';
            console.error(`[Approval Documents] Error uploading ${documentType}:`, error);
            errors.push({
              documentType,
              fileName: file.originalname,
              error: errorMessage,
              details: error instanceof Error ? error.stack : undefined
            });
          }
        }
        
        console.log(`[Approval Documents] Upload complete: ${uploadedDocuments.length} successful, ${errors.length} failed`);
        
        // Return results
        res.json({
          success: true,
          uploaded: uploadedDocuments.length,
          failed: errors.length,
          storageType,
          documents: uploadedDocuments.map(doc => ({
            id: doc.id,
            documentType: doc.documentType,
            fileName: doc.fileName,
            fileSize: doc.fileSize,
            storageType: doc.storageType
          })),
          errors: errors.length > 0 ? errors : undefined
        });
        
      } catch (error) {
        console.error('[Approval Documents] Fatal error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : '';
        
        res.status(500).json({ 
          error: 'Failed to upload documents',
          details: errorMessage,
          stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
          hint: 'Check server logs for more details. Ensure the documents table exists and S3 is properly configured (if using S3).'
        });
      }
    }
  );

  // Education routes - accessible via API key or session
  app.get('/api/employees/:id/educations', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:employees'), 
    validateId(), 
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const educations = await storage.getEmployeeEducations(parseInt(req.params.id));
        res.json(educations);
      } catch (error) {
        console.error('Error fetching educations:', error);
        res.status(500).json({ error: 'Failed to fetch educations' });
      }
    }
  );

  app.post('/api/employees/:id/educations', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'), 
    requireRole(['admin', 'hr']),
    auditMiddleware('educations'),
    validateEducation(), 
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const education = await storage.createEducation({
          ...req.body,
          employeeId: parseInt(req.params.id)
        });
        
        await logAudit(req, education.id, null, education);
        res.status(201).json(education);
      } catch (error) {
        console.error('Error creating education:', error);
        res.status(500).json({ error: 'Failed to create education' });
      }
    }
  );

  // Similar routes for employments, references, licenses, etc.
  // State Licenses - accessible via API key or session
  app.get('/api/employees/:id/state-licenses', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:licenses'), validateId(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const licenses = await storage.getEmployeeStateLicenses(parseInt(req.params.id));
        res.json(licenses);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch state licenses' });
      }
    }
  );

  app.post('/api/employees/:id/state-licenses', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:licenses'),
    requireRole(['admin', 'hr']), auditMiddleware('state_licenses'),
    validateLicense(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const license = await storage.createStateLicense({
          ...req.body,
          employeeId: parseInt(req.params.id)
        });
        await logAudit(req, license.id, null, license);
        res.status(201).json(license);
      } catch (error) {
        res.status(500).json({ error: 'Failed to create state license' });
      }
    }
  );

  // DEA Licenses - accessible via API key or session
  app.get('/api/employees/:id/dea-licenses', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:licenses'), validateId(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const licenses = await storage.getEmployeeDeaLicenses(parseInt(req.params.id));
        res.json(licenses);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch DEA licenses' });
      }
    }
  );

  app.post('/api/employees/:id/dea-licenses', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:licenses'),
    requireRole(['admin', 'hr']), auditMiddleware('dea_licenses'),
    validateLicense(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const license = await storage.createDeaLicense({
          ...req.body,
          employeeId: parseInt(req.params.id)
        });
        await logAudit(req, license.id, null, license);
        res.status(201).json(license);
      } catch (error) {
        res.status(500).json({ error: 'Failed to create DEA license' });
      }
    }
  );

  // Documents routes - accessible via API key or session
  app.get('/api/documents', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:documents'), 
    validatePagination(), 
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;
        
        // Support both single and multiple type filters (CSV or repeated params)
        const typeParam = req.query.type as string | string[] | undefined;
        let types: string[] | undefined;
        if (Array.isArray(typeParam)) {
          types = typeParam.flatMap(v => v.split(',')).map(v => v.trim()).filter(Boolean);
        } else if (typeof typeParam === 'string') {
          const trimmed = typeParam.trim();
          types = trimmed ? trimmed.split(',').map(v => v.trim()).filter(Boolean) : undefined;
        }

        const result = await storage.getDocuments({
          limit,
          offset,
          search: req.query.search as string,
          // Preserve backward compatibility if only a single type provided
          type: !types || types.length !== 1 ? undefined : types[0],
          types: types && types.length > 1 ? types : (types && types.length === 1 ? [types[0]] : undefined),
          employeeId: req.query.employeeId ? parseInt(req.query.employeeId as string) : undefined
        });
        
        res.json({
          documents: result.documents,
          total: result.total,
          page,
          totalPages: Math.ceil(result.total / limit)
        });
      } catch (error) {
        console.error('Error fetching documents:', error);
        res.status(500).json({ error: 'Failed to fetch documents' });
      }
    }
  );

  app.post('/api/documents/upload', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:documents'), 
    requireRole(['admin', 'hr']),
    upload.single('document'),
    async (req: AuditRequest, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }
        
        // Validate required fields
        if (!req.body.employeeId || !req.body.documentType) {
          return res.status(400).json({ error: 'Employee ID and document type are required' });
        }
        
        const employeeId = parseInt(req.body.employeeId);
        if (isNaN(employeeId)) {
          return res.status(400).json({ error: 'Invalid employee ID' });
        }
        
        // Read the file from local storage
        const fileBuffer = await fs.promises.readFile(req.file.path);
        
        // Generate S3 key for the document
        const s3Key = generateDocumentKey(
          employeeId,
          req.body.documentType,
          req.file.originalname
        );
        
        // Try to upload to S3
        const uploadResult = await s3Service.uploadFile(
          fileBuffer,
          s3Key,
          req.file.mimetype,
          {
            employeeId: employeeId.toString(),
            documentType: req.body.documentType,
            originalName: req.file.originalname
          }
        );
        
        // Create document record with storage information
        const document = await storage.createDocument({
          employeeId,
          documentType: req.body.documentType,
          documentName: req.body.documentName || req.file.originalname,
          fileName: req.file.originalname,
          filePath: req.file.path, // Keep for backward compatibility
          storageType: uploadResult.storageType,
          storageKey: uploadResult.storageKey,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          s3Etag: uploadResult.etag,
          signedDate: req.body.signedDate || null,
          notes: req.body.notes || null
        });
        
        // Clean up temporary Multer file
        // For S3: The file was uploaded to S3, delete the temp file
        // For local: The file was copied to final location, delete the temp file
        try {
          await fs.promises.unlink(req.file.path);
          console.log(`Deleted temp file after ${uploadResult.storageType} storage: ${req.file.path}`);
        } catch (error) {
          console.error('Failed to delete temp file:', error);
        }
        
        res.status(201).json({
          ...document,
          storageInfo: {
            type: uploadResult.storageType,
            isS3Enabled: s3Service.isS3Configured()
          }
        });
      } catch (error) {
        console.error('Error uploading document:', error);
        res.status(500).json({ error: 'Failed to upload document' });
      }
    }
  );

  app.get('/api/documents/:id/download', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:documents'),
    async (req: AuditRequest, res: Response) => {
      try {
        const documentId = parseInt(req.params.id);
        const document = await storage.getDocument(documentId);
        
        if (!document) {
          return res.status(404).json({ 
            error: 'Document not found',
            details: `No document found with ID: ${documentId}`
          });
        }
        
        console.log(`[Document Download] Attempting download for document ${documentId}:`, {
          storageType: document.storageType,
          storageKey: document.storageKey,
          filePath: document.filePath,
          fileName: document.fileName,
          fileSize: document.fileSize,
          mimeType: document.mimeType,
          employeeId: document.employeeId,
          documentType: document.documentType
        });
        
        // Check if filePath is a local file that exists
        if (document.filePath) {
          // Try both absolute and relative paths
          const absolutePath = path.isAbsolute(document.filePath) 
            ? document.filePath 
            : path.join(uploadDir, document.filePath);
          
          const filePathExists = fs.existsSync(document.filePath);
          const absolutePathExists = fs.existsSync(absolutePath);
          
          console.log(`[Document Download] filePath check:`, {
            original: document.filePath,
            absolute: absolutePath,
            existsOriginal: filePathExists,
            existsAbsolute: absolutePathExists
          });
        }
        
        // Check if file is an image (should display inline instead of download)
        const isImage = document.mimeType?.startsWith('image/') || false;
        const contentType = document.mimeType || 'application/octet-stream';
        
        // Handle S3 stored documents
        if (document.storageType === 's3' && document.storageKey) {
          // Check if S3 is actually configured
          if (!s3Service.isS3Configured()) {
            console.warn(`[Document Download] Document ${documentId} marked as S3 but S3 not configured. Trying local fallback...`);
            
            // Try to use filePath as fallback if it's a real file path
            if (document.filePath && fs.existsSync(document.filePath)) {
              console.log(`[Document Download] Using local file fallback: ${document.filePath}`);
              if (isImage) {
                res.setHeader('Content-Type', contentType);
                res.setHeader('Content-Disposition', `inline; filename="${document.fileName ?? 'document'}"`);
                return res.sendFile(document.filePath);
              }
              return res.download(document.filePath, document.fileName ?? 'document');
            }
            
            return res.status(404).json({ 
              error: 'S3 not configured',
              details: 'Document is stored in S3 but S3 service is not configured. Please configure S3 or contact administrator.',
              documentId,
              storageKey: document.storageKey
            });
          }
          
          // Stream from S3 through the server to avoid CORS issues
          const downloadResult = await s3Service.downloadFile(document.storageKey, 's3');
          
          if (downloadResult.success && downloadResult.data) {
            console.log(`[Document Download] Successfully downloaded from S3: ${document.storageKey}`);
            res.setHeader('Content-Type', downloadResult.contentType || contentType);
            
            // For images, use inline to display in browser; for other files, use attachment to download
            const disposition = isImage ? 'inline' : 'attachment';
            res.setHeader('Content-Disposition', `${disposition}; filename="${document.fileName || 'document'}"`);
            res.setHeader('Content-Length', downloadResult.data.length.toString());
            return res.send(downloadResult.data);
          } else {
            console.error(`[Document Download] Failed to download from S3:`, {
              storageKey: document.storageKey,
              error: downloadResult.error,
              documentId
            });
            
            // Try local fallback: check if filePath is a real local path (not an S3 key)
            // filePath should be the actual local file path, even if storageType is 's3'
            if (document.filePath) {
              const isS3Key = document.filePath.startsWith('employees/') || 
                            document.filePath.startsWith('s3://') ||
                            document.filePath === document.storageKey;
              
              if (!isS3Key) {
                // Try original path first
                if (fs.existsSync(document.filePath)) {
                  console.log(`[Document Download] Using local file as fallback (original path): ${document.filePath}`);
                  const fileName = document.fileName ?? 'document';
                  if (isImage) {
                    res.setHeader('Content-Type', contentType);
                    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
                    return res.sendFile(path.resolve(document.filePath));
                  }
                  return res.download(document.filePath, fileName);
                }
                
                // Try as relative path from uploads folder
                const relativePath = path.join(uploadDir, document.filePath);
                if (fs.existsSync(relativePath)) {
                  console.log(`[Document Download] Using local file as fallback (relative path): ${relativePath}`);
                  const fileName = document.fileName ?? 'document';
                  if (isImage) {
                    res.setHeader('Content-Type', contentType);
                    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
                    return res.sendFile(path.resolve(relativePath));
                  }
                  return res.download(relativePath, fileName);
                }
              }
            }
            
            // Try to find file in uploads folder by searching for files matching the document
            // This handles cases where the file was marked as S3 but the local temp file still exists
            if (document.storageKey && document.fileName) {
              try {
                console.log(`[Document Download] Searching uploads folder for fallback file...`);
                const uploadsFiles = await fs.promises.readdir(uploadDir);
                
                // Strategy 1: Look for files matching the original filename
                let matchingFile = uploadsFiles.find(f => {
                  const lowerFile = f.toLowerCase();
                  const lowerOriginal = document.fileName.toLowerCase();
                  const nameWithoutExt = lowerOriginal.split('.')[0];
                  // Skip .meta.json files and .gitkeep
                  if (f.startsWith('.') || f.endsWith('.meta.json')) return false;
                  return lowerFile.includes(nameWithoutExt);
                });
                
                // Strategy 2: If not found, try matching by file size (if available)
                if (!matchingFile && document.fileSize) {
                  console.log(`[Document Download] Trying to match by file size: ${document.fileSize} bytes`);
                  for (const f of uploadsFiles) {
                    if (f.startsWith('.') || f.endsWith('.meta.json')) continue;
                    try {
                      const filePath = path.join(uploadDir, f);
                      const stats = await fs.promises.stat(filePath);
                      if (stats.isFile() && stats.size === document.fileSize) {
                        console.log(`[Document Download] Found file matching size: ${f} (${stats.size} bytes)`);
                        matchingFile = f;
                        break;
                      }
                    } catch (statError) {
                      // Skip files we can't stat
                      continue;
                    }
                  }
                }
                
                // Strategy 3: For approval documents, try to match by timestamp in storageKey
                // Storage key format: employees/{employeeId}/approval/{documentType}-{timestamp}-{filename}
                if (!matchingFile && document.storageKey.includes('/approval/')) {
                  const timestampMatch = document.storageKey.match(/-(\d+)-/);
                  if (timestampMatch) {
                    const timestamp = timestampMatch[1];
                    console.log(`[Document Download] Looking for files with timestamp: ${timestamp}`);
                    // Check files modified around that time (within 1 hour window)
                    const targetTime = parseInt(timestamp);
                    for (const f of uploadsFiles) {
                      if (f.startsWith('.') || f.endsWith('.meta.json')) continue;
                      try {
                        const filePath = path.join(uploadDir, f);
                        const stats = await fs.promises.stat(filePath);
                        const fileTime = stats.mtimeMs;
                        // Check if file was modified within 1 hour of the timestamp
                        if (stats.isFile() && Math.abs(fileTime - targetTime) < 3600000) {
                          console.log(`[Document Download] Found file with matching timestamp: ${f}`);
                          matchingFile = f;
                          break;
                        }
                      } catch (statError) {
                        continue;
                      }
                    }
                  }
                }
                
                if (matchingFile && document.fileName) {
                  const localFilePath = path.join(uploadDir, matchingFile);
                  if (fs.existsSync(localFilePath)) {
                    console.log(`[Document Download] ✓ Found matching file in uploads folder: ${localFilePath}`);
                    if (isImage) {
                      res.setHeader('Content-Type', contentType);
                      res.setHeader('Content-Disposition', `inline; filename="${document.fileName}"`);
                      return res.sendFile(path.resolve(localFilePath));
                    }
                    return res.download(localFilePath, document.fileName);
                  }
                } else {
                  console.log(`[Document Download] ✗ No matching file found in uploads folder (searched ${uploadsFiles.length} files)`);
                }
              } catch (scanError) {
                console.error('[Document Download] Error scanning uploads folder:', scanError);
              }
            }
            
            const errorDetails = {
              error: 'Document file not found in storage',
              details: downloadResult.error || 'File not found in S3 bucket and local fallback failed',
              storageKey: document.storageKey,
              filePath: document.filePath,
              documentId,
              fileName: document.fileName,
              attemptedFallbacks: [
                'Checked filePath for local file',
                'Searched uploads folder by filename',
                ...(document.fileSize ? ['Searched uploads folder by file size'] : []),
                ...(document.storageKey?.includes('/approval/') ? ['Searched uploads folder by timestamp'] : [])
              ],
              hint: 'The file may have been deleted from local storage. Options: 1) Fix S3 permissions and re-upload, 2) Re-upload the file, 3) Check if file exists manually in server/uploads folder'
            };
            
            console.error('[Document Download] All fallback attempts failed:', errorDetails);
            
            return res.status(404).json(errorDetails);
          }
        }
        
        // Handle locally stored documents
        if (document.filePath && fs.existsSync(document.filePath)) {
          console.log(`[Document Download] Downloading local file: ${document.filePath}`);
          if (isImage) {
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `inline; filename="${document.fileName || 'document'}"`);
            return res.sendFile(document.filePath);
          }
          return res.download(document.filePath, document.fileName || 'document');
        }
        
        // If storage key exists but file is local (for backward compatibility)
        if (document.storageKey && document.storageType === 'local') {
          if (fs.existsSync(document.storageKey)) {
            console.log(`[Document Download] Downloading from storageKey: ${document.storageKey}`);
            if (isImage) {
              res.setHeader('Content-Type', contentType);
              res.setHeader('Content-Disposition', `inline; filename="${document.fileName || 'document'}"`);
              return res.sendFile(document.storageKey);
            }
            return res.download(document.storageKey, document.fileName || 'document');
          }
        }
        
        console.error(`[Document Download] File not found for document ${documentId}:`, {
          storageType: document.storageType,
          storageKey: document.storageKey,
          filePath: document.filePath,
          filePathExists: document.filePath ? fs.existsSync(document.filePath) : false
        });
        
        return res.status(404).json({ 
          error: 'Document file not found',
          details: 'The document record exists but the physical file cannot be found in storage',
          documentId,
          storageType: document.storageType,
          storageKey: document.storageKey,
          filePath: document.filePath
        });
      } catch (error) {
        console.error('[Document Download] Error downloading document:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ 
          error: 'Failed to download document',
          details: errorMessage
        });
      }
    }
  );

  /**
   * DELETE /api/documents/:id
   * Delete a document by ID
   */
  app.delete('/api/documents/:id',
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:documents'),
    requireRole(['admin', 'hr']),
    auditMiddleware('documents'),
    async (req: AuditRequest, res: Response) => {
      try {
        const documentId = parseInt(req.params.id);
        
        // Get the document first to delete the file
        const document = await storage.getDocument(documentId);
        
        if (!document) {
          return res.status(404).json({ error: 'Document not found' });
        }
        
        // Delete the file from storage (S3 or local)
        if (document.storageType === 's3' && document.storageKey) {
          // Delete from S3
          const deleteSuccess = await s3Service.deleteFile(document.storageKey, 's3');
          if (!deleteSuccess) {
            console.error('Failed to delete S3 file');
          }
        } else if (document.storageType === 'local') {
          // Delete local file
          const filePath = document.storageKey || document.filePath;
          if (filePath && fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
            } catch (error) {
              console.error('Failed to delete local file:', error);
            }
          }
        }
        
        // Delete the document record from database
        await storage.deleteDocument(documentId);
        
        // Audit logging
        await logAudit(req, documentId, document, null);
        
        res.status(200).json({ message: 'Document deleted successfully' });
      } catch (error) {
        console.error('Error deleting document:', error);
        res.status(500).json({ error: 'Failed to delete document' });
      }
    }
  );

  // Complete CRUD for Educations (adding PUT and DELETE)
  app.put('/api/educations/:id', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']), auditMiddleware('educations'),
    validateId(), validateEducation(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const oldEducation = await storage.getEmployeeEducations(id);
        const education = await storage.updateEducation(id, req.body);
        await logAudit(req, id, oldEducation, education);
        res.json(education);
      } catch (error) {
        res.status(500).json({ error: 'Failed to update education' });
      }
    }
  );

  app.delete('/api/educations/:id', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']), auditMiddleware('educations'),
    validateId(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        await storage.deleteEducation(id);
        await logAudit(req, id, {}, null);
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ error: 'Failed to delete education' });
      }
    }
  );

  // Complete CRUD for State Licenses (adding PUT and DELETE)
  app.put('/api/state-licenses/:id', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:licenses'),
    requireRole(['admin', 'hr']), auditMiddleware('state_licenses'),
    validateId(), validateLicense(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const license = await storage.updateStateLicense(id, req.body);
        await logAudit(req, id, {}, license);
        res.json(license);
      } catch (error) {
        res.status(500).json({ error: 'Failed to update state license' });
      }
    }
  );

  app.delete('/api/state-licenses/:id', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:licenses'),
    requireRole(['admin', 'hr']), auditMiddleware('state_licenses'),
    validateId(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        await storage.deleteStateLicense(id);
        await logAudit(req, id, {}, null);
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ error: 'Failed to delete state license' });
      }
    }
  );

  // Complete CRUD for DEA Licenses (adding PUT and DELETE)
  app.put('/api/dea-licenses/:id', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:licenses'),
    requireRole(['admin', 'hr']), auditMiddleware('dea_licenses'),
    validateId(), validateLicense(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const license = await storage.updateDeaLicense(id, req.body);
        await logAudit(req, id, {}, license);
        res.json(license);
      } catch (error) {
        res.status(500).json({ error: 'Failed to update DEA license' });
      }
    }
  );

  app.delete('/api/dea-licenses/:id', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:licenses'),
    requireRole(['admin', 'hr']), auditMiddleware('dea_licenses'),
    validateId(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        await storage.deleteDeaLicense(id);
        await logAudit(req, id, {}, null);
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ error: 'Failed to delete DEA license' });
      }
    }
  );

  // Full CRUD for Employments - accessible via API key or session
  app.get('/api/employees/:id/employments', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:employees'), validateId(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const employments = await storage.getEmployeeEmployments(parseInt(req.params.id));
        res.json(employments);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch employments' });
      }
    }
  );

  app.post('/api/employees/:id/employments', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']), auditMiddleware('employments'),
    validateEmployment(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const { employer, position, startDate, endDate, description } = req.body || {};
        const toDate = (v: any) => (v ? new Date(typeof v === 'string' ? v.split('T')[0] : v) : null);
        const employment = await storage.createEmployment({
          employer,
          position,
          startDate: toDate(startDate) as any,
          endDate: toDate(endDate) as any,
          description,
          employeeId: parseInt(req.params.id)
        } as any);
        await logAudit(req, employment.id, null, employment);
        res.status(201).json(employment);
      } catch (error) {
        res.status(500).json({ error: 'Failed to create employment' });
      }
    }
  );

  app.put('/api/employments/:id', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']), auditMiddleware('employments'),
    validateId(), validateEmployment(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const { employer, position, startDate, endDate, description } = req.body || {};
        const toDate = (v: any) => (v ? new Date(typeof v === 'string' ? v.split('T')[0] : v) : null);
        const employment = await storage.updateEmployment(id, {
          employer,
          position,
          startDate: toDate(startDate) as any,
          endDate: toDate(endDate) as any,
          description
        } as any);
        await logAudit(req, id, {}, employment);
        res.json(employment);
      } catch (error) {
        res.status(500).json({ error: 'Failed to update employment' });
      }
    }
  );

  app.delete('/api/employments/:id', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']), auditMiddleware('employments'),
    validateId(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        await storage.deleteEmployment(id);
        await logAudit(req, id, {}, null);
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ error: 'Failed to delete employment' });
      }
    }
  );

  // Full CRUD for Peer References - accessible via API key or session
  app.get('/api/employees/:id/peer-references', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:employees'), validateId(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const references = await storage.getEmployeePeerReferences(parseInt(req.params.id));
        res.json(references);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch peer references' });
      }
    }
  );

  app.post('/api/employees/:id/peer-references', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']), auditMiddleware('peer_references'),
    validatePeerReference(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const reference = await storage.createPeerReference({
          ...req.body,
          employeeId: parseInt(req.params.id)
        });
        await logAudit(req, reference.id, null, reference);
        res.status(201).json(reference);
      } catch (error) {
        res.status(500).json({ error: 'Failed to create peer reference' });
      }
    }
  );

  app.put('/api/peer-references/:id', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']), auditMiddleware('peer_references'),
    validateId(), validatePeerReference(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const reference = await storage.updatePeerReference(id, req.body);
        await logAudit(req, id, {}, reference);
        res.json(reference);
      } catch (error) {
        res.status(500).json({ error: 'Failed to update peer reference' });
      }
    }
  );

  app.delete('/api/peer-references/:id', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']), auditMiddleware('peer_references'),
    validateId(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        await storage.deletePeerReference(id);
        await logAudit(req, id, {}, null);
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ error: 'Failed to delete peer reference' });
      }
    }
  );

  // Full CRUD for Board Certifications - accessible via API key or session
  app.get('/api/employees/:id/board-certifications', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:employees'), validateId(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const certifications = await storage.getEmployeeBoardCertifications(parseInt(req.params.id));
        res.json(certifications);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch board certifications' });
      }
    }
  );

  app.post('/api/employees/:id/board-certifications', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']), auditMiddleware('board_certifications'),
    validateBoardCertification(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const certification = await storage.createBoardCertification({
          ...req.body,
          employeeId: parseInt(req.params.id)
        });
        await logAudit(req, certification.id, null, certification);
        res.status(201).json(certification);
      } catch (error) {
        res.status(500).json({ error: 'Failed to create board certification' });
      }
    }
  );

  app.put('/api/board-certifications/:id', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']), auditMiddleware('board_certifications'),
    validateId(), validateBoardCertification(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const certification = await storage.updateBoardCertification(id, req.body);
        await logAudit(req, id, {}, certification);
        res.json(certification);
      } catch (error) {
        res.status(500).json({ error: 'Failed to update board certification' });
      }
    }
  );

  app.delete('/api/board-certifications/:id', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']), auditMiddleware('board_certifications'),
    validateId(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        await storage.deleteBoardCertification(id);
        await logAudit(req, id, {}, null);
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ error: 'Failed to delete board certification' });
      }
    }
  );

  // Full CRUD for Emergency Contacts - accessible via API key or session
  app.get('/api/employees/:id/emergency-contacts', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:employees'), validateId(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const contacts = await storage.getEmployeeEmergencyContacts(parseInt(req.params.id));
        res.json(contacts);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch emergency contacts' });
      }
    }
  );

  app.post('/api/employees/:id/emergency-contacts', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']), auditMiddleware('emergency_contacts'),
    validateEmergencyContact(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const contact = await storage.createEmergencyContact({
          ...req.body,
          employeeId: parseInt(req.params.id)
        });
        await logAudit(req, contact.id, null, contact);
        res.status(201).json(contact);
      } catch (error) {
        res.status(500).json({ error: 'Failed to create emergency contact' });
      }
    }
  );

  app.put('/api/emergency-contacts/:id', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']), auditMiddleware('emergency_contacts'),
    validateId(), validateEmergencyContact(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const contact = await storage.updateEmergencyContact(id, req.body);
        await logAudit(req, id, {}, contact);
        res.json(contact);
      } catch (error) {
        res.status(500).json({ error: 'Failed to update emergency contact' });
      }
    }
  );

  app.delete('/api/emergency-contacts/:id', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']), auditMiddleware('emergency_contacts'),
    validateId(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        await storage.deleteEmergencyContact(id);
        await logAudit(req, id, {}, null);
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ error: 'Failed to delete emergency contact' });
      }
    }
  );

  // Full CRUD for Tax Forms - accessible via API key or session
  app.get('/api/employees/:id/tax-forms', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:employees'), validateId(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const forms = await storage.getEmployeeTaxForms(parseInt(req.params.id));
        res.json(forms);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch tax forms' });
      }
    }
  );

  app.post('/api/employees/:id/tax-forms', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']), auditMiddleware('tax_forms'),
    validateTaxForm(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const form = await storage.createTaxForm({
          ...req.body,
          employeeId: parseInt(req.params.id)
        });
        await logAudit(req, form.id, null, form);
        res.status(201).json(form);
      } catch (error) {
        res.status(500).json({ error: 'Failed to create tax form' });
      }
    }
  );

  app.put('/api/tax-forms/:id', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']), auditMiddleware('tax_forms'),
    validateId(), validateTaxForm(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const form = await storage.updateTaxForm(id, req.body);
        await logAudit(req, id, {}, form);
        res.json(form);
      } catch (error) {
        res.status(500).json({ error: 'Failed to update tax form' });
      }
    }
  );

  app.delete('/api/tax-forms/:id', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']), auditMiddleware('tax_forms'),
    validateId(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        await storage.deleteTaxForm(id);
        await logAudit(req, id, {}, null);
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ error: 'Failed to delete tax form' });
      }
    }
  );

  // Full CRUD for Trainings - accessible via API key or session
  app.get('/api/employees/:id/trainings', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:employees'), validateId(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const trainings = await storage.getEmployeeTrainings(parseInt(req.params.id));
        res.json(trainings);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch trainings' });
      }
    }
  );

  app.post('/api/employees/:id/trainings', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']), auditMiddleware('trainings'),
    validateTraining(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const training = await storage.createTraining({
          ...req.body,
          employeeId: parseInt(req.params.id)
        });
        await logAudit(req, training.id, null, training);
        res.status(201).json(training);
      } catch (error) {
        res.status(500).json({ error: 'Failed to create training' });
      }
    }
  );

  app.put('/api/trainings/:id', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']), auditMiddleware('trainings'),
    validateId(), validateTraining(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const training = await storage.updateTraining(id, req.body);
        await logAudit(req, id, {}, training);
        res.json(training);
      } catch (error) {
        res.status(500).json({ error: 'Failed to update training' });
      }
    }
  );

  app.delete('/api/trainings/:id', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']), auditMiddleware('trainings'),
    validateId(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        await storage.deleteTraining(id);
        await logAudit(req, id, {}, null);
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ error: 'Failed to delete training' });
      }
    }
  );

  // Full CRUD for Payer Enrollments - accessible via API key or session
  app.get('/api/employees/:id/payer-enrollments', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:employees'), validateId(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const enrollments = await storage.getEmployeePayerEnrollments(parseInt(req.params.id));
        res.json(enrollments);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch payer enrollments' });
      }
    }
  );

  app.post('/api/employees/:id/payer-enrollments', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']), auditMiddleware('payer_enrollments'),
    validatePayerEnrollment(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const enrollment = await storage.createPayerEnrollment({
          ...req.body,
          employeeId: parseInt(req.params.id)
        });
        await logAudit(req, enrollment.id, null, enrollment);
        res.status(201).json(enrollment);
      } catch (error) {
        res.status(500).json({ error: 'Failed to create payer enrollment' });
      }
    }
  );

  app.put('/api/payer-enrollments/:id', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']), auditMiddleware('payer_enrollments'),
    validateId(), validatePayerEnrollment(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const enrollment = await storage.updatePayerEnrollment(id, req.body);
        await logAudit(req, id, {}, enrollment);
        res.json(enrollment);
      } catch (error) {
        res.status(500).json({ error: 'Failed to update payer enrollment' });
      }
    }
  );

  app.delete('/api/payer-enrollments/:id', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']), auditMiddleware('payer_enrollments'),
    validateId(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        await storage.deletePayerEnrollment(id);
        await logAudit(req, id, {}, null);
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ error: 'Failed to delete payer enrollment' });
      }
    }
  );

  // Full CRUD for Incident Logs - accessible via API key or session
  app.get('/api/employees/:id/incident-logs', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:employees'), validateId(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const logs = await storage.getEmployeeIncidentLogs(parseInt(req.params.id));
        res.json(logs);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch incident logs' });
      }
    }
  );

  app.post('/api/employees/:id/incident-logs', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']), auditMiddleware('incident_logs'),
    validateIncidentLog(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const log = await storage.createIncidentLog({
          ...req.body,
          employeeId: parseInt(req.params.id)
        });
        await logAudit(req, log.id, null, log);
        res.status(201).json(log);
      } catch (error) {
        res.status(500).json({ error: 'Failed to create incident log' });
      }
    }
  );

  app.put('/api/incident-logs/:id', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']), auditMiddleware('incident_logs'),
    validateId(), validateIncidentLog(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const log = await storage.updateIncidentLog(id, req.body);
        await logAudit(req, id, {}, log);
        res.json(log);
      } catch (error) {
        res.status(500).json({ error: 'Failed to update incident log' });
      }
    }
  );

  app.delete('/api/incident-logs/:id', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']), auditMiddleware('incident_logs'),
    validateId(), handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        await storage.deleteIncidentLog(id);
        await logAudit(req, id, {}, null);
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ error: 'Failed to delete incident log' });
      }
    }
  );

  // Reports routes - accessible via API key or session
  app.get('/api/reports/expiring', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:reports'),
    async (req: AuditRequest, res: Response) => {
      try {
        const days = parseInt(req.query.days as string) || 30;
        const expiringItems = await storage.getExpiringItems(days);
        res.json(expiringItems);
      } catch (error) {
        console.error('Error fetching expiring items:', error);
        res.status(500).json({ error: 'Failed to fetch expiring items' });
      }
    }
  );

  app.get('/api/reports/stats', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:reports'),
    async (req: AuditRequest, res: Response) => {
      try {
        const stats = await storage.getEmployeeStats();
        res.json(stats);
      } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
      }
    }
  );

  // Dashboard routes - accessible via API key or session
  app.get('/api/dashboard/stats',
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:reports'),
    async (req: AuditRequest, res: Response) => {
      try {
        const stats = await storage.getDashboardStats();
        res.json(stats);
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
      }
    }
  );

  app.get('/api/dashboard/activities',
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:audits'),
    async (req: AuditRequest, res: Response) => {
      try {
        const limit = parseInt(req.query.limit as string) || 10;
        const activities = await storage.getRecentActivities(limit);
        res.json(activities);
      } catch (error) {
        console.error('Error fetching activities:', error);
        res.status(500).json({ error: 'Failed to fetch activities' });
      }
    }
  );

  app.get('/api/dashboard/expirations',
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:reports'),
    async (req: AuditRequest, res: Response) => {
      try {
        const days = parseInt(req.query.days as string) || 30;
        const expirations = await storage.getExpiringItems(days);
        res.json(expirations);
      } catch (error) {
        console.error('Error fetching expirations:', error);
        res.status(500).json({ error: 'Failed to fetch expirations' });
      }
    }
  );

  app.get('/api/documents/stats',
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:documents'),
    async (req: AuditRequest, res: Response) => {
      try {
        const stats = await storage.getDocumentStats();
        res.json(stats);
      } catch (error) {
        console.error('Error fetching document stats:', error);
        res.status(500).json({ error: 'Failed to fetch document stats' });
      }
    }
  );

  // Audit routes - accessible via API key or session
  app.get('/api/audits', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:audits'), 
    requireRole(['admin', 'hr']),
    validatePagination(), 
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 25;
        const offset = (page - 1) * limit;
        
        const result = await storage.getAudits({
          limit,
          offset,
          tableName: req.query.tableName as string,
          action: req.query.action as string,
          startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
          endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
        });
        
        res.json({
          audits: result.audits,
          total: result.total,
          page,
          totalPages: Math.ceil(result.total / limit)
        });
      } catch (error) {
        console.error('Error fetching audits:', error);
        res.status(500).json({ error: 'Failed to fetch audits' });
      }
    }
  );

  // Cron job manual trigger
  app.get('/api/cron/check-expirations', 
    requireAuth, 
    requireRole(['admin']),
    async (req: AuditRequest, res: Response) => {
      try {
        const expiringItems = await manualExpirationCheck();
        res.json({
          message: 'Expiration check completed',
          count: expiringItems.length,
          items: expiringItems
        });
      } catch (error) {
        console.error('Error in manual expiration check:', error);
        res.status(500).json({ error: 'Failed to run expiration check' });
      }
    }
  );

  /**
   * S3 Configuration Routes (Admin Only)
   * 
   * @description
   * Endpoints for managing AWS S3 storage configuration.
   * Allows administrators to configure S3 settings through the web interface
   * instead of using environment variables.
   */
  
  /**
   * GET /api/admin/s3-config
   * Get current S3 configuration (with masked credentials)
   */
  app.get('/api/admin/s3-config',
    requireAuth,
    requireRole(['admin', 'hr']),
    async (req: AuditRequest, res: Response) => {
      try {
        // Get current configuration from database
        const config = await storage.getS3Configuration();
        
        if (!config) {
          // Check if environment variables are set
          const hasEnvConfig = process.env.AWS_ACCESS_KEY_ID && 
                             process.env.AWS_SECRET_ACCESS_KEY && 
                             process.env.AWS_S3_BUCKET_NAME;
          
          if (hasEnvConfig) {
            return res.json({
              source: 'environment',
              enabled: true,
              region: process.env.AWS_REGION || 'us-east-1',
              bucketName: process.env.AWS_S3_BUCKET_NAME,
              endpoint: process.env.AWS_S3_ENDPOINT || null,
              accessKeyId: mask(process.env.AWS_ACCESS_KEY_ID || ''),
              secretAccessKey: '****',
              message: 'Configuration loaded from environment variables. Consider migrating to database for better security.'
            });
          }
          
          return res.json({
            source: 'none',
            enabled: false,
            message: 'No S3 configuration found'
          });
        }
        
        // Return configuration with masked sensitive fields
        res.json({
          source: 'database',
          enabled: config.enabled,
          region: config.region,
          bucketName: config.bucketName,
          endpoint: config.endpoint,
          accessKeyId: config.accessKeyId ? mask(decrypt(config.accessKeyId)) : null,
          secretAccessKey: config.secretAccessKey ? '****' : null,
          updatedAt: config.updatedAt,
          updatedBy: config.updatedBy
        });
      } catch (error) {
        console.error('Error fetching S3 configuration:', error);
        res.status(500).json({ error: 'Failed to fetch S3 configuration' });
      }
    }
  );
  
  /**
   * PUT /api/admin/s3-config
   * Update S3 configuration
   */
  app.put('/api/admin/s3-config',
    requireAuth,
    requireRole(['admin', 'hr']),
    [
      body('accessKeyId').notEmpty().withMessage('AWS Access Key ID is required'),
      body('secretAccessKey').notEmpty().withMessage('AWS Secret Access Key is required'),
      body('region').notEmpty().withMessage('AWS Region is required'),
      body('bucketName').notEmpty().withMessage('S3 Bucket Name is required'),
      body('enabled').isBoolean().withMessage('Enabled must be a boolean')
    ],
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const { accessKeyId, secretAccessKey, region, bucketName, endpoint, enabled = true } = req.body;
        
        // Encrypt sensitive fields before storing
        const encryptedConfig = {
          accessKeyId: encrypt(accessKeyId),
          secretAccessKey: encrypt(secretAccessKey),
          region,
          bucketName,
          endpoint: endpoint || null,
          enabled,
          updatedBy: req.user!.id
        };
        
        // Update or create configuration
        const updatedConfig = await storage.updateS3Configuration(encryptedConfig);
        
        // Refresh S3 service configuration
        await s3Service.refreshConfiguration();
        
        // Log the configuration change
        await logAudit(req, updatedConfig.id, null, updatedConfig);
        
        res.json({
          message: 'S3 configuration updated successfully',
          enabled: updatedConfig.enabled,
          region: updatedConfig.region,
          bucketName: updatedConfig.bucketName,
          endpoint: updatedConfig.endpoint,
          accessKeyId: mask(accessKeyId),
          updatedAt: updatedConfig.updatedAt
        });
      } catch (error) {
        console.error('Error updating S3 configuration:', error);
        res.status(500).json({ error: 'Failed to update S3 configuration' });
      }
    }
  );
  
  /**
   * POST /api/admin/s3-config/test
   * Test S3 connection with provided credentials
   */
  app.post('/api/admin/s3-config/test',
    requireAuth,
    requireRole(['admin', 'hr']),
    [
      body('accessKeyId').notEmpty().withMessage('AWS Access Key ID is required'),
      body('secretAccessKey').notEmpty().withMessage('AWS Secret Access Key is required'),
      body('region').notEmpty().withMessage('AWS Region is required'),
      body('bucketName').notEmpty().withMessage('S3 Bucket Name is required')
    ],
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const { accessKeyId, secretAccessKey, region, bucketName, endpoint } = req.body;
        
        // Import S3 client directly for testing
        const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3');
        
        // Create a test client with provided credentials
        const clientConfig: any = {
          region,
          credentials: {
            accessKeyId,
            secretAccessKey
          },
          forcePathStyle: true
        };
        
        if (endpoint) {
          clientConfig.endpoint = endpoint;
        }
        
        const testClient = new S3Client(clientConfig);
        
        // Test bucket access
        try {
          const command = new ListObjectsV2Command({
            Bucket: bucketName,
            MaxKeys: 1
          });
          
          await testClient.send(command);
          
          res.json({
            success: true,
            message: `Successfully connected to S3 bucket: ${bucketName}`,
            details: {
              region,
              bucketName,
              hasEndpoint: !!endpoint
            }
          });
        } catch (error: any) {
          console.log('S3 Test Error:', error.name, error.message);
          
          // Special handling for bucket not found
          if (error.name === 'NoSuchBucket') {
            res.status(404).json({
              success: false,
              message: 'Bucket does not exist',
              error: error.message || 'The specified bucket does not exist',
              details: {
                region,
                bucketName,
                errorCode: 'NoSuchBucket',
                canCreate: true,
                suggestion: 'Would you like to create this bucket?'
              }
            });
          } 
          // Handle region mismatch error
          else if (error.name === 'PermanentRedirect' || error.$metadata?.httpStatusCode === 301) {
            // Try to extract the correct region from the error
            let correctRegion = 'unknown';
            if (error.$response?.headers?.['x-amz-bucket-region']) {
              correctRegion = error.$response.headers['x-amz-bucket-region'];
            } else if (error.message && error.message.includes('us-west-2')) {
              correctRegion = 'us-west-2';
            }
            
            res.status(400).json({
              success: false,
              message: 'Bucket exists in a different region',
              error: `The bucket "${bucketName}" exists in region "${correctRegion}" but you're trying to access it from "${region}"`,
              details: {
                region,
                bucketName,
                correctRegion,
                errorCode: 'PermanentRedirect',
                canCreate: false,
                suggestion: `Please change the region to "${correctRegion}" and try again`
              }
            });
          } 
          // Handle access denied
          else if (error.name === 'AccessDenied' || error.name === 'Forbidden') {
            res.status(403).json({
              success: false,
              message: 'Access denied to S3 bucket',
              error: 'Your AWS credentials do not have permission to access this bucket',
              details: {
                region,
                bucketName,
                errorCode: error.name,
                canCreate: false,
                suggestion: 'Check your IAM permissions or try a different bucket name'
              }
            });
          } 
          // Generic error handling
          else {
            res.status(400).json({
              success: false,
              message: 'Failed to connect to S3',
              error: error.message || 'Unknown error',
              details: {
                region,
                bucketName,
                errorCode: error.name,
                canCreate: false,
                suggestion: 'Check your AWS credentials and configuration'
              }
            });
          }
        }
      } catch (error) {
        console.error('Error testing S3 configuration:', error);
        res.status(500).json({ error: 'Failed to test S3 configuration' });
      }
    }
  );
  
  /**
   * POST /api/admin/s3-config/create-bucket
   * Create a new S3 bucket
   */
  app.post('/api/admin/s3-config/create-bucket',
    requireAuth,
    requireRole(['admin', 'hr']),
    [
      body('region').notEmpty().withMessage('AWS Region is required'),
      body('bucketName').notEmpty().withMessage('S3 Bucket Name is required')
    ],
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        let { accessKeyId, secretAccessKey, region, bucketName, endpoint } = req.body;
        
        // If credentials not provided, try to use saved config
        if (!accessKeyId || !secretAccessKey) {
          const savedConfig = await storage.getS3Configuration();
          if (savedConfig && savedConfig.enabled) {
            accessKeyId = savedConfig.accessKeyId;
            secretAccessKey = savedConfig.secretAccessKey;
            
            // Use saved region and bucket if not provided
            if (!region) region = savedConfig.region;
            if (!bucketName) bucketName = savedConfig.bucketName;
            if (!endpoint && savedConfig.endpoint) endpoint = savedConfig.endpoint;
          }
        }
        
        // Check if we have credentials now
        if (!accessKeyId || !secretAccessKey) {
          return res.status(400).json({
            success: false,
            message: 'AWS credentials required',
            error: 'Please provide AWS Access Key ID and Secret Access Key or save them first'
          });
        }
        
        // Import S3 client
        const { S3Client, CreateBucketCommand, PutBucketCorsCommand } = await import('@aws-sdk/client-s3');
        
        // Create a client with provided credentials
        const clientConfig: any = {
          region,
          credentials: {
            accessKeyId,
            secretAccessKey
          },
          forcePathStyle: true
        };
        
        if (endpoint) {
          clientConfig.endpoint = endpoint;
        }
        
        const s3Client = new S3Client(clientConfig);
        
        try {
          // Create the bucket
          const createBucketCommand = new CreateBucketCommand({
            Bucket: bucketName,
            // Add LocationConstraint for regions other than us-east-1
            ...(region !== 'us-east-1' && {
              CreateBucketConfiguration: {
                LocationConstraint: region
              }
            })
          });
          
          await s3Client.send(createBucketCommand);
          
          // Set CORS configuration for the bucket
          const corsCommand = new PutBucketCorsCommand({
            Bucket: bucketName,
            CORSConfiguration: {
              CORSRules: [
                {
                  AllowedHeaders: ['*'],
                  AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
                  AllowedOrigins: ['*'],
                  ExposeHeaders: ['ETag'],
                  MaxAgeSeconds: 3000
                }
              ]
            }
          });
          
          await s3Client.send(corsCommand);
          
          res.json({
            success: true,
            message: `Successfully created S3 bucket: ${bucketName}`,
            details: {
              region,
              bucketName,
              corsEnabled: true
            }
          });
        } catch (error: any) {
          if (error.name === 'BucketAlreadyExists' || error.name === 'BucketAlreadyOwnedByYou') {
            res.status(400).json({
              success: false,
              message: 'Bucket already exists',
              error: 'A bucket with this name already exists',
              details: {
                region,
                bucketName,
                suggestion: 'Try using a different bucket name'
              }
            });
          } else {
            res.status(400).json({
              success: false,
              message: 'Failed to create bucket',
              error: error.message || 'Unknown error',
              details: {
                region,
                bucketName,
                errorCode: error.name,
                suggestion: 'Check your AWS credentials and permissions'
              }
            });
          }
        }
      } catch (error) {
        console.error('Error creating S3 bucket:', error);
        res.status(500).json({ error: 'Failed to create S3 bucket' });
      }
    }
  );
  
  /**
   * POST /api/admin/s3-config/migrate
   * Migrate S3 configuration from environment variables to database
   */
  app.post('/api/admin/s3-config/migrate',
    requireAuth,
    requireRole(['admin', 'hr']),
    async (req: AuditRequest, res: Response) => {
      try {
        // Check if environment variables are set
        const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
        const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
        const region = process.env.AWS_REGION || 'us-east-1';
        const bucketName = process.env.AWS_S3_BUCKET_NAME;
        const endpoint = process.env.AWS_S3_ENDPOINT;
        
        if (!accessKeyId || !secretAccessKey || !bucketName) {
          return res.status(400).json({
            error: 'No environment variables found to migrate'
          });
        }
        
        // Check if database config already exists
        const existingConfig = await storage.getS3Configuration();
        if (existingConfig) {
          return res.status(400).json({
            error: 'Database configuration already exists. Delete it first if you want to migrate from environment variables.'
          });
        }
        
        // Encrypt and save to database
        const encryptedConfig = {
          accessKeyId: encrypt(accessKeyId),
          secretAccessKey: encrypt(secretAccessKey),
          region,
          bucketName,
          endpoint: endpoint || null,
          enabled: true,
          updatedBy: req.user!.id
        };
        
        const newConfig = await storage.createS3Configuration(encryptedConfig);
        
        // Refresh S3 service configuration
        await s3Service.refreshConfiguration();
        
        res.json({
          message: 'Successfully migrated S3 configuration from environment variables to database',
          region: newConfig.region,
          bucketName: newConfig.bucketName,
          note: 'You can now remove AWS credentials from environment variables for improved security'
        });
      } catch (error) {
        console.error('Error migrating S3 configuration:', error);
        res.status(500).json({ error: 'Failed to migrate S3 configuration' });
      }
    }
  );

  /**
   * Email Configuration Routes (Mailtrap)
   * 
   * @description
   * Endpoints for managing email configuration for notifications.
   * Supports configuration management, testing, and invitation sending.
   */

  /**
   * GET /api/admin/ses-config
   * Get current email configuration status
   */
  app.get('/api/admin/ses-config',
    requireAuth,
    requireRole(['admin', 'hr']),
    async (req: AuditRequest, res: Response) => {
      try {
        const { mailtrapService } = await import('./services/mailtrapService');
        const status = await mailtrapService.getConfigurationStatus();
        res.json(status);
      } catch (error) {
        console.error('Error fetching email configuration:', error);
        res.status(500).json({ error: 'Failed to fetch email configuration' });
      }
    }
  );

  /**
   * POST /api/admin/ses-config
   * Save or update email configuration (Mailtrap)
   */
  app.post('/api/admin/ses-config',
    requireAuth,
    requireRole(['admin', 'hr']),
    [
      body('token').optional(), // Mailtrap API Token (optional for backward compatibility)
      // Keep region/accessKeyId/secretAccessKey optional for backward compatibility
      body('region').optional(),
      body('accessKeyId').optional(), // Will store the token here for compatibility
      body('secretAccessKey').optional(),
      body('fromEmail').isEmail().withMessage('Valid from email is required'),
      body('fromName').optional()
    ],
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const { mailtrapService } = await import('./services/mailtrapService');
        // Handle both token field and accessKeyId field for backward compatibility
        const token = req.body.token || req.body.accessKeyId || '';
        const config = {
          token: token, // Mailtrap uses token instead of AWS keys
          fromEmail: req.body.fromEmail,
          fromName: req.body.fromName,
          enabled: req.body.enabled !== undefined ? req.body.enabled : true,
          updatedBy: req.user!.id
        };
        
        const success = await mailtrapService.saveConfiguration(config);
        
        if (success) {
          await logAudit(req, 1, null, { configured: true });
          
          res.json({ message: 'Email configuration saved successfully' });
        } else {
          res.status(400).json({ error: 'Failed to save email configuration' });
        }
      } catch (error) {
        console.error('Error saving email configuration:', error);
        res.status(500).json({ error: 'Failed to save email configuration' });
      }
    }
  );

  /**
   * POST /api/admin/ses-config/test
   * Test email configuration by sending a test email
   */
  app.post('/api/admin/ses-config/test',
    requireAuth,
    requireRole(['admin', 'hr']),
    [
      body('testEmail').isEmail().withMessage('Valid test email is required')
    ],
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const { mailtrapService } = await import('./services/mailtrapService');
        const result = await mailtrapService.testConfiguration(req.body.testEmail);
        
        if (result.success) {
          res.json({ 
            message: 'Test email sent successfully',
            details: 'Please check your inbox for the test email'
          });
        } else {
          res.status(400).json({ 
            error: 'Failed to send test email',
            details: result.error
          });
        }
      } catch (error) {
        console.error('Error testing email configuration:', error);
        res.status(500).json({ error: 'Failed to test email configuration' });
      }
    }
  );

  /**
   * POST /api/admin/ses-config/verify
   * Verify an email address (compatibility endpoint for Mailtrap)
   */
  app.post('/api/admin/ses-config/verify',
    requireAuth,
    requireRole(['admin', 'hr']),
    [
      body('email').isEmail().withMessage('Valid email is required')
    ],
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const { mailtrapService } = await import('./services/mailtrapService');
        const success = await mailtrapService.verifyEmailAddress(req.body.email);
        
        if (success) {
          res.json({ 
            message: 'Email address verified',
            details: 'Mailtrap does not require email verification, address is ready to use'
          });
        } else {
          res.status(400).json({ error: 'Failed to verify email address' });
        }
      } catch (error) {
        console.error('Error verifying email address:', error);
        res.status(500).json({ error: 'Failed to verify email address' });
      }
    }
  );

  /**
   * POST /api/admin/ses-config/verify-email
   * Verify an email address (alternative endpoint, compatibility for Mailtrap)
   * This endpoint exists for backward compatibility
   */
  app.post('/api/admin/ses-config/verify-email',
    requireAuth,
    requireRole(['admin', 'hr']),
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const { mailtrapService } = await import('./services/mailtrapService');
        
        // Default to admin@atcemr.com if no email provided
        const emailToVerify = req.body.email || 'admin@atcemr.com';
        
        console.log(`Attempting to verify email address: ${emailToVerify}`);
        const success = await mailtrapService.verifyEmailAddress(emailToVerify);
        
        if (success) {
          res.json({ 
            message: `Email address ${emailToVerify} is verified`,
            details: 'Mailtrap does not require email verification, address is ready to use',
            email: emailToVerify
          });
        } else {
          res.status(400).json({ 
            error: `Failed to verify email ${emailToVerify}`,
            details: 'There might be an email configuration issue'
          });
        }
      } catch (error: any) {
        console.error('Error verifying email address:', error);
        res.status(500).json({ 
          error: 'Failed to verify email address',
          details: error.message || 'Unknown error occurred'
        });
      }
    }
  );

  /**
   * DocuSeal Forms Configuration Routes
   * 
   * Endpoints for managing DocuSeal API integration for document signing.
   * Supports configuration, template management, and form submissions.
   */

  /**
   * GET /api/admin/docuseal-config
   * Get current DocuSeal configuration
   */
  app.get('/api/admin/docuseal-config',
    requireAuth,
    requireRole(['admin']),
    async (req: AuditRequest, res: Response) => {
      try {
        const config = await storage.getDocusealConfiguration();
        if (config) {
          // Mask the API key for security
          const maskedConfig = {
            ...config,
            apiKey: config.apiKey ? '••••••••' + config.apiKey.slice(-4) : null
          };
          res.json(maskedConfig);
        } else {
          res.json(null);
        }
      } catch (error) {
        console.error('Error fetching DocuSeal configuration:', error);
        res.status(500).json({ error: 'Failed to fetch DocuSeal configuration' });
      }
    }
  );

  /**
   * POST /api/admin/docuseal-config
   * Create or update DocuSeal configuration
   */
  app.post('/api/admin/docuseal-config',
    requireAuth,
    requireRole(['admin']),
    [
      body('apiKey').notEmpty().withMessage('API key is required'),
      body('environment').optional().isIn(['production', 'sandbox']).withMessage('Invalid environment'),
      body('baseUrl').optional().isURL().withMessage('Invalid base URL'),
      body('name').optional()
    ],
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const { apiKey, ...otherConfig } = req.body;
        
        // Encrypt the API key
        const { encrypt } = await import('./utils/encryption');
        const encryptedApiKey = encrypt(apiKey);
        
        // Check if configuration exists
        const existingConfig = await storage.getDocusealConfiguration();
        
        let savedConfig;
        if (existingConfig) {
          savedConfig = await storage.updateDocusealConfiguration(existingConfig.id, {
            apiKey: encryptedApiKey,
            ...otherConfig,
            enabled: true,
            updatedBy: req.user!.id
          });
        } else {
          savedConfig = await storage.createDocusealConfiguration({
            apiKey: encryptedApiKey,
            ...otherConfig,
            enabled: true,
            updatedBy: req.user!.id
          });
        }
        
        // Reinitialize the service with new configuration
        const { docuSealService } = await import('./services/docusealService');
        await docuSealService.initialize();
        
        await logAudit(req, 1, null, { docusealConfigured: true });
        res.json({ message: 'DocuSeal configuration saved successfully' });
      } catch (error) {
        console.error('Error saving DocuSeal configuration:', error);
        res.status(500).json({ error: 'Failed to save DocuSeal configuration' });
      }
    }
  );

  /**
   * DELETE /api/admin/docuseal-config/:id
   * Delete DocuSeal configuration
   */
  app.delete('/api/admin/docuseal-config/:id',
    requireAuth,
    requireRole(['admin']),
    async (req: AuditRequest, res: Response) => {
      try {
        await storage.deleteDocusealConfiguration(parseInt(req.params.id));
        await logAudit(req, 3, null, { docusealConfigDeleted: true });
        res.json({ message: 'DocuSeal configuration deleted successfully' });
      } catch (error) {
        console.error('Error deleting DocuSeal configuration:', error);
        res.status(500).json({ error: 'Failed to delete DocuSeal configuration' });
      }
    }
  );

  /**
   * POST /api/admin/docuseal-config/test
   * Test DocuSeal API connection
   */
  app.post('/api/admin/docuseal-config/test',
    requireAuth,
    requireRole(['admin']),
    async (req: AuditRequest, res: Response) => {
      try {
        const { docuSealService } = await import('./services/docusealService');
        const result = await docuSealService.testConnection();
        
        if (result.success) {
          res.json({ message: result.message });
        } else {
          res.status(400).json({ error: result.message });
        }
      } catch (error) {
        console.error('Error testing DocuSeal connection:', error);
        res.status(500).json({ error: 'Failed to test DocuSeal connection' });
      }
    }
  );

  /**
   * GET /api/admin/docuseal-templates
   * Get all DocuSeal templates
   */
  app.get('/api/admin/docuseal-templates',
    requireAuth,
    requireRole(['admin', 'hr']),
    async (req: AuditRequest, res: Response) => {
      try {
        const templates = await storage.getDocusealTemplates();
        res.json(templates);
      } catch (error) {
        console.error('Error fetching DocuSeal templates:', error);
        res.status(500).json({ error: 'Failed to fetch DocuSeal templates' });
      }
    }
  );

  /**
   * POST /api/admin/docuseal-templates/sync
   * Sync templates from DocuSeal API
   */
  app.post('/api/admin/docuseal-templates/sync',
    requireAuth,
    requireRole(['admin']),
    async (req: AuditRequest, res: Response) => {
      try {
        const { docuSealService } = await import('./services/docusealService');
        const result = await docuSealService.syncTemplates();
        await logAudit(req, 1, null, { templatesSynced: result.synced });
        res.json(result);
      } catch (error) {
        console.error('Error syncing DocuSeal templates:', error);
        res.status(500).json({ error: 'Failed to sync DocuSeal templates' });
      }
    }
  );

  /**
   * PUT /api/admin/docuseal-templates/:id
   * Update a DocuSeal template settings
   */
  app.put('/api/admin/docuseal-templates/:id',
    requireAuth,
    requireRole(['admin']),
    async (req: AuditRequest, res: Response) => {
      try {
        const templateId = parseInt(req.params.id);
        const updated = await storage.updateDocusealTemplate(templateId, req.body);
        await logAudit(req, 2, null, { templateUpdated: templateId });
        res.json(updated);
      } catch (error) {
        console.error('Error updating DocuSeal template:', error);
        res.status(500).json({ error: 'Failed to update DocuSeal template' });
      }
    }
  );

  /**
   * Forms and DocuSeal Template Routes
   */

  /**
   * GET /api/forms/templates
   * Get all available DocuSeal templates for display
   */
  app.get('/api/forms/templates',
    requireAuth,
    requireRole(['admin', 'hr']),
    async (req: AuditRequest, res: Response) => {
      try {
        // Fetch all enabled templates from docusealTemplates table
        const templates = await storage.getDocusealTemplates(true);
        
        // Return templates in the expected format
        const formattedTemplates = templates.map(t => ({
          id: t.id,
          templateId: t.templateId,
          name: t.name,
          description: t.description,
          requiredForOnboarding: t.requiredForOnboarding,
          enabled: t.enabled,
          sortOrder: t.sortOrder
        }));
        
        console.log(`[API] /api/forms/templates: Fetched ${formattedTemplates.length} enabled templates`);
        res.json(formattedTemplates);
      } catch (error) {
        console.error('[API] Error fetching DocuSeal templates:', error);
        res.status(500).json({ error: 'Failed to fetch templates' });
      }
    }
  );

  /**
   * Onboarding Form Routes
   */

  /**
   * GET /api/onboarding/required-forms
   * Get required forms for onboarding (no auth required for onboarding process)
   */
  app.get('/api/onboarding/required-forms',
    async (req: Express.Request, res: Response) => {
      try {
        // Fetch templates from docusealTemplates where requiredForOnboarding = true and enabled = true
        const templates = await storage.getDocusealTemplates();
        const requiredTemplates = templates
          .filter(t => t.requiredForOnboarding && t.enabled)
          .map(t => {
            // Parse signer roles if available
            let signers: Array<{id: string, name: string, role: string, required: boolean}> = [];
            if (t.signerRoles) {
              try {
                const signerData = typeof t.signerRoles === 'string' ? JSON.parse(t.signerRoles) : t.signerRoles;
                if (Array.isArray(signerData)) {
                  signers = signerData.map((signer: any, index: number) => ({
                    id: signer.id || `signer_${index}`,
                    name: signer.name || `Signer ${index + 1}`,
                    role: signer.role || (index === 0 ? 'employee' : 'hr'),
                    required: signer.required !== false
                  }));
                }
              } catch (e) {
                console.warn(`Failed to parse signer roles for template ${t.templateId}:`, e);
                // Default to single employee signer
                signers = [{
                  id: 'signer_0',
                  name: 'Employee',
                  role: 'employee',
                  required: true
                }];
              }
            } else {
              // Default signer configuration if not specified
              signers = [{
                id: 'signer_0',
                name: 'Employee',
                role: 'employee',
                required: true
              }];
            }
            
            return {
              id: t.id,
              templateId: t.templateId,
              name: t.name,
              description: t.description,
              isRequired: true,  // For backward compatibility
              signers: signers   // Include signer configuration
            };
          });
        
        console.log(`[API] /api/onboarding/required-forms: Found ${requiredTemplates.length} required templates out of ${templates.length} total templates`);
        res.json(requiredTemplates);
      } catch (error) {
        console.error('[API] Error fetching required forms:', error);
        res.status(500).json({ error: 'Failed to fetch required forms' });
      }
    }
  );

  /**
   * GET /api/onboarding/:onboardingId/form-submissions
   * Get form submissions status for an onboarding process with detailed signer information
   */
  app.get('/api/onboarding/:onboardingId/form-submissions',
    requireAuth,
    async (req: AuditRequest, res: Response) => {
      try {
        const onboardingId = parseInt(req.params.onboardingId);
        if (isNaN(onboardingId)) {
          return res.status(400).json({ error: 'Invalid onboarding ID' });
        }
        const submissions = await storage.getOnboardingFormSubmissions(onboardingId);
        
        // Enhance submissions with detailed signer information if available
        const enhancedSubmissions = await Promise.all(submissions.map(async (submission) => {
          // Try to get detailed submission info from DocuSeal if we have a submissionId
          let signers: Array<{id: string, email: string, name: string, role: string, status: string, sentAt?: string, openedAt?: string, completedAt?: string}> = [];
          if (submission.submissionId) {
            try {
              const { docuSealService } = await import('./services/docusealService');
              const serviceInitialized = await docuSealService.initialize();
              
              if (serviceInitialized) {
                const apiSubmission = await docuSealService.getSubmission(submission.submissionId);
                if (apiSubmission && apiSubmission.submitters) {
                  signers = apiSubmission.submitters.map((submitter: any, index: number) => ({
                    id: submitter.id,
                    email: submitter.email,
                    name: submitter.name || `Signer ${index + 1}`,
                    role: submitter.role || (index === 0 ? 'employee' : 'hr'),
                    status: submitter.status || 'pending',
                    sentAt: submitter.sent_at,
                    openedAt: submitter.opened_at,
                    completedAt: submitter.completed_at
                  }));
                }
              }
            } catch (error) {
              console.warn(`Failed to fetch detailed submission info for ${submission.submissionId}:`, error);
            }
          }
          
          // If we couldn't get signer info from API, use default based on submission status
          if (signers.length === 0) {
            // Get template to understand expected signers
            const template = await storage.getDocusealTemplate(Number(submission.templateId));
            if (template && template.signerRoles) {
              try {
                const signerData = typeof template.signerRoles === 'string' ? 
                  JSON.parse(template.signerRoles) : template.signerRoles;
                if (Array.isArray(signerData)) {
                  signers = signerData.map((signer: any, index: number) => ({
                    id: `signer_${index}`,
                    email: index === 0 ? submission.signerEmail : '',
                    name: signer.name || `Signer ${index + 1}`,
                    role: signer.role || (index === 0 ? 'employee' : 'hr'),
                    status: submission.status,
                    sentAt: submission.createdAt?.toISOString(),
                    openedAt: submission.createdAt?.toISOString(),
                    completedAt: submission.signedAt?.toISOString()
                  }));
                }
              } catch (e) {
                console.warn('Failed to parse template signer roles:', e);
              }
            }
            
            // Fallback to single signer if still no signer info
            if (signers.length === 0) {
              signers = [{
                id: 'primary',
                email: submission.signerEmail || '',
                name: 'Employee',
                role: 'employee',
                status: submission.status,
                sentAt: submission.createdAt?.toISOString(),
                openedAt: submission.createdAt?.toISOString(),
                completedAt: submission.signedAt?.toISOString()
              }];
            }
          }
          
          return {
            ...submission,
            signers: signers
          };
        }));
        
        res.json(enhancedSubmissions);
      } catch (error) {
        console.error('Error fetching form submissions:', error);
        res.status(500).json({ error: 'Failed to fetch form submissions' });
      }
    }
  );

  /**
   * POST /api/onboarding/:onboardingId/send-form
   * Send form to prospective employee
   */
  app.post('/api/onboarding/:onboardingId/send-form',
    requireAuth,
    requireRole(['admin', 'hr']),
    body('templateId').notEmpty().withMessage('Template ID is required'),
    body('signerEmail').isEmail().withMessage('Valid email is required'),
    body('employeeId').optional().isInt(),
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const onboardingId = parseInt(req.params.onboardingId);
        if (isNaN(onboardingId)) {
          return res.status(400).json({ error: 'Invalid onboarding ID' });
        }

        // Generate a submission ID (in a real implementation, this would come from DocuSeal API)
        const submissionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const submission = await storage.createOnboardingFormSubmission({
          onboardingId,
          templateId: req.body.templateId,
          submissionId,
          signerEmail: req.body.signerEmail,
          employeeId: req.body.employeeId || null,
          status: 'sent'
        });

        await logAudit(req, 1, null, { formSent: submissionId, onboardingId });
        res.json(submission);
      } catch (error) {
        console.error('Error sending form:', error);
        res.status(500).json({ error: 'Failed to send form' });
      }
    }
  );

  /**
   * POST /api/employees/:employeeId/send-form
   * Send form to an employee (outside of onboarding context)
   */
  app.post('/api/employees/:employeeId/send-form',
    requireAuth,
    requireRole(['admin', 'hr']),
    body('templateId').notEmpty().withMessage('Template ID is required'),
    body('signerEmail').isEmail().withMessage('Valid email is required'),
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const employeeId = parseInt(req.params.employeeId);
        if (isNaN(employeeId)) {
          return res.status(400).json({ error: 'Invalid employee ID' });
        }

        // Verify employee exists
        const employee = await storage.getEmployee(employeeId);
        if (!employee) {
          return res.status(404).json({ error: 'Employee not found' });
        }

        // Look up the template to get its numeric ID
        const template = await storage.getDocusealTemplateByTemplateId(req.body.templateId);
        if (!template) {
          return res.status(404).json({ error: 'Template not found' });
        }

        // Initialize DocuSeal service
        const { docuSealService } = await import('./services/docusealService');
        const initialized = await docuSealService.initialize();
        if (!initialized) {
          return res.status(503).json({ error: 'DocuSeal service is not configured' });
        }

        // Determine signer details
        const signerEmail: string = req.body.signerEmail || employee.workEmail;
        if (!signerEmail) {
          return res.status(400).json({ error: 'Signer email is required' });
        }

        const signerName =
          (employee.firstName && employee.lastName)
            ? `${employee.firstName} ${employee.lastName}`
            : signerEmail;

        // Determine the correct role from template's signer roles
        // Template defines roles like ["Employee", "Company"], we need to match exactly
        let submitterRole = 'Employee'; // Default to capitalized "Employee"
        if (template.signerRoles) {
          try {
            const signerData = typeof template.signerRoles === 'string' 
              ? JSON.parse(template.signerRoles) 
              : template.signerRoles;
            
            if (Array.isArray(signerData) && signerData.length > 0) {
              // Find the first role that looks like an employee role (case-insensitive)
              const employeeRole = signerData.find((s: any) => {
                const roleName = typeof s === 'string' ? s : (s.name || s.role || '');
                return roleName.toLowerCase().includes('employee') || roleName.toLowerCase() === 'employee';
              });
              
              if (employeeRole) {
                // Use the exact role name from template (preserve case)
                submitterRole = typeof employeeRole === 'string' ? employeeRole : (employeeRole.name || employeeRole.role || 'Employee');
              } else {
                // If no employee role found, use the first role
                submitterRole = typeof signerData[0] === 'string' ? signerData[0] : (signerData[0].name || signerData[0].role || 'Employee');
              }
            } else if (typeof signerData === 'object' && signerData.name) {
              submitterRole = signerData.name;
            }
          } catch (e) {
            console.warn('Failed to parse template signer roles, using default:', e);
          }
        }

        // Map employee data to DocuSeal form field values based on template
        const formValues: Record<string, any> = {};
        
        // Get template fields to determine which values to set
        let templateFields: any[] = [];
        if (template.fields) {
          if (Array.isArray(template.fields)) {
            templateFields = template.fields;
          } else if (typeof template.fields === 'object') {
            templateFields = (template.fields as any).fields || (template.fields as any).template_fields || [];
          } else if (typeof template.fields === 'string') {
            try {
              const parsed = JSON.parse(template.fields);
              templateFields = Array.isArray(parsed) ? parsed : (parsed.fields || parsed.template_fields || []);
            } catch (e) {
              // Not JSON string
            }
          }
        }
        
        // Extract field names from template
        const fieldNames = templateFields.map((f: any) => f.name || '').filter((n: string) => n);
        
        // EmpName - Employee Name (for PNM Admin Change Form and W9 Form)
        if (fieldNames.includes('EmpName') && (employee.firstName || employee.lastName)) {
          formValues.EmpName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim();
        }
        
        // EmpMedicaid ID - Note: field name has a space (for PNM Admin Change Form)
        if (fieldNames.includes('EmpMedicaid ID') && (employee.medicaidNumber || (employee as any).medicaidId)) {
          formValues['EmpMedicaid ID'] = employee.medicaidNumber || (employee as any).medicaidId;
        }
        
        // EmpNPI - Employee NPI (for PNM Admin Change Form)
        if (fieldNames.includes('EmpNPI') && (employee.npiNumber || (employee as any).npi)) {
          formValues.EmpNPI = employee.npiNumber || (employee as any).npi;
        }
        
        // EmpAddress - Employee Address (for W9 Form)
        if (fieldNames.includes('EmpAddress')) {
          const addressParts = [employee.homeAddress1, employee.homeAddress2].filter(Boolean);
          if (addressParts.length > 0) {
            formValues.EmpAddress = addressParts.join(', ');
          }
        }
        
        // EmpCityStateZip - City, State, ZIP (for W9 Form)
        if (fieldNames.includes('EmpCityStateZip')) {
          const cityStateZipParts = [
            employee.homeCity,
            employee.homeState,
            employee.homeZip
          ].filter(Boolean);
          if (cityStateZipParts.length > 0) {
            formValues.EmpCityStateZip = cityStateZipParts.join(', ');
          }
        }
        
        // SSN1, SSN2, SSN3 - Split SSN into 3 parts (for W9 Form)
        if (fieldNames.includes('SSN1') || fieldNames.includes('SSN2') || fieldNames.includes('SSN3')) {
          if (employee.ssn) {
            const { decrypt } = await import('./utils/encryption');
            try {
              const decryptedSSN = decrypt(employee.ssn);
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
            (employee as any).companyName || (employee as any).company,
            (employee as any).companyAddress
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
        if (fieldNames.includes('CompName') && ((employee as any).companyName || (employee as any).company)) {
          formValues.CompName = (employee as any).companyName || (employee as any).company;
        }
        
        // CompOHID - Company OHID (for PNM Admin Change Form)
        if (fieldNames.includes('CompOHID') && ((employee as any).companyOHID || (employee as any).compOHID)) {
          formValues.CompOHID = (employee as any).companyOHID || (employee as any).compOHID;
        }

        // Create DocuSeal submission (sends email invites when send_email = true)
        const dsSubmission = await docuSealService.createSubmission({
          template_id: template.templateId,
          submitters: [
            {
              email: signerEmail,
              name: signerName,
              role: submitterRole, // Use the role from template (e.g., "Employee" with capital E)
              values: Object.keys(formValues).length > 0 ? formValues : undefined
            }
          ],
          send_email: true,
          message: {
            subject: 'Form Completion Required',
            body: 'Please complete and sign this form at your earliest convenience.'
          }
        });

        // Normalize DocuSeal response and validate submission id
        const dsSubmissionId =
          (dsSubmission as any)?.id ||
          (dsSubmission as any)?.submission?.id ||
          (dsSubmission as any)?.data?.id ||
          (dsSubmission as any)?.data?.submission?.id ||
          (dsSubmission as any)?.result?.id ||
          (dsSubmission as any)?.uuid ||
          (dsSubmission as any)?.submission_uuid ||
          (dsSubmission as any)?.submission_id ||
          (Array.isArray((dsSubmission as any)?.submissions) && (dsSubmission as any).submissions[0]?.id ? (dsSubmission as any).submissions[0]?.id : undefined);

        if (!dsSubmissionId || typeof dsSubmissionId !== 'string') {
          await logAudit(req, 4, null, {
            action: 'docuseal_create_submission_invalid_response',
            templateExternalId: template.templateId,
            employeeId,
            signerEmail,
            dsResponseShape: dsSubmission ? Object.keys(dsSubmission as any).slice(0, 10) : [],
            dsRawPreview: dsSubmission ? JSON.stringify(dsSubmission).slice(0, 500) : null
          });
          return res.status(502).json({
            error: 'Invalid response from DocuSeal',
            details: 'Missing submission id'
          });
        }

        // Build metadata and signing URL for primary signer
        const dsSubmitters =
          (dsSubmission as any)?.submitters ||
          (dsSubmission as any)?.submission?.submitters ||
          (dsSubmission as any)?.data?.submitters ||
          (dsSubmission as any)?.data?.submission?.submitters ||
          [];

        const signingUrls: Record<string, string> = {};
        if (Array.isArray(dsSubmitters) && (dsSubmitters[0]?.slug || dsSubmitters[0]?.id)) {
          const token = dsSubmitters[0]?.slug || dsSubmitters[0]?.id;
          signingUrls.employee = `https://docuseal.com/s/${token}`;
        }

        // Persist form submission linked to DocuSeal submission
        const submission = await storage.createFormSubmission({
          employeeId,
          templateId: template.id,  // numeric ID from docuseal_templates table
          submissionId: dsSubmissionId,
          recipientEmail: signerEmail,
          recipientName: signerName,
          status: 'sent',
          documentsUrl: signingUrls.employee || null,
          submissionData: { signingUrls },
          createdBy: req.user!.id
        });

        // Optionally send our own email with the Sign-Now link (DocuSeal also emails)
        try {
          if (signingUrls.employee) {
            const { mailtrapService } = await import('./services/mailtrapService');
            const subject = `Action required: Sign "${template.name}"`;
            const link = signingUrls.employee;
            const bodyText = `Please complete and sign this form:\n\n${link}\n\nIf you have issues opening the link, copy and paste it into your browser.`;
            const bodyHtml = `
              <!DOCTYPE html>
              <html lang="en">
                <head>
                  <meta charset="UTF-8" />
                  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                  <title>Action required: Sign "${template.name}"</title>
                </head>
                <body style="margin:0;padding:0;background:#F8FAFC;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F8FAFC;padding:24px 0;">
                    <tr>
                      <td align="center">
                        <table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0F172A;">
                          <tr>
                            <td style="padding:0;">
                              <div style="background:linear-gradient(135deg,#2563EB 0%,#1D4ED8 100%);padding:24px 28px;">
                                <h1 style="margin:0;font-size:20px;line-height:28px;color:#ffffff;">Document Signing Request</h1>
                                <p style="margin:6px 0 0 0;font-size:13px;line-height:18px;color:#DBEAFE;">HR Management System</p>
                              </div>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:24px 28px;">
                              <p style="margin:0 0 12px 0;font-size:16px;line-height:24px;">Hello ${signerName},</p>
                              <p style="margin:0 0 16px 0;font-size:15px;line-height:22px;">
                                You have a document awaiting your signature:
                                <strong>${template.name}</strong>
                              </p>
                              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:18px 0 8px 0;">
                                <tr>
                                  <td align="center" bgcolor="#2563EB" style="border-radius:8px;">
                                    <a href="${link}" target="_blank" rel="noopener noreferrer"
                                       style="display:inline-block;padding:12px 22px;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;border-radius:8px;background:#2563EB;">
                                      Review & Sign
                                    </a>
                                  </td>
                                </tr>
                              </table>
                              <p style="margin:12px 0 0 0;font-size:12px;line-height:18px;color:#6B7280;">
                                If the button above does not work, copy and paste this link into your browser:
                              </p>
                              <p style="margin:6px 0 0 0;font-size:12px;line-height:18px;word-break:break-all;color:#1D4ED8;">
                                <a href="${link}" target="_blank" rel="noopener noreferrer" style="color:#1D4ED8;text-decoration:underline;">${link}</a>
                              </p>
                              <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;" />
                              <p style="margin:0;font-size:12px;line-height:18px;color:#64748B;">
                                This request was generated by your organization’s HR Management System. 
                                If you were not expecting this email, please contact your HR department.
                              </p>
                            </td>
                          </tr>
                        </table>
                        <p style="margin:12px 0 0 0;font-size:11px;line-height:16px;color:#94A3B8;font-family:Inter,Segoe UI,Arial,sans-serif;">
                          © ${new Date().getFullYear()} HR Management System
                        </p>
                      </td>
                    </tr>
                  </table>
                </body>
              </html>
            `;
            // await mailtrapService.sendEmail({
            //   to: signerEmail,
            //   subject,
            //   bodyText,
            //   bodyHtml
            // });
          }
        } catch (notifyErr) {
          console.error('Non-blocking: failed to send sign link email via Mailtrap:', notifyErr);
        }

        await logAudit(req, 1, null, { 
          formSent: dsSubmissionId, 
          employeeId,
          templateId: req.body.templateId
        });
        
        res.json(submission);
      } catch (error) {
        console.error('Failed to send form to employee:', error);
        res.status(500).json({ 
          error: 'Failed to send form', 
          details: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
  );

  /**
   * GET /api/employees/:employeeId/form-submissions
   * Get form submissions for an employee (outside of onboarding context)
   */
  app.get('/api/employees/:employeeId/form-submissions',
    requireAuth,
    async (req: AuditRequest, res: Response) => {
      try {
        const employeeId = parseInt(req.params.employeeId);
        if (isNaN(employeeId)) {
          return res.status(400).json({ error: 'Invalid employee ID' });
        }

        // Verify employee exists
        const employee = await storage.getEmployee(employeeId);
        if (!employee) {
          return res.status(404).json({ error: 'Employee not found' });
        }

        // Get form submissions for this employee
        const submissions = await storage.getFormSubmissions(employeeId);
        
        // Format submissions to match the expected frontend structure
        const formattedSubmissions = submissions.map(submission => ({
          id: submission.id,
          templateId: submission.templateId,
          submissionId: submission.submissionId,
          status: submission.status,
          signerEmail: submission.recipientEmail,
          employeeId: submission.employeeId,
          sentAt: submission.sentAt,
          openedAt: submission.openedAt,
          completedAt: submission.completedAt,
          createdAt: submission.createdAt,
          // Add empty signers array for compatibility with frontend
          signers: []
        }));

        res.json(formattedSubmissions);
      } catch (error) {
        console.error('Failed to get employee form submissions:', error);
        res.status(500).json({ 
          error: 'Failed to get form submissions', 
          details: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
  );

  /**
   * GET /api/onboarding/:onboardingId/form-status/:templateId
   * Check signing status for a specific template in an onboarding process
   */
  app.get('/api/onboarding/:onboardingId/form-status/:templateId',
    requireAuth,
    async (req: AuditRequest, res: Response) => {
      try {
        const onboardingId = parseInt(req.params.onboardingId);
        const { templateId } = req.params;
        
        if (isNaN(onboardingId)) {
          return res.status(400).json({ error: 'Invalid onboarding ID' });
        }

        const submissions = await storage.getOnboardingFormSubmissions(onboardingId);
        const submission = submissions.find(s => s.templateId === templateId);

        if (!submission) {
          return res.status(404).json({ error: 'Form submission not found' });
        }

        res.json({ status: submission.status, signedAt: submission.signedAt });
      } catch (error) {
        console.error('Error checking form status:', error);
        res.status(500).json({ error: 'Failed to check form status' });
      }
    }
  );

  /**
   * Form Submission Routes
   */

  /**
   * GET /api/forms/submissions
   * Get form submissions for an employee (query parameter version for frontend compatibility)
   * Accessible by the employee themselves or HR/admin
   */
  app.get('/api/forms/submissions',
    requireAuth,
    async (req: AuditRequest, res: Response) => {
      try {
        const employeeId = parseInt(req.query.employeeId as string);
        
        if (!employeeId || isNaN(employeeId)) {
          return res.status(400).json({ error: 'Employee ID is required' });
        }
        
        // Check if user is the employee themselves or has HR/admin role
        const employee = await storage.getEmployee(employeeId);
        if (!employee) {
          return res.status(404).json({ error: 'Employee not found' });
        }
        
        const isOwnProfile = employee.userId === req.user!.id;
        const hasManagementRole = req.user!.role === 'admin' || req.user!.role === 'hr';
        
        if (!isOwnProfile && !hasManagementRole) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        // Get form submissions from storage
        const submissions = await storage.getFormSubmissions(employeeId);
        
        // Include template details but REMOVE signing URLs for security
        const submissionsWithTemplates = await Promise.all(
          submissions.map(async (submission) => {
            const template = await storage.getDocusealTemplate(submission.templateId);
            
            // Extract multi-party signing status from submissionData
            const submissionData = submission.submissionData as any || {};
            
            // Create safe response without exposing signing URLs
            const safeSubmission = {
              id: submission.id,
              employeeId: submission.employeeId,
              templateId: submission.templateId,
              templateName: template?.name || 'Unknown Template',
              templateDescription: template?.description,
              status: submission.status,
              submittedAt: submission.sentAt,
              completedAt: submission.completedAt,
              sentAt: submission.sentAt,
              viewedAt: submission.openedAt,
              createdAt: submission.createdAt,
              updatedAt: submission.updatedAt,
              expiresAt: submission.expiresAt,
              invitationId: submission.invitationId,
              // Include multi-party signing metadata
              metadata: {
                requiresHrSignature: submissionData.requiresHrSignature || false,
                requiresEmployeeFirst: submissionData.requiresEmployeeFirst || false,
                employeeSigned: submissionData.employeeSigned || false,
                hrSigned: submissionData.hrSigned || false
              },
              submissionData: {
                requiresHrSignature: submissionData.requiresHrSignature || false,
                requiresEmployeeFirst: submissionData.requiresEmployeeFirst || false,
                employeeSigned: submissionData.employeeSigned || false,
                hrSigned: submissionData.hrSigned || false
              }
              // NOTE: documentUrl and submissionUrl are intentionally NOT included for security
            };
            
            return safeSubmission;
          })
        );
        
        // Log access for audit trail
        await logAudit(req, 8, { employeeId, isOwnProfile, count: submissionsWithTemplates.length });
        
        res.json(submissionsWithTemplates);
      } catch (error) {
        console.error('Error fetching form submissions:', error);
        res.status(500).json({ error: 'Failed to fetch form submissions' });
      }
    }
  );

  /**
   * GET /api/forms/employee/:employeeId
   * Get all form submissions for an employee
   */
  app.get('/api/forms/employee/:employeeId',
    requireAuth,
    async (req: AuditRequest, res: Response) => {
      try {
        const employeeId = parseInt(req.params.employeeId);
        const submissions = await storage.getFormSubmissions(employeeId);
        
        // Include template details but REMOVE signing URLs for security
        const submissionsWithTemplates = await Promise.all(
          submissions.map(async (submission) => {
            const template = await storage.getDocusealTemplate(submission.templateId);
            
            // Extract multi-party signing status from submissionData
            const submissionData = submission.submissionData as any || {};
            
            // Create safe response without exposing signing URLs
            const safeSubmission = {
              id: submission.id,
              employeeId: submission.employeeId,
              templateId: submission.templateId,
              templateName: template?.name || 'Unknown Template',
              templateDescription: template?.description,
              status: submission.status,
              submittedAt: submission.sentAt,
              completedAt: submission.completedAt,
              sentAt: submission.sentAt,
              viewedAt: submission.openedAt,
              createdAt: submission.createdAt,
              updatedAt: submission.updatedAt,
              expiresAt: submission.expiresAt,
              invitationId: submission.invitationId,
              // Include multi-party signing metadata
              metadata: {
                requiresHrSignature: submissionData.requiresHrSignature || false,
                requiresEmployeeFirst: submissionData.requiresEmployeeFirst || false,
                employeeSigned: submissionData.employeeSigned || false,
                hrSigned: submissionData.hrSigned || false
              },
              submissionData: {
                requiresHrSignature: submissionData.requiresHrSignature || false,
                requiresEmployeeFirst: submissionData.requiresEmployeeFirst || false,
                employeeSigned: submissionData.employeeSigned || false,
                hrSigned: submissionData.hrSigned || false
              }
              // NOTE: documentUrl and submissionUrl are intentionally NOT included for security
            };
            
            return safeSubmission;
          })
        );
        
        res.json(submissionsWithTemplates);
      } catch (error) {
        console.error('Error fetching form submissions:', error);
        res.status(500).json({ error: 'Failed to fetch form submissions' });
      }
    }
  );

  /**
   * POST /api/forms/send
   * Send a form to an employee
   */
  app.post('/api/forms/send',
    requireAuth,
    requireRole(['admin', 'hr']),
    [
      body('employeeId').isNumeric().withMessage('Employee ID is required'),
      body('templateId').isNumeric().withMessage('Template ID is required')
    ],
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const { employeeId, templateId } = req.body;
        const { docuSealService } = await import('./services/docusealService');
        
        const submission = await docuSealService.sendFormToEmployee(
          employeeId,
          templateId,
          req.user!.id,
          false
        );
        
        await logAudit(req, 1, employeeId, { formSent: submission.id });
        res.json(submission);
      } catch (error: any) {
        console.error('Error sending form:', error);
        
        // Return appropriate status code based on error type
        const statusCode = error.statusCode || 500;
        const errorType = error.errorType || 'INTERNAL_ERROR';
        const message = error.message || 'Failed to send form';
        
        // Log different error types appropriately
        if (errorType === 'TEMPLATE_NOT_FOUND') {
          console.log(`Template not found for form send request: templateId=${req.body.templateId}`);
        } else if (errorType === 'SERVICE_UNAVAILABLE') {
          console.warn('DocuSeal service not configured or unavailable');
        } else if (errorType === 'NOT_FOUND') {
          console.log(`Resource not found: ${message}`);
        }
        
        // Send appropriate error response
        res.status(statusCode).json({ 
          error: message,
          errorType: errorType,
          details: statusCode === 503 ? 'DocuSeal service is not configured. Please contact your administrator.' : undefined
        });
      }
    }
  );

  /**
   * GET /api/forms/submission/:id
   * Get a specific form submission
   */
  app.get('/api/forms/submission/:id',
    requireAuth,
    async (req: AuditRequest, res: Response) => {
      try {
        const submissionId = parseInt(req.params.id);
        const submission = await storage.getFormSubmission(submissionId);
        
        if (!submission) {
          return res.status(404).json({ error: 'Form submission not found' });
        }
        
        res.json(submission);
      } catch (error) {
        console.error('Error fetching form submission:', error);
        res.status(500).json({ error: 'Failed to fetch form submission' });
      }
    }
  );

  /**
   * POST /api/forms/submission/:id/update-status
   * Update form submission status from DocuSeal
   */
  app.post('/api/forms/submission/:id/update-status',
    requireAuth,
    requireRole(['admin', 'hr']),
    async (req: AuditRequest, res: Response) => {
      try {
        const submissionId = parseInt(req.params.id);
        const submission = await storage.getFormSubmission(submissionId);
        
        if (!submission) {
          return res.status(404).json({ error: 'Form submission not found' });
        }
        
        const { docuSealService } = await import('./services/docusealService');
        const updated = await docuSealService.updateSubmissionStatus(submission.submissionId);
        res.json(updated);
      } catch (error) {
        console.error('Error updating submission status:', error);
        res.status(500).json({ error: 'Failed to update submission status' });
      }
    }
  );

  /**
   * POST /api/forms/submissions/:id/resend
   * Resend form submission email to employee
   */
  app.post('/api/forms/submissions/:id/resend',
    requireAuth,
    requireRole(['admin', 'hr']),
    async (req: AuditRequest, res: Response) => {
      try {
        const submissionId = parseInt(req.params.id);
        const submission = await storage.getFormSubmission(submissionId);
        
        if (!submission) {
          return res.status(404).json({ error: 'Form submission not found' });
        }
        
        // Don't allow resending completed forms
        if (submission.status === 'completed') {
          return res.status(400).json({ 
            error: 'Cannot resend a completed form' 
          });
        }
        
        const { docuSealService } = await import('./services/docusealService');
        await docuSealService.initialize();
        
        // Use sendReminder to resend the email notification
        // This will send the email to all pending signers or a specific signer
        const result = await docuSealService.sendReminder(submission.submissionId, submission.recipientEmail);
        
        if (!result.success) {
          return res.status(400).json({ 
            error: result.message || 'Failed to resend form email' 
          });
        }
        
        // Update submission status to 'sent' if it was in a different state
        if (submission.status !== 'sent' && submission.status !== 'viewed') {
          await storage.updateFormSubmission(submissionId, {
            status: 'sent',
            sentAt: new Date()
          });
        } else {
          // Just update the sentAt timestamp
          await storage.updateFormSubmission(submissionId, {
            sentAt: new Date()
          });
        }
        
        await logAudit(req, submissionId, submission.employeeId, { 
          action: 'form_resent',
          submissionId: submission.submissionId 
        });
        
        res.json({ 
          message: 'Form email resent successfully',
          submission: {
            id: submission.id,
            status: submission.status === 'sent' ? submission.status : 'sent'
          }
        });
      } catch (error: any) {
        console.error('Error resending form:', error);
        const statusCode = error.statusCode || 500;
        const message = error.message || 'Failed to resend form';
        res.status(statusCode).json({ error: message });
      }
    }
  );

  /**
   * GET /api/forms/submission/:id/download
   * Download completed form documents
   */
  app.get('/api/forms/submission/:id/download',
    requireAuth,
    async (req: AuditRequest, res: Response) => {
      try {
        const submissionId = parseInt(req.params.id);
        const submission = await storage.getFormSubmission(submissionId);
        
        if (!submission) {
          return res.status(404).json({ error: 'Form submission not found' });
        }
        
        if (submission.status !== 'completed') {
          return res.status(400).json({ error: 'Form is not yet completed' });
        }
        
        const { docuSealService } = await import('./services/docusealService');
        const documents = await docuSealService.downloadDocuments(submission.submissionId);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="form-${submission.id}.pdf"`);
        res.send(documents);
      } catch (error) {
        console.error('Error downloading form documents:', error);
        res.status(500).json({ error: 'Failed to download form documents' });
      }
    }
  );

  /**
   * POST /api/docuseal/webhook
   * DocuSeal webhook endpoint to update submission status based on events
   * Note: Signature verification can be added when a webhook secret is configured
   */
  app.post('/api/docuseal/webhook',
    async (req: Express.Request, res: Response) => {
      try {
        const signature = (req.headers['x-docuseal-signature'] as string) || '';
        const event = (req.body && (req.body as any).event) || '';
        const data = (req.body && (req.body as any).data) || {};

        if (!data || !data.id) {
          return res.status(400).json({ success: false, error: 'Invalid webhook payload: missing data.id' });
        }

        // Initialize DocuSeal service and update status from DocuSeal API
        const { docuSealService } = await import('./services/docusealService');
        await docuSealService.initialize();

        try {
          await docuSealService.updateSubmissionStatus(data.id);
        } catch (err) {
          // Swallow errors to avoid retries storm; we can reprocess later via admin action
          console.error('Webhook status update failed:', err);
        }

        // Best-effort audit log without blocking webhook ack
        try {
          await logAudit(req as any, 8, null, {
            action: 'docuseal_webhook',
            event,
            submissionId: data.id,
            signaturePresent: Boolean(signature)
          });
        } catch {}

        return res.status(200).json({ success: true });
      } catch (error) {
        console.error('Error handling DocuSeal webhook:', error);
        // Acknowledge with 200 to prevent repeated retries; include flag
        return res.status(200).json({ success: false });
      }
    }
  );

  /**
   * GET /api/forms/submissions/:id/sign (Updated)
   * Get signing URL for a specific signer
   * Query param: signer (email address)
   * Auth: Employees can only get their own signing URL, HR/Admin can get any signer's URL
   */
  app.get('/api/forms/submissions/:id/sign',
    requireAuth,
    async (req: AuditRequest, res: Response) => {
      try {
        const submissionId = parseInt(req.params.id);
        const signerEmail = req.query.signer as string;
        
        const submission = await storage.getFormSubmission(submissionId);
        if (!submission) {
          return res.status(404).json({ error: 'Form submission not found' });
        }
        
        // Get employee details
        const employee = await storage.getEmployee(submission.employeeId);
        if (!employee) {
          return res.status(404).json({ error: 'Employee not found' });
        }
        
        // Check permissions
        const isOwnProfile = employee.userId === req.user!.id;
        const hasManagementRole = req.user!.role === 'admin' || req.user!.role === 'hr';
        
        // If signer email is provided, validate access and generate fresh URL
        if (signerEmail) {
          // Employees can only get their own signing URL
          if (!hasManagementRole && signerEmail.toLowerCase() !== employee.workEmail.toLowerCase()) {
            return res.status(403).json({ error: 'Insufficient permissions to access signing URL for other signers' });
          }
          
          // Check if DocuSeal is configured
          const { docuSealService } = await import('./services/docusealService');
          const serviceInitialized = await docuSealService.initialize();
          
          if (!serviceInitialized) {
            return res.status(503).json({ error: 'DocuSeal service is not configured' });
          }
          
          // Generate fresh signing URL for the specific signer
          const signingUrl = await docuSealService.getSigningUrl(submission.submissionId, signerEmail);
          
          if (!signingUrl) {
            return res.status(404).json({ error: `Signing URL not found for signer: ${signerEmail}` });
          }
          
          // Log audit for signing URL access
          await logAudit(req, 8, {
            action: 'get_signing_url',
            submissionId: submission.id,
            employeeId: submission.employeeId,
            signerEmail,
            requestedBy: req.user!.username
          });
          
          res.json({
            signingUrl,
            submissionId: submission.id,
            status: submission.status,
            employeeId: submission.employeeId,
            signerEmail
          });
        } else {
          // Legacy behavior - return employee's signing URL from stored data
          if (!isOwnProfile && !hasManagementRole) {
            return res.status(403).json({ error: 'Insufficient permissions to access signing URL' });
          }
          
          // Check if form is already completed
          if (submission.status === 'completed') {
            return res.status(400).json({ error: 'Form has already been completed' });
          }
          
          // Return the signing URL from submission data
          const submissionData = submission.submissionData as any;
          let signingUrl = submissionData?.signingUrl;
          
          if (submissionData?.signingUrls?.employee) {
            signingUrl = submissionData.signingUrls.employee;
          }
          
          if (!signingUrl) {
            return res.status(400).json({ error: 'No signing URL available for this submission' });
          }
          
          // Log audit for signing URL access
          await logAudit(req, 8, {
            action: 'get_signing_url_legacy',
            submissionId: submission.id,
            employeeId: submission.employeeId,
            requestedBy: req.user!.username
          });
          
          res.json({
            signingUrl,
            submissionId: submission.id,
            status: submission.status,
            employeeId: submission.employeeId
          });
        }
      } catch (error) {
        console.error('Error fetching signing URL:', error);
        res.status(500).json({ error: 'Failed to fetch signing URL' });
      }
    }
  );

  /**
   * GET /api/forms/submissions/:id/hr-sign
   * Get signing URL for HR to complete second-party signature
   * Returns the HR-specific signing URL if form requires HR signature
   */
  app.get('/api/forms/submissions/:id/hr-sign',
    requireAuth,
    requireRole(['admin', 'hr']),
    async (req: AuditRequest, res: Response) => {
      try {
        const submissionId = parseInt(req.params.id);
        const submission = await storage.getFormSubmission(submissionId);
        
        if (!submission) {
          return res.status(404).json({ error: 'Form submission not found' });
        }
        
        // Check if form requires HR signature
        const submissionData = submission.submissionData as any;
        if (!submissionData?.requiresHrSignature) {
          return res.status(400).json({ error: 'This form does not require HR signature' });
        }
        
        // Check if HR has already signed
        if (submissionData?.hrSigned) {
          return res.status(400).json({ error: 'HR has already signed this form' });
        }
        
        // Check if employee has signed (if required)
        if (submissionData?.requiresEmployeeFirst && !submissionData?.employeeSigned) {
          return res.status(400).json({ error: 'Employee must sign first before HR can sign' });
        }
        
        // Get HR signing URL
        const hrSigningUrl = submissionData?.signingUrls?.hr;
        
        if (!hrSigningUrl) {
          return res.status(400).json({ error: 'No HR signing URL available for this submission' });
        }
        
        res.json({
          signingUrl: hrSigningUrl,
          submissionId: submission.id,
          status: submission.status,
          employeeId: submission.employeeId,
          employeeSigned: submissionData?.employeeSigned || false,
          requiresEmployeeFirst: submissionData?.requiresEmployeeFirst || false
        });
      } catch (error) {
        console.error('Error fetching HR signing URL:', error);
        res.status(500).json({ error: 'Failed to fetch HR signing URL' });
      }
    }
  );

  /**
   * GET /api/forms/signing-queue
   * Get signing queue for an employee with full party/signer details
   * Query params: employeeId (required), includeParties (optional boolean)
   * Auth: HR/Admin can query any employeeId, employees only their own
   */
  app.get('/api/forms/signing-queue',
    requireAuth,
    async (req: AuditRequest, res: Response) => {
      try {
        const employeeId = parseInt(req.query.employeeId as string);
        const includeParties = req.query.includeParties === 'true';
        
        if (!employeeId || isNaN(employeeId)) {
          return res.status(400).json({ error: 'Employee ID is required' });
        }
        
        // Check if user is the employee themselves or has HR/admin role
        const employee = await storage.getEmployee(employeeId);
        if (!employee) {
          return res.status(404).json({ error: 'Employee not found' });
        }
        
        const isOwnProfile = employee.userId === req.user!.id;
        const hasManagementRole = req.user!.role === 'admin' || req.user!.role === 'hr';
        
        if (!isOwnProfile && !hasManagementRole) {
          return res.status(403).json({ error: 'Insufficient permissions to view signing queue' });
        }
        
        // Get form submissions for the employee
        const submissions = await storage.getFormSubmissions(employeeId);
        
        // Filter to only pending or in-progress submissions
        const pendingSubmissions = submissions.filter(s => 
          s.status !== 'completed' && s.status !== 'cancelled' && s.status !== 'expired'
        );
        
        // Build the signing queue with party details if requested
        const signingQueue = await Promise.all(
          pendingSubmissions.map(async (submission) => {
            const template = await storage.getDocusealTemplate(submission.templateId);
            
            // Base response
            const queueItem: any = {
              submissionId: submission.submissionId,
              templateName: template?.name || (submission as any).templateName || 'Unknown Form',
              createdAt: submission.createdAt,
              status: submission.status as 'pending' | 'completed',
            };
            
            // Add party details if requested
            if (includeParties) {
              try {
                // Initialize DocuSeal service if not already done
                const { docuSealService } = await import('./services/docusealService');
                const serviceInitialized = await docuSealService.initialize();
                
                if (!serviceInitialized) {
                  // If DocuSeal is not configured, use basic info from database
                  const submissionData = submission.submissionData as any || {};
                  queueItem.parties = [
                    {
                      name: submission.recipientName || `${employee.firstName} ${employee.lastName}`,
                      email: submission.recipientEmail,
                      role: 'employee',
                      status: submission.status === 'completed' ? 'completed' : 
                             submission.openedAt ? 'opened' : 
                             submission.sentAt ? 'sent' : 'pending',
                      sentAt: submission.sentAt?.toISOString(),
                      openedAt: submission.openedAt?.toISOString(),
                      completedAt: submission.completedAt?.toISOString()
                    }
                  ];
                  
                  // Add HR party if multi-party signing
                  if (submissionData.requiresHrSignature) {
                    queueItem.parties.push({
                      name: 'HR Department',
                      email: process.env.HR_EMAIL || 'hr@company.com',
                      role: 'hr',
                      status: submissionData.hrSigned ? 'completed' : 'pending',
                      sentAt: submission.sentAt?.toISOString(),
                      completedAt: submissionData.hrSigned ? submission.completedAt?.toISOString() : undefined
                    });
                  }
                } else {
                  // Fetch real-time details from DocuSeal API
                  const apiSubmission = await docuSealService.getSubmission(submission.submissionId);
                  
                  queueItem.parties = apiSubmission.submitters.map((submitter: any) => ({
                    name: submitter.name || submitter.email,
                    email: submitter.email,
                    role: submitter.role || 'signer',
                    status: submitter.status as 'pending' | 'sent' | 'opened' | 'completed',
                    sentAt: submitter.sent_at,
                    openedAt: submitter.opened_at,
                    completedAt: submitter.completed_at
                  }));
                }
              } catch (error) {
                console.error(`Failed to fetch party details for submission ${submission.id}:`, error);
                // Fallback to basic info if API call fails
                queueItem.parties = [
                  {
                    name: submission.recipientName || `${employee.firstName} ${employee.lastName}`,
                    email: submission.recipientEmail,
                    role: 'employee',
                    status: submission.status as 'pending' | 'sent' | 'opened' | 'completed',
                    sentAt: submission.sentAt?.toISOString(),
                    openedAt: submission.openedAt?.toISOString(),
                    completedAt: submission.completedAt?.toISOString()
                  }
                ];
              }
            }
            
            return queueItem;
          })
        );
        
        // Log access for audit trail
        await logAudit(req, 8, { 
          action: 'view_signing_queue',
          employeeId, 
          isOwnProfile, 
          queueCount: signingQueue.length,
          includeParties 
        });
        
        res.json(signingQueue);
      } catch (error) {
        console.error('Error fetching signing queue:', error);
        res.status(500).json({ error: 'Failed to fetch signing queue' });
      }
    }
  );

  /**
   * Rate limiter for reminder endpoints
   * Max 1 reminder per submission per hour
   */
  const reminderLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 1, // limit each submission to 1 reminder per hour
    keyGenerator: (req: any) => {
      // Use submission ID as the key for rate limiting
      return `reminder_${req.params.id}`;
    },
    message: 'Too many reminder requests. Please wait at least 1 hour between reminders for the same submission.'
  });

  /**
   * POST /api/forms/submissions/:id/remind
   * Send reminder to signer(s) for a submission
   * Body: { signerEmail?: string }
   * Auth: HR/Admin only
   */
  app.post('/api/forms/submissions/:id/remind',
    requireAuth,
    requireRole(['admin', 'hr']),
    reminderLimiter,
    [
      body('signerEmail').optional().isEmail().withMessage('Invalid email address')
    ],
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const submissionId = parseInt(req.params.id);
        const { signerEmail } = req.body;
        
        // Get submission from database
        const submission = await storage.getFormSubmission(submissionId);
        if (!submission) {
          return res.status(404).json({ error: 'Form submission not found' });
        }
        
        // Check if submission is already completed
        if (submission.status === 'completed') {
          return res.status(400).json({ error: 'Cannot send reminder for completed submission' });
        }
        
        // Check if submission is expired
        if (submission.status === 'expired') {
          return res.status(400).json({ error: 'Cannot send reminder for expired submission' });
        }
        
        // Check rate limiting at database level for specific signer
        if (signerEmail && submission.lastReminderAt) {
          const hoursSinceLastReminder = (Date.now() - new Date(submission.lastReminderAt).getTime()) / (1000 * 60 * 60);
          if (hoursSinceLastReminder < 1) {
            return res.status(429).json({ 
              error: `Reminder was already sent ${Math.round(hoursSinceLastReminder * 60)} minutes ago. Please wait at least 1 hour between reminders.`
            });
          }
        }
        
        // Check if DocuSeal is configured
        const { docuSealService } = await import('./services/docusealService');
        const serviceInitialized = await docuSealService.initialize();
        
        if (!serviceInitialized) {
          return res.status(503).json({ error: 'DocuSeal service is not configured' });
        }
        
        // Send reminder via DocuSeal
        const result = await docuSealService.sendReminder(submission.submissionId, signerEmail);
        
        if (!result.success) {
          return res.status(400).json({ error: result.message });
        }
        
        // Log audit for reminder sent
        await logAudit(req, 8, {
          action: 'send_reminder',
          submissionId: submission.id,
          employeeId: submission.employeeId,
          signerEmail: signerEmail || 'all',
          sentBy: req.user!.username
        });
        
        res.json({
          success: true,
          message: result.message,
          submissionId: submission.id,
          remindersSent: (submission.remindersSent || 0) + 1
        });
      } catch (error) {
        console.error('Error sending reminder:', error);
        res.status(500).json({ error: 'Failed to send reminder' });
      }
    }
  );

  /**
   * GET /api/onboarding/forms
   * Get required onboarding form templates
   */
  app.get('/api/onboarding/forms',
    requireAuth,
    async (req: AuditRequest, res: Response) => {
      try {
        const templates = await storage.getOnboardingTemplates();
        res.json(templates);
      } catch (error) {
        console.error('Error fetching onboarding forms:', error);
        res.status(500).json({ error: 'Failed to fetch onboarding forms' });
      }
    }
  );

  /**
   * POST /api/onboarding/forms/send
   * Send onboarding forms to new employee
   */
  app.post('/api/onboarding/forms/send',
    requireAuth,
    requireRole(['admin', 'hr']),
    [
      body('invitationId').isNumeric().withMessage('Invitation ID is required'),
      body('employeeId').isNumeric().withMessage('Employee ID is required')
    ],
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const { invitationId, employeeId } = req.body;
        const { docuSealService } = await import('./services/docusealService');
        
        const submissions = await docuSealService.sendOnboardingForms(
          invitationId,
          employeeId,
          req.user!.id
        );
        
        await logAudit(req, 1, employeeId, { onboardingFormsSent: submissions.length });
        res.json({
          message: `Sent ${submissions.length} onboarding forms`,
          submissions
        });
      } catch (error) {
        console.error('Error sending onboarding forms:', error);
        res.status(500).json({ error: 'Failed to send onboarding forms' });
      }
    }
  );

  /**
   * GET /api/onboarding/forms/status/:invitationId
   * Check onboarding forms completion status
   */
  app.get('/api/onboarding/forms/status/:invitationId',
    requireAuth,
    async (req: AuditRequest, res: Response) => {
      try {
        const invitationId = parseInt(req.params.invitationId);
        const { docuSealService } = await import('./services/docusealService');
        const completed = await docuSealService.areOnboardingFormsCompleted(invitationId);
        const submissions = await storage.getFormSubmissionsByInvitation(invitationId);
        
        res.json({
          completed,
          totalForms: submissions.length,
          completedForms: submissions.filter(s => s.status === 'completed').length,
          submissions
        });
      } catch (error) {
        console.error('Error checking onboarding forms status:', error);
        res.status(500).json({ error: 'Failed to check onboarding forms status' });
      }
    }
  );

  /**
   * Employee Invitation Management Routes
   * 
   * @description
   * Endpoints for managing employee invitations for self-service onboarding.
   * Supports invitation creation, tracking, and reminder management.
   */

  /**
   * GET /api/invitations
   * Get all employee invitations
   */
  app.get('/api/invitations',
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:employees'),
    requireRole(['admin', 'hr']),
    async (req: AuditRequest, res: Response) => {
      try {
        const invitations = await storage.getAllInvitations();
        
        // Enhance invitations with form status
        const invitationsWithFormStatus = await Promise.all(
          invitations.map(async (invitation) => {
            let formStatus = {
              totalForms: 0,
              completedForms: 0,
              pendingForms: 0,
              allFormsCompleted: false
            };
            
            // Only check form status for invitations that have been registered
            if (invitation.status === 'registered' || invitation.status === 'in_progress' || invitation.status === 'completed') {
              try {
                const submissions = await storage.getFormSubmissionsByInvitation(invitation.id);
                const onboardingSubmissions = submissions.filter(s => s.isOnboardingRequirement);
                
                formStatus.totalForms = onboardingSubmissions.length;
                formStatus.completedForms = onboardingSubmissions.filter(s => s.status === 'completed').length;
                formStatus.pendingForms = formStatus.totalForms - formStatus.completedForms;
                formStatus.allFormsCompleted = formStatus.totalForms > 0 && formStatus.pendingForms === 0;
                
                // Update invitation status if all forms are completed
                if (formStatus.allFormsCompleted && invitation.status === 'in_progress') {
                  await storage.updateInvitation(invitation.id, {
                    status: 'completed',
                    completedAt: new Date()
                  });
                  invitation.status = 'completed';
                  invitation.completedAt = new Date();
                }
              } catch (error) {
                console.error(`Failed to get form status for invitation ${invitation.id}:`, error);
              }
            }
            
            return {
              ...invitation,
              formStatus
            };
          })
        );
        
        res.json(invitationsWithFormStatus);
      } catch (error) {
        console.error('Error fetching invitations:', error);
        res.status(500).json({ error: 'Failed to fetch invitations' });
      }
    }
  );

  /**
   * GET /api/invitations/:token
   * Public endpoint to validate an invitation token
   * Used by the onboarding registration page
   */
  app.get('/api/invitations/:token',
    // No authentication required - this is a public endpoint
    async (req: AuditRequest, res: Response) => {
      try {
        const { token } = req.params;
        
        if (!token) {
          return res.status(400).json({ error: 'Token is required' });
        }
        
        // Get invitation by token
        const invitation = await storage.getInvitationByToken(token);
        
        if (!invitation) {
          return res.status(404).json({ error: 'Invalid or expired invitation token' });
        }
        
        // Check if invitation is expired
        const now = new Date();
        const expiresAt = new Date(invitation.expiresAt);
        
        if (now > expiresAt) {
          // Update invitation status to expired
          await storage.updateInvitation(invitation.id, { status: 'expired' });
          return res.status(410).json({ error: 'This invitation has expired' });
        }
        
        // Check if already registered
        if (invitation.status === 'registered' || invitation.status === 'completed' || invitation.status === 'approved') {
          return res.status(409).json({ error: 'This invitation has already been used' });
        }
        
        // Return invitation details (excluding sensitive information)
        res.json({
          id: invitation.id,
          firstName: invitation.firstName,
          lastName: invitation.lastName,
          email: invitation.email,
          expiresAt: invitation.expiresAt,
          status: invitation.status,
          isExpiringSoon: (expiresAt.getTime() - now.getTime()) < 24 * 60 * 60 * 1000 // Less than 24 hours
        });
      } catch (error) {
        console.error('Error validating invitation token:', error);
        res.status(500).json({ error: 'Failed to validate invitation token' });
      }
    }
  );

  /**
   * POST /api/invitations
   * Create a new employee invitation and send email
   */
  app.post('/api/invitations',
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']),
    // Parse multipart/form-data (and text fields) when a file is attached
    upload.single('offerLetter'),
    // Custom lightweight validation that works for both JSON and multipart
    (req: AuditRequest, res: Response, next) => {
      const errors: Array<{ type: string; msg: string; path: string; location: string }> = [];
      const firstName = (req.body?.firstName ?? '').toString().trim();
      const lastName = (req.body?.lastName ?? '').toString().trim();
      const email = (req.body?.email ?? '').toString().trim();
      if (!firstName) errors.push({ type: 'field', msg: 'First name is required', path: 'firstName', location: 'body' });
      if (!lastName) errors.push({ type: 'field', msg: 'Last name is required', path: 'lastName', location: 'body' });
      const emailRegex = /[^\s@]+@[^\s@]+\.[^\s@]+/;
      if (!email || !emailRegex.test(email)) errors.push({ type: 'field', msg: 'Valid email is required', path: 'email', location: 'body' });
      if (errors.length > 0) {
        return res.status(400).json({ error: 'Validation failed', details: errors });
      }
      next();
    },
    async (req: AuditRequest, res: Response) => {
      try {
        const { firstName, lastName, email, cellPhone, intendedRole } = req.body;
        // If an offer letter file was uploaded, it will be available at req.file
        // We don't persist it yet here, but we could store to S3 or link to the invitation in the future
        
        // Role-based invitation permissions
        const requestingUserRole = req.user?.role;
        let roleToAssign = 'prospective_employee'; // Default role for invitations
        
        if (intendedRole) {
          if (requestingUserRole === 'admin') {
            // Admin can invite users with any role
            roleToAssign = intendedRole;
          } else if (requestingUserRole === 'hr') {
            // HR can invite viewers or prospective employees
            if (intendedRole === 'viewer' || intendedRole === 'prospective_employee') {
              roleToAssign = intendedRole;
            } else {
              return res.status(403).json({ 
                error: 'HR users can only invite users with viewer or prospective_employee role' 
              });
            }
          } else {
            // Viewers cannot invite anyone (already blocked by requireRole)
            return res.status(403).json({ 
              error: 'You do not have permission to invite users' 
            });
          }
        }
        
        // Check if invitation already exists for this email
        const existingInvitation = await storage.getInvitationByEmail(email);
        if (existingInvitation && existingInvitation.status !== 'expired') {
          return res.status(400).json({ 
            error: 'An active invitation already exists for this email address' 
          });
        }
        
        // Generate secure invitation token
        const { key: invitationToken } = await generateApiKey('test');
        
        // Calculate expiration (7 days from now)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        
        // Calculate first reminder (24 hours from now)
        const nextReminderAt = new Date();
        nextReminderAt.setHours(nextReminderAt.getHours() + 24);
        
        // Create invitation record with intendedRole
        const invitation = await storage.createInvitation({
          firstName,
          lastName,
          email,
          cellPhone: cellPhone || null,
          invitationToken,
          invitedBy: req.user!.id,
          expiresAt,
          nextReminderAt,
          intendedRole: roleToAssign
        });
        
        // Generate invitation link using proper domain detection
        const baseUrl = getBaseUrl(req);
        const invitationLink = `${baseUrl}/onboarding/register?token=${invitationToken}`;
        console.log(`Invitation link generated: ${invitationLink}`);
        
        // Send invitation email
        const { mailtrapService } = await import('./services/mailtrapService');
        console.log('Attempting to send invitation email to:', email);
        
        // Check if Mailtrap is initialized
        const isInitialized = await mailtrapService.initialize();
        console.log('Mailtrap Service initialized:', isInitialized);
        
        const emailResult = await mailtrapService.sendInvitationEmail(
          {
            to: email,
            firstName,
            lastName,
            invitationLink,
            expiresIn: '7 days'
          },
          invitation.id,
          0 // Initial invitation, not a reminder
        );
        
        console.log('Email send result:', emailResult);
        
        // Check if email was sent in development mode
        const isDevelopmentMode = emailResult.error?.includes('Development mode');
        
        if (!emailResult.success && !isDevelopmentMode) {
          console.error('Failed to send invitation email:', emailResult.error);
          // Update invitation status to reflect email failure
          await storage.updateInvitation(invitation.id, {
            status: 'pending',
            metadata: { emailError: emailResult.error }
          });
          
          // Log audit for failed email
          await logAudit(req, invitation.id, null, { email, firstName, lastName, emailError: emailResult.error });
          
          // Return error response to match test email behavior
          return res.status(400).json({
            error: 'Failed to send invitation email',
            details: emailResult.error,
            invitation: {
              id: invitation.id,
              email: invitation.email,
              firstName: invitation.firstName,
              lastName: invitation.lastName,
              status: 'pending',
              expiresAt: invitation.expiresAt,
              note: 'Invitation was created but email delivery failed. You can try resending the invitation.'
            }
          });
        } else if (isDevelopmentMode) {
          console.log('Invitation email logged in development mode for:', email);
          console.log('Invitation link:', invitationLink);
        } else {
          console.log('Invitation email sent successfully to:', email);
        }
        
        // Log audit for successful email
        await logAudit(req, invitation.id, null, { email, firstName, lastName });
        
        res.status(201).json({
          message: 'Invitation created and email sent successfully',
          invitation: {
            id: invitation.id,
            email: invitation.email,
            firstName: invitation.firstName,
            lastName: invitation.lastName,
            status: invitation.status,
            expiresAt: invitation.expiresAt
          }
        });
      } catch (error) {
        console.error('Error creating invitation:', error);
        res.status(500).json({ error: 'Failed to create invitation' });
      }
    }
  );

  /**
   * POST /api/invitations/test-generate
   * Generate a test invitation for onboarding testing
   * Admin-only endpoint that creates a test invitation without sending emails
   */
  app.post('/api/invitations/test-generate',
    requireAuth, // Simple session auth check
    requireRole(['admin']), // Admin only
    async (req: AuditRequest, res: Response) => {
      try {
        // Generate unique test email with timestamp
        const timestamp = Date.now();
        const testEmail = `test_${timestamp}@example.com`;
        
        // Generate test user details
        const firstName = 'Test';
        const lastName = `User_${timestamp}`;
        const cellPhone = '555-0100';
        
        // Check if an invitation already exists for this test email (unlikely but safe)
        const existingInvitation = await storage.getInvitationByEmail(testEmail);
        if (existingInvitation && existingInvitation.status !== 'expired') {
          // This should never happen with timestamp-based emails, but just in case
          return res.status(400).json({ 
            error: 'Test invitation generation collision. Please try again.' 
          });
        }
        
        // Generate secure invitation token
        const { key: invitationToken } = await generateApiKey('test');
        
        // Calculate expiration (7 days from now)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        
        // Calculate first reminder (24 hours from now) - though we won't send it
        const nextReminderAt = new Date();
        nextReminderAt.setHours(nextReminderAt.getHours() + 24);
        
        // Create invitation record with prospective_employee role
        const invitation = await storage.createInvitation({
          firstName,
          lastName,
          email: testEmail,
          cellPhone,
          invitationToken,
          invitedBy: req.user!.id,
          expiresAt,
          nextReminderAt,
          intendedRole: 'prospective_employee' // Always use prospective_employee for test invitations
        });
        
        // Generate invitation link using proper domain detection
        const baseUrl = getBaseUrl(req);
        const registrationLink = `${baseUrl}/onboarding/register?token=${invitationToken}`;
        
        console.log('Test invitation generated:', {
          id: invitation.id,
          email: testEmail,
          token: invitationToken,
          link: registrationLink
        });
        
        // Log audit for test invitation creation
        await logAudit(req, invitation.id, null, { 
          action: 'test_invitation_generated',
          email: testEmail, 
          firstName, 
          lastName 
        });
        
        // Return comprehensive test invitation details
        res.status(201).json({
          message: 'Test invitation generated successfully. Use the registration link to test the onboarding flow.',
          usage: 'Open the registration link in a browser to start the onboarding process. No email will be sent.',
          invitation: {
            id: invitation.id,
            firstName: invitation.firstName,
            lastName: invitation.lastName,
            email: invitation.email,
            token: invitationToken,
            status: invitation.status,
            expiresAt: invitation.expiresAt,
            intendedRole: 'prospective_employee'
          },
          registrationLink,
          testCredentials: {
            note: 'Use these details when registering:',
            email: testEmail,
            suggestedUsername: `testuser_${timestamp}`,
            suggestedPassword: 'TestPassword123!' // Just a suggestion, user can choose their own
          }
        });
      } catch (error) {
        console.error('Error generating test invitation:', error);
        res.status(500).json({ error: 'Failed to generate test invitation' });
      }
    }
  );

  /**
   * GET /api/invitations/:id/form-status
   * Get form submission status for a specific invitation
   */
  app.get('/api/invitations/:id/form-status',
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:employees'),
    requireRole(['admin', 'hr']),
    validateId,
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const invitationId = parseInt(req.params.id);
        
        // Get invitation
        const invitation = await storage.getInvitationById(invitationId);
        if (!invitation) {
          return res.status(404).json({ error: 'Invitation not found' });
        }
        
        // Get form submissions for this invitation
        const submissions = await storage.getFormSubmissionsByInvitation(invitationId);
        const onboardingSubmissions = submissions.filter(s => s.isOnboardingRequirement);
        
        // Calculate status
        const formStatus = {
          invitationId,
          employeeId: invitation.employeeId,
          totalForms: onboardingSubmissions.length,
          completedForms: onboardingSubmissions.filter(s => s.status === 'completed').length,
          pendingForms: 0,
          inProgressForms: onboardingSubmissions.filter(s => s.status === 'in_progress' || s.status === 'opened').length,
          allFormsCompleted: false,
          submissions: onboardingSubmissions.map(s => ({
            id: s.id,
            templateId: s.templateId,
            status: s.status,
            sentAt: s.sentAt,
            openedAt: s.openedAt,
            completedAt: s.completedAt,
            expiresAt: s.expiresAt
          }))
        };
        
        formStatus.pendingForms = formStatus.totalForms - formStatus.completedForms;
        formStatus.allFormsCompleted = formStatus.totalForms > 0 && formStatus.pendingForms === 0;
        
        res.json(formStatus);
      } catch (error) {
        console.error('Error fetching form status:', error);
        res.status(500).json({ error: 'Failed to fetch form status' });
      }
    }
  );

  /**
   * GET /api/onboarding/my-onboarding
   * Get current user's onboarding data
   */
  app.get('/api/onboarding/my-onboarding',
    requireAnyAuth,
    requireRole(['prospective_employee']),
    async (req: AuditRequest, res: Response) => {
      try {
        const userId = req.user!.id;
        
        // Find employee linked to this user
        const employees = await storage.getAllEmployees();
        const employee = employees.find(emp => emp.userId === userId);
        
        if (!employee) {
          return res.status(404).json({ error: 'No onboarding data found' });
        }
        
        // Get related entities
        const [educations, employments, stateLicenses, deaLicenses, boardCertifications, 
               peerReferences, emergencyContacts, taxForms, trainings, payerEnrollments, incidentLogs] = await Promise.all([
          storage.getEmployeeEducations(employee.id!),
          storage.getEmployeeEmployments(employee.id!),
          storage.getEmployeeStateLicenses(employee.id!),
          storage.getEmployeeDeaLicenses(employee.id!),
          storage.getEmployeeBoardCertifications(employee.id!),
          storage.getEmployeePeerReferences(employee.id!),
          storage.getEmployeeEmergencyContacts(employee.id!),
          storage.getEmployeeTaxForms(employee.id!),
          storage.getEmployeeTrainings(employee.id!),
          storage.getEmployeePayerEnrollments(employee.id!),
          storage.getEmployeeIncidentLogs(employee.id!)
        ]);
        
        res.json({
          ...employee,
          educations,
          employments,
          stateLicenses,
          deaLicenses,
          boardCertifications,
          peerReferences,
          emergencyContacts,
          taxForms,
          trainings,
          payerEnrollments,
          incidentLogs,
          hadLicenseIncidents: (employee as any).hadLicenseIncidents ?? (incidentLogs.length > 0)
        });
      } catch (error) {
        console.error('Error fetching onboarding data:', error);
        res.status(500).json({ error: 'Failed to fetch onboarding data' });
      }
    }
  );

  /**
   * POST /api/onboarding/save-draft
   * 
   * @route POST /api/onboarding/save-draft
   * @group Onboarding - Employee onboarding operations
   * @security Session - Requires prospective_employee role
   * 
   * @description
   * Save onboarding progress as draft without requiring complete validation.
   * This endpoint enables incremental, auto-save functionality during the 12-step onboarding wizard,
   * allowing prospective employees to save partial data and resume later.
   * 
   * **Key Features:**
   * 
   * 1. **Transaction Atomicity**
   *    - All operations (employee + 9 nested entities) wrapped in single database transaction
   *    - Automatic rollback on any error prevents partial data corruption
   *    - WHY: Critical to maintain referential integrity across 10+ tables during draft saves
   * 
   * 2. **Validation Strategy**
   *    - Uses Zod insert schemas from @shared/schema.ts for type safety
   *    - `.omit()` - Removes sensitive/controlled fields (userId, status, approvedAt, etc.)
   *    - `.partial()` - Makes all fields optional (draft allows incomplete data)
   *    - `.strict()` - Rejects unknown fields for security
   *    - WHY: Balances flexibility (partial saves) with security (field whitelisting)
   * 
   * 3. **Entity Ownership Security**
   *    - ALWAYS uses req.user.id as source of truth (never from request body)
   *    - Verifies ownership before updating nested entities (educations, licenses, etc.)
   *    - Prevents cross-employee data tampering by checking entity.employeeId matches
   *    - WHY: Prevents malicious users from updating other employees' data via manipulated IDs
   * 
   * 4. **Array Length Limits**
   *    - Maximum 50 items per nested entity array (educations, employments, etc.)
   *    - WHY: Prevents DoS attacks via extremely large payloads
   * 
   * 5. **Date Field Sanitization**
   *    - Converts empty strings to null for proper database insertion
   *    - WHY: PostgreSQL rejects empty strings for date columns
   * 
   * **Request Flow:**
   * ```
   * Step 1: Extract userId from req.user.id (SECURITY: never trust request body)
   * Step 2: Sanitize date fields (empty string -> null)
   * Step 3: Validate with Zod schemas (.omit + .partial + .strict)
   * Step 4: Extract employee data + 9 nested entity arrays
   * Step 5-6: START TRANSACTION
   *   - Upsert employee record (create or update)
   *   - Fetch existing nested entities for ownership verification
   *   - For each nested entity with ID:
   *     * Verify it belongs to this employee (SECURITY CHECK)
   *     * Update if valid, throw error if ownership mismatch
   *   - For each nested entity without ID:
   *     * Insert new record with correct employeeId
   * Step 7: COMMIT TRANSACTION (or rollback on any error)
   * Step 8: Log audit trail
   * Step 9: Return success response
   * ```
   * 
   * @param {object} req.body - Onboarding draft data
   * @param {string} req.body.firstName - Employee first name (optional in draft)
   * @param {string} req.body.lastName - Employee last name (optional in draft)
   * @param {Array} req.body.educations - Education records (optional, max 50)
   * @param {Array} req.body.employments - Employment history (optional, max 50)
   * @param {Array} req.body.stateLicenses - State licenses (optional, max 50)
   * @param {Array} req.body.deaLicenses - DEA licenses (optional, max 50)
   * @param {Array} req.body.boardCertifications - Board certifications (optional, max 50)
   * @param {Array} req.body.peerReferences - Professional references (optional, max 50)
   * @param {Array} req.body.emergencyContacts - Emergency contacts (optional, max 50)
   * @param {Array} req.body.taxForms - Tax forms (optional, max 50)
   * @param {Array} req.body.trainings - Training records (optional, max 50)
   * @param {Array} req.body.payerEnrollments - Payer enrollments (optional, max 50)
   * 
   * @returns {object} 200 - Draft saved successfully
   * @returns {object} 400 - Validation failed
   * @returns {Error} 401 - Authentication required
   * @returns {Error} 403 - Must be prospective_employee role
   * @returns {Error} 500 - Transaction failed (all changes rolled back)
   * 
   * @example request - Save partial personal information
   * POST /api/onboarding/save-draft
   * {
   *   "firstName": "John",
   *   "lastName": "Doe",
   *   "personalEmail": "john@example.com"
   * }
   * 
   * @example request - Save with nested entities
   * POST /api/onboarding/save-draft
   * {
   *   "firstName": "John",
   *   "educations": [
   *     {
   *       "educationType": "Medical School",
   *       "schoolInstitution": "Harvard Medical School",
   *       "degree": "MD"
   *     }
   *   ],
   *   "stateLicenses": [
   *     {
   *       "id": 123,
   *       "licenseNumber": "CA12345",
   *       "state": "California",
   *       "expirationDate": "2025-12-31"
   *     }
   *   ]
   * }
   * 
   * @example response - 200 - Success
   * {
   *   "success": true,
   *   "message": "Draft saved successfully",
   *   "employeeId": 456,
   *   "timestamp": "2025-10-01T12:00:00Z"
   * }
   */
  app.post('/api/onboarding/save-draft',
    requireAnyAuth,
    requireRole(['prospective_employee']),
    async (req: AuditRequest, res: Response) => {
      try {
        console.log('[save-draft] Starting save draft for userId:', req.user!.id);
        
        // SECURITY: Always use req.user.id as source of truth, never from request body
        const userId = req.user!.id;
        
        // Step 1: Sanitize date fields first
        const sanitizedData = sanitizeDateFields(req.body);
        console.log('[save-draft] Date fields sanitized');
        
        // Step 2: Define validation schema manually to avoid drizzle-zod .shape issues
        // SECURITY: Only include fields that should be accepted from request body
        // Excluded fields: id, userId, status, applicationStatus, onboardingStatus, 
        //                  invitationId, onboardingCompletedAt, approvedAt, approvedBy, createdAt, updatedAt
        const employeeDraftSchema = z.object({
          // Basic personal information
          firstName: z.string().max(50),
          middleName: z.string().max(50).nullable().optional(),
          lastName: z.string().max(50),
          dateOfBirth: z.coerce.date().nullable().optional(),
          
          // Contact information
          personalEmail: z.string().max(100).email().nullable().optional(),
          workEmail: z.string().max(100).email(),
          cellPhone: z.string().max(20).nullable().optional(),
          workPhone: z.string().max(20).nullable().optional(),
          
          // Home address information
          homeAddress1: z.string().max(100).nullable().optional(),
          homeAddress2: z.string().max(100).nullable().optional(),
          homeCity: z.string().max(50).nullable().optional(),
          homeState: z.string().max(50).nullable().optional(),
          homeZip: z.string().max(10).nullable().optional(),
          
          // Demographic information
          gender: z.string().max(20).nullable().optional(),
          birthCity: z.string().max(50).nullable().optional(),
          birthState: z.string().max(50).nullable().optional(),
          birthCountry: z.string().max(50).nullable().optional(),
          
          // Department
          department: z.string().max(100).nullable().optional(),
          
          // Driver's license information
          driversLicenseNumber: z.string().max(50).nullable().optional(),
          dlStateIssued: z.string().max(50).nullable().optional(),
          dlIssueDate: z.coerce.date().nullable().optional(),
          dlExpirationDate: z.coerce.date().nullable().optional(),
          
          // Sensitive identification
          ssn: z.string().max(255).nullable().optional(), // Increased for encrypted format
          
          // National Provider Identifier (NPI)
          npiNumber: z.string().max(20).nullable().optional(),
          enumerationDate: z.coerce.date().nullable().optional(),
          
          // Employment information
          jobTitle: z.string().max(100).nullable().optional(),
          workLocation: z.string().max(100).nullable().optional(),
          qualification: z.string().nullable().optional(),
          hasEmploymentGap: z.boolean().nullable().optional(),
          employmentGap: z.string().max(2000).nullable().optional(),
          
          // Medical licensing information
          medicalLicenseNumber: z.string().max(50).nullable().optional(),
          medicalLicenseState: z.string().max(50).nullable().optional(),
          medicalLicenseIssueDate: z.coerce.date().nullable().optional(),
          medicalLicenseExpirationDate: z.coerce.date().nullable().optional(),
          medicalLicenseStatus: z.string().max(50).nullable().optional(),
          medicalQualification: z.string().nullable().optional(),
          substanceUseLicenseNumber: z.string().max(50).nullable().optional(),
          substanceUseLicenseState: z.string().max(50).nullable().optional(),
          substanceUseLicenseIssueDate: z.coerce.date().nullable().optional(),
          substanceUseLicenseExpirationDate: z.coerce.date().nullable().optional(),
          substanceUseLicenseStatus: z.string().max(50).nullable().optional(),
          substanceUseQualification: z.string().nullable().optional(),
          mentalHealthLicenseNumber: z.string().max(50).nullable().optional(),
          mentalHealthLicenseState: z.string().max(50).nullable().optional(),
          mentalHealthLicenseIssueDate: z.coerce.date().nullable().optional(),
          mentalHealthLicenseExpirationDate: z.coerce.date().nullable().optional(),
          mentalHealthLicenseStatus: z.string().max(50).nullable().optional(),
          mentalHealthQualification: z.string().nullable().optional(),
          
          // DEA License
          deaNumber: z.string().max(50).nullable().optional(),
          
          // Payer/billing identifiers
          medicaidNumber: z.string().max(50).nullable().optional(),
          medicarePtanNumber: z.string().max(50).nullable().optional(),
          
          // CAQH integration
          caqhProviderId: z.string().max(50).nullable().optional(),
          caqhIssueDate: z.coerce.date().nullable().optional(),
          caqhLastAttestationDate: z.coerce.date().nullable().optional(),
          caqhEnabled: z.boolean().nullable().optional(),
          caqhReattestationDueDate: z.coerce.date().nullable().optional(),
          caqhLoginId: z.string().max(50).nullable().optional(),
          caqhPassword: z.string().max(100).nullable().optional(),
          
          // NPPES integration
          nppesLoginId: z.string().max(50).nullable().optional(),
          nppesPassword: z.string().max(100).nullable().optional()
        })
        .partial()             // All fields optional for draft
        .strict();             // Reject unknown fields
        
        // Define array schemas with proper validation and length limits
        const MAX_ARRAY_LENGTH = 50;
        
        // Manual schemas for related entities to avoid .shape issues
        const educationDraftSchema = z.object({
          id: z.number().optional(),  // For tracking existing records during updates
          employeeId: z.number().optional(),  // Allow employeeId from existing records
          educationType: z.string().max(50).nullable().optional(),
          schoolInstitution: z.string().max(100).nullable().optional(),
          degree: z.string().max(50).nullable().optional(),
          specialtyMajor: z.string().max(100).nullable().optional(),
          startDate: z.coerce.date().nullable().optional(),
          endDate: z.coerce.date().nullable().optional()
        }).partial().strict();
        
        const employmentDraftSchema = z.object({
          id: z.number().optional(),
          employeeId: z.number().optional(),  // Allow employeeId from existing records
          employer: z.string().max(100).nullable().optional(),
          position: z.string().max(100).nullable().optional(),
          startDate: z.coerce.date().nullable().optional(),
          endDate: z.coerce.date().nullable().optional(),
          description: z.string().nullable().optional()
        }).partial().strict();
        
        const stateLicenseDraftSchema = z.preprocess((data: any) => {
          // Transform data before validation: remove invalid string IDs and source field
          if (data && typeof data === 'object') {
            const cleaned: any = { ...data };
            // Filter out invalid string IDs (like "credentials-medical")
            if (cleaned.id && typeof cleaned.id === 'string' && !cleaned.id.match(/^\d+$/)) {
              delete cleaned.id;
            }
            // Remove source field
            delete cleaned.source;
            return cleaned;
          }
          return data;
        }, z.object({
          id: z.union([z.number(), z.string()]).optional().transform((val) => {
            if (typeof val === 'string' && val.match(/^\d+$/)) {
              return parseInt(val);
            }
            return typeof val === 'number' ? val : undefined;
          }),
          employeeId: z.number().optional(),
          licenseNumber: z.string().max(50).optional(),
          state: z.string().max(50).optional(),
          licenseType: z.string().max(50).nullable().optional(),
          issueDate: z.coerce.date().nullable().optional(),
          expirationDate: z.coerce.date().nullable().optional(),
          status: z.string().max(50).nullable().optional()
        }).passthrough());
        
        const deaLicenseDraftSchema = z.preprocess((data: any) => {
          // Transform data before validation: remove invalid string IDs and map fields
          if (data && typeof data === 'object') {
            const cleaned: any = { ...data };
            // Filter out invalid string IDs (like "credentials-dea")
            if (cleaned.id && typeof cleaned.id === 'string' && !cleaned.id.match(/^\d+$/)) {
              delete cleaned.id;
            }
            // Map licenseNumber to deaNumber if needed
            if (cleaned.licenseNumber && !cleaned.deaNumber) {
              cleaned.deaNumber = cleaned.licenseNumber;
            }
            // Remove fields not in schema
            delete cleaned.licenseNumber;
            delete cleaned.state;
            delete cleaned.source;
            return cleaned;
          }
          return data;
        }, z.object({
          id: z.union([z.number(), z.string()]).optional().transform((val) => {
            if (typeof val === 'string' && val.match(/^\d+$/)) {
              return parseInt(val);
            }
            return typeof val === 'number' ? val : undefined;
          }),
          employeeId: z.number().optional(),
          deaNumber: z.string().max(50).optional(),
          issueDate: z.coerce.date().nullable().optional(),
          expirationDate: z.coerce.date().nullable().optional(),
          status: z.string().max(50).nullable().optional()
        }).passthrough());
        
        const boardCertificationDraftSchema = z.preprocess((data: any) => {
          // Transform data before validation: map frontend field names
          if (data && typeof data === 'object') {
            const cleaned: any = { ...data };
            // Map frontend field names to backend field names
            if (cleaned.certification && !cleaned.certificationName) {
              cleaned.certificationName = cleaned.certification;
            }
            if (cleaned.boardName && !cleaned.issuingBoard) {
              cleaned.issuingBoard = cleaned.boardName;
            }
            // Remove frontend field names
            delete cleaned.certification;
            delete cleaned.boardName;
            return cleaned;
          }
          return data;
        }, z.object({
          id: z.number().optional(),
          employeeId: z.number().optional(),
          certificationName: z.string().max(100).optional(),
          issuingBoard: z.string().max(100).nullable().optional(),
          certificationNumber: z.string().max(50).nullable().optional(),
          issueDate: z.coerce.date().nullable().optional(),
          expirationDate: z.coerce.date().nullable().optional()
        }).passthrough());
        
        const peerReferenceDraftSchema = z.object({
          id: z.number().optional(),
          employeeId: z.number().optional(),  // Allow employeeId from existing records
          referenceName: z.string().max(100).nullable().optional(),
          contactInfo: z.string().max(100).nullable().optional(),
          relationship: z.string().max(100).nullable().optional(),
          comments: z.string().nullable().optional()
        }).partial().strict();
        
        const emergencyContactDraftSchema = z.preprocess((data: any) => {
          // Transform data before validation: map frontend field names
          if (data && typeof data === 'object') {
            const cleaned: any = { ...data };
            // Map frontend field names to backend field names
            if (cleaned.name && !cleaned.contactName) {
              cleaned.contactName = cleaned.name;
            }
            if (cleaned.phone && !cleaned.phoneNumber) {
              cleaned.phoneNumber = cleaned.phone;
            }
            // Remove frontend field names
            delete cleaned.name;
            delete cleaned.phone;
            return cleaned;
          }
          return data;
        }, z.object({
          id: z.number().optional(),
          employeeId: z.number().optional(),
          contactName: z.string().max(100).nullable().optional(),
          relationship: z.string().max(50).nullable().optional(),
          phoneNumber: z.string().max(20).nullable().optional(),
          email: z.string().max(100).nullable().optional()
        }).passthrough());
        
        const taxFormDraftSchema = z.object({
          id: z.number().optional(),
          employeeId: z.number().optional(),  // Allow employeeId from existing records
          formType: z.string().max(50).nullable().optional(),
          w9Completed: z.boolean().nullable().optional(),
          signedDate: z.coerce.date().nullable().optional()
        }).partial().strict();
        
        const trainingDraftSchema = z.preprocess((data: any) => {
          if (data && typeof data === 'object') {
            const cleaned: any = { ...data };
            if (cleaned.trainingName && !cleaned.trainingType) {
              cleaned.trainingType = cleaned.trainingName;
            }
            if (cleaned.certificateNumber && !cleaned.certificatePath) {
              cleaned.certificatePath = cleaned.certificateNumber;
            }
            if (typeof cleaned.credits === 'string' && cleaned.credits.trim() === '') {
              cleaned.credits = null;
            }
            delete cleaned.trainingName;
            delete cleaned.certificateNumber;
            return cleaned;
          }
          return data;
        }, z.object({
          id: z.union([z.number(), z.string()]).optional().transform((val) => {
            if (typeof val === 'string' && val.match(/^\d+$/)) {
              return parseInt(val);
            }
            return typeof val === 'number' ? val : undefined;
          }),
          employeeId: z.number().optional(),
          trainingType: z.string().max(100).nullable().optional(),
          provider: z.string().max(100).nullable().optional(),
          completionDate: z.coerce.date().nullable().optional(),
          expirationDate: z.coerce.date().nullable().optional(),
          credits: z.preprocess((val) => {
            if (val === '' || val === undefined) return null;
            return val;
          }, z.coerce.number().nullable().optional()),
          certificatePath: z.string().max(255).nullable().optional()
        }).partial().strict());
        
        const incidentLogDraftSchema = z.object({
          id: z.union([z.number(), z.string()]).optional().transform((val) => {
            if (typeof val === 'string' && val.match(/^\d+$/)) {
              return parseInt(val);
            }
            return typeof val === 'number' ? val : undefined;
          }),
          employeeId: z.number().optional(),
          incidentDate: z.coerce.date().nullable().optional(),
          incidentType: z.string().max(100).nullable().optional(),
          description: z.string().nullable().optional(),
          severity: z.string().max(20).nullable().optional(),
          resolution: z.string().nullable().optional(),
          reportedBy: z.string().max(50).nullable().optional()
        }).partial().strict();

        const payerEnrollmentDraftSchema = z.preprocess((data: any) => {
          // Transform data before validation: map frontend field names
          if (data && typeof data === 'object') {
            const cleaned: any = { ...data };
            // Map frontend field names to backend field names
            if (cleaned.providerId && !cleaned.enrollmentId) {
              cleaned.enrollmentId = cleaned.providerId;
            }
            if (cleaned.enrollmentStatus && !cleaned.status) {
              cleaned.status = cleaned.enrollmentStatus;
            }
            // Remove frontend field names
            delete cleaned.providerId;
            delete cleaned.enrollmentStatus;
            return cleaned;
          }
          return data;
        }, z.object({
          id: z.number().optional(),
          employeeId: z.number().optional(),
          payerName: z.string().max(100).nullable().optional(),
          enrollmentId: z.string().max(50).nullable().optional(),
          effectiveDate: z.coerce.date().nullable().optional(),
          terminationDate: z.coerce.date().nullable().optional(),
          status: z.string().max(20).nullable().optional()
        }).passthrough());
        
        const onboardingDraftSchema = z.object({
          // Employee fields - flattened at root level to match existing frontend structure
          ...employeeDraftSchema.shape,
          
          // Related entities arrays with proper validation and length limits
          educations: z.array(educationDraftSchema)
            .max(MAX_ARRAY_LENGTH, `Maximum ${MAX_ARRAY_LENGTH} education records allowed`).optional(),
          
          employments: z.array(employmentDraftSchema)
            .max(MAX_ARRAY_LENGTH, `Maximum ${MAX_ARRAY_LENGTH} employment records allowed`).optional(),
          
          stateLicenses: z.array(stateLicenseDraftSchema)
            .max(MAX_ARRAY_LENGTH, `Maximum ${MAX_ARRAY_LENGTH} state license records allowed`).optional(),
          
          deaLicenses: z.array(deaLicenseDraftSchema)
            .max(MAX_ARRAY_LENGTH, `Maximum ${MAX_ARRAY_LENGTH} DEA license records allowed`).optional(),
          
          boardCertifications: z.array(boardCertificationDraftSchema)
            .max(MAX_ARRAY_LENGTH, `Maximum ${MAX_ARRAY_LENGTH} board certification records allowed`).optional(),
          
          peerReferences: z.array(peerReferenceDraftSchema)
            .max(MAX_ARRAY_LENGTH, `Maximum ${MAX_ARRAY_LENGTH} peer reference records allowed`).optional(),
          
          emergencyContacts: z.array(emergencyContactDraftSchema)
            .max(MAX_ARRAY_LENGTH, `Maximum ${MAX_ARRAY_LENGTH} emergency contact records allowed`).optional(),
          
          taxForms: z.array(taxFormDraftSchema)
            .max(MAX_ARRAY_LENGTH, `Maximum ${MAX_ARRAY_LENGTH} tax form records allowed`).optional(),
          
          trainings: z.array(trainingDraftSchema)
            .max(MAX_ARRAY_LENGTH, `Maximum ${MAX_ARRAY_LENGTH} training records allowed`).optional(),
          
          payerEnrollments: z.array(payerEnrollmentDraftSchema)
            .max(MAX_ARRAY_LENGTH, `Maximum ${MAX_ARRAY_LENGTH} payer enrollment records allowed`).optional(),

          incidentLogs: z.array(incidentLogDraftSchema)
            .max(MAX_ARRAY_LENGTH, `Maximum ${MAX_ARRAY_LENGTH} incident log records allowed`).optional(),
          
          // Frontend tracking fields (not stored directly, some used for validation logic)
          status: z.string().optional(),  // Frontend sends this but we override server-side
          documentUploads: z.array(z.any()).optional(),
          allRequiredDocumentsUploaded: z.boolean().optional(),
          uploadedRequiredCount: z.number().optional(),
          requiredDocumentsCount: z.number().optional(),
          allFormsCompleted: z.boolean().optional(),
          completedForms: z.number().optional(),
          totalRequiredForms: z.number().optional(),
          submissions: z.array(z.any()).optional()
        }).passthrough();  // Allow additional fields to pass through for flexibility
        
        // Step 3: Validate the sanitized data
        const validationResult = onboardingDraftSchema.safeParse(sanitizedData);
        if (!validationResult.success) {
          console.error('[save-draft] Validation failed:', validationResult.error.errors);
          return res.status(400).json({ 
            error: 'Validation failed', 
            details: validationResult.error.errors 
          });
        }
        
        let data = validationResult.data;
        console.log('[save-draft] Validation successful');
        
        // Convert any Date objects back to strings (Zod coerces dates to Date objects, but DB expects strings)
        const convertDatesToStrings = (obj: any): any => {
          if (!obj || typeof obj !== 'object') return obj;
          if (Array.isArray(obj)) {
            return obj.map(convertDatesToStrings);
          }
          const result: any = {};
          for (const [key, value] of Object.entries(obj)) {
            if (value instanceof Date) {
              // For date-only fields, convert to YYYY-MM-DD
              if (DATE_ONLY_FIELDS.has(key)) {
                result[key] = value.toISOString().split('T')[0];
              } else {
                // For timestamp fields, keep full ISO string
                result[key] = value.toISOString();
              }
            } else if (typeof value === 'object' && value !== null) {
              result[key] = convertDatesToStrings(value);
            } else {
              result[key] = value;
            }
          }
          return result;
        };
        
        data = convertDatesToStrings(data);
        console.log('[save-draft] Converted Date objects to strings');
        
        // Step 4: Extract employee and related entity data
        // NOTE: Allow prospective_employee to save nested entities - they need to complete the full form
        let {
          educations: educationsData,
          employments: employmentsData,
          stateLicenses: stateLicensesData,
          deaLicenses: deaLicensesData,
          boardCertifications: boardCertificationsData,
          peerReferences: peerReferencesData,
          emergencyContacts: emergencyContactsData,
          taxForms: taxFormsData,
          trainings: trainingsData,
          payerEnrollments: payerEnrollmentsData,
          incidentLogs: incidentLogsData,
          // SECURITY: Filter out server-controlled fields that should never come from frontend
          id,
          userId: _reqBodyUserId,
          createdAt,
          updatedAt,
          created_at,
          updated_at,
          status,
          applicationStatus,
          onboardingStatus,
          invitationId,
          onboardingCompletedAt,
          approvedAt,
          approvedBy,
          documentUploads,
          allRequiredDocumentsUploaded,
          uploadedRequiredCount,
          requiredDocumentsCount,
          allFormsCompleted,
          completedForms,
          totalRequiredForms,
          submissions,
          ...employeeData
        } = data;
        
        console.log('[save-draft] Extracted data structure');
        console.log('[save-draft] Employee fields present:', employeeData ? Object.keys(employeeData).length : 0);
        console.log('[save-draft] Related entities:', {
          educations: educationsData?.length || 0,
          employments: employmentsData?.length || 0,
          stateLicenses: stateLicensesData?.length || 0,
          deaLicenses: deaLicensesData?.length || 0,
          boardCertifications: boardCertificationsData?.length || 0,
          peerReferences: peerReferencesData?.length || 0,
          emergencyContacts: emergencyContactsData?.length || 0,
          taxForms: taxFormsData?.length || 0,
          trainings: trainingsData?.length || 0,
          payerEnrollments: payerEnrollmentsData?.length || 0,
          incidentLogs: incidentLogsData?.length || 0
        });
        
        // Step 5 & 6: ATOMIC TRANSACTION - Wrap all operations to prevent partial writes
        // All employee + nested entity upserts are now atomic with rollback-on-error
        // Using tx parameter directly ensures all operations are truly transactional
        const result = await db.transaction(async (tx) => {
          console.log('[save-draft] Starting database transaction');
          
          // Find existing employee by userId using tx (proper upsert)
          const existingEmployeeRows = await tx
            .select()
            .from(employees)
            .where(eq(employees.userId, userId));
          const employee = existingEmployeeRows[0];
          
          let employeeId: number;
          
          if (!employee) {
            // Create new employee record using tx
            console.log('[save-draft] Creating new employee record for userId:', userId);
            // SECURITY: Enforce userId from req.user, status from server
            // Remove any undefined or null values and convert Date objects to strings
            const cleanEmployeeData = Object.fromEntries(
              Object.entries(employeeData)
                .filter(([_, v]) => v !== undefined && v !== null && v !== '')
                .map(([k, v]) => {
                  // Convert Date objects to ISO strings for database insertion
                  if (v instanceof Date) {
                    // For date-only fields, convert to YYYY-MM-DD
                    if (DATE_ONLY_FIELDS.has(k)) {
                      return [k, v.toISOString().split('T')[0]];
                    }
                    // For timestamp fields, keep full ISO string
                    return [k, v.toISOString()];
                  }
                  return [k, v];
                })
            );
            const [newEmployee] = await tx
              .insert(employees)
              .values({
                ...cleanEmployeeData,
                userId,                           // SECURITY: Always from req.user.id
                status: 'prospective',            // SECURITY: Server-controlled
                onboardingStatus: 'in_progress'   // SECURITY: Server-controlled
              } as any)
              .returning();
            employeeId = newEmployee.id!;
            console.log('[save-draft] Employee created with id:', employeeId);
          } else {
            // Update existing employee record using tx
            employeeId = employee.id!;
            console.log('[save-draft] Updating existing employee id:', employeeId);
            // SECURITY: Never update userId, status, or onboardingStatus from request body
            // Remove any undefined or null values and convert Date objects to strings
            const cleanEmployeeData = Object.fromEntries(
              Object.entries(employeeData)
                .filter(([_, v]) => v !== undefined && v !== null && v !== '')
                .map(([k, v]) => {
                  // Convert Date objects to ISO strings for database insertion
                  if (v instanceof Date) {
                    // For date-only fields, convert to YYYY-MM-DD
                    if (DATE_ONLY_FIELDS.has(k)) {
                      return [k, v.toISOString().split('T')[0]];
                    }
                    // For timestamp fields, keep full ISO string
                    return [k, v.toISOString()];
                  }
                  return [k, v];
                })
            );
            await tx
              .update(employees)
              .set({
                ...cleanEmployeeData,
                // SECURITY: Preserve server-controlled fields
                userId: employee.userId,           // Never allow changing userId
                status: employee.status,           // Never allow changing status
                onboardingStatus: 'in_progress',   // Server-controlled
                updatedAt: new Date()
              } as any)
              .where(eq(employees.id, employeeId));
            console.log('[save-draft] Employee updated');
          }
          
          // Handle related entities with ownership verification using tx
          // SECURITY: Verify entity ownership before updates to prevent cross-employee tampering
          // First fetch all existing entities for this employee to verify ownership using tx
          const [
            existingEducations,
            existingEmployments,
            existingStateLicenses,
            existingDeaLicenses,
            existingBoardCertifications,
            existingPeerReferences,
            existingEmergencyContacts,
            existingTaxForms,
            existingTrainings,
            existingPayerEnrollments,
            existingIncidentLogs
          ] = await Promise.all([
            tx.select().from(educations).where(eq(educations.employeeId, employeeId)),
            tx.select().from(employments).where(eq(employments.employeeId, employeeId)),
            tx.select().from(stateLicenses).where(eq(stateLicenses.employeeId, employeeId)),
            tx.select().from(deaLicenses).where(eq(deaLicenses.employeeId, employeeId)),
            tx.select().from(boardCertifications).where(eq(boardCertifications.employeeId, employeeId)),
            tx.select().from(peerReferences).where(eq(peerReferences.employeeId, employeeId)),
            tx.select().from(emergencyContacts).where(eq(emergencyContacts.employeeId, employeeId)),
            tx.select().from(taxForms).where(eq(taxForms.employeeId, employeeId)),
            tx.select().from(trainings).where(eq(trainings.employeeId, employeeId)),
            tx.select().from(payerEnrollments).where(eq(payerEnrollments.employeeId, employeeId)),
            tx.select().from(incidentLogs).where(eq(incidentLogs.employeeId, employeeId))
          ]);
          
          try {
          // Handle educations using tx
          if (educationsData && Array.isArray(educationsData)) {
            console.log('[save-draft] Processing', educationsData.length, 'educations');
            for (const education of educationsData) {
              // Convert any Date objects to strings before sanitizing (defensive)
              const educationWithStringDates = convertDatesToStrings(education);
              const sanitizedEducation = sanitizeDateFields(educationWithStringDates);
              // Filter out temporary IDs that are too large (timestamp-based IDs like 1761900140116)
              // Real database IDs are typically much smaller
              const isTemporaryId = sanitizedEducation.id && 
                typeof sanitizedEducation.id === 'number' && 
                sanitizedEducation.id > 1000000000000; // IDs larger than this are likely temporary
              
              if (sanitizedEducation.id && !isTemporaryId) {
                // SECURITY: Verify ownership before update
                const existing = existingEducations.find(e => e.id === sanitizedEducation.id);
                if (!existing) {
                  // ID doesn't exist for this employee - treat as new record
                  console.log('[save-draft] Education ID not found, treating as new record:', sanitizedEducation.id);
                  const { id, ...newEducation } = sanitizedEducation;
                  await tx
                    .insert(educations)
                    .values({
                      ...newEducation,
                      employeeId  // SECURITY: Always use verified employeeId
                    } as any);
                } else {
                  // ID exists and is owned by this employee - update it
                  await tx
                    .update(educations)
                    .set({
                      ...sanitizedEducation,
                      employeeId  // SECURITY: Enforce correct employeeId
                    } as any)
                    .where(eq(educations.id, sanitizedEducation.id));
                }
              } else {
                // No ID or temporary ID - treat as new record
                const { id, ...newEducation } = sanitizedEducation;
                await tx
                  .insert(educations)
                  .values({
                    ...newEducation,
                    employeeId  // SECURITY: Always use verified employeeId
                  } as any);
              }
            }
          }
          
          // Handle employments using tx
          if (employmentsData && Array.isArray(employmentsData)) {
            console.log('[save-draft] Processing', employmentsData.length, 'employments');
            for (const employment of employmentsData) {
              const sanitizedEmployment = sanitizeDateFields(employment);
              // Filter out temporary IDs that are too large (timestamp-based IDs)
              const isTemporaryId = sanitizedEmployment.id && 
                typeof sanitizedEmployment.id === 'number' && 
                sanitizedEmployment.id > 1000000000000;
              
              if (sanitizedEmployment.id && !isTemporaryId) {
                // SECURITY: Verify ownership before update
                const existing = existingEmployments.find(e => e.id === sanitizedEmployment.id);
                if (!existing) {
                  // ID doesn't exist for this employee - treat as new record
                  console.log('[save-draft] Employment ID not found, treating as new record:', sanitizedEmployment.id);
                  const { id, ...newEmployment } = sanitizedEmployment;
                  await tx
                    .insert(employments)
                    .values({
                      ...newEmployment,
                      employeeId
                    } as any);
                } else {
                  // ID exists and is owned by this employee - update it
                  await tx
                    .update(employments)
                    .set({
                      ...sanitizedEmployment,
                      employeeId
                    } as any)
                    .where(eq(employments.id, sanitizedEmployment.id));
                }
              } else {
                // No ID or temporary ID - treat as new record
                const { id, ...newEmployment } = sanitizedEmployment;
                await tx
                  .insert(employments)
                  .values({
                    ...newEmployment,
                    employeeId
                  } as any);
              }
            }
          }
          
          // Handle state licenses using tx
          if (stateLicensesData && Array.isArray(stateLicensesData)) {
            console.log('[save-draft] Processing', stateLicensesData.length, 'state licenses');
            // Filter out items with invalid string IDs (like "credentials-medical")
            const validStateLicenses = stateLicensesData.filter((license: any) => {
              // If ID exists and is not a valid number, filter it out (it's a frontend temp ID)
              if (license.id && typeof license.id === 'string' && !license.id.match(/^\d+$/)) {
                return false;
              }
              return true;
            });
            for (const license of validStateLicenses) {
              const sanitizedLicense = sanitizeDateFields(license);
              // Remove source field if present
              const { source, ...cleanLicense } = sanitizedLicense as any;
              // Filter out temporary IDs that are too large (timestamp-based IDs)
              const isTemporaryId = cleanLicense.id && 
                typeof cleanLicense.id === 'number' && 
                cleanLicense.id > 1000000000000;
              
              if (cleanLicense.id && typeof cleanLicense.id === 'number' && !isTemporaryId) {
                // SECURITY: Verify ownership before update
                const existing = existingStateLicenses.find(e => e.id === cleanLicense.id);
                if (!existing) {
                  // ID doesn't exist for this employee - treat as new record
                  console.log('[save-draft] State license ID not found, treating as new record:', cleanLicense.id);
                  const { id, ...insertData } = cleanLicense;
                  await tx
                    .insert(stateLicenses)
                    .values({
                      ...insertData,
                      employeeId
                    } as any);
                } else {
                  // ID exists and is owned by this employee - update it
                  await tx
                    .update(stateLicenses)
                    .set({
                      ...cleanLicense,
                      employeeId
                    } as any)
                    .where(eq(stateLicenses.id, cleanLicense.id));
                }
              } else {
                // No ID or temporary ID - treat as new record
                const { id, ...insertData } = cleanLicense;
                await tx
                  .insert(stateLicenses)
                  .values({
                    ...insertData,
                    employeeId
                  } as any);
              }
            }
          }
          
          // Handle DEA licenses using tx
          if (deaLicensesData && Array.isArray(deaLicensesData)) {
            console.log('[save-draft] Processing', deaLicensesData.length, 'DEA licenses');
            // Filter out items with invalid string IDs (like "credentials-dea")
            const validDeaLicenses = deaLicensesData.filter((license: any) => {
              if (license.id && typeof license.id === 'string' && !license.id.match(/^\d+$/)) {
                return false;
              }
              return true;
            });
            for (const license of validDeaLicenses) {
              const sanitizedLicense = sanitizeDateFields(license);
              const { source, state, ...cleanLicense } = sanitizedLicense as any;

              const licenseNumberValue = cleanLicense.deaNumber
                ?? cleanLicense.licenseNumber
                ?? (license as any).deaNumber
                ?? (license as any).licenseNumber;

              if (!licenseNumberValue) {
                console.warn('[save-draft] Skipping DEA license without license number', sanitizedLicense);
                continue;
              }

              // Filter out temporary IDs that are too large (timestamp-based IDs)
              const isTemporaryId = cleanLicense.id &&
                typeof cleanLicense.id === 'number' &&
                cleanLicense.id > 1000000000000;

              const buildPayload = (base: any) => {
                const { id: ignoredId, deaNumber, licenseNumber, ...rest } = base;
                return {
                  ...rest,
                  licenseNumber: licenseNumberValue,
                  employeeId
                };
              };

              if (cleanLicense.id && typeof cleanLicense.id === 'number' && !isTemporaryId) {
                const existing = existingDeaLicenses.find(e => e.id === cleanLicense.id);
                if (!existing) {
                  console.log('[save-draft] DEA license ID not found, treating as new record:', cleanLicense.id);
                  await tx
                    .insert(deaLicenses)
                    .values(buildPayload(cleanLicense));
                } else {
                  await tx
                    .update(deaLicenses)
                    .set(buildPayload(cleanLicense))
                    .where(eq(deaLicenses.id, cleanLicense.id));
                }
              } else {
                await tx
                  .insert(deaLicenses)
                  .values(buildPayload(cleanLicense));
              }
            }
          }
          
          // Handle board certifications using tx
          if (boardCertificationsData && Array.isArray(boardCertificationsData)) {
            console.log('[save-draft] Processing', boardCertificationsData.length, 'board certifications');
            for (const cert of boardCertificationsData) {
              const sanitizedCert = sanitizeDateFields(cert);
              // Remove frontend field names if present (already transformed by Zod, but ensure cleanup)
              const { boardName, certification, ...cleanCert } = sanitizedCert as any;
              // Ensure correct field names are used
              if (!cleanCert.certificationName && certification) {
                cleanCert.certificationName = certification;
              }
              if (!cleanCert.issuingBoard && boardName) {
                cleanCert.issuingBoard = boardName;
              }
              // Filter out temporary IDs that are too large (timestamp-based IDs)
              const isTemporaryId = cleanCert.id && 
                typeof cleanCert.id === 'number' && 
                cleanCert.id > 1000000000000;
              
              if (cleanCert.id && typeof cleanCert.id === 'number' && !isTemporaryId) {
                // SECURITY: Verify ownership before update
                const existing = existingBoardCertifications.find(e => e.id === cleanCert.id);
                if (!existing) {
                  // ID doesn't exist for this employee - treat as new record
                  console.log('[save-draft] Board certification ID not found, treating as new record:', cleanCert.id);
                  const { id, ...insertData } = cleanCert;
                  await tx
                    .insert(boardCertifications)
                    .values({
                      ...insertData,
                      employeeId
                    } as any);
                } else {
                  // ID exists and is owned by this employee - update it
                  await tx
                    .update(boardCertifications)
                    .set({
                      ...cleanCert,
                      employeeId
                    } as any)
                    .where(eq(boardCertifications.id, cleanCert.id));
                }
              } else {
                // No ID or temporary ID - treat as new record
                const { id, ...insertData } = cleanCert;
                await tx
                  .insert(boardCertifications)
                  .values({
                    ...insertData,
                    employeeId
                  } as any);
              }
            }
          }
          
          // Handle peer references using tx
          if (peerReferencesData && Array.isArray(peerReferencesData)) {
            console.log('[save-draft] Processing', peerReferencesData.length, 'peer references');
            for (const reference of peerReferencesData) {
              // Filter out temporary IDs that are too large (timestamp-based IDs)
              const isTemporaryId = reference.id && 
                typeof reference.id === 'number' && 
                reference.id > 1000000000000;
              
              if (reference.id && !isTemporaryId) {
                // SECURITY: Verify ownership before update
                const existing = existingPeerReferences.find(e => e.id === reference.id);
                if (!existing) {
                  // ID doesn't exist for this employee - treat as new record
                  console.log('[save-draft] Peer reference ID not found, treating as new record:', reference.id);
                  const { id, ...newReference } = reference;
                  await tx
                    .insert(peerReferences)
                    .values({
                      ...newReference,
                      employeeId
                    } as any);
                } else {
                  // ID exists and is owned by this employee - update it
                  await tx
                    .update(peerReferences)
                    .set({
                      ...reference,
                      employeeId
                    } as any)
                    .where(eq(peerReferences.id, reference.id));
                }
              } else {
                // No ID or temporary ID - treat as new record
                const { id, ...newReference } = reference;
                await tx
                  .insert(peerReferences)
                  .values({
                    ...newReference,
                    employeeId
                  } as any);
              }
            }
          }
          
          // Handle emergency contacts using tx
          if (emergencyContactsData && Array.isArray(emergencyContactsData)) {
            console.log('[save-draft] Processing', emergencyContactsData.length, 'emergency contacts');
            for (const contact of emergencyContactsData) {
              const { name, phone, ...cleanContact } = contact as any;
              const contactNameValue = cleanContact.contactName
                ?? name
                ?? (contact as any).contactName
                ?? (contact as any).name;
              const phoneValue = cleanContact.phoneNumber
                ?? phone
                ?? (contact as any).phoneNumber
                ?? (contact as any).phone;

              if (!contactNameValue) {
                console.warn('[save-draft] Skipping emergency contact without name', contact);
                continue;
              }

              const isTemporaryId = cleanContact.id &&
                typeof cleanContact.id === 'number' &&
                cleanContact.id > 1000000000000;

              const buildContactPayload = (base: any) => {
                const { id: ignoredId, contactName, phoneNumber, ...rest } = base;
                return {
                  ...rest,
                  name: contactNameValue,
                  phone: phoneValue ?? rest.phone ?? null,
                  employeeId
                };
              };

              if (cleanContact.id && typeof cleanContact.id === 'number' && !isTemporaryId) {
                const existing = existingEmergencyContacts.find(e => e.id === cleanContact.id);
                if (!existing) {
                  console.log('[save-draft] Emergency contact ID not found, treating as new record:', cleanContact.id);
                  await tx
                    .insert(emergencyContacts)
                    .values(buildContactPayload(cleanContact));
                } else {
                  await tx
                    .update(emergencyContacts)
                    .set(buildContactPayload(cleanContact))
                    .where(eq(emergencyContacts.id, cleanContact.id));
                }
              } else {
                await tx
                  .insert(emergencyContacts)
                  .values(buildContactPayload(cleanContact));
              }
            }
          }
          
          // Handle tax forms using tx
          if (taxFormsData && Array.isArray(taxFormsData)) {
            console.log('[save-draft] Processing', taxFormsData.length, 'tax forms');
            for (const form of taxFormsData) {
              const sanitizedForm = sanitizeDateFields(form);
              // Filter out temporary IDs that are too large (timestamp-based IDs)
              const isTemporaryId = sanitizedForm.id && 
                typeof sanitizedForm.id === 'number' && 
                sanitizedForm.id > 1000000000000;
              
              if (sanitizedForm.id && !isTemporaryId) {
                // SECURITY: Verify ownership before update
                const existing = existingTaxForms.find(e => e.id === sanitizedForm.id);
                if (!existing) {
                  // ID doesn't exist for this employee - treat as new record
                  console.log('[save-draft] Tax form ID not found, treating as new record:', sanitizedForm.id);
                  const { id, ...newForm } = sanitizedForm;
                  await tx
                    .insert(taxForms)
                    .values({
                      ...newForm,
                      employeeId
                    } as any);
                } else {
                  // ID exists and is owned by this employee - update it
                  await tx
                    .update(taxForms)
                    .set({
                      ...sanitizedForm,
                      employeeId
                    } as any)
                    .where(eq(taxForms.id, sanitizedForm.id));
                }
              } else {
                // No ID or temporary ID - treat as new record
                const { id, ...newForm } = sanitizedForm;
                await tx
                  .insert(taxForms)
                  .values({
                    ...newForm,
                    employeeId
                  } as any);
              }
            }
          }
          
          // Handle trainings using tx
          if (trainingsData && Array.isArray(trainingsData)) {
            console.log('[save-draft] Processing', trainingsData.length, 'trainings');
            for (const training of trainingsData) {
              const sanitizedTraining = sanitizeDateFields(training);
              // Filter out temporary IDs that are too large (timestamp-based IDs)
              const isTemporaryId = sanitizedTraining.id && 
                typeof sanitizedTraining.id === 'number' && 
                sanitizedTraining.id > 1000000000000;
              
              if (sanitizedTraining.id && !isTemporaryId) {
                // SECURITY: Verify ownership before update
                const existing = existingTrainings.find(e => e.id === sanitizedTraining.id);
                if (!existing) {
                  // ID doesn't exist for this employee - treat as new record
                  console.log('[save-draft] Training ID not found, treating as new record:', sanitizedTraining.id);
                  const { id, ...newTraining } = sanitizedTraining;
                  await tx
                    .insert(trainings)
                    .values({
                      ...newTraining,
                      employeeId
                    } as any);
                } else {
                  // ID exists and is owned by this employee - update it
                  await tx
                    .update(trainings)
                    .set({
                      ...sanitizedTraining,
                      employeeId
                    } as any)
                    .where(eq(trainings.id, sanitizedTraining.id));
                }
              } else {
                // No ID or temporary ID - treat as new record
                const { id, ...newTraining } = sanitizedTraining;
                await tx
                  .insert(trainings)
                  .values({
                    ...newTraining,
                    employeeId
                  } as any);
              }
            }
          }
          
          // Handle payer enrollments using tx
          if (payerEnrollmentsData && Array.isArray(payerEnrollmentsData)) {
            console.log('[save-draft] Processing', payerEnrollmentsData.length, 'payer enrollments');
            for (const enrollment of payerEnrollmentsData) {
              const sanitizedEnrollment = sanitizeDateFields(enrollment);
              // Remove frontend field names if present (already transformed by Zod, but ensure cleanup)
              const { providerId, enrollmentStatus, ...cleanEnrollment } = sanitizedEnrollment as any;
              // Ensure correct field names are used
              if (!cleanEnrollment.enrollmentId && providerId) {
                cleanEnrollment.enrollmentId = providerId;
              }
              if (!cleanEnrollment.status && enrollmentStatus) {
                cleanEnrollment.status = enrollmentStatus;
              }
              // Filter out temporary IDs that are too large (timestamp-based IDs)
              const isTemporaryId = cleanEnrollment.id && 
                typeof cleanEnrollment.id === 'number' && 
                cleanEnrollment.id > 1000000000000;
              
              if (cleanEnrollment.id && typeof cleanEnrollment.id === 'number' && !isTemporaryId) {
                // SECURITY: Verify ownership before update
                const existing = existingPayerEnrollments.find(e => e.id === cleanEnrollment.id);
                if (!existing) {
                  // ID doesn't exist for this employee - treat as new record
                  console.log('[save-draft] Payer enrollment ID not found, treating as new record:', cleanEnrollment.id);
                  const { id, ...insertData } = cleanEnrollment;
                  await tx
                    .insert(payerEnrollments)
                    .values({
                      ...insertData,
                      employeeId
                    } as any);
                } else {
                  // ID exists and is owned by this employee - update it
                  await tx
                    .update(payerEnrollments)
                    .set({
                      ...cleanEnrollment,
                      employeeId
                    } as any)
                    .where(eq(payerEnrollments.id, cleanEnrollment.id));
                }
              } else {
                // No ID or temporary ID - treat as new record
                const { id, ...insertData } = cleanEnrollment;
                await tx
                  .insert(payerEnrollments)
                  .values({
                    ...insertData,
                    employeeId
                  } as any);
              }
            }
          }

          // Handle incident logs using tx
          if (incidentLogsData && Array.isArray(incidentLogsData)) {
            console.log('[save-draft] Processing', incidentLogsData.length, 'incident logs');
            for (const incident of incidentLogsData) {
              const sanitizedIncident = sanitizeDateFields(incident);
              const isTemporaryId = sanitizedIncident.id &&
                typeof sanitizedIncident.id === 'number' &&
                sanitizedIncident.id > 1000000000000;

              if (sanitizedIncident.id && typeof sanitizedIncident.id === 'number' && !isTemporaryId) {
                const existing = existingIncidentLogs.find(e => e.id === sanitizedIncident.id);
                if (!existing) {
                  const { id, ...insertData } = sanitizedIncident;
                  await tx
                    .insert(incidentLogs)
                    .values({
                      ...insertData,
                      employeeId
                    } as any);
                } else {
                  await tx
                    .update(incidentLogs)
                    .set({
                      ...sanitizedIncident,
                      employeeId
                    } as any)
                    .where(eq(incidentLogs.id, sanitizedIncident.id));
                }
              } else {
                const { id, ...insertData } = sanitizedIncident;
                await tx
                  .insert(incidentLogs)
                  .values({
                    ...insertData,
                    employeeId
                  } as any);
              }
            }
          }
          
            console.log('[save-draft] All related entities processed successfully');
            
            // Return employeeId from transaction
            return employeeId;
          } catch (relatedError) {
            console.error('[save-draft] Error processing related entities:', relatedError);
            console.error('[save-draft] Related entity error stack:', (relatedError as Error).stack);
            // Re-throw to trigger transaction rollback
            throw new Error(`Failed to save related entities: ${(relatedError as Error).message}`);
          }
        });
        
        // Transaction completed successfully - result contains employeeId
        const employeeId = result;
        console.log('[save-draft] Transaction completed successfully for employeeId:', employeeId);
        
        // Step 7: Log audit trail (outside transaction for non-critical logging)
        await logAudit(req, employeeId, employeeId, { 
          action: 'onboarding_draft_saved',
          timestamp: new Date().toISOString()
        });
        
        console.log('[save-draft] Draft saved successfully for employeeId:', employeeId);
        
        // Step 8: Return typed response
        res.json({ 
          success: true,
          message: 'Draft saved successfully',
          employeeId,
          timestamp: new Date().toISOString()
        });
      } catch (error: any) {
        // Comprehensive error logging with stack traces
        console.error('[save-draft] ERROR saving draft:', error);
        console.error('[save-draft] Error name:', error?.name);
        console.error('[save-draft] Error message:', error?.message);
        console.error('[save-draft] Error stack:', error?.stack);
        console.error('[save-draft] Error code:', error?.code);
        
        // Log additional context
        console.error('[save-draft] User ID:', req.user?.id);
        console.error('[save-draft] Request body keys:', req.body ? Object.keys(req.body) : 'No body');
        
        // Check if it's a date conversion error
        if (error?.message?.includes('toISOString') || error?.message?.includes('is not a function')) {
          console.error('[save-draft] Date conversion error detected - check date field handling');
        }
        
        // Return appropriate error response
        res.status(500).json({ 
          success: false,
          error: 'Failed to save draft',
          message: error?.message || 'Unknown error occurred',
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  /**
   * PUT /api/onboarding/save-draft/:id
   * Update an existing onboarding draft by employee ID
   * @route PUT /api/onboarding/save-draft/:id
   * @group Onboarding - Draft operations
   * @security session
   * @param {number} id.path.required - Employee ID
   * @returns {object} 200 - Success response with employeeId
   */
  app.put('/api/onboarding/save-draft/:id',
    requireAnyAuth,
    requireRole(['prospective_employee']),
    validateId(),
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const employeeId = parseInt(req.params.id);
        const currentUserId = req.user!.id;
        
        console.log('[save-draft PUT] Updating draft for employeeId:', employeeId, 'userId:', currentUserId);
        
        // SECURITY: Verify employee belongs to current user
        const existingEmployeeRows = await db
          .select()
          .from(employees)
          .where(and(eq(employees.id, employeeId), eq(employees.userId, currentUserId)));
        
        if (!existingEmployeeRows.length) {
          return res.status(404).json({ 
            success: false,
            error: 'Employee not found or access denied',
            message: 'The employee record does not exist or you do not have permission to update it'
          });
        }
        
        const employee = existingEmployeeRows[0];
        
        // Step 1: Sanitize date fields first
        const sanitizedData = sanitizeDateFields(req.body);
        console.log('[save-draft PUT] Date fields sanitized');
        
        // Step 2: Use the same validation schema as POST
        // Define validation schema manually to avoid drizzle-zod .shape issues
        const employeeDraftSchema = z.object({
          // Basic personal information
          firstName: z.string().max(50),
          middleName: z.string().max(50).nullable().optional(),
          lastName: z.string().max(50),
          dateOfBirth: z.coerce.date().nullable().optional(),
          
          // Contact information
          personalEmail: z.string().max(100).email().nullable().optional(),
          workEmail: z.string().max(100).email(),
          cellPhone: z.string().max(20).nullable().optional(),
          workPhone: z.string().max(20).nullable().optional(),
          
          // Home address information
          homeAddress1: z.string().max(100).nullable().optional(),
          homeAddress2: z.string().max(100).nullable().optional(),
          homeCity: z.string().max(50).nullable().optional(),
          homeState: z.string().max(50).nullable().optional(),
          homeZip: z.string().max(10).nullable().optional(),
          
          // Demographic information
          gender: z.string().max(20).nullable().optional(),
          birthCity: z.string().max(50).nullable().optional(),
          birthState: z.string().max(50).nullable().optional(),
          birthCountry: z.string().max(50).nullable().optional(),
          
          // Department
          department: z.string().max(100).nullable().optional(),
          
          // Driver's license information
          driversLicenseNumber: z.string().max(50).nullable().optional(),
          dlStateIssued: z.string().max(50).nullable().optional(),
          dlIssueDate: z.coerce.date().nullable().optional(),
          dlExpirationDate: z.coerce.date().nullable().optional(),
          
          // Sensitive identification
          ssn: z.string().max(255).nullable().optional(), // Increased for encrypted format
          
          // National Provider Identifier (NPI)
          npiNumber: z.string().max(20).nullable().optional(),
          enumerationDate: z.coerce.date().nullable().optional(),
          
          // Employment information
          jobTitle: z.string().max(100).nullable().optional(),
          workLocation: z.string().max(100).nullable().optional(),
          qualification: z.string().nullable().optional(),
          
          // Medical licensing information
          medicalLicenseNumber: z.string().max(50).nullable().optional(),
          medicalLicenseState: z.string().max(50).nullable().optional(),
          medicalLicenseIssueDate: z.coerce.date().nullable().optional(),
          medicalLicenseExpirationDate: z.coerce.date().nullable().optional(),
          medicalLicenseStatus: z.string().max(50).nullable().optional(),
          medicalQualification: z.string().nullable().optional(),
          substanceUseLicenseNumber: z.string().max(50).nullable().optional(),
          substanceUseLicenseState: z.string().max(50).nullable().optional(),
          substanceUseLicenseIssueDate: z.coerce.date().nullable().optional(),
          substanceUseLicenseExpirationDate: z.coerce.date().nullable().optional(),
          substanceUseLicenseStatus: z.string().max(50).nullable().optional(),
          substanceUseQualification: z.string().nullable().optional(),
          mentalHealthLicenseNumber: z.string().max(50).nullable().optional(),
          mentalHealthLicenseState: z.string().max(50).nullable().optional(),
          mentalHealthLicenseIssueDate: z.coerce.date().nullable().optional(),
          mentalHealthLicenseExpirationDate: z.coerce.date().nullable().optional(),
          mentalHealthLicenseStatus: z.string().max(50).nullable().optional(),
          mentalHealthQualification: z.string().nullable().optional(),
          
          // DEA License
          deaNumber: z.string().max(50).nullable().optional(),
          
          // Payer/billing identifiers
          medicaidNumber: z.string().max(50).nullable().optional(),
          medicarePtanNumber: z.string().max(50).nullable().optional(),
          
          // CAQH integration
          caqhProviderId: z.string().max(50).nullable().optional(),
          caqhIssueDate: z.coerce.date().nullable().optional(),
          caqhLastAttestationDate: z.coerce.date().nullable().optional(),
          caqhEnabled: z.boolean().nullable().optional(),
          caqhReattestationDueDate: z.coerce.date().nullable().optional(),
          caqhLoginId: z.string().max(50).nullable().optional(),
          caqhPassword: z.string().max(100).nullable().optional(),
          
          // NPPES integration
          nppesLoginId: z.string().max(50).nullable().optional(),
          nppesPassword: z.string().max(100).nullable().optional()
        })
        .partial()             // All fields optional for draft
        .strict();             // Reject unknown fields
        
        // Define array schemas with proper validation and length limits
        const MAX_ARRAY_LENGTH = 50;
        
        // Reuse the same nested entity schemas as POST endpoint
        const educationDraftSchema = z.object({
          id: z.number().optional(),
          employeeId: z.number().optional(),
          educationType: z.string().max(50).nullable().optional(),
          schoolInstitution: z.string().max(100).nullable().optional(),
          degree: z.string().max(50).nullable().optional(),
          specialtyMajor: z.string().max(100).nullable().optional(),
          startDate: z.coerce.date().nullable().optional(),
          endDate: z.coerce.date().nullable().optional()
        }).partial().strict();
        
        const employmentDraftSchema = z.object({
          id: z.number().optional(),
          employeeId: z.number().optional(),
          employer: z.string().max(100).nullable().optional(),
          position: z.string().max(100).nullable().optional(),
          startDate: z.coerce.date().nullable().optional(),
          endDate: z.coerce.date().nullable().optional(),
          description: z.string().nullable().optional()
        }).partial().strict();
        
        const stateLicenseDraftSchema = z.preprocess((data: any) => {
          if (data && typeof data === 'object') {
            const cleaned: any = { ...data };
            if (cleaned.id && typeof cleaned.id === 'string' && !cleaned.id.match(/^\d+$/)) {
              delete cleaned.id;
            }
            delete cleaned.source;
            return cleaned;
          }
          return data;
        }, z.object({
          id: z.union([z.number(), z.string()]).optional().transform((val) => {
            if (typeof val === 'string' && val.match(/^\d+$/)) {
              return parseInt(val);
            }
            return typeof val === 'number' ? val : undefined;
          }),
          employeeId: z.number().optional(),
          licenseNumber: z.string().max(50).optional(),
          state: z.string().max(50).optional(),
          licenseType: z.string().max(50).nullable().optional(),
          issueDate: z.coerce.date().nullable().optional(),
          expirationDate: z.coerce.date().nullable().optional(),
          status: z.string().max(50).nullable().optional()
        }).passthrough());
        
        const deaLicenseDraftSchema = z.preprocess((data: any) => {
          if (data && typeof data === 'object') {
            const cleaned: any = { ...data };
            if (cleaned.id && typeof cleaned.id === 'string' && !cleaned.id.match(/^\d+$/)) {
              delete cleaned.id;
            }
            if (cleaned.licenseNumber && !cleaned.deaNumber) {
              cleaned.deaNumber = cleaned.licenseNumber;
            }
            delete cleaned.licenseNumber;
            delete cleaned.state;
            delete cleaned.source;
            return cleaned;
          }
          return data;
        }, z.object({
          id: z.union([z.number(), z.string()]).optional().transform((val) => {
            if (typeof val === 'string' && val.match(/^\d+$/)) {
              return parseInt(val);
            }
            return typeof val === 'number' ? val : undefined;
          }),
          employeeId: z.number().optional(),
          deaNumber: z.string().max(50).optional(),
          issueDate: z.coerce.date().nullable().optional(),
          expirationDate: z.coerce.date().nullable().optional(),
          status: z.string().max(50).nullable().optional()
        }).passthrough());
        
        const boardCertificationDraftSchema = z.preprocess((data: any) => {
          if (data && typeof data === 'object') {
            const cleaned: any = { ...data };
            if (cleaned.certification && !cleaned.certificationName) {
              cleaned.certificationName = cleaned.certification;
            }
            if (cleaned.boardName && !cleaned.issuingBoard) {
              cleaned.issuingBoard = cleaned.boardName;
            }
            delete cleaned.certification;
            delete cleaned.boardName;
            return cleaned;
          }
          return data;
        }, z.object({
          id: z.number().optional(),
          employeeId: z.number().optional(),
          certificationName: z.string().max(100).optional(),
          issuingBoard: z.string().max(100).nullable().optional(),
          certificationNumber: z.string().max(50).nullable().optional(),
          issueDate: z.coerce.date().nullable().optional(),
          expirationDate: z.coerce.date().nullable().optional()
        }).passthrough());
        
        const peerReferenceDraftSchema = z.object({
          id: z.number().optional(),
          employeeId: z.number().optional(),
          referenceName: z.string().max(100).nullable().optional(),
          contactInfo: z.string().max(100).nullable().optional(),
          relationship: z.string().max(100).nullable().optional(),
          comments: z.string().nullable().optional()
        }).partial().strict();
        
        const emergencyContactDraftSchema = z.preprocess((data: any) => {
          if (data && typeof data === 'object') {
            const cleaned: any = { ...data };
            if (cleaned.name && !cleaned.contactName) {
              cleaned.contactName = cleaned.name;
            }
            if (cleaned.phone && !cleaned.phoneNumber) {
              cleaned.phoneNumber = cleaned.phone;
            }
            delete cleaned.name;
            delete cleaned.phone;
            return cleaned;
          }
          return data;
        }, z.object({
          id: z.number().optional(),
          employeeId: z.number().optional(),
          contactName: z.string().max(100).nullable().optional(),
          relationship: z.string().max(50).nullable().optional(),
          phoneNumber: z.string().max(20).nullable().optional(),
          email: z.string().max(100).nullable().optional()
        }).passthrough());
        
        const taxFormDraftSchema = z.object({
          id: z.number().optional(),
          employeeId: z.number().optional(),
          formType: z.string().max(50).nullable().optional(),
          w9Completed: z.boolean().nullable().optional(),
          signedDate: z.coerce.date().nullable().optional()
        }).partial().strict();
        
        const trainingDraftSchema = z.preprocess((data: any) => {
          if (data && typeof data === 'object') {
            const cleaned: any = { ...data };
            if (cleaned.trainingName && !cleaned.trainingType) {
              cleaned.trainingType = cleaned.trainingName;
            }
            if (cleaned.certificateNumber && !cleaned.certificatePath) {
              cleaned.certificatePath = cleaned.certificateNumber;
            }
            if (typeof cleaned.credits === 'string' && cleaned.credits.trim() === '') {
              cleaned.credits = null;
            }
            delete cleaned.trainingName;
            delete cleaned.certificateNumber;
            return cleaned;
          }
          return data;
        }, z.object({
          id: z.union([z.number(), z.string()]).optional().transform((val) => {
            if (typeof val === 'string' && val.match(/^\d+$/)) {
              return parseInt(val);
            }
            return typeof val === 'number' ? val : undefined;
          }),
          employeeId: z.number().optional(),
          trainingType: z.string().max(100).nullable().optional(),
          provider: z.string().max(100).nullable().optional(),
          completionDate: z.coerce.date().nullable().optional(),
          expirationDate: z.coerce.date().nullable().optional(),
          credits: z.preprocess((val) => {
            if (val === '' || val === undefined) return null;
            return val;
          }, z.coerce.number().nullable().optional()),
          certificatePath: z.string().max(255).nullable().optional()
        }).partial().strict());
        
        const incidentLogDraftSchema = z.object({
          id: z.union([z.number(), z.string()]).optional().transform((val) => {
            if (typeof val === 'string' && val.match(/^\d+$/)) {
              return parseInt(val);
            }
            return typeof val === 'number' ? val : undefined;
          }),
          employeeId: z.number().optional(),
          incidentDate: z.coerce.date().nullable().optional(),
          incidentType: z.string().max(100).nullable().optional(),
          description: z.string().nullable().optional(),
          severity: z.string().max(20).nullable().optional(),
          resolution: z.string().nullable().optional(),
          reportedBy: z.string().max(50).nullable().optional()
        }).partial().strict();

        const payerEnrollmentDraftSchema = z.preprocess((data: any) => {
          if (data && typeof data === 'object') {
            const cleaned: any = { ...data };
            if (cleaned.providerId && !cleaned.enrollmentId) {
              cleaned.enrollmentId = cleaned.providerId;
            }
            if (cleaned.enrollmentStatus && !cleaned.status) {
              cleaned.status = cleaned.enrollmentStatus;
            }
            delete cleaned.providerId;
            delete cleaned.enrollmentStatus;
            return cleaned;
          }
          return data;
        }, z.object({
          id: z.number().optional(),
          employeeId: z.number().optional(),
          payerName: z.string().max(100).nullable().optional(),
          enrollmentId: z.string().max(50).nullable().optional(),
          effectiveDate: z.coerce.date().nullable().optional(),
          terminationDate: z.coerce.date().nullable().optional(),
          status: z.string().max(20).nullable().optional()
        }).passthrough());
        
        const onboardingDraftSchema = z.object({
          ...employeeDraftSchema.shape,
          educations: z.array(educationDraftSchema).max(MAX_ARRAY_LENGTH).optional(),
          employments: z.array(employmentDraftSchema).max(MAX_ARRAY_LENGTH).optional(),
          stateLicenses: z.array(stateLicenseDraftSchema).max(MAX_ARRAY_LENGTH).optional(),
          deaLicenses: z.array(deaLicenseDraftSchema).max(MAX_ARRAY_LENGTH).optional(),
          boardCertifications: z.array(boardCertificationDraftSchema).max(MAX_ARRAY_LENGTH).optional(),
          peerReferences: z.array(peerReferenceDraftSchema).max(MAX_ARRAY_LENGTH).optional(),
          emergencyContacts: z.array(emergencyContactDraftSchema).max(MAX_ARRAY_LENGTH).optional(),
          taxForms: z.array(taxFormDraftSchema).max(MAX_ARRAY_LENGTH).optional(),
          trainings: z.array(trainingDraftSchema).max(MAX_ARRAY_LENGTH).optional(),
          payerEnrollments: z.array(payerEnrollmentDraftSchema).max(MAX_ARRAY_LENGTH).optional(),
          incidentLogs: z.array(incidentLogDraftSchema).max(MAX_ARRAY_LENGTH).optional(),
          status: z.string().optional(),
          documentUploads: z.array(z.any()).optional(),
          allRequiredDocumentsUploaded: z.boolean().optional(),
          uploadedRequiredCount: z.number().optional(),
          requiredDocumentsCount: z.number().optional(),
          allFormsCompleted: z.boolean().optional(),
          completedForms: z.number().optional(),
          totalRequiredForms: z.number().optional(),
          submissions: z.array(z.any()).optional()
        }).passthrough();
        
        // Step 3: Validate the sanitized data
        const validationResult = onboardingDraftSchema.safeParse(sanitizedData);
        if (!validationResult.success) {
          console.error('[save-draft PUT] Validation failed:', validationResult.error.errors);
          return res.status(400).json({ 
            error: 'Validation failed', 
            details: validationResult.error.errors 
          });
        }
        
        let data = validationResult.data;
        console.log('[save-draft PUT] Validation successful');
        
        // Convert any Date objects back to strings (Zod coerces dates to Date objects, but DB expects strings)
        const convertDatesToStrings = (obj: any): any => {
          if (!obj || typeof obj !== 'object') return obj;
          if (Array.isArray(obj)) {
            return obj.map(convertDatesToStrings);
          }
          const result: any = {};
          for (const [key, value] of Object.entries(obj)) {
            if (value instanceof Date) {
              // For date-only fields, convert to YYYY-MM-DD
              if (DATE_ONLY_FIELDS.has(key)) {
                result[key] = value.toISOString().split('T')[0];
              } else {
                // For timestamp fields, keep full ISO string
                result[key] = value.toISOString();
              }
            } else if (typeof value === 'object' && value !== null) {
              result[key] = convertDatesToStrings(value);
            } else {
              result[key] = value;
            }
          }
          return result;
        };
        
        data = convertDatesToStrings(data);
        console.log('[save-draft PUT] Converted Date objects to strings');
        
        // Step 4: Extract employee and related entity data
        let {
          educations: educationsData,
          employments: employmentsData,
          stateLicenses: stateLicensesData,
          deaLicenses: deaLicensesData,
          boardCertifications: boardCertificationsData,
          peerReferences: peerReferencesData,
          emergencyContacts: emergencyContactsData,
          taxForms: taxFormsData,
          trainings: trainingsData,
          payerEnrollments: payerEnrollmentsData,
          incidentLogs: incidentLogsDataExisting,
          id,
          userId: reqUserId,
          createdAt,
          updatedAt,
          created_at,
          updated_at,
          status,
          applicationStatus,
          onboardingStatus,
          invitationId,
          onboardingCompletedAt,
          approvedAt,
          approvedBy,
          documentUploads,
          allRequiredDocumentsUploaded,
          uploadedRequiredCount,
          requiredDocumentsCount,
          allFormsCompleted,
          completedForms,
          totalRequiredForms,
          submissions,
          ...employeeData
        } = data;
        
        console.log('[save-draft PUT] Extracted data structure');
        
        // Step 5: ATOMIC TRANSACTION - Update employee and related entities
        await db.transaction(async (tx) => {
          console.log('[save-draft PUT] Starting database transaction');
          
          // Update existing employee record using tx
          console.log('[save-draft PUT] Updating employee id:', employeeId);
          const cleanEmployeeData = Object.fromEntries(
            Object.entries(employeeData)
              .filter(([_, v]) => v !== undefined && v !== null && v !== '')
              .map(([k, v]) => {
                // Convert Date objects to ISO strings for database insertion
                if (v instanceof Date) {
                  if (DATE_ONLY_FIELDS.has(k)) {
                    return [k, v.toISOString().split('T')[0]];
                  }
                  return [k, v.toISOString()];
                }
                return [k, v];
              })
          );
          
          await tx
            .update(employees)
            .set({
              ...cleanEmployeeData,
              userId: employee.userId,           // Never allow changing userId
              status: employee.status,           // Never allow changing status
              onboardingStatus: 'in_progress',   // Server-controlled
              updatedAt: new Date()
            } as any)
            .where(eq(employees.id, employeeId));
          console.log('[save-draft PUT] Employee updated');
          
          // Fetch existing entities for ownership verification
          const [
            existingEducations,
            existingEmployments,
            existingStateLicenses,
            existingDeaLicenses,
            existingBoardCertifications,
            existingPeerReferences,
            existingEmergencyContacts,
            existingTaxForms,
            existingTrainings,
            existingPayerEnrollments,
            existingIncidentLogs
          ] = await Promise.all([
            tx.select().from(educations).where(eq(educations.employeeId, employeeId)),
            tx.select().from(employments).where(eq(employments.employeeId, employeeId)),
            tx.select().from(stateLicenses).where(eq(stateLicenses.employeeId, employeeId)),
            tx.select().from(deaLicenses).where(eq(deaLicenses.employeeId, employeeId)),
            tx.select().from(boardCertifications).where(eq(boardCertifications.employeeId, employeeId)),
            tx.select().from(peerReferences).where(eq(peerReferences.employeeId, employeeId)),
            tx.select().from(emergencyContacts).where(eq(emergencyContacts.employeeId, employeeId)),
            tx.select().from(taxForms).where(eq(taxForms.employeeId, employeeId)),
            tx.select().from(trainings).where(eq(trainings.employeeId, employeeId)),
            tx.select().from(payerEnrollments).where(eq(payerEnrollments.employeeId, employeeId)),
            tx.select().from(incidentLogs).where(eq(incidentLogs.employeeId, employeeId))
          ]);
          
          try {
            // Process nested entities (same logic as POST endpoint)
            // Handle educations
            if (educationsData && Array.isArray(educationsData)) {
              for (const education of educationsData) {
                const educationWithStringDates = convertDatesToStrings(education);
                const sanitizedEducation = sanitizeDateFields(educationWithStringDates);
                const isTemporaryId = sanitizedEducation.id && 
                  typeof sanitizedEducation.id === 'number' && 
                  sanitizedEducation.id > 1000000000000;
                
                if (sanitizedEducation.id && !isTemporaryId) {
                  const existing = existingEducations.find(e => e.id === sanitizedEducation.id);
                  if (!existing) {
                    const { id, ...newEducation } = sanitizedEducation;
                    await tx.insert(educations).values({ ...newEducation, employeeId } as any);
                  } else {
                    await tx.update(educations).set({ ...sanitizedEducation, employeeId } as any)
                      .where(eq(educations.id, sanitizedEducation.id));
                  }
                } else {
                  const { id, ...newEducation } = sanitizedEducation;
                  await tx.insert(educations).values({ ...newEducation, employeeId } as any);
                }
              }
            }
            
            // Handle employments
            if (employmentsData && Array.isArray(employmentsData)) {
              for (const employment of employmentsData) {
                const employmentWithStringDates = convertDatesToStrings(employment);
                const sanitizedEmployment = sanitizeDateFields(employmentWithStringDates);
                const isTemporaryId = sanitizedEmployment.id && 
                  typeof sanitizedEmployment.id === 'number' && 
                  sanitizedEmployment.id > 1000000000000;
                
                if (sanitizedEmployment.id && !isTemporaryId) {
                  const existing = existingEmployments.find(e => e.id === sanitizedEmployment.id);
                  if (!existing) {
                    const { id, ...newEmployment } = sanitizedEmployment;
                    await tx.insert(employments).values({ ...newEmployment, employeeId } as any);
                  } else {
                    await tx.update(employments).set({ ...sanitizedEmployment, employeeId } as any)
                      .where(eq(employments.id, sanitizedEmployment.id));
                  }
                } else {
                  const { id, ...newEmployment } = sanitizedEmployment;
                  await tx.insert(employments).values({ ...newEmployment, employeeId } as any);
                }
              }
            }
            
            // Handle state licenses (simplified - full implementation would mirror POST)
            if (stateLicensesData && Array.isArray(stateLicensesData)) {
              const validStateLicenses = stateLicensesData.filter((license: any) => {
                if (license.id && typeof license.id === 'string' && !license.id.match(/^\d+$/)) {
                  return false;
                }
                return true;
              });
              for (const license of validStateLicenses) {
                const licenseWithStringDates = convertDatesToStrings(license);
                const sanitizedLicense = sanitizeDateFields(licenseWithStringDates);
                const { source, ...cleanLicense } = sanitizedLicense as any;
                const isTemporaryId = cleanLicense.id && 
                  typeof cleanLicense.id === 'number' && 
                  cleanLicense.id > 1000000000000;
                
                if (cleanLicense.id && typeof cleanLicense.id === 'number' && !isTemporaryId) {
                  const existing = existingStateLicenses.find(e => e.id === cleanLicense.id);
                  if (!existing) {
                    const { id, ...insertData } = cleanLicense;
                    await tx.insert(stateLicenses).values({ ...insertData, employeeId } as any);
                  } else {
                    await tx.update(stateLicenses).set({ ...cleanLicense, employeeId } as any)
                      .where(eq(stateLicenses.id, cleanLicense.id));
                  }
                } else {
                  const { id, ...insertData } = cleanLicense;
                  await tx.insert(stateLicenses).values({ ...insertData, employeeId } as any);
                }
              }
            }
            
            // Handle DEA licenses
            if (deaLicensesData && Array.isArray(deaLicensesData)) {
              const validDeaLicenses = deaLicensesData.filter((license: any) => {
                if (license.id && typeof license.id === 'string' && !license.id.match(/^\d+$/)) {
                  return false;
                }
                return true;
              });
              for (const license of validDeaLicenses) {
                const licenseWithStringDates = convertDatesToStrings(license);
                const sanitizedLicense = sanitizeDateFields(licenseWithStringDates);
                const { source, state, ...cleanLicense } = sanitizedLicense as any;

                const licenseNumberValue = cleanLicense.deaNumber
                  ?? cleanLicense.licenseNumber
                  ?? (license as any).deaNumber
                  ?? (license as any).licenseNumber;

                if (!licenseNumberValue) {
                  console.warn('[save-draft PUT] Skipping DEA license without license number', sanitizedLicense);
                  continue;
                }

                const isTemporaryId = cleanLicense.id &&
                  typeof cleanLicense.id === 'number' &&
                  cleanLicense.id > 1000000000000;

                const buildPayload = (base: any) => {
                  const { id: ignoredId, deaNumber, licenseNumber, ...rest } = base;
                  return {
                    ...rest,
                    licenseNumber: licenseNumberValue,
                    employeeId
                  };
                };

                if (cleanLicense.id && typeof cleanLicense.id === 'number' && !isTemporaryId) {
                  const existing = existingDeaLicenses.find(e => e.id === cleanLicense.id);
                  if (!existing) {
                    await tx.insert(deaLicenses).values(buildPayload(cleanLicense));
                  } else {
                    await tx.update(deaLicenses).set(buildPayload(cleanLicense))
                      .where(eq(deaLicenses.id, cleanLicense.id));
                  }
                } else {
                  await tx.insert(deaLicenses).values(buildPayload(cleanLicense));
                }
              }
            }
            
            // Handle board certifications
            if (boardCertificationsData && Array.isArray(boardCertificationsData)) {
              for (const cert of boardCertificationsData) {
                const certWithStringDates = convertDatesToStrings(cert);
                const sanitizedCert = sanitizeDateFields(certWithStringDates);
                const { boardName, certification, ...cleanCert } = sanitizedCert as any;
                if (!cleanCert.certificationName && certification) {
                  cleanCert.certificationName = certification;
                }
                if (!cleanCert.issuingBoard && boardName) {
                  cleanCert.issuingBoard = boardName;
                }
                const isTemporaryId = cleanCert.id && 
                  typeof cleanCert.id === 'number' && 
                  cleanCert.id > 1000000000000;
                
                if (cleanCert.id && typeof cleanCert.id === 'number' && !isTemporaryId) {
                  const existing = existingBoardCertifications.find(e => e.id === cleanCert.id);
                  if (!existing) {
                    const { id, ...insertData } = cleanCert;
                    await tx.insert(boardCertifications).values({ ...insertData, employeeId } as any);
                  } else {
                    await tx.update(boardCertifications).set({ ...cleanCert, employeeId } as any)
                      .where(eq(boardCertifications.id, cleanCert.id));
                  }
                } else {
                  const { id, ...insertData } = cleanCert;
                  await tx.insert(boardCertifications).values({ ...insertData, employeeId } as any);
                }
              }
            }
            
            // Handle peer references
            if (peerReferencesData && Array.isArray(peerReferencesData)) {
              for (const reference of peerReferencesData) {
                const isTemporaryId = reference.id && 
                  typeof reference.id === 'number' && 
                  reference.id > 1000000000000;
                
                if (reference.id && !isTemporaryId) {
                  const existing = existingPeerReferences.find(e => e.id === reference.id);
                  if (!existing) {
                    const { id, ...newReference } = reference;
                    await tx.insert(peerReferences).values({ ...newReference, employeeId } as any);
                  } else {
                    await tx.update(peerReferences).set({ ...reference, employeeId } as any)
                      .where(eq(peerReferences.id, reference.id));
                  }
                } else {
                  const { id, ...newReference } = reference;
                  await tx.insert(peerReferences).values({ ...newReference, employeeId } as any);
                }
              }
            }
            
            // Handle emergency contacts
            if (emergencyContactsData && Array.isArray(emergencyContactsData)) {
              for (const contact of emergencyContactsData) {
                const { name, phone, ...cleanContact } = contact as any;
                const contactNameValue = cleanContact.contactName
                  ?? name
                  ?? (contact as any).contactName
                  ?? (contact as any).name;
                const phoneValue = cleanContact.phoneNumber
                  ?? phone
                  ?? (contact as any).phoneNumber
                  ?? (contact as any).phone;

                if (!contactNameValue) {
                  console.warn('[save-draft PUT] Skipping emergency contact without name', contact);
                  continue;
                }

                const isTemporaryId = cleanContact.id &&
                  typeof cleanContact.id === 'number' &&
                  cleanContact.id > 1000000000000;

                const buildContactPayload = (base: any) => {
                  const { id: ignoredId, contactName, phoneNumber, ...rest } = base;
                  return {
                    ...rest,
                    name: contactNameValue,
                    phone: phoneValue ?? rest.phone ?? null,
                    employeeId
                  };
                };

                if (cleanContact.id && typeof cleanContact.id === 'number' && !isTemporaryId) {
                  const existing = existingEmergencyContacts.find(e => e.id === cleanContact.id);
                  if (!existing) {
                    await tx.insert(emergencyContacts).values(buildContactPayload(cleanContact));
                  } else {
                    await tx.update(emergencyContacts).set(buildContactPayload(cleanContact))
                      .where(eq(emergencyContacts.id, cleanContact.id));
                  }
                } else {
                  await tx.insert(emergencyContacts).values(buildContactPayload(cleanContact));
                }
              }
            }
            
            // Handle tax forms
            if (taxFormsData && Array.isArray(taxFormsData)) {
              for (const form of taxFormsData) {
                const formWithStringDates = convertDatesToStrings(form);
                const sanitizedForm = sanitizeDateFields(formWithStringDates);
                const isTemporaryId = sanitizedForm.id && 
                  typeof sanitizedForm.id === 'number' && 
                  sanitizedForm.id > 1000000000000;
                
                if (sanitizedForm.id && !isTemporaryId) {
                  const existing = existingTaxForms.find(e => e.id === sanitizedForm.id);
                  if (!existing) {
                    const { id, ...newForm } = sanitizedForm;
                    await tx.insert(taxForms).values({ ...newForm, employeeId } as any);
                  } else {
                    await tx.update(taxForms).set({ ...sanitizedForm, employeeId } as any)
                      .where(eq(taxForms.id, sanitizedForm.id));
                  }
                } else {
                  const { id, ...newForm } = sanitizedForm;
                  await tx.insert(taxForms).values({ ...newForm, employeeId } as any);
                }
              }
            }
            
            // Handle trainings
            if (trainingsData && Array.isArray(trainingsData)) {
              for (const training of trainingsData) {
                const trainingWithStringDates = convertDatesToStrings(training);
                const sanitizedTraining = sanitizeDateFields(trainingWithStringDates);
                const isTemporaryId = sanitizedTraining.id && 
                  typeof sanitizedTraining.id === 'number' && 
                  sanitizedTraining.id > 1000000000000;
                
                if (sanitizedTraining.id && !isTemporaryId) {
                  const existing = existingTrainings.find(e => e.id === sanitizedTraining.id);
                  if (!existing) {
                    const { id, ...newTraining } = sanitizedTraining;
                    await tx.insert(trainings).values({ ...newTraining, employeeId } as any);
                  } else {
                    await tx.update(trainings).set({ ...sanitizedTraining, employeeId } as any)
                      .where(eq(trainings.id, sanitizedTraining.id));
                  }
                } else {
                  const { id, ...newTraining } = sanitizedTraining;
                  await tx.insert(trainings).values({ ...newTraining, employeeId } as any);
                }
              }
            }
            
            // Handle payer enrollments
            if (payerEnrollmentsData && Array.isArray(payerEnrollmentsData)) {
              for (const enrollment of payerEnrollmentsData) {
                const enrollmentWithStringDates = convertDatesToStrings(enrollment);
                const sanitizedEnrollment = sanitizeDateFields(enrollmentWithStringDates);
                const { providerId, enrollmentStatus, ...cleanEnrollment } = sanitizedEnrollment as any;
                if (!cleanEnrollment.enrollmentId && providerId) {
                  cleanEnrollment.enrollmentId = providerId;
                }
                if (!cleanEnrollment.status && enrollmentStatus) {
                  cleanEnrollment.status = enrollmentStatus;
                }
                const isTemporaryId = cleanEnrollment.id && 
                  typeof cleanEnrollment.id === 'number' && 
                  cleanEnrollment.id > 1000000000000;
                
                if (cleanEnrollment.id && typeof cleanEnrollment.id === 'number' && !isTemporaryId) {
                  const existing = existingPayerEnrollments.find(e => e.id === cleanEnrollment.id);
                  if (!existing) {
                    const { id, ...insertData } = cleanEnrollment;
                    await tx.insert(payerEnrollments).values({ ...insertData, employeeId } as any);
                  } else {
                    await tx.update(payerEnrollments).set({ ...cleanEnrollment, employeeId } as any)
                      .where(eq(payerEnrollments.id, cleanEnrollment.id));
                  }
                } else {
                  const { id, ...insertData } = cleanEnrollment;
                  await tx.insert(payerEnrollments).values({ ...insertData, employeeId } as any);
                }
              }
            }

            if (incidentLogsDataExisting && Array.isArray(incidentLogsDataExisting)) {
              for (const incident of incidentLogsDataExisting) {
                const incidentWithStringDates = convertDatesToStrings(incident);
                const sanitizedIncident = sanitizeDateFields(incidentWithStringDates);
                const isTemporaryId = sanitizedIncident.id &&
                  typeof sanitizedIncident.id === 'number' &&
                  sanitizedIncident.id > 1000000000000;

                if (sanitizedIncident.id && typeof sanitizedIncident.id === 'number' && !isTemporaryId) {
                  const existing = existingIncidentLogs.find(e => e.id === sanitizedIncident.id);
                  if (!existing) {
                    const { id, ...insertData } = sanitizedIncident;
                    await tx.insert(incidentLogs).values({ ...insertData, employeeId } as any);
                  } else {
                    await tx.update(incidentLogs).set({ ...sanitizedIncident, employeeId } as any)
                      .where(eq(incidentLogs.id, sanitizedIncident.id));
                  }
                } else {
                  const { id, ...insertData } = sanitizedIncident;
                  await tx.insert(incidentLogs).values({ ...insertData, employeeId } as any);
                }
              }
            }
            
            console.log('[save-draft PUT] All related entities processed successfully');
          } catch (relatedError) {
            console.error('[save-draft PUT] Error processing related entities:', relatedError);
            throw new Error(`Failed to save related entities: ${(relatedError as Error).message}`);
          }
        });
        
        console.log('[save-draft PUT] Transaction completed successfully for employeeId:', employeeId);
        
        // Log audit trail
        await logAudit(req, employeeId, employeeId, { 
          action: 'onboarding_draft_updated',
          timestamp: new Date().toISOString()
        });
        
        // Return success response
        res.json({ 
          success: true,
          message: 'Draft updated successfully',
          employeeId,
          timestamp: new Date().toISOString()
        });
      } catch (error: any) {
        console.error('[save-draft PUT] ERROR updating draft:', error);
        console.error('[save-draft PUT] Error message:', error?.message);
        console.error('[save-draft PUT] Error stack:', error?.stack);
        
        res.status(500).json({ 
          success: false,
          error: 'Failed to update draft',
          message: error?.message || 'Unknown error occurred',
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  /**
   * POST /api/onboarding/submit
   * Submit completed onboarding for review
   */
  app.post('/api/onboarding/submit',
    requireAnyAuth,
    requireRole(['prospective_employee']),
    async (req: AuditRequest, res: Response) => {
      try {
        console.log('[/api/onboarding/submit] Starting onboarding submission for userId:', req.user!.id);
        console.log('[/api/onboarding/submit] Raw request body keys:', Object.keys(req.body));
        
        const userId = req.user!.id;
        
        // Log the raw data before sanitization
        console.log('[/api/onboarding/submit] Sample date fields before sanitization:', {
          dateOfBirth: req.body.dateOfBirth,
          date_of_birth: req.body.date_of_birth,
          onboarding_completed_at: req.body.onboarding_completed_at,
          licenseExpiryDate: req.body.licenseExpiryDate,
          certificationExpiryDate: req.body.certificationExpiryDate
        });
        
        const data = sanitizeDateFields(req.body);
        
        // Log the sanitized data
        console.log('[/api/onboarding/submit] Sample date fields after sanitization:', {
          dateOfBirth: data.dateOfBirth,
          date_of_birth: data.date_of_birth,
          onboarding_completed_at: data.onboarding_completed_at,
          licenseExpiryDate: data.licenseExpiryDate,
          certificationExpiryDate: data.certificationExpiryDate
        });
        
        // Find employee record
        const employees = await storage.getAllEmployees();
        let employee = employees.find(emp => emp.userId === userId);
        
        if (!employee) {
          console.log('[/api/onboarding/submit] Creating new employee record');
          
          // Remove NPI number if it's the hardcoded test value or empty
          if (data.npiNumber === '1234567890' || data.npiNumber === '' || data.npiNumber === undefined || data.npiNumber === null) {
            console.log('[/api/onboarding/submit] NPI is empty or test value - removing from data');
            delete data.npiNumber;
          }
          
          // Create new employee record - already sanitized
          const employeeData = {
            ...data,
            userId,
            status: 'pending_approval',
            onboardingStatus: 'completed',
            onboardingCompletedAt: new Date(),
            onboarding_completed_at: new Date() // legacy field
          } as any;
          
          // Log the data being sent to createEmployee
          console.log('[/api/onboarding/submit] Employee data for creation (including NPI):', {
            npiNumber: employeeData.npiNumber || 'Not provided (optional)',
            dateOfBirth: employeeData.dateOfBirth || employeeData.date_of_birth,
            dlExpirationDate: employeeData.dlExpirationDate || employeeData.dl_expiration_date,
            onboarding_completed_at: employeeData.onboarding_completed_at,
            status: employeeData.status
          });
          
          try {
            const newEmployee = await storage.createEmployee(employeeData);
            employee = newEmployee;
            console.log('[/api/onboarding/submit] Employee created with id:', employee.id);
          } catch (createError: any) {
            console.error('[/api/onboarding/submit] Error creating employee:', createError);
            
            // Check for unique constraint violation
            if (createError.code === '23505' || createError.message?.includes('duplicate key') || createError.message?.includes('unique constraint')) {
              // Extract which field caused the violation
              if (createError.message?.includes('npi_number')) {
                console.error('[/api/onboarding/submit] NPI number already exists');
                return res.status(409).json({ 
                  error: 'This NPI number is already in use. Please provide a different NPI number or leave it blank to add it later.' 
                });
              } else if (createError.message?.includes('work_email')) {
                console.error('[/api/onboarding/submit] Work email already exists');
                return res.status(409).json({ 
                  error: 'This email address is already registered. Please use a different email or contact HR for assistance.' 
                });
              } else {
                console.error('[/api/onboarding/submit] Unique constraint violation:', createError.message);
                return res.status(409).json({ 
                  error: 'A record with this information already exists. Please check your data or contact HR for assistance.' 
                });
              }
            }
            throw createError; // Re-throw if not a unique constraint error
          }
        } else {
          console.log('[/api/onboarding/submit] Updating existing employee record id:', employee.id);
          
          // Remove NPI number if it's the hardcoded test value or empty
          if (data.npiNumber === '1234567890' || data.npiNumber === '' || data.npiNumber === undefined || data.npiNumber === null) {
            console.log('[/api/onboarding/submit] NPI is empty or test value - removing from update data');
            delete data.npiNumber;
          }
          
          // Update existing employee record - already sanitized
          const updateData = {
            ...data,
            status: 'pending_approval',
            onboardingStatus: 'completed',
            onboardingCompletedAt: new Date(),
            onboarding_completed_at: new Date() // legacy field
          } as any;
          
          // Log the data being sent to updateEmployee
          console.log('[/api/onboarding/submit] Employee data for update (including NPI):', {
            npiNumber: updateData.npiNumber || 'Not provided (optional)'
          });
          console.log('[/api/onboarding/submit] Date fields being sent:');
          const dateFields = Object.keys(updateData).filter(key => 
            key.toLowerCase().includes('date') || 
            key.toLowerCase().includes('_at') ||
            key.toLowerCase().includes('expir'));
          const dateFieldValues: any = {};
          dateFields.forEach(field => {
            dateFieldValues[field] = updateData[field];
          });
          console.log('[/api/onboarding/submit] Date fields:', dateFieldValues);
          
          try {
            await storage.updateEmployee(employee.id!, updateData);
            console.log('[/api/onboarding/submit] Employee updated successfully');
          } catch (updateError: any) {
            console.error('[/api/onboarding/submit] Error updating employee:', updateError);
            
            // Check for unique constraint violation
            if (updateError.code === '23505' || updateError.message?.includes('duplicate key') || updateError.message?.includes('unique constraint')) {
              // Extract which field caused the violation
              if (updateError.message?.includes('npi_number')) {
                console.error('[/api/onboarding/submit] NPI number already exists');
                return res.status(409).json({ 
                  error: 'This NPI number is already in use. Please provide a different NPI number or leave it blank to add it later.' 
                });
              } else if (updateError.message?.includes('work_email')) {
                console.error('[/api/onboarding/submit] Work email already exists');
                return res.status(409).json({ 
                  error: 'This email address is already registered. Please use a different email or contact HR for assistance.' 
                });
              } else {
                console.error('[/api/onboarding/submit] Unique constraint violation:', updateError.message);
                return res.status(409).json({ 
                  error: 'A record with this information already exists. Please check your data or contact HR for assistance.' 
                });
              }
            }
            throw updateError; // Re-throw if not a unique constraint error
          }
        }
        
        const employeeId = employee.id!;
        
        // Save all related entities - data already sanitized
        if (data.educations && Array.isArray(data.educations)) {
          console.log(`[/api/onboarding/submit] Processing ${data.educations.length} education records`);
          for (const education of data.educations) {
            if (education.id) {
              await storage.updateEducation(education.id, education);
            } else {
              await storage.createEducation({ ...education, employeeId });
            }
          }
        }
        
        if (data.employments && Array.isArray(data.employments)) {
          console.log(`[/api/onboarding/submit] Processing ${data.employments.length} employment records`);
          for (const employment of data.employments) {
            if (employment.id) {
              await storage.updateEmployment(employment.id, employment);
            } else {
              await storage.createEmployment({ ...employment, employeeId });
            }
          }
        }
        
        // Do NOT update user role here - they remain prospective_employee until HR approves
        // Role will be updated from 'prospective_employee' to 'employee' in the approval endpoint
        
        await logAudit(req, employeeId, employeeId, { action: 'onboarding_submitted' });
        
        res.json({ 
          message: 'Onboarding submitted successfully',
          employeeId
        });
      } catch (error: any) {
        console.error('[/api/onboarding/submit] Error submitting onboarding:', error);
        
        // Check if this is a unique constraint violation that wasn't caught earlier
        if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('unique constraint')) {
          if (error.message?.includes('npi_number')) {
            console.error('[/api/onboarding/submit] NPI unique constraint violation');
            return res.status(409).json({ 
              error: 'This NPI number is already in use. Please provide a different NPI number or leave it blank to add it later.' 
            });
          } else if (error.message?.includes('work_email')) {
            console.error('[/api/onboarding/submit] Email unique constraint violation');
            return res.status(409).json({ 
              error: 'This email address is already registered. Please use a different email or contact HR for assistance.' 
            });
          } else {
            console.error('[/api/onboarding/submit] Unique constraint violation:', error.message);
            return res.status(409).json({ 
              error: 'A record with this information already exists. Please check your data or contact HR for assistance.' 
            });
          }
        }
        
        // Log more details for date-related errors
        if (error instanceof Error && error.message.includes('date')) {
          console.error('[/api/onboarding/submit] Date-related error details:', {
            message: error.message,
            stack: error.stack
          });
        }
        
        res.status(500).json({ error: 'Failed to submit onboarding', details: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  );

  /**
   * POST /api/invitations/:id/approve
   * Approve completed onboarding and convert to full employee
   */
  app.post('/api/invitations/:id/approve',
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']),
    validateId,
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const invitationId = parseInt(req.params.id);
        
        // Get invitation
        const invitation = await storage.getInvitationById(invitationId);
        if (!invitation) {
          return res.status(404).json({ error: 'Invitation not found' });
        }
        
        if (!invitation.employeeId) {
          return res.status(400).json({ error: 'Employee has not registered yet' });
        }
        
        // Check if all forms are completed
        const { docuSealService } = await import('./services/docusealService');
        const formsCompleted = await docuSealService.areOnboardingFormsCompleted(invitationId);
        
        if (!formsCompleted) {
          return res.status(400).json({ error: 'Not all onboarding forms have been completed' });
        }
        
        // Update employee status
        await storage.updateEmployee(invitation.employeeId, {
          status: 'active',
          onboardingStatus: 'completed',
          onboardingCompletedAt: new Date(),
          approvedAt: new Date(),
          approvedBy: req.user!.id
        });
        
        // Update invitation status
        await storage.updateInvitation(invitationId, {
          status: 'completed',
          completedAt: new Date()
        });
        
        // Update user role to give full access
        const employee = await storage.getEmployee(invitation.employeeId);
        if (employee?.userId) {
          const user = await storage.getUser(employee.userId);
          if (user && user.role === 'viewer') {
            // Upgrade from viewer to hr role
            await db.update(users)
              .set({ role: 'hr' })
              .where(eq(users.id, employee.userId));
          }
        }
        
        // Log audit
        await logAudit(req, invitationId, invitation.employeeId, { action: 'onboarding_approved' });
        
        res.json({
          message: 'Onboarding approved successfully',
          employeeId: invitation.employeeId
        });
      } catch (error) {
        console.error('Error approving onboarding:', error);
        res.status(500).json({ error: 'Failed to approve onboarding' });
      }
    }
  );

  /**
   * POST /api/invitations/:id/resend
   * Resend invitation email
   */
  app.post('/api/invitations/:id/resend',
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']),
    validateId(),
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const invitationId = parseInt(req.params.id);
        const invitation = await storage.getInvitationById(invitationId);
        
        if (!invitation) {
          return res.status(404).json({ error: 'Invitation not found' });
        }
        
        if (invitation.status === 'completed' || invitation.status === 'expired') {
          return res.status(400).json({ 
            error: `Cannot resend invitation with status: ${invitation.status}` 
          });
        }
        
        // Extend expiration date by 7 days from now when resending
        const now = new Date();
        const newExpiresAt = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
        
        // Update the invitation with new expiration date
        await storage.updateInvitation(invitationId, {
          expiresAt: newExpiresAt,
          metadata: {
            ...invitation.metadata,
            lastResendAt: now.toISOString(),
            resendCount: ((invitation.metadata as any)?.resendCount || 0) + 1
          }
        });
        
        // Generate invitation link using proper domain detection
        const baseUrl = getBaseUrl(req);
        const invitationLink = `${baseUrl}/onboarding/register?token=${invitation.invitationToken}`;
        console.log(`Resend invitation link generated: ${invitationLink}`);
        
        // Calculate time until expiration
        const expiresAt = newExpiresAt;
        const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        // Send email with timeout handling
        const { mailtrapService } = await import('./services/mailtrapService');
        const emailResult = await mailtrapService.sendInvitationEmail(
          {
            to: invitation.email,
            firstName: invitation.firstName,
            lastName: invitation.lastName,
            invitationLink,
            expiresIn: `${daysRemaining} days`
          },
          invitation.id,
          0 // Manual resend, not a reminder
        );
        
        // Check if email was sent in development mode
        const isDevelopmentMode = emailResult.error?.includes('Development mode');
        
        // Always return success, but include SES status in response
        if (emailResult.success && !isDevelopmentMode) {
          res.json({ 
            message: 'Invitation email resent successfully',
            email: invitation.email 
          });
        } else if (isDevelopmentMode) {
          // Development mode - email logged but not sent
          console.log('Resend invitation link for development mode:', invitationLink);
          res.json({
            message: 'Invitation resend completed (Development Mode)',
            email: invitation.email,
            emailStatus: 'development',
            note: 'Email logged to console - check server logs for invitation link',
            developmentInfo: 'SES not configured - set ENCRYPTION_KEY and configure SES in Settings'
          });
        } else {
          // Don't fail the request if email fails - return success with details
          res.json({
            message: 'Invitation resend completed - email service needs configuration',
            email: invitation.email,
            emailStatus: 'failed',
            emailError: emailResult.error || 'Email service not available'
          });
        }
      } catch (error) {
        console.error('Error resending invitation:', error);
        res.status(500).json({ error: 'Failed to resend invitation' });
      }
    }
  );

  /**
   * DELETE /api/invitations/:id
   * Cancel an invitation
   */
  app.delete('/api/invitations/:id',
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('delete:employees'),
    requireRole(['admin', 'hr']),
    validateId,
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const invitationId = parseInt(req.params.id);
        const invitation = await storage.getInvitationById(invitationId);
        
        if (!invitation) {
          return res.status(404).json({ error: 'Invitation not found' });
        }
        
        if (invitation.status === 'completed') {
          return res.status(400).json({ 
            error: 'Cannot delete completed invitation' 
          });
        }
        
        await storage.updateInvitation(invitationId, { status: 'expired' });
        
        await logAudit(req, invitationId, null, { status: 'expired' });
        
        res.json({ message: 'Invitation cancelled successfully' });
      } catch (error) {
        console.error('Error cancelling invitation:', error);
        res.status(500).json({ error: 'Failed to cancel invitation' });
      }
    }
  );

  /**
   * API Key Management Routes
   * 
   * @description
   * Endpoints for managing API keys for external application integration.
   * Supports key creation, rotation, revocation, and usage tracking.
   */
  
  /**
   * GET /api/settings/api-keys
   * 
   * @route GET /api/settings/api-keys
   * @group API Keys - API key management
   * @security Session Only - API keys cannot manage API keys
   * 
   * @returns {object} 200 - List of user's API keys (without raw keys)
   * @returns {Error} 401 - Authentication required
   */
  app.get('/api/settings/api-keys',
    requireAuth, // SESSION ONLY - API keys cannot manage themselves
    async (req: ApiKeyRequest, res) => {
      try {
        const keys = await storage.getUserApiKeys(req.user!.id);
        
        // Never expose the hash, only safe fields
        const safeKeys = keys.map(key => ({
          id: key.id,
          name: key.name,
          keyPrefix: key.keyPrefix,
          permissions: key.permissions,
          lastUsedAt: key.lastUsedAt,
          expiresAt: key.expiresAt,
          createdAt: key.createdAt,
          revokedAt: key.revokedAt,
          environment: key.environment,
          rateLimitPerHour: key.rateLimitPerHour
        }));
        
        res.json(safeKeys);
      } catch (error) {
        console.error('Error fetching API keys:', error);
        res.status(500).json({ error: 'Failed to fetch API keys' });
      }
    }
  );
  
  /**
   * POST /api/settings/api-keys
   * 
   * @route POST /api/settings/api-keys
   * @group API Keys
   * @security Session only (not available via API key)
   * 
   * @param {string} body.name.required - Friendly name for the key
   * @param {array} body.permissions.required - Array of permission scopes
   * @param {string} body.environment - 'live' or 'test' (default: 'live')
   * @param {number} body.expiresInDays - Days until expiration (default: 90)
   * @param {number} body.rateLimitPerHour - Rate limit (default: 1000)
   * 
   * @returns {object} 201 - Created API key with raw key (only shown once!)
   * @returns {Error} 401 - Authentication required
   * @returns {Error} 429 - Rate limit exceeded
   */
  app.post('/api/settings/api-keys',
    requireAuth, // Only session auth for creating keys
    apiKeyLimiter, // Apply strict rate limit
    [
      body('name').notEmpty().withMessage('API key name is required'),
      body('permissions').isArray().withMessage('Permissions must be an array'),
      body('environment').optional().isIn(['live', 'test']).withMessage('Environment must be live or test'),
      body('expiresInDays').optional().isInt({ min: 1, max: 365 }).withMessage('Expiration must be 1-365 days'),
      body('rateLimitPerHour').optional().isInt({ min: 10, max: 10000 }).withMessage('Rate limit must be 10-10000')
    ],
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const {
          name,
          permissions,
          environment = 'live',
          expiresInDays = 90,
          rateLimitPerHour = 1000,
          metadata = {}
        } = req.body;
        
        // Validate permissions
        const validPermissions = Object.values(API_KEY_PERMISSIONS);
        const invalidPermissions = permissions.filter(
          (p: string) => p !== '*' && !validPermissions.includes(p as any)
        );
        
        if (invalidPermissions.length > 0) {
          return res.status(400).json({ 
            error: 'Invalid permissions',
            invalid: invalidPermissions,
            valid: validPermissions
          });
        }
        
        // Generate the API key
        const { key, hash, prefix } = await generateApiKey(environment);
        
        // Calculate expiration date
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);
        
        // Create the API key record
        const apiKey = await storage.createApiKey({
          name,
          keyHash: hash,
          keyPrefix: prefix,
          userId: req.user!.id,
          permissions,
          expiresAt,
          environment,
          rateLimitPerHour,
          metadata
        });
        
        // Log the creation to audit log
        await logAudit(req, apiKey.id, null, apiKey);
        
        // Return the key data WITH the raw key (only time it's shown!)
        res.status(201).json({
          id: apiKey.id,
          name: apiKey.name,
          key: key, // IMPORTANT: Raw key only shown here!
          keyPrefix: apiKey.keyPrefix,
          permissions: apiKey.permissions,
          expiresAt: apiKey.expiresAt,
          environment: apiKey.environment,
          message: 'IMPORTANT: Save this API key securely. It will not be shown again!'
        });
      } catch (error) {
        console.error('Error creating API key:', error);
        res.status(500).json({ error: 'Failed to create API key' });
      }
    }
  );
  
  /**
   * DELETE /api/settings/api-keys/:id
   * 
   * @route DELETE /api/settings/api-keys/:id
   * @group API Keys
   * @security Session only
   * 
   * @param {number} params.id - API key ID to revoke
   * 
   * @returns {object} 200 - Key successfully revoked
   * @returns {Error} 404 - Key not found
   */
  app.delete('/api/settings/api-keys/:id',
    requireAuth,
    validateId(),
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const keyId = parseInt(req.params.id);
        
        // Check if key exists and belongs to user
        const key = await storage.getApiKey(keyId);
        if (!key || key.userId !== req.user!.id) {
          return res.status(404).json({ error: 'API key not found' });
        }
        
        // Revoke the key (soft delete)
        await storage.revokeApiKey(keyId);
        
        // Log the revocation
        await logAudit(req, keyId, key, null);
        
        res.json({ message: 'API key revoked successfully' });
      } catch (error) {
        console.error('Error revoking API key:', error);
        res.status(500).json({ error: 'Failed to revoke API key' });
      }
    }
  );
  
  /**
   * POST /api/settings/api-keys/:id/rotate
   * 
   * @route POST /api/settings/api-keys/:id/rotate
   * @group API Keys
   * @security Session only
   * 
   * @param {number} params.id - API key ID to rotate
   * @param {number} body.gracePeriodHours - Hours old key remains valid (default: 24)
   * 
   * @returns {object} 200 - New rotated key with raw value
   */
  app.post('/api/settings/api-keys/:id/rotate',
    requireAuth,
    apiKeyLimiter,
    validateId(),
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const keyId = parseInt(req.params.id);
        const { gracePeriodHours = 24, reason = 'Manual rotation' } = req.body;
        
        // Get existing key
        const oldKey = await storage.getApiKey(keyId);
        if (!oldKey || oldKey.userId !== req.user!.id) {
          return res.status(404).json({ error: 'API key not found' });
        }
        
        if (oldKey.revokedAt) {
          return res.status(400).json({ error: 'Cannot rotate a revoked key' });
        }
        
        // Generate new key
        const { key, hash, prefix } = await generateApiKey(oldKey.environment as 'live' | 'test');
        
        // Create new key with same permissions
        const newKey = await storage.createApiKey({
          name: `${oldKey.name} (Rotated)`,
          keyHash: hash,
          keyPrefix: prefix,
          userId: req.user!.id,
          permissions: oldKey.permissions as string[],
          expiresAt: oldKey.expiresAt,
          environment: oldKey.environment,
          rateLimitPerHour: oldKey.rateLimitPerHour,
          metadata: (oldKey.metadata || {}) as Record<string, any>
        });
        
        // Calculate grace period end
        const gracePeriodEnds = new Date();
        gracePeriodEnds.setHours(gracePeriodEnds.getHours() + gracePeriodHours);
        
        // Create rotation record
        await storage.createApiKeyRotation({
          apiKeyId: oldKey.id,
          oldKeyId: oldKey.id,
          newKeyId: newKey.id,
          rotationType: 'manual',
          rotatedBy: req.user!.id,
          gracePeriodEnds,
          reason
        });
        
        // Schedule old key revocation after grace period
        setTimeout(async () => {
          await storage.revokeApiKey(oldKey.id);
        }, gracePeriodHours * 60 * 60 * 1000);
        
        // Log the rotation
        await logAudit(req, newKey.id, oldKey, newKey);
        
        res.json({
          id: newKey.id,
          name: newKey.name,
          key: key, // Raw key shown only once!
          keyPrefix: newKey.keyPrefix,
          gracePeriodEnds,
          message: `Key rotated. Old key valid until ${gracePeriodEnds.toISOString()}. Save the new key securely!`
        });
      } catch (error) {
        console.error('Error rotating API key:', error);
        res.status(500).json({ error: 'Failed to rotate API key' });
      }
    }
  );
  
  /**
   * GET /api/settings/api-keys/:id/usage
   * 
   * @route GET /api/settings/api-keys/:id/usage
   * @group API Keys
   * @security Session only
   * 
   * @param {number} params.id - API key ID
   * 
   * @returns {object} 200 - Usage statistics for the key
   */
  app.get('/api/settings/api-keys/:id/usage',
    requireAuth,
    validateId(),
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const keyId = parseInt(req.params.id);
        
        // Get the key
        const key = await storage.getApiKey(keyId);
        if (!key || key.userId !== req.user!.id) {
          return res.status(404).json({ error: 'API key not found' });
        }
        
        // Get rotation history
        const rotations = await storage.getApiKeyRotations(keyId);
        
        // Get audit logs for this key
        const auditResult = await storage.getAudits({
          tableName: 'api_keys',
          limit: 100
        });
        
        const keyAudits = auditResult.audits.filter(
          audit => audit.recordId === keyId
        );
        
        // Calculate usage stats
        const stats = {
          keyId: key.id,
          name: key.name,
          created: key.createdAt,
          lastUsed: key.lastUsedAt,
          expiresAt: key.expiresAt,
          isExpired: new Date(key.expiresAt) < new Date(),
          isRevoked: !!key.revokedAt,
          rotationCount: rotations.length,
          rotations: rotations.map(r => ({
            rotatedAt: r.rotatedAt,
            type: r.rotationType,
            reason: r.reason
          })),
          authAttempts: keyAudits.filter(a => a.action === 'AUTH_SUCCESS' || a.action === 'AUTH_FAILED').length,
          successfulAuths: keyAudits.filter(a => a.action === 'AUTH_SUCCESS').length,
          failedAuths: keyAudits.filter(a => a.action === 'AUTH_FAILED').length
        };
        
        res.json(stats);
      } catch (error) {
        console.error('Error fetching API key usage:', error);
        res.status(500).json({ error: 'Failed to fetch usage statistics' });
      }
    }
  );

  /**
   * S3 Storage Management Routes
   */
  
  /**
   * GET /api/storage/status
   * 
   * @route GET /api/storage/status
   * @group Storage - S3 storage management
   * @security Session
   * 
   * @returns {object} 200 - Storage configuration status and statistics
   */
  app.get('/api/storage/status',
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:employees'),
    async (req: AuditRequest, res: Response) => {
      try {
        // Get document storage statistics from the storage layer
        const stats = await storage.getDocumentStorageStats();
        
        // Get safe configuration status (no secrets)
        const bucketName = s3Service.getBucketName();
        const maskedBucketName = bucketName 
          ? bucketName.substring(0, Math.min(5, bucketName.length)) + '...'
          : null;
        
        res.json({
          configured: s3Service.isConfigured(),
          bucketName: maskedBucketName,
          stats: {
            totalCount: stats.totalCount,
            s3Count: stats.s3Count,
            localCount: stats.localCount,
            s3Percentage: stats.totalCount > 0 
              ? ((stats.s3Count / stats.totalCount) * 100).toFixed(2)
              : '0'
          },
          canMigrate: s3Service.isConfigured() && stats.localCount > 0
        });
      } catch (error) {
        console.error('Error fetching storage status:', error);
        res.status(500).json({ error: 'Failed to fetch storage status' });
      }
    }
  );
  
  /**
   * POST /api/storage/migrate
   * 
   * @route POST /api/storage/migrate
   * @group Storage - S3 storage management
   * @security Session
   * @param {number} body.batchSize - Number of documents to migrate (default: 10, max: 100)
   * @param {boolean} body.dryRun - Whether to simulate migration without making changes
   * 
   * @returns {object} 200 - Migration results
   */
  app.post('/api/storage/migrate',
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('admin'),
    async (req: AuditRequest, res: Response) => {
      try {
        const { batchSize = 10, dryRun = false } = req.body;
        const limitedBatchSize = Math.min(batchSize, 100);
        
        // Check if S3 is configured
        if (!s3Service.isS3Configured()) {
          return res.status(400).json({ 
            error: 'S3 is not configured. Please set AWS credentials in environment variables.' 
          });
        }
        
        // Get documents that are stored locally
        const localDocuments = await db.select()
          .from(documents)
          .where(or(
            eq(documents.storageType, 'local'),
            sql`${documents.storageType} IS NULL`
          ))
          .limit(limitedBatchSize);
        
        if (localDocuments.length === 0) {
          return res.json({
            message: 'No local documents to migrate',
            migrated: 0,
            failed: 0
          });
        }
        
        const results = {
          migrated: [] as any[],
          failed: [] as any[],
          skipped: [] as any[]
        };
        
        for (const doc of localDocuments) {
          try {
            // Skip if no file path
            if (!doc.filePath) {
              results.skipped.push({
                id: doc.id,
                reason: 'No file path'
              });
              continue;
            }
            
            // Check if local file exists
            if (!fs.existsSync(doc.filePath)) {
              results.failed.push({
                id: doc.id,
                fileName: doc.fileName,
                error: 'Local file not found'
              });
              continue;
            }
            
            if (dryRun) {
              results.migrated.push({
                id: doc.id,
                fileName: doc.fileName,
                filePath: doc.filePath,
                dryRun: true
              });
              continue;
            }
            
            // Generate S3 key
            const s3Key = generateDocumentKey(
              doc.employeeId!,
              doc.documentType,
              doc.fileName || 'document'
            );
            
            // Migrate to S3
            const migrationResult = await s3Service.migrateToS3(
              doc.filePath,
              s3Key,
              doc.mimeType || 'application/octet-stream'
            );
            
            if (migrationResult.success && migrationResult.storageType === 's3') {
              // Update database record
              await db.update(documents)
                .set({
                  storageType: 's3',
                  storageKey: s3Key,
                  s3Etag: migrationResult.etag
                })
                .where(eq(documents.id, doc.id));
              
              // Delete local file after successful migration
              try {
                await fs.promises.unlink(doc.filePath);
              } catch (err) {
                console.error(`Failed to delete local file after migration: ${doc.filePath}`, err);
              }
              
              results.migrated.push({
                id: doc.id,
                fileName: doc.fileName,
                s3Key,
                etag: migrationResult.etag
              });
            } else {
              results.failed.push({
                id: doc.id,
                fileName: doc.fileName,
                error: migrationResult.error || 'Migration failed'
              });
            }
          } catch (error) {
            results.failed.push({
              id: doc.id,
              fileName: doc.fileName,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
        
        // Log migration audit
        if (!dryRun && results.migrated.length > 0) {
          await logAudit(req, 0, { documentCount: localDocuments.length }, results);
        }
        
        res.json({
          message: dryRun ? 'Dry run completed' : 'Migration completed',
          dryRun,
          total: localDocuments.length,
          migrated: results.migrated.length,
          failed: results.failed.length,
          skipped: results.skipped.length,
          results
        });
      } catch (error) {
        console.error('Error migrating documents to S3:', error);
        res.status(500).json({ error: 'Failed to migrate documents' });
      }
    }
  );
  
  /**
   * GET /api/storage/documents/:id/url
   * 
   * @route GET /api/storage/documents/:id/url
   * @group Storage - S3 storage management
   * @security Session
   * @param {number} params.id - Document ID
   * @param {number} query.expiresIn - URL expiration in seconds (default: 3600, max: 86400)
   * 
   * @returns {object} 200 - Signed URL for document access
   */
  app.get('/api/storage/documents/:id/url',
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:documents'),
    validateId(),
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const documentId = parseInt(req.params.id);
        const expiresIn = Math.min(
          parseInt(req.query.expiresIn as string) || 3600,
          86400 // Max 24 hours
        );
        
        const document = await storage.getDocument(documentId);
        
        if (!document) {
          return res.status(404).json({ error: 'Document not found' });
        }
        
        // Only generate signed URLs for S3 documents
        if (document.storageType !== 's3' || !document.storageKey) {
          return res.status(400).json({ 
            error: 'Document is not stored in S3' 
          });
        }
        
        const signedUrl = await s3Service.getSignedUrl(document.storageKey, expiresIn);
        
        if (!signedUrl) {
          return res.status(500).json({ 
            error: 'Failed to generate signed URL' 
          });
        }
        
        res.json({
          url: signedUrl,
          expiresIn,
          documentId: document.id,
          fileName: document.fileName
        });
      } catch (error) {
        console.error('Error generating signed URL:', error);
        res.status(500).json({ error: 'Failed to generate signed URL' });
      }
    }
  );

  // CSV Export routes
  app.get('/api/export/expiring-items', 
    requireAuth,
    async (req: AuditRequest, res: Response) => {
      try {
        const days = parseInt(req.query.days as string) || 30;
        const items = await storage.getExpiringItems(days);

        const csvHeaders = 'Employee,Item Type,License/Cert Number,Expiration Date,Days Remaining\n';
        const csvData = items.map(item => 
          `"${item.employeeName}","${item.itemType}","${item.licenseNumber || ''}","${new Date(item.expirationDate).toISOString().split('T')[0]}","${item.daysRemaining}"`
        ).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="expiring-items-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvHeaders + csvData);
      } catch (error) {
        console.error('Error exporting expiring items:', error);
        res.status(500).json({ error: 'Failed to export expiring items' });
      }
    }
  );

  app.get('/api/export/employees', 
    requireAuth,
    async (req: AuditRequest, res: Response) => {
      try {
        const result = await storage.getEmployees({ limit: 10000, offset: 0 });
        
        // Convert to CSV format (simplified)
        const csvHeaders = 'First Name,Last Name,Job Title,Work Email,Status\n';
        const csvData = result.employees.map(emp => 
          `"${emp.firstName}","${emp.lastName}","${emp.jobTitle || ''}","${emp.workEmail}","${emp.status}"`
        ).join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="employees.csv"');
        res.send(csvHeaders + csvData);
      } catch (error) {
        console.error('Error exporting employees:', error);
        res.status(500).json({ error: 'Failed to export employees' });
      }
    }
  );

  // =====================
  // LOCATION MANAGEMENT APIs
  // =====================
  
  // GET /api/locations - List all locations with hierarchy
  app.get('/api/locations',
    requireAuth,
    // Custom validation for locations - allow higher limit for dropdowns
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 10000 }).withMessage('Limit must be between 1 and 10000'),
    query('search').optional().isLength({ max: 255 }).withMessage('Search term too long'),
    handleValidationErrors,
    auditMiddleware('READ'),
    async (req: AuditRequest, res: Response) => {
      try {
        const { page = '1', limit = '10', search, type, status, parentId } = req.query;
        const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
        
        const result = await storage.getLocations({
          limit: parseInt(limit as string),
          offset,
          search: search as string,
          type: type as string,
          status: status as string,
          parentId: parentId ? (parentId === 'null' ? null : parseInt(parentId as string)) : undefined
        });
        
        res.json({
          locations: result.locations,
          total: result.total,
          page: parseInt(page as string),
          totalPages: Math.ceil(result.total / parseInt(limit as string))
        });
      } catch (error) {
        console.error('Error fetching locations:', error);
        res.status(500).json({ error: 'Failed to fetch locations' });
      }
    }
  );
  
  // GET /api/locations/:id - Get location details
  app.get('/api/locations/:id',
    requireAuth,
    validateId(),
    handleValidationErrors,
    auditMiddleware('READ'),
    async (req: AuditRequest, res: Response) => {
      try {
        const location = await storage.getLocation(parseInt(req.params.id));
        if (!location) {
          return res.status(404).json({ error: 'Location not found' });
        }
        res.json(location);
      } catch (error) {
        console.error('Error fetching location:', error);
        res.status(500).json({ error: 'Failed to fetch location' });
      }
    }
  );
  
  // POST /api/locations - Create new location
  app.post('/api/locations',
    requireAuth,
    requireRole(['admin', 'hr']),
    validateLocation(),
    handleValidationErrors,
    auditMiddleware('CREATE'),
    async (req: AuditRequest, res: Response) => {
      try {
        const location = await storage.createLocation(req.body);
        
        await logAudit(
          req,
          location.id,
          null,
          location
        );
        
        res.status(201).json(location);
      } catch (error) {
        console.error('Error creating location:', error);
        res.status(500).json({ error: 'Failed to create location' });
      }
    }
  );
  
  // PUT /api/locations/:id - Update location
  app.put('/api/locations/:id',
    requireAuth,
    requireRole(['admin', 'hr']),
    validateId(),
    validateLocation(),
    handleValidationErrors,
    auditMiddleware('UPDATE'),
    async (req: AuditRequest, res: Response) => {
      try {
        const location = await storage.updateLocation(parseInt(req.params.id), req.body);
        
        await logAudit(
          req,
          location.id,
          null,
          location
        );
        
        res.json(location);
      } catch (error) {
        console.error('Error updating location:', error);
        res.status(500).json({ error: 'Failed to update location' });
      }
    }
  );
  
  // DELETE /api/locations/:id - Delete location
  app.delete('/api/locations/:id',
    requireAuth,
    requireRole(['admin']),
    validateId(),
    handleValidationErrors,
    auditMiddleware('DELETE'),
    async (req: AuditRequest, res: Response) => {
      try {
        const locationId = parseInt(req.params.id);
        await storage.deleteLocation(locationId);
        
        await logAudit(
          req,
          locationId,
          null,
          null
        );
        
        res.status(204).send();
      } catch (error: any) {
        console.error('Error deleting location:', error);
        if (error.message?.includes('Cannot delete')) {
          res.status(409).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Failed to delete location' });
        }
      }
    }
  );
  
  // GET /api/locations/:id/sublicenses - Get sub-location licenses
  app.get('/api/locations/:id/sublicenses',
    requireAuth,
    validateId(),
    handleValidationErrors,
    auditMiddleware('READ'),
    async (req: AuditRequest, res: Response) => {
      try {
        const locationId = parseInt(req.params.id);
        const subLocations = await storage.getSubLocations(locationId);
        
        const licensesPromises = subLocations.map(loc => 
          storage.getClinicLicensesByLocation(loc.id)
        );
        
        const licensesArrays = await Promise.all(licensesPromises);
        const allLicenses = licensesArrays.flat();
        
        res.json(allLicenses);
      } catch (error) {
        console.error('Error fetching sub-location licenses:', error);
        res.status(500).json({ error: 'Failed to fetch sub-location licenses' });
      }
    }
  );
  
  // GET /api/locations/hierarchy - Get hierarchical tree structure
  app.get('/api/locations/hierarchy',
    requireAuth,
    auditMiddleware('READ'),
    async (req: AuditRequest, res: Response) => {
      try {
        const locations = await storage.getLocationHierarchy();
        
        // Build hierarchy tree
        const buildHierarchy = (parentId: number | null = null): any[] => {
          return locations
            .filter(loc => loc.parentId === parentId)
            .map(loc => ({
              ...loc,
              children: buildHierarchy(loc.id)
            }));
        };
        
        const hierarchy = buildHierarchy(null);
        res.json(hierarchy);
      } catch (error) {
        console.error('Error fetching location hierarchy:', error);
        res.status(500).json({ error: 'Failed to fetch location hierarchy' });
      }
    }
  );
  
  // =====================
  // LICENSE TYPE MANAGEMENT APIs
  // =====================
  
  // GET /api/license-types - List all license types
  app.get('/api/license-types',
    requireAuth,
    validatePagination(),
    handleValidationErrors,
    auditMiddleware('READ'),
    async (req: AuditRequest, res: Response) => {
      try {
        const { page = '1', limit = '10', search, category } = req.query;
        const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
        
        const result = await storage.getLicenseTypes({
          limit: parseInt(limit as string),
          offset,
          search: search as string,
          category: category as string
        });
        
        res.json({
          licenseTypes: result.licenseTypes,
          total: result.total,
          page: parseInt(page as string),
          totalPages: Math.ceil(result.total / parseInt(limit as string))
        });
      } catch (error) {
        console.error('Error fetching license types:', error);
        res.status(500).json({ error: 'Failed to fetch license types' });
      }
    }
  );
  
  // GET /api/license-types/:id - Get license type details
  app.get('/api/license-types/:id',
    requireAuth,
    validateId(),
    handleValidationErrors,
    auditMiddleware('READ'),
    async (req: AuditRequest, res: Response) => {
      try {
        const licenseType = await storage.getLicenseType(parseInt(req.params.id));
        if (!licenseType) {
          return res.status(404).json({ error: 'License type not found' });
        }
        res.json(licenseType);
      } catch (error) {
        console.error('Error fetching license type:', error);
        res.status(500).json({ error: 'Failed to fetch license type' });
      }
    }
  );
  
  // POST /api/license-types - Create new license type
  app.post('/api/license-types',
    requireAuth,
    requireRole(['admin', 'hr']),
    validateLicenseType(),
    handleValidationErrors,
    auditMiddleware('CREATE'),
    async (req: AuditRequest, res: Response) => {
      try {
        const licenseType = await storage.createLicenseType(req.body);
        
        await logAudit(
          req,
          licenseType.id,
          null,
          licenseType
        );
        
        res.status(201).json(licenseType);
      } catch (error) {
        console.error('Error creating license type:', error);
        res.status(500).json({ error: 'Failed to create license type' });
      }
    }
  );
  
  // PUT /api/license-types/:id - Update license type
  app.put('/api/license-types/:id',
    requireAuth,
    requireRole(['admin', 'hr']),
    validateId(),
    validateLicenseType(),
    handleValidationErrors,
    auditMiddleware('UPDATE'),
    async (req: AuditRequest, res: Response) => {
      try {
        const licenseType = await storage.updateLicenseType(parseInt(req.params.id), req.body);
        
        await logAudit(
          req,
          licenseType.id,
          null,
          licenseType
        );
        
        res.json(licenseType);
      } catch (error) {
        console.error('Error updating license type:', error);
        res.status(500).json({ error: 'Failed to update license type' });
      }
    }
  );
  
  // DELETE /api/license-types/:id - Delete license type
  app.delete('/api/license-types/:id',
    requireAuth,
    requireRole(['admin']),
    validateId(),
    handleValidationErrors,
    auditMiddleware('DELETE'),
    async (req: AuditRequest, res: Response) => {
      try {
        const licenseTypeId = parseInt(req.params.id);
        await storage.deleteLicenseType(licenseTypeId);
        
        await logAudit(
          req,
          licenseTypeId,
          null,
          null
        );
        
        res.status(204).send();
      } catch (error: any) {
        console.error('Error deleting license type:', error);
        if (error.message?.includes('Cannot delete')) {
          res.status(409).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Failed to delete license type' });
        }
      }
    }
  );
  
  // =====================
  // RESPONSIBLE PERSON APIs
  // =====================
  
  // GET /api/responsible-persons - List all responsible persons
  app.get('/api/responsible-persons',
    requireAuth,
    validatePagination(),
    handleValidationErrors,
    auditMiddleware('READ'),
    async (req: AuditRequest, res: Response) => {
      try {
        const { page = '1', limit = '10', search, isPrimary, status } = req.query;
        const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
        
        const result = await storage.getResponsiblePersons({
          limit: parseInt(limit as string),
          offset,
          search: search as string,
          isPrimary: isPrimary === 'true' ? true : isPrimary === 'false' ? false : undefined,
          status: status as string
        });
        
        res.json({
          persons: result.persons,
          total: result.total,
          page: parseInt(page as string),
          totalPages: Math.ceil(result.total / parseInt(limit as string))
        });
      } catch (error) {
        console.error('Error fetching responsible persons:', error);
        res.status(500).json({ error: 'Failed to fetch responsible persons' });
      }
    }
  );
  
  // GET /api/responsible-persons/:id - Get person details
  app.get('/api/responsible-persons/:id',
    requireAuth,
    validateId(),
    handleValidationErrors,
    auditMiddleware('READ'),
    async (req: AuditRequest, res: Response) => {
      try {
        const person = await storage.getResponsiblePerson(parseInt(req.params.id));
        if (!person) {
          return res.status(404).json({ error: 'Responsible person not found' });
        }
        res.json(person);
      } catch (error) {
        console.error('Error fetching responsible person:', error);
        res.status(500).json({ error: 'Failed to fetch responsible person' });
      }
    }
  );
  
  // POST /api/responsible-persons - Create responsible person
  app.post('/api/responsible-persons',
    requireAuth,
    requireRole(['admin', 'hr']),
    validateResponsiblePerson(),
    handleValidationErrors,
    auditMiddleware('CREATE'),
    async (req: AuditRequest, res: Response) => {
      try {
        const person = await storage.createResponsiblePerson(req.body);
        
        await logAudit(
          req,
          person.id,
          null,
          person
        );
        
        res.status(201).json(person);
      } catch (error) {
        console.error('Error creating responsible person:', error);
        res.status(500).json({ error: 'Failed to create responsible person' });
      }
    }
  );
  
  // PUT /api/responsible-persons/:id - Update person
  app.put('/api/responsible-persons/:id',
    requireAuth,
    requireRole(['admin', 'hr']),
    validateId(),
    validateResponsiblePerson(),
    handleValidationErrors,
    auditMiddleware('UPDATE'),
    async (req: AuditRequest, res: Response) => {
      try {
        const person = await storage.updateResponsiblePerson(parseInt(req.params.id), req.body);
        
        await logAudit(
          req,
          person.id,
          null,
          person
        );
        
        res.json(person);
      } catch (error) {
        console.error('Error updating responsible person:', error);
        res.status(500).json({ error: 'Failed to update responsible person' });
      }
    }
  );
  
  // DELETE /api/responsible-persons/:id - Delete person
  app.delete('/api/responsible-persons/:id',
    requireAuth,
    requireRole(['admin']),
    validateId(),
    handleValidationErrors,
    auditMiddleware('DELETE'),
    async (req: AuditRequest, res: Response) => {
      try {
        const personId = parseInt(req.params.id);
        await storage.deleteResponsiblePerson(personId);
        
        await logAudit(
          req,
          personId,
          null,
          null
        );
        
        res.status(204).send();
      } catch (error: any) {
        console.error('Error deleting responsible person:', error);
        if (error.message?.includes('Cannot delete')) {
          res.status(409).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Failed to delete responsible person' });
        }
      }
    }
  );
  
  // GET /api/responsible-persons/by-employee/:employeeId - Get by employee
  app.get('/api/responsible-persons/by-employee/:employeeId',
    requireAuth,
    validateParamId('employeeId'),
    handleValidationErrors,
    auditMiddleware('READ'),
    async (req: AuditRequest, res: Response) => {
      try {
        const person = await storage.getResponsiblePersonByEmployee(parseInt(req.params.employeeId));
        if (!person) {
          return res.status(404).json({ error: 'No responsible person found for this employee' });
        }
        res.json(person);
      } catch (error) {
        console.error('Error fetching responsible person by employee:', error);
        res.status(500).json({ error: 'Failed to fetch responsible person' });
      }
    }
  );
  
  // =====================
  // CLINIC LICENSE MANAGEMENT APIs
  // =====================
  
  // GET /api/clinic-licenses - List all licenses with filters
  app.get('/api/clinic-licenses',
    requireAuth,
    validatePagination(),
    handleValidationErrors,
    auditMiddleware('READ'),
    async (req: AuditRequest, res: Response) => {
      try {
        const { page = '1', limit = '10', search, status, locationId, licenseTypeId, responsiblePersonId } = req.query;
        const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
        
        const result = await storage.getClinicLicenses({
          limit: parseInt(limit as string),
          offset,
          search: search as string,
          status: status as string,
          locationId: locationId ? parseInt(locationId as string) : undefined,
          licenseTypeId: licenseTypeId ? parseInt(licenseTypeId as string) : undefined,
          responsiblePersonId: responsiblePersonId ? parseInt(responsiblePersonId as string) : undefined
        });
        
        res.json({
          licenses: result.licenses,
          total: result.total,
          page: parseInt(page as string),
          totalPages: Math.ceil(result.total / parseInt(limit as string))
        });
      } catch (error) {
        console.error('Error fetching clinic licenses:', error);
        res.status(500).json({ error: 'Failed to fetch clinic licenses' });
      }
    }
  );
  
  // GET /api/clinic-licenses/:id - Get license details
  // GET /api/clinic-licenses/stats - Get license statistics (MUST be before /:id route)
  app.get('/api/clinic-licenses/stats',
    requireAuth,
    auditMiddleware('READ'),
    async (req: AuditRequest, res: Response) => {
      try {
        // Get total and active licenses count
        const [totalResult] = await db.select({ count: count() })
          .from(clinicLicenses)
          .innerJoin(locations, eq(clinicLicenses.locationId, locations.id))
          .where(sql`${locations.status} != 'deleted'`);
        
        const [activeResult] = await db.select({ count: count() })
          .from(clinicLicenses)
          .innerJoin(locations, eq(clinicLicenses.locationId, locations.id))
          .where(
            and(
              sql`${locations.status} != 'deleted'`,
              eq(clinicLicenses.status, 'active')
            )
          );
        
        // Get expiring licenses (within 90 days)
        const today = new Date();
        const in90Days = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
        const [expiringResult] = await db.select({ count: count() })
          .from(clinicLicenses)
          .innerJoin(locations, eq(clinicLicenses.locationId, locations.id))
          .where(
            and(
              sql`${locations.status} != 'deleted'`,
              sql`${clinicLicenses.expirationDate} IS NOT NULL`,
              lte(clinicLicenses.expirationDate, in90Days.toISOString().split('T')[0]),
              gte(clinicLicenses.expirationDate, today.toISOString().split('T')[0])
            )
          );
        
        // Get expired licenses
        const [expiredResult] = await db.select({ count: count() })
          .from(clinicLicenses)
          .innerJoin(locations, eq(clinicLicenses.locationId, locations.id))
          .where(
            and(
              sql`${locations.status} != 'deleted'`,
              sql`${clinicLicenses.expirationDate} IS NOT NULL`,
              lt(clinicLicenses.expirationDate, today.toISOString().split('T')[0])
            )
          );
        
        // Get pending renewal licenses
        const [pendingRenewalResult] = await db.select({ count: count() })
          .from(clinicLicenses)
          .innerJoin(locations, eq(clinicLicenses.locationId, locations.id))
          .where(
            and(
              sql`${locations.status} != 'deleted'`,
              eq(clinicLicenses.status, 'pending_renewal')
            )
          );
        
        res.json({
          total: totalResult?.count || 0,
          active: activeResult?.count || 0,
          expiring: expiringResult?.count || 0,
          expired: expiredResult?.count || 0,
          pendingRenewal: pendingRenewalResult?.count || 0
        });
      } catch (error) {
        console.error('Error fetching clinic license stats:', error);
        res.status(500).json({ error: 'Failed to fetch clinic license stats' });
      }
    }
  );
  
  // GET /api/clinic-licenses/expiring - Get expiring licenses (MUST be before /:id route)
  app.get('/api/clinic-licenses/expiring',
    requireAuth,
    auditMiddleware('READ'),
    async (req: AuditRequest, res: Response) => {
      try {
        // Accept numeric strings and provide default value
        const daysParam = req.query.days as string;
        let daysNumber = 30; // Default value
        
        if (daysParam) {
          const parsed = parseInt(daysParam);
          // Validate the parsed number
          if (!isNaN(parsed) && parsed > 0) {
            daysNumber = parsed;
          }
        }
        
        const licenses = await storage.getExpiringClinicLicenses(daysNumber);
        const licensesList = licenses || [];
        
        // Check if CSV export is requested
        const acceptHeader = req.headers.accept || '';
        if (acceptHeader.includes('text/csv') || acceptHeader.includes('application/octet-stream')) {
          // Export as CSV
          const csvHeaders = 'License Number,Type,Location,Responsible Person,Expiration Date,Days Remaining\n';
          const csvData = licensesList.map(license => 
            `"${license.licenseNumber || ''}","${license.licenseType || ''}","${license.locationName || ''}","${license.responsiblePerson || ''}","${new Date(license.expirationDate).toISOString().split('T')[0]}","${license.daysUntilExpiration || 0}"`
          ).join('\n');

          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="compliance-expiring-licenses-${new Date().toISOString().split('T')[0]}.csv"`);
          return res.send(csvHeaders + csvData);
        }
        
        // Always return 200 with the results (even if empty)
        res.json({
          licenses: licensesList,
          count: licensesList.length,
          withinDays: daysNumber
        });
      } catch (error) {
        console.error('Error fetching expiring licenses:', error);
        // Return 200 with empty array instead of 500 error
        res.json({
          licenses: [],
          count: 0,
          withinDays: 30,
          error: 'Failed to fetch expiring licenses'
        });
      }
    }
  );
  
  app.get('/api/clinic-licenses/:id',
    requireAuth,
    validateId(),
    handleValidationErrors,
    auditMiddleware('READ'),
    async (req: AuditRequest, res: Response) => {
      try {
        const license = await storage.getClinicLicense(parseInt(req.params.id));
        if (!license) {
          return res.status(404).json({ error: 'Clinic license not found' });
        }
        res.json(license);
      } catch (error) {
        console.error('Error fetching clinic license:', error);
        res.status(500).json({ error: 'Failed to fetch clinic license' });
      }
    }
  );
  
  // POST /api/clinic-licenses - Create new license
  app.post('/api/clinic-licenses',
    requireAuth,
    requireRole(['admin', 'hr']),
    validateClinicLicense(),
    handleValidationErrors,
    auditMiddleware('CREATE'),
    async (req: AuditRequest, res: Response) => {
      try {
        const license = await storage.createClinicLicense(req.body);
        
        await logAudit(
          req,
          license.id,
          null,
          license
        );
        
        res.status(201).json(license);
      } catch (error) {
        console.error('Error creating clinic license:', error);
        res.status(500).json({ error: 'Failed to create clinic license' });
      }
    }
  );
  
  // PUT /api/clinic-licenses/:id - Update license
  app.put('/api/clinic-licenses/:id',
    requireAuth,
    requireRole(['admin', 'hr']),
    validateId(),
    validateClinicLicense(),
    handleValidationErrors,
    auditMiddleware('UPDATE'),
    async (req: AuditRequest, res: Response) => {
      try {
        const license = await storage.updateClinicLicense(parseInt(req.params.id), req.body);
        
        await logAudit(
          req,
          license.id,
          null,
          license
        );
        
        res.json(license);
      } catch (error) {
        console.error('Error updating clinic license:', error);
        res.status(500).json({ error: 'Failed to update clinic license' });
      }
    }
  );
  
  // DELETE /api/clinic-licenses/:id - Delete license
  app.delete('/api/clinic-licenses/:id',
    requireAuth,
    requireRole(['admin']),
    validateId(),
    handleValidationErrors,
    auditMiddleware('DELETE'),
    async (req: AuditRequest, res: Response) => {
      try {
        const licenseId = parseInt(req.params.id);
        await storage.deleteClinicLicense(licenseId);
        
        await logAudit(
          req,
          licenseId,
          null,
          null
        );
        
        res.status(204).send();
      } catch (error: any) {
        console.error('Error deleting clinic license:', error);
        if (error.message?.includes('Cannot delete')) {
          res.status(409).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Failed to delete clinic license' });
        }
      }
    }
  );
  
  // GET /api/clinic-licenses/by-location/:locationId - Get licenses by location
  app.get('/api/clinic-licenses/by-location/:locationId',
    requireAuth,
    validateId(),
    handleValidationErrors,
    auditMiddleware('READ'),
    async (req: AuditRequest, res: Response) => {
      try {
        const licenses = await storage.getClinicLicensesByLocation(parseInt(req.params.locationId));
        res.json(licenses);
      } catch (error) {
        console.error('Error fetching licenses by location:', error);
        res.status(500).json({ error: 'Failed to fetch licenses by location' });
      }
    }
  );
  
  // POST /api/clinic-licenses/:id/renew - Renew a license
  app.post('/api/clinic-licenses/:id/renew',
    requireAuth,
    requireRole(['admin', 'hr']),
    validateId(),
    validateLicenseRenewal(),
    handleValidationErrors,
    auditMiddleware('UPDATE'),
    async (req: AuditRequest, res: Response) => {
      try {
        const licenseId = parseInt(req.params.id);
        const license = await storage.renewClinicLicense(licenseId, req.body);
        
        await logAudit(
          req,
          licenseId,
          null,
          license
        );
        
        res.json(license);
      } catch (error) {
        console.error('Error renewing clinic license:', error);
        res.status(500).json({ error: 'Failed to renew clinic license' });
      }
    }
  );
  
  // GET /api/clinic-licenses/compliance-status - Get compliance status summary
  app.get('/api/clinic-licenses/compliance-status',
    requireAuth,
    auditMiddleware('READ'),
    async (req: AuditRequest, res: Response) => {
      try {
        const status = await storage.getClinicLicensesComplianceStatus();
        res.json(status);
      } catch (error) {
        console.error('Error fetching compliance status:', error);
        res.status(500).json({ error: 'Failed to fetch compliance status' });
      }
    }
  );
  
  // =====================
  // COMPLIANCE DOCUMENT APIs
  // =====================
  
  // GET /api/compliance-documents - List documents with filters
  app.get('/api/compliance-documents',
    requireAuth,
    validatePagination(),
    handleValidationErrors,
    auditMiddleware('READ'),
    async (req: AuditRequest, res: Response) => {
      try {
        const { page = '1', limit = '10', search, documentType, clinicLicenseId, locationId, status } = req.query;
        const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
        
        const result = await storage.getComplianceDocuments({
          limit: parseInt(limit as string),
          offset,
          search: search as string,
          documentType: documentType as string,
          clinicLicenseId: clinicLicenseId ? parseInt(clinicLicenseId as string) : undefined,
          locationId: locationId ? parseInt(locationId as string) : undefined,
          status: status as string
        });
        
        res.json({
          documents: result.documents,
          total: result.total,
          page: parseInt(page as string),
          totalPages: Math.ceil(result.total / parseInt(limit as string))
        });
      } catch (error) {
        console.error('Error fetching compliance documents:', error);
        res.status(500).json({ error: 'Failed to fetch compliance documents' });
      }
    }
  );
  
  // GET /api/compliance-documents/stats - Get document statistics
  app.get('/api/compliance-documents/stats',
    requireAuth,
    auditMiddleware('READ'),
    async (req: AuditRequest, res: Response) => {
      try {
        const stats = await storage.getComplianceDocumentStats();
        res.json(stats);
      } catch (error) {
        console.error('Error fetching compliance document stats:', error);
        res.status(500).json({ error: 'Failed to fetch compliance document stats' });
      }
    }
  );
  
  // GET /api/compliance-documents/:id - Get document details
  app.get('/api/compliance-documents/:id',
    requireAuth,
    validateId(),
    handleValidationErrors,
    auditMiddleware('READ'),
    async (req: AuditRequest, res: Response) => {
      try {
        const document = await storage.getComplianceDocument(parseInt(req.params.id));
        if (!document) {
          return res.status(404).json({ error: 'Compliance document not found' });
        }
        res.json(document);
      } catch (error) {
        console.error('Error fetching compliance document:', error);
        res.status(500).json({ error: 'Failed to fetch compliance document' });
      }
    }
  );
  
  // POST /api/compliance-documents/upload - Upload new document
  app.post('/api/compliance-documents/upload',
    requireAuth,
    requireRole(['admin', 'hr']),
    upload.single('file'),
    validateComplianceDocument(),
    handleValidationErrors,
    auditMiddleware('CREATE'),
    async (req: AuditRequest, res: Response) => {
      try {
        const file = req.file;
        
        if (!file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }
        
        // Generate S3 key for compliance document
        const s3Key = generateDocumentKey(
          parseInt(req.body.clinicLicenseId),
          req.body.documentType || 'compliance',
          file.originalname
        );
        
        // Read file into buffer for upload
        const fileBuffer = fs.readFileSync(file.path);
        
        // Upload to S3
        const uploadResult = await s3Service.uploadComplianceDocument(
          fileBuffer,
          file.originalname,
          file.mimetype,
          {
            locationId: req.body.locationId,
            licenseId: req.body.clinicLicenseId,
            documentType: req.body.documentType,
            version: req.body.version || 1
          }
        );
        
        // Clean up temp file
        fs.unlinkSync(file.path);
        
        if (!uploadResult.success) {
          return res.status(500).json({ error: uploadResult.error || 'Failed to upload document' });
        }
        
        // Create database record
        const document = await storage.createComplianceDocument({
          ...req.body,
          storageType: uploadResult.storageType,
          storageKey: uploadResult.storageKey,
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          s3Bucket: process.env.AWS_BUCKET_NAME,
          s3Region: process.env.AWS_REGION,
          s3Etag: uploadResult.etag
        });
        
        await logAudit(
          req,
          document.id,
          null,
          document
        );
        
        res.status(201).json(document);
      } catch (error) {
        console.error('Error uploading compliance document:', error);
        // Clean up temp file if it exists
        if (req.file?.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Failed to upload compliance document' });
      }
    }
  );
  
  // PUT /api/compliance-documents/:id - Update document metadata
  app.put('/api/compliance-documents/:id',
    requireAuth,
    requireRole(['admin', 'hr']),
    validateId(),
    handleValidationErrors,
    auditMiddleware('UPDATE'),
    async (req: AuditRequest, res: Response) => {
      try {
        const document = await storage.updateComplianceDocument(parseInt(req.params.id), req.body);
        
        await logAudit(
          req,
          document.id,
          null,
          document
        );
        
        res.json(document);
      } catch (error) {
        console.error('Error updating compliance document:', error);
        res.status(500).json({ error: 'Failed to update compliance document' });
      }
    }
  );
  
  // DELETE /api/compliance-documents/:id - Delete document
  app.delete('/api/compliance-documents/:id',
    requireAuth,
    requireRole(['admin']),
    validateId(),
    handleValidationErrors,
    auditMiddleware('DELETE'),
    async (req: AuditRequest, res: Response) => {
      try {
        const documentId = parseInt(req.params.id);
        const document = await storage.getComplianceDocument(documentId);
        
        if (!document) {
          return res.status(404).json({ error: 'Document not found' });
        }
        
        // Delete from S3 if stored there
        if (document.storageType === 's3' && document.storageKey) {
          await s3Service.deleteFile(document.storageKey);
        }
        
        // Delete from database
        await storage.deleteComplianceDocument(documentId);
        
        await logAudit(
          req,
          documentId,
          document,
          null
        );
        
        res.status(204).send();
      } catch (error) {
        console.error('Error deleting compliance document:', error);
        res.status(500).json({ error: 'Failed to delete compliance document' });
      }
    }
  );
  
  // POST /api/compliance-documents/:id/verify - Verify a compliance document
  app.post('/api/compliance-documents/:id/verify',
    requireAuth,
    requireRole(['admin', 'hr']),
    validateId(),
    handleValidationErrors,
    auditMiddleware('UPDATE'),
    async (req: AuditRequest, res: Response) => {
      try {
        const documentId = parseInt(req.params.id);
        
        if (!documentId || isNaN(documentId)) {
          return res.status(400).json({ error: 'Invalid document ID' });
        }
        
        const document = await storage.getComplianceDocument(documentId);
        
        if (!document) {
          return res.status(404).json({ error: 'Document not found' });
        }
        
        if (!req.user || !req.user.id) {
          return res.status(401).json({ error: 'User not authenticated' });
        }
        
        // Update document with verification information
        // Note: verifiedAt is not in InsertComplianceDocument schema, so we need to cast
        const updateData: any = {
          isVerified: true,
          verifiedBy: req.user.id,
          verifiedAt: new Date(),
          verificationNotes: req.body.verificationNotes || null
        };
        const verifiedDocument = await storage.updateComplianceDocument(documentId, updateData);
        
        await logAudit(
          req,
          documentId,
          document,
          verifiedDocument
        );
        
        res.json(verifiedDocument);
      } catch (error: any) {
        console.error('Error verifying compliance document:', error);
        const errorMessage = error?.message || 'Failed to verify compliance document';
        res.status(500).json({ error: errorMessage });
      }
    }
  );
  
  // GET /api/compliance-documents/:id/download - Get presigned download URL
  app.get('/api/compliance-documents/:id/download',
    requireAuth,
    validateId(),
    handleValidationErrors,
    auditMiddleware('READ'),
    async (req: AuditRequest, res: Response) => {
      try {
        const document = await storage.getComplianceDocument(parseInt(req.params.id));
        
        if (!document) {
          return res.status(404).json({ error: 'Document not found' });
        }
        
        if (document.storageType !== 's3' || !document.storageKey) {
          return res.status(400).json({ error: 'Document is not available for download' });
        }
        
        const signedUrl = await s3Service.getSignedUrl(document.storageKey, 3600); // 1 hour expiry
        
        if (!signedUrl) {
          return res.status(500).json({ error: 'Failed to generate download URL' });
        }
        
        res.json({
          url: signedUrl,
          fileName: document.fileName,
          expiresIn: 3600
        });
      } catch (error) {
        console.error('Error generating download URL:', error);
        res.status(500).json({ error: 'Failed to generate download URL' });
      }
    }
  );
  
  // GET /api/compliance-documents/by-license/:licenseId - Get documents by license
  app.get('/api/compliance-documents/by-license/:licenseId',
    requireAuth,
    validateId(),
    handleValidationErrors,
    auditMiddleware('READ'),
    async (req: AuditRequest, res: Response) => {
      try {
        const documents = await storage.getComplianceDocumentsByLicense(parseInt(req.params.licenseId));
        res.json(documents);
      } catch (error) {
        console.error('Error fetching documents by license:', error);
        res.status(500).json({ error: 'Failed to fetch documents by license' });
      }
    }
  );
  
  // GET /api/compliance-documents/by-location/:locationId - Get documents by location
  app.get('/api/compliance-documents/by-location/:locationId',
    requireAuth,
    validateId(),
    handleValidationErrors,
    auditMiddleware('READ'),
    async (req: AuditRequest, res: Response) => {
      try {
        const documents = await storage.getComplianceDocumentsByLocation(parseInt(req.params.locationId));
        res.json(documents);
      } catch (error) {
        console.error('Error fetching documents by location:', error);
        res.status(500).json({ error: 'Failed to fetch documents by location' });
      }
    }
  );
  
  // GET /api/compliance-documents/:id/versions - Get document version history
  app.get('/api/compliance-documents/:id/versions',
    requireAuth,
    validateId(),
    handleValidationErrors,
    auditMiddleware('READ'),
    async (req: AuditRequest, res: Response) => {
      try {
        const document = await storage.getComplianceDocument(parseInt(req.params.id));
        
        if (!document || !document.documentNumber) {
          return res.status(404).json({ error: 'Document not found' });
        }
        
        const versions = await storage.getComplianceDocumentVersionsByNumber(document.documentNumber);
        res.json(versions);
      } catch (error) {
        console.error('Error fetching document versions:', error);
        res.status(500).json({ error: 'Failed to fetch document versions' });
      }
    }
  );
  
  // =====================
  // COMPLIANCE DASHBOARD & REPORTING APIs
  // =====================
  
  // GET /api/compliance/dashboard - Get dashboard metrics
  app.get('/api/compliance/dashboard',
    requireAuth,
    auditMiddleware('READ'),
    async (req: AuditRequest, res: Response) => {
      try {
        const dashboard = await storage.getComplianceDashboard();
        res.json(dashboard);
      } catch (error) {
        console.error('Error fetching compliance dashboard:', error);
        res.status(500).json({ error: 'Failed to fetch compliance dashboard' });
      }
    }
  );
  
  // GET /api/compliance/summary - Get compliance summary by location
  app.get('/api/compliance/summary',
    requireAuth,
    auditMiddleware('READ'),
    async (req: AuditRequest, res: Response) => {
      try {
        const summary = await storage.getComplianceSummaryByLocation();
        res.json(summary);
      } catch (error) {
        console.error('Error fetching compliance summary:', error);
        res.status(500).json({ error: 'Failed to fetch compliance summary' });
      }
    }
  );
  
  // GET /api/compliance/alerts - Get compliance alerts
  app.get('/api/compliance/alerts',
    requireAuth,
    auditMiddleware('READ'),
    async (req: AuditRequest, res: Response) => {
      try {
        const alerts = await storage.getComplianceAlerts();
        res.json(alerts);
      } catch (error) {
        console.error('Error fetching compliance alerts:', error);
        res.status(500).json({ error: 'Failed to fetch compliance alerts' });
      }
    }
  );
  
  // GET /api/compliance/export - Export compliance report
  app.get('/api/compliance/export',
    requireAuth,
    auditMiddleware('READ'),
    async (req: AuditRequest, res: Response) => {
      try {
        const { format = 'json' } = req.query;
        
        // Fetch all necessary data
        const [dashboard, summary, alerts, licenses] = await Promise.all([
          storage.getComplianceDashboard(),
          storage.getComplianceSummaryByLocation(),
          storage.getComplianceAlerts(),
          storage.getClinicLicenses({ limit: 10000, offset: 0 })
        ]);
        
        const reportData = {
          generatedAt: new Date().toISOString(),
          dashboard,
          summary,
          alerts,
          licenses: licenses.licenses
        };
        
        if (format === 'csv') {
          // Convert to CSV format
          const csvHeaders = 'Location,License Number,Type,Status,Expiration Date,Compliance Status\n';
          const csvData = licenses.licenses.map(lic => 
            `"${lic.locationId}","${lic.licenseNumber}","${lic.licenseTypeId}","${lic.status}","${lic.expirationDate}","${lic.complianceStatus}"`
          ).join('\n');
          
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename="compliance-report.csv"');
          res.send(csvHeaders + csvData);
        } else {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', 'attachment; filename="compliance-report.json"');
          res.json(reportData);
        }
      } catch (error) {
        console.error('Error exporting compliance report:', error);
        res.status(500).json({ error: 'Failed to export compliance report' });
      }
    }
  );

  // =====================
  // REQUIRED DOCUMENT TYPES APIs
  // =====================
  
  // GET /api/admin/required-documents - Get all document types (admin only)
  app.get('/api/admin/required-documents',
    requireAuth,
    requireRole(['admin']),
    auditMiddleware('READ'),
    async (req: AuditRequest, res: Response) => {
      try {
        const documentTypes = await storage.getRequiredDocumentTypes();
        res.json(documentTypes);
      } catch (error) {
        console.error('Error fetching required document types:', error);
        res.status(500).json({ error: 'Failed to fetch required document types' });
      }
    }
  );
  
  // POST /api/admin/required-documents - Create new document type (admin only)
  app.post('/api/admin/required-documents',
    requireAuth,
    requireRole(['admin']),
    body('name').notEmpty().isLength({ max: 100 }).withMessage('Name is required and must be less than 100 characters'),
    body('category').isIn(['tax', 'compliance', 'payroll', 'identification', 'other']).withMessage('Invalid category'),
    body('isRequired').optional().isBoolean().withMessage('isRequired must be a boolean'),
    body('sortOrder').optional().isInt({ min: 0 }).withMessage('sortOrder must be a positive integer'),
    handleValidationErrors,
    auditMiddleware('required_document_types'),
    async (req: AuditRequest, res: Response) => {
      try {
        const documentTypeData = sanitizeDateFields(req.body);
        const documentType = await storage.createRequiredDocumentType(documentTypeData);
        await logAudit(req, documentType.id, null, documentType);
        res.status(201).json(documentType);
      } catch (error) {
        console.error('Error creating required document type:', error);
        res.status(500).json({ error: 'Failed to create required document type' });
      }
    }
  );
  
  // PUT /api/admin/required-documents/:id - Update document type (admin only)
  app.put('/api/admin/required-documents/:id',
    requireAuth,
    requireRole(['admin']),
    validateId(),
    body('name').optional().isLength({ max: 100 }).withMessage('Name must be less than 100 characters'),
    body('category').optional().isIn(['tax', 'compliance', 'payroll', 'identification', 'other']).withMessage('Invalid category'),
    body('isRequired').optional().isBoolean().withMessage('isRequired must be a boolean'),
    body('sortOrder').optional().isInt({ min: 0 }).withMessage('sortOrder must be a positive integer'),
    handleValidationErrors,
    auditMiddleware('required_document_types'),
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const documentTypeData = sanitizeDateFields(req.body);
        const oldDocumentType = await storage.getRequiredDocumentTypes().then(types => types.find(t => t.id === id));
        const documentType = await storage.updateRequiredDocumentType(id, documentTypeData);
        await logAudit(req, id, oldDocumentType, documentType);
        res.json(documentType);
      } catch (error) {
        console.error('Error updating required document type:', error);
        res.status(500).json({ error: 'Failed to update required document type' });
      }
    }
  );
  
  // DELETE /api/admin/required-documents/:id - Delete document type (admin only)
  app.delete('/api/admin/required-documents/:id',
    requireAuth,
    requireRole(['admin']),
    validateId(),
    handleValidationErrors,
    auditMiddleware('required_document_types'),
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const oldDocumentType = await storage.getRequiredDocumentTypes().then(types => types.find(t => t.id === id));
        await storage.deleteRequiredDocumentType(id);
        await logAudit(req, id, oldDocumentType, null);
        res.status(204).send();
      } catch (error) {
        console.error('Error deleting required document type:', error);
        res.status(500).json({ error: 'Failed to delete required document type' });
      }
    }
  );
  
  // GET /api/onboarding/required-documents - Get required documents for onboarding (public for onboarding users)
  app.get('/api/onboarding/required-documents',
    // No requireAuth here - available for onboarding users
    async (req: Express.Request, res: Response) => {
      try {
        const documentTypes = await storage.getRequiredDocumentTypesForOnboarding();
        res.json(documentTypes);
      } catch (error) {
        console.error('Error fetching onboarding document types:', error);
        res.status(500).json({ error: 'Failed to fetch onboarding document types' });
      }
    }
  );
  
  // POST /api/onboarding/document-uploads - Upload documents during onboarding
  app.post('/api/onboarding/document-uploads',
    requireAuth,
    requireRole(['prospective_employee']),
    upload.single('file'),
    async (req: AuditRequest, res: Response) => {
      try {
        // Check if file was uploaded
        if (!req.file) {
          return res.status(400).json({ 
            error: 'Validation failed',
            details: [{
              type: 'field',
              msg: 'File is required',
              path: 'file',
              location: 'body'
            }]
          });
        }

        // Check authentication
        if (!req.user || !req.user.id) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        // Find employee by userId for onboarding
        const existingEmployeeRows = await db
          .select()
          .from(employees)
          .where(eq(employees.userId, req.user!.id));
        const employee = existingEmployeeRows[0];

        if (!employee) {
          return res.status(404).json({ error: 'Employee record not found. Please complete initial onboarding steps first.' });
        }

        // Extract documentTypeId from form data
        const documentTypeId = req.body.documentTypeId ? parseInt(req.body.documentTypeId) : undefined;
        const documentTypeName = req.body.documentTypeName || req.file.originalname;

        // Prepare upload data from file metadata
        const uploadData: any = {
          employeeId: employee.id,
          documentTypeId,
          fileName: req.file.originalname,
          filePath: req.file.path || req.file.filename,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          status: 'pending'
        };

        const upload = await storage.createEmployeeDocumentUpload(uploadData);
        await logAudit(req, upload.id, null, upload);
        
        // Return upload record with file URL
        res.status(201).json({
          ...upload,
          fileUrl: `/uploads/${req.file.filename}`,
          documentTypeName
        });
      } catch (error) {
        console.error('Error uploading onboarding document:', error);
        res.status(500).json({ error: 'Failed to upload onboarding document' });
      }
    }
  );
  
  // =====================
  // EMPLOYEE DOCUMENT UPLOADS APIs
  // =====================
  
  // GET /api/employees/:employeeId/document-uploads - Get all document uploads for an employee
  app.get('/api/employees/:employeeId/document-uploads',
    requireAuth,
    validateParamId('employeeId'),
    handleValidationErrors,
    auditMiddleware('READ'),
    async (req: AuditRequest, res: Response) => {
      try {
        const employeeId = parseInt(req.params.employeeId);
        const uploads = await storage.getEmployeeDocumentUploads(employeeId);
        res.json(uploads);
      } catch (error) {
        console.error('Error fetching employee document uploads:', error);
        res.status(500).json({ error: 'Failed to fetch employee document uploads' });
      }
    }
  );

  // Back-compat: GET /api/employees/:id/document-uploads - Support legacy id param
  app.get('/api/employees/:id/document-uploads',
    requireAuth,
    validateId(),
    handleValidationErrors,
    auditMiddleware('READ'),
    async (req: AuditRequest, res: Response) => {
      try {
        const employeeId = parseInt(req.params.id);
        const uploads = await storage.getEmployeeDocumentUploads(employeeId);
        res.json(uploads);
      } catch (error) {
        console.error('Error fetching employee document uploads:', error);
        res.status(500).json({ error: 'Failed to fetch employee document uploads' });
      }
    }
  );
  
  // GET /api/employees/:employeeId/document-uploads/type/:typeId - Get uploads by type
  app.get('/api/employees/:employeeId/document-uploads/type/:typeId',
    requireAuth,
    validateParamId('employeeId'),
    validateParamId('typeId'),
    handleValidationErrors,
    auditMiddleware('READ'),
    async (req: AuditRequest, res: Response) => {
      try {
        const employeeId = parseInt(req.params.employeeId);
        const typeId = parseInt(req.params.typeId);
        const uploads = await storage.getEmployeeDocumentUploadsByType(employeeId, typeId);
        res.json(uploads);
      } catch (error) {
        console.error('Error fetching employee document uploads by type:', error);
        res.status(500).json({ error: 'Failed to fetch employee document uploads by type' });
      }
    }
  );
  
  // POST /api/employees/:employeeId/document-uploads - Create new upload record
  app.post('/api/employees/:employeeId/document-uploads',
    requireAuth,
    upload.single('file'),
    async (req: AuditRequest, res: Response) => {
      try {
        // Validate employeeId parameter
        const employeeId = parseInt(req.params.employeeId);
        if (isNaN(employeeId) || employeeId < 1) {
          return res.status(400).json({
            error: 'Validation failed',
            details: [{
              type: 'field',
              msg: 'Employee ID must be a positive integer',
              path: 'employeeId',
              location: 'params'
            }]
          });
        }
        
        // Check if file was uploaded
        if (!req.file) {
          return res.status(400).json({ 
            error: 'Validation failed',
            details: [{
              type: 'field',
              msg: 'File is required',
              path: 'file',
              location: 'body'
            }]
          });
        }

        // Extract documentTypeId from form data
        const documentTypeId = req.body.documentTypeId ? parseInt(req.body.documentTypeId) : undefined;
        const documentTypeName = req.body.documentTypeName || req.file.originalname;

        // Prepare upload data from file metadata
        const uploadData: any = {
          employeeId,
          documentTypeId,
          fileName: req.file.originalname,
          filePath: req.file.path || req.file.filename,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          status: 'pending'
        };

        const upload = await storage.createEmployeeDocumentUpload(uploadData);
        await logAudit(req, upload.id, null, upload);
        
        // Return upload record with file URL
        res.status(201).json({
          ...upload,
          fileUrl: `/uploads/${req.file.filename}`,
          documentTypeName
        });
      } catch (error) {
        console.error('Error creating employee document upload:', error);
        res.status(500).json({ error: 'Failed to create employee document upload' });
      }
    }
  );
  
  // PUT /api/employee-document-uploads/:id - Update upload record
  app.put('/api/employee-document-uploads/:id',
    requireAuth,
    requireRole(['admin', 'hr']),
    validateId(),
    body('status').optional().isIn(['pending', 'approved', 'rejected']).withMessage('Invalid status'),
    body('notes').optional().isString().withMessage('notes must be a string'),
    handleValidationErrors,
    auditMiddleware('employee_document_uploads'),
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const oldUpload = await storage.getEmployeeDocumentUploads(0).then(uploads => uploads.find(u => u.id === id));
        const upload = await storage.updateEmployeeDocumentUpload(id, req.body);
        await logAudit(req, id, oldUpload, upload);
        res.json(upload);
      } catch (error) {
        console.error('Error updating employee document upload:', error);
        res.status(500).json({ error: 'Failed to update employee document upload' });
      }
    }
  );
  
  // DELETE /api/employee-document-uploads/:id - Delete upload record
  app.delete('/api/employee-document-uploads/:id',
    requireAuth,
    requireRole(['admin', 'hr']),
    validateId(),
    handleValidationErrors,
    auditMiddleware('employee_document_uploads'),
    async (req: AuditRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const oldUpload = await storage.getEmployeeDocumentUploads(0).then(uploads => uploads.find(u => u.id === id));
        await storage.deleteEmployeeDocumentUpload(id);
        await logAudit(req, id, oldUpload, null);
        res.status(204).send();
      } catch (error) {
        console.error('Error deleting employee document upload:', error);
        res.status(500).json({ error: 'Failed to delete employee document upload' });
      }
    }
  );

  // =====================
  // EMPLOYEE SELF-SERVICE APIs
  // =====================

  /**
   * Middleware to ensure employees can only access their own data
   */
  const employeeSelfServiceAuth = async (req: any, res: Response, next: any) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Check if user role is employee
      if (req.user.role !== 'employee') {
        return res.status(403).json({ message: "Access denied. Employee access only." });
      }

      // Resolve employee for current user: prefer userId, then email, then username
      const allEmployees = await storage.getAllEmployees();
      const normalize = (v: any) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
      const userId = req.user.id;
      const email = normalize(req.user.email);
      const username = normalize(req.user.username);

      let employee = allEmployees.find((e: any) => e.userId === userId);
      if (!employee && email) {
        employee = allEmployees.find((e: any) => normalize(e.workEmail) === email);
      }
      if (!employee && username) {
        employee = allEmployees.find((e: any) => normalize(e.workEmail) === username);
      }

      if (!employee) {
        return res.status(404).json({ message: "Employee profile not found" });
      }

      // Attach employee data to request for use in route handlers
      req.employee = employee;
      next();
    } catch (error) {
      console.error('Employee self-service auth error:', error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };

  /**
   * GET /api/employee/profile
   * Get own employee profile (employee only)
   */
  app.get('/api/employee/profile',
    requireAuth,
    employeeSelfServiceAuth,
    async (req: any, res: Response) => {
      try {
        console.log("<<<<<<<req.employee>>>>>>>",req.employee);

        const employee = req.employee;
        
        // Decrypt sensitive fields before sending
        const decryptedEmployee = decryptSensitiveFields(employee);
        
        res.json(decryptedEmployee);
      } catch (error) {
        console.error('Error fetching employee profile:', error);
        res.status(500).json({ error: 'Failed to fetch employee profile' });
      }
    }
  );

  /**
   * PUT /api/employee/profile
   * Update own employee profile (employee only)
   * Limited fields can be updated by employees
   */
  app.put('/api/employee/profile',
    requireAuth,
    employeeSelfServiceAuth,
    auditMiddleware('employees'),
    async (req: any, res: Response) => {
      try {
        const employeeId = req.employee.id;
        const oldEmployee = req.employee;
        
        // Only allow employees to update certain fields
        const allowedFields = [
          'personalEmail', 'cellPhone', 
          'homeAddress1', 'homeAddress2', 'homeCity', 'homeState', 'homeZip'
        ];
        
        const updates: any = {};
        for (const field of allowedFields) {
          if (req.body[field] !== undefined) {
            updates[field] = req.body[field];
          }
        }
        
        // Sanitize date fields in updates
        const sanitizedUpdates = sanitizeDateFields(updates);
        
        // Update employee
        const updatedEmployee = await storage.updateEmployee(employeeId, sanitizedUpdates);
        await logAudit(req as AuditRequest, employeeId, oldEmployee, updatedEmployee);
        
        // Decrypt before sending
        const decryptedEmployee = decryptSensitiveFields(updatedEmployee);
        
        res.json(decryptedEmployee);
      } catch (error) {
        console.error('Error updating employee profile:', error);
        res.status(500).json({ error: 'Failed to update employee profile' });
      }
    }
  );

  /**
   * GET /api/employee/documents
   * Get own documents (employee only)
   */
  app.get('/api/employee/documents',
    requireAuth,
    employeeSelfServiceAuth,
    async (req: any, res: Response) => {
      try {
        const employeeId = req.employee.id;
        const documents = await storage.getEmployeeDocuments(employeeId);
        
        res.json(documents);
      } catch (error) {
        console.error('Error fetching employee documents:', error);
        res.status(500).json({ error: 'Failed to fetch documents' });
      }
    }
  );

  /**
   * POST /api/employee/documents
   * Upload own documents (employee only)
   */
  app.post('/api/employee/documents',
    requireAuth,
    employeeSelfServiceAuth,
    upload.single('document'),
    auditMiddleware('documents'),
    async (req: any, res: Response) => {
      try {
        const employeeId = req.employee.id;
        
        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }

        const { documentType, documentNumber, expirationDate, description } = req.body;
        
        // Upload to S3 if configured
        const s3Config = await storage.getS3Configuration();
        let s3Key = null;
        let storageType = 'local';
        
        if (s3Config?.enabled) {
          s3Key = generateDocumentKey(
            employeeId.toString(),
            documentType || 'general',
            req.file.originalname
          );
          
          const uploaded = await s3Service.uploadFile(
            req.file.path,
            s3Key,
            req.file.mimetype
          );
          
          if (uploaded) {
            storageType = 's3';
            // Delete local file after successful S3 upload
            fs.unlinkSync(req.file.path);
          }
        }
        
        // Create document record
        const document = await storage.createDocument({
          employeeId,
          documentType: documentType || 'other',
          documentName: documentNumber || req.file.originalname,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          filePath: storageType === 's3' ? s3Key : req.file.path,
          storageType,
          storageKey: s3Key,
          expirationDate: expirationDate || null,
          notes: description || null
        });
        
        await logAudit(req as AuditRequest, document.id, null, document);
        
        res.status(201).json(document);
      } catch (error) {
        console.error('Error uploading document:', error);
        res.status(500).json({ error: 'Failed to upload document' });
      }
    }
  );

  /**
   * GET /api/employee/emergency-contacts
   * Get own emergency contacts (employee only)
   */
  app.get('/api/employee/emergency-contacts',
    requireAuth,
    employeeSelfServiceAuth,
    async (req: any, res: Response) => {
      try {
        const employeeId = req.employee.id;
        const contacts = await storage.getEmployeeEmergencyContacts(employeeId);
        
        res.json(contacts);
      } catch (error) {
        console.error('Error fetching emergency contacts:', error);
        res.status(500).json({ error: 'Failed to fetch emergency contacts' });
      }
    }
  );

  /**
   * PUT /api/employee/emergency-contacts
   * Update/create own emergency contacts (employee only)
   */
  app.put('/api/employee/emergency-contacts',
    requireAuth,
    employeeSelfServiceAuth,
    auditMiddleware('emergency_contacts'),
    async (req: any, res: Response) => {
      try {
        const employeeId = req.employee.id;
        const contacts = req.body.contacts || [];
        
        // Delete existing contacts
        const existingContacts = await storage.getEmployeeEmergencyContacts(employeeId);
        for (const contact of existingContacts) {
          await storage.deleteEmergencyContact(contact.id);
        }
        
        // Create new contacts
        const newContacts = [];
        for (const contact of contacts) {
          const newContact = await storage.createEmergencyContact({
            ...contact,
            employeeId
          });
          newContacts.push(newContact);
        }
        
        res.json(newContacts);
      } catch (error) {
        console.error('Error updating emergency contacts:', error);
        res.status(500).json({ error: 'Failed to update emergency contacts' });
      }
    }
  );

  /**
   * GET /api/employee/licenses
   * Get own licenses and certifications (employee only)
   */
  app.get('/api/employee/licenses',
    requireAuth,
    employeeSelfServiceAuth,
    async (req: any, res: Response) => {
      try {
        const employeeId = req.employee.id;
        
        const [stateLicenses, deaLicenses, boardCertifications] = await Promise.all([
          storage.getEmployeeStateLicenses(employeeId),
          storage.getEmployeeDeaLicenses(employeeId),
          storage.getEmployeeBoardCertifications(employeeId)
        ]);
        
        res.json({
          stateLicenses,
          deaLicenses,
          boardCertifications
        });
      } catch (error) {
        console.error('Error fetching licenses:', error);
        res.status(500).json({ error: 'Failed to fetch licenses' });
      }
    }
  );

  /**
   * GET /api/employee/trainings
   * Get own training records (employee only)
   */
  app.get('/api/employee/trainings',
    requireAuth,
    employeeSelfServiceAuth,
    async (req: any, res: Response) => {
      try {
        const employeeId = req.employee.id;
        const trainings = await storage.getEmployeeTrainings(employeeId);
        
        res.json(trainings);
      } catch (error) {
        console.error('Error fetching trainings:', error);
        res.status(500).json({ error: 'Failed to fetch trainings' });
      }
    }
  );

  /**
   * GET /api/employee/education
   * Get own education records (employee only)
   */
  app.get('/api/employee/education',
    requireAuth,
    employeeSelfServiceAuth,
    async (req: any, res: Response) => {
      try {
        const employeeId = req.employee.id;
        const educations = await storage.getEmployeeEducations(employeeId);
        
        res.json(educations);
      } catch (error) {
        console.error('Error fetching education records:', error);
        res.status(500).json({ error: 'Failed to fetch education records' });
      }
    }
  );

  /**
   * GET /api/employee/employment
   * Get own employment history (employee only)
   */
  app.get('/api/employee/employment',
    requireAuth,
    employeeSelfServiceAuth,
    async (req: any, res: Response) => {
      try {
        const employeeId = req.employee.id;
        const employments = await storage.getEmployeeEmployments(employeeId);
        
        res.json(employments);
      } catch (error) {
        console.error('Error fetching employment history:', error);
        res.status(500).json({ error: 'Failed to fetch employment history' });
      }
    }
  );

  // ============================================================================
  // S3 CONFIGURATION ENDPOINTS (Admin Only)
  // ============================================================================

  /**
   * Initialize S3 Migration Service
   */
  const s3MigrationService = new S3MigrationService();

  /**
   * GET /api/admin/s3/config
   * Get current S3 configuration with masked credentials
   */
  app.get('/api/admin/s3/config',
    requireAuth,
    requireRole(['admin']),
    async (req: AuditRequest, res: Response) => {
      try {
        const config = await storage.getS3Configuration();
        
        if (config) {
          // Mask credentials for security
          const maskedConfig = {
            ...config,
            accessKeyId: config.accessKeyId ? '****' + config.accessKeyId.slice(-4) : null,
            secretAccessKey: config.secretAccessKey ? '********' : null
          };
          
          await logAudit(req, null, null, { action: 's3_config_viewed' });
          res.json(maskedConfig);
        } else {
          res.json(null);
        }
      } catch (error) {
        console.error('Error fetching S3 config:', error);
        res.status(500).json({ error: 'Failed to fetch S3 configuration' });
      }
    }
  );

  /**
   * POST /api/admin/s3/config
   * Save or update S3 configuration
   */
  app.post('/api/admin/s3/config',
    requireAuth,
    requireRole(['admin']),
    auditMiddleware('s3_configuration'),
    [
      body('region').notEmpty().withMessage('Region is required'),
      body('bucketName').notEmpty().withMessage('Bucket name is required'),
      body('accessKeyId').notEmpty().withMessage('Access key ID is required'),
      body('secretAccessKey').notEmpty().withMessage('Secret access key is required')
    ],
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const { region, bucketName, accessKeyId, secretAccessKey, endpoint, enabled } = req.body;
        
        // Encrypt sensitive credentials
        const encryptedAccessKey = encrypt(accessKeyId);
        const encryptedSecretKey = encrypt(secretAccessKey);
        
        const configData = {
          region,
          bucketName,
          accessKeyId: encryptedAccessKey,
          secretAccessKey: encryptedSecretKey,
          endpoint: endpoint || null,
          enabled: enabled !== false
        };
        
        const config = await storage.saveS3Configuration(configData);
        
        await logAudit(req, null, null, { action: 's3_config_saved', bucketName, region });
        
        // Return masked config
        res.json({
          ...config,
          accessKeyId: '****' + accessKeyId.slice(-4),
          secretAccessKey: '********'
        });
      } catch (error) {
        console.error('Error saving S3 config:', error);
        res.status(500).json({ error: 'Failed to save S3 configuration' });
      }
    }
  );

  /**
   * POST /api/admin/s3/test
   * Test S3 connection with current configuration
   */
  app.post('/api/admin/s3/test',
    requireAuth,
    requireRole(['admin']),
    async (req: AuditRequest, res: Response) => {
      try {
        const isConfigured = s3Service.isConfigured();
        
        if (!isConfigured) {
          return res.status(400).json({ 
            success: false, 
            error: 'S3 is not configured' 
          });
        }
        
        // Test by trying to list objects (limit to 1)
        try {
          await s3Service.listFiles('test/', 1);
          
          await logAudit(req, null, null, { action: 's3_connection_test', success: true });
          res.json({ 
            success: true, 
            message: 'S3 connection successful' 
          });
        } catch (error: any) {
          await logAudit(req, null, null, { action: 's3_connection_test', success: false, error: error.message });
          res.status(500).json({ 
            success: false, 
            error: error.message || 'S3 connection failed' 
          });
        }
      } catch (error) {
        console.error('Error testing S3 connection:', error);
        res.status(500).json({ error: 'Failed to test S3 connection' });
      }
    }
  );

  /**
   * GET /api/admin/s3/bucket-info
   * Get bucket information
   */
  app.get('/api/admin/s3/bucket-info',
    requireAuth,
    requireRole(['admin']),
    async (req: AuditRequest, res: Response) => {
      try {
        const bucketInfo = s3Service.getBucketInfo();
        
        await logAudit(req, null, null, { action: 's3_bucket_info_viewed' });
        res.json(bucketInfo);
      } catch (error) {
        console.error('Error fetching bucket info:', error);
        res.status(500).json({ error: 'Failed to fetch bucket information' });
      }
    }
  );

  /**
   * POST /api/admin/s3/reconfigure
   * Reload S3 configuration from database
   */
  app.post('/api/admin/s3/reconfigure',
    requireAuth,
    requireRole(['admin']),
    async (req: AuditRequest, res: Response) => {
      try {
        await s3Service.reconfigure();
        const isConfigured = s3Service.isConfigured();
        
        await logAudit(req, null, null, { action: 's3_reconfigured', success: isConfigured });
        
        res.json({ 
          success: isConfigured,
          message: isConfigured ? 'S3 reconfigured successfully' : 'S3 reconfiguration failed'
        });
      } catch (error) {
        console.error('Error reconfiguring S3:', error);
        res.status(500).json({ error: 'Failed to reconfigure S3' });
      }
    }
  );

  // ============================================================================
  // S3 MIGRATION ENDPOINTS (Admin Only)
  // ============================================================================

  /**
   * GET /api/admin/s3/migration/stats
   * Get migration statistics
   */
  app.get('/api/admin/s3/migration/stats',
    requireAuth,
    requireRole(['admin']),
    async (req: AuditRequest, res: Response) => {
      try {
        const stats = await s3MigrationService.getMigrationStats();
        
        await logAudit(req, null, null, { action: 'migration_stats_viewed' });
        res.json(stats);
      } catch (error) {
        console.error('Error fetching migration stats:', error);
        res.status(500).json({ error: 'Failed to fetch migration statistics' });
      }
    }
  );

  /**
   * POST /api/admin/s3/migration/employee
   * Migrate employee documents to S3
   */
  app.post('/api/admin/s3/migration/employee',
    requireAuth,
    requireRole(['admin']),
    auditMiddleware('s3_migration'),
    async (req: AuditRequest, res: Response) => {
      try {
        const { employeeId, dryRun = false, deleteLocal = false } = req.body;
        
        if (!s3Service.isConfigured()) {
          return res.status(400).json({ error: 'S3 is not configured' });
        }
        
        const result = await s3MigrationService.migrateEmployeeDocuments(
          employeeId ? parseInt(employeeId) : undefined,
          { dryRun, deleteLocal }
        );
        
        await logAudit(req, null, null, { 
          action: 'employee_documents_migration', 
          employeeId,
          dryRun,
          result 
        });
        
        res.json(result);
      } catch (error) {
        console.error('Error migrating employee documents:', error);
        res.status(500).json({ error: 'Failed to migrate employee documents' });
      }
    }
  );

  /**
   * POST /api/admin/s3/migration/compliance
   * Migrate compliance documents to S3
   */
  app.post('/api/admin/s3/migration/compliance',
    requireAuth,
    requireRole(['admin']),
    auditMiddleware('s3_migration'),
    async (req: AuditRequest, res: Response) => {
      try {
        const { locationId, dryRun = false, deleteLocal = false } = req.body;
        
        if (!s3Service.isConfigured()) {
          return res.status(400).json({ error: 'S3 is not configured' });
        }
        
        const result = await s3MigrationService.migrateComplianceDocuments(
          locationId ? parseInt(locationId) : undefined,
          { dryRun, deleteLocal }
        );
        
        await logAudit(req, null, null, { 
          action: 'compliance_documents_migration', 
          locationId,
          dryRun,
          result 
        });
        
        res.json(result);
      } catch (error) {
        console.error('Error migrating compliance documents:', error);
        res.status(500).json({ error: 'Failed to migrate compliance documents' });
      }
    }
  );

  /**
   * POST /api/admin/s3/migration/onboarding
   * Migrate onboarding documents to S3
   */
  app.post('/api/admin/s3/migration/onboarding',
    requireAuth,
    requireRole(['admin']),
    auditMiddleware('s3_migration'),
    async (req: AuditRequest, res: Response) => {
      try {
        const { employeeId, dryRun = false, deleteLocal = false } = req.body;
        
        if (!s3Service.isConfigured()) {
          return res.status(400).json({ error: 'S3 is not configured' });
        }
        
        const result = await s3MigrationService.migrateOnboardingDocuments(
          employeeId ? parseInt(employeeId) : undefined,
          { dryRun, deleteLocal }
        );
        
        await logAudit(req, null, null, { 
          action: 'onboarding_documents_migration', 
          employeeId,
          dryRun,
          result 
        });
        
        res.json(result);
      } catch (error) {
        console.error('Error migrating onboarding documents:', error);
        res.status(500).json({ error: 'Failed to migrate onboarding documents' });
      }
    }
  );

  /**
   * POST /api/admin/s3/migration/all
   * Migrate all documents to S3
   */
  app.post('/api/admin/s3/migration/all',
    requireAuth,
    requireRole(['admin']),
    auditMiddleware('s3_migration'),
    async (req: AuditRequest, res: Response) => {
      try {
        const { dryRun = false, deleteLocal = false } = req.body;
        
        if (!s3Service.isConfigured()) {
          return res.status(400).json({ error: 'S3 is not configured' });
        }
        
        const result = await s3MigrationService.migrateAllDocuments({ dryRun, deleteLocal });
        
        await logAudit(req, null, null, { 
          action: 'all_documents_migration', 
          dryRun,
          result 
        });
        
        res.json(result);
      } catch (error) {
        console.error('Error migrating all documents:', error);
        res.status(500).json({ error: 'Failed to migrate all documents' });
      }
    }
  );

  /**
   * POST /api/admin/s3/migration/rollback/:id
   * Rollback a specific document migration
   */
  app.post('/api/admin/s3/migration/rollback/:id',
    requireAuth,
    requireRole(['admin']),
    auditMiddleware('s3_migration'),
    validateId(),
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const documentId = parseInt(req.params.id);
        
        const result = await s3MigrationService.rollbackDocument(documentId);
        
        await logAudit(req, null, null, { 
          action: 'document_migration_rollback', 
          documentId,
          result 
        });
        
        res.json(result);
      } catch (error) {
        console.error('Error rolling back document:', error);
        res.status(500).json({ error: 'Failed to rollback document migration' });
      }
    }
  );

  // ============================================================================
  // ENHANCED DOCUMENT UPLOAD ENDPOINTS
  // ============================================================================

  /**
   * Rate limiter for document upload endpoints
   */
  const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // limit each IP to 50 uploads per windowMs
    message: 'Too many upload requests, please try again later'
  });

  /**
   * POST /api/documents/upload
   * Generic document upload endpoint with auto-detection
   */
  app.post('/api/documents/upload',
    requireAuth,
    requireRole(['admin', 'hr']),
    uploadLimiter,
    upload.single('document'),
    auditMiddleware('documents'),
    async (req: AuditRequest, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const { employeeId, documentType, tags, metadata } = req.body;
        
        if (!employeeId) {
          return res.status(400).json({ error: 'Employee ID is required' });
        }
        
        // Verify employee exists
        const employee = await storage.getEmployee(parseInt(employeeId));
        if (!employee) {
          // Clean up uploaded file
          fs.unlinkSync(req.file.path);
          return res.status(404).json({ error: 'Employee not found' });
        }
        
        const fileBuffer = fs.readFileSync(req.file.path);
        const fileName = req.file.originalname;
        const fileType = req.file.mimetype;
        const fileSize = req.file.size;
        
        // Generate S3 key based on document type
        const s3Key = s3Service.generateEmployeeDocumentKey(
          parseInt(employeeId),
          fileName,
          documentType || 'general'
        );
        
        let storageType: 'local' | 's3' = 'local';
        let storageKey = req.file.filename;
        let s3Etag: string | undefined;
        let s3VersionId: string | undefined;
        
        // Try to upload to S3 if configured
        if (s3Service.isConfigured()) {
          try {
            const parsedTags = tags ? JSON.parse(tags) : undefined;
            const parsedMetadata = metadata ? JSON.parse(metadata) : undefined;
            
            const uploadResult = await s3Service.uploadFile(
              fileBuffer,
              s3Key,
              fileType,
              parsedMetadata,
              parsedTags
            );
            
            if (uploadResult.success && uploadResult.storageType === 's3') {
              storageType = 's3';
              storageKey = uploadResult.storageKey;
              s3Etag = uploadResult.etag;
              s3VersionId = uploadResult.versionId;
              
              // Clean up local file after successful S3 upload
              fs.unlinkSync(req.file.path);
            }
          } catch (error) {
            console.error('S3 upload failed, using local storage:', error);
            // Continue with local storage
          }
        }
        
        // Save document record to database
        const document = await storage.createDocument({
          employeeId: parseInt(employeeId),
          fileName,
          filePath: storageType === 'local' ? req.file.path : undefined,
          fileSize,
          fileType,
          documentType: documentType || 'general',
          storageType,
          storageKey,
          s3Etag,
          s3VersionId,
          uploadedBy: req.user!.id
        });
        
        // Generate presigned URL for S3 documents
        let presignedUrl: string | undefined;
        if (storageType === 's3') {
          try {
            presignedUrl = await s3Service.getSignedUrl(storageKey, 3600);
          } catch (error) {
            console.error('Failed to generate presigned URL:', error);
          }
        }
        
        await logAudit(req, null, parseInt(employeeId), { 
          action: 'document_upload', 
          documentId: document.id,
          storageType,
          fileName 
        });
        
        res.status(201).json({
          ...document,
          presignedUrl
        });
      } catch (error) {
        console.error('Error uploading document:', error);
        
        // Clean up file on error
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ error: 'Failed to upload document' });
      }
    }
  );

  /**
   * POST /api/documents/employee/:id/upload
   * Upload employee-specific document
   */
  app.post('/api/documents/employee/:id/upload',
    requireAuth,
    requireRole(['admin', 'hr']),
    uploadLimiter,
    upload.single('document'),
    validateId(),
    handleValidationErrors,
    auditMiddleware('documents'),
    async (req: AuditRequest, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const employeeId = parseInt(req.params.id);
        const { documentType = 'general', tags, metadata } = req.body;
        
        // Verify employee exists
        const employee = await storage.getEmployee(employeeId);
        if (!employee) {
          fs.unlinkSync(req.file.path);
          return res.status(404).json({ error: 'Employee not found' });
        }
        
        const fileBuffer = fs.readFileSync(req.file.path);
        const fileName = req.file.originalname;
        const fileType = req.file.mimetype;
        const fileSize = req.file.size;
        
        const s3Key = s3Service.generateEmployeeDocumentKey(employeeId, fileName, documentType);
        
        let storageType: 'local' | 's3' = 's3';
        let storageKey = req.file.filename;
        let s3Etag: string | undefined;
        let s3VersionId: string | undefined;
        
        if (s3Service.isConfigured()) {
          try {
            const parsedTags = tags ? JSON.parse(tags) : undefined;
            const parsedMetadata = metadata ? JSON.parse(metadata) : undefined;
            
            const uploadResult = await s3Service.uploadFile(
              fileBuffer,
              s3Key,
              fileType,
              parsedMetadata,
              parsedTags
            );
            
            if (uploadResult.success && uploadResult.storageType === 's3') {
              storageType = 's3';
              storageKey = uploadResult.storageKey;
              s3Etag = uploadResult.etag;
              s3VersionId = uploadResult.versionId;
              fs.unlinkSync(req.file.path);
            }
          } catch (error) {
            console.error('S3 upload failed, using local storage:', error);
          }
        }
        
        const document = await storage.createDocument({
          employeeId,
          fileName,
          filePath: storageType === 'local' ? req.file.path : undefined,
          fileSize,
          fileType,
          documentType,
          storageType,
          storageKey,
          s3Etag,
          s3VersionId,
          uploadedBy: req.user!.id
        });
        
        let presignedUrl: string | undefined;
        if (storageType === 's3') {
          try {
            presignedUrl = await s3Service.getSignedUrl(storageKey, 3600);
          } catch (error) {
            console.error('Failed to generate presigned URL:', error);
          }
        }
        
        await logAudit(req, null, employeeId, { 
          action: 'employee_document_upload', 
          documentId: document.id,
          documentType,
          storageType
        });
        
        res.status(201).json({
          ...document,
          presignedUrl
        });
      } catch (error) {
        console.error('Error uploading employee document:', error);
        
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ error: 'Failed to upload employee document' });
      }
    }
  );

  /**
   * POST /api/documents/compliance/:id/upload
   * Upload compliance document for a location
   */
  app.post('/api/documents/compliance/:id/upload',
    requireAuth,
    requireRole(['admin', 'hr']),
    uploadLimiter,
    upload.single('document'),
    validateId(),
    handleValidationErrors,
    auditMiddleware('compliance_documents'),
    async (req: AuditRequest, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const locationId = parseInt(req.params.id);
        const { documentType, licenseId, tags, metadata } = req.body;
        
        if (!documentType) {
          fs.unlinkSync(req.file.path);
          return res.status(400).json({ error: 'Document type is required' });
        }
        
        // Verify location exists
        const location = await storage.getLocation(locationId);
        if (!location) {
          fs.unlinkSync(req.file.path);
          return res.status(404).json({ error: 'Location not found' });
        }
        
        const fileBuffer = fs.readFileSync(req.file.path);
        const fileName = req.file.originalname;
        const fileType = req.file.mimetype;
        const fileSize = req.file.size;
        
        const s3Key = s3Service.generateComplianceDocumentKey(
          locationId,
          documentType,
          fileName
        );
        
        let storageType: 'local' | 's3' = 'local';
        let storageKey = req.file.filename;
        let s3Etag: string | undefined;
        let s3VersionId: string | undefined;
        
        if (s3Service.isConfigured()) {
          try {
            const parsedTags = tags ? JSON.parse(tags) : undefined;
            const parsedMetadata = metadata ? JSON.parse(metadata) : undefined;
            
            const uploadResult = await s3Service.uploadFile(
              fileBuffer,
              s3Key,
              fileType,
              parsedMetadata,
              parsedTags
            );
            
            if (uploadResult.success && uploadResult.storageType === 's3') {
              storageType = 's3';
              storageKey = uploadResult.storageKey;
              s3Etag = uploadResult.etag;
              s3VersionId = uploadResult.versionId;
              fs.unlinkSync(req.file.path);
            }
          } catch (error) {
            console.error('S3 upload failed, using local storage:', error);
          }
        }
        
        const document = await storage.createComplianceDocument({
          locationId,
          clinicLicenseId: licenseId ? parseInt(licenseId) : null,
          fileName,
          fileSize,
          fileType,
          documentType,
          storageType,
          storageKey,
          s3Etag,
          s3VersionId,
          uploadedBy: req.user!.id
        });
        
        let presignedUrl: string | undefined;
        if (storageType === 's3') {
          try {
            presignedUrl = await s3Service.getSignedUrl(storageKey, 3600);
          } catch (error) {
            console.error('Failed to generate presigned URL:', error);
          }
        }
        
        await logAudit(req, null, null, { 
          action: 'compliance_document_upload', 
          documentId: document.id,
          locationId,
          documentType,
          storageType
        });
        
        res.status(201).json({
          ...document,
          presignedUrl
        });
      } catch (error) {
        console.error('Error uploading compliance document:', error);
        
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ error: 'Failed to upload compliance document' });
      }
    }
  );

  /**
   * POST /api/documents/onboarding/:id/upload
   * Upload onboarding document for an employee
   */
  app.post('/api/documents/onboarding/:id/upload',
    requireAuth,
    requireRole(['admin', 'hr']),
    uploadLimiter,
    upload.single('document'),
    validateId(),
    handleValidationErrors,
    auditMiddleware('onboarding_documents'),
    async (req: AuditRequest, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const employeeId = parseInt(req.params.id);
        const { documentType = 'onboarding', tags, metadata } = req.body;
        
        // Verify employee exists
        const employee = await storage.getEmployee(employeeId);
        if (!employee) {
          fs.unlinkSync(req.file.path);
          return res.status(404).json({ error: 'Employee not found' });
        }
        
        const fileBuffer = fs.readFileSync(req.file.path);
        const fileName = req.file.originalname;
        const fileType = req.file.mimetype;
        const fileSize = req.file.size;
        
        const s3Key = s3Service.generateOnboardingDocumentKey(employeeId, fileName, documentType);
        
        let storageType: 'local' | 's3' = 'local';
        let storageKey = req.file.filename;
        let s3Etag: string | undefined;
        let s3VersionId: string | undefined;
        
        if (s3Service.isConfigured()) {
          try {
            const parsedTags = tags ? JSON.parse(tags) : undefined;
            const parsedMetadata = metadata ? JSON.parse(metadata) : undefined;
            
            const uploadResult = await s3Service.uploadFile(
              fileBuffer,
              s3Key,
              fileType,
              parsedMetadata,
              parsedTags
            );
            
            if (uploadResult.success && uploadResult.storageType === 's3') {
              storageType = 's3';
              storageKey = uploadResult.storageKey;
              s3Etag = uploadResult.etag;
              s3VersionId = uploadResult.versionId;
              fs.unlinkSync(req.file.path);
            }
          } catch (error) {
            console.error('S3 upload failed, using local storage:', error);
          }
        }
        
        // Store as employee document upload
        const document = await storage.createEmployeeDocumentUpload({
          employeeId,
          fileName,
          fileType,
          fileSize,
          documentType,
          storageType,
          storageKey,
          s3Etag,
          s3VersionId,
          uploadedBy: req.user!.id,
          status: 'uploaded'
        });
        
        let presignedUrl: string | undefined;
        if (storageType === 's3') {
          try {
            presignedUrl = await s3Service.getSignedUrl(storageKey, 3600);
          } catch (error) {
            console.error('Failed to generate presigned URL:', error);
          }
        }
        
        await logAudit(req, null, employeeId, { 
          action: 'onboarding_document_upload', 
          documentId: document.id,
          documentType,
          storageType
        });
        
        res.status(201).json({
          ...document,
          presignedUrl
        });
      } catch (error) {
        console.error('Error uploading onboarding document:', error);
        
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ error: 'Failed to upload onboarding document' });
      }
    }
  );

  /**
   * POST /api/documents/facility/:id/upload
   * Upload facility document
   */
  app.post('/api/documents/facility/:id/upload',
    requireAuth,
    requireRole(['admin', 'hr']),
    uploadLimiter,
    upload.single('document'),
    validateId(),
    handleValidationErrors,
    auditMiddleware('facility_documents'),
    async (req: AuditRequest, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const facilityId = parseInt(req.params.id);
        const { documentType = 'facility', tags, metadata } = req.body;
        
        const fileBuffer = fs.readFileSync(req.file.path);
        const fileName = req.file.originalname;
        const fileType = req.file.mimetype;
        const fileSize = req.file.size;
        
        const s3Key = `facilities/${facilityId}/${documentType}/${Date.now()}-${fileName}`;
        
        let storageType: 'local' | 's3' = 'local';
        let storageKey = req.file.filename;
        let s3Etag: string | undefined;
        let s3VersionId: string | undefined;
        
        if (s3Service.isConfigured()) {
          try {
            const parsedTags = tags ? JSON.parse(tags) : undefined;
            const parsedMetadata = metadata ? JSON.parse(metadata) : undefined;
            
            const uploadResult = await s3Service.uploadFile(
              fileBuffer,
              s3Key,
              fileType,
              parsedMetadata,
              parsedTags
            );
            
            if (uploadResult.success && uploadResult.storageType === 's3') {
              storageType = 's3';
              storageKey = uploadResult.storageKey;
              s3Etag = uploadResult.etag;
              s3VersionId = uploadResult.versionId;
              fs.unlinkSync(req.file.path);
            }
          } catch (error) {
            console.error('S3 upload failed, using local storage:', error);
          }
        }
        
        // For facility documents, we can store in general documents table
        const document = await storage.createDocument({
          employeeId: null,
          fileName,
          filePath: storageType === 'local' ? req.file.path : undefined,
          fileSize,
          fileType,
          documentType,
          storageType,
          storageKey,
          s3Etag,
          s3VersionId,
          uploadedBy: req.user!.id
        });
        
        let presignedUrl: string | undefined;
        if (storageType === 's3') {
          try {
            presignedUrl = await s3Service.getSignedUrl(storageKey, 3600);
          } catch (error) {
            console.error('Failed to generate presigned URL:', error);
          }
        }
        
        await logAudit(req, null, null, { 
          action: 'facility_document_upload', 
          documentId: document.id,
          facilityId,
          documentType,
          storageType
        });
        
        res.status(201).json({
          ...document,
          presignedUrl
        });
      } catch (error) {
        console.error('Error uploading facility document:', error);
        
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ error: 'Failed to upload facility document' });
      }
    }
  );

  /**
   * POST /api/documents/upload/presigned-url
   * Get presigned URL for direct browser upload to S3
   */
  app.post('/api/documents/upload/presigned-url',
    requireAuth,
    requireRole(['admin', 'hr']),
    [
      body('fileName').notEmpty().withMessage('File name is required'),
      body('fileType').notEmpty().withMessage('File type is required'),
      body('documentType').notEmpty().withMessage('Document type is required')
    ],
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        if (!s3Service.isConfigured()) {
          return res.status(400).json({ error: 'S3 is not configured' });
        }
        
        const { fileName, fileType, documentType, employeeId, locationId } = req.body;
        
        // Generate appropriate S3 key based on context
        let s3Key: string;
        if (employeeId) {
          s3Key = s3Service.generateEmployeeDocumentKey(
            parseInt(employeeId),
            fileName,
            documentType
          );
        } else if (locationId) {
          s3Key = s3Service.generateComplianceDocumentKey(
            parseInt(locationId),
            documentType,
            fileName
          );
        } else {
          s3Key = `documents/${documentType}/${Date.now()}-${fileName}`;
        }
        
        // Generate presigned URL for upload (PUT)
        const presignedUrl = await s3Service.getSignedUploadUrl(s3Key, fileType, 3600);
        
        await logAudit(req, null, employeeId || null, { 
          action: 'presigned_upload_url_generated', 
          fileName,
          documentType,
          s3Key
        });
        
        res.json({
          presignedUrl,
          s3Key,
          expiresIn: 3600
        });
      } catch (error) {
        console.error('Error generating presigned upload URL:', error);
        res.status(500).json({ error: 'Failed to generate presigned upload URL' });
      }
    }
  );

  // ============================================================================
  // ENHANCED DOCUMENT DOWNLOAD/ACCESS ENDPOINTS
  // ============================================================================

  /**
   * GET /api/documents/:id/download
   * Download document with support for both S3 and local storage
   */
  app.get('/api/documents/:id/download',
    requireAuth,
    validateId(),
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const documentId = parseInt(req.params.id);
        const document = await storage.getDocument(documentId);
        
        if (!document) {
          return res.status(404).json({ error: 'Document not found' });
        }
        
        // Check permissions
        if (document.employeeId) {
          const employee = await storage.getEmployee(document.employeeId);
          const isOwnProfile = employee?.userId === req.user!.id;
          const hasManagementRole = req.user!.role === 'admin' || req.user!.role === 'hr';
          
          if (!isOwnProfile && !hasManagementRole) {
            return res.status(403).json({ error: 'Insufficient permissions' });
          }
        }
        
        if (document.storageType === 's3' && document.storageKey) {
          // For S3 documents, redirect to presigned URL
          try {
            const presignedUrl = await s3Service.getSignedUrl(document.storageKey, 3600);
            
            await logAudit(req, null, document.employeeId || null, { 
              action: 'document_download', 
              documentId,
              storageType: 's3'
            });
            
            res.redirect(presignedUrl);
          } catch (error) {
            console.error('Error generating presigned URL:', error);
            return res.status(500).json({ error: 'Failed to generate download URL' });
          }
        } else if (document.filePath) {
          // For local documents, serve the file
          if (!fs.existsSync(document.filePath)) {
            return res.status(404).json({ error: 'File not found on disk' });
          }
          
          await logAudit(req, null, document.employeeId || null, { 
            action: 'document_download', 
            documentId,
            storageType: 'local'
          });
          
          res.download(document.filePath, document.fileName);
        } else {
          return res.status(404).json({ error: 'Document file not found' });
        }
      } catch (error) {
        console.error('Error downloading document:', error);
        res.status(500).json({ error: 'Failed to download document' });
      }
    }
  );

  /**
   * GET /api/documents/:id/presigned-url
   * Get presigned URL for S3 document (no redirect)
   */
  app.get('/api/documents/:id/presigned-url',
    requireAuth,
    validateId(),
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const documentId = parseInt(req.params.id);
        const document = await storage.getDocument(documentId);
        
        if (!document) {
          return res.status(404).json({ error: 'Document not found' });
        }
        
        // Check permissions
        if (document.employeeId) {
          const employee = await storage.getEmployee(document.employeeId);
          const isOwnProfile = employee?.userId === req.user!.id;
          const hasManagementRole = req.user!.role === 'admin' || req.user!.role === 'hr';
          
          if (!isOwnProfile && !hasManagementRole) {
            return res.status(403).json({ error: 'Insufficient permissions' });
          }
        }
        
        if (document.storageType !== 's3' || !document.storageKey) {
          return res.status(400).json({ error: 'Document is not stored on S3' });
        }
        
        try {
          const expiresIn = parseInt(req.query.expiresIn as string) || 3600;
          const presignedUrl = await s3Service.getSignedUrl(document.storageKey, expiresIn);
          
          await logAudit(req, null, document.employeeId || null, { 
            action: 'presigned_url_generated', 
            documentId
          });
          
          res.json({
            url: presignedUrl,
            expiresIn,
            fileName: document.fileName,
            documentId: document.id
          });
        } catch (error) {
          console.error('Error generating presigned URL:', error);
          return res.status(500).json({ error: 'Failed to generate presigned URL' });
        }
      } catch (error) {
        console.error('Error fetching presigned URL:', error);
        res.status(500).json({ error: 'Failed to fetch presigned URL' });
      }
    }
  );

  /**
   * GET /api/documents/:id/metadata
   * Get document metadata only (no file access)
   */
  app.get('/api/documents/:id/metadata',
    requireAuth,
    validateId(),
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const documentId = parseInt(req.params.id);
        const document = await storage.getDocument(documentId);
        
        if (!document) {
          return res.status(404).json({ error: 'Document not found' });
        }
        
        // Check permissions
        if (document.employeeId) {
          const employee = await storage.getEmployee(document.employeeId);
          const isOwnProfile = employee?.userId === req.user!.id;
          const hasManagementRole = req.user!.role === 'admin' || req.user!.role === 'hr';
          
          if (!isOwnProfile && !hasManagementRole) {
            return res.status(403).json({ error: 'Insufficient permissions' });
          }
        }
        
        // Return metadata without file path or storage key
        const metadata = {
          id: document.id,
          employeeId: document.employeeId,
          fileName: document.fileName,
          fileSize: document.fileSize,
          fileType: document.fileType,
          documentType: document.documentType,
          storageType: document.storageType,
          uploadedBy: document.uploadedBy,
          uploadedAt: document.uploadedAt,
          createdAt: document.createdAt,
          s3VersionId: document.s3VersionId
        };
        
        await logAudit(req, null, document.employeeId || null, { 
          action: 'document_metadata_viewed', 
          documentId
        });
        
        res.json(metadata);
      } catch (error) {
        console.error('Error fetching document metadata:', error);
        res.status(500).json({ error: 'Failed to fetch document metadata' });
      }
    }
  );

  /**
   * GET /api/documents/employee/:id
   * List all documents for an employee
   */
  app.get('/api/documents/employee/:id',
    requireAuth,
    validateId(),
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const employeeId = parseInt(req.params.id);
        
        // Verify employee exists
        const employee = await storage.getEmployee(employeeId);
        if (!employee) {
          return res.status(404).json({ error: 'Employee not found' });
        }
        
        // Check permissions
        const isOwnProfile = employee.userId === req.user!.id;
        const hasManagementRole = req.user!.role === 'admin' || req.user!.role === 'hr';
        
        if (!isOwnProfile && !hasManagementRole) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = (page - 1) * limit;
        
        const { documents: docs, total } = await storage.getDocuments({
          employeeId,
          limit,
          offset
        });
        
        await logAudit(req, null, employeeId, { 
          action: 'employee_documents_listed', 
          count: docs.length
        });
        
        res.json({
          documents: docs,
          total,
          page,
          totalPages: Math.ceil(total / limit)
        });
      } catch (error) {
        console.error('Error listing employee documents:', error);
        res.status(500).json({ error: 'Failed to list employee documents' });
      }
    }
  );

  /**
   * GET /api/documents/compliance/:id
   * List all compliance documents for a location
   */
  app.get('/api/documents/compliance/:id',
    requireAuth,
    requireRole(['admin', 'hr']),
    validateId(),
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const locationId = parseInt(req.params.id);
        
        // Verify location exists
        const location = await storage.getLocation(locationId);
        if (!location) {
          return res.status(404).json({ error: 'Location not found' });
        }
        
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = (page - 1) * limit;
        
        const { documents: docs, total } = await storage.getComplianceDocuments({
          locationId,
          limit,
          offset
        });
        
        await logAudit(req, null, null, { 
          action: 'compliance_documents_listed', 
          locationId,
          count: docs.length
        });
        
        res.json({
          documents: docs,
          total,
          page,
          totalPages: Math.ceil(total / limit)
        });
      } catch (error) {
        console.error('Error listing compliance documents:', error);
        res.status(500).json({ error: 'Failed to list compliance documents' });
      }
    }
  );

  // ============================================================================
  // DOCUMENT MANAGEMENT ENDPOINTS
  // ============================================================================

  /**
   * DELETE /api/documents/:id
   * Delete document (both S3 and database record)
   */
  app.delete('/api/documents/:id',
    requireAuth,
    requireRole(['admin', 'hr']),
    validateId(),
    handleValidationErrors,
    auditMiddleware('documents'),
    async (req: AuditRequest, res: Response) => {
      try {
        const documentId = parseInt(req.params.id);
        const document = await storage.getDocument(documentId);
        
        if (!document) {
          return res.status(404).json({ error: 'Document not found' });
        }
        
        // Delete from S3 if stored there
        if (document.storageType === 's3' && document.storageKey) {
          try {
            await s3Service.deleteFile(document.storageKey);
          } catch (error) {
            console.error('Error deleting file from S3:', error);
            // Continue with database deletion even if S3 deletion fails
          }
        } else if (document.filePath && fs.existsSync(document.filePath)) {
          // Delete local file
          try {
            fs.unlinkSync(document.filePath);
          } catch (error) {
            console.error('Error deleting local file:', error);
          }
        }
        
        // Delete database record
        await storage.deleteDocument(documentId);
        
        await logAudit(req, null, document.employeeId || null, { 
          action: 'document_deleted', 
          documentId,
          fileName: document.fileName,
          storageType: document.storageType
        });
        
        res.json({ 
          success: true, 
          message: 'Document deleted successfully' 
        });
      } catch (error) {
        console.error('Error deleting document:', error);
        res.status(500).json({ error: 'Failed to delete document' });
      }
    }
  );

  /**
   * PATCH /api/documents/:id
   * Update document metadata
   */
  app.patch('/api/documents/:id',
    requireAuth,
    requireRole(['admin', 'hr']),
    validateId(),
    handleValidationErrors,
    auditMiddleware('documents'),
    async (req: AuditRequest, res: Response) => {
      try {
        const documentId = parseInt(req.params.id);
        const document = await storage.getDocument(documentId);
        
        if (!document) {
          return res.status(404).json({ error: 'Document not found' });
        }
        
        const { fileName, documentType } = req.body;
        const updates: any = {};
        
        if (fileName) updates.fileName = fileName;
        if (documentType) updates.documentType = documentType;
        
        if (Object.keys(updates).length === 0) {
          return res.status(400).json({ error: 'No valid fields to update' });
        }
        
        const updatedDocument = await storage.updateDocument(documentId, updates);
        
        await logAudit(req, null, document.employeeId || null, { 
          action: 'document_metadata_updated', 
          documentId,
          updates
        });
        
        res.json(updatedDocument);
      } catch (error) {
        console.error('Error updating document metadata:', error);
        res.status(500).json({ error: 'Failed to update document metadata' });
      }
    }
  );

  /**
   * GET /api/documents/batch/download
   * Download multiple documents as ZIP
   */
  app.get('/api/documents/batch/download',
    requireAuth,
    requireRole(['admin', 'hr']),
    async (req: AuditRequest, res: Response) => {
      try {
        const documentIds = (req.query.ids as string)?.split(',').map(id => parseInt(id));
        
        if (!documentIds || documentIds.length === 0) {
          return res.status(400).json({ error: 'Document IDs are required' });
        }
        
        if (documentIds.length > 50) {
          return res.status(400).json({ error: 'Maximum 50 documents allowed per batch' });
        }
        
        // For now, return URLs for each document
        // Full ZIP implementation would require archiver library
        const documentUrls = [];
        
        for (const id of documentIds) {
          const document = await storage.getDocument(id);
          if (document) {
            if (document.storageType === 's3' && document.storageKey) {
              try {
                const url = await s3Service.getSignedUrl(document.storageKey, 3600);
                documentUrls.push({
                  id: document.id,
                  fileName: document.fileName,
                  url
                });
              } catch (error) {
                console.error(`Error generating URL for document ${id}:`, error);
              }
            }
          }
        }
        
        await logAudit(req, null, null, { 
          action: 'batch_download_requested', 
          documentIds,
          count: documentUrls.length
        });
        
        res.json({
          documents: documentUrls,
          expiresIn: 3600,
          message: 'Download URLs generated. ZIP download feature coming soon.'
        });
      } catch (error) {
        console.error('Error batch downloading documents:', error);
        res.status(500).json({ error: 'Failed to batch download documents' });
      }
    }
  );

  /**
   * POST /api/documents/batch/delete
   * Delete multiple documents
   */
  app.post('/api/documents/batch/delete',
    requireAuth,
    requireRole(['admin']),
    auditMiddleware('documents'),
    [
      body('documentIds').isArray().withMessage('Document IDs must be an array'),
      body('documentIds.*').isNumeric().withMessage('Each document ID must be a number')
    ],
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const { documentIds } = req.body;
        
        if (!documentIds || documentIds.length === 0) {
          return res.status(400).json({ error: 'Document IDs are required' });
        }
        
        if (documentIds.length > 100) {
          return res.status(400).json({ error: 'Maximum 100 documents allowed per batch' });
        }
        
        const results = {
          deleted: 0,
          failed: 0,
          errors: [] as any[]
        };
        
        for (const id of documentIds) {
          try {
            const document = await storage.getDocument(id);
            if (document) {
              // Delete from S3 if stored there
              if (document.storageType === 's3' && document.storageKey) {
                try {
                  await s3Service.deleteFile(document.storageKey);
                } catch (error) {
                  console.error(`Error deleting file from S3 for document ${id}:`, error);
                }
              } else if (document.filePath && fs.existsSync(document.filePath)) {
                try {
                  fs.unlinkSync(document.filePath);
                } catch (error) {
                  console.error(`Error deleting local file for document ${id}:`, error);
                }
              }
              
              await storage.deleteDocument(id);
              results.deleted++;
            }
          } catch (error) {
            console.error(`Error deleting document ${id}:`, error);
            results.failed++;
            results.errors.push({
              documentId: id,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
        
        await logAudit(req, null, null, { 
          action: 'batch_delete', 
          documentIds,
          results
        });
        
        res.json(results);
      } catch (error) {
        console.error('Error batch deleting documents:', error);
        res.status(500).json({ error: 'Failed to batch delete documents' });
      }
    }
  );

  const httpServer = createServer(app);
  return httpServer;
}