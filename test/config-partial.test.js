'use strict';
/* Test: config:set aplica SOLO los campos presentes.
   Reproduce el bug "puse 1 impostor y había 2": un cambio de categoría/tiempo
   con payload parcial no debe pisar el impostors recién puesto. */
const URL = process.env.URL || 'http://127.0.0.1:3111';
const { io } = require('socket.io-client');
const onEvent = (s, ev, timeout = 5000) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error(`timeout ${ev}`)), timeout); s.once(ev, (d) => { clearTimeout(t); res(d); }); });
const emitAckP = (s, ev, payload) => new Promise((res) => s.emit(ev, payload, (r) => res(r || {})));
const emitAck = (s, ev) => new Promise((res) => s.emit(ev, (r) => res(r || {})));
const waitFor = (s, ev, pred, tries = 10) => new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error(`timeout esperando ${ev}`)), 6000);
  const h = (d) => { if (pred(d)) { clearTimeout(t); s.off(ev, h); res(d); } };
  s.on(ev, h);
});
let fails = 0;
const check = (label, ok, extra = '') => { console.log(`${ok ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`); if (!ok) fails++; };

(async () => {
  const host = io(URL, { transports: ['websocket'], reconnection: false, forceNew: true });
  await onEvent(host, 'connect');
  check('room:create ok', (await emitAckP(host, 'room:create', { name: 'Host' })).ok === true);
  const joined = await onEvent(host, 'room:joined');
  const code = joined.room.code;

  // 2 jugadores más (total 3 conectados → máx impostores = 2)
  const extra = [];
  for (const n of ['P1', 'P2']) {
    const p = io(URL, { transports: ['websocket'], reconnection: false, forceNew: true });
    await onEvent(p, 'connect');
    check(`join ${n} ok`, (await emitAckP(p, 'room:join', { code, name: n, playerId: null })).ok === true);
    extra.push(p);
  }
  await new Promise((r) => setTimeout(r, 300));

  // 1) solo impostors: 3 → clamp a 2; el resto intacto
  let luP = waitFor(host, 'lobby:update', (d) => d.config.impostors === 2);
  await emitAckP(host, 'config:set', { impostors: 3 });
  let lu = await luP;
  check('solo {impostors:3} → clamp a 2', lu.config.impostors === 2, `impostors=${lu.config.impostors}`);
  check('categoría/votación intactos, sin temporizador y sin pista', lu.config.category === 'animales' && lu.config.timer === 0 && lu.config.voting === true && lu.config.impostorHint === false, JSON.stringify(lu.config));

  // 2) solo categoría: impostors DEBE seguir en 2
  luP = waitFor(host, 'lobby:update', (d) => d.config.category === 'cine');
  await emitAckP(host, 'config:set', { category: 'cine' });
  lu = await luP;
  check('cambiar categoría NO pisa impostors', lu.config.impostors === 2 && lu.config.category === 'cine', `impostors=${lu.config.impostors} cat=${lu.config.category}`);

  // 3) un tiempo enviado por un cliente antiguo se ignora
  luP = waitFor(host, 'lobby:update', (d) => d.config.category === 'cine');
  await emitAckP(host, 'config:set', { timer: 60 });
  lu = await luP;
  check('el temporizador permanece desactivado', lu.config.timer === 0 && lu.config.category === 'cine' && lu.config.impostors === 2, JSON.stringify(lu.config));

  // 4) solo votación
  luP = waitFor(host, 'lobby:update', (d) => d.config.voting === false);
  await emitAckP(host, 'config:set', { voting: false });
  lu = await luP;
  check('cambiar votación NO pisa nada', lu.config.voting === false && lu.config.timer === 0 && lu.config.impostors === 2, JSON.stringify(lu.config));

  // 5) la ronda respeta el config: EXACTAMENTE 2 impostores (roles de los 3 sockets)
  const startedP = [onEvent(host, 'round:started'), ...extra.map((p) => onEvent(p, 'round:started'))];
  const ack = await emitAck(host, 'round:start'); // sin payload: si no, socket.io no lo trata como ack
  check('round:start ok', ack.ok === true, JSON.stringify(ack));
  const roles = await Promise.all(startedP);
  const impostors = roles.filter((r) => r.role === 'impostor').length;
  check('exactamente 2 impostores en la ronda', impostors === 2, `impostores=${impostors} (config=${lu.config.impostors})`);

  console.log(fails === 0 ? '\n✅ TODO OK' : `\n❌ ${fails} fallos`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error('FALLO:', e.message); process.exit(1); });
