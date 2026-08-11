'use strict';
/* Verificación rápida de los 2 cambios de servidor:
   1) Unirse a mitad de partida → rechazado (reconexión con playerId sí permitida)
   2) config:set clamp de impostores según jugadores conectados
*/
const URL = process.env.URL || 'http://127.0.0.1:3111';
const { io } = require('socket.io-client');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const onEvent = (s, ev) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error(`timeout ${ev}`)), 4000); s.once(ev, (d) => { clearTimeout(t); res(d); }); });
// espera un evento que cumpla el predicado (descarta los que no)
const waitFor = (s, ev, pred, tries = 10) => new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error(`timeout esperando ${ev} (${tries} intentos)`)), 6000);
  const h = (d) => { if (pred(d)) { clearTimeout(t); s.off(ev, h); res(d); } };
  s.on(ev, h);
});
const emitAckP = (s, ev, payload) => new Promise((res) => s.emit(ev, payload, (r) => res(r || {})));
const emitAck = (s, ev) => new Promise((res) => s.emit(ev, (r) => res(r || {})));
let fails = 0;
const check = (label, ok, extra = '') => { console.log(`${ok ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`); if (!ok) fails++; };

(async () => {
  const host = io(URL, { transports: ['websocket'], reconnection: false, forceNew: true });
  await onEvent(host, 'connect');
  check('room:create ok', (await emitAckP(host, 'room:create', { name: 'Host' })).ok === true);
  const joined = await onEvent(host, 'room:joined');
  const code = joined.room.code;

  const p1 = io(URL, { transports: ['websocket'], reconnection: false, forceNew: true });
  await onEvent(p1, 'connect');
  check('join P1 ok', (await emitAckP(p1, 'room:join', { code, name: 'P1', playerId: null })).ok === true);

  const p2 = io(URL, { transports: ['websocket'], reconnection: false, forceNew: true });
  await onEvent(p2, 'connect');
  check('join P2 ok', (await emitAckP(p2, 'room:join', { code, name: 'P2', playerId: null })).ok === true);

  // test 2: 3 jugadores conectados → impostors 3 debe quedar en 2
  const luP = waitFor(host, 'lobby:update', (d) => d.config.impostors === 2);
  const c1 = await emitAckP(host, 'config:set', { impostors: 3, category: 'animales', customWords: '', timer: 0, voting: true });
  const lu = await luP;
  check('config:set ok', c1.ok === true, JSON.stringify(c1));
  check('impostors clamp a 2 con 3 jugadores', lu.config.impostors === 2, `efectivo=${lu.config.impostors}`);

  // empezar ronda (waiter ANTES: el servidor emite round:started antes del ack)
  const startedP = onEvent(host, 'round:started');
  const r = await emitAck(host, 'round:start');
  check('round:start ok', r.ok === true, JSON.stringify(r));
  await startedP;
  let autoVoting = false;
  const autoPhase = (data) => { if (data?.phase === 'voting') autoVoting = true; };
  host.on('phase:changed', autoPhase);
  await wait(1200);
  host.off('phase:changed', autoPhase);
  check('la ronda no pasa a votación por tiempo', autoVoting === false);

  // test 1: nuevo jugador intenta entrar a mitad de ronda
  const p3 = io(URL, { transports: ['websocket'], reconnection: false, forceNew: true });
  await onEvent(p3, 'connect');
  const j3 = await emitAckP(p3, 'room:join', { code, name: 'P3', playerId: null });
  check('join nuevo a mitad de ronda rechazado', !j3.ok && !!j3.error, JSON.stringify(j3));

  // la reconexión con playerId SÍ debe funcionar a mitad de ronda
  const p1OldId = p1.id;
  p1.close();
  await wait(400);
  const p1b = io(URL, { transports: ['websocket'], reconnection: false, forceNew: true });
  await onEvent(p1b, 'connect');
  const restoredRole = onEvent(p1b, 'round:started');
  const re = await emitAckP(p1b, 'room:join', { code, name: 'P1', playerId: p1OldId });
  check('reconexión a mitad de ronda permitida', re.ok === true, JSON.stringify(re));
  const role = await restoredRole;
  check('rol restaurado tras reconexión', role.round === 1 && ['player', 'impostor'].includes(role.role));

  // Una segunda recarga debe seguir funcionando con el nuevo socketId.
  const p1NewId = p1b.id;
  p1b.close();
  await wait(400);
  const p1c = io(URL, { transports: ['websocket'], reconnection: false, forceNew: true });
  await onEvent(p1c, 'connect');
  const restoredAgain = onEvent(p1c, 'round:started');
  const re2 = await emitAckP(p1c, 'room:join', { code, name: 'P1', playerId: p1NewId });
  check('segunda reconexión a mitad de ronda permitida', re2.ok === true, JSON.stringify(re2));
  await restoredAgain;
  p1c.close();

  console.log(fails === 0 ? '\n✅ TODO OK' : `\n❌ ${fails} fallos`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error('FALLO:', e.message); process.exit(1); });
