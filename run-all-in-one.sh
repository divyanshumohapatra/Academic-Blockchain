#!/usr/bin/env bash
#
# Helper script to build and launch the Option 2 All-in-One Docker Sandbox
# Runs seamlessly on macOS (Apple Silicon / Intel), Ubuntu Linux, and Windows (WSL 2).
#

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_NAME="academic-blockchain:all-in-one"
CONTAINER_NAME="academic-blockchain-sandbox"

echo "========================================================="
echo " 📦 Option 2: Building & Launching All-in-One Sandbox   "
echo "========================================================="

# 1. Verify Docker daemon
if ! docker info >/dev/null 2>&1; then
  echo "❌ Docker is not running! Please start Docker Desktop or the Docker service."
  exit 1
fi

# 2. Cleanup any existing sandbox container
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "--> Stopping and removing existing ${CONTAINER_NAME}..."
  docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
fi

# 3. Build the All-in-One Docker Image
echo ""
echo "--> Building ${IMAGE_NAME} image from docker/Dockerfile.all-in-one..."
docker build -f "${DIR}/docker/Dockerfile.all-in-one" -t "${IMAGE_NAME}" "${DIR}"

# 4. Run the Sandbox Container
echo ""
echo "--> Launching ${CONTAINER_NAME}..."
echo "    Ports mapped: 3000 (UI), 4000 (API), 8080 (IPFS)"
echo ""

docker run -it --rm --privileged \
  -p 3000:3000 \
  -p 4000:4000 \
  -p 8080:8080 \
  --name "${CONTAINER_NAME}" \
  "${IMAGE_NAME}"
