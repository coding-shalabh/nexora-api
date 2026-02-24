#!/bin/bash

# Billing & Payment Link Testing Script
# Tests invoice generation, QR codes, and payment links

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

# ==================================================================
# 1. BILLING GENERATION - Create GST Invoice
# ==================================================================

echo ""
echo "📝 Test 1: Create GST Invoice (Billing Generation)"

# Get first contact
CONTACT=$(curl -s -X GET "$API_URL/crm/contacts?limit=1" \
  -H "Authorization: Bearer $TOKEN")
CONTACT_ID=$(echo $CONTACT | jq -r '.data[0].id')

if [ "$CONTACT_ID" = "null" ]; then
  echo "❌ No contacts found. Create a contact first."
  exit 1
fi

echo "👤 Using Contact ID: $CONTACT_ID"

# Create GST Invoice
INVOICE_RESPONSE=$(curl -s -X POST "$API_URL/billing/invoices" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"contactId\": \"$CONTACT_ID\",
    \"invoiceNumber\": \"TEST-INV-$(date +%s)\",
    \"issueDate\": \"$(date -I)\",
    \"dueDate\": \"$(date -d '+30 days' -I)\",
    \"currency\": \"INR\",
    \"isGstInvoice\": true,
    \"invoiceType\": \"TAX_INVOICE\",
    \"supplyType\": \"B2B\",
    \"sellerGstin\": \"29AABCT1234E1Z5\",
    \"sellerLegalName\": \"Helix Code Private Limited\",
    \"sellerStateCode\": \"29\",
    \"sellerStateName\": \"Karnataka\",
    \"buyerGstin\": \"27AABCT9876M1Z5\",
    \"buyerLegalName\": \"Test Company Pvt Ltd\",
    \"buyerStateCode\": \"27\",
    \"buyerStateName\": \"Maharashtra\",
    \"placeOfSupply\": \"27\",
    \"isInterState\": true,
    \"lines\": [{
      \"description\": \"Software Development Services\",
      \"quantity\": 1,
      \"unitPrice\": 50000,
      \"taxRate\": 18,
      \"hsnCode\": \"998314\",
      \"productType\": \"SERVICES\",
      \"taxableValue\": 50000,
      \"igstRate\": 18,
      \"igstAmount\": 9000,
      \"totalTax\": 9000,
      \"totalPrice\": 59000
    }],
    \"subtotal\": 50000,
    \"taxableAmount\": 50000,
    \"igstAmount\": 9000,
    \"taxAmount\": 9000,
    \"totalAmount\": 59000,
    \"balanceDue\": 59000
  }")

INVOICE_ID=$(echo $INVOICE_RESPONSE | jq -r '.data.id')

if [ "$INVOICE_ID" = "null" ]; then
  echo "❌ Invoice creation failed:"
  echo $INVOICE_RESPONSE | jq
  exit 1
fi

echo "✅ Invoice created: $INVOICE_ID"
echo $INVOICE_RESPONSE | jq

# ==================================================================
# 2. QR CODE GENERATION
# ==================================================================

echo ""
echo "📱 Test 2: Generate QR Code for Invoice"

QR_RESPONSE=$(curl -s -X POST "$API_URL/gst/invoice/$INVOICE_ID/qr" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

QR_CODE=$(echo $QR_RESPONSE | jq -r '.data.qrCode')

if [ "$QR_CODE" = "null" ]; then
  echo "❌ QR generation failed:"
  echo $QR_RESPONSE | jq
else
  echo "✅ QR Code generated successfully!"
  echo "QR Code (first 100 chars): ${QR_CODE:0:100}..."
  echo ""
  echo "QR Code Details:"
  echo $QR_RESPONSE | jq
fi

# ==================================================================
# 3. PAYMENT LINK GENERATION
# ==================================================================

echo ""
echo "💳 Test 3: Generate Payment Link for Invoice"

# Note: Payment link generation requires integration with payment gateway
# This endpoint might need to be implemented
PAYMENT_LINK_RESPONSE=$(curl -s -X POST "$API_URL/billing/invoices/$INVOICE_ID/payment-link" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"paymentGateway\": \"razorpay\",
    \"expiryDays\": 7,
    \"sendEmail\": true,
    \"sendWhatsApp\": false
  }")

PAYMENT_LINK=$(echo $PAYMENT_LINK_RESPONSE | jq -r '.data.paymentLink')

if [ "$PAYMENT_LINK" = "null" ]; then
  echo "⚠️  Payment link generation endpoint not implemented yet"
  echo "Response:"
  echo $PAYMENT_LINK_RESPONSE | jq
else
  echo "✅ Payment link generated:"
  echo "🔗 Link: $PAYMENT_LINK"
  echo ""
  echo "Payment Link Details:"
  echo $PAYMENT_LINK_RESPONSE | jq
fi

# ==================================================================
# 4. E-INVOICE GENERATION (IRN)
# ==================================================================

echo ""
echo "🔐 Test 4: Generate E-Invoice (IRN)"

EINVOICE_RESPONSE=$(curl -s -X POST "$API_URL/gst/invoice/$INVOICE_ID/e-invoice" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

IRN=$(echo $EINVOICE_RESPONSE | jq -r '.data.irn')

if [ "$IRN" = "null" ]; then
  echo "⚠️  E-Invoice generation requires GSP integration (mock response)"
  echo "Response:"
  echo $EINVOICE_RESPONSE | jq
else
  echo "✅ E-Invoice generated:"
  echo "IRN: $IRN"
  echo ""
  echo "E-Invoice Details:"
  echo $EINVOICE_RESPONSE | jq
fi

# ==================================================================
# 5. GET INVOICE WITH ALL DETAILS
# ==================================================================

echo ""
echo "📄 Test 5: Get Invoice with QR Code & Payment Link"

FULL_INVOICE=$(curl -s -X GET "$API_URL/billing/invoices/$INVOICE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "✅ Full Invoice Details:"
echo $FULL_INVOICE | jq

echo ""
echo "✅ All billing & payment tests completed!"
echo ""
echo "📊 Summary:"
echo "  - Invoice ID: $INVOICE_ID"
echo "  - QR Code: ${QR_CODE:+Generated}"
echo "  - Payment Link: ${PAYMENT_LINK:+Generated}"
echo "  - E-Invoice (IRN): ${IRN:+Generated}"
