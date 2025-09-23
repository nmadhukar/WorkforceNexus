/**
 * Test App Setup
 * 
 * Creates an Express app instance for testing purposes without starting the server.
 * This allows us to test API endpoints using supertest.
 */

import express, { type Express } from "express";
import { registerRoutes } from "../../server/routes";

let app: Express;

/**
 * Get or create the test app instance
 */
export async function getTestApp() {
  if (!app) {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    // Register all routes but don't start the server
    await registerRoutes(app);
  }
  
  return app;
}