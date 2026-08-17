'use strict';

const URL = process.env.URL || 'http://127.0.0.1:3111';
const { io } = require('socket.io-client');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const once = (socket, event, timeout = 5000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`timeout esperando ${event}`)), timeout);
  socket.once(event, (data) => { clearTimeout(timer); resolve(data); });
});
const ack = (socket, event, payload) => new Promise((resolve) => {
  const callback = (result) => resolve(result || {});
  socket.emit(event, payload, callback);
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
  await ack(host, 'room:create', { name: 'Host-A' });
  const joined = await joinedPromise;

  const b = await connect();
  const bJoinedPromise = once(b, 'room:joined');
  const bJoin = await ack(b, 'room:join', { code: joined.room.code, name: 'B', playerId: null });
  check(bJoin.ok === true, 'B se une');
  const bJoined = await bJoinedPromise;

  const changedPromise = once(b, 'host:changed');
  const transfer = await ack(host, 'lobby:setHost', { playerId: bJoined.me });
  check(transfer.ok === true, 'transferencia ok');
  const changed = await changedPromise;
  check(changed.name === 'B', `el toast de broadcast dice "${changed.name} es ahora el host de la sala"`);

  host.disconnect();
  b.disconnect();
  console.log('\n✅ TODO OK: broadcast host:changed');
})().catch((error) => {
  console.error(`\n❌ FALLO: ${error.message}`);
  process.exitCode = 1;
});
