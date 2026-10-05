#!/usr/bin/env bash

set -e

echo "========================================================="
echo " 📦 Testing IPFS Kubo Node, API & Gateway               "
echo "========================================================="

echo ""
echo "--> 1. IPFS Daemon Version & Node Identity"
docker exec ipfs-node ipfs version
docker exec ipfs-node ipfs id | jq '{ID: .ID, AgentVersion: .AgentVersion, ProtocolVersion: .ProtocolVersion}'

echo ""
echo "--> 2. IPFS Repository Storage & Object Statistics"
docker exec ipfs-node ipfs repo stat

echo ""
echo "--> 3. Testing IPFS HTTP API /add and /cat"
TEST_STRING="Academic Blockchain IPFS Verification Test - Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
TMP_FILE=$(mktemp)
echo "${TEST_STRING}" > "${TMP_FILE}"

ADD_RES=$(curl -s -F "file=@${TMP_FILE}" http://localhost:5001/api/v0/add)
CID=$(echo "${ADD_RES}" | jq -r '.Hash')
SIZE=$(echo "${ADD_RES}" | jq -r '.Size')
echo "   • Added Content : \"${TEST_STRING}\""
echo "   • Generated CID : ${CID}"
echo "   • Size on IPFS  : ${SIZE} bytes"

FETCHED=$(curl -s -X POST "http://localhost:5001/api/v0/cat?arg=${CID}")
echo "   • Retrieved via API (/cat): \"${FETCHED}\""

if [ "${TEST_STRING}" == "${FETCHED}" ]; then
  echo "   ✅ API Read/Write Integrity: VERIFIED"
else
  echo "   ❌ API Read/Write Integrity: FAILED"
  exit 1
fi

echo ""
echo "--> 4. Testing Local IPFS HTTP Gateway (Port 8080)"
GATEWAY_CONTENT=$(curl -sL "http://localhost:8080/ipfs/${CID}")
echo "   • Retrieved via Gateway (http://localhost:8080/ipfs/${CID}):"
echo "     \"${GATEWAY_CONTENT}\""

if [ "${TEST_STRING}" == "${GATEWAY_CONTENT}" ]; then
  echo "   ✅ Gateway Content Integrity: VERIFIED"
else
  echo "   ❌ Gateway Content Integrity: FAILED"
  exit 1
fi

echo ""
echo "--> 5. Verifying Certificate PDF from Fabric Workflow"
PREV_CID="Qma58W7UZEhK18grjPYQKD89pScLYubric51swC5u7KzJf"
PIN_CHECK=$(docker exec ipfs-node ipfs pin ls --type=all | grep "${PREV_CID}" || echo "not found")
echo "   • CID Pin Status: ${PIN_CHECK}"

PDF_HEADER=$(curl -sL "http://localhost:8080/ipfs/${PREV_CID}" | head -c 10)
echo "   • PDF File Magic Header: ${PDF_HEADER}"

if [[ "${PDF_HEADER}" == *"%PDF"* ]]; then
  echo "   ✅ Valid PDF document confirmed on IPFS!"
else
  echo "   ❌ Invalid PDF document header!"
  exit 1
fi

rm -f "${TMP_FILE}"

echo ""
echo "========================================================="
echo " 🎉 ALL IPFS TESTS PASSED! NODE & GATEWAY ARE 100% HEALTHY"
echo "========================================================="
