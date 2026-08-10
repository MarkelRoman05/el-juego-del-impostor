'use strict';
const URL = 'http://127.0.0.1:3111';
const { io } = require('socket.io-client');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const onEvent = (s, ev) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error(`timeout ${ev}`)), 4000); s.once(ev, (d) => { clearTimeout(t); res(d); }); });
const emitAckP = (s, ev, payload) => new Promise((res) => s.emit(ev, payload, (r) => res(r || {})));

(async () => {
  const host = io(URL, { transports: ['websocket'], reconnection: false, forceNew: true });
  await onEvent(host, 'connect');
  const a = await emitAckP(host, 'room:create', { name: 'Host' });
  const joined = await onEvent(host, 'room:joined');
  const code = joined.room.code;
  console.log('código:', code);

  const p1 = io(URL, { transports: ['websocket'], reconnection: false, forceNew: true });
  await onEvent(p1, 'connect');
  console.log('p1 socket id:', p1.id);
  const r1 = await emitAckP(p1, 'room:join', { code, name: 'J1', playerId: null });
  console.log('join p1:', JSON.stringify(r1));
  const lu = await onEvent(host, 'lobby:update');
  console.log('lobby:', JSON.stringify(lu.players.map((p) => ({ id: p.id, name: p.name, conn: p.connected }))));

  console.log('cerrando p1…');
  const p1OldId = p1.id; // capturar ANTES de cerrar (socket.io borra .id al desconectar)
  p1.close();
  await wait(500);

  const p1b = io(URL, { transports: ['websocket'], reconnection: false, forceNew: true });
  await onEvent(p1b, 'connect');
  console.log('p1b socket id:', p1b.id);
  const r2 = await emitAckP(p1b, 'room:join', { code, name: 'J1', playerId: p1OldId });
  console.log('rejoin p1b (playerId=' + p1OldId + '):', JSON.stringify(r2));
  process.exit(0);
})().catch((e) => { console.error('FALLO:', e.message); process.exit(1); });
