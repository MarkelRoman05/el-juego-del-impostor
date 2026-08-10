'use strict';

const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const ng = path.join(root, 'node_modules', '@angular', 'cli', 'bin', 'ng.js');
const ngArgs = ['serve'];
if (process.env.DEV_PORT) ngArgs.push('--port', process.env.DEV_PORT);
const children = [
  spawn(process.execPath, [path.join(root, 'server.js')], { cwd: root, stdio: 'inherit', env: { ...process.env, PORT: process.env.PORT || '3111' } }),
  spawn(process.execPath, [ng, ...ngArgs], { cwd: root, stdio: 'inherit', env: process.env }),
];

let stopping = false;
function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(exitCode), 250);
}

for (const child of children) child.on('exit', (code) => { if (!stopping && code) stop(code); });
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
