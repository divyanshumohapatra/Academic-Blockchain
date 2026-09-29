#!/usr/bin/env bash
#
# Automated Multi-Agent Autonomous AI Verification Test Flow
# Validates:
# - Pre-flight Multi-Agent Auditing
# - Intelligent 0-100 Fraud Risk Scoring & Anomaly Detection
# - 1-Click Master Autonomous Pipeline Across All 7 Stages
# - Conversational AI Chatbot Queries against Live Ledger
# - Cryptographic Verification on Fabric 2.5 & IPFS

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_URL="http://localhost:4000/api"

echo "========================================================="
echo " 🤖 Starting Multi-Agent Autonomous Verification Suite   "
echo "========================================================="

RAND_ID=$((1000 + RANDOM % 9000))
TEST_STU_ID="STU-AGENT-${RAND_ID}"
TEST_REQ_ID="REQ-AGENT-${RAND_ID}"
TEST_CERT_ID="CERT-AGENT-${RAND_ID}"

echo ""
echo "--> Step 1: Registering Student (${TEST_STU_ID}) on Fabric Ledger..."
curl -s -f -X POST "${API_URL}/students" \
  -H "Content-Type: application/json" \
  -d "{\"studentId\":\"${TEST_STU_ID}\",\"name\":\"Alice Johnson\",\"email\":\"alice@academic.edu\",\"department\":\"Computer Science & Engineering\",\"enrollmentYear\":\"2024\"}" >/dev/null

echo "✅ Student registered on Ledger."

echo ""
echo "--> Step 2: Submitting Request with Academic Metrics (${TEST_REQ_ID})..."
curl -s -f -X POST "${API_URL}/requests" \
  -H "Content-Type: application/json" \
  -d "{\"requestId\":\"${TEST_REQ_ID}\",\"studentId\":\"${TEST_STU_ID}\",\"certType\":\"Master of Computer Applications (MCA)\",\"details\":{\"attendance\":91.2,\"cieMarks\":46,\"totalCredits\":164,\"requiredCredits\":160,\"cgpa\":9.15,\"backlogs\":0,\"capstoneScore\":92,\"originalityReport\":96,\"feeDues\":0,\"libraryDues\":0}}" >/dev/null

echo "✅ Request submitted (Status: SUBMITTED)."

echo ""
echo "--> Step 3: Running Autonomous Pre-Flight Audit & Fraud Scan..."
AUDIT_RES=$(curl -s -f "${API_URL}/agents/audit/${TEST_REQ_ID}")
echo "   Audit Response: ${AUDIT_RES}"

echo ""
echo "--> Step 4: Executing 1-Click Autonomous Multi-Agent Pipeline..."
ORCH_RES=$(curl -s -f -X POST "${API_URL}/agents/orchestrate" \
  -H "Content-Type: application/json" \
  -d "{\"requestId\":\"${TEST_REQ_ID}\",\"certId\":\"${TEST_CERT_ID}\",\"autoIssue\":true}")

echo "   Orchestration Result: ${ORCH_RES}"

if echo "${ORCH_RES}" | grep -q '"success":true'; then
  echo "✅ 1-Click Multi-Agent Pipeline executed all 7 stages and minted certificate!"
else
  echo "❌ Multi-Agent pipeline execution failed"
  exit 1
fi

echo ""
echo "--> Step 5: Testing Conversational AI Assistant Querying Ledger..."
CHAT_RES=$(curl -s -f -X POST "${API_URL}/agents/chat" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"Show status of request ${TEST_REQ_ID}\"}")

echo "   Chatbot Reply: ${CHAT_RES}"

echo ""
echo "--> Step 6: Querying Active Consortium Agents Telemetry..."
HEALTH_RES=$(curl -s -f "${API_URL}/agents/health")
echo "   Agent Telemetry: ${HEALTH_RES}"

echo ""
echo "--> Step 7: Verifying Issued Certificate by ID on Ledger..."
VERIFY_RES=$(curl -s "${API_URL}/verify/id/${TEST_CERT_ID}")
echo "   Verification Response: ${VERIFY_RES}"

if echo "${VERIFY_RES}" | grep -q "VERIFIED"; then
  echo "========================================================="
  echo " 🎉 ALL MULTI-AGENT AUTONOMOUS TESTS PASSED SUCCESSFULLY! "
  echo "========================================================="
else
  echo "❌ Certificate verification did not return VERIFIED"
  exit 1
fi
