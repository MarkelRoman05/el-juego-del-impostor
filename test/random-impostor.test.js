'use strict';
/* Test estadístico: el creador de la partida NO está marcado como impostor por defecto.
   Con 3 jugadores y 1 impostor, el creador debería salir impostor ~1/3 de las veces.
   60 rondas → esperado 20; margen 3σ (±11) → aceptamos [9, 31].
   Si hubiera sesgo (creador SIEMPRE impostor → 60), falla de forma inequívoca. */
const URL = process.env.URL || 'http://127.0.0.1:3111';
const { io } = require('socket.io-client');
const onEvent = (s, ev, timeout = 5000) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error(`timeout ${ev}`)), timeout); s.once(ev, (d) => { clearTimeout(t); res(d); }); });
const emitAckP = (s, ev, payload) => new Promise((res) => s.emit(ev, payload, (r) => res(r || {})));
const emitAck = (s, ev) => new Promise((res) => s.emit(ev, (r) => res(r || {})));

(async () => {
  const host = io(URL, { transports: ['websocket'], reconnection: false, forceNew: true });
  await onEvent(host, 'connect');
  await emitAckP(host, 'room:create', { name: 'Host' });
  const joined = await onEvent(host, 'room:joined');
  const code = joined.room.code;

  const extra = [];
  for (const n of ['P1', 'P2']) {
    const p = io(URL, { transports: ['websocket'], reconnection: false, forceNew: true });
    await onEvent(p, 'connect');
    await emitAckP(p, 'room:join', { code, name: n, playerId: null });
    extra.push(p);
  }
  await new Promise((r) => setTimeout(r, 300));
  await emitAckP(host, 'config:set', { impostors: 1, timer: 0, voting: false });

  const ROUNDS = 60;
  let hostImpostor = 0;
  for (let i = 0; i < ROUNDS; i++) {
    const startedP = [onEvent(host, 'round:started'), ...extra.map((p) => onEvent(p, 'round:started'))];
    const ack = await emitAck(host, 'round:start');
    if (!ack || !ack.ok) { console.error(`❌ round ${i + 1} no arrancó: ${JSON.stringify(ack)}`); process.exit(1); }
    const roles = await Promise.all(startedP);
    if (roles[0].role === 'impostor') hostImpostor++;
    await emitAck(host, 'round:next');
  }

  const pct = ((hostImpostor / ROUNDS) * 100).toFixed(1);
  const ok = hostImpostor >= 9 && hostImpostor <= 31;
  console.log(`creador impostor: ${hostImpostor}/${ROUNDS} (${pct}%) — esperado ~33% (margen 3σ: 9-31)`);
  console.log(ok ? '✅ TODO OK: el creador NO está marcado por defecto, es aleatorio' : '❌ SESGO DETECTADO en la selección del impostor');
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('FALLO:', e.message); process.exit(1); });
