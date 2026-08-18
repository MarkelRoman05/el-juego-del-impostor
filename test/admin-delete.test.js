'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const root = path.join(__dirname, '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'impostor-del-'));
const port = 3300 + Math.floor(Math.random() * 400);
const url = `http://127.0.0.1:${port}`;

function startServer() {
  return spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, ADMIN_USER: 'markel', ADMIN_PASS: 'Markiton5_-?' },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
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
  const server = startServer();
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
      body: JSON.stringify({ key: 'borrable', label: 'Borrable', words: ['alpha', 'beta'] }),
    });

    await request('/api/admin/categories/order', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ order: ['borrable'] }),
    });

    const before = await request('/api/admin/categories', { headers });
    assert.ok(before.categories.borrable, 'la categoría debe existir antes de borrar');

    await request('/api/admin/categories/borrable', { method: 'DELETE', headers });

    const after = await request('/api/admin/categories', { headers });
    assert.equal(after.categories.borrable, undefined, 'la categoría debe desaparecer tras borrar');

    const saved = JSON.parse(fs.readFileSync(path.join(dataDir, 'admin-config.json'), 'utf8'));
    assert.ok(!saved.customCategories.borrable, 'no debe quedar en customCategories');
    assert.ok(!saved.categoryOrder || !saved.categoryOrder.includes('borrable'), 'no debe quedar en categoryOrder');

    console.log('OK: eliminar categoría elimina la categoría y limpia categoryOrder');
  } finally {
    server.kill('SIGTERM');
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
