'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const root = path.join(__dirname, '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'impostor-admin-'));
const port = 3200 + Math.floor(Math.random() * 500);
const url = `http://127.0.0.1:${port}`;

function startServer() {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, ADMIN_USER: 'markel', ADMIN_PASS: 'Markiton5_-?' },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  return child;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      if ((await fetch(`${url}/healthz`)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('El servidor no arrancó');
}

async function request(pathname, options) {
  const response = await fetch(`${url}${pathname}`, options);
  const body = await response.json();
  assert.equal(response.ok, true, JSON.stringify(body));
  return body;
}

(async () => {
  let server = startServer();
  try {
    await waitForServer();
    const login = await request('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'markel', password: 'Markiton5_-?' }),
    });
    const headers = { Authorization: `Bearer ${login.token}`, 'Content-Type': 'application/json' };
    await request('/api/admin/categories', {
      method: 'POST',
      headers,
       body: JSON.stringify({ key: 'persistente', label: 'Persistente', words: ['reinicio', ' Reinicio ', 'REINICIO'] }),
    });
    server.kill('SIGTERM');
    await new Promise((resolve) => server.once('exit', resolve));

    server = startServer();
    await waitForServer();
    const loginAfterRestart = await request('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'markel', password: 'Markiton5_-?' }),
    });
    const categories = await request('/api/admin/categories', {
      headers: { Authorization: `Bearer ${loginAfterRestart.token}` },
    });
     assert.deepEqual(categories.categories.persistente.words, ['reinicio']);
    console.log('Admin login y categorías persisten tras reinicio');
  } finally {
    server.kill('SIGTERM');
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
