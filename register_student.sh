#!/bin/bash
curl -X POST http://localhost:4000/api/students \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "STU-2024-031",
    "name": "Mrutyu",
    "email": "student031@academic.edu",
    "department": "Computer Science & Engineering",
    "enrollmentYear": "2024"
  }'
echo ""
