import cron from "node-cron";
import { storage } from "../storage";

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
