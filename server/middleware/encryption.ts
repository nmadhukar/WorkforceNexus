/**
 * @fileoverview Encryption Middleware for Sensitive Data Protection
 * 
 * This module provides encryption and decryption utilities for protecting
 * sensitive employee data such as SSN, passwords, and other PII. It uses
 * AES-256-GCM encryption to ensure data security both at rest and in transit.
 * 
 * Features:
 * - AES-256-GCM encryption for authenticated encryption
 * - Automatic field-level encryption for sensitive data
 * - SSN masking for display purposes
 * - Batch encryption/decryption for multiple fields
 * 
 * @module encryption
 * @requires crypto
 */

import crypto from "crypto";

/**
 * Encryption algorithm used for all sensitive data
 * @constant {string}
 */
const algorithm = 'aes-256-gcm';

/**
 * Secret key for encryption, sourced from environment or fallback
 * @constant {string}
 */
const secretKey = process.env.SECRET_KEY || 'default-secret-key-change-in-production';

/**
 * Derived encryption key using scrypt key derivation
 * @constant {Buffer}
 */
const key = crypto.scryptSync(secretKey, 'salt', 32);

/**
 * Encrypt sensitive text using AES-256-GCM
 * 
 * @function encrypt
 * @param {string} text - Plain text to encrypt
 * @returns {string} Encrypted text in format "iv:authTag:encryptedData" or original text if empty
 * 
 * @description
 * Encrypts sensitive data using AES-256-GCM authenticated encryption.
 * The function returns the encrypted data in a format that includes:
 * - Initialization Vector (IV) for randomization
 * - Authentication Tag for integrity verification
 * - Encrypted data
 * 
 * All components are hex-encoded and separated by colons for easy parsing.
 * Empty or null input is returned unchanged for compatibility.
 * 
 * @throws {Error} Throws if encryption fails due to invalid input or crypto errors
 * 
 * @example
 * const ssn = "123-45-6789";
 * const encryptedSSN = encrypt(ssn);
 * // Returns: "a1b2c3d4....:e5f6g7h8....:9i0j1k2l...."
 */
export function encrypt(text: string): string {
  if (!text) return text;
  
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(algorithm, key);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt AES-256-GCM encrypted text
 * 
 * @function decrypt
 * @param {string} encryptedText - Encrypted text in format "iv:authTag:encryptedData"
 * @returns {string} Decrypted plain text or original text if decryption fails
 * 
 * @description
 * Decrypts data that was encrypted using the encrypt() function.
 * Expects the input to be in the format "iv:authTag:encryptedData"
 * where all components are hex-encoded.
 * 
 * The function gracefully handles errors by:
 * - Returning the original text if format is invalid
 * - Logging errors for debugging
 * - Never throwing exceptions to avoid breaking the application
 * 
 * @throws {Error} Does not throw - handles all errors gracefully
 * 
 * @example
 * const encryptedSSN = "a1b2c3d4....:e5f6g7h8....:9i0j1k2l....";
 * const plainSSN = decrypt(encryptedSSN);
 * // Returns: "123-45-6789"
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText || !encryptedText.includes(':')) return encryptedText;
  
  try {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipher(algorithm, key);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    return encryptedText; // Return original if decryption fails
  }
}

/**
 * Mask Social Security Number for display purposes
 * 
 * @function maskSSN
 * @param {string} ssn - Encrypted or plain SSN to mask
 * @returns {string} Masked SSN showing only last 4 digits ("***-**-XXXX")
 * 
 * @description
 * Creates a masked version of an SSN for secure display in UI components.
 * The function:
 * - Automatically decrypts encrypted SSN values
 * - Shows only the last 4 digits for identification
 * - Maintains consistent format for display
 * - Handles empty or invalid inputs gracefully
 * 
 * Used throughout the UI to display SSN information without exposing
 * the full number for security and privacy compliance.
 * 
 * @example
 * const encryptedSSN = encrypt("123-45-6789");
 * const masked = maskSSN(encryptedSSN);
 * // Returns: "***-**-6789"
 * 
 * @example
 * const plainSSN = "123456789";
 * const masked = maskSSN(plainSSN);
 * // Returns: "***-**-6789"
 */
export function maskSSN(ssn: string): string {
  if (!ssn) return '';
  const decryptedSSN = decrypt(ssn);
  if (decryptedSSN.length >= 4) {
    return '***-**-' + decryptedSSN.slice(-4);
  }
  return '***-**-****';
}

/**
 * Encrypt sensitive fields in an object
 * 
 * @function encryptSensitiveFields
 * @param {any} data - Object containing potentially sensitive data
 * @returns {any} Object with sensitive fields encrypted
 * 
 * @description
 * Automatically encrypts predefined sensitive fields in an object.
 * This function is used as middleware to encrypt data before storing
 * it in the database. Currently encrypts:
 * - ssn: Social Security Numbers
 * - caqhPassword: CAQH provider passwords
 * - nppesPassword: NPPES registry passwords
 * 
 * Only encrypts fields that have non-empty values. Empty or null
 * fields are left unchanged. Creates a shallow copy of the input
 * object to avoid modifying the original.
 * 
 * @example
 * const employeeData = {
 *   firstName: "John",
 *   lastName: "Doe",
 *   ssn: "123-45-6789",
 *   caqhPassword: "secretPassword"
 * };
 * const encrypted = encryptSensitiveFields(employeeData);
 * // Returns: {
 * //   firstName: "John",
 * //   lastName: "Doe", 
 * //   ssn: "a1b2c3d4....:e5f6g7h8....:9i0j1k2l....",
 * //   caqhPassword: "x9y8z7w6....:m5n4o3p2....:q1r0s9t8...."
 * // }
 */
export function encryptSensitiveFields(data: any): any {
  if (!data) return data;
  
  const sensitiveFields = ['ssn', 'caqhPassword', 'nppesPassword'];
  const result = { ...data };
  
  sensitiveFields.forEach(field => {
    if (result[field]) {
      result[field] = encrypt(result[field]);
    }
  });
  
  return result;
}

/**
 * Decrypt sensitive fields in an object
 * 
 * @function decryptSensitiveFields
 * @param {any} data - Object containing encrypted sensitive data
 * @returns {any} Object with sensitive fields decrypted
 * 
 * @description
 * Automatically decrypts predefined sensitive fields in an object.
 * This function is used to decrypt data retrieved from the database
 * before processing or returning to authorized users. Decrypts:
 * - ssn: Social Security Numbers
 * - caqhPassword: CAQH provider passwords
 * - nppesPassword: NPPES registry passwords
 * 
 * Only processes fields that have non-empty values. Empty or null
 * fields are left unchanged. Creates a shallow copy of the input
 * object to avoid modifying the original.
 * 
 * Gracefully handles decryption failures by leaving the field
 * in its original encrypted state and logging errors.
 * 
 * @example
 * const encryptedData = {
 *   firstName: "John",
 *   lastName: "Doe",
 *   ssn: "a1b2c3d4....:e5f6g7h8....:9i0j1k2l....",
 *   caqhPassword: "x9y8z7w6....:m5n4o3p2....:q1r0s9t8...."
 * };
 * const decrypted = decryptSensitiveFields(encryptedData);
 * // Returns: {
 * //   firstName: "John",
 * //   lastName: "Doe",
 * //   ssn: "123-45-6789",
 * //   caqhPassword: "secretPassword"
 * // }
 */
export function decryptSensitiveFields(data: any): any {
  if (!data) return data;
  
  const sensitiveFields = ['ssn', 'caqhPassword', 'nppesPassword'];
  const result = { ...data };
  
  sensitiveFields.forEach(field => {
    if (result[field]) {
      result[field] = decrypt(result[field]);
    }
  });
  
  return result;
}
