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

// Escenario del usuario: el host empieza la ronda y todos apagan los móviles.
// Al volver, el primero en entrar (el host, si perdió el token de reconexión en
// sesión móvil) entra como jugador nuevo. La ronda NO debe volver sola al lobby.
(async () => {
  const host = await connect();
  const joinedPromise = once(host, 'room:joined');
  const created = await ack(host, 'room:create', { name: 'Anfitrión' });
  check(created.ok === true, 'la sala se crea en el lobby');
  const joined = await joinedPromise;
  const code = joined.room.code;

  const p1 = await connect();
  check((await ack(p1, 'room:join', { code, name: 'Uno' })).ok === true, 'jugador 1 entra');
  const p2 = await connect();
  check((await ack(p2, 'room:join', { code, name: 'Dos' })).ok === true, 'jugador 2 entra');

  check((await ack(host, 'config:set', { category: 'animales' })).ok === true, 'se elige categoría');
  const roundState = once(host, 'round:started');
  check((await ack(host, 'round:start')).ok === true, 'el host arranca la ronda');
  await roundState;

  // Móviles apagados: todos se desconectan.
  host.disconnect();
  p1.disconnect();
  p2.disconnect();
  await wait(300);

  // Al volver, entra un jugador nuevo mientras la sala está huérfana.
  const late = await connect();
  const lateJoinedPromise = once(late, 'room:joined');
  const lateResult = await ack(late, 'room:join', { code, name: 'Tardío' });
  check(lateResult.ok === true, 'un jugador nuevo entra en la sala huérfana sin error');
  const lateJoined = await lateJoinedPromise;

  check(lateJoined.room.phase === 'round', 'la ronda se conserva (sigue en round, no en lobby)');
  check(lateJoined.room.word === undefined, 'el jugador nuevo no recibe la palabra de la ronda');

  late.disconnect();
  console.log('\n✅ TODO OK: la ronda no se resetea al lobby cuando el host se desconecta');
  process.exit(0);
})().catch((error) => {
  console.error(`\n❌ FALLO: ${error.message}`);
  process.exit(1);
});
