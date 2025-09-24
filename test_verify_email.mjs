#!/usr/bin/env node

import fetch from 'node-fetch';

// Read cookies from cookies.txt
import fs from 'fs';
const cookies = fs.readFileSync('cookies.txt', 'utf8').trim();

// Test verify-email endpoint
async function testVerifyEmail() {
  console.log('Testing /api/admin/ses-config/verify-email endpoint...');
  
  try {
    const response = await fetch('http://localhost:5000/api/admin/ses-config/verify-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies
      },
      body: JSON.stringify({
        email: 'admin@atcemr.com'
      })
    });

    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log('\n✅ Verification request sent successfully!');
      console.log('Please check the admin@atcemr.com inbox for AWS verification email.');
    } else {
      console.log('\n❌ Failed to send verification request');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run test
testVerifyEmail();