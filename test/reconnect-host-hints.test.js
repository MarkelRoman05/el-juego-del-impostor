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

async function createGame(impostorHint) {
  const host = await connect();
  const joinedPromise = once(host, 'room:joined');
  const created = await ack(host, 'room:create', { name: `Host-${impostorHint}` });
  check(created.ok === true, 'la sala se crea correctamente');
  const joined = await joinedPromise;
  const players = [{ socket: host, joined }];

  for (const name of ['P1', 'P2']) {
    const socket = await connect();
    const joinedPromiseForPlayer = once(socket, 'room:joined');
    const result = await ack(socket, 'room:join', {
      code: joined.room.code,
      name: `${name}-${impostorHint}`,
      playerId: null,
    });
    check(result.ok === true, `${name} se une correctamente`);
    players.push({ socket, joined: await joinedPromiseForPlayer });
  }

  await wait(100);
  const configured = await ack(host, 'config:set', {
    category: 'animales',
    impostors: 1,
    impostorHint,
    voting: false,
  });
  check(configured.ok === true, `configuración de pista ${impostorHint ? 'activada' : 'desactivada'}`);

  const rolesPromise = Promise.all(players.map(({ socket }) => once(socket, 'round:started')));
  const started = await ack(host, 'round:start');
  check(started.ok === true, 'la ronda comienza correctamente');
  const roles = await rolesPromise;

  return { host, joined, players, roles };
}

async function closeAll(sockets) {
  for (const socket of sockets) socket.disconnect();
  await wait(100);
}

(async () => {
  const hintGame = await createGame(true);
  const impostorRole = hintGame.roles.find((role) => role.role === 'impostor');
  check(Boolean(impostorRole), 'se asigna un impostor');
  check(impostorRole.category === 'Animales', 'el impostor recibe la pista correcta');
  check(!Object.hasOwn(impostorRole, 'word'), 'la pista no filtra la palabra');

  const oldHostId = hintGame.host.id;
  const reconnectToken = hintGame.joined.reconnectToken;
  hintGame.host.disconnect();
  await wait(300);

  const reconnectedHost = await connect();
  const rejoinedPromise = once(reconnectedHost, 'room:joined');
  const replayedRolePromise = once(reconnectedHost, 'round:started');
  const rejoined = await ack(reconnectedHost, 'room:join', {
    code: hintGame.joined.room.code,
    name: 'Host-true',
    playerId: oldHostId,
    reconnectToken,
  });
  check(rejoined.ok === true, 'el anfitrión se reconecta correctamente');
  const rejoinedRoom = await rejoinedPromise;
  check(rejoinedRoom.room.hostId === reconnectedHost.id, 'el anfitrión original conserva el hostId');
  const replayedRole = await replayedRolePromise;
  check(replayedRole.role === hintGame.roles[0].role, 'el rol se restaura al reconectar');
  if (replayedRole.role === 'impostor') {
    check(replayedRole.category === 'Animales', 'la pista se restaura al reconectar');
    check(!Object.hasOwn(replayedRole, 'word'), 'la reconexión no filtra la palabra');
  }

  await closeAll([...hintGame.players.map(({ socket }) => socket), reconnectedHost]);

  const noHintGame = await createGame(false);
  const noHintRole = noHintGame.roles.find((role) => role.role === 'impostor');
  check(noHintRole.category === '', 'sin pista el impostor recibe una categoría vacía');
  check(!Object.hasOwn(noHintRole, 'word'), 'sin pista tampoco se filtra la palabra');
  await closeAll(noHintGame.players.map(({ socket }) => socket));

  console.log('\n✅ TODO OK: reconexión y pistas verificadas');
})().catch((error) => {
  console.error(`\n❌ FALLO: ${error.message}`);
  process.exitCode = 1;
});
