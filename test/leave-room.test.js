'use strict';

/*
 * Salirse de una partida en curso y NO volver a ser arrastrado cuando el resto
 * empieza la siguiente ronda (el socket salía de la sala de socket.io).
 * Uso: URL=http://127.0.0.1:PORT node test/leave-room.test.js
 */

const URL = process.env.URL || 'http://127.0.0.1:3111';
const { io } = require('socket.io-client');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const once = (socket, event, timeout = 5000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`timeout esperando ${event}`)), timeout);
  socket.once(event, (data) => {
    clearTimeout(timer);
    resolve(data);
  });
});
const expectNoEvent = (socket, event, ms = 700) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(event, handler); resolve(); }, ms);
    const handler = () => { clearTimeout(timer); reject(new Error(`no debería llegar ${event}`)); };
    socket.once(event, handler);
  });
const ack = (socket, event, payload) => new Promise((resolve) => {
  const callback = (result) => resolve(result || {});
  if (typeof payload === 'undefined') socket.emit(event, callback);
  else socket.emit(event, payload, callback);
});
const connect = async () => {
  const socket = io(URL, { transports: ['websocket'], reconnection: false, forceNew: true });
  await once(socket, 'connect');
  return socket;
};
const check = (condition, message) => {
  if (!condition) throw new Error(message);
  console.log(`✅ ${message}`);
};

(async () => {
  const host = await connect();
  const joinedPromise = once(host, 'room:joined');
  const created = await ack(host, 'room:create', { name: 'Host' });
  check(created.ok === true, 'la sala se crea');
  const joined = await joinedPromise;
  const code = joined.room.code;

  const p1 = await connect();
  const p2 = await connect();
  const p1Join = await ack(p1, 'room:join', { code, name: 'P1', playerId: null });
  const p2Join = await ack(p2, 'room:join', { code, name: 'P2', playerId: null });
  check(p1Join.ok === true && p2Join.ok === true, 'p1 y p2 entran antes de la ronda');

  const cfg = await ack(host, 'config:set', { category: 'animales' });
  check(cfg.ok === true, 'categoría configurada');

  const started = [once(host, 'round:started'), once(p1, 'round:started'), once(p2, 'round:started')];
  const startRes = await ack(host, 'round:start');
  check(startRes.ok === true, 'la ronda empieza');
  await Promise.all(started);

  /* 1. p1 sale a mitad de ronda y recibe game:ended */
  const p1Ended = once(p1, 'game:ended');
  const leaveRes = await ack(p1, 'round:leave');
  check(leaveRes.ok === true, 'round:leave ok');
  await p1Ended;
  check(true, 'p1 recibe game:ended al salirse');

  /* 2. el host pasa a la siguiente ronda */
  const next = await ack(host, 'round:next');
  check(next.ok === true, 'round:next ok');
  const reStart = [once(host, 'round:started'), once(p2, 'round:started')];
  const start2 = await ack(host, 'round:start');
  check(start2.ok === true, 'la siguiente ronda empieza');
  await Promise.all(reStart);

  /* 3. p1 ya no recibe nada de la sala: ni fase ni rol */
  await expectNoEvent(p1, 'phase:changed');
  await expectNoEvent(p1, 'round:started');
  await expectNoEvent(p1, 'lobby:update');
  check(true, 'quien se fue no vuelve a ser metido en la partida');

  for (const s of [host, p2]) s.disconnect();
  console.log('\n✅ TODO OK: salirse de la partida no vuelve a arrastrar al jugador');
})().catch((error) => {
  console.error(`\n❌ FALLO: ${error.message}`);
  process.exitCode = 1;
});
