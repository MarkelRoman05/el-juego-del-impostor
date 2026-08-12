'use strict';

const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { CATEGORIES } = require('./words');
const fs = require('fs');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3111;
const MIN_PLAYERS = 3;
const MAX_IMPOSTORS = 3;
const MAX_PLAYERS = 20;
const ROOM_MAX_AGE_MS = 2 * 60 * 60 * 1000;   // una sala vive 2h desde la última actividad
const EMPTY_ROOM_TTL_MS = 10 * 60 * 1000;     // y se borra 10min después de quedarse vacía
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const DATA_DIR = process.env.DATA_DIR || __dirname;
const ADMIN_TOKEN_FILE = path.join(DATA_DIR, 'admin-tokens.json');
const ADMIN_CONFIG_FILE = path.join(DATA_DIR, 'admin-config.json');
const ADMIN_CREDENTIALS_FILE = path.join(DATA_DIR, 'admin-credentials.json');
let fileCredentials = {};
try {
  fileCredentials = JSON.parse(fs.readFileSync(ADMIN_CREDENTIALS_FILE, 'utf8'));
} catch {}
const ADMIN_USER = process.env.ADMIN_USER || fileCredentials.username || '';
const ADMIN_PASS = process.env.ADMIN_PASS || fileCredentials.password || '';
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const JOIN_WINDOW_MS = 60 * 1000;
const JOIN_MAX_ATTEMPTS = 30;
const loginAttempts = new Map();
const joinAttempts = new Map();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  pingInterval: 25000,
  pingTimeout: 20000,
  maxHttpBufferSize: 128 * 1024,
});

app.disable('x-powered-by');
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist', 'el-impostor', 'browser'), {
  maxAge: '1h',
  setHeaders(res, filePath) {
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));
app.get('/healthz', (_req, res) => res.json({ ok: true, uptime: Math.round(process.uptime()) }));

app.get('/api/categories', (_req, res) => {
  res.json({ categories: getAllCategories() });
});

/* ------------------------------------------------------------------ */
/* admin: endpoints                                                    */
/* ------------------------------------------------------------------ */

app.post('/api/admin/login', (req, res) => {
  const now = Date.now();
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const attempts = (loginAttempts.get(ip) || []).filter((at) => now - at < LOGIN_WINDOW_MS);
  if (attempts.length >= LOGIN_MAX_ATTEMPTS) {
    loginAttempts.set(ip, attempts);
    return res.status(429).json({ error: 'Demasiados intentos. Inténtalo más tarde' });
  }
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    loginAttempts.delete(ip);
    const token = generateAdminToken();
    return res.json({ token });
  }
  attempts.push(now);
  loginAttempts.set(ip, attempts);
  res.status(401).json({ error: 'Credenciales incorrectas' });
});

app.get('/api/admin/rooms', adminAuth, (_req, res) => {
  const roomList = [...rooms.values()].map((r) => ({
    code: r.code,
    phase: r.phase,
    players: r.players.size,
    connected: [...r.players.values()].filter((p) => p.connected).length,
    category: r.config.category,
    impostors: r.config.impostors,
    customWordsCount: parseCustomWords(r.config.customWords).length,
    createdAt: r.startedAt || Date.now(),
  }));
  res.json({ rooms: roomList });
});

app.delete('/api/admin/rooms/:code', adminAuth, (req, res) => {
  const code = normalizeCode(req.params.code);
  const room = rooms.get(code);
  if (!room) return res.status(404).json({ error: 'Sala no encontrada' });
  io.to(code).emit('game:ended');
  for (const playerSocket of io.sockets.sockets.values()) {
    if (playerSocket.data.roomCode !== code) continue;
    playerSocket.data.roomCode = null;
    playerSocket.data.playerId = null;
    playerSocket.leave(code);
  }
  rooms.delete(code);
  res.json({ ok: true });
});

app.get('/api/admin/categories', adminAuth, (_req, res) => {
  res.json({ categories: getAdminCategories() });
});

app.post('/api/admin/categories', adminAuth, (req, res) => {
  const { key, label, words } = req.body || {};
  const cleanKey = sanitizeCategoryKey(key);
  if (!cleanKey) return res.status(400).json({ error: 'Clave de categoría inválida' });
  if (CATEGORIES[cleanKey]) return res.status(400).json({ error: 'Esa categoría ya existe como built-in' });
  if (!adminConfig.customCategories) adminConfig.customCategories = {};
  if (adminConfig.customCategories[cleanKey]) return res.status(400).json({ error: 'Esa categoría personalizada ya existe' });
  const cleanLabel = typeof label === 'string' ? label.trim().slice(0, 30) : '';
  if (!cleanLabel) return res.status(400).json({ error: 'El nombre es obligatorio' });
   const cleanWords = Array.isArray(words) ? cleanCategoryWords(words) : [];
  if (!cleanWords.length) return res.status(400).json({ error: 'Añade al menos una palabra' });
  adminConfig.customCategories[cleanKey] = { label: cleanLabel, words: cleanWords };
  saveAdminConfig(adminConfig);
  res.json({ ok: true, categories: getAdminCategories() });
});

app.put('/api/admin/categories/:key', adminAuth, (req, res) => {
  const key = sanitizeCategoryKey(req.params.key);
  const isBuiltIn = Boolean(CATEGORIES[key] && key !== 'mezcla');
  const isCustom = Boolean(adminConfig.customCategories?.[key]);
  if (!isBuiltIn && !isCustom) return res.status(404).json({ error: 'Categoría no encontrada' });
  const { label, words } = req.body || {};
  const category = isBuiltIn
    ? (adminConfig.categoryOverrides[key] ||= { label: CATEGORIES[key].label, words: [...CATEGORIES[key].words] })
    : adminConfig.customCategories[key];
  if (typeof label === 'string' && label.trim()) {
    category.label = label.trim().slice(0, 30);
  }
  if (Array.isArray(words)) {
    const cleanWords = cleanCategoryWords(words);
    if (!cleanWords.length) return res.status(400).json({ error: 'La categoría debe tener al menos una palabra' });
    category.words = cleanWords;
  }
  saveAdminConfig(adminConfig);
  res.json({ ok: true, categories: getAdminCategories() });
});

app.delete('/api/admin/categories/:key', adminAuth, (req, res) => {
  const key = sanitizeCategoryKey(req.params.key);
  const isBuiltIn = Boolean(CATEGORIES[key] && key !== 'mezcla');
  const isCustom = Boolean(adminConfig.customCategories?.[key]);
  if (!isBuiltIn && !isCustom) return res.status(404).json({ error: 'Categoría no encontrada' });
  if (isBuiltIn) {
    adminConfig.disabledCategories[key] = true;
    delete adminConfig.categoryOverrides[key];
  } else {
    delete adminConfig.customCategories[key];
  }
  saveAdminConfig(adminConfig);
  for (const room of rooms.values()) {
    const keys = room.config.category.split(',').filter((k) => k !== key);
    room.config.category = keys.join(',');
    broadcastLobby(room);
  }
  res.json({ ok: true, categories: getAdminCategories() });
});

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
const sanitizeCategoryKey = (raw) => {
  if (typeof raw !== 'string') return '';
  const key = raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30);
  return key.length >= 2 ? key : '';
};
const isPlayingPlayer = (room, playerId) =>
  !room.eliminatedIds.has(playerId) &&
  (room.config.hostPlays !== false || playerId !== room.hostId);
const cleanCategoryWords = (words) => {
  const seen = new Set();
  return words
    .map((w) => String(w).trim())
    .filter((w) => w.length >= 2 && w.length <= 40)
    .filter((w) => {
      const normalized = w.toLocaleLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .slice(0, 200);
};
function getAllCategories() {
  const builtIn = {};
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    if (key === 'mezcla' || adminConfig.disabledCategories?.[key]) continue;
    const override = adminConfig.categoryOverrides?.[key];
    builtIn[key] = { label: override?.label || cat.label, custom: false };
  }
  const custom = {};
  for (const [key, cat] of Object.entries(adminConfig.customCategories || {})) {
    custom[key] = { label: cat.label, custom: true };
  }
  return { ...builtIn, ...custom };
}
function getAdminCategories() {
  const categories = {};
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    if (key === 'mezcla' || adminConfig.disabledCategories?.[key]) continue;
    const override = adminConfig.categoryOverrides?.[key];
    categories[key] = {
      label: override?.label || cat.label,
       words: cleanCategoryWords(override?.words || cat.words),
      custom: false,
    };
  }
  for (const [key, cat] of Object.entries(adminConfig.customCategories || {})) {
     categories[key] = { label: cat.label, words: cleanCategoryWords(cat.words), custom: true };
  }
  return categories;
}

/* ------------------------------------------------------------------ */
/* admin: tokens y configuración                                       */
/* ------------------------------------------------------------------ */

const adminTokens = new Map();

function loadAdminTokens() {
  try {
    if (fs.existsSync(ADMIN_TOKEN_FILE)) {
      const data = JSON.parse(fs.readFileSync(ADMIN_TOKEN_FILE, 'utf8'));
      for (const [token, expiry] of Object.entries(data)) {
        if (expiry > Date.now()) adminTokens.set(token, expiry);
      }
    }
  } catch {}
}

function saveAdminTokens() {
  const data = Object.fromEntries([...adminTokens.entries()].filter(([, exp]) => exp > Date.now()));
  writeJsonFile(ADMIN_TOKEN_FILE, data);
}

function writeJsonFile(file, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(temporary, file);
}

function loadAdminConfig() {
  try {
    if (fs.existsSync(ADMIN_CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(ADMIN_CONFIG_FILE, 'utf8'));
    }
  } catch {}
  return { customCategories: {}, categoryOverrides: {} };
}

function saveAdminConfig(config) {
  writeJsonFile(ADMIN_CONFIG_FILE, config);
}

let adminConfig = loadAdminConfig();
adminConfig.customCategories ||= {};
adminConfig.categoryOverrides ||= {};
adminConfig.disabledCategories ||= {};
if (process.env.ADMIN_USER && process.env.ADMIN_PASS) {
  writeJsonFile(ADMIN_CREDENTIALS_FILE, { username: ADMIN_USER, password: ADMIN_PASS });
}
loadAdminTokens();

function generateAdminToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const expiry = Date.now() + 24 * 60 * 60 * 1000;
  adminTokens.set(token, expiry);
  saveAdminTokens();
  return token;
}

function validateAdminToken(token) {
  if (!token || !adminTokens.has(token)) return false;
  if (adminTokens.get(token) < Date.now()) {
    adminTokens.delete(token);
    saveAdminTokens();
    return false;
  }
  return true;
}

function adminAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!validateAdminToken(token)) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}

// Cleanup periódico de tokens expirados
setInterval(() => {
  let changed = false;
  for (const [token, expiry] of adminTokens) {
    if (expiry < Date.now()) {
      adminTokens.delete(token);
      changed = true;
    }
  }
  if (changed) saveAdminTokens();
}, 60 * 60 * 1000);

function genCode() {
  for (let i = 0; i < 50; i++) {
    let code = '';
    for (let j = 0; j < 4; j++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    if (!rooms.has(code)) return code;
  }
  let code;
  do {
    code = String(crypto.randomInt(0, 10000)).padStart(4, '0');
  } while (rooms.has(code));
  return code;
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
    originalHostId: hostId,
    phase: 'lobby',           // lobby | round | gameover
    players: new Map(),       // id -> { id, name, connected, reconnectToken }
    config: { impostors: 1, category: '', customWords: '', impostorHint: false, hostPlays: true, hostWordFromCatalog: false },
    word: null,
    categoryLabel: null,
    starterName: null,
    impostorIds: null,        // Set<id>
    previousImpostorIds: null, // Set<id> de la ronda anterior, para no repetir impostor dos rondas seguidas
    eliminatedIds: new Set(),
    roleByPlayer: new Map(),  // id -> payload privado de la ronda (para reconexiones)
    usedWords: [],
    revealData: null,
    startedAt: 0,
    lastActivity: Date.now(),
  };
  room.players.set(hostId, { id: hostId, name: hostName, connected: true, reconnectToken: crypto.randomBytes(32).toString('hex') });
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
    config: {
      impostors: room.config.impostors,
      category: room.config.category,
      impostorHint: room.config.impostorHint,
      hostPlays: room.config.hostPlays !== false,
      // Privacidad: las palabras personalizadas NUNCA se serializan; solo su número
      customWordsCount: parseCustomWords(room.config.customWords).length,
    },
     players: [...room.players.values()].map((p) => ({ id: p.id, name: p.name, connected: p.connected, eliminated: room.eliminatedIds.has(p.id) })),
  };
}

function categoryKeys(value) {
  const isEnabledBuiltIn = (key) => Boolean(Object.hasOwn(CATEGORIES, key) && key !== 'mezcla' && !adminConfig.disabledCategories?.[key]);
  if (value === 'mezcla') return [...Object.keys(CATEGORIES).filter(isEnabledBuiltIn), ...Object.keys(adminConfig.customCategories || {}), 'personalizadas'];
  const keys = String(value || '').split(',').filter((key, index, list) => (isEnabledBuiltIn(key) || Object.hasOwn(adminConfig.customCategories || {}, key) || key === 'personalizadas') && key !== 'mezcla' && list.indexOf(key) === index);
  return keys.length ? keys : ['animales'];
}

function getWordPool(room) {
  const custom = parseCustomWords(room.config.customWords);
  if (custom.length) return custom;
  const customCats = adminConfig.customCategories || {};
  const pool = categoryKeys(room.config.category).flatMap((key) => {
    if (key === 'personalizadas') return custom;
    if (customCats[key]) return customCats[key].words;
    if (adminConfig.categoryOverrides?.[key]) return adminConfig.categoryOverrides[key].words;
    return CATEGORIES[key] ? CATEGORIES[key].words : [];
  });
  const allWords = [...new Set(pool)];
  return allWords.length ? allWords : CATEGORIES.animales.words;
}
function getCategoryWordOptions(room) {
  if (!room.config.category) return [];
  const customCats = adminConfig.customCategories || {};
  const pool = categoryKeys(room.config.category).flatMap((key) => {
    if (key === 'personalizadas') return [];
    if (customCats[key]) return customCats[key].words;
    if (adminConfig.categoryOverrides?.[key]) return adminConfig.categoryOverrides[key].words;
    return CATEGORIES[key] ? CATEGORIES[key].words : [];
  });
  return [...new Set(pool)];
}
function categoryLabelForWord(room, word) {
  return categoryKeys(room.config.category).map((key) => {
    if (key === 'personalizadas') return null;
    const custom = adminConfig.customCategories?.[key];
    const words = custom?.words || adminConfig.categoryOverrides?.[key]?.words || CATEGORIES[key]?.words || [];
    if (!words.includes(word)) return null;
    return custom?.label || adminConfig.categoryOverrides?.[key]?.label || CATEGORIES[key]?.label || key;
  }).filter(Boolean).join(' + ');
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

function startRound(room) {
  const connected = [...room.players.values()].filter((p) => p.connected && isPlayingPlayer(room, p.id));
  const impostors = clamp(room.config.impostors, 1, Math.min(MAX_IMPOSTORS, connected.length - 1));
  const word = room.word || pickWord(room);
  const customWords = parseCustomWords(room.config.customWords);
  const categoryLabel = customWords.length
    ? (room.config.hostPlays === false && room.config.hostWordFromCatalog
      ? categoryLabelForWord(room, customWords[0]) || 'Palabra elegida por el host'
      : room.config.hostPlays === false ? 'Palabra elegida por el host' : 'Palabras personalizadas')
    : room.config.category === 'mezcla'
      ? 'Mezcla'
      : categoryKeys(room.config.category).map((key) => {
          if (key === 'personalizadas') return 'Palabras personalizadas';
          const customCats = adminConfig.customCategories || {};
          if (customCats[key]) return customCats[key].label;
          return adminConfig.categoryOverrides?.[key]?.label || (CATEGORIES[key] ? CATEGORIES[key].label : key);
        }).join(' + ');

  // Evita repetir impostores de la ronda anterior siempre que haya suficientes jugadores
  // alternativos; si no quedan, vuelve al pool completo.
  const impostorIds = room.impostorIds
    || (() => {
      const previous = room.previousImpostorIds;
      const fresh = previous
        ? connected.filter((p) => !previous.has(p.id))
        : connected;
      const pool = fresh.length >= impostors ? fresh : connected;
      return new Set(shuffle(pool.map((p) => p.id)).slice(0, impostors));
    })();

  const starter = connected[Math.floor(Math.random() * connected.length)];
  room.starterName = starter.name;
  room.starterId = starter.id;

  room.word = word;
  room.categoryLabel = categoryLabel;
  room.impostorIds = impostorIds;
  room.previousImpostorIds = new Set(impostorIds);
  room.revealData = null;
  room.roleByPlayer = new Map();
  room.startedAt = Date.now();

  for (const p of connected) {
    const payload = impostorIds.has(p.id)
       ? { role: 'impostor', category: room.config.impostorHint ? categoryLabel : '', starter: starter.name, starterId: starter.id }
       : { role: 'player', word, category: categoryLabel, starter: starter.name, starterId: starter.id };
    room.roleByPlayer.set(p.id, payload);
    const sock = io.sockets.sockets.get(p.id);
    if (sock) sock.emit('round:started', payload);
  }
  const host = room.players.get(room.hostId);
  if (host && host.connected && !isPlayingPlayer(room, host.id)) {
    const payload = {
      role: 'player',
      word,
      category: categoryLabel,
      starter: starter.name,
      starterId: starter.id,
      impostors: [...impostorIds].map((id) => room.players.get(id)?.name || '?'),
    };
    room.roleByPlayer.set(host.id, payload);
    io.sockets.sockets.get(host.id)?.emit('round:started', payload);
  }

  setPhase(room, 'round', { startedAt: room.startedAt, starter: room.starterName, starterId: room.starterId });
}

function finishGame(room) {
  if (room.phase !== 'round') return;

  const playersById = Object.fromEntries([...room.players.entries()]);
  const result = {
    gameOver: true,
    word: room.word,
    category: room.categoryLabel,
    impostors: [...(room.impostorIds || [])].map((id) => ({ id, name: playersById[id]?.name ?? '?' })),
  };
  room.revealData = result;
  setPhase(room, 'gameover');
  io.to(room.code).emit('game:over', result);
}

function resetToLobby(room) {
  room.phase = 'lobby';
  room.word = null;
  room.categoryLabel = null;
  room.starterName = null;
  room.impostorIds = null;
  room.eliminatedIds = new Set();
  room.roleByPlayer = new Map();
  room.revealData = null;
  broadcastLobby(room);
  io.to(room.code).emit('phase:changed', { phase: 'lobby' });
}

function endRoom(room) {
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
    if (room.originalHostId === oldId) room.originalHostId = newId;
    if (room.impostorIds && room.impostorIds.has(oldId)) {
      room.impostorIds.delete(oldId);
      room.impostorIds.add(newId);
    }
    if (room.previousImpostorIds && room.previousImpostorIds.has(oldId)) {
      room.previousImpostorIds.delete(oldId);
      room.previousImpostorIds.add(newId);
    }
    if (room.eliminatedIds.has(oldId)) {
      room.eliminatedIds.delete(oldId);
      room.eliminatedIds.add(newId);
    }
    const role = room.roleByPlayer.get(oldId);
    if (role) {
      room.roleByPlayer.delete(oldId);
      room.roleByPlayer.set(newId, role);
    }
  }

  function sendWordOptions(room, sock) {
    if (sock.id === room.hostId && room.config.hostPlays === false) {
      sock.emit('word:options', getCategoryWordOptions(room).sort((a, b) => a.localeCompare(b)));
    } else {
      sock.emit('word:options', []);
    }
  }

  function replayRoundState(room, sock) {
    const pid = sock.data.playerId;
    if (room.phase === 'round') {
      if (room.starterName) sock.emit('phase:changed', { phase: 'round', starter: room.starterName, starterId: room.starterId });
      const role = room.roleByPlayer.get(pid);
      if (role) sock.emit('round:started', role);
    } else if (room.phase === 'gameover' && room.revealData) {
      sock.emit('game:over', room.revealData);
    }
  }

  function leaveRoom(endIfEmpty = false) {
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
      if (endIfEmpty && ![...room.players.values()].some((player) => player.connected)) {
        endRoom(room);
        return;
      }
      broadcastLobby(room);
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
      room.config.category = 'personalizadas';
    }
    socket.data.roomCode = room.code;
    socket.data.playerId = socket.id;
    socket.join(room.code);
    ackOk(ack);
    socket.emit('room:joined', { room: serializeRoom(room), me: socket.id, reconnectToken: room.players.get(socket.id).reconnectToken });
    broadcastLobby(room);
  });

  socket.on('room:join', ({ code, name, playerId, reconnectToken, customWords } = {}, ack) => {
    const now = Date.now();
    const address = socket.handshake.address || 'unknown';
    const attempts = (joinAttempts.get(address) || []).filter((at) => now - at < JOIN_WINDOW_MS);
    if (attempts.length >= JOIN_MAX_ATTEMPTS) {
      joinAttempts.set(address, attempts);
      return ackErr(ack, 'Demasiados intentos. Inténtalo más tarde');
    }
    attempts.push(now);
    joinAttempts.set(address, attempts);
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
      if (room.config.category === 'animales') room.config.category = 'personalizadas';
    };

    // Reconexión del mismo jugador (recarga de página / caída de red)
    if (playerId && room.players.has(playerId)) {
      const p = room.players.get(playerId);
      if (typeof reconnectToken !== 'string' || reconnectToken.length !== 64 || reconnectToken !== p.reconnectToken) {
        return ackErr(ack, 'Sesión de reconexión no válida');
      }
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
      p.id = socket.id;
      p.connected = true;
      room.players.delete(playerId);
      room.players.set(socket.id, p);
      remapIds(room, playerId, socket.id);
      if (room.originalHostId === socket.id) room.hostId = socket.id;
      mergeWords();
      socket.data.roomCode = room.code;
      socket.data.playerId = socket.id;
      socket.join(room.code);
      ackOk(ack);
      socket.emit('room:joined', { room: serializeRoom(room), me: socket.id, reconnectToken: p.reconnectToken });
      sendWordOptions(room, socket);
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
    const reconnectTokenForPlayer = crypto.randomBytes(32).toString('hex');
    room.players.set(socket.id, { id: socket.id, name: clean, connected: true, reconnectToken: reconnectTokenForPlayer });
    mergeWords();
    socket.data.roomCode = room.code;
    socket.data.playerId = socket.id;
    socket.join(room.code);
    ackOk(ack);
      socket.emit('room:joined', { room: serializeRoom(room), me: socket.id, reconnectToken: reconnectTokenForPlayer });
      sendWordOptions(room, socket);
      broadcastLobby(room);
  });

  socket.on('lobby:leave', (ack) => {
    const room = getRoomOf(socket);
    if (room && isHost(socket, room)) {
      endRoom(room);
      return ackOk(ack);
    }
    leaveRoom(true);
    ackOk(ack);
  });
  socket.on('round:leave', (ack) => {
    const room = getRoomOf(socket);
    if (!room || !socket.data.playerId) return ackErr(ack, 'No estás en una partida');
    if (isHost(socket, room)) {
      endRoom(room);
      return ackOk(ack);
    }
    leaveRoom(true);
    socket.emit('game:ended');
    ackOk(ack);
  });
  socket.on('game:end', (ack) => {
    const room = getRoomOf(socket);
    if (!room || !isHost(socket, room)) return ackErr(ack, 'Solo el anfitrión puede finalizar la partida');
    endRoom(room);
    ackOk(ack);
  });
  socket.on('disconnect', () => leaveRoom(false));

  /* ---- lobby: configuración y expulsiones ---- */

  socket.on('config:set', (cfg = {}, ack) => {
    const room = getRoomOf(socket);
    if (!room || !isHost(socket, room)) return ackErr(ack, 'Solo el anfitrión puede cambiar la configuración');
    if (room.phase !== 'lobby') return ackErr(ack, 'La configuración solo se cambia entre rondas');
    // Aplica SOLO los campos presentes: cada control del cliente envía solo su campo,
    // así un cambio (p. ej. categoría) nunca pisa el valor recién puesto en el stepper.
    if (typeof cfg.impostors !== 'undefined') {
      const connectedCount = [...room.players.values()].filter((p) => p.connected && isPlayingPlayer(room, p.id)).length;
      const maxImpostors = Math.max(1, Math.min(MAX_IMPOSTORS, connectedCount - 1));
      room.config.impostors = clamp(Number(cfg.impostors) || 1, 1, maxImpostors);
    }
    if (typeof cfg.category === 'string') room.config.category = cfg.category === 'mezcla'
      ? 'mezcla'
      : cfg.category.trim() ? categoryKeys(cfg.category).join(',') : '';
    if (typeof cfg.customWords === 'string') room.config.customWords = cfg.customWords.slice(0, 2000);
    if (typeof cfg.impostorHint !== 'undefined') room.config.impostorHint = cfg.impostorHint === true;
    if (typeof cfg.hostPlays !== 'undefined') room.config.hostPlays = cfg.hostPlays !== false;
    if (typeof cfg.hostWordFromCatalog !== 'undefined') room.config.hostWordFromCatalog = cfg.hostWordFromCatalog === true;
    room.lastActivity = Date.now();
    sendWordOptions(room, socket);
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
    const connected = [...room.players.values()].filter((p) => p.connected && isPlayingPlayer(room, p.id) && !room.eliminatedIds.has(p.id));
    if (room.startedAt === 0 && connected.length < MIN_PLAYERS) return ackErr(ack, `Se necesitan al menos ${MIN_PLAYERS} jugadores`);
    if (connected.length < 2) return ackErr(ack, 'No quedan suficientes jugadores activos');
    if (!String(room.config.category || '').trim() && !parseCustomWords(room.config.customWords).length) {
      return ackErr(ack, 'Selecciona al menos una categoría o escribe una palabra');
    }
    startRound(room);
    ackOk(ack);
  });

  socket.on('round:reveal', (ack) => {
    const room = getRoomOf(socket);
    if (!room || !isHost(socket, room)) return ackErr(ack, 'Solo el anfitrión puede revelar');
    if (room.phase !== 'round') return ackOk(ack);
    finishGame(room);
    ackOk(ack);
  });

  socket.on('round:next', (ack) => {
    const room = getRoomOf(socket);
    if (!room || !isHost(socket, room)) return ackErr(ack, 'Solo el anfitrión puede avanzar');
    if (room.phase !== 'gameover') return ackErr(ack, 'No hay una ronda que continuar');
    resetToLobby(room);
    ackOk(ack);
  });

  socket.on('impostor:mark', (ack) => {
    const room = getRoomOf(socket);
    if (!room || !isHost(socket, room)) return ackErr(ack, 'Solo el anfitrión puede marcar al impostor');
    if (room.phase !== 'round') return ackErr(ack, 'Solo puedes marcar durante la ronda');
    finishGame(room);
    ackOk(ack);
  });
});

server.listen(PORT, () => {
  console.log(`[el-impostor] escuchando en :${PORT}`);
});

function shutdown() {
  io.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 3000);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'dist', 'el-impostor', 'browser', 'index.html'));
});
