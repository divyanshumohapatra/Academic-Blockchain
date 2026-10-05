#!/bin/bash
curl -X POST http://localhost:4000/api/requests \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "REQ-2024-TEST-031",
    "studentId": "STU-2024-031",
    "certType": "Bachelor of Technology in CSE"
  }'
echo ""
