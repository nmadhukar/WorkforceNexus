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
  handleValidationErrors 
} from "./middleware/validation";
import { 
  apiKeyAuth, 
  generateApiKey, 
  requirePermission, 
  requireAnyAuth, 
  API_KEY_PERMISSIONS,
  type ApiKeyRequest
} from "./middleware/apiKeyAuth";
import { encryptSensitiveFields, decryptSensitiveFields, maskSSN } from "./middleware/encryption";
import { auditMiddleware, logAudit, AuditRequest } from "./middleware/audit";
import { startCronJobs, manualExpirationCheck, checkExpiringApiKeys } from "./services/cronJobs";
import { body } from "express-validator";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";
import { s3Service, generateDocumentKey } from "./services/s3Service";
import { db } from "./db";
import { documents, users } from "@shared/schema";
import { eq, or, sql, count } from "drizzle-orm";
import { encrypt, decrypt, mask } from "./utils/encryption";
import { getBaseUrl } from "./utils/url";
import crypto from "crypto";

// Import password hashing utilities from auth module
import { hashPassword, comparePasswords } from "./auth";

// Generate secure password reset token
const generateResetToken = (): string => {
  return crypto.randomBytes(32).toString('base64url');
};

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
  max: 100 // limit each IP to 100 requests per windowMs
});

/**
 * Rate limiter for API key management endpoints
 * Stricter limits: 5 requests per hour for key operations
 */
const apiKeyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each IP to 5 requests per hour
  message: 'Too many API key requests, please try again later'
});

/**
 * Rate limiter for password reset endpoints
 * Strict limits: 5 attempts per 15 minutes for security
 */
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
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
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
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
        status: 'active',
        requirePasswordChange: false  // Don't require password change for recovery
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
          // Import SES service dynamically
          const { sesService } = await import('./services/sesService');
          
          // Generate full name for personalization
          const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username;
          
          // Get the base URL for the reset link
          const baseUrl = getBaseUrl(req);
          
          // Send the password reset email
          const emailResult = await sesService.sendPasswordResetEmail(
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
        
        // Mask sensitive data for display
        const maskedEmployees = result.employees.map(emp => ({
          ...emp,
          ssn: maskSSN(emp.ssn || ''),
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
        
        // Mask sensitive data
        const maskedEmployee = {
          ...employee,
          ssn: maskSSN(employee.ssn || ''),
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
        
        // Mask sensitive data
        const maskedEmployee = {
          ...employee,
          ssn: maskSSN(employee.ssn || ''),
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
        const encryptedData = encryptSensitiveFields(req.body);
        const employee = await storage.createEmployee(encryptedData);
        
        await logAudit(req, employee.id, null, employee);
        
        // Return masked data
        const maskedEmployee = {
          ...employee,
          ssn: maskSSN(employee.ssn || ''),
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
        
        const encryptedData = encryptSensitiveFields(req.body);
        const employee = await storage.updateEmployee(id, encryptedData);
        
        await logAudit(req, id, oldEmployee, employee);
        
        // Return masked data
        const maskedEmployee = {
          ...employee,
          ssn: maskSSN(employee.ssn || ''),
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
        
        const result = await storage.getDocuments({
          limit,
          offset,
          search: req.query.search as string,
          type: req.query.type as string,
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
          return res.status(404).json({ error: 'Document not found' });
        }
        
        // Handle S3 stored documents
        if (document.storageType === 's3' && document.storageKey) {
          // Generate a signed URL for direct download from S3
          const signedUrl = await s3Service.getSignedUrl(document.storageKey, 3600);
          
          if (signedUrl) {
            // Redirect to the signed URL for download
            return res.redirect(signedUrl);
          } else {
            // Fallback: Download from S3 and stream to client
            const downloadResult = await s3Service.downloadFile(document.storageKey, 's3');
            
            if (downloadResult.success && downloadResult.data) {
              res.setHeader('Content-Type', downloadResult.contentType || 'application/octet-stream');
              res.setHeader('Content-Disposition', `attachment; filename="${document.fileName || 'document'}"`);
              return res.send(downloadResult.data);
            }
          }
        }
        
        // Handle locally stored documents (backward compatibility)
        if (document.filePath && fs.existsSync(document.filePath)) {
          return res.download(document.filePath, document.fileName || 'document');
        }
        
        // If storage key exists but file is local
        if (document.storageKey && document.storageType === 'local') {
          if (fs.existsSync(document.storageKey)) {
            return res.download(document.storageKey, document.fileName || 'document');
          }
        }
        
        return res.status(404).json({ error: 'Document file not found' });
      } catch (error) {
        console.error('Error downloading document:', error);
        res.status(500).json({ error: 'Failed to download document' });
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
        const employment = await storage.createEmployment({
          ...req.body,
          employeeId: parseInt(req.params.id)
        });
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
        const employment = await storage.updateEmployment(id, req.body);
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
   * AWS SES Email Configuration Routes
   * 
   * @description
   * Endpoints for managing AWS SES configuration for email notifications.
   * Supports configuration management, testing, and invitation sending.
   */

  /**
   * GET /api/admin/ses-config
   * Get current SES configuration status
   */
  app.get('/api/admin/ses-config',
    requireAuth,
    requireRole(['admin', 'hr']),
    async (req: AuditRequest, res: Response) => {
      try {
        const { sesService } = await import('./services/sesService');
        const status = await sesService.getConfigurationStatus();
        res.json(status);
      } catch (error) {
        console.error('Error fetching SES configuration:', error);
        res.status(500).json({ error: 'Failed to fetch SES configuration' });
      }
    }
  );

  /**
   * POST /api/admin/ses-config
   * Save or update SES configuration
   */
  app.post('/api/admin/ses-config',
    requireAuth,
    requireRole(['admin', 'hr']),
    [
      body('region').notEmpty().withMessage('AWS Region is required'),
      body('accessKeyId').notEmpty().withMessage('AWS Access Key ID is required'),
      body('secretAccessKey').notEmpty().withMessage('AWS Secret Access Key is required'),
      body('fromEmail').isEmail().withMessage('Valid from email is required'),
      body('fromName').optional()
    ],
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const { sesService } = await import('./services/sesService');
        const config = {
          ...req.body,
          updatedBy: req.user!.id
        };
        
        const success = await sesService.saveConfiguration(config);
        
        if (success) {
          await logAudit(req, 1, null, { configured: true });
          
          res.json({ message: 'SES configuration saved successfully' });
        } else {
          res.status(400).json({ error: 'Failed to save SES configuration' });
        }
      } catch (error) {
        console.error('Error saving SES configuration:', error);
        res.status(500).json({ error: 'Failed to save SES configuration' });
      }
    }
  );

  /**
   * POST /api/admin/ses-config/test
   * Test SES configuration by sending a test email
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
        const { sesService } = await import('./services/sesService');
        const result = await sesService.testConfiguration(req.body.testEmail);
        
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
        console.error('Error testing SES configuration:', error);
        res.status(500).json({ error: 'Failed to test SES configuration' });
      }
    }
  );

  /**
   * POST /api/admin/ses-config/verify
   * Verify an email address with AWS SES
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
        const { sesService } = await import('./services/sesService');
        const success = await sesService.verifyEmailAddress(req.body.email);
        
        if (success) {
          res.json({ 
            message: 'Verification email sent',
            details: 'Please check your email and follow the AWS verification link'
          });
        } else {
          res.status(400).json({ error: 'Failed to send verification email' });
        }
      } catch (error) {
        console.error('Error verifying email address:', error);
        res.status(500).json({ error: 'Failed to verify email address' });
      }
    }
  );

  /**
   * POST /api/admin/ses-config/verify-email
   * Verify an email address with AWS SES (alternative endpoint)
   * This endpoint specifically verifies admin@atcemr.com for sending
   */
  app.post('/api/admin/ses-config/verify-email',
    requireAuth,
    requireRole(['admin', 'hr']),
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const { sesService } = await import('./services/sesService');
        
        // Default to admin@atcemr.com if no email provided
        const emailToVerify = req.body.email || 'admin@atcemr.com';
        
        console.log(`Attempting to verify email address: ${emailToVerify}`);
        const success = await sesService.verifyEmailAddress(emailToVerify);
        
        if (success) {
          res.json({ 
            message: `Verification request sent for ${emailToVerify}`,
            details: 'Please check the email inbox and follow the AWS verification link',
            email: emailToVerify
          });
        } else {
          res.status(400).json({ 
            error: `Failed to send verification email to ${emailToVerify}`,
            details: 'The email may already be verified or there might be an AWS configuration issue'
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
      } catch (error) {
        console.error('Error sending form:', error);
        res.status(500).json({ error: 'Failed to send form' });
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
   * GET /api/forms/submissions/:id/sign
   * Get signing URL for employee
   * Returns the appropriate signing URL for the employee to sign the document
   */
  app.get('/api/forms/submissions/:id/sign',
    requireAuth,
    async (req: AuditRequest, res: Response) => {
      try {
        const submissionId = parseInt(req.params.id);
        const submission = await storage.getFormSubmission(submissionId);
        
        if (!submission) {
          return res.status(404).json({ error: 'Form submission not found' });
        }
        
        // Verify the current user is the employee or has HR permissions
        const employee = await storage.getEmployee(submission.employeeId);
        if (!employee) {
          return res.status(404).json({ error: 'Employee not found' });
        }
        
        const isOwnProfile = employee.userId === req.user!.id;
        const hasManagementRole = req.user!.role === 'admin' || req.user!.role === 'hr';
        
        if (!isOwnProfile && !hasManagementRole) {
          return res.status(403).json({ error: 'Insufficient permissions to access signing URL' });
        }
        
        // Check if form is already completed
        if (submission.status === 'completed') {
          return res.status(400).json({ error: 'Form has already been completed' });
        }
        
        // Return the signing URL
        // If submissionData contains multiple signing URLs, return the employee one
        const submissionData = submission.submissionData as any;
        let signingUrl = submissionData?.signingUrl;
        
        if (submissionData?.signingUrls?.employee) {
          signingUrl = submissionData.signingUrls.employee;
        }
        
        if (!signingUrl) {
          return res.status(400).json({ error: 'No signing URL available for this submission' });
        }
        
        res.json({
          signingUrl,
          submissionId: submission.id,
          status: submission.status,
          employeeId: submission.employeeId
        });
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
   * POST /api/invitations
   * Create a new employee invitation and send email
   */
  app.post('/api/invitations',
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']),
    [
      body('firstName').notEmpty().withMessage('First name is required'),
      body('lastName').notEmpty().withMessage('Last name is required'),
      body('email').isEmail().withMessage('Valid email is required'),
      body('cellPhone').optional().isMobilePhone('any'),
      body('intendedRole').optional().isIn(['admin', 'hr', 'viewer']).withMessage('Invalid role')
    ],
    handleValidationErrors,
    async (req: AuditRequest, res: Response) => {
      try {
        const { firstName, lastName, email, cellPhone, intendedRole } = req.body;
        
        // Role-based invitation permissions
        const requestingUserRole = req.user?.role;
        let roleToAssign = 'viewer'; // Default role
        
        if (intendedRole) {
          if (requestingUserRole === 'admin') {
            // Admin can invite users with any role
            roleToAssign = intendedRole;
          } else if (requestingUserRole === 'hr') {
            // HR can only invite viewers
            if (intendedRole !== 'viewer') {
              return res.status(403).json({ 
                error: 'HR users can only invite users with viewer role' 
              });
            }
            roleToAssign = 'viewer';
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
        const { sesService } = await import('./services/sesService');
        console.log('Attempting to send invitation email to:', email);
        
        // Check if SES is initialized
        const isInitialized = await sesService.initialize();
        console.log('SES Service initialized:', isInitialized);
        
        const emailResult = await sesService.sendInvitationEmail(
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
        const { sesService } = await import('./services/sesService');
        const emailResult = await sesService.sendInvitationEmail(
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
    validatePagination(),
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
        const { page = '1', limit = '10', search, isPrimary } = req.query;
        const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
        
        const result = await storage.getResponsiblePersons({
          limit: parseInt(limit as string),
          offset,
          search: search as string,
          isPrimary: isPrimary === 'true' ? true : isPrimary === 'false' ? false : undefined
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
    validateId(),
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
  
  // GET /api/clinic-licenses/expiring - Get expiring licenses
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
        
        // Always return 200 with the results (even if empty)
        res.json({
          licenses: licenses || [],
          count: (licenses || []).length,
          withinDays: daysNumber
        });
      } catch (error) {
        console.error('Error fetching expiring licenses:', error);
        // Return 200 with empty array instead of 500 error
        res.status(200).json({ 
          licenses: [],
          count: 0,
          withinDays: 30
        });
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
    upload.single('document'),
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
        
        const versions = await storage.getComplianceDocumentVersions(document.documentNumber);
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

  const httpServer = createServer(app);
  return httpServer;
}
