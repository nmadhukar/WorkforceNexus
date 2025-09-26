/**
 * Mock Encryption Utilities for Testing
 * 
 * Simulates encryption/decryption operations for sensitive data including:
 * - SSN encryption and masking
 * - Password hashing
 * - Field-level encryption
 * - Batch operations
 * - Encryption failures
 */

import { vi } from 'vitest';
import crypto from 'crypto';

// Configuration for mock behavior
let mockConfig = {
  shouldFailEncrypt: false,
  shouldFailDecrypt: false,
  shouldFailMask: false,
  useRealEncryption: false, // Toggle for testing real encryption logic
  encryptionPrefix: 'encrypted:',
  maskPattern: '***-**-'
};

// Track encryption operations for testing
const encryptionStats = {
  totalEncrypted: 0,
  totalDecrypted: 0,
  totalMasked: 0,
  totalFailed: 0
};

// Mock encrypted data storage for consistent testing
const mockEncryptedData = new Map<string, string>();

/**
 * Mock encryption function
 * 
 * @param {string} text - Plain text to encrypt
 * @returns {string} Mock encrypted text or real encryption if configured
 */
export function encrypt(text: string): string {
  if (!text) return text;
  
  if (mockConfig.shouldFailEncrypt) {
    encryptionStats.totalFailed++;
    throw new Error('Encryption failed: Mock error');
  }

  encryptionStats.totalEncrypted++;

  if (mockConfig.useRealEncryption) {
    // Use simplified real encryption for testing
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync('test-secret-key', 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  // Simple mock encryption - reversible for testing
  const mockEncrypted = `${mockConfig.encryptionPrefix}${Buffer.from(text).toString('base64')}`;
  mockEncryptedData.set(mockEncrypted, text);
  return mockEncrypted;
}

/**
 * Mock decryption function
 * 
 * @param {string} encryptedText - Encrypted text to decrypt
 * @returns {string} Mock decrypted text or real decryption if configured
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return encryptedText;
  
  if (mockConfig.shouldFailDecrypt) {
    encryptionStats.totalFailed++;
    return encryptedText; // Return original on failure
  }

  encryptionStats.totalDecrypted++;

  if (mockConfig.useRealEncryption) {
    try {
      const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
      const algorithm = 'aes-256-gcm';
      const key = crypto.scryptSync('test-secret-key', 'salt', 32);
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error);
      return encryptedText;
    }
  }

  // Simple mock decryption
  if (encryptedText.startsWith(mockConfig.encryptionPrefix)) {
    const base64Text = encryptedText.slice(mockConfig.encryptionPrefix.length);
    try {
      return Buffer.from(base64Text, 'base64').toString('utf8');
    } catch {
      return encryptedText;
    }
  }

  // Check mock storage
  const original = mockEncryptedData.get(encryptedText);
  return original || encryptedText;
}

/**
 * Mock SSN masking function
 * 
 * @param {string} ssn - SSN to mask (encrypted or plain)
 * @returns {string} Masked SSN showing only last 4 digits
 */
export function mask(ssn: string): string {
  if (!ssn) return ssn;
  
  if (mockConfig.shouldFailMask) {
    encryptionStats.totalFailed++;
    return ssn;
  }

  encryptionStats.totalMasked++;

  // Decrypt first if encrypted
  const plainSsn = ssn.startsWith(mockConfig.encryptionPrefix) ? decrypt(ssn) : ssn;
  
  // Remove any non-digits for consistent masking
  const digits = plainSsn.replace(/\D/g, '');
  
  if (digits.length === 9) {
    return `${mockConfig.maskPattern}${digits.slice(-4)}`;
  } else if (digits.length === 4) {
    // Already masked or partial SSN
    return `${mockConfig.maskPattern}${digits}`;
  }
  
  // Return original if format is unexpected
  return plainSsn;
}

/**
 * Mock password hashing function
 * 
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Mock hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password) {
    throw new Error('Password is required');
  }

  if (mockConfig.shouldFailEncrypt) {
    throw new Error('Password hashing failed: Mock error');
  }

  // Simple mock hash - includes password length for testing validation
  const mockHash = `$mock$v1$${password.length}$${Buffer.from(password).toString('base64')}`;
  return mockHash;
}

/**
 * Mock password comparison function
 * 
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password to compare
 * @returns {Promise<boolean>} True if passwords match
 */
export async function comparePasswords(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) {
    return false;
  }

  if (hash.startsWith('$mock$v1$')) {
    // Mock hash comparison
    const parts = hash.split('$');
    const encodedPassword = parts[4];
    const decodedPassword = Buffer.from(encodedPassword, 'base64').toString('utf8');
    return password === decodedPassword;
  }

  // For non-mock hashes, do simple comparison
  return password === hash;
}

/**
 * Batch encrypt multiple fields in an object
 * 
 * @param {Record<string, any>} obj - Object with fields to encrypt
 * @param {string[]} fields - Field names to encrypt
 * @returns {Record<string, any>} Object with encrypted fields
 */
export function encryptFields(obj: Record<string, any>, fields: string[]): Record<string, any> {
  const result = { ...obj };
  
  for (const field of fields) {
    if (result[field] !== null && result[field] !== undefined) {
      result[field] = encrypt(String(result[field]));
    }
  }
  
  return result;
}

/**
 * Batch decrypt multiple fields in an object
 * 
 * @param {Record<string, any>} obj - Object with fields to decrypt
 * @param {string[]} fields - Field names to decrypt
 * @returns {Record<string, any>} Object with decrypted fields
 */
export function decryptFields(obj: Record<string, any>, fields: string[]): Record<string, any> {
  const result = { ...obj };
  
  for (const field of fields) {
    if (result[field] !== null && result[field] !== undefined) {
      result[field] = decrypt(String(result[field]));
    }
  }
  
  return result;
}

/**
 * Generate a secure random token for testing
 * 
 * @param {number} length - Token length in bytes
 * @returns {string} Base64 URL-safe token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('base64url');
}

/**
 * Generate a mock API key
 * 
 * @param {string} prefix - Key prefix (e.g., 'test', 'prod')
 * @returns {string} Mock API key
 */
export function generateApiKey(prefix: string = 'test'): string {
  const randomPart = crypto.randomBytes(16).toString('hex');
  return `${prefix}_${randomPart}`;
}

// Helper utilities for testing

/**
 * Configure mock behavior
 * 
 * @param {Partial<typeof mockConfig>} config - Configuration options
 */
export function configureMock(config: Partial<typeof mockConfig>): void {
  Object.assign(mockConfig, config);
}

/**
 * Reset mock state
 */
export function resetMock(): void {
  mockEncryptedData.clear();
  
  encryptionStats.totalEncrypted = 0;
  encryptionStats.totalDecrypted = 0;
  encryptionStats.totalMasked = 0;
  encryptionStats.totalFailed = 0;
  
  mockConfig = {
    shouldFailEncrypt: false,
    shouldFailDecrypt: false,
    shouldFailMask: false,
    useRealEncryption: false,
    encryptionPrefix: 'encrypted:',
    maskPattern: '***-**-'
  };
}

/**
 * Get encryption statistics
 * 
 * @returns {typeof encryptionStats} Current statistics
 */
export function getStats(): typeof encryptionStats {
  return { ...encryptionStats };
}

/**
 * Check if a value is encrypted
 * 
 * @param {string} value - Value to check
 * @returns {boolean} True if value appears to be encrypted
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false;
  
  // Check for mock encryption prefix
  if (value.startsWith(mockConfig.encryptionPrefix)) {
    return true;
  }
  
  // Check for real encryption format (iv:authTag:encrypted)
  const parts = value.split(':');
  if (parts.length === 3) {
    try {
      // Validate hex format
      Buffer.from(parts[0], 'hex');
      Buffer.from(parts[1], 'hex');
      Buffer.from(parts[2], 'hex');
      return true;
    } catch {
      return false;
    }
  }
  
  return false;
}

// Export default mock object for easier importing
export default {
  encrypt,
  decrypt,
  mask,
  hashPassword,
  comparePasswords,
  encryptFields,
  decryptFields,
  generateSecureToken,
  generateApiKey,
  configureMock,
  resetMock,
  getStats,
  isEncrypted
};