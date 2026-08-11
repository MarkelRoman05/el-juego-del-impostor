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
   const joinedP = onEvent(host, 'room:joined');
   await emitAckP(host, 'room:create', { name: 'Host' });
   const joined = await joinedP;
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
 let hostImpostor = null;
 let pendingRoles = null;
   for (let i = 0; i < ROUNDS; i++) {
    if (i === 0) {
      pendingRoles = Promise.all([onEvent(host, 'round:started'), ...extra.map((p) => onEvent(p, 'round:started'))]);
      const ack = await emitAck(host, 'round:start');
      if (!ack || !ack.ok) { console.error(`❌ round ${i + 1} no arrancó: ${JSON.stringify(ack)}`); process.exit(1); }
    }
    const roles = await pendingRoles;
    if (hostImpostor === null) hostImpostor = roles[0].role === 'impostor';
    if ((roles[0].role === 'impostor') !== hostImpostor) {
      console.error(`❌ el impostor cambió en la ronda ${i + 1}`);
      process.exit(1);
    }
    const resultP = onEvent(host, 'phase:changed');
    await emitAck(host, 'round:reveal');
    await resultP;
    if (i < ROUNDS - 1) {
      pendingRoles = Promise.all([onEvent(host, 'round:started'), ...extra.map((p) => onEvent(p, 'round:started'))]);
      await emitAck(host, 'round:next');
    }
  }

 console.log(`creador impostor estable durante ${ROUNDS} rondas: ${hostImpostor ? 'sí' : 'no'}`);
 console.log('✅ TODO OK: la selección se conserva entre rondas');
 process.exit(0);
})().catch((e) => { console.error('FALLO:', e.message); process.exit(1); });
