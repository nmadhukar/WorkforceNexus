import { Page } from '@playwright/test';
import { faker } from '@faker-js/faker';

/**
 * Generate test location data
 */
export function generateLocation(type: 'main' | 'sub_location' | 'branch' = 'sub_location') {
  return {
    name: faker.company.name() + ' Clinic',
    code: faker.string.alphanumeric(6).toUpperCase(),
    type: type,
    parentId: type === 'main' ? undefined : 1,
    address1: faker.location.streetAddress(),
    address2: faker.location.secondaryAddress(),
    city: faker.location.city(),
    state: faker.location.state({ abbreviated: true }),
    zipCode: faker.location.zipCode(),
    country: 'USA',
    phone: faker.phone.number('###-###-####'),
    fax: faker.phone.number('###-###-####'),
    email: faker.internet.email(),
    website: faker.internet.url(),
    taxId: faker.string.numeric(9),
    npiNumber: faker.string.numeric(10),
    status: 'active',
    isComplianceRequired: true,
    complianceNotes: faker.lorem.sentence()
  };
}

/**
 * Generate test license data
 */
export function generateLicense(locationId: number, typeId: number) {
  const issueDate = faker.date.past({ years: 2 });
  const expirationDate = faker.date.future({ years: 1 });
  
  return {
    locationId: locationId,
    licenseTypeId: typeId,
    licenseNumber: 'LIC-' + faker.string.alphanumeric(8).toUpperCase(),
    issueDate: issueDate.toISOString().split('T')[0],
    expirationDate: expirationDate.toISOString().split('T')[0],
    status: 'active',
    complianceStatus: 'compliant',
    issuingAuthority: faker.company.name() + ' Medical Board',
    issuingState: faker.location.state({ abbreviated: true }),
    applicationDate: faker.date.recent().toISOString().split('T')[0],
    renewalDate: faker.date.future().toISOString().split('T')[0],
    renewalStatus: 'not_started',
    renewalNotes: faker.lorem.sentence(),
    verificationDate: faker.date.recent().toISOString().split('T')[0],
    verifiedBy: faker.person.fullName(),
    fees: faker.number.int({ min: 100, max: 1000 }).toString(),
    attachmentPath: null,
    responsiblePersonId: null
  };
}

/**
 * Generate test responsible person data
 */
export function generateResponsiblePerson() {
  return {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    title: faker.person.jobTitle(),
    email: faker.internet.email(),
    phone: faker.phone.number('###-###-####'),
    locationId: 1,
    isPrimary: true,
    licenseNumber: 'MED-' + faker.string.alphanumeric(8).toUpperCase(),
    npiNumber: faker.string.numeric(10),
    deaNumber: 'BX' + faker.string.numeric(7),
    startDate: faker.date.past().toISOString().split('T')[0],
    endDate: null,
    notificationPreferences: {
      email: true,
      sms: false,
      dashboard: true,
      daysBeforeExpiration: [30, 60, 90]
    },
    emergencyContact: faker.phone.number('###-###-####'),
    notes: faker.lorem.sentence()
  };
}

/**
 * Generate test license type data
 */
export function generateLicenseType() {
  const types = ['Medical', 'Pharmacy', 'Facility', 'Business', 'DEA', 'Professional'];
  return {
    name: faker.helpers.arrayElement(types) + ' License',
    code: faker.string.alpha(3).toUpperCase(),
    category: faker.helpers.arrayElement(['medical', 'facility', 'business']),
    renewalPeriodMonths: faker.helpers.arrayElement([12, 24, 36]),
    renewalReminderDays: faker.helpers.arrayElement([30, 60, 90]),
    isActive: true,
    requiredDocuments: ['Application', 'Certificate', 'Insurance'],
    customFields: {
      requiredCE: true,
      ceHours: 20,
      boardCertification: false
    },
    description: faker.lorem.paragraph()
  };
}

/**
 * Create a location through UI
 */
export async function createLocation(page: Page, data: any) {
  // Click add location button
  await page.getByTestId('button-add-location').click();
  
  // Fill location form
  await page.getByTestId('input-location-name').fill(data.name);
  await page.getByTestId('input-location-code').fill(data.code);
  await page.getByTestId('select-location-type').click();
  await page.getByTestId(`option-${data.type}`).click();
  
  if (data.parentId) {
    await page.getByTestId('select-parent-location').click();
    await page.getByTestId(`option-location-${data.parentId}`).click();
  }
  
  await page.getByTestId('input-address1').fill(data.address1);
  if (data.address2) {
    await page.getByTestId('input-address2').fill(data.address2);
  }
  await page.getByTestId('input-city').fill(data.city);
  await page.getByTestId('input-state').fill(data.state);
  await page.getByTestId('input-zipcode').fill(data.zipCode);
  await page.getByTestId('input-phone').fill(data.phone);
  await page.getByTestId('input-email').fill(data.email);
  
  // Submit form
  await page.getByTestId('button-save-location').click();
  
  // Wait for success message
  await page.waitForSelector('[data-testid="toast-success"]');
}

/**
 * Create a license through UI
 */
export async function createLicense(page: Page, data: any) {
  // Click add license button
  await page.getByTestId('button-add-license').click();
  
  // Fill license form
  await page.getByTestId('select-location').click();
  await page.getByTestId(`option-location-${data.locationId}`).click();
  
  await page.getByTestId('select-license-type').click();
  await page.getByTestId(`option-type-${data.licenseTypeId}`).click();
  
  await page.getByTestId('input-license-number').fill(data.licenseNumber);
  await page.getByTestId('input-issue-date').fill(data.issueDate);
  await page.getByTestId('input-expiration-date').fill(data.expirationDate);
  await page.getByTestId('input-issuing-authority').fill(data.issuingAuthority);
  await page.getByTestId('input-issuing-state').fill(data.issuingState);
  
  // Submit form
  await page.getByTestId('button-save-license').click();
  
  // Wait for success message
  await page.waitForSelector('[data-testid="toast-success"]');
}

/**
 * Verify expiration alert exists
 */
export async function verifyExpirationAlert(page: Page, days: number) {
  // Navigate to alerts or dashboard
  await page.goto('/compliance/dashboard');
  
  // Look for alert with specific day count
  const alertSelector = `[data-testid="alert-expiring-${days}-days"]`;
  await page.waitForSelector(alertSelector);
  
  const alertText = await page.locator(alertSelector).textContent();
  return alertText?.includes(`${days} days`) || false;
}

/**
 * Verify dashboard metrics
 */
export async function verifyDashboardMetrics(page: Page) {
  await page.goto('/compliance/dashboard');
  
  // Wait for dashboard to load
  await page.waitForSelector('[data-testid="dashboard-metrics"]');
  
  const metrics = {
    totalLocations: await page.getByTestId('metric-total-locations').textContent(),
    activeLicenses: await page.getByTestId('metric-active-licenses').textContent(),
    expiringIn30Days: await page.getByTestId('metric-expiring-30').textContent(),
    expiringIn60Days: await page.getByTestId('metric-expiring-60').textContent(),
    expiringIn90Days: await page.getByTestId('metric-expiring-90').textContent(),
    expiredLicenses: await page.getByTestId('metric-expired').textContent(),
    documentsCount: await page.getByTestId('metric-documents').textContent(),
    nonCompliantCount: await page.getByTestId('metric-noncompliant').textContent()
  };
  
  return metrics;
}

/**
 * Upload compliance document
 */
export async function uploadComplianceDocument(page: Page, filePath: string, metadata: any) {
  await page.goto('/compliance/documents');
  
  // Click upload button
  await page.getByTestId('button-upload-document').click();
  
  // Select file
  const fileInput = await page.getByTestId('input-document-file');
  await fileInput.setInputFiles(filePath);
  
  // Fill metadata
  await page.getByTestId('input-document-title').fill(metadata.title);
  await page.getByTestId('select-document-category').click();
  await page.getByTestId(`option-category-${metadata.category}`).click();
  
  if (metadata.version) {
    await page.getByTestId('input-document-version').fill(metadata.version);
  }
  
  if (metadata.tags) {
    await page.getByTestId('input-document-tags').fill(metadata.tags.join(', '));
  }
  
  // Submit
  await page.getByTestId('button-submit-upload').click();
  
  // Wait for upload to complete
  await page.waitForSelector('[data-testid="toast-success"]');
}

/**
 * Export compliance report
 */
export async function exportComplianceReport(page: Page, format: 'csv' | 'json') {
  await page.goto('/compliance/dashboard');
  
  // Click export button
  await page.getByTestId('button-export-report').click();
  
  // Select format
  await page.getByTestId('select-export-format').click();
  await page.getByTestId(`option-format-${format}`).click();
  
  // Start download
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('button-confirm-export').click();
  
  const download = await downloadPromise;
  return download;
}

/**
 * Clean up compliance test data
 */
export async function cleanupComplianceData() {
  // This would connect to test database and clean up test data
  // Implementation depends on test database setup
  console.log('Cleaning up compliance test data...');
  
  // In a real implementation, this would:
  // 1. Delete test licenses
  // 2. Delete test locations
  // 3. Delete test documents
  // 4. Delete test responsible persons
  // 5. Delete test license types
}

/**
 * Create test data for multi-location scenario
 */
export async function setupMultiLocationScenario(page: Page) {
  // Create main location
  const mainLocation = generateLocation('main');
  await createLocation(page, { ...mainLocation, parentId: null });
  
  // Create 5 sub-locations
  for (let i = 0; i < 5; i++) {
    const subLocation = generateLocation('sub_location');
    await createLocation(page, { ...subLocation, parentId: 1 });
  }
  
  // Create license types
  const licenseTypes = ['Medical', 'Pharmacy', 'Facility', 'Business'];
  for (const type of licenseTypes) {
    const licenseType = generateLicenseType();
    licenseType.name = type + ' License';
    // Would create via API or UI
  }
  
  // Create licenses for each location
  for (let locationId = 1; locationId <= 6; locationId++) {
    for (let typeId = 1; typeId <= 4; typeId++) {
      const license = generateLicense(locationId, typeId);
      await createLicense(page, license);
    }
  }
}

/**
 * Check if license is expired
 */
export function isLicenseExpired(expirationDate: string): boolean {
  const expDate = new Date(expirationDate);
  const today = new Date();
  return expDate < today;
}

/**
 * Calculate days until expiration
 */
export function daysUntilExpiration(expirationDate: string): number {
  const expDate = new Date(expirationDate);
  const today = new Date();
  const diffTime = expDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Generate test document metadata
 */
export function generateDocumentMetadata() {
  return {
    title: faker.lorem.words(3),
    category: faker.helpers.arrayElement(['policy', 'certificate', 'permit', 'inspection', 'other']),
    version: faker.system.semver(),
    tags: faker.lorem.words(3).split(' '),
    description: faker.lorem.paragraph(),
    relatedEntityType: 'license',
    relatedEntityId: faker.number.int({ min: 1, max: 100 })
  };
}