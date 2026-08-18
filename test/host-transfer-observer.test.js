const URL = 'http://127.0.0.1:3123';
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
  const players = [];
  for (const n of ['P1','P2','P3']) {
    const p = io(URL, { transports: ['websocket'], reconnection: false, forceNew: true });
    await onEvent(p, 'connect');
    await emitAckP(p, 'room:join', { code, name: n, playerId: null });
    players.push(p);
  }
  await new Promise(r => setTimeout(r, 300));
  const luP = waitFor(host, 'lobby:update', d => d.config.hostPlays === false);
  await emitAckP(host, 'config:set', { hostPlays: false });
  await luP;
  const catP = waitFor(host, 'lobby:update', d => (d.config.category || '').includes('animales'));
  await emitAckP(host, 'config:set', { category: 'animales' });
  await catP;
  const startedP = [onEvent(host, 'round:started'), ...players.map(s => onEvent(s, 'round:started'))];
  const ack = await emitAck(host, 'round:start');
  if (!ack.ok) throw new Error('round:start no ok: ' + JSON.stringify(ack));
  const roles = await Promise.all(startedP);
  const hostRole = roles[0];
  const p1Role = roles[1];
  console.log('host role observe:', hostRole.observe);
  console.log('p1 role observe:', p1Role.observe);
  if (!hostRole.observe) throw new Error('host (no juega) debe tener observe=true');

  // Host se desconecta: el host pasa a P1 automáticamente (vía lobby:update)
  const hcP = waitFor(players[0], 'lobby:update', d => d.hostId === players[0].id);
  host.disconnect();
  await hcP;

  // P1 es ahora host, debe seguir siendo jugador (observe=false)
  if (p1Role.observe) throw new Error('jugador transferido a host no debe ser observer');
  console.log('OK: host transferido sigue viendo su palabra (no gestionando partida)');
  process.exit(0);
})().catch(e => { console.error('FALLO:', e.message); process.exit(1); });
