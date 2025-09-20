import { body, param, query, ValidationChain, validationResult } from "express-validator";
import { Request, Response, NextFunction } from "express";

export const validateEmployee = (): ValidationChain[] => [
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('workEmail').isEmail().withMessage('Valid work email is required'),
  body('dateOfBirth').optional().isDate().withMessage('Valid date of birth required'),
  body('ssn').optional().matches(/^\d{3}-?\d{2}-?\d{4}$/).withMessage('Valid SSN format required')
];

export const validateEducation = (): ValidationChain[] => [
  body('employeeId').isInt().withMessage('Employee ID must be an integer'),
  body('schoolInstitution').optional().isLength({ min: 1 }).withMessage('School institution cannot be empty'),
  body('degree').optional().isLength({ min: 1 }).withMessage('Degree cannot be empty')
];

export const validateLicense = (): ValidationChain[] => [
  body('employeeId').isInt().withMessage('Employee ID must be an integer'),
  body('licenseNumber').notEmpty().withMessage('License number is required'),
  body('state').optional().isLength({ min: 2, max: 2 }).withMessage('State must be 2 characters'),
  body('expirationDate').optional().isDate().withMessage('Valid expiration date required')
];

export const validateDocument = (): ValidationChain[] => [
  body('employeeId').isInt().withMessage('Employee ID must be an integer'),
  body('documentType').notEmpty().withMessage('Document type is required')
];

export const validatePagination = (): ValidationChain[] => [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().isLength({ max: 255 }).withMessage('Search term too long')
];

export const validateId = (): ValidationChain[] => [
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer')
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
