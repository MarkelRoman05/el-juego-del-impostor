'use strict';
/* Diagnóstico: conexión única + pausas contra prod. ¿Es churn de CF o algo más? */
const URL = process.env.URL || 'https://impostor.markel05.me';
const { io } = require('socket.io-client');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const onEvent = (s, ev, timeout = 10000) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error(`timeout ${ev}`)), timeout); s.once(ev, (d) => { clearTimeout(t); res(d); }); });

(async () => {
  console.log('→ conectando a', URL);
  const s = io(URL, { transports: ['websocket'], reconnection: false, forceNew: true, timeout: 15000 });
  await onEvent(s, 'connect');
  console.log('✓ conectado, id:', s.id);
  await sleep(1500);
  s.emit('room:create', { name: 'Diag' }, (res) => console.log('✓ ack create:', JSON.stringify(res)));
  const joined = await onEvent(s, 'room:joined');
  console.log('✓ room:joined recibido, código:', joined.room.code);
  const code = joined.room.code;

  const p1 = io(URL, { transports: ['websocket'], reconnection: false, forceNew: true, timeout: 15000 });
  await onEvent(p1, 'connect');
  console.log('✓ p1 conectado');
  await sleep(1000);
  const luP = onEvent(s, 'lobby:update');
  p1.emit('room:join', { code, name: 'P1', playerId: null }, (res) => console.log('✓ ack join p1:', JSON.stringify(res)));
  const lu = await luP;
  console.log('✓ lobby:update recibido, jugadores:', lu.players.length);
  process.exit(0);
})().catch((e) => { console.error('❌ FALLO:', e.message); process.exit(1); });
