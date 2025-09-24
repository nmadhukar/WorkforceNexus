const http = require('http');

// Test endpoint existence without auth
function testEndpoint(path, method = 'GET') {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      console.log(`${method} ${path}: Status ${res.statusCode}`);
      resolve(res.statusCode);
    });

    req.on('error', (error) => {
      console.error(`Error testing ${path}:`, error.message);
      resolve(0);
    });

    req.end();
  });
}

// Test our new endpoints
async function runTests() {
  console.log('Testing DocuSeal Forms API endpoints:');
  console.log('=====================================');
  
  // Test the new endpoints we added
  await testEndpoint('/api/forms/submissions?employeeId=1');
  await testEndpoint('/api/forms/submissions/1/sign');
  await testEndpoint('/api/forms/submissions/1/hr-sign');
  
  console.log('\nAll endpoints tested. Status 401 means endpoint exists but needs auth.');
  console.log('Status 403 means endpoint exists but needs specific role.');
}

runTests();
