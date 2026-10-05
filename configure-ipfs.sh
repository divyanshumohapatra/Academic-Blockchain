#!/usr/bin/env bash
set -e

# Update IPFS config inside container using ipfs config
docker exec -i ipfs-node ipfs config --json Gateway.PublicGateways '{
  "localhost": {
    "UseSubdomains": false,
    "Paths": ["/ipfs", "/ipns"]
  },
  "127.0.0.1": {
    "UseSubdomains": false,
    "Paths": ["/ipfs", "/ipns"]
  }
}'

# Allow all CORS headers for API and Gateway
docker exec ipfs-node ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
docker exec ipfs-node ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["PUT", "POST", "GET"]'
docker exec ipfs-node ipfs config --json Gateway.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
docker exec ipfs-node ipfs config --json Gateway.HTTPHeaders.Access-Control-Allow-Methods '["GET", "HEAD", "OPTIONS"]'

echo "Restarting ipfs-node container..."
docker restart ipfs-node
sleep 3
echo "IPFS configured and restarted successfully!"
