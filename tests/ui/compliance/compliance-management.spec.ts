import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../../utils/auth-helpers';
import { 
  generateLocation, 
  generateLicense, 
  generateResponsiblePerson,
  generateLicenseType,
  createLocation,
  createLicense,
  verifyExpirationAlert,
  verifyDashboardMetrics,
  uploadComplianceDocument,
  exportComplianceReport,
  setupMultiLocationScenario,
  generateDocumentMetadata
} from '../../utils/compliance-helpers';
import path from 'path';

test.describe('Compliance Module - E2E Workflow Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('Create and manage clinic locations', async ({ page }) => {
    // Navigate to Compliance > Locations
    await page.goto('/compliance/locations');
    await page.waitForLoadState('networkidle');

    // Create main clinic location
    const mainLocation = generateLocation('main');
    await page.getByTestId('button-add-location').click();
    await page.getByTestId('input-location-name').fill(mainLocation.name);
    await page.getByTestId('input-location-code').fill(mainLocation.code);
    await page.getByTestId('select-location-type').click();
    await page.getByRole('option', { name: 'Main Clinic' }).click();
    
    await page.getByTestId('input-address1').fill(mainLocation.address1);
    await page.getByTestId('input-city').fill(mainLocation.city);
    await page.getByTestId('input-state').fill(mainLocation.state);
    await page.getByTestId('input-zipcode').fill(mainLocation.zipCode);
    await page.getByTestId('input-phone').fill(mainLocation.phone);
    await page.getByTestId('input-email').fill(mainLocation.email);
    
    await page.getByTestId('button-save-location').click();
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    
    // Verify main location appears in list
    await expect(page.locator(`text="${mainLocation.name}"`)).toBeVisible();

    // Add sub-location/branch
    const subLocation = generateLocation('sub_location');
    await page.getByTestId('button-add-location').click();
    await page.getByTestId('input-location-name').fill(subLocation.name);
    await page.getByTestId('input-location-code').fill(subLocation.code);
    await page.getByTestId('select-location-type').click();
    await page.getByRole('option', { name: 'Sub-location' }).click();
    
    await page.getByTestId('select-parent-location').click();
    await page.getByRole('option', { name: mainLocation.name }).first().click();
    
    await page.getByTestId('input-address1').fill(subLocation.address1);
    await page.getByTestId('input-city').fill(subLocation.city);
    await page.getByTestId('input-state').fill(subLocation.state);
    await page.getByTestId('input-zipcode').fill(subLocation.zipCode);
    await page.getByTestId('input-phone').fill(subLocation.phone);
    await page.getByTestId('input-email').fill(subLocation.email);
    
    await page.getByTestId('button-save-location').click();
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();

    // Edit location details
    await page.locator(`[data-testid="row-location-${mainLocation.code}"]`).locator('[data-testid="button-edit-location"]').click();
    await page.getByTestId('input-location-name').clear();
    await page.getByTestId('input-location-name').fill(mainLocation.name + ' Updated');
    await page.getByTestId('button-save-location').click();
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    
    // Verify updated name appears
    await expect(page.locator(`text="${mainLocation.name} Updated"`)).toBeVisible();

    // Set location as inactive
    await page.locator(`[data-testid="row-location-${mainLocation.code}"]`).locator('[data-testid="button-edit-location"]').click();
    await page.getByTestId('select-location-status').click();
    await page.getByRole('option', { name: 'Inactive' }).click();
    await page.getByTestId('button-save-location').click();
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    
    // Verify hierarchy display
    await expect(page.locator('[data-testid="location-tree"]')).toBeVisible();
    await expect(page.locator(`[data-testid="tree-node-${mainLocation.code}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="tree-node-${subLocation.code}"]`)).toBeVisible();
  });

  test('Manage license types', async ({ page }) => {
    // Navigate to License Types
    await page.goto('/compliance/license-types');
    await page.waitForLoadState('networkidle');

    const licenseTypes = ['Medical', 'Pharmacy', 'Facility', 'Business'];
    
    for (const typeName of licenseTypes) {
      // Create new license type
      await page.getByTestId('button-add-license-type').click();
      await page.getByTestId('input-type-name').fill(`${typeName} License`);
      await page.getByTestId('input-type-code').fill(typeName.substring(0, 3).toUpperCase());
      
      // Set renewal period
      await page.getByTestId('input-renewal-period').fill('24');
      await page.getByTestId('select-renewal-unit').click();
      await page.getByRole('option', { name: 'Months' }).click();
      
      // Add custom fields (JSONB)
      await page.getByTestId('button-add-custom-field').click();
      await page.getByTestId('input-field-name').fill('requiredCE');
      await page.getByTestId('input-field-value').fill('true');
      
      await page.getByTestId('button-add-custom-field').click();
      await page.getByTestId('input-field-name-2').fill('ceHours');
      await page.getByTestId('input-field-value-2').fill('20');
      
      await page.getByTestId('button-save-license-type').click();
      await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
      
      // Verify type appears in list
      await expect(page.locator(`text="${typeName} License"`)).toBeVisible();
    }

    // Edit existing type
    await page.locator('[data-testid="row-type-MED"]').locator('[data-testid="button-edit-type"]').click();
    await page.getByTestId('input-renewal-period').clear();
    await page.getByTestId('input-renewal-period').fill('36');
    await page.getByTestId('button-save-license-type').click();
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();

    // Delete unused type (create one first to delete)
    await page.getByTestId('button-add-license-type').click();
    await page.getByTestId('input-type-name').fill('Temporary License');
    await page.getByTestId('input-type-code').fill('TMP');
    await page.getByTestId('button-save-license-type').click();
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    
    // Now delete it
    await page.locator('[data-testid="row-type-TMP"]').locator('[data-testid="button-delete-type"]').click();
    await page.getByTestId('confirm-delete').click();
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    await expect(page.locator(`text="Temporary License"`)).not.toBeVisible();
  });

  test('Assign responsible persons', async ({ page }) => {
    // Navigate to Responsible Persons
    await page.goto('/compliance/responsible-persons');
    await page.waitForLoadState('networkidle');

    const responsiblePerson = generateResponsiblePerson();

    // Create responsible person record
    await page.getByTestId('button-add-person').click();
    await page.getByTestId('input-first-name').fill(responsiblePerson.firstName);
    await page.getByTestId('input-last-name').fill(responsiblePerson.lastName);
    await page.getByTestId('input-title').fill(responsiblePerson.title);
    await page.getByTestId('input-email').fill(responsiblePerson.email);
    await page.getByTestId('input-phone').fill(responsiblePerson.phone);
    
    // Assign to location
    await page.getByTestId('select-location').click();
    await page.locator('[data-testid="option-location-1"]').click();
    
    // Set as primary/backup
    await page.getByTestId('checkbox-is-primary').check();
    
    // Update notification preferences
    await page.getByTestId('checkbox-email-notifications').check();
    await page.getByTestId('checkbox-dashboard-notifications').check();
    await page.getByTestId('select-reminder-days').click();
    await page.getByRole('option', { name: '30 days' }).click();
    await page.getByRole('option', { name: '60 days' }).click();
    await page.getByRole('option', { name: '90 days' }).click();
    await page.keyboard.press('Escape');
    
    await page.getByTestId('button-save-person').click();
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    
    // Verify person appears in list
    await expect(page.locator(`text="${responsiblePerson.firstName} ${responsiblePerson.lastName}"`)).toBeVisible();

    // Change assignments
    await page.locator(`[data-testid="row-person-${responsiblePerson.email}"]`).locator('[data-testid="button-edit-person"]').click();
    await page.getByTestId('checkbox-is-primary').uncheck();
    await page.getByTestId('checkbox-is-backup').check();
    await page.getByTestId('button-save-person').click();
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    
    // Verify assignment change
    await expect(page.locator(`[data-testid="badge-backup"]`)).toBeVisible();
  });

  test('Track clinic licenses', async ({ page }) => {
    // Navigate to Clinic Licenses
    await page.goto('/compliance/licenses');
    await page.waitForLoadState('networkidle');

    const license = generateLicense(1, 1);

    // Add new license for location
    await page.getByTestId('button-add-license').click();
    
    await page.getByTestId('select-location').click();
    await page.locator('[data-testid="option-location-1"]').click();
    
    await page.getByTestId('select-license-type').click();
    await page.locator('[data-testid="option-type-1"]').click();
    
    await page.getByTestId('input-license-number').fill(license.licenseNumber);
    
    // Set expiration date
    await page.getByTestId('input-issue-date').fill(license.issueDate);
    await page.getByTestId('input-expiration-date').fill(license.expirationDate);
    
    await page.getByTestId('input-issuing-authority').fill(license.issuingAuthority);
    await page.getByTestId('input-issuing-state').fill(license.issuingState);
    
    // Upload supporting document
    const filePath = path.join(__dirname, '../../fixtures/test-document.pdf');
    await page.getByTestId('input-license-document').setInputFiles(filePath);
    
    // Track renewal status
    await page.getByTestId('select-renewal-status').click();
    await page.getByRole('option', { name: 'Pending' }).click();
    
    await page.getByTestId('button-save-license').click();
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    
    // Filter by expiring soon (30/60/90 days)
    await page.getByTestId('filter-expiring').click();
    await page.getByRole('option', { name: '30 days' }).click();
    await page.waitForLoadState('networkidle');
    
    await page.getByTestId('filter-expiring').click();
    await page.getByRole('option', { name: '60 days' }).click();
    await page.waitForLoadState('networkidle');
    
    await page.getByTestId('filter-expiring').click();
    await page.getByRole('option', { name: '90 days' }).click();
    await page.waitForLoadState('networkidle');
    
    // Verify license appears with correct status
    await page.getByTestId('filter-expiring').click();
    await page.getByRole('option', { name: 'All' }).click();
    await expect(page.locator(`text="${license.licenseNumber}"`)).toBeVisible();
  });

  test('Upload compliance documents', async ({ page }) => {
    // Navigate to Compliance Documents
    await page.goto('/compliance/documents');
    await page.waitForLoadState('networkidle');

    const metadata = generateDocumentMetadata();

    // Upload document with metadata
    await page.getByTestId('button-upload-document').click();
    
    const filePath = path.join(__dirname, '../../fixtures/test-document.pdf');
    await page.getByTestId('input-document-file').setInputFiles(filePath);
    
    await page.getByTestId('input-document-title').fill(metadata.title);
    
    // Categorize document
    await page.getByTestId('select-document-category').click();
    await page.getByRole('option', { name: 'Policy' }).click();
    
    // Set version number
    await page.getByTestId('input-document-version').fill('1.0.0');
    
    await page.getByTestId('input-document-description').fill(metadata.description);
    
    await page.getByTestId('button-submit-upload').click();
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    
    // Verify document appears in list
    await expect(page.locator(`text="${metadata.title}"`)).toBeVisible();

    // Replace with new version
    await page.locator(`[data-testid="row-document-${metadata.title}"]`).locator('[data-testid="button-new-version"]').click();
    const newFilePath = path.join(__dirname, '../../fixtures/test-document-v2.pdf');
    await page.getByTestId('input-document-file').setInputFiles(newFilePath);
    await page.getByTestId('input-document-version').clear();
    await page.getByTestId('input-document-version').fill('2.0.0');
    await page.getByTestId('button-submit-upload').click();
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();

    // Download document
    const downloadPromise = page.waitForEvent('download');
    await page.locator(`[data-testid="row-document-${metadata.title}"]`).locator('[data-testid="button-download"]').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.pdf');

    // Search and filter documents
    await page.getByTestId('input-search-documents').fill(metadata.title);
    await page.keyboard.press('Enter');
    await expect(page.locator(`text="${metadata.title}"`)).toBeVisible();
    
    await page.getByTestId('filter-category').click();
    await page.getByRole('option', { name: 'Policy' }).click();
    await expect(page.locator(`text="${metadata.title}"`)).toBeVisible();
  });

  test('Compliance dashboard overview', async ({ page }) => {
    // View dashboard metrics
    await page.goto('/compliance/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Verify dashboard metrics are displayed
    await expect(page.getByTestId('dashboard-metrics')).toBeVisible();
    await expect(page.getByTestId('metric-total-locations')).toBeVisible();
    await expect(page.getByTestId('metric-active-licenses')).toBeVisible();
    await expect(page.getByTestId('metric-expiring-30')).toBeVisible();
    await expect(page.getByTestId('metric-expiring-60')).toBeVisible();
    await expect(page.getByTestId('metric-expiring-90')).toBeVisible();
    await expect(page.getByTestId('metric-expired')).toBeVisible();
    await expect(page.getByTestId('metric-documents')).toBeVisible();
    await expect(page.getByTestId('metric-noncompliant')).toBeVisible();

    // Check expiration alerts (30/60/90 days)
    const alertSection = page.getByTestId('expiration-alerts');
    await expect(alertSection).toBeVisible();
    
    // Look for specific alert types
    const alerts30Day = page.locator('[data-testid="alert-expiring-30-days"]');
    const alerts60Day = page.locator('[data-testid="alert-expiring-60-days"]');
    const alerts90Day = page.locator('[data-testid="alert-expiring-90-days"]');
    
    // At least one type of alert should be visible if there are expiring licenses
    if (await alerts30Day.count() > 0) {
      await expect(alerts30Day.first()).toBeVisible();
    }
    if (await alerts60Day.count() > 0) {
      await expect(alerts60Day.first()).toBeVisible();
    }
    if (await alerts90Day.count() > 0) {
      await expect(alerts90Day.first()).toBeVisible();
    }

    // Export compliance report (CSV)
    await page.getByTestId('button-export-report').click();
    await page.getByTestId('select-export-format').click();
    await page.getByRole('option', { name: 'CSV' }).click();
    const csvDownloadPromise = page.waitForEvent('download');
    await page.getByTestId('button-confirm-export').click();
    const csvDownload = await csvDownloadPromise;
    expect(csvDownload.suggestedFilename()).toContain('.csv');

    // Export compliance report (JSON)
    await page.getByTestId('button-export-report').click();
    await page.getByTestId('select-export-format').click();
    await page.getByRole('option', { name: 'JSON' }).click();
    const jsonDownloadPromise = page.waitForEvent('download');
    await page.getByTestId('button-confirm-export').click();
    const jsonDownload = await jsonDownloadPromise;
    expect(jsonDownload.suggestedFilename()).toContain('.json');

    // View by location
    await page.getByTestId('filter-location').click();
    const firstLocation = page.getByRole('option').first();
    const locationName = await firstLocation.textContent();
    await firstLocation.click();
    await page.waitForLoadState('networkidle');
    
    // Verify filtered view
    if (locationName && locationName !== 'All Locations') {
      await expect(page.getByTestId('filtered-by-location')).toContainText(locationName);
    }

    // Filter by license type
    await page.getByTestId('filter-license-type').click();
    const firstType = page.getByRole('option').first();
    const typeName = await firstType.textContent();
    await firstType.click();
    await page.waitForLoadState('networkidle');
    
    // Verify filtered view
    if (typeName && typeName !== 'All Types') {
      await expect(page.getByTestId('filtered-by-type')).toContainText(typeName);
    }

    // Refresh dashboard
    await page.getByTestId('button-refresh-dashboard').click();
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    
    // Verify metrics updated timestamp
    const lastUpdated = page.getByTestId('last-updated-timestamp');
    await expect(lastUpdated).toBeVisible();
    const timestamp = await lastUpdated.textContent();
    expect(timestamp).toContain('Last updated');
  });

  test('Multi-location clinic scenario', async ({ page }) => {
    // Setup multi-location scenario
    await page.goto('/compliance/locations');
    
    // Create main location
    const mainLocation = generateLocation('main');
    await createLocation(page, { ...mainLocation, parentId: null });
    
    // Create 5 sub-locations
    const subLocations = [];
    for (let i = 0; i < 5; i++) {
      const subLocation = generateLocation('sub_location');
      subLocations.push(subLocation);
      await createLocation(page, { ...subLocation, parentId: 1 });
    }
    
    // Navigate to dashboard to verify rollup
    await page.goto('/compliance/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Verify all locations appear
    const totalLocations = await page.getByTestId('metric-total-locations').textContent();
    expect(parseInt(totalLocations || '0')).toBeGreaterThanOrEqual(6);
    
    // Verify hierarchy view
    await page.goto('/compliance/locations');
    await expect(page.locator('[data-testid="location-tree"]')).toBeVisible();
    
    // Verify main location has expand button
    const mainNode = page.locator(`[data-testid="tree-node-${mainLocation.code}"]`);
    await expect(mainNode).toBeVisible();
    const expandButton = mainNode.locator('[data-testid="button-expand"]');
    await expect(expandButton).toBeVisible();
    
    // Expand to see sub-locations
    await expandButton.click();
    for (const subLoc of subLocations) {
      await expect(page.locator(`[data-testid="tree-node-${subLoc.code}"]`)).toBeVisible();
    }
  });
});