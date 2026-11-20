#!/usr/bin/env bash
#
# Automated End-to-End Test for 3-Org Academic Blockchain System

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_URL="http://localhost:4000/api"

echo "========================================================="
echo " 🧪 Starting End-to-End Academic Blockchain Test Flow   "
echo "========================================================="

RAND_ID=$((1000 + RANDOM % 9000))
TEST_STU_ID="STU-${RAND_ID}"
TEST_REQ_ID="REQ-${RAND_ID}"
TEST_CERT_ID="CERT-${RAND_ID}"

echo ""
echo "--> Step 1: Registering Student (${TEST_STU_ID}) on Ledger via Org 1..."
curl -s -f -X POST "${API_URL}/students" \
  -H "Content-Type: application/json" \
  -d "{\"studentId\":\"${TEST_STU_ID}\",\"name\":\"John Doe\",\"email\":\"john@academic.edu\",\"department\":\"Computer Science\",\"enrollmentYear\":\"2024\"}" >/dev/null

echo "✅ Student ${TEST_STU_ID} registered successfully."

echo ""
echo "--> Step 2: Submitting Certificate Request (${TEST_REQ_ID})..."
curl -s -f -X POST "${API_URL}/requests" \
  -H "Content-Type: application/json" \
  -d "{\"requestId\":\"${TEST_REQ_ID}\",\"studentId\":\"${TEST_STU_ID}\",\"certType\":\"Bachelor of Technology in CSE\"}" >/dev/null

echo "✅ Request submitted (Status: SUBMITTED)."

echo ""
echo "--> Step 3: Executing 7-Stage State Machine Approvals..."

echo "   [1/6] Faculty Approval (Org 1)..."
curl -s -f -X POST "${API_URL}/workflow/faculty-approve" \
  -H "Content-Type: application/json" \
  -d "{\"requestId\":\"${TEST_REQ_ID}\",\"comments\":\"Faculty approved\"}" >/dev/null

echo "   [2/6] HOD Approval (Org 1)..."
curl -s -f -X POST "${API_URL}/workflow/hod-approve" \
  -H "Content-Type: application/json" \
  -d "{\"requestId\":\"${TEST_REQ_ID}\",\"comments\":\"HOD approved\"}" >/dev/null

echo "   [3/6] DAC Approval (Org 1)..."
curl -s -f -X POST "${API_URL}/workflow/dac-approve" \
  -H "Content-Type: application/json" \
  -d "{\"requestId\":\"${TEST_REQ_ID}\",\"comments\":\"DAC verified\"}" >/dev/null

echo "   [4/6] Exam Grade Lockdown (Org 2 - Examination Board)..."
curl -s -f -X POST "${API_URL}/workflow/exam-lock" \
  -H "Content-Type: application/json" \
  -d "{\"requestId\":\"${TEST_REQ_ID}\",\"comments\":\"Grades locked\"}" >/dev/null

echo "   [5/6] Dean Approval (Org 3 - Administration)..."
curl -s -f -X POST "${API_URL}/workflow/dean-approve" \
  -H "Content-Type: application/json" \
  -d "{\"requestId\":\"${TEST_REQ_ID}\",\"comments\":\"Dean approved\"}" >/dev/null

echo "   [6/6] Admin Finalization (Org 3)..."
curl -s -f -X POST "${API_URL}/workflow/admin-finalize" \
  -H "Content-Type: application/json" \
  -d "{\"requestId\":\"${TEST_REQ_ID}\",\"comments\":\"Admin finalized\"}" >/dev/null

echo "✅ 7-Stage State Machine transitions complete (Status: ADMIN_FINALIZED)!"

echo ""
echo "--> Step 4: Generating PDF, Uploading to IPFS, and Anchoring on Fabric..."
ISSUE_RES=$(curl -s -f -X POST "${API_URL}/certificates/issue" \
  -H "Content-Type: application/json" \
  -d "{\"certId\":\"${TEST_CERT_ID}\",\"requestId\":\"${TEST_REQ_ID}\",\"studentId\":\"${TEST_STU_ID}\",\"certType\":\"Bachelor of Technology in CSE\",\"studentName\":\"John Doe\",\"department\":\"Computer Science\"}")

IPFS_CID=$(echo "${ISSUE_RES}" | grep -o '"ipfsCid":"[^"]*' | cut -d'"' -f4)
SHA256_HASH=$(echo "${ISSUE_RES}" | grep -o '"sha256Hash":"[^"]*' | cut -d'"' -f4)

echo "✅ Certificate Issued!"
echo "   • Certificate ID: ${TEST_CERT_ID}"
echo "   • IPFS CID:       ${IPFS_CID}"
echo "   • SHA-256 Digest: ${SHA256_HASH}"

echo ""
echo "--> Step 5: Testing Verification by Certificate ID..."
VERIFY_RES=$(curl -s "${API_URL}/verify/id/${TEST_CERT_ID}")
echo "Verification Result: ${VERIFY_RES}"

if echo "${VERIFY_RES}" | grep -q "VERIFIED"; then
  echo "✅ Verification by ID confirmed: STATUS = VERIFIED!"
else
  echo "❌ Verification did not return VERIFIED"
  exit 1
fi

echo ""
echo "--> Step 6: Testing Reverse SHA-256 Hash Verification..."
HASH_RES=$(curl -s "${API_URL}/verify/hash/${SHA256_HASH}")
if echo "${HASH_RES}" | grep -q "VERIFIED"; then
  echo "✅ Reverse SHA-256 Verification confirmed: STATUS = VERIFIED!"
else
  echo "❌ Hash verification failed"
  exit 1
fi

echo ""
echo "--> Step 7: Testing Revocation Flow..."
curl -s -f -X POST "${API_URL}/certificates/revoke" \
  -H "Content-Type: application/json" \
  -d "{\"certId\":\"${TEST_CERT_ID}\",\"reason\":\"Academic record cancellation\",\"revokedBy\":\"Office of the Dean\"}" >/dev/null

REVOKE_CHECK=$(curl -s "${API_URL}/verify/id/${TEST_CERT_ID}")
echo "Post-Revocation Result: ${REVOKE_CHECK}"

if echo "${REVOKE_CHECK}" | grep -q "REVOKED"; then
  echo "✅ Post-Revocation confirmed: STATUS = REVOKED!"
else
  echo "❌ Certificate status is not REVOKED"
  exit 1
fi

echo ""
echo "--> Step 8: Testing Invalid Certificate Check..."
INVALID_CHECK=$(curl -s "${API_URL}/verify/id/NON-EXISTENT-ID")
if echo "${INVALID_CHECK}" | grep -q "INVALID"; then
  echo "✅ Non-existent certificate confirmed: STATUS = INVALID!"
fi

echo ""
echo "========================================================="
echo " 🎉 ALL 4 MODULES & END-TO-END TESTS PASSED SUCCESSFULLY! "
echo " 3-Organization Academic Blockchain Consortium is LIVE!   "
echo "========================================================="
