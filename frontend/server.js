import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

// Prefer built React dist directory if index.html exists, fallback to public
const DIST_DIR = path.join(__dirname, 'dist');
const PUBLIC_DIR = path.join(__dirname, 'public');
const hasBuiltDist = fs.existsSync(DIST_DIR) && fs.existsSync(path.join(DIST_DIR, 'index.html'));
const SERVE_DIR = hasBuiltDist ? DIST_DIR : PUBLIC_DIR;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = urlObj.pathname;

  // Reverse proxy API requests to backend
  if (pathname.startsWith('/api')) {
    const backendTarget = new URL(req.url, BACKEND_URL);
    const options = {
      hostname: backendTarget.hostname,
      port: backendTarget.port || (backendTarget.protocol === 'https:' ? 443 : 80),
      path: backendTarget.pathname + backendTarget.search,
      method: req.method,
      headers: {
        ...req.headers,
        host: backendTarget.host
      }
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Backend API unreachable', 
        details: err.message,
        target: BACKEND_URL 
      }));
    });

    req.pipe(proxyReq, { end: true });
    return;
  }

  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  let filePath = path.join(SERVE_DIR, pathname);
  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // SPA Fallback: serve index.html for client-side routing
        fs.readFile(path.join(SERVE_DIR, 'index.html'), (err, fallback) => {
          if (err) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>404 - Not Found</h1><p>Ensure either <code>npm run build</code> has been run or static files exist in <code>public/</code>.</p>');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(fallback, 'utf-8');
          }
        });
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Academic Blockchain Portal running at http://localhost:${PORT}`);
  console.log(`📁 Serving assets from: ${SERVE_DIR} (${hasBuiltDist ? 'React Vite Build' : 'Fallback Public'})`);
  console.log(`🔌 Proxying /api calls to: ${BACKEND_URL}`);
});
