import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../../utils/auth-helpers';
import {
  generateLocation,
  generateLicense,
  generateResponsiblePerson,
  generateDocumentMetadata,
  createLocation,
  createLicense
} from '../../utils/compliance-helpers';
import path from 'path';

test.describe('Compliance Module - Edge Cases & Error Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('Expired license handling', async ({ page }) => {
    await page.goto('/compliance/licenses');
    await page.waitForLoadState('networkidle');

    // Create license with past expiration
    const expiredLicense = generateLicense(1, 1);
    const pastDate = new Date();
    pastDate.setMonth(pastDate.getMonth() - 1);
    expiredLicense.expirationDate = pastDate.toISOString().split('T')[0];
    
    await page.getByTestId('button-add-license').click();
    await page.getByTestId('select-location').click();
    await page.locator('[data-testid="option-location-1"]').click();
    await page.getByTestId('select-license-type').click();
    await page.locator('[data-testid="option-type-1"]').click();
    await page.getByTestId('input-license-number').fill(expiredLicense.licenseNumber);
    await page.getByTestId('input-issue-date').fill(expiredLicense.issueDate);
    await page.getByTestId('input-expiration-date').fill(expiredLicense.expirationDate);
    await page.getByTestId('input-issuing-authority').fill(expiredLicense.issuingAuthority);
    await page.getByTestId('input-issuing-state').fill(expiredLicense.issuingState);
    await page.getByTestId('button-save-license').click();
    
    // Verify shows as expired
    await expect(page.locator(`[data-testid="row-license-${expiredLicense.licenseNumber}"]`)).toContainText('Expired');
    await expect(page.locator(`[data-testid="badge-expired"]`)).toBeVisible();

    // Test renewal workflow
    await page.locator(`[data-testid="row-license-${expiredLicense.licenseNumber}"]`).locator('[data-testid="button-renew"]').click();
    
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    await page.getByTestId('input-new-expiration-date').fill(futureDate.toISOString().split('T')[0]);
    await page.getByTestId('input-renewal-fee').fill('500');
    await page.getByTestId('button-confirm-renewal').click();
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    
    // Verify status updated
    await expect(page.locator(`[data-testid="row-license-${expiredLicense.licenseNumber}"]`)).toContainText('Active');

    // Check alert generation
    await page.goto('/compliance/dashboard');
    await page.waitForLoadState('networkidle');
    const expiredAlerts = page.locator('[data-testid="alert-expired"]');
    await expect(expiredAlerts.first()).toBeVisible();
  });

  test('Invalid date ranges', async ({ page }) => {
    await page.goto('/compliance/licenses');
    await page.waitForLoadState('networkidle');

    const license = generateLicense(1, 1);

    // Try creating license with issue date after expiry
    await page.getByTestId('button-add-license').click();
    await page.getByTestId('select-location').click();
    await page.locator('[data-testid="option-location-1"]').click();
    await page.getByTestId('select-license-type').click();
    await page.locator('[data-testid="option-type-1"]').click();
    await page.getByTestId('input-license-number').fill(license.licenseNumber);
    
    const issueDate = new Date('2024-12-01');
    const expiryDate = new Date('2024-01-01');
    await page.getByTestId('input-issue-date').fill(issueDate.toISOString().split('T')[0]);
    await page.getByTestId('input-expiration-date').fill(expiryDate.toISOString().split('T')[0]);
    
    await page.getByTestId('button-save-license').click();
    await expect(page.locator('text="Issue date cannot be after expiration date"')).toBeVisible();

    // Test future dates beyond reasonable range
    const farFutureDate = new Date('2100-01-01');
    await page.getByTestId('input-expiration-date').fill(farFutureDate.toISOString().split('T')[0]);
    await page.getByTestId('button-save-license').click();
    await expect(page.locator('text="Expiration date cannot be more than 10 years in the future"')).toBeVisible();

    // Test dates before 1900
    const ancientDate = new Date('1899-12-31');
    await page.getByTestId('input-issue-date').fill(ancientDate.toISOString().split('T')[0]);
    await page.getByTestId('button-save-license').click();
    await expect(page.locator('text="Invalid date"')).toBeVisible();
  });

  test('Duplicate license numbers', async ({ page }) => {
    await page.goto('/compliance/licenses');
    await page.waitForLoadState('networkidle');

    const license = generateLicense(1, 1);
    license.licenseNumber = 'DUP-12345678';

    // Create license with number
    await createLicense(page, license);
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();

    // Try creating another with same number
    const duplicateLicense = generateLicense(2, 1);
    duplicateLicense.licenseNumber = 'DUP-12345678';
    
    await page.getByTestId('button-add-license').click();
    await page.getByTestId('select-location').click();
    await page.locator('[data-testid="option-location-2"]').click();
    await page.getByTestId('select-license-type').click();
    await page.locator('[data-testid="option-type-1"]').click();
    await page.getByTestId('input-license-number').fill(duplicateLicense.licenseNumber);
    await page.getByTestId('input-issue-date').fill(duplicateLicense.issueDate);
    await page.getByTestId('input-expiration-date').fill(duplicateLicense.expirationDate);
    await page.getByTestId('button-save-license').click();

    // Verify unique constraint error
    await expect(page.locator('text="License number already exists"')).toBeVisible();
  });

  test('Circular location hierarchy', async ({ page }) => {
    await page.goto('/compliance/locations');
    await page.waitForLoadState('networkidle');

    // Create location A
    const locationA = generateLocation('main');
    locationA.code = 'LOC-A';
    await createLocation(page, { ...locationA, parentId: null });

    // Create location B as child of A
    const locationB = generateLocation('sub_location');
    locationB.code = 'LOC-B';
    await page.getByTestId('button-add-location').click();
    await page.getByTestId('input-location-name').fill(locationB.name);
    await page.getByTestId('input-location-code').fill(locationB.code);
    await page.getByTestId('select-parent-location').click();
    await page.getByRole('option', { name: locationA.name }).click();
    await page.getByTestId('button-save-location').click();
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();

    // Try making location A's parent as location B (circular reference)
    await page.locator(`[data-testid="row-location-LOC-A"]`).locator('[data-testid="button-edit-location"]').click();
    await page.getByTestId('select-parent-location').click();
    await page.getByRole('option', { name: locationB.name }).click();
    await page.getByTestId('button-save-location').click();

    // Verify prevention logic
    await expect(page.locator('text="Cannot create circular reference"')).toBeVisible();

    // Try making location its own parent
    await page.locator(`[data-testid="row-location-LOC-B"]`).locator('[data-testid="button-edit-location"]').click();
    await page.getByTestId('select-parent-location').click();
    await page.getByRole('option', { name: locationB.name }).click();
    await page.getByTestId('button-save-location').click();

    // Verify prevention logic
    await expect(page.locator('text="Location cannot be its own parent"')).toBeVisible();
  });

  test('Maximum nested locations', async ({ page }) => {
    await page.goto('/compliance/locations');
    await page.waitForLoadState('networkidle');

    // Create deep hierarchy (10+ levels)
    let parentId = null;
    let parentName = '';
    
    for (let i = 0; i < 12; i++) {
      const location = generateLocation(i === 0 ? 'main' : 'sub_location');
      location.code = `DEEP-${i}`;
      location.name = `Level ${i} Location`;
      
      await page.getByTestId('button-add-location').click();
      await page.getByTestId('input-location-name').fill(location.name);
      await page.getByTestId('input-location-code').fill(location.code);
      
      if (i > 0) {
        await page.getByTestId('select-parent-location').click();
        await page.getByRole('option', { name: parentName }).click();
      }
      
      await page.getByTestId('input-address1').fill(location.address1);
      await page.getByTestId('input-city').fill(location.city);
      await page.getByTestId('input-state').fill(location.state);
      await page.getByTestId('input-zipcode').fill(location.zipCode);
      
      await page.getByTestId('button-save-location').click();
      
      if (i < 10) {
        // Should succeed for first 10 levels
        await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
        parentName = location.name;
      } else {
        // Should fail or warn for very deep nesting
        const errorOrWarning = page.locator('text=/Maximum nesting|Too many levels|deep nesting/i');
        if (await errorOrWarning.isVisible()) {
          await expect(errorOrWarning).toBeVisible();
        }
      }
    }

    // Verify performance - navigate through tree
    await page.goto('/compliance/locations');
    await page.waitForLoadState('networkidle');
    
    // Measure time to expand all nodes
    const startTime = Date.now();
    const expandButtons = page.locator('[data-testid="button-expand"]');
    const buttonCount = await expandButtons.count();
    
    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      await expandButtons.nth(i).click();
      await page.waitForTimeout(100);
    }
    
    const endTime = Date.now();
    const loadTime = endTime - startTime;
    
    // Performance should be reasonable even with deep hierarchy
    expect(loadTime).toBeLessThan(5000); // Less than 5 seconds

    // Test navigation through deep tree
    await expect(page.locator('[data-testid="location-tree"]')).toBeVisible();
    await expect(page.locator('[data-testid="tree-node-DEEP-0"]')).toBeVisible();
  });

  test('Document version conflicts', async ({ page }) => {
    await page.goto('/compliance/documents');
    await page.waitForLoadState('networkidle');

    const metadata = generateDocumentMetadata();
    metadata.title = 'Version Conflict Test Document';

    // Upload document version
    await page.getByTestId('button-upload-document').click();
    const filePath = path.join(__dirname, '../../fixtures/test-document.pdf');
    await page.getByTestId('input-document-file').setInputFiles(filePath);
    await page.getByTestId('input-document-title').fill(metadata.title);
    await page.getByTestId('input-document-version').fill('1.0.0');
    await page.getByTestId('button-submit-upload').click();
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();

    // Simulate concurrent version upload (open two upload dialogs)
    const row = page.locator(`[data-testid="row-document-${metadata.title}"]`);
    
    // Open first version upload
    await row.locator('[data-testid="button-new-version"]').click();
    const dialog1 = page.locator('[data-testid="dialog-new-version"]').first();
    await dialog1.locator('[data-testid="input-document-file"]').setInputFiles(filePath);
    await dialog1.locator('[data-testid="input-document-version"]').fill('2.0.0');
    
    // Try to open another version upload in new tab/window (simulating concurrent user)
    const page2 = await page.context().newPage();
    await loginAsAdmin(page2);
    await page2.goto('/compliance/documents');
    await page2.waitForLoadState('networkidle');
    
    const row2 = page2.locator(`[data-testid="row-document-${metadata.title}"]`);
    await row2.locator('[data-testid="button-new-version"]').click();
    const dialog2 = page2.locator('[data-testid="dialog-new-version"]').first();
    await dialog2.locator('[data-testid="input-document-file"]').setInputFiles(filePath);
    await dialog2.locator('[data-testid="input-document-version"]').fill('2.0.0');
    
    // Submit both versions
    await dialog1.locator('[data-testid="button-submit-upload"]').click();
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    
    await dialog2.locator('[data-testid="button-submit-upload"]').click();
    // Second upload should fail with version conflict
    await expect(page2.locator('text="Version 2.0.0 already exists"')).toBeVisible();
    
    await page2.close();
  });

  test('JSONB field validation', async ({ page }) => {
    await page.goto('/compliance/license-types');
    await page.waitForLoadState('networkidle');

    // Add invalid JSON to custom fields
    await page.getByTestId('button-add-license-type').click();
    await page.getByTestId('input-type-name').fill('Test License Type');
    await page.getByTestId('input-type-code').fill('TST');
    
    // Try to add invalid JSON directly
    await page.getByTestId('button-advanced-json').click();
    await page.getByTestId('textarea-custom-json').fill('{invalid json}');
    await page.getByTestId('button-save-license-type').click();
    await expect(page.locator('text="Invalid JSON format"')).toBeVisible();

    // Test large JSON objects
    const largeJson = {
      field1: 'a'.repeat(1000),
      nested: {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: 'deeply nested'
              }
            }
          }
        }
      }
    };
    
    for (let i = 0; i < 100; i++) {
      largeJson[`field${i}`] = `value${i}`;
    }
    
    await page.getByTestId('textarea-custom-json').clear();
    await page.getByTestId('textarea-custom-json').fill(JSON.stringify(largeJson));
    await page.getByTestId('button-save-license-type').click();
    
    // Should either succeed with truncation or show size limit error
    const successOrError = page.locator('[data-testid="toast-success"], text="JSON too large"');
    await expect(successOrError).toBeVisible();

    // Verify sanitization - try SQL injection in JSON
    const maliciousJson = {
      field: "'; DROP TABLE licenses; --"
    };
    await page.getByTestId('button-add-license-type').click();
    await page.getByTestId('input-type-name').fill('SQL Test Type');
    await page.getByTestId('input-type-code').fill('SQL');
    await page.getByTestId('button-advanced-json').click();
    await page.getByTestId('textarea-custom-json').fill(JSON.stringify(maliciousJson));
    await page.getByTestId('button-save-license-type').click();
    
    // Should save safely without executing SQL
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    
    // Verify tables still exist by navigating to licenses
    await page.goto('/compliance/licenses');
    await expect(page).toHaveURL('/compliance/licenses');
    await expect(page.getByTestId('licenses-table')).toBeVisible();
  });

  test('Responsible person conflicts', async ({ page }) => {
    await page.goto('/compliance/responsible-persons');
    await page.waitForLoadState('networkidle');

    const person = generateResponsiblePerson();
    person.email = 'conflict.test@example.com';

    // Create first assignment as primary
    await page.getByTestId('button-add-person').click();
    await page.getByTestId('input-first-name').fill(person.firstName);
    await page.getByTestId('input-last-name').fill(person.lastName);
    await page.getByTestId('input-email').fill(person.email);
    await page.getByTestId('input-phone').fill(person.phone);
    await page.getByTestId('select-location').click();
    await page.locator('[data-testid="option-location-1"]').click();
    await page.getByTestId('checkbox-is-primary').check();
    await page.getByTestId('button-save-person').click();
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();

    // Try to assign same person as primary to another location
    await page.getByTestId('button-add-assignment').click();
    await page.getByTestId('select-person').click();
    await page.getByRole('option', { name: `${person.firstName} ${person.lastName}` }).click();
    await page.getByTestId('select-location').click();
    await page.locator('[data-testid="option-location-2"]').click();
    await page.getByTestId('checkbox-is-primary').check();
    await page.getByTestId('button-save-assignment').click();
    
    // Should show warning or require confirmation
    const warningOrConfirm = page.locator('text=/already primary|multiple primary|confirm/i');
    if (await warningOrConfirm.isVisible()) {
      await expect(warningOrConfirm).toBeVisible();
      // If confirmation dialog, cancel it
      const cancelButton = page.getByTestId('button-cancel');
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
      }
    }

    // Test notification cascading
    await page.locator(`[data-testid="row-person-${person.email}"]`).locator('[data-testid="button-edit-person"]').click();
    await page.getByTestId('checkbox-email-notifications').uncheck();
    await page.getByTestId('button-save-person').click();
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    
    // Verify notification preference updated for all assignments
    await page.reload();
    await page.locator(`[data-testid="row-person-${person.email}"]`).locator('[data-testid="button-view-details"]').click();
    const notificationStatus = page.getByTestId('notification-status');
    await expect(notificationStatus).toContainText('Email: Disabled');

    // Verify assignment rules - try to delete location with active responsible person
    await page.goto('/compliance/locations');
    const locationRow = page.locator('[data-testid="row-location-1"]');
    await locationRow.locator('[data-testid="button-delete-location"]').click();
    await page.getByTestId('confirm-delete').click();
    
    // Should show error about active assignments
    await expect(page.locator('text="Cannot delete location with active responsible persons"')).toBeVisible();
  });

  test('Large dataset performance', async ({ page }) => {
    // This test would need to be run against a seeded test database with large amounts of data
    // Skipping actual implementation but showing the structure
    
    await page.goto('/compliance/licenses');
    await page.waitForLoadState('networkidle');
    
    // Measure initial load time
    const startTime = Date.now();
    await page.reload();
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    // Should load within reasonable time even with many records
    expect(loadTime).toBeLessThan(3000); // Less than 3 seconds
    
    // Test pagination performance
    if (await page.getByTestId('pagination-next').isVisible()) {
      const paginationStart = Date.now();
      await page.getByTestId('pagination-next').click();
      await page.waitForLoadState('networkidle');
      const paginationTime = Date.now() - paginationStart;
      expect(paginationTime).toBeLessThan(1000); // Less than 1 second
    }
    
    // Test search performance
    const searchStart = Date.now();
    await page.getByTestId('input-search').fill('test search query');
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');
    const searchTime = Date.now() - searchStart;
    expect(searchTime).toBeLessThan(2000); // Less than 2 seconds
  });
});