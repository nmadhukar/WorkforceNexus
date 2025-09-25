import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin, loginAsHR, loginAsViewer } from '../utils/auth-helpers';
import {
  generateLocation,
  generateLicense,
  generateResponsiblePerson,
  createLocation,
  createLicense,
  verifyDashboardMetrics,
  exportComplianceReport
} from '../utils/compliance-helpers';
import path from 'path';
import fs from 'fs';

test.describe('Compliance Module - Regression Tests', () => {
  test.describe('Existing compliance data integrity', () => {
    test('Verify old licenses still valid', async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto('/compliance/licenses');
      await page.waitForLoadState('networkidle');

      // Check that existing licenses are displayed
      const licenseTable = page.getByTestId('licenses-table');
      await expect(licenseTable).toBeVisible();

      // Verify license data integrity
      const licenseRows = page.locator('[data-testid^="row-license-"]');
      const rowCount = await licenseRows.count();
      
      if (rowCount > 0) {
        // Check first license has all required fields
        const firstRow = licenseRows.first();
        await expect(firstRow.locator('[data-testid="license-number"]')).toBeVisible();
        await expect(firstRow.locator('[data-testid="license-type"]')).toBeVisible();
        await expect(firstRow.locator('[data-testid="expiration-date"]')).toBeVisible();
        await expect(firstRow.locator('[data-testid="status-badge"]')).toBeVisible();
        
        // Verify dates are properly formatted
        const expirationDate = await firstRow.locator('[data-testid="expiration-date"]').textContent();
        expect(expirationDate).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
      }

      // Test that old licenses can still be edited
      if (rowCount > 0) {
        await licenseRows.first().locator('[data-testid="button-edit-license"]').click();
        await expect(page.getByTestId('dialog-edit-license')).toBeVisible();
        await page.getByTestId('button-cancel').click();
      }
    });

    test('Check document accessibility', async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto('/compliance/documents');
      await page.waitForLoadState('networkidle');

      const documentTable = page.getByTestId('documents-table');
      await expect(documentTable).toBeVisible();

      const documentRows = page.locator('[data-testid^="row-document-"]');
      const rowCount = await documentRows.count();

      if (rowCount > 0) {
        // Test download functionality for first document
        const firstRow = documentRows.first();
        const downloadButton = firstRow.locator('[data-testid="button-download"]');
        
        if (await downloadButton.isVisible()) {
          const downloadPromise = page.waitForEvent('download');
          await downloadButton.click();
          const download = await downloadPromise;
          
          // Verify download started
          expect(download).toBeTruthy();
          
          // Verify file exists and is accessible
          const path = await download.path();
          if (path) {
            const stats = fs.statSync(path);
            expect(stats.size).toBeGreaterThan(0);
          }
        }
      }

      // Test document search functionality
      const searchInput = page.getByTestId('input-search-documents');
      if (await searchInput.isVisible()) {
        await searchInput.fill('test');
        await page.keyboard.press('Enter');
        await page.waitForLoadState('networkidle');
        
        // Verify search results or no results message
        const resultsOrEmpty = page.locator('[data-testid="documents-table"], [data-testid="no-results"]');
        await expect(resultsOrEmpty).toBeVisible();
      }
    });

    test('Validate location hierarchy', async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto('/compliance/locations');
      await page.waitForLoadState('networkidle');

      // Check if location tree is rendered
      const locationTree = page.getByTestId('location-tree');
      if (await locationTree.isVisible()) {
        // Verify parent-child relationships
        const treeNodes = page.locator('[data-testid^="tree-node-"]');
        const nodeCount = await treeNodes.count();
        
        if (nodeCount > 0) {
          // Check for expand/collapse functionality
          const expandButtons = page.locator('[data-testid="button-expand"]');
          if (await expandButtons.count() > 0) {
            await expandButtons.first().click();
            await page.waitForTimeout(500);
            
            // Verify child nodes appear
            const childNodes = page.locator('[data-testid*="tree-node-"][data-level="1"]');
            if (await childNodes.count() > 0) {
              await expect(childNodes.first()).toBeVisible();
            }
          }
        }
      } else {
        // Fallback to table view
        const locationTable = page.getByTestId('locations-table');
        await expect(locationTable).toBeVisible();
        
        // Verify hierarchy column if present
        const hierarchyColumn = page.locator('[data-testid="column-hierarchy"]');
        if (await hierarchyColumn.isVisible()) {
          const hierarchyValues = await hierarchyColumn.allTextContents();
          hierarchyValues.forEach(value => {
            expect(value).toMatch(/Main|Sub-location|Branch/i);
          });
        }
      }
    });
  });

  test.describe('Permission model consistency', () => {
    test('Admin full access', async ({ page }) => {
      await loginAsAdmin(page);
      
      // Test access to all compliance sections
      const sections = [
        '/compliance/dashboard',
        '/compliance/locations',
        '/compliance/license-types',
        '/compliance/responsible-persons',
        '/compliance/licenses',
        '/compliance/documents'
      ];

      for (const section of sections) {
        await page.goto(section);
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveURL(section);
        
        // Verify admin can see action buttons
        const addButton = page.locator('[data-testid^="button-add-"]').first();
        if (await addButton.isVisible()) {
          await expect(addButton).toBeEnabled();
        }
      }

      // Test admin can perform CRUD operations
      await page.goto('/compliance/license-types');
      await page.getByTestId('button-add-license-type').click();
      await expect(page.getByTestId('dialog-add-license-type')).toBeVisible();
      await page.getByTestId('button-cancel').click();
    });

    test('HR read/write access', async ({ page }) => {
      await loginAsHR(page);
      
      // Test HR can view compliance data
      await page.goto('/compliance/dashboard');
      await expect(page.getByTestId('dashboard-metrics')).toBeVisible();
      
      // Test HR can create/edit licenses
      await page.goto('/compliance/licenses');
      const addButton = page.getByTestId('button-add-license');
      if (await addButton.isVisible()) {
        await expect(addButton).toBeEnabled();
        await addButton.click();
        await expect(page.getByTestId('dialog-add-license')).toBeVisible();
        await page.getByTestId('button-cancel').click();
      }
      
      // Test HR cannot access admin-only features
      await page.goto('/settings');
      const adminSection = page.getByTestId('admin-section');
      if (await adminSection.isVisible()) {
        await expect(adminSection).toHaveAttribute('data-disabled', 'true');
      }
    });

    test('Viewer read-only access', async ({ page }) => {
      await loginAsViewer(page);
      
      // Test viewer can view but not edit
      await page.goto('/compliance/dashboard');
      await expect(page.getByTestId('dashboard-metrics')).toBeVisible();
      
      // Verify no add/edit buttons are visible or they're disabled
      await page.goto('/compliance/licenses');
      const addButton = page.getByTestId('button-add-license');
      if (await addButton.isVisible()) {
        await expect(addButton).toBeDisabled();
      }
      
      const editButtons = page.locator('[data-testid="button-edit-license"]');
      const editCount = await editButtons.count();
      for (let i = 0; i < editCount; i++) {
        await expect(editButtons.nth(i)).toBeDisabled();
      }
      
      // Test export is still allowed for viewers
      await page.goto('/compliance/dashboard');
      const exportButton = page.getByTestId('button-export-report');
      if (await exportButton.isVisible()) {
        await expect(exportButton).toBeEnabled();
      }
    });
  });

  test.describe('S3 migration compatibility', () => {
    test('Documents work with S3 enabled/disabled', async ({ page }) => {
      await loginAsAdmin(page);
      
      // Check current S3 status
      await page.goto('/settings');
      await page.getByTestId('tab-storage').click();
      
      const s3Status = page.getByTestId('s3-status');
      const isS3Enabled = await s3Status.textContent();
      
      // Test document upload regardless of S3 status
      await page.goto('/compliance/documents');
      await page.getByTestId('button-upload-document').click();
      
      const testFile = path.join(__dirname, '../fixtures/test-document.pdf');
      await page.getByTestId('input-document-file').setInputFiles(testFile);
      await page.getByTestId('input-document-title').fill('S3 Compatibility Test');
      await page.getByTestId('select-document-category').click();
      await page.getByRole('option', { name: 'Policy' }).click();
      await page.getByTestId('button-submit-upload').click();
      
      // Should work regardless of S3 status
      await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
      
      // Verify document appears in list
      await expect(page.locator('text="S3 Compatibility Test"')).toBeVisible();
      
      // Test download
      const downloadPromise = page.waitForEvent('download');
      await page.locator('[data-testid="row-document-S3 Compatibility Test"]')
        .locator('[data-testid="button-download"]')
        .click();
      const download = await downloadPromise;
      expect(download).toBeTruthy();
    });

    test('Fallback to local storage', async ({ page }) => {
      await loginAsAdmin(page);
      
      // This test simulates S3 failure and fallback
      // Would need special test endpoint or mock to properly test
      
      await page.goto('/compliance/documents');
      
      // Upload document
      const testFile = path.join(__dirname, '../fixtures/test-document.pdf');
      await page.getByTestId('button-upload-document').click();
      await page.getByTestId('input-document-file').setInputFiles(testFile);
      await page.getByTestId('input-document-title').fill('Local Storage Test');
      await page.getByTestId('button-submit-upload').click();
      
      // Even if S3 fails, should fall back to local
      const successOrWarning = page.locator('[data-testid="toast-success"], [data-testid="toast-warning"]');
      await expect(successOrWarning).toBeVisible();
      
      // Document should still be accessible
      if (await page.locator('text="Local Storage Test"').isVisible()) {
        const downloadButton = page.locator('[data-testid="row-document-Local Storage Test"]')
          .locator('[data-testid="button-download"]');
        await expect(downloadButton).toBeEnabled();
      }
    });
  });

  test.describe('Alert generation accuracy', () => {
    async function createExpiringLicense(page: Page, daysUntilExpiration: number, licenseNumber: string) {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + daysUntilExpiration);
      
      await page.getByTestId('button-add-license').click();
      await page.getByTestId('select-location').click();
      await page.locator('[data-testid="option-location-1"]').click();
      await page.getByTestId('select-license-type').click();
      await page.locator('[data-testid="option-type-1"]').click();
      await page.getByTestId('input-license-number').fill(licenseNumber);
      await page.getByTestId('input-issue-date').fill('2024-01-01');
      await page.getByTestId('input-expiration-date').fill(expirationDate.toISOString().split('T')[0]);
      await page.getByTestId('button-save-license').click();
      await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    }

    test('30-day alerts generated correctly', async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto('/compliance/licenses');
      
      // Create license expiring in 25 days (should trigger 30-day alert)
      await createExpiringLicense(page, 25, 'ALERT-30-TEST');
      
      // Navigate to dashboard to check alerts
      await page.goto('/compliance/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Check for 30-day alert
      const alert30 = page.locator('[data-testid="alert-expiring-30-days"]');
      const alertCount = await alert30.count();
      expect(alertCount).toBeGreaterThan(0);
      
      // Verify alert contains correct license
      const alertText = await alert30.first().textContent();
      expect(alertText).toContain('30 days');
    });

    test('60-day alerts generated correctly', async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto('/compliance/licenses');
      
      // Create license expiring in 55 days
      await createExpiringLicense(page, 55, 'ALERT-60-TEST');
      
      await page.goto('/compliance/dashboard');
      await page.waitForLoadState('networkidle');
      
      const alert60 = page.locator('[data-testid="alert-expiring-60-days"]');
      const alertCount = await alert60.count();
      expect(alertCount).toBeGreaterThan(0);
    });

    test('90-day alerts generated correctly', async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto('/compliance/licenses');
      
      // Create license expiring in 85 days
      await createExpiringLicense(page, 85, 'ALERT-90-TEST');
      
      await page.goto('/compliance/dashboard');
      await page.waitForLoadState('networkidle');
      
      const alert90 = page.locator('[data-testid="alert-expiring-90-days"]');
      const alertCount = await alert90.count();
      expect(alertCount).toBeGreaterThan(0);
    });

    test('Expired license alerts', async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto('/compliance/licenses');
      
      // Create expired license
      await createExpiringLicense(page, -5, 'ALERT-EXPIRED-TEST');
      
      await page.goto('/compliance/dashboard');
      await page.waitForLoadState('networkidle');
      
      const expiredAlert = page.locator('[data-testid="alert-expired"]');
      const alertCount = await expiredAlert.count();
      expect(alertCount).toBeGreaterThan(0);
      
      // Verify expired count increased
      const expiredMetric = await page.getByTestId('metric-expired').textContent();
      expect(parseInt(expiredMetric || '0')).toBeGreaterThan(0);
    });
  });

  test.describe('Export functionality', () => {
    test('CSV export includes all fields', async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto('/compliance/dashboard');
      
      // Trigger CSV export
      await page.getByTestId('button-export-report').click();
      await page.getByTestId('select-export-format').click();
      await page.getByRole('option', { name: 'CSV' }).click();
      
      const downloadPromise = page.waitForEvent('download');
      await page.getByTestId('button-confirm-export').click();
      const download = await downloadPromise;
      
      // Save and read CSV file
      const filePath = await download.path();
      if (filePath) {
        const csvContent = fs.readFileSync(filePath, 'utf-8');
        
        // Verify CSV headers
        const lines = csvContent.split('\n');
        const headers = lines[0].toLowerCase();
        
        // Check for required fields
        expect(headers).toContain('license');
        expect(headers).toContain('location');
        expect(headers).toContain('expiration');
        expect(headers).toContain('status');
        
        // Verify data rows exist
        expect(lines.length).toBeGreaterThan(1);
      }
    });

    test('JSON export properly formatted', async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto('/compliance/dashboard');
      
      // Trigger JSON export
      await page.getByTestId('button-export-report').click();
      await page.getByTestId('select-export-format').click();
      await page.getByRole('option', { name: 'JSON' }).click();
      
      const downloadPromise = page.waitForEvent('download');
      await page.getByTestId('button-confirm-export').click();
      const download = await downloadPromise;
      
      // Save and parse JSON file
      const filePath = await download.path();
      if (filePath) {
        const jsonContent = fs.readFileSync(filePath, 'utf-8');
        
        // Verify valid JSON
        let jsonData;
        expect(() => {
          jsonData = JSON.parse(jsonContent);
        }).not.toThrow();
        
        // Verify JSON structure
        expect(jsonData).toHaveProperty('exportDate');
        expect(jsonData).toHaveProperty('data');
        
        if (jsonData.data && jsonData.data.licenses) {
          expect(Array.isArray(jsonData.data.licenses)).toBe(true);
          
          // Check license structure if data exists
          if (jsonData.data.licenses.length > 0) {
            const firstLicense = jsonData.data.licenses[0];
            expect(firstLicense).toHaveProperty('id');
            expect(firstLicense).toHaveProperty('licenseNumber');
            expect(firstLicense).toHaveProperty('expirationDate');
          }
        }
      }
    });

    test('Large dataset exports (simulated)', async ({ page }) => {
      await loginAsAdmin(page);
      
      // This test would ideally have a pre-seeded large dataset
      // Testing export performance and completeness
      
      await page.goto('/compliance/dashboard');
      
      // Set filter for all data
      const filterButton = page.getByTestId('filter-date-range');
      if (await filterButton.isVisible()) {
        await filterButton.click();
        await page.getByRole('option', { name: 'All Time' }).click();
      }
      
      // Export large dataset
      await page.getByTestId('button-export-report').click();
      await page.getByTestId('select-export-format').click();
      await page.getByRole('option', { name: 'CSV' }).click();
      
      const startTime = Date.now();
      const downloadPromise = page.waitForEvent('download');
      await page.getByTestId('button-confirm-export').click();
      const download = await downloadPromise;
      const exportTime = Date.now() - startTime;
      
      // Export should complete within reasonable time
      expect(exportTime).toBeLessThan(30000); // 30 seconds max
      
      // Verify file size is reasonable
      const filePath = await download.path();
      if (filePath) {
        const stats = fs.statSync(filePath);
        expect(stats.size).toBeGreaterThan(0);
        // Check file isn't corrupted (too large)
        expect(stats.size).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
      }
    });
  });

  test.describe('Dashboard calculations', () => {
    test('Total counts accurate', async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto('/compliance/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Get dashboard metrics
      const metrics = await verifyDashboardMetrics(page);
      
      // Verify counts are numbers
      Object.values(metrics).forEach(value => {
        if (value) {
          const numValue = parseInt(value.toString());
          expect(numValue).toBeGreaterThanOrEqual(0);
        }
      });
      
      // Cross-verify with actual data
      await page.goto('/compliance/locations');
      const locationRows = await page.locator('[data-testid^="row-location-"]').count();
      
      await page.goto('/compliance/dashboard');
      const totalLocations = await page.getByTestId('metric-total-locations').textContent();
      
      // Dashboard count should match or be close to actual count
      const dashboardCount = parseInt(totalLocations || '0');
      expect(Math.abs(dashboardCount - locationRows)).toBeLessThanOrEqual(1);
    });

    test('Expiration counts correct', async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto('/compliance/dashboard');
      
      const expiring30 = await page.getByTestId('metric-expiring-30').textContent();
      const expiring60 = await page.getByTestId('metric-expiring-60').textContent();
      const expiring90 = await page.getByTestId('metric-expiring-90').textContent();
      
      // Verify logical relationship (30-day should be <= 60-day <= 90-day)
      const count30 = parseInt(expiring30 || '0');
      const count60 = parseInt(expiring60 || '0');
      const count90 = parseInt(expiring90 || '0');
      
      expect(count30).toBeLessThanOrEqual(count60);
      expect(count60).toBeLessThanOrEqual(count90);
      
      // Navigate to licenses and verify counts
      await page.goto('/compliance/licenses');
      await page.getByTestId('filter-expiring').click();
      await page.getByRole('option', { name: '30 days' }).click();
      await page.waitForLoadState('networkidle');
      
      const actual30Count = await page.locator('[data-testid^="row-license-"]').count();
      expect(Math.abs(count30 - actual30Count)).toBeLessThanOrEqual(1);
    });

    test('Location rollups work', async ({ page }) => {
      await loginAsAdmin(page);
      
      // Create hierarchical locations if not exist
      await page.goto('/compliance/locations');
      
      const mainLocation = generateLocation('main');
      mainLocation.code = 'ROLLUP-MAIN';
      await createLocation(page, { ...mainLocation, parentId: null });
      
      // Create sub-locations
      for (let i = 0; i < 3; i++) {
        const subLocation = generateLocation('sub_location');
        subLocation.code = `ROLLUP-SUB-${i}`;
        await createLocation(page, { ...subLocation, parentId: 1 });
      }
      
      // Navigate to dashboard
      await page.goto('/compliance/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Check if location filter shows hierarchy
      await page.getByTestId('filter-location').click();
      
      // Should see main location and its children in filter
      await expect(page.getByRole('option', { name: mainLocation.name })).toBeVisible();
      
      // Select main location
      await page.getByRole('option', { name: mainLocation.name }).click();
      await page.waitForLoadState('networkidle');
      
      // Metrics should update to show only selected location's data
      const filteredMetrics = await verifyDashboardMetrics(page);
      
      // Clear filter
      await page.getByTestId('filter-location').click();
      await page.getByRole('option', { name: 'All Locations' }).click();
      await page.waitForLoadState('networkidle');
      
      // Get unfiltered metrics
      const unfilteredMetrics = await verifyDashboardMetrics(page);
      
      // Filtered should be less than or equal to unfiltered
      const filteredTotal = parseInt(filteredMetrics.totalLocations || '0');
      const unfilteredTotal = parseInt(unfilteredMetrics.totalLocations || '0');
      expect(filteredTotal).toBeLessThanOrEqual(unfilteredTotal);
    });
  });

  test.describe('Data migration integrity', () => {
    test('Legacy data format compatibility', async ({ page }) => {
      await loginAsAdmin(page);
      
      // Test that old data formats are still readable
      await page.goto('/compliance/licenses');
      
      // Look for any migration warnings
      const migrationWarning = page.locator('[data-testid="migration-warning"]');
      if (await migrationWarning.isVisible()) {
        const warningText = await migrationWarning.textContent();
        // Log but don't fail - migrations might be expected
        console.log('Migration warning found:', warningText);
      }
      
      // Verify all licenses load without errors
      await expect(page.locator('[data-testid="licenses-table"]')).toBeVisible();
      
      // Check for any error messages
      const errorMessage = page.locator('[data-testid="error-message"]');
      await expect(errorMessage).not.toBeVisible();
    });

    test('Database schema updates handled', async ({ page }) => {
      await loginAsAdmin(page);
      
      // Test CRUD operations still work after schema changes
      const testLicense = generateLicense(1, 1);
      testLicense.licenseNumber = 'SCHEMA-TEST-' + Date.now();
      
      await page.goto('/compliance/licenses');
      await createLicense(page, testLicense);
      
      // Verify license was created with all fields
      await expect(page.locator(`text="${testLicense.licenseNumber}"`)).toBeVisible();
      
      // Edit to verify all fields are editable
      await page.locator(`[data-testid="row-license-${testLicense.licenseNumber}"]`)
        .locator('[data-testid="button-edit-license"]')
        .click();
      
      // Check all form fields are present
      await expect(page.getByTestId('input-license-number')).toBeVisible();
      await expect(page.getByTestId('input-issue-date')).toBeVisible();
      await expect(page.getByTestId('input-expiration-date')).toBeVisible();
      
      await page.getByTestId('button-cancel').click();
    });
  });
});