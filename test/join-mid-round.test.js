'use strict';

/*
 * Unirse a una partida con la ronda en curso: el jugador entra como "esperando",
 * no juega esa ronda, ve el reveal al terminar y juega la siguiente.
 * Uso: URL=http://127.0.0.1:PORT node test/join-mid-round.test.js
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
const onceMatching = (socket, event, predicate, timeout = 5000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout esperando ${event}`)), timeout);
    const handler = (data) => {
      if (!predicate(data)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(data);
    };
    socket.on(event, handler);
  });
const expectNoEvent = (socket, event, ms = 500) =>
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
  check(p1Join.ok === true && p2Join.ok === true, 'se unen dos jugadores antes de la ronda');

  const cfg = await ack(host, 'config:set', { category: 'animales' });
  check(cfg.ok === true, 'config de categoría aplicada');

  const started = [once(host, 'round:started'), once(p1, 'round:started'), once(p2, 'round:started')];
  const startRes = await ack(host, 'round:start');
  check(startRes.ok === true, 'la ronda empieza');
  await Promise.all(started);

  /* 1. un nuevo jugador entra con la ronda en curso → pasa a espera */
  const late = await connect();
  const lateJoinedP = once(late, 'room:joined');
  const lateRes = await ack(late, 'room:join', { code, name: 'Tarde', playerId: null });
  check(lateRes.ok === true, `entrar con la ronda en curso es permitido: ${lateRes.error || ''}`);
  const lateJoined = await lateJoinedP;
  const lateMe = lateJoined.room.players.find((p) => p.id === lateJoined.me);
  check(lateJoined.room.phase === 'round', 'la sala sigue en round para el que espera');
  check(lateMe?.waiting === true, 'el que llega tarde queda marcado como esperando');

  /* 2. el resto lo ve esperando (lobby:update hacia el host) */
  const lateUpdate = await onceMatching(host, 'lobby:update', (data) =>
    data.players.some((p) => p.name === 'Tarde'));
  check(lateUpdate.players.find((p) => p.name === 'Tarde').waiting === true, 'el host ve al jugador como esperando');

  /* 3. el que espera no recibe rol de la ronda en curso */
  await expectNoEvent(late, 'round:started');
  await expectNoEvent(late, 'phase:changed');
  check(true, 'el que espera no recibe rol ni cambio de fase');

  /* 4. reconexión del que espera: sigue esperando, sin rol */
  const lateOldId = late.id;
  const lateToken = lateJoined.reconnectToken;
  late.disconnect();
  await wait(300);
  const lateRe = await connect();
  const lateReJoinedP = once(lateRe, 'room:joined');
  const lateReRes = await ack(lateRe, 'room:join', {
    code, name: 'Tarde', playerId: lateOldId, reconnectToken: lateToken,
  });
  check(lateReRes.ok === true, 'el que espera puede reconectarse');
  const lateReJoined = await lateReJoinedP;
  const lateReMe = lateReJoined.room.players.find((p) => p.id === lateReJoined.me);
  check(lateReMe?.waiting === true, 'sigue esperando tras reconectar');
  await expectNoEvent(lateRe, 'phase:changed');

  /* 5. al terminar la ronda, el que espera ve el reveal */
  const lateOverP = once(lateRe, 'game:over');
  const mark = await ack(host, 'impostor:mark');
  check(mark.ok === true, 'el host cierra la ronda');
  const over = await lateOverP;
  check(over.gameOver === true, 'el que esperaba recibe el reveal al terminar la ronda');

  /* 6. con el reveal abierto, otro jugador nuevo entra y ve el resultado */
  const late2 = await connect();
  const late2JoinedP = once(late2, 'room:joined');
  const late2OverP = once(late2, 'game:over');
  const late2Res = await ack(late2, 'room:join', { code, name: 'MuyTarde', playerId: null });
  check(late2Res.ok === true, `entrar con el reveal abierto es permitido: ${late2Res.error || ''}`);
  const late2Joined = await late2JoinedP;
  check(late2Joined.room.phase === 'gameover', 'el que entra en el reveal ve gameover');
  const late2Me = late2Joined.room.players.find((p) => p.id === late2Joined.me);
  check(late2Me?.waiting !== true, 'el que entra en el reveal no queda en espera');
  const late2Over = await late2OverP;
  check(late2Over.gameOver === true, 'el que entra en el reveal lo ve al momento');

  /* 7. siguiente ronda: el que esperaba ya juega */
  const next = await ack(host, 'round:next');
  check(next.ok === true, 'vuelta al lobby');
  const reStart = [once(host, 'round:started'), once(p1, 'round:started'), once(p2, 'round:started'), once(lateRe, 'round:started'), once(late2, 'round:started')];
  const start2 = await ack(host, 'round:start');
  check(start2.ok === true, 'la siguiente ronda empieza');
  const roles = await Promise.all(reStart);
  check(roles.some((r) => r.role === 'player'), 'todos reciben rol en la siguiente ronda');

  for (const s of [host, p1, p2, late2]) s.disconnect();
  console.log('\n✅ TODO OK: unión con ronda en curso verificada');
})().catch((error) => {
  console.error(`\n❌ FALLO: ${error.message}`);
  process.exitCode = 1;
});
