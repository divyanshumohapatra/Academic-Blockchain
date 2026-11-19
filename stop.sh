#!/usr/bin/env bash
#
# Master Shutdown and Cleanup Script for Academic Blockchain System

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "========================================================="
echo " 🛑 Stopping Academic Blockchain System                  "
echo "========================================================="

# 1. Stop app containers
docker compose -f docker/docker-compose-app.yaml down -v --remove-orphans 2>/dev/null || true

# 1.1 Stop any local host processes if running outside Docker
pkill -f "backend/src/server.js" 2>/dev/null || true
pkill -f "frontend/server.js" 2>/dev/null || true

# 2. Stop network containers & clean volumes
bash network/network.sh down

echo "✅ All containers, networks, and volumes stopped cleanly."
