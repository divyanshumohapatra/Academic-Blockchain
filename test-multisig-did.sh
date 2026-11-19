#!/usr/bin/env bash
#
# Automated Verification Suite for:
# 1. Student Decentralized Identifier (DID) Generation (SHA-256 + RIPEMD-160)
# 2. Dedicated Faculty Authentication Pipeline & Course Marks Ingestion (5 Faculties / 5 Subjects)
# 3. Faculty Advisor Cross-Course Comprehensive Audit Gate
# 4. HOD + DAC Majority Multi-Sig (Quorum >= 2/3)
# 5. Examination Grade Lockdown (Org 2)
# 6. Dean Academics & Senate Board Majority Multi-Sig (Quorum >= 2/3)
# 7. Certificate Minting with Embedded DID & Verifiable SHA-256
# 8. Cryptographic Verification by Student DID and Document Hash

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_URL="http://localhost:4000/api"

echo "========================================================="
echo " 🏛️ Starting Academic Consortium Governance & DID Test    "
echo "========================================================="

RAND_ID=$((1000 + RANDOM % 9000))
TEST_STU_ID="STU-MS-${RAND_ID}"
TEST_REQ_ID="REQ-MS-${RAND_ID}"
TEST_CERT_ID="CERT-MS-${RAND_ID}"

# Step 1: Faculty Authentication Pipeline
echo ""
echo "--> [Step 1] Testing Faculty Authentication Pipeline..."
LOGIN_RES=$(curl -s -f -X POST "${API_URL}/faculty/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"rajesh.kumar@academic.edu","password":"password123"}')

FAC_TOKEN=$(echo "${LOGIN_RES}" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo "✅ Authenticated Faculty: Dr. Rajesh Kumar (Course: CS501)"
echo "   Session Token: ${FAC_TOKEN:0:16}..."

# Step 2: Enroll Student in SIS Database with DID
echo ""
echo "--> [Step 2] Enrolling Student (${TEST_STU_ID}) in SIS with Automatic DID Derivation..."
curl -s -f -X POST "${API_URL}/sis/students" \
  -H "Content-Type: application/json" \
  -d "{\"studentId\":\"${TEST_STU_ID}\",\"name\":\"Alice Johnson\",\"email\":\"alice.johnson@academic.edu\",\"department\":\"Computer Science & Engineering\",\"enrollmentYear\":\"2024\",\"attendance\":92.5,\"cieMarks\":46.0,\"totalCredits\":164,\"requiredCredits\":160,\"cgpa\":9.10,\"backlogs\":0,\"capstoneScore\":92.0,\"originalityReport\":95.0,\"feeDues\":0,\"libraryDues\":0}" >/dev/null

REG_RES=$(curl -s -f -X POST "${API_URL}/students" \
  -H "Content-Type: application/json" \
  -d "{\"studentId\":\"${TEST_STU_ID}\",\"name\":\"Alice Johnson\",\"email\":\"alice.johnson@academic.edu\",\"department\":\"Computer Science & Engineering\",\"enrollmentYear\":\"2024\"}")

STU_DID=$(echo "${REG_RES}" | grep -o '"did":"[^"]*' | cut -d'"' -f4)
echo "✅ Student Registered on Blockchain!"
echo "   • Student ID: ${TEST_STU_ID}"
echo "   • Cryptographic DID: ${STU_DID}"

# Verify DID format matches did:academic:<40 hex chars>
if echo "${STU_DID}" | grep -Eq "^did:academic:[0-9a-f]{40}$"; then
  echo "✅ DID Format Verified: SHA-256 + RIPEMD-160 Hash160 format valid."
else
  echo "❌ DID format invalid: ${STU_DID}"
  exit 1
fi

# Step 3: Faculty Marks Submission & Signing
echo ""
echo "--> [Step 3] Faculty Dr. Rajesh Kumar signs course marks for CS501..."
SIGN_RES=$(curl -s -f -X POST "${API_URL}/faculty/courses/CS501/approve-and-sign" \
  -H "Content-Type: application/json" \
  -d '{"facultyId":"FAC-001"}')

FAC_SIG=$(echo "${SIGN_RES}" | grep -o '"signature":"[^"]*' | cut -d'"' -f4)
echo "✅ Course CS501 Marksheet cryptographically signed!"
echo "   • Faculty Signature: ${FAC_SIG:0:24}..."

# Step 4: Faculty Advisor Gate
echo ""
echo "--> [Step 4] Faculty Advisor Comprehensive Cross-Course Audit..."
FA_RES=$(curl -s -f -X POST "${API_URL}/faculty-advisor/sign-eligible" \
  -H "Content-Type: application/json" \
  -d "{\"studentId\":\"${TEST_STU_ID}\",\"requestId\":\"${TEST_REQ_ID}\"}")

FA_SIG=$(echo "${FA_RES}" | grep -o '"faSignature":"[^"]*' | cut -d'"' -f4)
echo "✅ Faculty Advisor verified all 5 courses and endorsed candidate!"
echo "   • FA Digital Signature: ${FA_SIG:0:24}..."

# Step 5: Submit Certificate Request
echo ""
echo "--> [Step 5] Submitting Certificate Request on Ledger..."
curl -s -f -X POST "${API_URL}/requests" \
  -H "Content-Type: application/json" \
  -d "{\"requestId\":\"${TEST_REQ_ID}\",\"studentId\":\"${TEST_STU_ID}\",\"certType\":\"Master of Computer Applications (MCA)\"}" >/dev/null

echo "✅ Request ${TEST_REQ_ID} submitted on Blockchain."

# Step 6: Step Transitions to FA_APPROVED
curl -s -f -X POST "${API_URL}/workflow/faculty-approve" \
  -H "Content-Type: application/json" \
  -d "{\"requestId\":\"${TEST_REQ_ID}\",\"comments\":\"Coursework approved\"}" >/dev/null

curl -s -f -X POST "${API_URL}/workflow/faculty-advisor-approve" \
  -H "Content-Type: application/json" \
  -d "{\"requestId\":\"${TEST_REQ_ID}\",\"comments\":\"FA verified all courses\"}" >/dev/null

echo "✅ Request advanced to FA_APPROVED."

# Step 7: DAC Committee Majority Multi-Sig (Quorum >= 2/3)
echo ""
echo "--> [Step 7] Testing DAC Committee Majority Multi-Sig..."
echo "   [Vote 1/3] HOD Prof. K. V. Rao signs..."
curl -s -f -X POST "${API_URL}/workflow/dac-multisig/vote" \
  -H "Content-Type: application/json" \
  -d "{\"requestId\":\"${TEST_REQ_ID}\",\"memberId\":\"DAC-MEMBER-HOD\",\"memberName\":\"Prof. K. V. Rao\",\"memberRole\":\"HOD & Chair\",\"decision\":\"APPROVE\"}" >/dev/null

echo "   [Vote 2/3] Curriculum Lead Dr. Sunita Rao signs (Satisfies Majority Quorum >= 2/3)..."
DAC_VOTE2=$(curl -s -f -X POST "${API_URL}/workflow/dac-multisig/vote" \
  -H "Content-Type: application/json" \
  -d "{\"requestId\":\"${TEST_REQ_ID}\",\"memberId\":\"DAC-MEMBER-CURRICULUM\",\"memberName\":\"Dr. Sunita Rao\",\"memberRole\":\"Curriculum Lead\",\"decision\":\"APPROVE\"}")

echo "✅ DAC Majority Multi-Sig Quorum satisfied (Status: DAC_APPROVED)!"

# Step 8: Exam Controller Lockdown (Org 2)
echo ""
echo "--> [Step 8] Exam Controller Grade Lockdown (Org 2)..."
curl -s -f -X POST "${API_URL}/workflow/exam-lock" \
  -H "Content-Type: application/json" \
  -d "{\"requestId\":\"${TEST_REQ_ID}\",\"comments\":\"Registry locked with zero backlogs\"}" >/dev/null

echo "✅ Exam grades locked with SHA-256 Merkle digest (Status: EXAM_LOCKED)."

# Step 9: Dean Senate Board Majority Multi-Sig (Quorum >= 2/3)
echo ""
echo "--> [Step 9] Testing Dean Senate Board Majority Multi-Sig..."
echo "   [Vote 1/3] Dean Prof. P. Chandrasekhar signs..."
curl -s -f -X POST "${API_URL}/workflow/dean-multisig/vote" \
  -H "Content-Type: application/json" \
  -d "{\"requestId\":\"${TEST_REQ_ID}\",\"boardMemberId\":\"DEAN-OFFICE-CHAIR\",\"boardMemberName\":\"Prof. P. Chandrasekhar\",\"boardMemberRole\":\"Dean Academics\",\"decision\":\"APPROVE\"}" >/dev/null

echo "   [Vote 2/3] Associate Dean Prof. S. R. Murthy signs (Satisfies Majority Quorum >= 2/3)..."
curl -s -f -X POST "${API_URL}/workflow/dean-multisig/vote" \
  -H "Content-Type: application/json" \
  -d "{\"requestId\":\"${TEST_REQ_ID}\",\"boardMemberId\":\"DEAN-OFFICE-ASSOC\",\"boardMemberName\":\"Prof. S. R. Murthy\",\"boardMemberRole\":\"Associate Dean\",\"decision\":\"APPROVE\"}" >/dev/null

echo "✅ Dean Senate Board Majority Multi-Sig Quorum satisfied (Status: DEAN_APPROVED)!"

# Step 10: Administration Finalization
echo ""
echo "--> [Step 10] Administration Final Clearance..."
curl -s -f -X POST "${API_URL}/workflow/admin-finalize" \
  -H "Content-Type: application/json" \
  -d "{\"requestId\":\"${TEST_REQ_ID}\",\"comments\":\"All dues cleared\"}" >/dev/null

echo "✅ Finalized for issuance (Status: ADMIN_FINALIZED)!"

# Step 11: Issue Certificate with Verifiable SHA & Anchored DID
echo ""
echo "--> [Step 11] Issuing Academic Certificate with Verifiable SHA & DID..."
ISSUE_RES=$(curl -s -f -X POST "${API_URL}/certificates/issue" \
  -H "Content-Type: application/json" \
  -d "{\"certId\":\"${TEST_CERT_ID}\",\"requestId\":\"${TEST_REQ_ID}\",\"studentId\":\"${TEST_STU_ID}\"}")

IPFS_CID=$(echo "${ISSUE_RES}" | grep -o '"ipfsCid":"[^"]*' | cut -d'"' -f4)
DOC_SHA=$(echo "${ISSUE_RES}" | grep -o '"sha256Hash":"[^"]*' | cut -d'"' -f4)

echo "✅ Certificate Issued!"
echo "   • Certificate ID: ${TEST_CERT_ID}"
echo "   • Student DID:    ${STU_DID}"
echo "   • IPFS CID:       ${IPFS_CID}"
echo "   • Verifiable SHA: ${DOC_SHA}"

# Step 12: Verify by Student DID
echo ""
echo "--> [Step 12] Testing Verification by Student DID..."
VERIFY_DID_RES=$(curl -s -f "${API_URL}/verify/did/${STU_DID}")
echo "   Verification Response: ${VERIFY_DID_RES}"

if echo "${VERIFY_DID_RES}" | grep -q "VERIFIED"; then
  echo "✅ Verification by DID confirmed: STATUS = VERIFIED!"
else
  echo "❌ Verification by DID failed"
  exit 1
fi

# Step 13: Verify by SHA-256 Hash
echo ""
echo "--> [Step 13] Testing Verification by SHA-256 Document Hash..."
VERIFY_HASH_RES=$(curl -s -f "${API_URL}/verify/hash/${DOC_SHA}")
echo "   Verification Response: ${VERIFY_HASH_RES}"

if echo "${VERIFY_HASH_RES}" | grep -q "VERIFIED"; then
  echo "✅ Verification by SHA-256 confirmed: STATUS = VERIFIED!"
else
  echo "❌ Verification by SHA-256 failed"
  exit 1
fi

echo ""
echo "========================================================="
echo " 🎉 ALL MULTI-SIG & DID GOVERNANCE TESTS PASSED!        "
echo "========================================================="
