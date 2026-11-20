#!/usr/bin/env bash
#
# Option 2: All-in-One Docker Container Entrypoint
# Supports both:
#  1. Standalone Docker-in-Docker (DinD) mode (when run with --privileged)
#  2. Host Docker socket mode (when run with -v /var/run/docker.sock:/var/run/docker.sock)
#

set -e

echo "========================================================="
echo " 🎓 Academic Blockchain — All-in-One Sandbox Container   "
echo " Hyperledger Fabric 2.5 • IPFS • Multi-Agent AI • Web UI "
echo "========================================================="

WORKDIR="/app/Academic-Blockchain"
cd "${WORKDIR}"

# 1. Detect Docker environment
if [ -S /var/run/docker.sock ] && docker info >/dev/null 2>&1; then
  echo "🐳 Detected mounted host Docker socket. Connecting to host daemon..."
else
  echo "🐳 Initializing internal Docker-in-Docker (DinD) daemon..."
  # Start dockerd in background
  dockerd > /var/log/dockerd.log 2>&1 &
  DOCKERD_PID=$!

  # Wait for dockerd to be responsive
  echo "--> Waiting for internal Docker daemon to start..."
  COUNTER=0
  while ! docker info >/dev/null 2>&1; do
    sleep 1
    COUNTER=$((COUNTER + 1))
    if [ $COUNTER -ge 30 ]; then
      echo "❌ Failed to start internal Docker daemon. Did you run with --privileged?"
      cat /var/log/dockerd.log
      exit 1
    fi
  done
  echo "✅ Internal Docker daemon is ready!"
fi

# 2. Trap signals for graceful shutdown
cleanup() {
  echo ""
  echo "🛑 Received termination signal. Gracefully shutting down Academic Blockchain..."
  bash "${WORKDIR}/stop.sh" 2>/dev/null || true
  if [ -n "${DOCKERD_PID}" ]; then
    kill -TERM "${DOCKERD_PID}" 2>/dev/null || true
  fi
  echo "✅ All-in-One container stopped cleanly."
  exit 0
}
trap cleanup SIGTERM SIGINT

# 3. Ensure backend/.env exists
if [ ! -f "${WORKDIR}/backend/.env" ]; then
  echo "--> Initializing backend/.env from .env.example..."
  cp "${WORKDIR}/backend/.env.example" "${WORKDIR}/backend/.env"
fi

# 4. Boot the complete 3-Org Fabric consortium & IPFS stack
echo ""
echo "--> [1/2] Bringing up 3-Org Fabric Network, Channel, and Chaincode..."
bash "${WORKDIR}/network/network.sh" up

# 5. Launch Backend API and Web Portal
echo ""
echo "--> [2/2] Launching Backend REST API and Web Portal..."
docker compose -f "${WORKDIR}/docker/docker-compose-app.yaml" up -d --build

echo ""
echo "========================================================="
echo " 🎉 ALL-IN-ONE ACADEMIC BLOCKCHAIN SANDBOX IS LIVE!       "
echo "========================================================="
echo ""
echo " 🌐 Web Verification Portal:  http://localhost:3000"
echo " 🔌 Backend REST API:         http://localhost:4000/api/health"
echo " 📦 IPFS Gateway:             http://localhost:8080"
echo ""
echo " 🏢 3-Org Consortium Architecture:"
echo "   • Org1 (University / Academic Dept) - peer0.org1:7051"
echo "   • Org2 (Examination Board)          - peer0.org2:8051"
echo "   • Org3 (Administration / Verifier)   - peer0.org3:9051"
echo "   • Consensus                         - Raft Orderer: 7050"
echo "   • Storage                           - IPFS Kubo: 5001 / 8080"
echo "========================================================="
echo "Streaming logs... (Press Ctrl+C or stop container to exit)"

# Tail logs to keep container alive and provide live diagnostics
docker compose -f "${WORKDIR}/docker/docker-compose-app.yaml" logs -f
