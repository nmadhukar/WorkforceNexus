import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for comprehensive UI testing of HR Management System
 * @description Supports multiple browsers, mobile testing, and CI environments
 */
export default defineConfig({
  // Test directory
  testDir: './tests/ui',
  
  // Run tests in files in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter to use
  reporter: [
    ['html', { outputFolder: 'test-results/html-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    process.env.CI ? ['github'] : ['list']
  ],
  
  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`.
    baseURL: process.env.BASE_URL || 'http://localhost:5000',
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Record video on failure
    video: 'retain-on-failure',
    
    // Take screenshot on failure
    screenshot: 'only-on-failure',
    
    // Global timeout for each action
    actionTimeout: 30000,
    
    // Global timeout for navigation
    navigationTimeout: 30000,
  },

  // Configure projects for major browsers
  projects: [
    // Setup project for authentication
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Use prepared auth state
        storageState: 'tests/ui/auth/.auth/admin.json',
      },
      dependencies: ['setup'],
    },

    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        storageState: 'tests/ui/auth/.auth/admin.json',
      },
      dependencies: ['setup'],
    },

    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        storageState: 'tests/ui/auth/.auth/admin.json',
      },
      dependencies: ['setup'],
    },

    // Mobile testing
    {
      name: 'Mobile Chrome',
      use: { 
        ...devices['Pixel 5'],
        storageState: 'tests/ui/auth/.auth/admin.json',
      },
      dependencies: ['setup'],
    },
    
    {
      name: 'Mobile Safari',
      use: { 
        ...devices['iPhone 12'],
        storageState: 'tests/ui/auth/.auth/admin.json',
      },
      dependencies: ['setup'],
    },

    // Role-based testing projects
    {
      name: 'hr-role',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/ui/auth/.auth/hr.json',
      },
      dependencies: ['setup'],
    },
    
    {
      name: 'viewer-role',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/ui/auth/.auth/viewer.json',
      },
      dependencies: ['setup'],
    },
  ],

  // Development server configuration
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  
  // Global timeout for each test
  timeout: 60 * 1000,
  
  // Global timeout for each assertion
  expect: {
    timeout: 10 * 1000,
  },
  
  // Output directory for test artifacts
  outputDir: 'test-results/',
});