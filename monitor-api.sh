#!/usr/bin/env bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${DIR}/monitor.log"

echo "=================================================" >> "${LOG_FILE}"
echo "🚀 Academic Blockchain API Monitor started at $(date)" >> "${LOG_FILE}"
echo "=================================================" >> "${LOG_FILE}"

# Ensure network and app containers are running
docker compose -f "${DIR}/docker/docker-compose-net.yaml" up -d >> "${LOG_FILE}" 2>&1
docker compose -f "${DIR}/docker/docker-compose-app.yaml" up -d >> "${LOG_FILE}" 2>&1

while true; do
  TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S')"
  
  # Hit the health API
  API_RESPONSE=$(curl -s --max-time 5 http://localhost:4000/api/health || echo '{"status":"UNREACHABLE"}')
  API_STATUS=$(echo "${API_RESPONSE}" | jq -r '.status // "ERROR"')
  ALL_HEALTHY=$(echo "${API_RESPONSE}" | jq -r '.network.allHealthy // false')
  
  # Hit the frontend portal
  FE_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000 || echo "000")
  
  # Hit the IPFS Gateway
  IPFS_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:8080 || echo "000")
  
  LOG_ENTRY="[${TIMESTAMP}] API: ${API_STATUS} (allHealthy=${ALL_HEALTHY}) | Portal: HTTP ${FE_CODE} | IPFS (:8080): HTTP ${IPFS_CODE}"
  echo "${LOG_ENTRY}"
  echo "${LOG_ENTRY}" >> "${LOG_FILE}"
  
  sleep 60
done
