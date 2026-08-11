'use strict';
/* Test: palabras personalizadas preparadas ANTES de la partida.
   1) El creador manda sus palabras al crear → pool propio
   2) Cada jugador mezcla las suyas al unirse (dedupe)
   3) PRIVACIDAD: la lista NUNCA viaja al cliente (ni room:joined ni lobby:update)
   4) La ronda elige al azar de la lista mezclada y etiqueta 'Palabras personalizadas' */
const URL = process.env.URL || 'http://127.0.0.1:3111';
const { io } = require('socket.io-client');
const onEvent = (s, ev, timeout = 5000) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error(`timeout ${ev}`)), timeout); s.once(ev, (d) => { clearTimeout(t); res(d); }); });
const emitAckP = (s, ev, payload) => new Promise((res) => s.emit(ev, payload, (r) => res(r || {})));
const emitAck = (s, ev) => new Promise((res) => s.emit(ev, (r) => res(r || {})));
const waitFor = (s, ev, pred) => new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error(`timeout esperando ${ev}`)), 6000);
  const h = (d) => { if (pred(d)) { clearTimeout(t); s.off(ev, h); res(d); } };
  s.on(ev, h);
});
const POOL = ['volcán', 'cascada', 'arcoíris'];
let fails = 0;
const check = (label, ok, extra = '') => { console.log(`${ok ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`); if (!ok) fails++; };

(async () => {
  const host = io(URL, { transports: ['websocket'], reconnection: false, forceNew: true });
  await onEvent(host, 'connect');
  const joinedP = onEvent(host, 'room:joined');
  check('create con palabras ok', (await emitAckP(host, 'room:create', { name: 'Host', customWords: 'volcán\ncascada' })).ok === true);
  const joined = await joinedP;
  const code = joined.room.code;
  check('pool inicial = 2 palabras', joined.room.config.customWordsCount === 2, `count=${joined.room.config.customWordsCount}`);
  check('PRIVACIDAD: room:joined sin el texto de las palabras', !JSON.stringify(joined.room).includes('volcán') && !JSON.stringify(joined.room).includes('cascada'), '');

  // P1 se une mezclando las suyas (cascada repetida + arcoíris) → dedupe
  const p1 = io(URL, { transports: ['websocket'], reconnection: false, forceNew: true });
  await onEvent(p1, 'connect');
  const luP = waitFor(host, 'lobby:update', (d) => d.config.customWordsCount === 3);
  await emitAckP(p1, 'room:join', { code, name: 'P1', playerId: null, customWords: 'cascada\narcoíris' });
  const lu = await luP;
  check('mezcla deduplicada = 3 palabras', lu.config.customWordsCount === 3, `count=${lu.config.customWordsCount}`);
  check('PRIVACIDAD: lobby:update sin la lista', !JSON.stringify(lu).includes('volcán') && !JSON.stringify(lu).includes('arcoíris'), '');

  // P2 se une sin palabras → el pool no cambia
  const p2 = io(URL, { transports: ['websocket'], reconnection: false, forceNew: true });
  await onEvent(p2, 'connect');
  const lu2P = waitFor(host, 'lobby:update', (d) => d.players.length === 3);
  await emitAckP(p2, 'room:join', { code, name: 'P2', playerId: null });
  const lu2 = await lu2P;
  check('sin palabras → pool intacto', lu2.config.customWordsCount === 3, `count=${lu2.config.customWordsCount}`);

  // ronda: la palabra sale de la lista mezclada y la categoría es 'Palabras personalizadas'
  const startedP = onEvent(p1, 'round:started');
  await emitAck(host, 'round:start');
  const role = await startedP;
  check('jugador recibe palabra del pool mezclado', role.role === 'player' && POOL.includes(role.word), `word=${role.word}`);
  check('categoría = Palabras personalizadas', role.category === 'Palabras personalizadas', `cat=${role.category}`);

  console.log(fails === 0 ? '\n✅ TODO OK' : `\n❌ ${fails} fallos`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error('FALLO:', e.message); process.exit(1); });
