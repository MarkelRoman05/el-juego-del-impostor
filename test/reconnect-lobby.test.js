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
  const created = await ack(host, 'room:create', { name: 'Lobby-host' });
  check(created.ok === true, 'la sala se crea en el lobby');
  const joined = await joinedPromise;
  const oldPlayerId = host.id;
  const reconnectToken = joined.reconnectToken;

  host.disconnect();
  await wait(300);

  const replacement = await connect();
  const rejoinedPromise = once(replacement, 'room:joined');
  const result = await ack(replacement, 'room:join', {
    code: joined.room.code,
    name: 'Lobby-host',
    playerId: oldPlayerId,
    reconnectToken,
  });
  check(result.ok === true, 'el host puede reconectar desde el lobby');
  const rejoined = await rejoinedPromise;
  check(rejoined.room.hostId === replacement.id, 'el host conserva el control en el lobby');
  check(rejoined.room.phase === 'lobby', 'la sala sigue en lobby tras reconectar');

  replacement.disconnect();
  console.log('\n✅ TODO OK: reconexión del host en creación de sala verificada');
})().catch((error) => {
  console.error(`\n❌ FALLO: ${error.message}`);
  process.exitCode = 1;
});
