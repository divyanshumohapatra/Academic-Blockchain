#!/usr/bin/env bash
#
# Master Startup Script for 3-Organization Academic Blockchain PBL System
# Compatible with macOS (Apple Silicon / Intel) and Ubuntu Linux.

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "========================================================="
echo " 🎓 Academic Blockchain PBL — 3-Organization Architecture "
echo " Consortium: Org1 (Academic), Org2 (Exam), Org3 (Admin)   "
echo "========================================================="

# 1. Verify Docker is running
if ! docker info >/dev/null 2>&1; then
  echo "❌ Docker daemon is not running! Please start Docker Desktop or the Docker service."
  exit 1
fi

# 2. Bring up Fabric 3-Org Network, Channel, and Chaincode
echo ""
echo "--> [Step 1/3] Bringing up Fabric 3-Org Network & IPFS..."
bash "${DIR}/network/network.sh" up

# 3. Build & Launch Backend API and Web Portal Containers
echo ""
echo "--> [Step 2/3] Starting Backend REST API and Web Portal..."
set +e
docker compose -f "${DIR}/docker/docker-compose-app.yaml" up -d --build
DOCKER_APP_STATUS=$?
set -e

if [ ${DOCKER_APP_STATUS} -ne 0 ]; then
  echo ""
  echo "⚠️ Docker build for web containers timed out or failed (likely Docker Hub IPv6 / network timeout)."
  echo "--> Automatically falling back to launching Backend & Web Portal locally on host..."
  
  # Kill any stale local instances
  pkill -f "backend/src/server.js" 2>/dev/null || true
  pkill -f "frontend/server.js" 2>/dev/null || true
  sleep 1

  # Launch Backend locally in background
  (cd "${DIR}/backend" && npm start > "${DIR}/backend.log" 2>&1) &
  echo "   ✅ Backend REST API running locally (Port: 4000, Logs: backend.log)"

  # Launch Frontend locally in background
  (cd "${DIR}/frontend" && npm start > "${DIR}/frontend.log" 2>&1) &
  echo "   ✅ Web Portal running locally (Port: 3000, Logs: frontend.log)"
fi

# 4. Verification Check
echo ""
echo "--> [Step 3/3] Performing Health Verification..."
sleep 4

echo ""
echo "========================================================="
echo " 🎉 3-Organization Academic Blockchain is FULLY RUNNING! "
echo "========================================================="
echo ""
echo " 🌐 Web Verification Portal:  http://localhost:3000"
echo " 🔌 Backend REST API:         http://localhost:4000/api/health"
echo " 📦 IPFS Gateway:             http://localhost:8080"
echo ""
echo " 🏢 Organizations Participating:"
echo "   • Org1 (University / Academic Dept) - peer0.org1.academic.edu:7051 (CouchDB: 5984)"
echo "   • Org2 (Examination Board)          - peer0.org2.academic.edu:8051 (CouchDB: 6984)"
echo "   • Org3 (Administration / Verifier)   - peer0.org3.academic.edu:9051 (CouchDB: 7984)"
echo "   • Raft Orderer                       - orderer.academic.edu:7050"
echo "   • IPFS Decentralized Node            - ipfs-node:5001"
echo ""
echo " Run './test-flow.sh' to execute an automated end-to-end lifecycle test!"
echo " Run './stop.sh' to gracefully stop all services."
echo "========================================================="
