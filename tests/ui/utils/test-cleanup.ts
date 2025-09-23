import { Page } from '@playwright/test';

/**
 * Test cleanup utilities for managing test data and state
 * @description Provides methods to clean up test data, reset application state, and manage test isolation
 */
export class TestCleanup {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Clean up test users created during testing
   * @param usernames - Array of test usernames to clean up
   */
  async cleanupTestUsers(usernames: string[]): Promise<void> {
    for (const username of usernames) {
      try {
        // Make API call to delete test user
        await this.page.evaluate(async (user) => {
          const response = await fetch(`/api/users/${user}`, {
            method: 'DELETE',
            credentials: 'include'
          });
          return response.ok;
        }, username);
      } catch (error) {
        console.warn(`Failed to cleanup test user: ${username}`, error);
      }
    }
  }

  /**
   * Clean up test employees created during testing
   * @param employeeIds - Array of employee IDs to clean up
   */
  async cleanupTestEmployees(employeeIds: string[]): Promise<void> {
    for (const employeeId of employeeIds) {
      try {
        await this.page.evaluate(async (id) => {
          const response = await fetch(`/api/employees/${id}`, {
            method: 'DELETE',
            credentials: 'include'
          });
          return response.ok;
        }, employeeId);
      } catch (error) {
        console.warn(`Failed to cleanup test employee: ${employeeId}`, error);
      }
    }
  }

  /**
   * Clean up test documents uploaded during testing
   * @param documentIds - Array of document IDs to clean up
   */
  async cleanupTestDocuments(documentIds: string[]): Promise<void> {
    for (const documentId of documentIds) {
      try {
        await this.page.evaluate(async (id) => {
          const response = await fetch(`/api/documents/${id}`, {
            method: 'DELETE',
            credentials: 'include'
          });
          return response.ok;
        }, documentId);
      } catch (error) {
        console.warn(`Failed to cleanup test document: ${documentId}`, error);
      }
    }
  }

  /**
   * Clean up test invitations created during testing
   * @param invitationIds - Array of invitation IDs to clean up
   */
  async cleanupTestInvitations(invitationIds: number[]): Promise<void> {
    for (const invitationId of invitationIds) {
      try {
        await this.page.evaluate(async (id) => {
          const response = await fetch(`/api/invitations/${id}`, {
            method: 'DELETE',
            credentials: 'include'
          });
          return response.ok;
        }, invitationId);
      } catch (error) {
        console.warn(`Failed to cleanup test invitation: ${invitationId}`, error);
      }
    }
  }

  /**
   * Clean up test API keys created during testing
   * @param apiKeyIds - Array of API key IDs to clean up
   */
  async cleanupTestApiKeys(apiKeyIds: string[]): Promise<void> {
    for (const apiKeyId of apiKeyIds) {
      try {
        await this.page.evaluate(async (id) => {
          const response = await fetch(`/api/settings/api-keys/${id}`, {
            method: 'DELETE',
            credentials: 'include'
          });
          return response.ok;
        }, apiKeyId);
      } catch (error) {
        console.warn(`Failed to cleanup test API key: ${apiKeyId}`, error);
      }
    }
  }

  /**
   * Clear all browser storage (localStorage, sessionStorage, cookies)
   */
  async clearBrowserStorage(): Promise<void> {
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      
      // Clear all cookies
      document.cookie.split(";").forEach((c) => {
        const eqPos = c.indexOf("=");
        const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${location.hostname}`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${location.hostname}`;
      });
    });
  }

  /**
   * Reset application to initial state
   */
  async resetApplicationState(): Promise<void> {
    await this.clearBrowserStorage();
    
    // Clear any active network requests
    await this.page.evaluate(() => {
      // Cancel any ongoing fetch requests if possible
      if ('AbortController' in window) {
        // This is a simplified approach - in practice, you'd need to track active requests
      }
    });

    // Navigate to a clean state
    await this.page.goto('/auth');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Clean up uploaded test files from the server
   * @param filePaths - Array of server file paths to clean up
   */
  async cleanupUploadedFiles(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      try {
        await this.page.evaluate(async (path) => {
          const response = await fetch('/api/files/cleanup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: path }),
            credentials: 'include'
          });
          return response.ok;
        }, filePath);
      } catch (error) {
        console.warn(`Failed to cleanup uploaded file: ${filePath}`, error);
      }
    }
  }

  /**
   * Comprehensive cleanup for all test data types
   * @param testData - Object containing arrays of IDs for different data types
   */
  async comprehensiveCleanup(testData: {
    usernames?: string[];
    employeeIds?: string[];
    documentIds?: string[];
    invitationIds?: number[];
    apiKeyIds?: string[];
    filePaths?: string[];
  }): Promise<void> {
    const { usernames = [], employeeIds = [], documentIds = [], invitationIds = [], apiKeyIds = [], filePaths = [] } = testData;

    // Run all cleanup operations in parallel for efficiency
    await Promise.allSettled([
      this.cleanupTestUsers(usernames),
      this.cleanupTestEmployees(employeeIds),
      this.cleanupTestDocuments(documentIds),
      this.cleanupTestInvitations(invitationIds),
      this.cleanupTestApiKeys(apiKeyIds),
      this.cleanupUploadedFiles(filePaths)
    ]);

    // Always clean browser storage at the end
    await this.clearBrowserStorage();
  }

  /**
   * Set up database for testing (if needed)
   */
  async setupTestDatabase(): Promise<void> {
    try {
      // This would typically reset the test database to a known state
      await this.page.evaluate(async () => {
        const response = await fetch('/api/test/reset-db', {
          method: 'POST',
          credentials: 'include'
        });
        return response.ok;
      });
    } catch (error) {
      console.warn('Failed to setup test database:', error);
    }
  }

  /**
   * Create test data isolation by adding unique prefixes
   * @param testName - Name of the current test
   */
  static createTestPrefix(testName: string): string {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substr(2, 5);
    return `test-${testName.toLowerCase().replace(/\s+/g, '-')}-${timestamp}-${randomSuffix}`;
  }

  /**
   * Wait for all async operations to complete
   * @param timeout - Maximum time to wait in milliseconds
   */
  async waitForAsyncOperations(timeout: number = 5000): Promise<void> {
    await this.page.waitForTimeout(500); // Initial wait for operations to start
    
    // Wait for network idle
    await this.page.waitForLoadState('networkidle', { timeout });
    
    // Wait for any loading spinners to disappear
    try {
      await this.page.waitForFunction(
        () => !document.querySelector('.loading, .animate-spin, [data-testid*="loading"]'),
        { timeout: timeout / 2 }
      );
    } catch {
      // Ignore timeout - loading indicators might not exist
    }
  }

  /**
   * Capture test state for debugging
   * @param testName - Name of the test
   */
  async captureTestState(testName: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `test-state-${testName.replace(/\s+/g, '-')}-${timestamp}`;
    
    try {
      // Take screenshot
      await this.page.screenshot({
        path: `test-results/debug/${fileName}.png`,
        fullPage: true
      });
      
      // Capture console logs
      const logs = await this.page.evaluate(() => {
        return (window as any).__testLogs || [];
      });
      
      if (logs.length > 0) {
        await this.page.evaluate((logData) => {
          const fs = require('fs');
          fs.writeFileSync(`test-results/debug/${fileName}-logs.json`, JSON.stringify(logData, null, 2));
        }, logs);
      }
      
      // Capture DOM state
      const html = await this.page.content();
      await this.page.evaluate((content, fileName) => {
        const fs = require('fs');
        fs.writeFileSync(`test-results/debug/${fileName}.html`, content);
      }, html, fileName);
      
    } catch (error) {
      console.warn(`Failed to capture test state for ${testName}:`, error);
    }
  }
}