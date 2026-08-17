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

async function createRoom() {
  const host = await connect();
  const joinedPromise = once(host, 'room:joined');
  await ack(host, 'room:create', { name: 'Host-A' });
  const joined = await joinedPromise;

  const players = [];
  for (const name of ['B', 'C']) {
    const socket = await connect();
    const jp = once(socket, 'room:joined');
    const res = await ack(socket, 'room:join', { code: joined.room.code, name, playerId: null });
    check(res.ok === true, `${name} se une`);
    players.push({ socket, joined: await jp });
  }
  await wait(100);
  return { host, hostJoined: joined, players };
}

(async () => {
  const { host, hostJoined, players } = await createRoom();
  const b = players[0];
  const c = players[1];

  // Escuchar lobby:update para inspeccionar hostId
  let lastRoom = null;
  const track = (s) => s.on('lobby:update', (room) => { lastRoom = room; });
  track(host);
  track(b.socket);

  const code = hostJoined.room.code;
  const oldHostId = hostJoined.me;

  // 1. El host transfiere el host a B
  const transfer = await ack(host, 'lobby:setHost', { playerId: b.joined.me });
  check(transfer.ok === true, 'lobby:setHost devuelve ok');
  await wait(100);
  check(lastRoom && lastRoom.hostId === b.joined.me, 'B es el nuevo host tras la transferencia');

  // 2. B (nuevo host) tiene permisos de host; A (viejo host) los pierde
  const bConfig = await ack(b.socket, 'config:set', { category: 'animales' });
  check(bConfig.ok === true, 'el nuevo host puede configurar la sala');
  const aConfig = await ack(host, 'config:set', { category: 'animales' });
  check(aConfig.error !== undefined, 'el viejo host ya no puede configurar la sala');

  // 3. B se desconecta y reconecta: debe recuperar el host
  const bToken = b.joined.reconnectToken;
  b.socket.disconnect();
  await wait(300);
  const bRe = await connect();
  const bReJoinedPromise = once(bRe, 'room:joined');
  const bReJoined = await ack(bRe, 'room:join', {
    code, name: 'B', playerId: b.joined.me, reconnectToken: bToken,
  });
  check(bReJoined.ok === true, 'B se reconecta correctamente');
  await bReJoinedPromise;
  await wait(100);
  check(lastRoom && lastRoom.hostId === bRe.id, 'B recupera el host al reconectar');

  // 4. El viejo host A se reconecta: NO debe apropiarse del host
  const aToken = hostJoined.reconnectToken;
  const aRe = await connect();
  const aReJoinedPromise = once(aRe, 'room:joined');
  const aReJoined = await ack(aRe, 'room:join', {
    code, name: 'Host-A', playerId: oldHostId, reconnectToken: aToken,
  });
  check(aReJoined.ok === true, 'A (viejo host) se reconecta correctamente');
  await aReJoinedPromise;
  await wait(100);
  check(lastRoom && lastRoom.hostId === bRe.id, 'A reconectado no roba el host; sigue siendo B');

  host.disconnect();
  bRe.disconnect();
  aRe.disconnect();
  c.socket.disconnect();
  console.log('\n✅ TODO OK: transferencia de host y persistencia en reconexión');
})().catch((error) => {
  console.error(`\n❌ FALLO: ${error.message}`);
  process.exitCode = 1;
});
