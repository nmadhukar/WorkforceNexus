#!/usr/bin/env node

const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Create a test file
const testContent = 'This is a test document for S3 upload verification';
const testFilePath = path.join(__dirname, 'test-s3-upload.txt');
fs.writeFileSync(testFilePath, testContent);

async function testS3Upload() {
  try {
    // First, login to get a session
    console.log('Logging in as admin...');
    const loginResponse = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin'
      }),
      credentials: 'include'
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }

    const cookies = loginResponse.headers.get('set-cookie');
    console.log('Login successful');

    // Now upload a document
    console.log('Testing document upload to S3...');
    const form = new FormData();
    form.append('document', fs.createReadStream(testFilePath), {
      filename: 'test-s3-upload.txt',
      contentType: 'text/plain'
    });
    form.append('employeeId', '1');
    form.append('documentType', 'test');

    const uploadResponse = await fetch('http://localhost:5000/api/documents/upload', {
      method: 'POST',
      body: form,
      headers: {
        ...form.getHeaders(),
        'Cookie': cookies
      }
    });

    const result = await uploadResponse.json();
    console.log('Upload response:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('✅ Document upload successful!');
      console.log('Storage type:', result.storageType);
      console.log('Storage key:', result.storageKey);
      
      if (result.storageType === 's3') {
        console.log('✅ Document uploaded to S3 successfully!');
      } else if (result.storageType === 'local') {
        console.log('⚠️ Document uploaded to local storage (S3 upload may have failed)');
      }
    } else {
      console.log('❌ Upload failed:', result.error);
    }

    // Check S3 service status
    console.log('\nChecking S3 service status...');
    const statusResponse = await fetch('http://localhost:5000/api/s3/status', {
      method: 'GET',
      headers: {
        'Cookie': cookies
      }
    });

    if (statusResponse.ok) {
      const status = await statusResponse.json();
      console.log('S3 Service status:', JSON.stringify(status, null, 2));
    }

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Clean up test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  }
}

// Run the test
testS3Upload();