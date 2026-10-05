#!/usr/bin/env bash
set -e

INDEX_HTML='<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Academic Blockchain IPFS Gateway</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 3rem 2.5rem;
      max-width: 580px;
      text-align: center;
      box-shadow: 0 20px 35px -10px rgba(0,0,0,0.5);
    }
    .badge {
      display: inline-block;
      background: #065f46;
      color: #34d399;
      padding: 6px 16px;
      border-radius: 9999px;
      font-weight: 600;
      font-size: 0.875rem;
      margin-bottom: 1.5rem;
      letter-spacing: 0.5px;
    }
    h1 {
      color: #38bdf8;
      font-size: 2rem;
      margin: 0 0 1rem 0;
    }
    p {
      color: #94a3b8;
      font-size: 1rem;
      line-height: 1.6;
      margin: 0 0 2rem 0;
    }
    .actions {
      display: flex;
      gap: 1rem;
      justify-content: center;
      flex-wrap: wrap;
    }
    a.btn {
      display: inline-flex;
      align-items: center;
      background: #2563eb;
      color: white;
      text-decoration: none;
      padding: 0.85rem 1.75rem;
      border-radius: 10px;
      font-weight: 600;
      transition: all 0.2s;
    }
    a.btn:hover {
      background: #1d4ed8;
      transform: translateY(-1px);
    }
    a.secondary {
      background: #334155;
      color: #e2e8f0;
    }
    a.secondary:hover {
      background: #475569;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">● IPFS Gateway Active (Port 8080)</div>
    <h1>Academic Blockchain Storage</h1>
    <p>The decentralized IPFS storage layer is running and serving tamper-evident certificates anchored to the Hyperledger Fabric ledger.</p>
    <div class="actions">
      <a class="btn" href="http://localhost:3000">Open Web Portal</a>
      <a class="btn secondary" href="http://localhost:4000/api/health">Check API Health</a>
    </div>
  </div>
</body>
</html>'

INDEX_CID=$(echo "${INDEX_HTML}" | docker exec -i ipfs-node ipfs add -q)
echo "Landing Page uploaded to IPFS! CID: ${INDEX_CID}"

docker exec ipfs-node ipfs config --json Gateway.PublicGateways '{
  "localhost": {
    "UseSubdomains": false,
    "Paths": ["/ipfs", "/ipns"],
    "RootRedirect": "/ipfs/'"${INDEX_CID}"'"
  },
  "127.0.0.1": {
    "UseSubdomains": false,
    "Paths": ["/ipfs", "/ipns"],
    "RootRedirect": "/ipfs/'"${INDEX_CID}"'"
  }
}'

docker exec ipfs-node ipfs config Gateway.RootRedirect "/ipfs/${INDEX_CID}"

echo "Restarting ipfs-node container..."
docker restart ipfs-node
sleep 4
echo "IPFS restarted successfully!"
