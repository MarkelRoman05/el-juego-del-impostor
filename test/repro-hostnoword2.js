const URL = 'http://127.0.0.1:3122';
const { io } = require('socket.io-client');
const onEvent = (s, ev, t=5000) => new Promise((res, rej) => { const x = setTimeout(() => rej(new Error(`timeout ${ev}`)), t); s.once(ev, d => { clearTimeout(x); res(d); }); });
const emitAckP = (s, ev, p) => new Promise((res) => s.emit(ev, p, (r) => res(r || {})));
const emitAck = (s, ev) => new Promise((res) => s.emit(ev, (r) => res(r || {})));
const waitFor = (s, ev, pred) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error(`timeout ${ev}`)), 6000); const h = (d) => { if (pred(d)) { clearTimeout(t); s.off(ev, h); res(d); } }; s.on(ev, h); });
(async () => {
  const host = io(URL, { transports: ['websocket'], reconnection: false, forceNew: true });
  await onEvent(host, 'connect');
  const joinedP = onEvent(host, 'room:joined');
  await emitAckP(host, 'room:create', { name: 'Host' });
  const joined = await joinedP;
  const code = joined.room.code;
  const sockets = [host];
  for (const n of ['P1','P2']) {
    const p = io(URL, { transports: ['websocket'], reconnection: false, forceNew: true });
    await onEvent(p, 'connect');
    await emitAckP(p, 'room:join', { code, name: n, playerId: null });
    sockets.push(p);
  }
  await new Promise(r => setTimeout(r, 300));
  const luP = waitFor(host, 'lobby:update', d => d.config.hostPlays === false);
  await emitAckP(host, 'config:set', { hostPlays: false });
  await luP;
  const lu2P = waitFor(host, 'lobby:update', d => d.config.customWordsCount === 1);
  await emitAckP(host, 'config:set', { customWords: 'elefante', hostWordFromCatalog: true });
  await lu2P;
  const ack = await emitAck(host, 'round:start');
  console.log('round:start ack:', JSON.stringify(ack));
  process.exit(0);
})().catch(e => { console.error('FALLO:', e.message); process.exit(1); });
