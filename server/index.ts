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

// Helper function to ensure default admin exists with retries
async function ensureDefaultAdmin(retries = 5, delay = 2000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // First check if admin user already exists
      const adminUser = await storage.getUserByUsername('admin');
      
      if (adminUser) {
        console.log(`Default admin account already exists (ID: ${adminUser.id})`);
        return;
      }
      
      // Check if there are any users at all
      const users = await storage.getAllUsers();
      
      if (!users || users.length === 0) {
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
        console.log(`Found ${users.length} existing users. No default admin needed.`);
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
