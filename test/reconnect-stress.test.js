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
  const hostJoinedPromise = once(host, 'room:joined');
  await ack(host, 'room:create', { name: 'Stress-host' });
  const hostJoined = await hostJoinedPromise;
  const code = hostJoined.room.code;

  let p1 = await connect();
  const p1JoinedPromise = once(p1, 'room:joined');
  await ack(p1, 'room:join', { code, name: 'Stress-p1', playerId: null });
  const p1Joined = await p1JoinedPromise;

  const p2 = await connect();
  const p2JoinedPromise = once(p2, 'room:joined');
  await ack(p2, 'room:join', { code, name: 'Stress-p2', playerId: null });
  await p2JoinedPromise;

  await ack(host, 'config:set', { category: 'animales', voting: false });
  const firstRoles = Promise.all([once(host, 'round:started'), once(p1, 'round:started'), once(p2, 'round:started')]);
  await ack(host, 'round:start');
  const roles = await firstRoles;
  const expectedRole = roles[1];
  const token = p1Joined.reconnectToken;
  let playerId = p1.id;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    p1.disconnect();
    await wait(200);
    const replacement = await connect();
    const joinedPromise = once(replacement, 'room:joined');
    const rolePromise = once(replacement, 'round:started');
    const result = await ack(replacement, 'room:join', {
      code,
      name: 'Stress-p1',
      playerId,
      reconnectToken: token,
    });
    check(result.ok === true, `reconexión ${attempt}/5 aceptada`);
    const joined = await joinedPromise;
    const role = await rolePromise;
    check(joined.me === replacement.id, `reconexión ${attempt}/5 actualiza el socket`);
    check(role.role === expectedRole.role && role.round === expectedRole.round, `reconexión ${attempt}/5 restaura el rol`);
    playerId = replacement.id;
    p1 = replacement;
  }

  host.disconnect();
  p1.disconnect();
  p2.disconnect();
  console.log('\n✅ TODO OK: reconexiones repetidas verificadas');
})().catch((error) => {
  console.error(`\n❌ FALLO: ${error.message}`);
  process.exitCode = 1;
});
