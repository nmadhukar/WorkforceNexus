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
import { encryptSensitiveFields, decryptSensitiveFields, maskSSN } from "./middleware/encryption";
import { auditMiddleware, logAudit, AuditRequest } from "./middleware/audit";
import { startCronJobs, manualExpirationCheck } from "./services/cronJobs";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";

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
  // Employee routes
  app.get('/api/employees', 
    requireAuth, 
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
    requireAuth, 
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
    requireAuth, 
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
    requireAuth, 
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
    requireAuth, 
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

  // Education routes
  app.get('/api/employees/:id/educations', 
    requireAuth, 
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
    requireAuth, 
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
  // State Licenses
  app.get('/api/employees/:id/state-licenses', requireAuth, validateId(), handleValidationErrors,
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
    requireAuth, requireRole(['admin', 'hr']), auditMiddleware('state_licenses'),
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

  // DEA Licenses
  app.get('/api/employees/:id/dea-licenses', requireAuth, validateId(), handleValidationErrors,
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
    requireAuth, requireRole(['admin', 'hr']), auditMiddleware('dea_licenses'),
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

  // Documents routes
  app.get('/api/documents', 
    requireAuth, 
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
    requireAuth, 
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
        
        const document = await storage.createDocument({
          employeeId,
          documentType: req.body.documentType,
          filePath: req.file.path,
          signedDate: req.body.signedDate || null,
          notes: req.body.notes || null
        });
        
        res.status(201).json(document);
      } catch (error) {
        console.error('Error uploading document:', error);
        res.status(500).json({ error: 'Failed to upload document' });
      }
    }
  );

  app.get('/api/documents/:id/download', 
    requireAuth,
    async (req: AuditRequest, res) => {
      try {
        const document = await storage.getDocuments({ 
          limit: 1, 
          offset: 0,
          employeeId: parseInt(req.params.id) 
        });
        
        if (!document.documents[0] || !document.documents[0].filePath) {
          return res.status(404).json({ error: 'Document not found' });
        }
        
        const filePath = document.documents[0].filePath;
        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ error: 'File not found on disk' });
        }
        
        res.download(filePath);
      } catch (error) {
        console.error('Error downloading document:', error);
        res.status(500).json({ error: 'Failed to download document' });
      }
    }
  );

  // Complete CRUD for Educations (adding PUT and DELETE)
  app.put('/api/educations/:id', 
    requireAuth, requireRole(['admin', 'hr']), auditMiddleware('educations'),
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
    requireAuth, requireRole(['admin', 'hr']), auditMiddleware('educations'),
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
    requireAuth, requireRole(['admin', 'hr']), auditMiddleware('state_licenses'),
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
    requireAuth, requireRole(['admin', 'hr']), auditMiddleware('state_licenses'),
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
    requireAuth, requireRole(['admin', 'hr']), auditMiddleware('dea_licenses'),
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
    requireAuth, requireRole(['admin', 'hr']), auditMiddleware('dea_licenses'),
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

  // Full CRUD for Employments
  app.get('/api/employees/:id/employments', requireAuth, validateId(), handleValidationErrors,
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
    requireAuth, requireRole(['admin', 'hr']), auditMiddleware('employments'),
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
    requireAuth, requireRole(['admin', 'hr']), auditMiddleware('employments'),
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
    requireAuth, requireRole(['admin', 'hr']), auditMiddleware('employments'),
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

  // Full CRUD for Peer References
  app.get('/api/employees/:id/peer-references', requireAuth, validateId(), handleValidationErrors,
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
    requireAuth, requireRole(['admin', 'hr']), auditMiddleware('peer_references'),
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
    requireAuth, requireRole(['admin', 'hr']), auditMiddleware('peer_references'),
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
    requireAuth, requireRole(['admin', 'hr']), auditMiddleware('peer_references'),
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

  // Full CRUD for Board Certifications
  app.get('/api/employees/:id/board-certifications', requireAuth, validateId(), handleValidationErrors,
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
    requireAuth, requireRole(['admin', 'hr']), auditMiddleware('board_certifications'),
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
    requireAuth, requireRole(['admin', 'hr']), auditMiddleware('board_certifications'),
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
    requireAuth, requireRole(['admin', 'hr']), auditMiddleware('board_certifications'),
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

  // Full CRUD for Emergency Contacts
  app.get('/api/employees/:id/emergency-contacts', requireAuth, validateId(), handleValidationErrors,
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
    requireAuth, requireRole(['admin', 'hr']), auditMiddleware('emergency_contacts'),
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
    requireAuth, requireRole(['admin', 'hr']), auditMiddleware('emergency_contacts'),
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
    requireAuth, requireRole(['admin', 'hr']), auditMiddleware('emergency_contacts'),
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

  // Full CRUD for Tax Forms
  app.get('/api/employees/:id/tax-forms', requireAuth, validateId(), handleValidationErrors,
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
    requireAuth, requireRole(['admin', 'hr']), auditMiddleware('tax_forms'),
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
    requireAuth, requireRole(['admin', 'hr']), auditMiddleware('tax_forms'),
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
    requireAuth, requireRole(['admin', 'hr']), auditMiddleware('tax_forms'),
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

  // Full CRUD for Trainings
  app.get('/api/employees/:id/trainings', requireAuth, validateId(), handleValidationErrors,
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
    requireAuth, requireRole(['admin', 'hr']), auditMiddleware('trainings'),
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
    requireAuth, requireRole(['admin', 'hr']), auditMiddleware('trainings'),
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
    requireAuth, requireRole(['admin', 'hr']), auditMiddleware('trainings'),
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

  // Full CRUD for Payer Enrollments
  app.get('/api/employees/:id/payer-enrollments', requireAuth, validateId(), handleValidationErrors,
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
    requireAuth, requireRole(['admin', 'hr']), auditMiddleware('payer_enrollments'),
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
    requireAuth, requireRole(['admin', 'hr']), auditMiddleware('payer_enrollments'),
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
    requireAuth, requireRole(['admin', 'hr']), auditMiddleware('payer_enrollments'),
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

  // Full CRUD for Incident Logs
  app.get('/api/employees/:id/incident-logs', requireAuth, validateId(), handleValidationErrors,
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
    requireAuth, requireRole(['admin', 'hr']), auditMiddleware('incident_logs'),
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
    requireAuth, requireRole(['admin', 'hr']), auditMiddleware('incident_logs'),
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
    requireAuth, requireRole(['admin', 'hr']), auditMiddleware('incident_logs'),
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

  // Reports routes
  app.get('/api/reports/expiring', 
    requireAuth,
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
    requireAuth,
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

  // Audit routes
  app.get('/api/audits', 
    requireAuth, 
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
