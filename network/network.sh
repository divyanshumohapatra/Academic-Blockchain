#!/usr/bin/env bash
#
# Master network management script for 3-Org Hyperledger Fabric Academic Network

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${DIR}/.." && pwd)"
cd "${ROOT_DIR}"
COMPOSE_FILE="docker/docker-compose-net.yaml"

MODE=$1

function printHelp() {
  echo "Usage: "
  echo "  network.sh <Mode>"
  echo "    <Mode>"
  echo "      - 'generate' - generate crypto and channel artifacts"
  echo "      - 'up'       - start network containers, create channel, deploy chaincode"
  echo "      - 'down'     - stop network containers and clean up volumes"
  echo "      - 'restart'  - restart network"
  echo "      - 'status'   - display container and network status"
}

function generateCrypto() {
  echo "--> Generating crypto artifacts..."
  bash "${DIR}/scripts/generate-crypto.sh"
}

function networkUp() {
  # 1. Generate crypto if not already present
  if [ ! -d "${DIR}/crypto-config" ] || [ ! -f "${DIR}/channel-artifacts/academicchannel.block" ]; then
    generateCrypto
  fi

  # 2. Start containers
  echo "--> Starting Docker containers for Orderer, 3 Orgs, CouchDBs, and IPFS..."
  docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans

  echo "--> Waiting for peers and orderer to initialize (8s)..."
  sleep 8

  # 3. Create channel and join peers
  echo "--> Creating channel and joining peers..."
  MSYS_NO_PATHCONV=1 docker exec cli bash -c "/opt/gopath/src/github.com/hyperledger/fabric/peer/scripts/create-channel.sh"

  # 4. Deploy chaincode
  echo "--> Deploying academic-contract chaincode across 3 orgs..."
  MSYS_NO_PATHCONV=1 docker exec cli bash -c "/opt/gopath/src/github.com/hyperledger/fabric/peer/scripts/deploy-chaincode.sh"

  echo "========================================================="
  echo " 🚀 3-Organization Academic Blockchain Network is LIVE! "
  echo "========================================================="
}

function networkDown() {
  echo "--> Stopping and removing Docker containers, networks, and volumes..."
  docker compose -f "${COMPOSE_FILE}" down -v --remove-orphans || true
  docker rm -f $(docker ps -aq --filter name=dev-peer*) 2>/dev/null || true
  docker rmi -f $(docker images -q --filter reference='dev-peer*') 2>/dev/null || true
  echo "✅ Network stopped and cleaned."
}

function networkStatus() {
  echo "========================================================="
  echo " 🩺 Network Status                                      "
  echo "========================================================="
  docker compose -f "${COMPOSE_FILE}" ps
}

if [ "$MODE" == "generate" ]; then
  generateCrypto
elif [ "$MODE" == "up" ]; then
  networkUp
elif [ "$MODE" == "down" ]; then
  networkDown
elif [ "$MODE" == "restart" ]; then
  networkDown
  networkUp
elif [ "$MODE" == "status" ]; then
  networkStatus
else
  printHelp
  exit 1
fi
