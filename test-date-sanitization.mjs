#!/usr/bin/env node
/**
 * Test script to verify date sanitization is working correctly
 * This tests the /api/onboarding/submit endpoint with various date field scenarios
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:5000';

// Test data with empty date strings that should be converted to null
const testData = {
  firstName: 'Test',
  lastName: 'User',
  workEmail: `test.user.${Date.now()}@example.com`,
  dateOfBirth: '',  // Empty string should become null
  date_of_birth: '',  // Snake case version
  dlExpirationDate: '',  // Driver's license expiration
  dl_expiration_date: '',
  licenseExpiryDate: '',  // License expiry
  license_expiry_date: '',
  certificationExpiryDate: '',  // Certification expiry
  certification_expiry_date: '',
  onboarding_completed_at: '',  // Onboarding timestamp
  caqhIssueDate: '',
  caqh_issue_date: '',
  caqhLastAttestationDate: '',
  caqh_last_attestation_date: '',
  caqhReattestationDueDate: '',
  caqh_reattestation_due_date: '',
  enumerationDate: '',
  enumeration_date: '',
  // Nested objects with date fields
  educations: [
    {
      schoolInstitution: 'Test University',
      degree: 'MD',
      startDate: '',  // Empty date
      endDate: '',
      graduationDate: ''
    }
  ],
  employments: [
    {
      employer: 'Test Hospital',
      position: 'Doctor',
      startDate: '',  // Empty date
      endDate: '',
      terminationDate: ''
    }
  ],
  licenses: [
    {
      licenseNumber: 'TEST123',
      state: 'CA',
      issueDate: '',
      expirationDate: '',
      renewalDate: ''
    }
  ]
};

async function loginAsAdmin() {
  try {
    console.log('🔐 Logging in as admin...');
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin' })
    });
    
    if (!response.ok) {
      throw new Error(`Login failed: ${response.status}`);
    }
    
    const setCookie = response.headers.get('set-cookie');
    if (!setCookie) {
      throw new Error('No session cookie received');
    }
    
    console.log('✅ Logged in successfully');
    return setCookie;
  } catch (error) {
    console.error('❌ Login failed:', error);
    throw error;
  }
}

async function createProspectiveEmployee(sessionCookie) {
  try {
    console.log('👤 Creating prospective employee account...');
    
    // First create a user account
    const userResponse = await fetch(`${API_URL}/api/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: JSON.stringify({
        username: `prospective_${Date.now()}`,
        password: 'test123',
        role: 'prospective_employee',
        email: `prospective_${Date.now()}@example.com`
      })
    });
    
    if (!userResponse.ok) {
      const error = await userResponse.text();
      throw new Error(`Failed to create prospective employee: ${error}`);
    }
    
    const user = await userResponse.json();
    console.log('✅ Created prospective employee user:', user.username);
    
    // Login as the prospective employee
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user.username, password: 'test123' })
    });
    
    if (!loginResponse.ok) {
      throw new Error(`Failed to login as prospective employee: ${loginResponse.status}`);
    }
    
    const prospectiveCookie = loginResponse.headers.get('set-cookie');
    console.log('✅ Logged in as prospective employee');
    
    return { user, sessionCookie: prospectiveCookie };
  } catch (error) {
    console.error('❌ Failed to create prospective employee:', error);
    throw error;
  }
}

async function testOnboardingSubmit(sessionCookie) {
  try {
    console.log('\n📝 Testing /api/onboarding/submit with empty date strings...');
    console.log('Test data includes:', Object.keys(testData).filter(k => k.includes('date') || k.includes('Date') || k.includes('_at')));
    
    const response = await fetch(`${API_URL}/api/onboarding/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: JSON.stringify(testData)
    });
    
    const responseText = await response.text();
    console.log('Response status:', response.status);
    console.log('Response body:', responseText);
    
    if (response.ok) {
      console.log('✅ Onboarding submitted successfully - date fields were properly sanitized!');
      return true;
    } else {
      console.error('❌ Onboarding submission failed:', responseText);
      
      // Check if it's a date-related error
      if (responseText.includes('invalid input syntax for type date') || 
          responseText.includes('unnamed portal parameter')) {
        console.error('⚠️ DATE SANITIZATION FAILED - Empty strings were not converted to null');
        console.error('This is the exact issue we need to fix!');
      }
      
      return false;
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    return false;
  }
}

async function checkServerLogs(sessionCookie) {
  console.log('\n📊 Checking server logs for our sanitization debug output...');
  console.log('Look for lines starting with "[sanitizeDateFields]" and "[/api/onboarding/submit]" in the server console');
}

async function runTest() {
  console.log('🧪 Starting date sanitization test...\n');
  
  try {
    // Step 1: Login as admin
    const adminCookie = await loginAsAdmin();
    
    // Step 2: Create a prospective employee
    const { user, sessionCookie } = await createProspectiveEmployee(adminCookie);
    
    // Step 3: Test onboarding submission with empty date strings
    const success = await testOnboardingSubmit(sessionCookie);
    
    // Step 4: Check logs
    await checkServerLogs(sessionCookie);
    
    if (success) {
      console.log('\n✅ TEST PASSED: Date sanitization is working correctly');
      console.log('Empty date strings are being properly converted to null');
      process.exit(0);
    } else {
      console.log('\n❌ TEST FAILED: Date sanitization is not working properly');
      console.log('The issue persists and needs further investigation');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n💥 Test execution failed:', error);
    process.exit(1);
  }
}

// Run the test
console.log('🚀 Date Sanitization Test Script');
console.log('================================\n');
runTest();