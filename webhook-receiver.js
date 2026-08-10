'use strict';
const http = require('http');
const crypto = require('crypto');
const { execFile } = require('child_process');

const PORT = 9876;
const WEBHOOK_SECRET = '8786f4f4d976917630055a1761d42bcefcfe3a64b5c1d0cccaaba8b779f9137b';
const DEPLOY_SCRIPT = '/home/ubuntu/infraestructura/DESARROLLO/impostor/deploy.sh';
const LOG_FILE = '/home/ubuntu/.hermes/logs/impostor-webhook.log';

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  require('fs').appendFileSync(LOG_FILE, line);
}

function verifySignature(payload, signature) {
  if (!signature) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

const server = http.createServer((req, res) => {
  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    return;
  }

  // Only accept POST to /webhook
  if (req.method !== 'POST' || req.url !== '/webhook') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    const signature = req.headers['x-hub-signature-256'];
    
    if (!verifySignature(body, signature)) {
      log('❌ Invalid signature');
      res.writeHead(403);
      res.end('Invalid signature');
      return;
    }

    let payload;
    try {
      payload = JSON.parse(body);
    } catch (e) {
      log('❌ Invalid JSON');
      res.writeHead(400);
      res.end('Invalid JSON');
      return;
    }

    // Only process push events
    if (req.headers['x-github-event'] !== 'push') {
      log(`⏭️ Ignoring event: ${req.headers['x-github-event']}`);
      res.writeHead(200);
      res.end('OK (ignored)');
      return;
    }

    const branch = payload.ref?.replace('refs/heads/', '');
    if (branch !== 'main') {
      log(`⏭️ Ignoring push to branch: ${branch}`);
      res.writeHead(200);
      res.end('OK (ignored)');
      return;
    }

    log(`🚀 Push to main detected - starting deploy`);
    res.writeHead(200);
    res.end('Deploy started');

    // Run deploy script in background
    execFile('bash', [DEPLOY_SCRIPT], { timeout: 300000 }, (error, stdout, stderr) => {
      if (error) {
        log(`❌ Deploy failed: ${error.message}`);
      } else {
        log('✅ Deploy completed successfully');
      }
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  log(`🎣 Webhook receiver listening on port ${PORT}`);
  console.log(`Webhook receiver listening on http://0.0.0.0:${PORT}`);
});
