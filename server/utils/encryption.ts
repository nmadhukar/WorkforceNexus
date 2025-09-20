/**
 * @fileoverview Encryption utilities for sensitive data
 * 
 * Provides AES-256 encryption/decryption for sensitive configuration data
 * such as S3 credentials. Uses Node.js crypto module for secure encryption.
 */

import crypto from 'crypto';

/**
 * Get or generate encryption key from environment
 * Falls back to a default key if not set (should be changed in production)
 */
const getEncryptionKey = (): Buffer => {
  const key = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-this-in-production';
  // Create a 32-byte key for AES-256
  return crypto.createHash('sha256').update(key).digest();
};

/**
 * Encrypt a string value using AES-256-GCM
 * @param {string} text - Plain text to encrypt
 * @returns {string} Encrypted text with IV and auth tag
 */
export function encrypt(text: string): string {
  if (!text) return '';
  
  const algorithm = 'aes-256-gcm';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Combine IV, auth tag, and encrypted data
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt a string value encrypted with AES-256-GCM
 * @param {string} encryptedText - Encrypted text with IV and auth tag
 * @returns {string} Decrypted plain text
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return '';
  
  try {
    const algorithm = 'aes-256-gcm';
    const key = getEncryptionKey();
    
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      console.error('Invalid encrypted text format');
      return '';
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    return '';
  }
}

/**
 * Mask sensitive data for display (shows first 4 chars + ****)
 * @param {string} text - Text to mask
 * @param {number} showChars - Number of characters to show (default 4)
 * @returns {string} Masked text
 */
export function mask(text: string, showChars: number = 4): string {
  if (!text || text.length <= showChars) {
    return '****';
  }
  return text.substring(0, showChars) + '****';
}