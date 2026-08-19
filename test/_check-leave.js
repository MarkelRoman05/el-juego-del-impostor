const URL = process.env.URL || 'http://127.0.0.1:3126';
const { io } = require('socket.io-client');
const once = (s, e, t = 5000) => new Promise((res, rej) => { const to = setTimeout(() => rej(new Error('timeout ' + e)), t); s.once(e, d => { clearTimeout(to); res(d); }); });
const ack = (s, e, p) => new Promise(r => { const c = x => r(x || {}); typeof p === 'undefined' ? s.emit(e, c) : s.emit(e, p, c); });
const connect = async () => { const s = io(URL, { transports: ['websocket'], reconnection: false, forceNew: true }); await once(s, 'connect'); return s; };
(async () => {
  const h = await connect();
  const j = await once(h, 'room:joined');
  await ack(h, 'room:create', { name: 'H' });
  const p1 = await connect();
  await ack(p1, 'room:join', { code: j.room.code, name: 'P1' });
  const upd = once(h, 'lobby:update');
  await ack(p1, 'lobby:leave');
  const u = await upd;
  const stillThere = u.room.players.some(pl => pl.name === 'P1');
  console.log(stillThere ? 'P1 sigue en la sala (standby)' : 'P1 eliminado del todo de la sala');
  process.exitCode = stillThere ? 1 : 0;
})().catch(e => { console.error('ERR', e.message); process.exitCode = 1; });
