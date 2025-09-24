/**
 * @fileoverview URL utilities for generating proper base URLs in different environments
 * 
 * This module provides utilities to determine the correct base URL for the application,
 * automatically handling different deployment environments including:
 * - Local development (localhost)
 * - Replit deployments (using REPLIT_DOMAINS)
 * - Custom domains (using APP_BASE_URL)
 * - Behind proxies (using request headers)
 * 
 * @module url
 * @requires express
 */

import { Request } from "express";

/**
 * Get the base URL for the application based on environment and request context
 * 
 * @param {Request} req - Express request object for header inspection
 * @returns {string} The base URL including protocol and domain
 * 
 * @description
 * Determines the base URL using the following priority:
 * 1. APP_BASE_URL environment variable (if set for custom domains)
 * 2. REPLIT_DOMAINS environment variable (for Replit deployments)
 * 3. Request headers (protocol + host) for proxy detection
 * 4. Fallback to http://localhost:5000 for development
 * 
 * @example
 * // In a route handler
 * const baseUrl = getBaseUrl(req);
 * const invitationLink = `${baseUrl}/onboarding/register?token=${token}`;
 */
export function getBaseUrl(req: Request): string {
  // 1. Check for explicitly configured base URL (highest priority)
  if (process.env.APP_BASE_URL) {
    console.log(`Using APP_BASE_URL: ${process.env.APP_BASE_URL}`);
    return process.env.APP_BASE_URL.replace(/\/$/, ''); // Remove trailing slash
  }

  // 2. Check for Replit deployment (REPLIT_DOMAINS contains the deployed URL)
  if (process.env.REPLIT_DOMAINS) {
    // REPLIT_DOMAINS can contain multiple domains, use the first one
    const domains = process.env.REPLIT_DOMAINS.split(',');
    const primaryDomain = domains[0].trim();
    const baseUrl = `https://${primaryDomain}`;
    console.log(`Using REPLIT_DOMAINS: ${baseUrl}`);
    return baseUrl;
  }

  // 3. Try to detect from request headers (works with trust proxy)
  if (req) {
    // Get protocol (considering proxy headers if trust proxy is enabled)
    const protocol = req.protocol || 'http';
    
    // Get host from headers (includes port if non-standard)
    const host = req.get('host') || req.hostname || 'localhost:5000';
    
    // Construct the base URL
    const baseUrl = `${protocol}://${host}`;
    
    // Log for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log(`Detected base URL from request: ${baseUrl}`);
    }
    
    return baseUrl;
  }

  // 4. Fallback for development or when no request context available
  const fallbackUrl = `http://localhost:${process.env.PORT || '5000'}`;
  console.log(`Using fallback URL: ${fallbackUrl}`);
  return fallbackUrl;
}

/**
 * Check if the application is running in production mode
 * 
 * @returns {boolean} True if running in production
 * 
 * @description
 * Determines production mode by checking:
 * - NODE_ENV environment variable
 * - Presence of REPLIT_DOMAINS (indicates deployment)
 * - Presence of APP_BASE_URL (indicates custom domain)
 */
export function isProduction(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    !!process.env.REPLIT_DOMAINS ||
    !!process.env.APP_BASE_URL
  );
}

/**
 * Generate a fully qualified URL for a given path
 * 
 * @param {Request} req - Express request object
 * @param {string} path - Path to append to base URL
 * @returns {string} Fully qualified URL
 * 
 * @example
 * const registerUrl = generateFullUrl(req, '/onboarding/register');
 * // Returns: https://myapp.replit.app/onboarding/register
 */
export function generateFullUrl(req: Request, path: string): string {
  const baseUrl = getBaseUrl(req);
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}