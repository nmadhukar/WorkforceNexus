/**
 * @fileoverview Express Validation Middleware for HR Management System
 * 
 * This module provides comprehensive input validation for all API endpoints
 * using express-validator. It ensures data integrity and security by validating
 * request parameters, query strings, and body content before processing.
 * 
 * Validation rules are designed to meet healthcare compliance requirements
 * and protect against common security vulnerabilities like SQL injection.
 * 
 * @module validation
 * @requires express-validator
 * @requires express
 */

import { body, param, query, ValidationChain, validationResult } from "express-validator";
import { Request, Response, NextFunction } from "express";

/**
 * Validate employee data for creation and updates
 * 
 * @function validateEmployee
 * @returns {ValidationChain[]} Array of validation rules
 * 
 * @description Validates:
 * - firstName: Required, non-empty string
 * - lastName: Required, non-empty string
 * - workEmail: Required, valid email format
 * - dateOfBirth: Optional, valid date (YYYY-MM-DD)
 * - ssn: Optional, valid SSN format (XXX-XX-XXXX or XXXXXXXXX)
 * 
 * @example
 * app.post('/api/employees', validateEmployee(), handleValidationErrors, ...)
 */
export const validateEmployee = (): ValidationChain[] => [
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('workEmail').isEmail().withMessage('Valid work email is required'),
  body('dateOfBirth').optional().isDate().withMessage('Valid date of birth required'),
  body('ssn').optional().matches(/^\d{3}-?\d{2}-?\d{4}$/).withMessage('Valid SSN format required')
];

/**
 * Validate education record data
 * 
 * @function validateEducation
 * @returns {ValidationChain[]} Array of validation rules
 * 
 * @description For medical staff education records including:
 * - Medical school
 * - Residency programs
 * - Fellowship training
 * - Continuing education
 */
export const validateEducation = (): ValidationChain[] => [
  body('schoolInstitution').optional().isLength({ min: 1 }).withMessage('School institution cannot be empty'),
  body('degree').optional().isLength({ min: 1 }).withMessage('Degree cannot be empty')
];

/**
 * Validate medical license data (State and DEA)
 * 
 * @function validateLicense
 * @returns {ValidationChain[]} Array of validation rules
 * 
 * @description Validates both:
 * - State medical licenses
 * - DEA licenses for controlled substances
 * - License numbers must be unique
 * - Expiration dates for compliance tracking
 */
export const validateLicense = (): ValidationChain[] => [
  body('licenseNumber').notEmpty().withMessage('License number is required'),
  // body('state').optional().matches(/^[A-Z]{2}$/).withMessage('State must be a 2-letter uppercase code'),
  body('expirationDate').optional().isDate().withMessage('Valid expiration date required')
];

export const validateDocument = (): ValidationChain[] => [
  body('documentType').notEmpty().withMessage('Document type is required')
];

/**
 * Validate pagination parameters for list endpoints
 * 
 * @function validatePagination
 * @returns {ValidationChain[]} Array of validation rules
 * 
 * @description Validates query parameters:
 * - page: Positive integer (default: 1)
 * - limit: 1-100 items per page (default: 10)
 * - search: Maximum 255 characters to prevent DoS
 * 
 * @example
 * // GET /api/employees?page=2&limit=20&search=john
 * app.get('/api/employees', validatePagination(), ...)
 */
export const validatePagination = (): ValidationChain[] => [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().isLength({ max: 255 }).withMessage('Search term too long')
];

export const validateId = (): ValidationChain[] => [
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer')
];

/**
 * Validate a numeric route param by name
 *
 * @function validateParamId
 * @param {string} paramName - The route param name to validate
 * @returns {ValidationChain[]} Array of validation rules
 */
export const validateParamId = (paramName: string): ValidationChain[] => [
  param(paramName).isInt({ min: 1 }).withMessage(`${paramName} must be a positive integer`)
];

// Employment validation
export const validateEmployment = (): ValidationChain[] => [
  body('employer').optional().isLength({ min: 1 }).withMessage('Employer cannot be empty'),
  body('position').optional().isLength({ min: 1 }).withMessage('Position cannot be empty'),
  // Accept YYYY-MM-DD or ISO strings and coerce to date
  body('startDate')
    .optional({ checkFalsy: true })
    .customSanitizer((v) => (typeof v === 'string' ? v.split('T')[0] : v))
    .isDate()
    .withMessage('Valid start date required'),
  body('endDate')
    .optional({ checkFalsy: true })
    .customSanitizer((v) => (typeof v === 'string' ? v.split('T')[0] : v))
    .isDate()
    .withMessage('Valid end date required')
];

// Peer Reference validation
export const validatePeerReference = (): ValidationChain[] => [
  body('referenceName').optional().isLength({ min: 1 }).withMessage('Reference name cannot be empty'),
  body('contactInfo').optional().isLength({ min: 1 }).withMessage('Contact info cannot be empty'),
  body('relationship').optional().isLength({ min: 1 }).withMessage('Relationship cannot be empty')
];

// Board Certification validation
export const validateBoardCertification = (): ValidationChain[] => [
  body('boardName').optional().isLength({ min: 1 }).withMessage('Board name cannot be empty'),
  body('certification').optional().isLength({ min: 1 }).withMessage('Certification cannot be empty'),
  body('issueDate').optional().isDate().withMessage('Valid issue date required'),
  body('expirationDate').optional().isDate().withMessage('Valid expiration date required')
];

// Emergency Contact validation
export const validateEmergencyContact = (): ValidationChain[] => [
  body('name').notEmpty().withMessage('Contact name is required'),
  body('relationship').notEmpty().withMessage('Relationship is required'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('email').optional().isEmail().withMessage('Valid email required')
];

// Tax Form validation
export const validateTaxForm = (): ValidationChain[] => [
  body('formType').notEmpty().withMessage('Form type is required'),
  body('year').isInt({ min: 1900, max: 2100 }).withMessage('Valid year required'),
  body('status').optional().isLength({ min: 1 }).withMessage('Status cannot be empty')
];

// Training validation
export const validateTraining = (): ValidationChain[] => [
  body('trainingType').notEmpty().withMessage('Training name is required'),
  body('provider').optional().isLength({ min: 1 }).withMessage('Provider cannot be empty'),
  body('completionDate').optional().isDate().withMessage('Valid completion date required'),
  body('expirationDate').optional().isDate().withMessage('Valid expiration date required')
];

// Payer Enrollment validation
export const validatePayerEnrollment = (): ValidationChain[] => [
  body('payerName').notEmpty().withMessage('Payer name is required'),
  body('enrollmentStatus').optional().isLength({ min: 1 }).withMessage('Status cannot be empty'),
  body('effectiveDate').optional().isDate().withMessage('Valid effective date required'),
  body('terminationDate').optional().isDate().withMessage('Valid termination date required')
];

// Incident Log validation
/**
 * Validate incident log data for compliance tracking
 * 
 * @function validateIncidentLog
 * @returns {ValidationChain[]} Array of validation rules
 * 
 * @description For healthcare incident reporting:
 * - Patient safety incidents
 * - Medication errors
 * - HIPAA violations
 * - Professional conduct issues
 * 
 * Severity levels:
 * - low: Minor issues with no patient impact
 * - medium: Issues requiring review
 * - high: Significant incidents requiring immediate action
 * - critical: Major safety or compliance violations
 */
export const validateIncidentLog = (): ValidationChain[] => [
  body('incidentDate').notEmpty().isDate().withMessage('Incident date is required'),
  body('incidentType').notEmpty().withMessage('Incident type is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('severity').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid severity level')
];

/**
 * Validate user data for creation and updates (admin operations)
 * 
 * @function validateUser
 * @returns {ValidationChain[]} Array of validation rules
 * 
 * @description Validates user management operations including:
 * - username: Required, 3-50 characters, alphanumeric + underscore/dot
 * - email: Optional but if provided must be valid email format
 * - role: Must be one of admin, hr, viewer
 * - status: Must be one of active, suspended, locked, disabled
 */
export const validateUser = (): ValidationChain[] => [
  body('username')
    .optional()
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be 3-50 characters')
    .matches(/^[a-zA-Z0-9._]+$/)
    .withMessage('Username can only contain letters, numbers, dots and underscores'),
  body('email')
    .optional({ checkFalsy: true })
    .isEmail()
    .withMessage('Valid email is required'),
  body('role')
    .optional()
    .isIn(['admin', 'hr', 'prospective_employee', 'employee'])
    .withMessage('Role must be admin, hr, prospective_employee, or employee'),
  body('status')
    .optional()
    .isIn(['active', 'suspended', 'locked', 'disabled'])
    .withMessage('Status must be active, suspended, locked, or disabled')
];

/**
 * Validate user status update
 * 
 * @function validateUserStatus
 * @returns {ValidationChain[]} Array of validation rules
 */
export const validateUserStatus = (): ValidationChain[] => [
  body('status')
    .isIn(['active', 'suspended', 'locked', 'disabled'])
    .withMessage('Status must be active, suspended, locked, or disabled')
];

/**
 * Validate password change request
 * 
 * @function validatePasswordChange
 * @returns {ValidationChain[]} Array of validation rules
 */
export const validatePasswordChange = (): ValidationChain[] => [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('New password must contain uppercase, lowercase, number, and special character'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match');
      }
      return true;
    })
];

/**
 * Validate password reset request
 * 
 * @function validatePasswordReset
 * @returns {ValidationChain[]} Array of validation rules
 */
export const validatePasswordReset = (): ValidationChain[] => [
  body('email')
    .isEmail()
    .withMessage('Valid email is required')
];

/**
 * Validate password reset confirmation
 * 
 * @function validatePasswordResetConfirm
 * @returns {ValidationChain[]} Array of validation rules
 */
export const validatePasswordResetConfirm = (): ValidationChain[] => [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required')
    .isLength({ min: 32 })
    .withMessage('Invalid token format'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('New password must contain uppercase, lowercase, number, and special character'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match');
      }
      return true;
    })
];

/**
 * Middleware to handle validation errors
 * 
 * @function handleValidationErrors
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next middleware function
 * 
 * @description Checks validation results and returns detailed error messages
 * if validation fails. Must be used after validation middleware.
 * 
 * @returns {Response|void} 400 error with details or calls next()
 * 
 * @example response - 400
 * {
 *   "error": "Validation failed",
 *   "details": [
 *     {
 *       "type": "field",
 *       "msg": "First name is required",
 *       "path": "firstName",
 *       "location": "body"
 *     }
 *   ]
 * }
 */
// Location validation
export const validateLocation = (): ValidationChain[] => [
  body('name').notEmpty().withMessage('Location name is required'),
  body('type').isIn(['main_org', 'sub_location', 'department', 'facility']).withMessage('Invalid location type'),
  body('status').optional().isIn(['active', 'inactive', 'suspended', 'closed']).withMessage('Invalid status'),
  body('parentId').optional().isInt({ min: 1 }).withMessage('Parent ID must be a positive integer'),
  body('email').optional().isEmail().withMessage('Valid email required')
];

// License Type validation
export const validateLicenseType = (): ValidationChain[] => [
  body('name').notEmpty().withMessage('License type name is required'),
  body('code').notEmpty().withMessage('License type code is required'),
  body('category').isIn(['medical', 'pharmacy', 'facility', 'business', 'other']).withMessage('Invalid category'),
  body('renewalPeriodMonths').optional().isInt({ min: 1 }).withMessage('Renewal period must be positive'),
  body('leadTimeDays').optional().isInt({ min: 1 }).withMessage('Lead time must be positive'),
  body('alertDaysBefore').optional().isInt({ min: 1 }).withMessage('Alert days must be positive')
];

// Responsible Person validation
export const validateResponsiblePerson = (): ValidationChain[] => [
  body('email').notEmpty().isEmail().withMessage('Valid email is required'),
  body('firstName').optional().notEmpty().withMessage('First name is required'),
  body('lastName').optional().notEmpty().withMessage('Last name is required'),
  body('preferredContactMethod').optional().isIn(['email', 'phone', 'sms']).withMessage('Invalid contact method'),
  body('status').optional().isIn(['active', 'inactive', 'on_leave']).withMessage('Invalid status')
];

// Clinic License validation
export const validateClinicLicense = (): ValidationChain[] => [
  body('locationId').isInt({ min: 1 }).withMessage('Location ID is required'),
  body('licenseTypeId').isInt({ min: 1 }).withMessage('License type ID is required'),
  body('licenseNumber').notEmpty().withMessage('License number is required'),
  body('issueDate').isDate().withMessage('Valid issue date required'),
  body('expirationDate').isDate().withMessage('Valid expiration date required'),
  body('responsiblePersonId').optional().isInt({ min: 1 }).withMessage('Responsible person ID must be positive'),
  body('status').optional().isIn(['active', 'expiring_soon', 'expired', 'suspended', 'revoked', 'pending_renewal']).withMessage('Invalid status'),
  body('renewalStatus').optional().isIn(['not_started', 'in_progress', 'submitted', 'approved', 'rejected']).withMessage('Invalid renewal status'),
  body('complianceStatus').optional().isIn(['compliant', 'warning', 'non_compliant']).withMessage('Invalid compliance status')
];

// Compliance Document validation
export const validateComplianceDocument = (): ValidationChain[] => [
  body('clinicLicenseId').isInt({ min: 1 }).withMessage('Clinic license ID is required'),
  body('documentType').isIn(['license_certificate', 'renewal_application', 'inspection_report', 'sop', 'policy', 'other']).withMessage('Invalid document type'),
  body('documentName').notEmpty().withMessage('Document name is required'),
  body('locationId').optional().isInt({ min: 1 }).withMessage('Location ID must be positive'),
  body('status').optional().isIn(['active', 'archived', 'superseded', 'draft', 'pending_approval']).withMessage('Invalid status'),
  body('confidentialityLevel').optional().isIn(['public', 'internal', 'confidential', 'restricted']).withMessage('Invalid confidentiality level')
];

// License renewal validation
export const validateLicenseRenewal = (): ValidationChain[] => [
  body('newIssueDate').isDate().withMessage('Valid issue date required'),
  body('newExpirationDate').isDate().withMessage('Valid expiration date required'),
  body('renewalCost').optional().isNumeric().withMessage('Renewal cost must be numeric')
];

export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};
