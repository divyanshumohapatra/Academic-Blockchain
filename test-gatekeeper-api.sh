#!/bin/bash
echo "=== TESTING INLINE FRAUD GATEKEEPER ON /api/certificates/issue ==="
echo ""
echo "Test 1: Tampered Transcript (+4.9 GPA jump) -> Expect HTTP 403 & Quarantine"
curl -i -s -X POST http://localhost:4000/api/certificates/issue \
  -H "Content-Type: application/json" \
  -d '{
    "certId": "CERT-TEST-FAIL",
    "studentId": "STU-9999-TAMPERED",
    "transcript": {
      "previousGPA": 5.0,
      "recentSemesterGPA": 9.9,
      "totalCreditsEarned": 160,
      "requiredCredits": 160,
      "completedCourses": ["CS101", "CS201", "CS301"]
    }
  }'
echo ""
echo ""
