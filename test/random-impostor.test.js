'use strict';
/* Test: la selección de impostor evita repetir el mismo jugador dos rondas seguidas.
   Con 3 jugadores y 1 impostor, cada ronda re-elige impostor del pool sin los
   impostores de la ronda anterior (siempre que haya candidatos suficientes).
   También verifica que cada round:started incluye un starter con nombre. */
const URL = process.env.URL || 'http://127.0.0.1:3111';
const { io } = require('socket.io-client');
const onEvent = (s, ev, timeout = 5000) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error(`timeout ${ev}`)), timeout); s.once(ev, (d) => { clearTimeout(t); res(d); }); });
const emitAckP = (s, ev, payload) => new Promise((res) => s.emit(ev, payload, (r) => res(r || {})));
const emitAck = (s, ev) => new Promise((res) => s.emit(ev, (r) => res(r || {})));
const waitPhase = (s, phase, timeout = 5000) => new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error(`timeout esperando phase:${phase}`)), timeout);
  const h = (d) => { if (d.phase === phase) { clearTimeout(t); s.off('phase:changed', h); res(d); } };
  s.on('phase:changed', h);
});
let fails = 0;
const check = (label, ok, extra = '') => { console.log(`${ok ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`); if (!ok) fails++; };

(async () => {
  const host = io(URL, { transports: ['websocket'], reconnection: false, forceNew: true });
  await onEvent(host, 'connect');
  const joinedP = onEvent(host, 'room:joined');
  check('room:create ok', (await emitAckP(host, 'room:create', { name: 'Host' })).ok === true);
  const joined = await joinedP;
  const code = joined.room.code;

  const sockets = [host];
  for (const n of ['P1', 'P2']) {
    const p = io(URL, { transports: ['websocket'], reconnection: false, forceNew: true });
    await onEvent(p, 'connect');
    check(`join ${n} ok`, (await emitAckP(p, 'room:join', { code, name: n, playerId: null })).ok === true);
    sockets.push(p);
  }
  await new Promise((r) => setTimeout(r, 300));
  await emitAckP(host, 'config:set', { impostors: 1, category: 'animales' });

  const ROUNDS = 20;
  let previousImpostor = null;
  for (let i = 0; i < ROUNDS; i++) {
    const startedP = Promise.all(sockets.map((s) => onEvent(s, 'round:started')));
    const phasesP = Promise.all(sockets.map((s) => waitPhase(s, 'round')));
    const ack = await emitAck(host, 'round:start');
    if (!ack.ok) { console.error(`❌ round ${i + 1} no arrancó: ${JSON.stringify(ack)}`); process.exit(1); }
    const roles = await startedP;
    const phases = await phasesP;

    const starters = new Set(roles.map((r) => r.starter));
    const starterIds = new Set(roles.map((r) => r.starterId));
    check(`round ${i + 1}: todos ven el mismo starter`, starters.size === 1 && [...starters][0], JSON.stringify([...starters]));
    check(`round ${i + 1}: starter es un jugador`, [...starters][0] && ['Host', 'P1', 'P2'].includes([...starters][0]));
    check(`round ${i + 1}: todos ven el mismo starterId`, starterIds.size === 1 && typeof [...starterIds][0] === 'string', JSON.stringify([...starterIds]));
    check(`round ${i + 1}: phase:changed difunde starter a toda la sala`, phases.every((p) => p.starter === [...starters][0]), JSON.stringify(phases.map((p) => p.starter)));

    const impostorIndex = roles.findIndex((r) => r.role === 'impostor');
    check('exactamente 1 impostor', roles.filter((r) => r.role === 'impostor').length === 1);
    if (previousImpostor !== null) {
      check(`round ${i + 1}: no repite impostor anterior`, impostorIndex !== previousImpostor, `antes=${previousImpostor} ahora=${impostorIndex}`);
    }
    previousImpostor = impostorIndex;

    if (i < ROUNDS - 1) {
      const nextP = waitPhase(host, 'gameover');
      await emitAck(host, 'impostor:mark');
      await nextP;
      await emitAck(host, 'round:next');
    }
  }

  console.log(fails === 0 ? '\n✅ TODO OK' : `\n❌ ${fails} fallos`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error('FALLO:', e.message); process.exit(1); });
