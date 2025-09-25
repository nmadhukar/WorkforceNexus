/**
 * Onboarding Test Helpers
 * 
 * Provides utilities for testing employee onboarding flows,
 * including data generation, form filling, and database operations.
 */

import { Page, expect } from '@playwright/test';
import request from 'supertest';
import type { Application } from 'express';
import { testDb } from './test-db';

/**
 * Generate comprehensive test employee data for all 12 form steps
 */
export function generateEmployeeData(overrides: Partial<any> = {}) {
  const timestamp = Date.now();
  const uniqueId = Math.random().toString(36).substring(7);
  
  return {
    // Step 1: Personal Information
    personalInfo: {
      firstName: `Test${uniqueId}`,
      middleName: 'Middle',
      lastName: `Employee${timestamp}`,
      dateOfBirth: '1990-01-15',
      gender: 'male',
      ssn: `${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 90) + 10}-${Math.floor(Math.random() * 9000) + 1000}`,
      personalEmail: `test${timestamp}@personal.com`,
      workEmail: `test${timestamp}@hospital.com`,
      cellPhone: '555-123-4567',
      workPhone: '555-987-6543',
      homeAddress1: '123 Test Street',
      homeAddress2: 'Suite 100',
      homeCity: 'Test City',
      homeState: 'CA',
      homeZip: '12345',
      ...overrides.personalInfo
    },
    
    // Step 2: Professional Information
    professionalInfo: {
      jobTitle: 'Test Physician',
      workLocation: 'Main Hospital',
      qualification: 'MD',
      npiNumber: `${Math.floor(Math.random() * 9000000000) + 1000000000}`,
      enumerationDate: '2020-01-01',
      ...overrides.professionalInfo
    },
    
    // Step 3: Credentials
    credentials: {
      medicalLicenseNumber: `MD${Math.floor(Math.random() * 900000) + 100000}`,
      substanceUseLicenseNumber: `SUB${Math.floor(Math.random() * 900000) + 100000}`,
      substanceUseQualification: 'Substance Use Specialist',
      mentalHealthLicenseNumber: `MH${Math.floor(Math.random() * 900000) + 100000}`,
      mentalHealthQualification: 'Mental Health Counselor',
      medicaidNumber: `MED${Math.floor(Math.random() * 900000) + 100000}`,
      medicarePtanNumber: `PTAN${Math.floor(Math.random() * 900000) + 100000}`,
      ...overrides.credentials
    },
    
    // Step 4: Additional Information (CAQH)
    additionalInfo: {
      caqhProviderId: `CAQH${Math.floor(Math.random() * 900000) + 100000}`,
      caqhIssueDate: '2020-06-01',
      caqhLastAttestationDate: '2024-01-01',
      caqhEnabled: true,
      caqhReattestationDueDate: '2025-01-01',
      caqhLoginId: `caqh${timestamp}@hospital.com`,
      caqhPassword: 'SecureCAQH123!',
      nppesLoginId: `nppes${timestamp}@hospital.com`,
      nppesPassword: 'SecureNPPES123!',
      ...overrides.additionalInfo
    },
    
    // Step 5: Education & Employment History
    educationEmployment: {
      educations: [
        {
          institution: 'Test Medical School',
          degree: 'Doctor of Medicine',
          fieldOfStudy: 'Medicine',
          graduationDate: '2015-05-15',
          city: 'Boston',
          state: 'MA'
        },
        {
          institution: 'Test University',
          degree: 'Bachelor of Science',
          fieldOfStudy: 'Biology',
          graduationDate: '2011-05-15',
          city: 'New York',
          state: 'NY'
        }
      ],
      employments: [
        {
          employer: 'Previous Hospital',
          position: 'Resident Physician',
          startDate: '2015-07-01',
          endDate: '2020-06-30',
          city: 'Chicago',
          state: 'IL',
          reasonForLeaving: 'Career advancement'
        }
      ],
      ...overrides.educationEmployment
    },
    
    // Step 6: State Licenses & DEA Licenses
    licenses: {
      stateLicenses: [
        {
          state: 'CA',
          licenseNumber: `CA${Math.floor(Math.random() * 900000) + 100000}`,
          issueDate: '2020-01-01',
          expirationDate: '2025-12-31',
          status: 'active'
        }
      ],
      deaLicenses: [
        {
          registrationNumber: `BM${Math.floor(Math.random() * 9000000) + 1000000}`,
          issueDate: '2020-03-01',
          expirationDate: '2025-03-01',
          status: 'active',
          schedules: ['II', 'III', 'IV', 'V']
        }
      ],
      ...overrides.licenses
    },
    
    // Step 7: Board Certifications
    certifications: {
      boardCertifications: [
        {
          boardName: 'American Board of Internal Medicine',
          certificationName: 'Internal Medicine',
          certificationNumber: `ABIM${Math.floor(Math.random() * 900000) + 100000}`,
          issueDate: '2020-07-01',
          expirationDate: '2030-07-01',
          status: 'active'
        }
      ],
      ...overrides.certifications
    },
    
    // Step 8: References & Emergency Contacts
    referencesContacts: {
      peerReferences: [
        {
          name: 'Dr. Reference One',
          title: 'Chief Medical Officer',
          organization: 'Reference Hospital',
          email: 'reference1@hospital.com',
          phone: '555-111-1111',
          relationship: 'Colleague'
        },
        {
          name: 'Dr. Reference Two',
          title: 'Department Head',
          organization: 'Medical Center',
          email: 'reference2@medical.com',
          phone: '555-222-2222',
          relationship: 'Supervisor'
        }
      ],
      emergencyContacts: [
        {
          name: 'Emergency Contact',
          relationship: 'Spouse',
          phone: '555-999-9999',
          email: 'emergency@personal.com',
          address: '456 Emergency Lane'
        }
      ],
      ...overrides.referencesContacts
    },
    
    // Step 9: Tax Documentation
    taxDocumentation: {
      taxForms: [
        {
          formType: 'W-4',
          year: 2024,
          filingStatus: 'Married filing jointly',
          allowances: 2,
          additionalWithholding: 0,
          submissionDate: '2024-01-15'
        },
        {
          formType: 'State Tax',
          year: 2024,
          state: 'CA',
          filingStatus: 'Married filing jointly',
          submissionDate: '2024-01-15'
        }
      ],
      ...overrides.taxDocumentation
    },
    
    // Step 10: Training & Payer Enrollment
    trainingPayer: {
      trainings: [
        {
          trainingName: 'HIPAA Compliance',
          provider: 'Hospital Training Center',
          completionDate: '2024-01-10',
          expirationDate: '2025-01-10',
          certificateNumber: 'HIPAA2024-001',
          hours: 8
        },
        {
          trainingName: 'CPR Certification',
          provider: 'American Heart Association',
          completionDate: '2024-02-01',
          expirationDate: '2026-02-01',
          certificateNumber: 'CPR2024-001',
          hours: 4
        }
      ],
      payerEnrollments: [
        {
          payerName: 'Medicare',
          enrollmentDate: '2020-03-01',
          providerNumber: `MCARE${Math.floor(Math.random() * 900000) + 100000}`,
          status: 'active'
        },
        {
          payerName: 'Blue Cross Blue Shield',
          enrollmentDate: '2020-04-01',
          providerNumber: `BCBS${Math.floor(Math.random() * 900000) + 100000}`,
          status: 'active'
        }
      ],
      ...overrides.trainingPayer
    },
    
    // Step 11: Incident Logs
    incidentLogs: {
      incidents: [], // Usually empty for new employees
      ...overrides.incidentLogs
    },
    
    // Step 12: Forms & Documents
    formsDocuments: {
      documents: [], // Will be populated during testing
      ...overrides.formsDocuments
    }
  };
}

/**
 * Create an invitation and get the invitation link
 */
export async function createInvitation(page: Page, invitationData: {
  firstName: string;
  lastName: string;
  email: string;
  role?: string;
}) {
  // Navigate to employees page
  await page.goto('/employees');
  await page.waitForLoadState('networkidle');
  
  // Click on Invitations tab
  await page.click('[data-testid="tab-invitations"], button:has-text("Invitations")');
  
  // Click create invitation button
  await page.click('[data-testid="button-create-invitation"], button:has-text("Create Invitation")');
  
  // Fill invitation form
  await page.fill('[data-testid="input-firstName"]', invitationData.firstName);
  await page.fill('[data-testid="input-lastName"]', invitationData.lastName);
  await page.fill('[data-testid="input-email"]', invitationData.email);
  
  if (invitationData.role) {
    await page.selectOption('[data-testid="select-role"]', invitationData.role);
  }
  
  // Submit invitation
  await page.click('[data-testid="button-submit"], button:has-text("Send Invitation")');
  
  // Wait for success message
  await page.waitForSelector('.toast-success, [data-testid*="toast-success"]');
  
  // Get the invitation token from the table or API response
  const invitationRow = page.locator(`tr:has-text("${invitationData.email}")`).first();
  const token = await invitationRow.getAttribute('data-invitation-token');
  
  return {
    token,
    invitationLink: `/register/${token}`
  };
}

/**
 * Fill Step 1: Personal Information
 */
export async function fillPersonalInfo(page: Page, data: any) {
  await page.fill('[data-testid="input-firstName"]', data.firstName);
  await page.fill('[data-testid="input-middleName"]', data.middleName || '');
  await page.fill('[data-testid="input-lastName"]', data.lastName);
  await page.fill('[data-testid="input-dateOfBirth"]', data.dateOfBirth);
  await page.selectOption('[data-testid="select-gender"]', data.gender);
  await page.fill('[data-testid="input-ssn"]', data.ssn);
  await page.fill('[data-testid="input-personalEmail"]', data.personalEmail);
  await page.fill('[data-testid="input-workEmail"]', data.workEmail);
  await page.fill('[data-testid="input-cellPhone"]', data.cellPhone);
  await page.fill('[data-testid="input-workPhone"]', data.workPhone || '');
  await page.fill('[data-testid="input-homeAddress1"]', data.homeAddress1);
  await page.fill('[data-testid="input-homeAddress2"]', data.homeAddress2 || '');
  await page.fill('[data-testid="input-homeCity"]', data.homeCity);
  await page.fill('[data-testid="input-homeState"]', data.homeState);
  await page.fill('[data-testid="input-homeZip"]', data.homeZip);
}

/**
 * Fill Step 2: Professional Information
 */
export async function fillProfessionalInfo(page: Page, data: any) {
  await page.fill('[data-testid="input-jobTitle"]', data.jobTitle);
  await page.fill('[data-testid="input-workLocation"]', data.workLocation);
  await page.fill('[data-testid="input-qualification"]', data.qualification);
  await page.fill('[data-testid="input-npiNumber"]', data.npiNumber);
  await page.fill('[data-testid="input-enumerationDate"]', data.enumerationDate);
}

/**
 * Fill Step 3: Credentials
 */
export async function fillCredentials(page: Page, data: any) {
  await page.fill('[data-testid="input-medicalLicenseNumber"]', data.medicalLicenseNumber);
  await page.fill('[data-testid="input-substanceUseLicenseNumber"]', data.substanceUseLicenseNumber || '');
  await page.fill('[data-testid="input-substanceUseQualification"]', data.substanceUseQualification || '');
  await page.fill('[data-testid="input-mentalHealthLicenseNumber"]', data.mentalHealthLicenseNumber || '');
  await page.fill('[data-testid="input-mentalHealthQualification"]', data.mentalHealthQualification || '');
  await page.fill('[data-testid="input-medicaidNumber"]', data.medicaidNumber || '');
  await page.fill('[data-testid="input-medicarePtanNumber"]', data.medicarePtanNumber || '');
}

/**
 * Fill Step 4: Additional Information (CAQH)
 */
export async function fillAdditionalInfo(page: Page, data: any) {
  await page.fill('[data-testid="input-caqhProviderId"]', data.caqhProviderId || '');
  await page.fill('[data-testid="input-caqhIssueDate"]', data.caqhIssueDate || '');
  await page.fill('[data-testid="input-caqhLastAttestationDate"]', data.caqhLastAttestationDate || '');
  
  if (data.caqhEnabled) {
    await page.check('[data-testid="checkbox-caqhEnabled"]');
  }
  
  await page.fill('[data-testid="input-caqhReattestationDueDate"]', data.caqhReattestationDueDate || '');
  await page.fill('[data-testid="input-caqhLoginId"]', data.caqhLoginId || '');
  await page.fill('[data-testid="input-caqhPassword"]', data.caqhPassword || '');
  await page.fill('[data-testid="input-nppesLoginId"]', data.nppesLoginId || '');
  await page.fill('[data-testid="input-nppesPassword"]', data.nppesPassword || '');
}

/**
 * Fill Step 5: Education & Employment History
 */
export async function fillEducationEmployment(page: Page, data: any) {
  // Add educations
  for (const education of data.educations || []) {
    await page.click('[data-testid="button-add-education"]');
    await page.fill('[data-testid="input-education-institution"]', education.institution);
    await page.fill('[data-testid="input-education-degree"]', education.degree);
    await page.fill('[data-testid="input-education-fieldOfStudy"]', education.fieldOfStudy);
    await page.fill('[data-testid="input-education-graduationDate"]', education.graduationDate);
    await page.fill('[data-testid="input-education-city"]', education.city);
    await page.fill('[data-testid="input-education-state"]', education.state);
    await page.click('[data-testid="button-save-education"]');
  }
  
  // Add employments
  for (const employment of data.employments || []) {
    await page.click('[data-testid="button-add-employment"]');
    await page.fill('[data-testid="input-employment-employer"]', employment.employer);
    await page.fill('[data-testid="input-employment-position"]', employment.position);
    await page.fill('[data-testid="input-employment-startDate"]', employment.startDate);
    await page.fill('[data-testid="input-employment-endDate"]', employment.endDate || '');
    await page.fill('[data-testid="input-employment-city"]', employment.city);
    await page.fill('[data-testid="input-employment-state"]', employment.state);
    await page.fill('[data-testid="input-employment-reasonForLeaving"]', employment.reasonForLeaving || '');
    await page.click('[data-testid="button-save-employment"]');
  }
}

/**
 * Fill Step 6: Licenses (State & DEA)
 */
export async function fillLicenses(page: Page, data: any) {
  // Add state licenses
  for (const license of data.stateLicenses || []) {
    await page.click('[data-testid="button-add-state-license"]');
    await page.fill('[data-testid="input-license-state"]', license.state);
    await page.fill('[data-testid="input-license-number"]', license.licenseNumber);
    await page.fill('[data-testid="input-license-issueDate"]', license.issueDate);
    await page.fill('[data-testid="input-license-expirationDate"]', license.expirationDate);
    await page.selectOption('[data-testid="select-license-status"]', license.status);
    await page.click('[data-testid="button-save-license"]');
  }
  
  // Add DEA licenses
  for (const dea of data.deaLicenses || []) {
    await page.click('[data-testid="button-add-dea-license"]');
    await page.fill('[data-testid="input-dea-registrationNumber"]', dea.registrationNumber);
    await page.fill('[data-testid="input-dea-issueDate"]', dea.issueDate);
    await page.fill('[data-testid="input-dea-expirationDate"]', dea.expirationDate);
    await page.selectOption('[data-testid="select-dea-status"]', dea.status);
    
    // Select schedules
    for (const schedule of dea.schedules || []) {
      await page.check(`[data-testid="checkbox-schedule-${schedule}"]`);
    }
    
    await page.click('[data-testid="button-save-dea"]');
  }
}

/**
 * Fill Step 7: Board Certifications
 */
export async function fillCertifications(page: Page, data: any) {
  for (const cert of data.boardCertifications || []) {
    await page.click('[data-testid="button-add-certification"]');
    await page.fill('[data-testid="input-cert-boardName"]', cert.boardName);
    await page.fill('[data-testid="input-cert-certificationName"]', cert.certificationName);
    await page.fill('[data-testid="input-cert-certificationNumber"]', cert.certificationNumber);
    await page.fill('[data-testid="input-cert-issueDate"]', cert.issueDate);
    await page.fill('[data-testid="input-cert-expirationDate"]', cert.expirationDate);
    await page.selectOption('[data-testid="select-cert-status"]', cert.status);
    await page.click('[data-testid="button-save-certification"]');
  }
}

/**
 * Fill Step 8: References & Emergency Contacts
 */
export async function fillReferencesContacts(page: Page, data: any) {
  // Add peer references
  for (const ref of data.peerReferences || []) {
    await page.click('[data-testid="button-add-reference"]');
    await page.fill('[data-testid="input-ref-name"]', ref.name);
    await page.fill('[data-testid="input-ref-title"]', ref.title);
    await page.fill('[data-testid="input-ref-organization"]', ref.organization);
    await page.fill('[data-testid="input-ref-email"]', ref.email);
    await page.fill('[data-testid="input-ref-phone"]', ref.phone);
    await page.fill('[data-testid="input-ref-relationship"]', ref.relationship);
    await page.click('[data-testid="button-save-reference"]');
  }
  
  // Add emergency contacts
  for (const contact of data.emergencyContacts || []) {
    await page.click('[data-testid="button-add-emergency-contact"]');
    await page.fill('[data-testid="input-contact-name"]', contact.name);
    await page.fill('[data-testid="input-contact-relationship"]', contact.relationship);
    await page.fill('[data-testid="input-contact-phone"]', contact.phone);
    await page.fill('[data-testid="input-contact-email"]', contact.email || '');
    await page.fill('[data-testid="input-contact-address"]', contact.address || '');
    await page.click('[data-testid="button-save-contact"]');
  }
}

/**
 * Fill Step 9: Tax Documentation
 */
export async function fillTaxDocumentation(page: Page, data: any) {
  for (const form of data.taxForms || []) {
    await page.click('[data-testid="button-add-tax-form"]');
    await page.selectOption('[data-testid="select-tax-formType"]', form.formType);
    await page.fill('[data-testid="input-tax-year"]', form.year.toString());
    await page.selectOption('[data-testid="select-tax-filingStatus"]', form.filingStatus);
    
    if (form.allowances !== undefined) {
      await page.fill('[data-testid="input-tax-allowances"]', form.allowances.toString());
    }
    
    if (form.additionalWithholding !== undefined) {
      await page.fill('[data-testid="input-tax-additionalWithholding"]', form.additionalWithholding.toString());
    }
    
    if (form.state) {
      await page.fill('[data-testid="input-tax-state"]', form.state);
    }
    
    await page.fill('[data-testid="input-tax-submissionDate"]', form.submissionDate);
    await page.click('[data-testid="button-save-tax-form"]');
  }
}

/**
 * Fill Step 10: Training & Payer Enrollment
 */
export async function fillTrainingPayer(page: Page, data: any) {
  // Add trainings
  for (const training of data.trainings || []) {
    await page.click('[data-testid="button-add-training"]');
    await page.fill('[data-testid="input-training-name"]', training.trainingName);
    await page.fill('[data-testid="input-training-provider"]', training.provider);
    await page.fill('[data-testid="input-training-completionDate"]', training.completionDate);
    await page.fill('[data-testid="input-training-expirationDate"]', training.expirationDate);
    await page.fill('[data-testid="input-training-certificateNumber"]', training.certificateNumber);
    await page.fill('[data-testid="input-training-hours"]', training.hours.toString());
    await page.click('[data-testid="button-save-training"]');
  }
  
  // Add payer enrollments
  for (const enrollment of data.payerEnrollments || []) {
    await page.click('[data-testid="button-add-payer-enrollment"]');
    await page.fill('[data-testid="input-payer-name"]', enrollment.payerName);
    await page.fill('[data-testid="input-payer-enrollmentDate"]', enrollment.enrollmentDate);
    await page.fill('[data-testid="input-payer-providerNumber"]', enrollment.providerNumber);
    await page.selectOption('[data-testid="select-payer-status"]', enrollment.status);
    await page.click('[data-testid="button-save-enrollment"]');
  }
}

/**
 * Fill Step 11: Incident Logs
 */
export async function fillIncidentLogs(page: Page, data: any) {
  for (const incident of data.incidents || []) {
    await page.click('[data-testid="button-add-incident"]');
    await page.fill('[data-testid="input-incident-date"]', incident.incidentDate);
    await page.selectOption('[data-testid="select-incident-type"]', incident.incidentType);
    await page.fill('[data-testid="textarea-incident-description"]', incident.description);
    await page.fill('[data-testid="textarea-incident-resolution"]', incident.resolution || '');
    await page.selectOption('[data-testid="select-incident-severity"]', incident.severity);
    await page.click('[data-testid="button-save-incident"]');
  }
}

/**
 * Fill Step 12: Forms & Documents
 */
export async function fillFormsDocuments(page: Page, data: any) {
  // This step typically involves file uploads
  for (const doc of data.documents || []) {
    if (doc.filePath) {
      const fileInput = page.locator('[data-testid="input-document-upload"]');
      await fileInput.setInputFiles(doc.filePath);
      
      // Add document metadata
      await page.fill('[data-testid="input-document-name"]', doc.name);
      await page.selectOption('[data-testid="select-document-type"]', doc.type);
      await page.click('[data-testid="button-upload-document"]');
      
      // Wait for upload success
      await page.waitForSelector('[data-testid="upload-success"]');
    }
  }
}

/**
 * Complete all 12 onboarding steps
 */
export async function completeFullOnboarding(page: Page, data: ReturnType<typeof generateEmployeeData>) {
  // Step 1: Personal Information
  await fillPersonalInfo(page, data.personalInfo);
  await page.click('[data-testid="button-next"]');
  
  // Step 2: Professional Information
  await fillProfessionalInfo(page, data.professionalInfo);
  await page.click('[data-testid="button-next"]');
  
  // Step 3: Credentials
  await fillCredentials(page, data.credentials);
  await page.click('[data-testid="button-next"]');
  
  // Step 4: Additional Information
  await fillAdditionalInfo(page, data.additionalInfo);
  await page.click('[data-testid="button-next"]');
  
  // Step 5: Education & Employment
  await fillEducationEmployment(page, data.educationEmployment);
  await page.click('[data-testid="button-next"]');
  
  // Step 6: Licenses
  await fillLicenses(page, data.licenses);
  await page.click('[data-testid="button-next"]');
  
  // Step 7: Certifications
  await fillCertifications(page, data.certifications);
  await page.click('[data-testid="button-next"]');
  
  // Step 8: References & Contacts
  await fillReferencesContacts(page, data.referencesContacts);
  await page.click('[data-testid="button-next"]');
  
  // Step 9: Tax Documentation
  await fillTaxDocumentation(page, data.taxDocumentation);
  await page.click('[data-testid="button-next"]');
  
  // Step 10: Training & Payer
  await fillTrainingPayer(page, data.trainingPayer);
  await page.click('[data-testid="button-next"]');
  
  // Step 11: Incident Logs
  await fillIncidentLogs(page, data.incidentLogs);
  await page.click('[data-testid="button-next"]');
  
  // Step 12: Forms & Documents
  await fillFormsDocuments(page, data.formsDocuments);
  
  // Review step (13th step) - Submit
  await page.click('[data-testid="button-submit"], button:has-text("Submit")');
  
  // Wait for success
  await page.waitForSelector('[data-testid="toast-success"], .toast-success');
}

/**
 * Clean up test employees from database
 */
export async function cleanupTestEmployees(employeeIds: string[]) {
  if (employeeIds.length === 0) return;
  
  try {
    for (const id of employeeIds) {
      await testDb.deleteEmployee(id);
    }
  } catch (error) {
    console.error('Error cleaning up test employees:', error);
  }
}

/**
 * Create an expired invitation for testing
 */
export async function createExpiredInvitation(app: Application, invitationData: any) {
  const invitation = await testDb.createTestInvitation({
    ...invitationData,
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
    expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
  });
  
  return invitation;
}

/**
 * Verify invitation exists in database
 */
export async function verifyInvitationInDatabase(token: string) {
  const invitation = await testDb.getInvitationByToken(token);
  return invitation;
}

/**
 * Get employee from database by email
 */
export async function getEmployeeByEmail(email: string) {
  const employee = await testDb.getEmployeeByEmail(email);
  return employee;
}

/**
 * Verify audit log entry exists
 */
export async function verifyAuditLog(action: string, entityType: string) {
  const auditLog = await testDb.getLatestAuditLog(action, entityType);
  return auditLog;
}

/**
 * Save form draft at specific step
 */
export async function saveDraftAtStep(page: Page, stepNumber: number) {
  // Navigate to the specific step
  for (let i = 1; i < stepNumber; i++) {
    await page.click('[data-testid="button-next"]');
  }
  
  // Click save draft
  await page.click('[data-testid="button-save-draft"], button:has-text("Save Draft")');
  
  // Wait for success message
  await page.waitForSelector('[data-testid="toast-success"], .toast-success');
}

/**
 * Resume draft form from specific step
 */
export async function resumeDraftFromStep(page: Page, employeeId: string, expectedStep: number) {
  // Navigate to employee edit form
  await page.goto(`/employees/${employeeId}/edit`);
  
  // Verify we're on the expected step
  const activeStep = page.locator(`[data-step="${expectedStep}"].active, .step-${expectedStep}.active`);
  await expect(activeStep).toBeVisible();
}