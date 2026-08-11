'use strict';

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
  await ack(host, 'room:create', { name: 'Host vacío' });
  const joined = await joinedPromise;
  const players = [host];

  for (const name of ['P1 vacío', 'P2 vacío']) {
    const socket = await connect();
    const playerJoined = once(socket, 'room:joined');
    const result = await ack(socket, 'room:join', {
      code: joined.room.code,
      name,
      playerId: null,
    });
    check(result.ok === true, `${name} se une correctamente`);
    await playerJoined;
    players.push(socket);
  }

  const sessions = players.map((socket) => ({
    playerId: socket.id,
    reconnectToken: socket === host ? joined.reconnectToken : null,
  }));
  for (const socket of players) socket.disconnect();
  await wait(300);

  const probe = await connect();
  const result = await ack(probe, 'room:join', {
    code: joined.room.code,
    name: 'recovery-probe',
    playerId: sessions[0].playerId,
    reconnectToken: sessions[0].reconnectToken,
  });
  check(result.ok !== true && /Código no encontrado/.test(result.error || ''), 'la sala se elimina al quedar vacía');
  probe.disconnect();
  console.log('\n✅ TODO OK: las salas vacías terminan automáticamente');
})().catch((error) => {
  console.error(`\n❌ FALLO: ${error.message}`);
  process.exitCode = 1;
});
