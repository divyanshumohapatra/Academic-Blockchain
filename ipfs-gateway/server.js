import http from 'http';

const PORT = process.env.PORT || 8080;
const IPFS_NODE_GATEWAY = process.env.IPFS_NODE_GATEWAY || 'http://ipfs-node:8080';
const IPFS_NODE_API = process.env.IPFS_NODE_API || 'http://ipfs-node:5001';

const LANDING_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IPFS Gateway — Academic Blockchain</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(17, 24, 39, 0.85);
      --card-border: rgba(255, 255, 255, 0.08);
      --primary: #38bdf8;
      --primary-glow: rgba(56, 189, 248, 0.25);
      --accent: #6366f1;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --success: #10b981;
      --success-glow: rgba(16, 185, 129, 0.2);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      background: var(--bg);
      background-image: 
        radial-gradient(circle at 50% 0%, rgba(56, 189, 248, 0.12) 0%, transparent 60%),
        radial-gradient(circle at 80% 80%, rgba(99, 102, 241, 0.08) 0%, transparent 50%);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .container {
      width: 100%;
      max-width: 680px;
    }
    .card {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      padding: 2.75rem 2.25rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
      text-align: center;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #34d399;
      font-size: 0.85rem;
      font-weight: 600;
      padding: 6px 14px;
      border-radius: 9999px;
      margin-bottom: 1.5rem;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      background: #34d399;
      border-radius: 50%;
      box-shadow: 0 0 10px #34d399;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }
    h1 {
      font-size: 2.1rem;
      font-weight: 800;
      letter-spacing: -0.025em;
      margin-bottom: 0.75rem;
      background: linear-gradient(135deg, #ffffff 40%, #94a3b8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p.subtitle {
      color: var(--text-muted);
      font-size: 1rem;
      line-height: 1.6;
      margin-bottom: 2rem;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 2rem;
      text-align: left;
    }
    .info-item {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      padding: 12px 14px;
    }
    .info-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
      font-weight: 600;
    }
    .info-val {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--primary);
    }
    .cid-search-box {
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 1rem;
      margin-bottom: 1.75rem;
      text-align: left;
    }
    .cid-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 8px;
      display: block;
    }
    .cid-input-group {
      display: flex;
      gap: 8px;
    }
    input.cid-input {
      flex: 1;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      padding: 10px 14px;
      color: white;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
      outline: none;
      transition: border-color 0.2s;
    }
    input.cid-input:focus {
      border-color: var(--primary);
    }
    button.btn-view {
      background: var(--primary);
      color: #0b0f19;
      font-weight: 700;
      font-size: 0.875rem;
      border: none;
      border-radius: 8px;
      padding: 10px 18px;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
    }
    button.btn-view:hover {
      background: #7dd3fc;
      transform: translateY(-1px);
    }
    .quick-sample {
      margin-top: 8px;
      font-size: 0.78rem;
      color: var(--text-muted);
    }
    .quick-sample a {
      color: var(--primary);
      text-decoration: none;
      font-family: 'JetBrains Mono', monospace;
    }
    .quick-sample a:hover {
      text-decoration: underline;
    }
    .action-buttons {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
    }
    a.btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 22px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 0.9rem;
      text-decoration: none;
      transition: all 0.2s;
    }
    a.btn-portal {
      background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%);
      color: white;
      box-shadow: 0 4px 15px rgba(37, 99, 235, 0.35);
    }
    a.btn-portal:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(37, 99, 235, 0.5);
    }
    a.btn-api {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #e2e8f0;
    }
    a.btn-api:hover {
      background: rgba(255, 255, 255, 0.12);
      transform: translateY(-2px);
    }
    footer {
      text-align: center;
      margin-top: 1.5rem;
      font-size: 0.8rem;
      color: rgba(148, 163, 184, 0.7);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="status-badge">
        <span class="status-dot"></span>
        IPFS Gateway Online • Port 8080
      </div>

      <h1>Academic Blockchain Gateway</h1>
      <p class="subtitle">Decentralized storage layer hosting immutable academic certificates anchored to the Hyperledger Fabric ledger.</p>

      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Node Engine</div>
          <div class="info-val">Kubo v0.26.0</div>
        </div>
        <div class="info-item">
          <div class="info-label">Gateway Port</div>
          <div class="info-val">:8080 (Active)</div>
        </div>
        <div class="info-item">
          <div class="info-label">API Port</div>
          <div class="info-val">:5001 (RPC)</div>
        </div>
      </div>

      <div class="cid-search-box">
        <label class="cid-label" for="cidInput">Inspect / Fetch IPFS Document by CID:</label>
        <div class="cid-input-group">
          <input class="cid-input" id="cidInput" type="text" placeholder="Qm..." value="Qma58W7UZEhK18grjPYQKD89pScLYubric51swC5u7KzJf">
          <button class="btn-view" onclick="openCID()">View File</button>
        </div>
        <div class="quick-sample">
          Pinned Ledger Certificate: <a href="/ipfs/Qma58W7UZEhK18grjPYQKD89pScLYubric51swC5u7KzJf" target="_blank">Qma58W7UZEhK... (PDF)</a>
        </div>
      </div>

      <div class="action-buttons">
        <a class="btn btn-portal" href="http://localhost:3000">
          🌐 Open Web Portal (:3000)
        </a>
        <a class="btn btn-api" href="http://localhost:4000/api/health" target="_blank">
          🔌 Check API Health (:4000)
        </a>
      </div>
    </div>

    <footer>
      Hyperledger Fabric 2.5 Consortium • Academic Certificate Anchoring
    </footer>
  </div>

  <script>
    function openCID() {
      const cid = document.getElementById('cidInput').value.trim();
      if (cid) {
        window.open('/ipfs/' + encodeURIComponent(cid), '_blank');
      }
    }
    document.getElementById('cidInput').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') openCID();
    });
  </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost:8080'}`);
  const pathname = urlObj.pathname;

  // Root or index.html: Serve Dashboard
  if (pathname === '/' || pathname === '' || pathname === '/index.html') {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(LANDING_HTML);
  }

  // Proxy /ipfs/* or /ipns/* directly to Kubo Gateway
  if (pathname.startsWith('/ipfs') || pathname.startsWith('/ipns')) {
    const targetUrl = new URL(req.url, IPFS_NODE_GATEWAY);
    const proxyReq = http.request(targetUrl, {
      method: req.method,
      headers: { ...req.headers, host: targetUrl.host }
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'IPFS daemon unreachable', details: err.message }));
    });
    return req.pipe(proxyReq);
  }

  // Proxy /api/v0/* to Kubo RPC API
  if (pathname.startsWith('/api/v0')) {
    const targetUrl = new URL(req.url, IPFS_NODE_API);
    const proxyReq = http.request(targetUrl, {
      method: req.method,
      headers: { ...req.headers, host: targetUrl.host }
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'IPFS API unreachable', details: err.message }));
    });
    return req.pipe(proxyReq);
  }

  // Catch-all: forward to Kubo gateway
  const targetUrl = new URL(req.url, IPFS_NODE_GATEWAY);
  const proxyReq = http.request(targetUrl, {
    method: req.method,
    headers: { ...req.headers, host: targetUrl.host }
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', () => {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });
  req.pipe(proxyReq);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 IPFS Smart Gateway running on port ${PORT}`);
});
