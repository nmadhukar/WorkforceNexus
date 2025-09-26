#!/bin/bash
# Test script to verify date sanitization fix

echo "🧪 Testing Date Sanitization Fix"
echo "================================"

# Step 1: Login as admin
echo -e "\n🔐 Logging in as admin..."
ADMIN_COOKIE=$(curl -s -c cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' \
  -D - | grep -i "set-cookie" | sed 's/^.*: //' | sed 's/;.*//')

if [ -z "$ADMIN_COOKIE" ]; then
  echo "❌ Failed to login as admin"
  exit 1
fi
echo "✅ Logged in as admin"

# Step 2: Create a prospective employee user
echo -e "\n👤 Creating prospective employee..."
TIMESTAMP=$(date +%s)
USER_RESPONSE=$(curl -s -b cookies.txt -X POST http://localhost:5000/api/admin/users \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"prospect_$TIMESTAMP\",\"password\":\"test123\",\"role\":\"prospective_employee\",\"email\":\"prospect_$TIMESTAMP@test.com\"}")

USERNAME=$(echo $USER_RESPONSE | grep -o '"username":"[^"]*"' | cut -d'"' -f4)
if [ -z "$USERNAME" ]; then
  echo "❌ Failed to create prospective employee"
  echo "Response: $USER_RESPONSE"
  exit 1
fi
echo "✅ Created user: $USERNAME"

# Step 3: Login as prospective employee
echo -e "\n🔑 Logging in as prospective employee..."
PROSPECT_COOKIE=$(curl -s -c cookies2.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"test123\"}" \
  -D - | grep -i "set-cookie" | sed 's/^.*: //' | sed 's/;.*//')

if [ -z "$PROSPECT_COOKIE" ]; then
  echo "❌ Failed to login as prospective employee"
  exit 1
fi
echo "✅ Logged in as prospective employee"

# Step 4: Test onboarding submission with empty date strings
echo -e "\n📝 Testing /api/onboarding/submit with empty date strings..."
echo "Sending data with empty date fields that should be converted to null..."

RESPONSE=$(curl -s -w "\n%{http_code}" -b cookies2.txt -X POST http://localhost:5000/api/onboarding/submit \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "workEmail": "test'$TIMESTAMP'@example.com",
    "dateOfBirth": "",
    "date_of_birth": "",
    "dlExpirationDate": "",
    "dl_expiration_date": "",
    "licenseExpiryDate": "",
    "license_expiry_date": "",
    "certificationExpiryDate": "",
    "certification_expiry_date": "",
    "onboarding_completed_at": "",
    "caqhIssueDate": "",
    "caqhLastAttestationDate": "",
    "caqhReattestationDueDate": "",
    "enumerationDate": "",
    "educations": [{
      "schoolInstitution": "Test University",
      "degree": "MD",
      "startDate": "",
      "endDate": "",
      "graduationDate": ""
    }],
    "employments": [{
      "employer": "Test Hospital",
      "position": "Doctor",
      "startDate": "",
      "endDate": ""
    }]
  }')

# Extract HTTP status code (last line)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
# Extract response body (everything except last line)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "Response HTTP Code: $HTTP_CODE"
echo "Response Body: $BODY"

# Check if submission was successful
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "\n✅ SUCCESS! Onboarding submitted without date errors"
  echo "The date sanitization fix is working correctly!"
  echo "Empty date strings are being properly converted to null."
else
  echo -e "\n❌ FAILED! HTTP Code: $HTTP_CODE"
  
  # Check for specific date error
  if echo "$BODY" | grep -q "invalid input syntax for type date"; then
    echo "⚠️ DATE ERROR STILL PRESENT - Empty strings are not being converted to null"
    echo "The fix needs further investigation."
  fi
  
  if echo "$BODY" | grep -q "unnamed portal parameter"; then
    echo "⚠️ SQL PARAMETER ERROR - A date field is still passing empty string to database"
  fi
fi

# Clean up
rm -f cookies.txt cookies2.txt

echo -e "\n📊 Check the server console for debug logs:"
echo "Look for lines starting with '[sanitizeDateFields]' and '[/api/onboarding/submit]'"
echo "These will show exactly which date fields are being processed."