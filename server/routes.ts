import type { Express, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { validateEmployee, validateEducation, validateLicense, validateDocument, validatePagination, validateId, handleValidationErrors } from "./middleware/validation";
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

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// File upload configuration
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

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

// Authentication middleware
const requireAuth = (req: AuditRequest, res: Response, next: any) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

const requireRole = (roles: string[]) => {
  return (req: AuditRequest, res: Response, next: any) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Apply rate limiting
  app.use('/api', limiter);
  
  // Setup authentication
  setupAuth(app);
  
  // Start cron jobs
  startCronJobs();

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
        
        const document = await storage.createDocument({
          employeeId: parseInt(req.body.employeeId),
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
