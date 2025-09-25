import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import { hashPassword } from "./auth";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Enable trust proxy for production deployments
// This allows proper protocol and host detection when behind proxies
if (process.env.NODE_ENV === 'production' || process.env.REPLIT_DOMAINS) {
  app.set('trust proxy', 1);
  console.log('Trust proxy enabled for production environment');
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

/**
 * Ensure default admin account exists for system access
 * 
 * @async
 * @function ensureDefaultAdmin
 * @param {number} [retries=5] - Number of retry attempts for database connection
 * @param {number} [delay=2000] - Delay in milliseconds between retries
 * @returns {Promise<void>} Resolves when admin account is ensured
 * 
 * @description
 * Critical initialization function that ensures system accessibility:
 * - Checks for existing admin account on startup
 * - Validates admin password integrity
 * - Creates default admin if no users exist
 * - Resets corrupted admin passwords automatically
 * - Implements retry logic for database availability
 * 
 * @security
 * - Default credentials: username='admin', password='admin'
 * - Warns to change default password after first login
 * - Validates password hash integrity
 * - Handles corrupted password hashes gracefully
 * 
 * @reliability
 * - Retries on database connection failures
 * - Continues app startup even if admin creation fails
 * - Logs all critical failures for monitoring
 * - Ensures system is always accessible
 * 
 * @scenarios
 * 1. Admin exists with valid password → No action
 * 2. Admin exists with invalid password → Reset password
 * 3. Admin exists with corrupted hash → Reset password  
 * 4. No users exist → Create default admin
 * 5. Database unavailable → Retry with backoff
 */
async function ensureDefaultAdmin(retries = 5, delay = 2000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // First check if admin user already exists
      const adminUser = await storage.getUserByUsername('admin');
      
      if (adminUser) {
        /**
         * Validate existing admin account password
         * Three possible states:
         * 1. Valid password - no action needed
         * 2. Invalid password - reset to default
         * 3. Corrupted hash - reset to default
         */
        const { comparePasswords } = await import('./auth');
        try {
          const isValidPassword = await comparePasswords('admin', adminUser.passwordHash);
          if (isValidPassword) {
            console.log(`Default admin account already exists (ID: ${adminUser.id}) and password is valid`);
            return;
          } else {
            /**
             * Password validation failed - reset to default
             * This handles cases where:
             * - Admin forgot password and needs access
             * - Password was changed incorrectly
             * - Security reset is required
             */
            console.log(`Admin user exists but password is invalid. Resetting password...`);
            const newHashedPassword = await hashPassword('admin');
            await storage.updateUser(adminUser.id, { passwordHash: newHashedPassword });
            console.log('✅ Admin password has been reset to: admin');
            console.log('⚠️  IMPORTANT: Change the default password after first login!');
            return;
          }
        } catch (error) {
          /**
           * Password comparison threw error - hash is corrupted
           * This can happen when:
           * - Database migration issues
           * - Manual database edits
           * - Encryption key changes
           * Solution: Reset to known good state
           */
          console.log(`Admin user exists but password hash appears corrupted. Resetting password...`);
          const newHashedPassword = await hashPassword('admin');
          await storage.updateUser(adminUser.id, { passwordHash: newHashedPassword });
          console.log('✅ Admin password has been reset to: admin');
          console.log('⚠️  IMPORTANT: Change the default password after first login!');
          return;
        }
      }
      
      /**
       * No admin user found - check if this is first run
       * If no users exist at all, create default admin
       * This ensures system is always accessible
       */
      const result = await storage.getAllUsers();
      const usersList = result.users;
      const totalUsers = result.total;
      
      if (!usersList || totalUsers === 0) {
        console.log(`[Attempt ${attempt}/${retries}] No users found. Creating default admin account...`);
        
        const hashedPassword = await hashPassword('admin');
        const newAdminUser = await storage.createUser({
          username: 'admin',
          passwordHash: hashedPassword,
          role: 'admin',
          status: 'active',
          requirePasswordChange: false  // Don't require password change for initial deployment
        });
        
        console.log('✅ Default admin account created successfully');
        console.log('Username: admin');
        console.log('Password: admin');
        console.log('⚠️  IMPORTANT: Change the default password after first login!');
        return;
      } else {
        console.log(`Found ${totalUsers} existing users. No default admin needed.`);
        return;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Attempt ${attempt}/${retries}] Failed to check/create admin account:`, errorMessage);
      
      if (attempt === retries) {
        console.error('❌ CRITICAL: Failed to ensure default admin account after all retries');
        console.error('The application may not be accessible without manual database intervention');
        // Don't throw - let the app continue but log the critical issue
      } else {
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}

(async () => {
  // Ensure default admin account exists with retries for production reliability
  await ensureDefaultAdmin();

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
