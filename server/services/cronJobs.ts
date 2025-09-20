import cron from "node-cron";
import { storage } from "../storage";
import { generateApiKey } from "../middleware/apiKeyAuth";

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
            metadata: key.metadata
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

// Manual trigger endpoint for testing
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

// Check for expiring API keys
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
