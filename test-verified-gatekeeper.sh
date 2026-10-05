#!/bin/bash
echo "=== TESTING VERIFIED STUDENT RECORD ==="
curl -i -s -X POST http://localhost:4000/api/certificates/issue \
  -H "Content-Type: application/json" \
  -d '{
    "certId": "CERT-VERIFIED-PASS",
    "studentId": "STU-1001-GENUINE",
    "transcript": {
      "previousGPA": 8.4,
      "recentSemesterGPA": 8.7,
      "totalCreditsEarned": 160,
      "requiredCredits": 160,
      "completedCourses": ["CS101", "CS201", "CS301", "CS401", "CS405", "MATH201"]
    }
  }'
echo ""
