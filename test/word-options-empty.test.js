'use strict';
/* Test: el select de "Palabra de esta partida" (host sin jugar) NO muestra
   palabras hasta que hay una categoría elegida.
   Reproduce el bug: sin categoría, categoryKeys('') caía al fallback ['animales']
   y el select mostraba Animales aunque la categoría no estuviera seleccionada. */
const URL = process.env.URL || 'http://127.0.0.1:3111';
const { io } = require('socket.io-client');
const { CATEGORIES } = require('../words.js');
const onEvent = (s, ev, timeout = 5000) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error(`timeout ${ev}`)), timeout); s.once(ev, (d) => { clearTimeout(t); res(d); }); });
const emitAckP = (s, ev, payload) => new Promise((res) => s.emit(ev, payload, (r) => res(r || {})));
const waitFor = (s, ev, pred) => new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error(`timeout esperando ${ev}`)), 6000);
  const h = (d) => { if (pred(d)) { clearTimeout(t); s.off(ev, h); res(d); } };
  s.on(ev, h);
});
let fails = 0;
const check = (label, ok, extra = '') => { console.log(`${ok ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`); if (!ok) fails++; };

(async () => {
  const host = io(URL, { transports: ['websocket'], reconnection: false, forceNew: true });
  await onEvent(host, 'connect');
  const joinedP = onEvent(host, 'room:joined');
  check('room:create ok', (await emitAckP(host, 'room:create', { name: 'Host' })).ok === true);
  await joinedP;

  // host sin jugar → el servidor envía word:options solo a él
  await emitAckP(host, 'config:set', { hostPlays: false });

  // 1) sin categoría → lista vacía (ni Animales por fallback)
  let woP = waitFor(host, 'word:options', (w) => true);
  await emitAckP(host, 'config:set', {});
  let words = await woP;
  check('sin categoría → word:options vacío', Array.isArray(words) && words.length === 0, `len=${words.length}`);

  // 2) con categoría → solo palabras de esa categoría
  woP = waitFor(host, 'word:options', (w) => w.length > 0);
  await emitAckP(host, 'config:set', { category: 'cine' });
  words = await woP;
  check('con categoría cine → opciones no vacías', words.length > 0, `len=${words.length}`);
  check('todas las opciones son de cine', words.every((w) => CATEGORIES.cine.words.includes(w)), words.join(', '));

  // 3) deseleccionar categoría → vuelve a estar vacío
  woP = waitFor(host, 'word:options', (w) => w.length === 0);
  await emitAckP(host, 'config:set', { category: '' });
  words = await woP;
  check('deseleccionar categoría → word:options vacío', Array.isArray(words) && words.length === 0, `len=${words.length}`);

  console.log(fails === 0 ? '\n✅ TODO OK' : `\n❌ ${fails} fallos`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error('FALLO:', e.message); process.exit(1); });
