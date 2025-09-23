/**
 * @fileoverview Automated Cron Jobs for HR Management System
 * 
 * This module manages automated background tasks for the healthcare HR system,
 * including license expiration monitoring, compliance checking, and API key rotation.
 * All jobs are scheduled using node-cron and run automatically to ensure
 * regulatory compliance and system maintenance.
 * 
 * Schedule Overview:
 * - 4:00 AM: Automatic API key rotation (90+ day old keys)
 * - 5:00 AM: API key expiration notifications (7 days warning)
 * - 6:00 AM: License/certification expiration check (30 days warning)
 * - 7:00 AM Sunday: Weekly compliance reporting
 * 
 * @module cronJobs
 * @requires node-cron
 * @requires ../storage
 * @requires ../middleware/apiKeyAuth
 */

import cron from "node-cron";
import { storage } from "../storage";
import { generateApiKey } from "../middleware/apiKeyAuth";

/**
 * Initialize and start all automated cron jobs
 * 
 * @function startCronJobs
 * @returns {void}
 * 
 * @description
 * Sets up all automated background tasks for the HR management system.
 * These jobs ensure compliance with healthcare regulations by:
 * - Monitoring license and certification expiration dates
 * - Automatically rotating old API keys for security
 * - Generating compliance reports for management
 * - Sending notifications for upcoming expirations
 * 
 * All jobs include error handling to prevent system disruption.
 * Job execution is logged for audit and debugging purposes.
 * 
 * @example
 * // Start all cron jobs when server initializes
 * startCronJobs();
 * console.log('All automated tasks are now running');
 */
export function startCronJobs() {
  // Check for expiring licenses/certifications daily at 6 AM
  cron.schedule('0 6 * * *', async () => {
    console.log('Running daily expiration check...');
    
    try {
      const expiringItems = await storage.getExpiringItems(30);
      
      if (expiringItems.length > 0) {
        console.log(`Found ${expiringItems.length} items expiring in the next 30 days:`);
        
        expiringItems.forEach(item => {
          console.log(`- ${item.employeeName}: ${item.itemType} (${item.licenseNumber}) expires on ${item.expirationDate} (${item.daysRemaining} days remaining)`);
        });
        
        // In a real application, you would send emails here
        // await sendExpirationNotifications(expiringItems);
      } else {
        console.log('No items expiring in the next 30 days.');
      }
    } catch (error) {
      console.error('Error during expiration check:', error);
    }
  });

  // Weekly compliance check on Sundays at 7 AM
  cron.schedule('0 7 * * 0', async () => {
    console.log('Running weekly compliance check...');
    
    try {
      const stats = await storage.getEmployeeStats();
      console.log('Compliance Summary:', {
        totalEmployees: stats.totalEmployees,
        activeEmployees: stats.activeEmployees,
        expiringSoon: stats.expiringSoon,
        pendingDocs: stats.pendingDocs
      });
      
      // In a real application, you would send compliance reports here
      // await sendComplianceReport(stats);
    } catch (error) {
      console.error('Error during compliance check:', error);
    }
  });

  // Check for expiring API keys daily at 5 AM
  cron.schedule('0 5 * * *', async () => {
    console.log('Running daily API key expiration check...');
    
    try {
      const expiringKeys = await storage.getExpiringApiKeys(7); // Keys expiring in 7 days
      
      if (expiringKeys.length > 0) {
        console.log(`Found ${expiringKeys.length} API keys expiring in the next 7 days`);
        
        for (const key of expiringKeys) {
          const user = await storage.getUser(key.userId);
          if (user) {
            console.log(`- API Key "${key.name}" for user ${user.username} expires on ${key.expiresAt}`);
            // In production, send notification email here
          }
        }
      }
    } catch (error) {
      console.error('Error during API key expiration check:', error);
    }
  });

  // Automatic API key rotation (for keys older than 90 days) - runs daily at 4 AM
  cron.schedule('0 4 * * *', async () => {
    console.log('Running automatic API key rotation check...');
    
    try {
      const activeKeys = await storage.getActiveApiKeys();
      const now = new Date();
      const rotationThreshold = 90; // days
      
      for (const key of activeKeys) {
        const keyAge = Math.floor((now.getTime() - new Date(key.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        
        if (keyAge >= rotationThreshold) {
          console.log(`Auto-rotating API key "${key.name}" (${keyAge} days old)`);
          
          // Generate new key
          const { key: newKey, hash, prefix } = await generateApiKey(key.environment as 'live' | 'test');
          
          // Create new key with same permissions
          const rotatedKey = await storage.createApiKey({
            name: `${key.name} (Auto-rotated)`,
            keyHash: hash,
            keyPrefix: prefix,
            userId: key.userId,
            permissions: key.permissions as string[],
            expiresAt: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
            environment: key.environment,
            rateLimitPerHour: key.rateLimitPerHour,
            metadata: key.metadata as { description?: string; allowedIps?: string[] } | undefined
          });
          
          // Create rotation record
          const gracePeriodEnds = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hour grace period
          await storage.createApiKeyRotation({
            apiKeyId: key.id,
            oldKeyId: key.id,
            newKeyId: rotatedKey.id,
            rotationType: 'automatic',
            rotatedBy: null, // System rotation
            gracePeriodEnds,
            reason: `Automatic rotation after ${rotationThreshold} days`
          });
          
          // Schedule old key revocation after grace period
          setTimeout(async () => {
            await storage.revokeApiKey(key.id);
            console.log(`Revoked old API key "${key.name}" after grace period`);
          }, 24 * 60 * 60 * 1000);
          
          const user = await storage.getUser(key.userId);
          if (user) {
            console.log(`Notifying user ${user.username} about automatic key rotation`);
            // In production, send notification email with new key here
          }
        }
      }
    } catch (error) {
      console.error('Error during automatic API key rotation:', error);
    }
  });

  console.log('Cron jobs started successfully');
}

/**
 * Manually trigger license and certification expiration check
 * 
 * @async
 * @function manualExpirationCheck
 * @returns {Promise<any[]>} Array of items expiring within 30 days
 * 
 * @description
 * Provides a manual trigger for the expiration check that normally runs
 * at 6:00 AM daily. This function is useful for:
 * - Testing the expiration detection logic
 * - Running on-demand compliance checks
 * - Generating immediate reports for management
 * 
 * Returns detailed information about expiring items including:
 * - Employee name and ID
 * - License/certification type
 * - License number
 * - Expiration date
 * - Days remaining until expiration
 * 
 * @throws {Error} Database or processing errors during expiration check
 * 
 * @example
 * // Run manual check and get results
 * const expiringItems = await manualExpirationCheck();
 * console.log(`Found ${expiringItems.length} items expiring soon`);
 * 
 * @example
 * // Use in API endpoint for admin dashboard
 * app.get('/api/admin/expiration-check', async (req, res) => {
 *   const items = await manualExpirationCheck();
 *   res.json({ expiringItems: items });
 * });
 */
export async function manualExpirationCheck(): Promise<any[]> {
  console.log('Running manual expiration check...');
  
  try {
    const expiringItems = await storage.getExpiringItems(30);
    console.log(`Found ${expiringItems.length} items expiring in the next 30 days`);
    return expiringItems;
  } catch (error) {
    console.error('Error during manual expiration check:', error);
    throw error;
  }
}

/**
 * Check for API keys nearing expiration
 * 
 * @async
 * @function checkExpiringApiKeys
 * @param {number} [days=7] - Number of days ahead to check for expiring keys
 * @returns {Promise<any[]>} Array of API keys expiring within the specified timeframe
 * 
 * @description
 * Checks for API keys that will expire within the specified number of days.
 * This function supports both the automated daily cron job (7-day warning)
 * and manual checks with custom timeframes.
 * 
 * Returns enriched data for each expiring key including:
 * - Key ID and name for identification
 * - Username of the key owner
 * - Exact expiration timestamp
 * - Calculated days remaining
 * 
 * Used for:
 * - Automated expiration notifications
 * - Admin dashboard warnings
 * - Proactive key renewal planning
 * - Security audit reporting
 * 
 * @throws {Error} Database errors or calculation failures
 * 
 * @example
 * // Check for keys expiring in next 7 days (default)
 * const weekWarning = await checkExpiringApiKeys();
 * 
 * @example
 * // Check for keys expiring in next 30 days
 * const monthWarning = await checkExpiringApiKeys(30);
 * 
 * @example
 * // Check for keys expiring today (emergency notification)
 * const criticalKeys = await checkExpiringApiKeys(1);
 * if (criticalKeys.length > 0) {
 *   await sendUrgentNotification(criticalKeys);
 * }
 */
export async function checkExpiringApiKeys(days: number = 7): Promise<any[]> {
  console.log(`Checking for API keys expiring in the next ${days} days...`);
  
  try {
    const expiringKeys = await storage.getExpiringApiKeys(days);
    const results = [];
    
    for (const key of expiringKeys) {
      const user = await storage.getUser(key.userId);
      results.push({
        keyId: key.id,
        name: key.name,
        username: user?.username,
        expiresAt: key.expiresAt,
        daysRemaining: Math.ceil((new Date(key.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      });
    }
    
    return results;
  } catch (error) {
    console.error('Error checking expiring API keys:', error);
    throw error;
  }
}
