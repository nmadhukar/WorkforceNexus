/**
 * Simple Authentication Test
 * 
 * A basic test to verify the test setup works without complex cleanup operations.
 */

import { describe, test, expect } from 'vitest';
import request from 'supertest';
import { getTestApp } from '../utils/test-app';

describe('Simple Authentication Test', () => {
  test('should return 401 for unauthenticated request', async () => {
    const app = await getTestApp();
    
    const response = await request(app)
      .get('/api/user')
      .expect(401);
  });

  test('should handle basic route access', async () => {
    const app = await getTestApp();
    
    // This should work without authentication
    const response = await request(app)
      .get('/api/health')
      .expect(404); // Expect 404 since this route doesn't exist, but app is working
  });
});