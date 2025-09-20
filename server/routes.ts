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
import { documents } from "@shared/schema";
import { eq, or, sql, count } from "drizzle-orm";

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
  // Employee routes - accessible via API key or session
  app.get('/api/employees', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:employees'), 
    validatePagination(), 
    handleValidationErrors,
    async (req: AuditRequest, res) => {
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

  app.get('/api/employees/:id', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('read:employees'), 
    validateId(), 
    handleValidationErrors,
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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

  // Complete CRUD for Educations (adding PUT and DELETE)
  app.put('/api/educations/:id', 
    apiKeyAuth,
    requireAnyAuth,
    requirePermission('write:employees'),
    requireRole(['admin', 'hr']), auditMiddleware('educations'),
    validateId(), validateEducation(), handleValidationErrors,
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
      try {
        const stats = await storage.getEmployeeStats();
        res.json(stats);
      } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
          (p: string) => p !== '*' && !validPermissions.includes(p)
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
        await logAudit(
          'api_keys',
          apiKey.id,
          'CREATE',
          null,
          null,
          apiKey
        );
        
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
    async (req: AuditRequest, res) => {
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
        await logAudit(
          'api_keys',
          keyId,
          'REVOKE',
          key,
          null,
          { revokedBy: req.user!.id }
        );
        
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
    async (req: AuditRequest, res) => {
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
          metadata: oldKey.metadata
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
        await logAudit(
          'api_key_rotations',
          newKey.id,
          'ROTATE',
          oldKey,
          newKey,
          { gracePeriodHours, reason }
        );
        
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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
          await logAudit(
            req,
            0,
            'MIGRATE_TO_S3',
            { documentCount: localDocuments.length },
            results,
            {}
          );
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
    async (req: AuditRequest, res) => {
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
    async (req: AuditRequest, res) => {
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

  const httpServer = createServer(app);
  return httpServer;
}
