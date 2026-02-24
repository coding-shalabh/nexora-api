#!/bin/bash

# GST API Testing Script
# Run this script when the API is up

set -e

API_URL="https://api.nexoraos.pro/api/v1"
EMAIL="arpit.sharma@helixcode.in"
PASSWORD="Demo123456"

echo "🔐 Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.token')

if [ "$TOKEN" = "null" ]; then
  echo "❌ Login failed:"
  echo $LOGIN_RESPONSE | jq
  exit 1
fi

echo "✅ Login successful"
echo "📝 Token: ${TOKEN:0:20}..."

# Test 1: Get GST Configuration
echo ""
echo "🧪 Test 1: Get GST Configuration"
curl -s -X GET "$API_URL/gst/config" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq

# Test 2: Validate GSTIN
echo ""
echo "🧪 Test 2: Validate GSTIN"
curl -s -X GET "$API_URL/gst/validate-gstin/29AABCT1234E1Z5" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq

# Test 3: Calculate GST (Inter-state)
echo ""
echo "🧪 Test 3: Calculate GST (Inter-state: Karnataka → Maharashtra)"
curl -s -X POST "$API_URL/gst/calculate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"amount\": 10000, \"gstRate\": 18, \"placeOfSupply\": \"27\", \"customerState\": \"29\"}" | jq

# Test 4: Calculate GST (Intra-state)
echo ""
echo "🧪 Test 4: Calculate GST (Intra-state: Karnataka → Karnataka)"
curl -s -X POST "$API_URL/gst/calculate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"amount\": 10000, \"gstRate\": 18, \"placeOfSupply\": \"29\", \"customerState\": \"29\"}" | jq

# Test 5: Get Indian States
echo ""
echo "🧪 Test 5: Get Indian States List"
curl -s -X GET "$API_URL/gst/states" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.data[:3]'

# Test 6: List HSN Codes
echo ""
echo "🧪 Test 6: List HSN/SAC Codes"
curl -s -X GET "$API_URL/gst/hsn" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq

# Test 7: Generate QR Code for Invoice
echo ""
echo "🧪 Test 7: Generate QR Code for Invoice"
# First, get an invoice ID
INVOICE=$(curl -s -X GET "$API_URL/invoices?limit=1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

INVOICE_ID=$(echo $INVOICE | jq -r '.data[0].id')

if [ "$INVOICE_ID" != "null" ]; then
  echo "📄 Testing with Invoice ID: $INVOICE_ID"
  curl -s -X POST "$API_URL/gst/invoice/$INVOICE_ID/qr" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" | jq '.data.qrCode[:100]'
else
  echo "⚠️  No invoices found to test QR generation"
fi

# Test 8: Generate GSTR-1
echo ""
echo "🧪 Test 8: Generate GSTR-1 Return"
curl -s -X GET "$API_URL/gst/returns/gstr-1?month=2&year=2026" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq

# Test 9: Generate GSTR-3B
echo ""
echo "🧪 Test 9: Generate GSTR-3B Return"
curl -s -X GET "$API_URL/gst/returns/gstr-3b?month=2&year=2026" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq

# Test 10: Create HSN Code
echo ""
echo "🧪 Test 10: Create HSN/SAC Code"
curl -s -X POST "$API_URL/gst/hsn" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"code\": \"998314\", \"description\": \"IT Design & Development Services\", \"gstRate\": 18, \"isService\": true}" | jq

echo ""
echo "✅ All GST API tests completed!"
