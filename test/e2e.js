'use strict';

/*
 * Test E2E del servidor de "El Impostor".
 *
 * Uso:
 *   node e2e.js                    → ejecuta el test completo autónomo
 *   node e2e.js <CODIGO> <nombre>  → modo bot: se une a la sala y se queda conectado
 *
 * Variables de entorno:
 *   URL   → base del servidor (default http://127.0.0.1:3111)
 */

const URL = process.env.URL || 'http://127.0.0.1:3111';
const { io } = require('socket.io-client');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const onEvent = (socket, event, timeout = 5000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout esperando '${event}'`)), timeout);
    socket.once(event, (data) => { clearTimeout(t); resolve(data); });
  });
const onEventMatching = (socket, event, predicate, timeout = 5000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout esperando '${event}'`)), timeout);
    const handler = (data) => {
      if (!predicate(data)) return;
      clearTimeout(t);
      socket.off(event, handler);
      resolve(data);
    };
    socket.on(event, handler);
  });

function client(name) {
  const s = io(URL, { transports: ['websocket'], reconnection: false, forceNew: true });
  s.on('connect_error', (e) => { throw new Error(`${name} connect_error: ${e.message}`); });
  return s;
}

const emitAck = (s, ev, payload, sendPayload = false) =>
  new Promise((resolve) => {
    const cb = (res) => resolve(res || {});
    if (sendPayload) s.emit(ev, payload, cb);
    else s.emit(ev, cb);
  });
const emitAckP = (s, ev, payload) => emitAck(s, ev, payload, true);

async function main() {
  const botCode = process.argv[2];
  const botName = process.argv[3];

  if (botCode && botName) {
    const s = client(botName);
    s.emit('room:join', { code: botCode, name: botName, playerId: null }, (res) => {
      if (res && res.error) { console.error(`[bot ${botName}] ERROR: ${res.error}`); process.exit(1); }
      console.log(`[bot ${botName}] dentro de ${botCode}`);
    });
    s.on('kicked', () => { console.log(`[bot ${botName}] expulsado`); process.exit(0); });
    s.on('disconnect', () => { console.log(`[bot ${botName}] desconectado`); process.exit(0); });
    setInterval(() => {}, 1 << 30); // se queda vivo
    return;
  }

  /* ---------- TEST COMPLETO ---------- */
  const results = [];
  const check = (label, ok, extra = '') => {
    results.push([label, ok]);
    console.log(`${ok ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`);
    if (!ok) process.exitCode = 1;
  };

  console.log(`→ Conectando a ${URL}`);
  const host = client('host');
  await onEvent(host, 'connect');
  const p1 = client('p1');
  await onEvent(p1, 'connect');
  const p2 = client('p2');
  await onEvent(p2, 'connect');

  /* 1. crear sala */
  const joinedP = onEvent(host, 'room:joined');
  let res = await emitAckP(host, 'room:create', { name: 'Anfitrión' });
  check('room:create ok', res.ok === true, JSON.stringify(res));
  const joined = await joinedP;
  const code = joined.room.code;
  check('código de 4 caracteres', /^[A-Z0-9]{4}$/.test(code), code);
  const hostId = joined.room.players.find((p) => p.name === 'Anfitrión').id;

  /* 2. unirse (esperamos lobby:update tras cada join) */
  const p1JoinedP = onEvent(p1, 'room:joined');
  const lu1P = onEventMatching(host, 'lobby:update', (data) => data.players?.length === 2);
  res = await emitAckP(p1, 'room:join', { code, name: 'Jugador 1', playerId: null });
  check('join p1 ok', res.ok === true, JSON.stringify(res));
  const p1Joined = await p1JoinedP;
  const lu1 = await lu1P;
  check('lobby 2 jugadores', lu1.players.length === 2);

  const lu2P = onEventMatching(host, 'lobby:update', (data) => data.players?.length === 3);
  res = await emitAckP(p2, 'room:join', { code, name: 'Jugador 2', playerId: null });
  check('join p2 ok', res.ok === true, JSON.stringify(res));
  const lu2 = await lu2P;
  check('lobby 3 jugadores', lu2.players.length === 3);
  const p1Id = lu2.players.find((p) => p.name === 'Jugador 1').id;
  const p2Id = lu2.players.find((p) => p.name === 'Jugador 2').id;

  res = await emitAckP(p2, 'room:join', { code, name: 'jugador 1', playerId: null });
  check('nombre duplicado rechazado', !res.ok && !!res.error, JSON.stringify(res));

  /* 3. config: 2 impostores + palabras personalizadas + sin temporizador */
  res = await emitAckP(host, 'config:set', { impostors: 2, category: 'animales', customWords: 'volcán\ncascada\narcoíris', timer: 0, voting: true, impostorHint: true });
  check('config:set ok', res.ok === true, JSON.stringify(res));

  /* 4. empezar ronda — waiters ANTES del disparo */
  const rStarted = [onEvent(host, 'round:started'), onEvent(p1, 'round:started'), onEvent(p2, 'round:started')];
  const phaseRoundP = onEvent(host, 'phase:changed');
  res = await emitAck(host, 'round:start');
  check('round:start ok', res.ok === true, JSON.stringify(res));
  const roles = (await Promise.all(rStarted)).map((p, i) => ({ label: ['host', 'p1', 'p2'][i], ...p }));
  const phaseChanged = await phaseRoundP;
  check('phase:changed a round', phaseChanged.phase === 'round');
  check('sin palabra en phase:changed', !JSON.stringify(phaseChanged).includes('volcán'));
  for (const r of roles) console.log(`   ${r.label}: role=${r.role} round=${r.round}`);

  const impostors = roles.filter((r) => r.role === 'impostor');
  const players = roles.filter((r) => r.role === 'player');
  const theWord = players[0]?.word;
  check('exactamente 2 impostores', impostors.length === 2, `impostores: ${impostors.map((i) => i.label).join(', ')}`);
  check('los impostores no reciben la palabra', impostors.every((i) => !i.word));
  check('el jugador recibe una palabra de la lista', ['volcán', 'cascada', 'arcoíris'].includes(theWord), theWord || '?');
  check('los impostores reciben la categoría', impostors.every((i) => i.category === 'Palabras personalizadas'));

   /* 5. el host finaliza directamente, sin votación */
   const revealP = onEvent(host, 'game:over');
   res = await emitAck(host, 'impostor:mark');
   check('impostor encontrado → fin de partida', res.ok === true);
   const reveal = await revealP;
   check('reveal: 2 impostores con nombre', reveal.impostors.length === 2 && reveal.impostors.every((i) => i.name), reveal.impostors.map((i) => i.name).join(', '));
   check('reveal: palabra coincide', reveal.word === theWord);

   /* 6. siguiente partida */
  const backP = onEvent(host, 'phase:changed');
  res = await emitAck(host, 'round:next');
  check('round:next ok', res.ok === true);
  const back = await backP;
  check('vuelta al lobby', back.phase === 'lobby');

  /* 9. reconexión: p1 "recarga" la página (cierra el socket viejo y abre uno nuevo con el mismo playerId) */
  const p1OldId = p1.id; // ¡capturar ANTES de cerrar! (socket.io borra .id al desconectar)
  p1.close();
  await wait(400); // el servidor marca a p1 como desconectado
  const p1b = client('p1-re');
  await onEvent(p1b, 'connect');
  res = await emitAckP(p1b, 'room:join', { code, name: 'Jugador 1', playerId: p1OldId, reconnectToken: p1Joined.reconnectToken });
  check('reconexión ok', res.ok === true, JSON.stringify(res));
  const reJoined = await onEvent(p1b, 'room:joined');
  check('playerId actualizado en reconexión', reJoined.me === p1b.id);
  check('sin duplicados tras reconexión', reJoined.room.players.filter((p) => p.name === 'Jugador 1').length === 1);

  /* 10. host abandona → se transfiere el mando a un jugador conectado (waiter ANTES del close) */
  const lobbyAfterP = onEventMatching(p1b, 'lobby:update', (data) => data.hostId !== hostId);
  host.close();
  const lobbyAfter = await lobbyAfterP;
  check(
    'host transferido a un jugador conectado',
    lobbyAfter.hostId !== hostId && lobbyAfter.players.some((p) => p.id === lobbyAfter.hostId && p.connected),
    `nuevo host: ${lobbyAfter.players.find((p) => p.id === lobbyAfter.hostId)?.name || '?'}`
  );
  const newHostId = lobbyAfter.hostId;

  /* 11. un no-host no puede empezar la ronda */
  res = await emitAck(p1b, 'round:start');
  check('no-host no puede empezar', !res.ok && res.error === 'Solo el anfitrión puede empezar', JSON.stringify(res));

  console.log('\nResumen:');
  const okCount = results.filter(([, ok]) => ok).length;
  console.log(`${okCount}/${results.length} comprobaciones OK`);
  process.exit(okCount === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error('❌ FALLO:', e.message);
  process.exit(1);
});
