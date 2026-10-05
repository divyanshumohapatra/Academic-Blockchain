#!/usr/bin/env bash
set -e

echo "========================================================="
echo " 🛡️ Testing Live Backend API: Group 3 Fraud Inspection   "
echo " Endpoint: POST http://localhost:4000/api/fraud/inspect  "
echo "========================================================="

echo ""
echo "--> 1. Testing Live Health of Fraud Sentinel"
curl -s http://localhost:4000/api/fraud/health | jq .

echo ""
echo "--> 2. Live Inspection: Suspicious Student (Tampered CGPA & Prerequisite Bypass)"
PAYLOAD='{
  "studentId": "STU-FRAUD-SAMPLE",
  "requestId": "REQ-7788",
  "transcript": {
    "previousGPA": 5.4,
    "recentSemesterGPA": 9.9,
    "totalCreditsEarned": 135,
    "requiredCredits": 160,
    "completedCourses": ["CS401", "CS405"]
  },
  "history": [
    { "stage": "SUBMITTED", "timestamp": "2026-09-29T10:00:00Z" }
  ]
}'

RESPONSE=$(curl -s -X POST http://localhost:4000/api/fraud/inspect \
  -H "Content-Type: application/json" \
  -d "${PAYLOAD}")

echo "${RESPONSE}" | jq .

RISK_SCORE=$(echo "${RESPONSE}" | jq -r '.inspection.riskScore')
RISK_LEVEL=$(echo "${RESPONSE}" | jq -r '.inspection.riskLevel')
QUARANTINE=$(echo "${RESPONSE}" | jq -r '.inspection.shouldQuarantine')

echo ""
echo "=== SUMMARY OF LIVE AGENT EVALUATION ==="
echo "   • Risk Score: ${RISK_SCORE}/100"
echo "   • Risk Level: ${RISK_LEVEL}"
echo "   • Quarantine Action: ${QUARANTINE}"

if [ "${QUARANTINE}" == "true" ]; then
  echo "✅ Live Fraud Sentinel Agent successfully flagged and quarantined suspicious submission!"
else
  echo "❌ Quarantine failed"
  exit 1
fi
