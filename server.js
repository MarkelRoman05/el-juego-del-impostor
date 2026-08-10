'use strict';

const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { CATEGORIES } = require('./words');

const PORT = Number(process.env.PORT) || 3111;
const MIN_PLAYERS = 3;
const MAX_IMPOSTORS = 3;
const MAX_PLAYERS = 20;
const VOTE_TIME_MS = 60_000;
const ROOM_MAX_AGE_MS = 2 * 60 * 60 * 1000;   // una sala vive 2h desde la última actividad
const EMPTY_ROOM_TTL_MS = 10 * 60 * 1000;     // y se borra 10min después de quedarse vacía
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  pingInterval: 25000,
  pingTimeout: 20000,
  maxHttpBufferSize: 128 * 1024,
});

app.disable('x-powered-by');
app.use(express.static(path.join(__dirname, 'dist', 'el-impostor', 'browser'), { maxAge: '1h' }));
app.get('/healthz', (_req, res) => res.json({ ok: true, uptime: Math.round(process.uptime()) }));

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
const sanitizeName = (raw) => {
  if (typeof raw !== 'string') return null;
  const name = raw.trim().replace(/\s+/g, ' ').slice(0, 20);
  return name.length >= 1 ? name : null;
};
const normalizeCode = (raw) => (typeof raw === 'string' ? raw.trim().toUpperCase().slice(0, 4) : '');
const parseCustomWords = (raw) => {
  if (typeof raw !== 'string') return [];
  return [...new Set(
    raw.split(/[\n,;]+/).map((w) => w.trim()).filter((w) => w.length >= 2 && w.length <= 40)
  )].slice(0, 200);
};

function genCode() {
  for (let i = 0; i < 50; i++) {
    let code = '';
    for (let j = 0; j < 4; j++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    if (!rooms.has(code)) return code;
  }
  return String(Date.now()).slice(-4);
}

/* ------------------------------------------------------------------ */
/* estado de las salas                                                 */
/* ------------------------------------------------------------------ */

const rooms = new Map(); // code -> room

function createRoom(hostId, hostName) {
  const code = genCode();
  const room = {
    code,
    hostId,
    phase: 'lobby',           // lobby | round | voting | reveal
    round: 0,
    players: new Map(),       // id -> { id, name, connected }
    config: { impostors: 1, category: 'animales', customWords: '', timer: 0, voting: true, impostorHint: false },
    word: null,
    categoryLabel: null,
    impostorIds: null,        // Set<id>
    roleByPlayer: new Map(),  // id -> payload privado de la ronda (para reconexiones)
    usedWords: [],
    votes: new Map(),         // voterId -> targetId
    ballots: null,
    revealData: null,
    startedAt: 0,
    votingDeadlineAt: 0,
    advanceTimer: null,
    lastActivity: Date.now(),
  };
  room.players.set(hostId, { id: hostId, name: hostName, connected: true });
  rooms.set(code, room);
  scheduleRoomCleanup(room);
  return room;
}

function scheduleRoomCleanup(room) {
  setTimeout(() => {
    if (!rooms.has(room.code)) return;
    const age = Date.now() - room.lastActivity;
    const anyConnected = [...room.players.values()].some((p) => p.connected);
    if ((!anyConnected && age > EMPTY_ROOM_TTL_MS) || age > ROOM_MAX_AGE_MS) {
      rooms.delete(room.code);
    } else {
      scheduleRoomCleanup(room);
    }
  }, Math.min(EMPTY_ROOM_TTL_MS, 60_000));
}

function serializeRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    round: room.round,
    config: {
      impostors: room.config.impostors,
      category: room.config.category,
      timer: room.config.timer,
      voting: room.config.voting,
      impostorHint: room.config.impostorHint,
      // Privacidad: las palabras personalizadas NUNCA se serializan; solo su número
      customWordsCount: parseCustomWords(room.config.customWords).length,
    },
    players: [...room.players.values()].map((p) => ({ id: p.id, name: p.name, connected: p.connected })),
  };
}

function getWordPool(room) {
  const custom = parseCustomWords(room.config.customWords);
  if (custom.length) return custom;
  const cat = CATEGORIES[room.config.category];
  return cat ? cat.words : CATEGORIES.animales.words;
}

function pickWord(room) {
  const pool = getWordPool(room);
  const fresh = pool.filter((w) => !room.usedWords.includes(w));
  const candidates = fresh.length ? fresh : pool;
  const word = candidates[Math.floor(Math.random() * candidates.length)];
  room.usedWords.push(word);
  if (room.usedWords.length > 500) room.usedWords = room.usedWords.slice(-250);
  return word;
}

/* ------------------------------------------------------------------ */
/* flujo de la ronda                                                   */
/* ------------------------------------------------------------------ */

function broadcastLobby(room) {
  io.to(room.code).emit('lobby:update', serializeRoom(room));
}

function setPhase(room, phase, extra = {}) {
  room.phase = phase;
  room.lastActivity = Date.now();
  io.to(room.code).emit('phase:changed', { phase, ...extra });
}

function clearAdvance(room) {
  if (room.advanceTimer) {
    clearTimeout(room.advanceTimer);
    room.advanceTimer = null;
  }
}

function scheduleAdvance(room, ms, fn) {
  clearAdvance(room);
  room.advanceTimer = setTimeout(() => {
    room.advanceTimer = null;
    fn();
  }, ms);
}

function startRound(room) {
  const connected = [...room.players.values()].filter((p) => p.connected);
  const impostors = clamp(room.config.impostors, 1, Math.min(MAX_IMPOSTORS, connected.length - 1));
  const word = pickWord(room);
  const categoryLabel = parseCustomWords(room.config.customWords).length
    ? 'Palabras personalizadas'
    : (CATEGORIES[room.config.category]?.label ?? 'Mezcla');

  const ids = shuffle(connected.map((p) => p.id));
  const impostorIds = new Set(ids.slice(0, impostors));

  room.round += 1;
  room.word = word;
  room.categoryLabel = categoryLabel;
  room.impostorIds = impostorIds;
  room.votes = new Map();
  room.ballots = null;
  room.revealData = null;
  room.roleByPlayer = new Map();
  room.startedAt = Date.now();
  room.votingDeadlineAt = 0;

  // Entrega privada: cada jugador recibe SOLO su rol
  for (const p of connected) {
    const payload = impostorIds.has(p.id)
      ? { role: 'impostor', category: room.config.impostorHint ? categoryLabel : '', round: room.round, timer: 0 }
      : { role: 'player', word, category: categoryLabel, round: room.round, timer: 0 };
    room.roleByPlayer.set(p.id, payload);
    const sock = io.sockets.sockets.get(p.id);
    if (sock) sock.emit('round:started', payload);
  }

  setPhase(room, 'round', { startedAt: room.startedAt });
}

function expectedVoters(room) {
  return [...room.players.values()].filter((p) => p.connected).length;
}

function checkVotes(room) {
  if (room.phase !== 'voting') return;
  if (room.votes.size >= expectedVoters(room)) doReveal(room);
}

function doReveal(room) {
  clearAdvance(room);
  if (room.phase === 'reveal') return;

  const playersById = Object.fromEntries([...room.players.entries()]);
  const impostors = [...(room.impostorIds || [])].map((id) => ({ id, name: playersById[id]?.name ?? '?' }));
  const tally = new Map();
  const ballots = [];
  for (const [from, to] of room.votes) {
    tally.set(to, (tally.get(to) || 0) + 1);
    ballots.push({ from, to });
  }
  const votes = [...tally.entries()]
    .map(([id, count]) => ({ id, name: playersById[id]?.name ?? '?', count }))
    .sort((a, b) => b.count - a.count);

  room.ballots = ballots;
  room.revealData = { impostors, votes, ballots, word: room.word, category: room.categoryLabel, round: room.round };
  setPhase(room, 'reveal');
  io.to(room.code).emit('round:reveal', room.revealData);
}

function resetToLobby(room) {
  clearAdvance(room);
  room.phase = 'lobby';
  room.word = null;
  room.categoryLabel = null;
  room.impostorIds = null;
  room.roleByPlayer = new Map();
  room.votes = new Map();
  room.ballots = null;
  room.revealData = null;
  room.votingDeadlineAt = 0;
  broadcastLobby(room);
  io.to(room.code).emit('phase:changed', { phase: 'lobby' });
}

function endRoom(room) {
  clearAdvance(room);
  io.to(room.code).emit('game:ended');
  for (const playerSocket of io.sockets.sockets.values()) {
    if (playerSocket.data.roomCode !== room.code) continue;
    playerSocket.data.roomCode = null;
    playerSocket.data.playerId = null;
    playerSocket.leave(room.code);
  }
  rooms.delete(room.code);
}

/* ------------------------------------------------------------------ */
/* socket.io                                                           */
/* ------------------------------------------------------------------ */

const getRoomOf = (socket) => {
  const code = socket.data.roomCode;
  return code ? rooms.get(code) || null : null;
};
const isHost = (socket, room) => Boolean(room) && room.hostId === socket.data.playerId;
const ackOk = (ack) => { if (typeof ack === 'function') ack({ ok: true }); };
const ackErr = (ack, error) => { if (typeof ack === 'function') ack({ error }); };

io.on('connection', (socket) => {
  socket.data.roomCode = null;
  socket.data.playerId = null;

  function remapIds(room, oldId, newId) {
    if (room.hostId === oldId) room.hostId = newId;
    if (room.impostorIds && room.impostorIds.has(oldId)) {
      room.impostorIds.delete(oldId);
      room.impostorIds.add(newId);
    }
    const role = room.roleByPlayer.get(oldId);
    if (role) {
      room.roleByPlayer.delete(oldId);
      room.roleByPlayer.set(newId, role);
    }
    const newVotes = new Map();
    for (const [k, v] of room.votes) {
      newVotes.set(k === oldId ? newId : k, v === oldId ? newId : v);
    }
    room.votes = newVotes;
  }

  function replayRoundState(room, sock) {
    const pid = sock.data.playerId;
    if (room.phase === 'round') {
      const role = room.roleByPlayer.get(pid);
      if (role) sock.emit('round:started', role);
    } else if (room.phase === 'voting') {
      const role = room.roleByPlayer.get(pid);
      if (role) sock.emit('round:started', role);
      sock.emit('phase:changed', { phase: 'voting', deadlineAt: room.votingDeadlineAt });
    } else if (room.phase === 'reveal' && room.revealData) {
      sock.emit('round:reveal', room.revealData);
    }
  }

  function leaveRoom() {
    const room = getRoomOf(socket);
    const pid = socket.data.playerId;
    socket.data.roomCode = null;
    socket.data.playerId = null;
    if (!room || !pid) return;
    const p = room.players.get(pid);
    if (p) {
      p.connected = false;
      if (room.hostId === pid) {
        const next = [...room.players.values()].find((x) => x.connected);
        room.hostId = next ? next.id : null;
      }
      room.lastActivity = Date.now();
      broadcastLobby(room);
      if (room.phase === 'voting') checkVotes(room);
    }
  }

  /* ---- creación y unión ---- */

  socket.on('room:create', ({ name, customWords } = {}, ack) => {
    const clean = sanitizeName(name);
    if (!clean) return ackErr(ack, 'Escribe un nombre (1-20 caracteres)');
    const room = createRoom(socket.id, clean);
    // Palabras preparadas en privado ANTES de crear la partida (pantalla de inicio)
    if (typeof customWords === 'string' && customWords.trim()) {
      room.config.customWords = customWords.slice(0, 2000);
    }
    socket.data.roomCode = room.code;
    socket.data.playerId = socket.id;
    socket.join(room.code);
    ackOk(ack);
    socket.emit('room:joined', { room: serializeRoom(room), me: socket.id });
    broadcastLobby(room);
  });

  socket.on('room:join', ({ code, name, playerId, customWords } = {}, ack) => {
    const room = rooms.get(normalizeCode(code));
    const clean = sanitizeName(name);
    if (!room) return ackErr(ack, 'Código no encontrado. ¿Seguro que es correcto?');
    if (!clean) return ackErr(ack, 'Escribe un nombre (1-20 caracteres)');

    // Mezcla en privado las palabras del jugador (preparadas antes de la partida).
    // La lista NUNCA se serializa a los clientes: solo cuenta para el sorteo.
    const mergeWords = () => {
      if (typeof customWords !== 'string' || !customWords.trim()) return;
      const merged = parseCustomWords(room.config.customWords + '\n' + customWords);
      room.config.customWords = merged.join('\n');
    };

    // Reconexión del mismo jugador (recarga de página / caída de red)
    if (playerId && room.players.has(playerId)) {
      const p = room.players.get(playerId);
      const taken = [...room.players.values()].some(
        (x) => x.id !== playerId && x.name.toLowerCase() === clean.toLowerCase()
      );
      if (taken) return ackErr(ack, 'Ese nombre ya está en la partida');

      // expulsar el socket antiguo para no dejar jugadores fantasma
      const oldSock = io.sockets.sockets.get(playerId);
      if (oldSock && oldSock.id !== socket.id) {
        oldSock.emit('session:replaced');
        oldSock.leave(room.code);
        oldSock.data.roomCode = null;
        oldSock.data.playerId = null;
      }

      p.name = clean;
      p.connected = true;
      room.players.delete(playerId);
      room.players.set(socket.id, p);
      remapIds(room, playerId, socket.id);
      mergeWords();
      socket.data.roomCode = room.code;
      socket.data.playerId = socket.id;
      socket.join(room.code);
      ackOk(ack);
      socket.emit('room:joined', { room: serializeRoom(room), me: socket.id });
      broadcastLobby(room);
      replayRoundState(room, socket);
      return;
    }

    // Nuevos jugadores solo entran entre rondas (las reconexiones con playerId
    // ya han salido por la rama anterior); si no, inflan los votos esperados.
    if (room.phase !== 'lobby') return ackErr(ack, 'La partida ya está en curso. Espera a la siguiente ronda');

    const taken = [...room.players.values()].some((x) => x.name.toLowerCase() === clean.toLowerCase());
    if (taken) return ackErr(ack, 'Ese nombre ya está en la partida');
    if (room.players.size >= MAX_PLAYERS) return ackErr(ack, `Partida llena (máx ${MAX_PLAYERS} jugadores)`);

    if (!room.hostId) room.hostId = socket.id; // sala huérfana: el primero que entra manda
    room.players.set(socket.id, { id: socket.id, name: clean, connected: true });
    mergeWords();
    socket.data.roomCode = room.code;
    socket.data.playerId = socket.id;
    socket.join(room.code);
    ackOk(ack);
    socket.emit('room:joined', { room: serializeRoom(room), me: socket.id });
    broadcastLobby(room);
  });

  socket.on('lobby:leave', (ack) => {
    const room = getRoomOf(socket);
    if (room && isHost(socket, room)) {
      endRoom(room);
      return ackOk(ack);
    }
    leaveRoom();
    ackOk(ack);
  });
  socket.on('round:leave', (ack) => {
    const room = getRoomOf(socket);
    if (!room || !socket.data.playerId) return ackErr(ack, 'No estás en una partida');
    if (room.phase !== 'round') return ackErr(ack, 'Solo puedes salir durante la ronda');
    if (isHost(socket, room)) {
      endRoom(room);
      return ackOk(ack);
    }
    leaveRoom();
    socket.emit('game:ended');
    ackOk(ack);
  });
  socket.on('disconnect', leaveRoom);

  /* ---- lobby: configuración y expulsiones ---- */

  socket.on('config:set', (cfg = {}, ack) => {
    const room = getRoomOf(socket);
    if (!room || !isHost(socket, room)) return ackErr(ack, 'Solo el anfitrión puede cambiar la configuración');
    if (room.phase !== 'lobby') return ackErr(ack, 'La configuración solo se cambia entre rondas');
    // Aplica SOLO los campos presentes: cada control del cliente envía solo su campo,
    // así un cambio (p. ej. categoría) nunca pisa el valor recién puesto en el stepper.
    if (typeof cfg.impostors !== 'undefined') {
      const connectedCount = [...room.players.values()].filter((p) => p.connected).length;
      const maxImpostors = Math.max(1, Math.min(MAX_IMPOSTORS, connectedCount - 1));
      room.config.impostors = clamp(Number(cfg.impostors) || 1, 1, maxImpostors);
    }
    if (typeof cfg.category !== 'undefined' && CATEGORIES[cfg.category]) room.config.category = cfg.category;
    if (typeof cfg.customWords === 'string') room.config.customWords = cfg.customWords.slice(0, 2000);
    if (typeof cfg.voting !== 'undefined') room.config.voting = cfg.voting !== false;
    if (typeof cfg.impostorHint !== 'undefined') room.config.impostorHint = cfg.impostorHint === true;
    room.lastActivity = Date.now();
    broadcastLobby(room);
    ackOk(ack);
  });

  socket.on('lobby:kick', ({ playerId } = {}, ack) => {
    const room = getRoomOf(socket);
    if (!room || !isHost(socket, room)) return ackErr(ack, 'Solo el anfitrión puede expulsar');
    const p = room.players.get(playerId);
    if (!p || playerId === room.hostId) return ackOk(ack);
    const target = io.sockets.sockets.get(playerId);
    if (target) {
      target.emit('kicked');
      target.leave(room.code);
      target.data.roomCode = null;
      target.data.playerId = null;
    }
    room.players.delete(playerId);
    room.lastActivity = Date.now();
    broadcastLobby(room);
    ackOk(ack);
  });

  /* ---- ronda ---- */

  socket.on('round:start', (ack) => {
    const room = getRoomOf(socket);
    if (!room || !isHost(socket, room)) return ackErr(ack, 'Solo el anfitrión puede empezar');
    if (room.phase !== 'lobby') return ackErr(ack, 'Ya hay una ronda en curso');
    const connected = [...room.players.values()].filter((p) => p.connected);
    if (connected.length < MIN_PLAYERS) return ackErr(ack, `Se necesitan al menos ${MIN_PLAYERS} jugadores`);
    startRound(room);
    ackOk(ack);
  });

  socket.on('vote:cast', ({ targetId } = {}, ack) => {
    const room = getRoomOf(socket);
    const pid = socket.data.playerId;
    if (!room || room.phase !== 'voting') return ackErr(ack, 'Todavía no se vota');
    if (!room.players.has(pid)) return ackErr(ack, 'No estás en la partida');
    if (targetId === pid) return ackErr(ack, 'No puedes votarte a ti mismo');
    if (!room.players.has(targetId)) return ackErr(ack, 'Jugador no encontrado');
    room.votes.set(pid, targetId);
    room.lastActivity = Date.now();
    ackOk(ack);
    checkVotes(room);
  });

  socket.on('round:reveal', (ack) => {
    const room = getRoomOf(socket);
    if (!room || !isHost(socket, room)) return ackErr(ack, 'Solo el anfitrión puede revelar');
    if (room.phase === 'lobby' || room.phase === 'reveal') return ackOk(ack);
    // con votación activa, "revelar" durante el debate = pasar a votación
    if (room.phase === 'round' && room.config.voting) {
      room.votingDeadlineAt = Date.now() + VOTE_TIME_MS;
      setPhase(room, 'voting', { deadlineAt: room.votingDeadlineAt });
      scheduleAdvance(room, VOTE_TIME_MS, () => doReveal(room));
      return ackOk(ack);
    }
    doReveal(room);
    ackOk(ack);
  });

  socket.on('round:next', (ack) => {
    const room = getRoomOf(socket);
    if (!room || !isHost(socket, room)) return ackErr(ack, 'Solo el anfitrión puede avanzar');
    resetToLobby(room);
    ackOk(ack);
  });
});

server.listen(PORT, () => {
  console.log(`[el-impostor] escuchando en :${PORT}`);
});
