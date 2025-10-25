#!/usr/bin/env node

import { s3Service } from './server/services/s3Service.js';

console.log('Testing S3 Service Configuration...\n');

// Check if S3 is configured
const isConfigured = s3Service.isConfigured();
console.log('S3 Service configured:', isConfigured);
console.log('Bucket name:', s3Service.getBucketName());

if (isConfigured) {
  console.log('\n✅ S3 Service is configured!');
  console.log('\nAttempting test upload...');
  
  // Create test data
  const testBuffer = Buffer.from('Test S3 upload content - ' + new Date().toISOString());
  const testKey = `test-uploads/test-${Date.now()}.txt`;
  
  try {
    const result = await s3Service.uploadFile(
      testBuffer,
      testKey,
      'text/plain',
      { test: 'true', timestamp: new Date().toISOString() }
    );
    
    console.log('\nUpload result:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      if (result.storageType === 's3') {
        console.log('\n✅ SUCCESS: Document uploaded to S3!');
        console.log('S3 Key:', result.storageKey);
        console.log('ETag:', result.etag);
      } else {
        console.log('\n⚠️ Document uploaded to local storage (S3 upload failed)');
        console.log('Local path:', result.storageKey);
      }
    } else {
      console.log('\n❌ Upload failed:', result.error);
    }
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
} else {
  console.log('\n❌ S3 Service is not configured!');
  console.log('Please check your AWS credentials and bucket configuration.');
}

process.exit(0);