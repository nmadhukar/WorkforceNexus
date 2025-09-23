/**
 * Test Setup File
 * 
 * This file is executed before all tests and sets up the test environment.
 * It configures environment variables, database connections, and test utilities.
 */

import { beforeAll, afterAll } from 'vitest';
import { testDb } from './test-db.js';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-session-secret-for-testing-only';

beforeAll(async () => {
  // Setup test database
  await testDb.setup();
  console.log('🔄 Test database setup complete');
});

afterAll(async () => {
  // Cleanup test database
  await testDb.cleanup();
  console.log('🧹 Test database cleanup complete');
});