const crypto = require("crypto");
const { MAX_PLAYERS } = require("./game");

const ROOM_ID_RE = /^[a-f0-9]{8}$/;
const rooms = new Map();

function generateRoomId() {
  let id;
  do {
    id = crypto.randomBytes(4).toString("hex");
  } while (rooms.has(id));
  return id;
}

function createRoom(hostSessionId) {
  const id = generateRoomId();
  rooms.set(id, {
    id,
    createdAt: Date.now(),
    hostSessionId,
    status: "waiting",
    playerOrder: [hostSessionId],
    playerNames: {},
    sockets: {},
    game: null,
  });
  return id;
}

function getRoom(roomId) {
  return rooms.get(roomId) ?? null;
}

function roomExists(roomId) {
  return rooms.has(roomId);
}

function normalizeRoomId(name) {
  if (typeof name !== "string") return null;
  const trimmed = name.trim().toLowerCase();
  return ROOM_ID_RE.test(trimmed) ? trimmed : null;
}

function buildRoomUrl(roomId, clientOrigin) {
  const base = (clientOrigin || "http://localhost:5174").replace(/\/$/, "");
  return `${base}/?room=${roomId}`;
}

function isPlayerInRoom(room, sessionId) {
  return room.playerOrder.includes(sessionId);
}

function linkSocket(room, sessionId, socketId) {
  room.sockets[sessionId] = socketId;
}

function unlinkSocket(room, sessionId) {
  delete room.sockets[sessionId];
}

function setPlayerName(roomId, sessionId, name) {
  const room = getRoom(roomId);
  if (!room) return null;
  if (!room.playerNames) room.playerNames = {};
  room.playerNames[sessionId] = name;
  return room;
}

function getPlayerName(room, sessionId) {
  return room.playerNames?.[sessionId] ?? null;
}

function addPlayer(roomId, sessionId, socketId, playerName) {
  const room = getRoom(roomId);
  if (!room) return null;
  if (!room.playerNames) room.playerNames = {};
  if (!isPlayerInRoom(room, sessionId)) {
    room.playerOrder.push(sessionId);
  }
  if (playerName) {
    room.playerNames[sessionId] = playerName;
  }
  linkSocket(room, sessionId, socketId);
  return room;
}

/** Rời phòng chủ động — xóa slot. */
function removePlayer(roomId, sessionId) {
  const room = getRoom(roomId);
  if (!room) return null;

  unlinkSocket(room, sessionId);
  room.playerOrder = room.playerOrder.filter((id) => id !== sessionId);
  if (room.playerNames) {
    delete room.playerNames[sessionId];
  }
  if (room.game?.submissions) {
    delete room.game.submissions[sessionId];
  }

  if (room.hostSessionId === sessionId && room.playerOrder.length > 0) {
    room.hostSessionId = room.playerOrder[0];
  }

  return room;
}

/** Refresh / mất mạng — giữ slot, chỉ gỡ socket. */
function disconnectPlayer(roomId, sessionId) {
  const room = getRoom(roomId);
  if (!room) return null;
  unlinkSocket(room, sessionId);
  return room;
}

function getMemberCount(roomId) {
  const room = getRoom(roomId);
  return room ? room.playerOrder.length : 0;
}

function isRoomFull(roomId) {
  return getMemberCount(roomId) >= MAX_PLAYERS;
}

function canJoin(roomId, sessionId) {
  const room = getRoom(roomId);
  if (!room) return { ok: false, error: "ROOM_NOT_FOUND" };

  if (isPlayerInRoom(room, sessionId)) {
    return { ok: true, reconnect: true };
  }

  if (room.status !== "waiting") {
    return {
      ok: false,
      error: "GAME_IN_PROGRESS",
      message: "Game đang diễn ra — chỉ người đã trong phòng mới vào lại được",
    };
  }

  if (isRoomFull(roomId)) {
    return { ok: false, error: "ROOM_FULL", message: "Phòng đã đủ 6 người" };
  }

  return { ok: true };
}

function setGamePlaying(roomId, gameData) {
  const room = getRoom(roomId);
  if (!room) return null;
  room.status = "playing";
  room.game = { ...gameData, submissions: {} };
  return room;
}

function recordSubmission(roomId, sessionId, submission) {
  const room = getRoom(roomId);
  if (!room?.game) return null;
  room.game.submissions[sessionId] = submission;
  return room;
}

function getSubmissionCount(roomId) {
  const room = getRoom(roomId);
  if (!room?.game?.submissions) return 0;
  const active = room.playerOrder.slice(0, MAX_PLAYERS);
  return active.filter((id) => room.game.submissions[id]).length;
}

function allPlayersSubmitted(roomId) {
  return getSubmissionCount(roomId) === MAX_PLAYERS;
}

function setGameFinished(roomId) {
  const room = getRoom(roomId);
  if (!room) return null;
  room.status = "finished";
  return room;
}

function getPlayerIndex(roomId, sessionId) {
  const room = getRoom(roomId);
  if (!room) return -1;
  return room.playerOrder.indexOf(sessionId);
}

module.exports = {
  ROOM_ID_RE,
  MAX_PLAYERS,
  createRoom,
  getRoom,
  roomExists,
  normalizeRoomId,
  buildRoomUrl,
  addPlayer,
  setPlayerName,
  getPlayerName,
  removePlayer,
  disconnectPlayer,
  getMemberCount,
  isRoomFull,
  canJoin,
  setGamePlaying,
  recordSubmission,
  getSubmissionCount,
  allPlayersSubmitted,
  setGameFinished,
  getPlayerIndex,
  isPlayerInRoom,
};
