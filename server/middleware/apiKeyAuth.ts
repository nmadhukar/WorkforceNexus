/**
 * @fileoverview API Key Authentication Middleware
 * 
 * This module provides API key-based authentication as an alternative to session authentication.
 * It supports secure key validation, permission checking, and usage tracking.
 * 
 * Features:
 * - Dual header support (Authorization Bearer and X-API-Key)
 * - Secure hash comparison using bcrypt
 * - Permission-based access control
 * - Rate limiting per API key
 * - Usage tracking and auditing
 * 
 * @module apiKeyAuth
 * @requires express
 * @requires bcrypt
 * @requires crypto
 */

import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { storage } from "../storage";
import { logAudit, AuditRequest } from "./audit";
import { ApiKey, User } from "@shared/schema";

/**
 * Express request extension for API key authentication
 * 
 * @interface ApiKeyRequest
 * @extends {AuditRequest}
 * @description Extends the AuditRequest interface to include API key authentication data.
 * Used throughout the API to support dual authentication (session + API key).
 */
export interface ApiKeyRequest extends AuditRequest {
  /** Authenticated API key object from database */
  apiKey?: ApiKey;
  /** Array of permissions granted to the API key */
  permissions?: string[];
}

/**
 * Available permission scopes for API keys
 * 
 * @constant {object} API_KEY_PERMISSIONS
 * @description Defines all available permission scopes for API key access control.
 * Permissions follow a resource:action pattern for fine-grained access control.
 * Use wildcard '*' for full access.
 * 
 * @example
 * // Grant read-only access to employees
 * const permissions = [API_KEY_PERMISSIONS.READ_EMPLOYEES];
 * 
 * @example
 * // Grant full employee management access
 * const permissions = [
 *   API_KEY_PERMISSIONS.READ_EMPLOYEES,
 *   API_KEY_PERMISSIONS.WRITE_EMPLOYEES,
 *   API_KEY_PERMISSIONS.DELETE_EMPLOYEES
 * ];
 */
export const API_KEY_PERMISSIONS = {
  // Employee permissions
  READ_EMPLOYEES: 'read:employees',
  WRITE_EMPLOYEES: 'write:employees',
  DELETE_EMPLOYEES: 'delete:employees',
  
  // License permissions
  READ_LICENSES: 'read:licenses',
  WRITE_LICENSES: 'write:licenses',
  
  // Document permissions
  READ_DOCUMENTS: 'read:documents',
  WRITE_DOCUMENTS: 'write:documents',
  
  // Report permissions
  READ_REPORTS: 'read:reports',
  
  // Audit permissions
  READ_AUDITS: 'read:audits',
  
  // Settings permissions (for managing API keys)
  MANAGE_API_KEYS: 'manage:api_keys'
} as const;

/**
 * Rate limit tracking for API keys
 * Map of apiKeyId -> { count: number, resetTime: Date }
 */
const rateLimitCache = new Map<number, { count: number; resetTime: Date }>();

/**
 * Generate a new API key
 * 
 * @param {string} environment - Environment type ('live' or 'test')
 * @returns {Promise<{ key: string, hash: string, prefix: string }>} Generated key data
 * 
 * @description
 * Generates a cryptographically secure API key with:
 * - 32 bytes of random data
 * - Environment-specific prefix (hrms_live_ or hrms_test_)
 * - Base64url encoding for URL safety
 * - Bcrypt hash for secure storage
 * 
 * @example
 * const { key, hash, prefix } = await generateApiKey('live');
 * // key: hrms_live_Ab3Cd5Ef7Gh9Ij2Kl4Mn6Op8Qr0St...
 * // hash: $2b$10$...
 * // prefix: hrms_live_Ab3Cd5Ef
 */
export async function generateApiKey(environment: 'live' | 'test' = 'live'): Promise<{
  key: string;
  hash: string;
  prefix: string;
}> {
  // Generate 32 bytes of random data
  const randomData = randomBytes(32);
  const randomString = randomData.toString('base64url');
  
  // Create full key with environment prefix
  const prefix = environment === 'test' ? 'hrms_test_' : 'hrms_live_';
  const fullKey = `${prefix}${randomString}`;
  
  // Hash the key using bcrypt with salt rounds of 10
  const hash = await bcrypt.hash(fullKey, 10);
  
  // Extract first 16 chars as prefix for identification (increased for security)
  const keyPrefix = fullKey.substring(0, 16);
  
  return {
    key: fullKey,
    hash,
    prefix: keyPrefix
  };
}

/**
 * Compare API key with stored hash
 * 
 * @async
 * @function verifyApiKey
 * @param {string} apiKey - Raw API key from request
 * @param {string} hash - Stored bcrypt hash from database
 * @returns {Promise<boolean>} True if key matches hash, false otherwise
 * 
 * @description
 * Securely compares a plain text API key with its stored bcrypt hash.
 * Uses constant-time comparison to prevent timing attacks.
 * 
 * @throws {Error} Bcrypt comparison errors or invalid input
 * 
 * @example
 * const isValid = await verifyApiKey('hrms_live_abc123...', '$2b$10$...');
 * if (isValid) {
 *   console.log('API key is valid');
 * }
 */
export async function verifyApiKey(apiKey: string, hash: string): Promise<boolean> {
  return bcrypt.compare(apiKey, hash);
}

/**
 * Check if API key has required permission
 * 
 * @function hasPermission
 * @param {string[]} keyPermissions - Permissions granted to the API key
 * @param {string} requiredPermission - Permission required for the operation
 * @returns {boolean} True if permission is granted, false otherwise
 * 
 * @description
 * Checks if an API key has the required permission for an operation.
 * Supports wildcard '*' permission for full access.
 * 
 * @throws {Error} Does not throw - handles invalid input gracefully
 * 
 * @example
 * const permissions = ['read:employees', 'write:employees'];
 * const canRead = hasPermission(permissions, 'read:employees'); // true
 * const canDelete = hasPermission(permissions, 'delete:employees'); // false
 * 
 * @example
 * // Wildcard permission grants everything
 * const adminPermissions = ['*'];
 * const canDoAnything = hasPermission(adminPermissions, 'delete:employees'); // true
 */
export function hasPermission(keyPermissions: string[], requiredPermission: string): boolean {
  return keyPermissions.includes(requiredPermission) || keyPermissions.includes('*');
}

/**
 * Check and update rate limit for API key
 * 
 * @function checkRateLimit
 * @param {number} apiKeyId - API key ID for tracking
 * @param {number} limit - Maximum requests allowed per hour
 * @returns {boolean} True if within rate limit, false if exceeded
 * 
 * @description
 * Implements in-memory rate limiting for API keys using a sliding window.
 * Each API key gets its own counter that resets every hour.
 * This prevents API abuse and ensures fair usage across all clients.
 * 
 * @throws {Error} Does not throw - handles invalid input gracefully
 * 
 * @example
 * // Check if API key #123 can make another request (limit: 1000/hour)
 * const canProceed = checkRateLimit(123, 1000);
 * if (!canProceed) {
 *   return res.status(429).json({ error: 'Rate limit exceeded' });
 * }
 */
function checkRateLimit(apiKeyId: number, limit: number): boolean {
  const now = new Date();
  const cached = rateLimitCache.get(apiKeyId);
  
  // Initialize or reset rate limit tracking
  if (!cached || cached.resetTime < now) {
    rateLimitCache.set(apiKeyId, {
      count: 1,
      resetTime: new Date(now.getTime() + 60 * 60 * 1000) // 1 hour from now
    });
    return true;
  }
  
  // Check if limit exceeded
  if (cached.count >= limit) {
    return false;
  }
  
  // Increment counter
  cached.count++;
  return true;
}

/**
 * API Key Authentication Middleware
 * 
 * @async
 * @function apiKeyAuth
 * @param {ApiKeyRequest} req - Express request with potential API key
 * @param {Response} res - Express response
 * @param {NextFunction} next - Express next middleware
 * @returns {Promise<void>} Resolves when authentication is complete
 * 
 * @description
 * Authenticates requests using API keys with the following process:
 * 1. Extracts API key from Authorization header or X-API-Key header
 * 2. Validates key format (must start with hrms_live_ or hrms_test_)
 * 3. Looks up key in database by prefix for efficiency
 * 4. Verifies key hash using bcrypt
 * 5. Checks key expiration and revocation status
 * 6. Enforces rate limiting
 * 7. Updates lastUsedAt timestamp
 * 8. Attaches user and permissions to request
 * 
 * @throws {Error} Database errors, bcrypt failures, or storage issues
 * 
 * @example
 * // Use as middleware for API routes
 * app.get('/api/employees', apiKeyAuth, requirePermission('read:employees'), ...)
 * 
 * @example
 * // API key can be provided in Authorization header
 * // Authorization: Bearer hrms_live_abc123defg456...
 * // Or in X-API-Key header
 * // X-API-Key: hrms_live_abc123defg456...
 */
export async function apiKeyAuth(
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract API key from headers
    let apiKey: string | undefined;
    
    // Check Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7);
    }
    
    // Check X-API-Key header as fallback
    if (!apiKey) {
      apiKey = req.headers['x-api-key'] as string;
    }
    
    // If no API key provided, continue to next middleware (might use session auth)
    if (!apiKey) {
      return next();
    }
    
    // Validate API key format
    if (!apiKey.startsWith('hrms_live_') && !apiKey.startsWith('hrms_test_')) {
      // Invalid API key format - return 401 immediately, don't fall through
      res.status(401).json({ error: 'Invalid API key format' });
      return;
    }
    
    // Extract prefix for database lookup
    const keyPrefix = apiKey.substring(0, 16);
    
    // Look up API key by prefix
    const storedKey = await storage.getApiKeyByPrefix(keyPrefix);
    
    if (!storedKey) {
      // API key not found - return 401 immediately, don't fall through  
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }
    
    // Verify the key hash
    const isValid = await verifyApiKey(apiKey, storedKey.keyHash);
    
    if (!isValid) {
      // Log failed authentication attempt
      console.log(`API key authentication failed for key ${keyPrefix} from IP ${req.ip}`);
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }
    
    // Check if key is revoked
    if (storedKey.revokedAt) {
      res.status(401).json({ error: 'API key has been revoked' });
      return;
    }
    
    // Check if key is expired
    if (new Date(storedKey.expiresAt) < new Date()) {
      res.status(401).json({ error: 'API key has expired' });
      return;
    }
    
    // Check rate limit
    const rateLimit = storedKey.rateLimitPerHour || 1000;
    if (!checkRateLimit(storedKey.id, rateLimit)) {
      res.status(429).json({ 
        error: 'Rate limit exceeded',
        retryAfter: 3600 // seconds
      });
      return;
    }
    
    // Update lastUsedAt timestamp
    await storage.updateApiKey(storedKey.id, { 
      lastUsedAt: new Date() 
    });
    
    // Get the user associated with this API key
    const user = await storage.getUser(storedKey.userId);
    
    if (!user) {
      res.status(401).json({ error: 'Invalid API key user' });
      return;
    }
    
    // Attach user, API key, and permissions to request
    req.user = user;
    req.apiKey = storedKey;
    req.permissions = storedKey.permissions as string[];
    
    // Log successful authentication
    console.log(`API key authentication successful for key ${keyPrefix} from IP ${req.ip}`);
    
    next();
  } catch (error) {
    console.error('API key authentication error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * Middleware to require specific permission for API key
 * 
 * @function requirePermission
 * @param {string} permission - Required permission (e.g., 'read:employees')
 * @returns {Function} Express middleware function
 * 
 * @description
 * Checks if the authenticated API key has the required permission.
 * Must be used after apiKeyAuth middleware. Session-authenticated users
 * bypass permission checks as they have full access.
 * 
 * @throws {Error} Does not throw - returns 403 response for insufficient permissions
 * 
 * @example
 * app.post('/api/employees', 
 *   apiKeyAuth, 
 *   requirePermission('write:employees'),
 *   createEmployee
 * );
 * 
 * @example
 * // Multiple permission checks
 * app.delete('/api/employees/:id',
 *   apiKeyAuth,
 *   requirePermission('delete:employees'),
 *   deleteEmployee
 * );
 */
export function requirePermission(permission: string) {
  return (req: ApiKeyRequest, res: Response, next: NextFunction) => {
    // Skip permission check for session-authenticated users (they have full permissions)
    if (req.user && !req.apiKey) {
      return next();
    }
    
    // Check if API key is present
    if (!req.apiKey || !req.permissions) {
      // No API key auth, requireAnyAuth should have caught this
      return next();
    }
    
    // Check if API key has required permission
    if (!hasPermission(req.permissions, permission)) {
      res.status(403).json({ 
        error: 'Insufficient permissions',
        required: permission,
        granted: req.permissions
      });
      return;
    }
    
    next();
  };
}

/**
 * Middleware to allow either session or API key authentication
 * 
 * @function requireAnyAuth
 * @param {ApiKeyRequest} req - Express request
 * @param {Response} res - Express response
 * @param {NextFunction} next - Express next middleware
 * @returns {void}
 * 
 * @description
 * Ensures that the request is authenticated either via session or API key.
 * This provides dual authentication support for the API, allowing both
 * web users (session) and API clients (API key) to access the same endpoints.
 * 
 * @throws {Error} Does not throw - returns 401 response for unauthenticated requests
 * 
 * @example
 * app.get('/api/employees', apiKeyAuth, requireAnyAuth, getEmployees);
 * 
 * @example
 * // Works with session authentication (web users)
 * // GET /api/employees (with session cookie)
 * // Or with API key authentication (API clients)
 * // GET /api/employees (with Authorization: Bearer hrms_live_...)
 */
export function requireAnyAuth(
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction
): void {
  // Check if authenticated via session or API key
  if (req.user || (req.apiKey && req.permissions)) {
    return next();
  }
  
  res.status(401).json({ error: 'Authentication required' });
}

/**
 * Clean up expired rate limit entries periodically
 * Run this every hour to prevent memory leaks
 */
setInterval(() => {
  const now = new Date();
  const entries = Array.from(rateLimitCache.entries());
  for (const [keyId, data] of entries) {
    if (data.resetTime < now) {
      rateLimitCache.delete(keyId);
    }
  }
}, 60 * 60 * 1000); // Every hour