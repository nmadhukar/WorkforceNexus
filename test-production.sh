#!/bin/bash

# Production deployment test script
# Usage: ./test-production.sh YOUR_DOMAIN

DOMAIN=${1:-"YOUR_DOMAIN.replit.app"}

echo "==================================="
echo "Production Deployment Test Script"
echo "Testing domain: $DOMAIN"
echo "==================================="

# Step 1: Test if admin account exists
echo ""
echo "1. Testing admin account status..."
echo "-----------------------------------"
RESPONSE=$(curl -s "https://$DOMAIN/api/test-admin")
echo "$RESPONSE" | jq .

# Check if admin exists
if echo "$RESPONSE" | jq -e '.exists == true' > /dev/null; then
    echo "✅ Admin account exists"
    
    # Check if password is valid
    if echo "$RESPONSE" | jq -e '.passwordValid == true' > /dev/null; then
        echo "✅ Password is valid"
    else
        echo "❌ Password verification failed"
    fi
    
    # Check if can login
    if echo "$RESPONSE" | jq -e '.canLogin == true' > /dev/null; then
        echo "✅ Admin can login"
    else
        echo "❌ Admin cannot login"
    fi
else
    echo "❌ Admin account does not exist"
    echo ""
    echo "2. Creating admin account..."
    echo "-----------------------------------"
    CREATE_RESPONSE=$(curl -s -X POST "https://$DOMAIN/api/ensure-admin")
    echo "$CREATE_RESPONSE" | jq .
    
    if echo "$CREATE_RESPONSE" | jq -e '.created == true' > /dev/null; then
        echo "✅ Admin account created successfully"
    else
        echo "❌ Failed to create admin account"
    fi
fi

# Step 2: Test actual login
echo ""
echo "3. Testing actual login..."
echo "-----------------------------------"
LOGIN_RESPONSE=$(curl -s -X POST "https://$DOMAIN/api/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin"}')

if echo "$LOGIN_RESPONSE" | jq -e '.id' > /dev/null; then
    echo "✅ Login successful!"
    echo "$LOGIN_RESPONSE" | jq '{id, username, role, status, requirePasswordChange}'
else
    echo "❌ Login failed!"
    echo "$LOGIN_RESPONSE" | jq .
fi

echo ""
echo "==================================="
echo "Test complete"
echo "==================================="