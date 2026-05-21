const { createServer } = require("http");
const { Server } = require("socket.io");
const { tryServeStatic } = require("./static");
const {
  NUMBER_PAIRS,
  MAX_PLAYERS,
  dealGame,
  validateGuesses,
  scoreGuesses,
} = require("./game");
const {
  createRoom,
  getRoom,
  roomExists,
  normalizeRoomId,
  buildRoomUrl,
  addPlayer,
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
  getPlayerName,
  setPlayerName,
} = require("./rooms");

const PORT = Number(process.env.PORT) || 4001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5174";

const httpServer = createServer((req, res) => {
  const pathname = (req.url ?? "/").split("?")[0];
  if (pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (tryServeStatic(req, res)) return;
  res.writeHead(404);
  res.end();
});

const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"],
  },
});

function getCurrentRoom(socket) {
  return socket.data.room ?? null;
}

function getSessionId(socket) {
  return socket.data.sessionId ?? null;
}

function normalizePlayerName(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (trimmed.length < 1 || trimmed.length > 24) return null;
  return trimmed;
}

function parseJoinPayload(payload) {
  if (typeof payload === "string") {
    return { roomId: normalizeRoomId(payload), sessionId: null, playerName: null };
  }
  if (payload && typeof payload === "object") {
    const roomRaw = payload.room ?? payload.roomId ?? "";
    const roomId = normalizeRoomId(String(roomRaw));
    const sessionId =
      typeof payload.sessionId === "string" && payload.sessionId.trim()
        ? payload.sessionId.trim()
        : null;
    const playerName = normalizePlayerName(
      typeof payload.playerName === "string" ? payload.playerName : "",
    );
    return { roomId, sessionId, playerName };
  }
  return { roomId: null, sessionId: null, playerName: null };
}

function resolveClientOrigin(socket) {
  const fromHeader = socket?.handshake?.headers?.origin;
  if (typeof fromHeader === "string" && fromHeader.trim()) {
    return fromHeader.trim().replace(/\/$/, "");
  }
  return CLIENT_ORIGIN.replace(/\/$/, "");
}

function buildRoomState(roomId, sessionId, clientOrigin) {
  const room = getRoom(roomId);
  if (!room) return null;

  const members = getMemberCount(roomId);
  const isHost = room.hostSessionId === sessionId;
  const submitted =
    room.status !== "waiting" &&
    Boolean(room.game?.submissions?.[sessionId]);
  const sub = submitted ? room.game.submissions[sessionId] : null;
  const origin = clientOrigin || CLIENT_ORIGIN;

  return {
    room: roomId,
    members,
    maxMembers: MAX_PLAYERS,
    url: buildRoomUrl(roomId, origin),
    hostId: room.hostSessionId,
    isHost,
    status: room.status,
    playerIds: [...room.playerOrder],
    canStart:
      isHost && members === MAX_PLAYERS && room.status === "waiting",
    hasSubmitted: submitted,
    submittedCount:
      room.status === "waiting" ? 0 : getSubmissionCount(roomId),
    game: room.game ? { startedAt: room.game.startedAt } : null,
    myResult:
      room.status === "finished" && sub
        ? { correctCount: sub.correctCount, elapsedMs: sub.elapsedMs }
        : null,
  };
}

function emitRoomState(roomId) {
  const room = getRoom(roomId);
  if (!room) return;

  for (const sessionId of room.playerOrder) {
    const socketId = room.sockets[sessionId];
    if (!socketId) continue;
    const socket = io.sockets.sockets.get(socketId);
    const state = buildRoomState(roomId, sessionId, resolveClientOrigin(socket));
    if (state) {
      io.to(socketId).emit("room:state", state);
    }
  }
}

function buildLeaderboard(room) {
  const playerIds = room.playerOrder.slice(0, MAX_PLAYERS);

  return playerIds
    .map((sessionId, playerIndex) => {
      const sub = room.game.submissions[sessionId];
      return {
        playerIndex,
        displayName: getPlayerName(room, sessionId) ?? `Người ${playerIndex + 1}`,
        correctCount: sub.correctCount,
        elapsedMs: sub.elapsedMs,
      };
    })
    .sort((a, b) => {
      if (b.correctCount !== a.correctCount) {
        return b.correctCount - a.correctCount;
      }
      return a.elapsedMs - b.elapsedMs;
    })
    .map((entry, i) => ({ ...entry, rank: i + 1 }));
}

function syncPlayerGame(socket, roomId, sessionId) {
  const room = getRoom(roomId);
  if (!room?.game) return;

  const playerIndex = getPlayerIndex(roomId, sessionId);
  if (playerIndex < 0) return;

  if (room.status === "playing") {
    socket.emit("game:started", {
      myNumbers: room.game.assignments[sessionId],
      playerIndex,
      startedAt: room.game.startedAt,
      pairs: NUMBER_PAIRS,
    });
    const sub = room.game.submissions[sessionId];
    if (sub) {
      socket.emit("game:submit_progress", {
        submittedCount: getSubmissionCount(roomId),
        maxMembers: MAX_PLAYERS,
      });
    }
  } else if (room.status === "finished") {
    socket.emit("game:ended", { leaderboard: buildLeaderboard(room) });
  }
}

function finishGame(roomId) {
  const room = getRoom(roomId);
  if (!room?.game) return;

  setGameFinished(roomId);
  const leaderboard = buildLeaderboard(room);

  io.to(roomId).emit("game:ended", { leaderboard });
  emitRoomState(roomId);

  console.log(`[game:ended] ${roomId}`);
  leaderboard.forEach((row) => {
    const sub = room.game.submissions[room.playerOrder[row.playerIndex]];
    console.log(
      `  #${row.rank} Người ${row.playerIndex + 1}: ${row.correctCount}/6 đúng · ${(row.elapsedMs / 1000).toFixed(1)}s · chọn [${sub.guesses.join(", ")}]`,
    );
  });
  console.log(`  Đáp án: ${room.game.answerKey.join(", ")}`);
}

function leaveRoom(socket, removeSlot = true) {
  const roomId = getCurrentRoom(socket);
  const sessionId = getSessionId(socket);
  if (!roomId || !sessionId) return null;

  socket.leave(roomId);
  socket.data.room = null;

  if (removeSlot) {
    removePlayer(roomId, sessionId);
  } else {
    disconnectPlayer(roomId, sessionId);
  }

  socket.to(roomId).emit("room:user_left", {
    sessionId,
    room: roomId,
    members: getMemberCount(roomId),
  });
  emitRoomState(roomId);

  return roomId;
}

function joinSocketToRoom(socket, roomId, sessionId, playerName, ack) {
  if (!sessionId) {
    const err = {
      error: "MISSING_SESSION",
      message: "Thiếu sessionId — hãy tải lại trang",
    };
    if (typeof ack === "function") ack(err);
    else socket.emit("room:error", err);
    return;
  }

  if (!roomExists(roomId)) {
    const err = {
      error: "ROOM_NOT_FOUND",
      message: "Room không tồn tại. Hãy tạo phòng mới hoặc kiểm tra link.",
    };
    if (typeof ack === "function") ack(err);
    else socket.emit("room:error", err);
    return;
  }

  const roomForJoin = getRoom(roomId);
  const joinCheck = canJoin(roomId, sessionId);
  if (!joinCheck.ok) {
    const err = {
      error: joinCheck.error,
      message: joinCheck.message ?? "Không thể vào phòng",
    };
    if (typeof ack === "function") ack(err);
    else socket.emit("room:error", err);
    return;
  }

  const resolvedName =
    playerName ||
    (roomForJoin ? getPlayerName(roomForJoin, sessionId) : null);
  if (!resolvedName) {
    const err = {
      error: "MISSING_NAME",
      message: "Hãy nhập tên trước khi vào phòng",
    };
    if (typeof ack === "function") ack(err);
    else socket.emit("room:error", err);
    return;
  }

  const previous = getCurrentRoom(socket);
  if (previous === roomId && getSessionId(socket) === sessionId) {
    const origin = resolveClientOrigin(socket);
    const state = buildRoomState(roomId, sessionId, origin);
    syncPlayerGame(socket, roomId, sessionId);
    if (typeof ack === "function") ack({ ok: true, ...state });
    return;
  }

  if (previous) {
    socket.leave(previous);
    socket.data.room = null;
    removePlayer(previous, sessionId);
    emitRoomState(previous);
  }

  if (!joinCheck.reconnect && isRoomFull(roomId)) {
    const err = {
      error: "ROOM_FULL",
      message: "Phòng đã đủ 6 người",
    };
    if (typeof ack === "function") ack(err);
    else socket.emit("room:error", err);
    return;
  }

  socket.join(roomId);
  socket.data.room = roomId;
  socket.data.sessionId = sessionId;
  addPlayer(roomId, sessionId, socket.id, resolvedName);
  if (playerName) {
    setPlayerName(roomId, sessionId, resolvedName);
  }

  const origin = resolveClientOrigin(socket);
  const state = buildRoomState(roomId, sessionId, origin);

  socket.emit("room:joined", state);
  socket.to(roomId).emit("room:user_joined", {
    sessionId,
    room: roomId,
    members: state.members,
  });
  emitRoomState(roomId);
  syncPlayerGame(socket, roomId, sessionId);

  console.log(
    `[join_room] ${sessionId.slice(0, 8)}… (${socket.id.slice(0, 8)}…) -> ${roomId} (${state.members}/${MAX_PLAYERS})${joinCheck.reconnect ? " reconnect" : ""}`,
  );

  if (typeof ack === "function") {
    ack({ ok: true, ...state });
  }
}

function startGameForRoom(roomId, hostSocket) {
  const room = getRoom(roomId);
  const hostSessionId = getSessionId(hostSocket);
  if (!room) {
    return { error: "ROOM_NOT_FOUND", message: "Room không tồn tại" };
  }
  if (room.hostSessionId !== hostSessionId) {
    return { error: "NOT_HOST", message: "Chỉ chủ phòng mới được bắt đầu" };
  }
  if (room.status !== "waiting") {
    return { error: "ALREADY_STARTED", message: "Game đã bắt đầu" };
  }

  const members = getMemberCount(roomId);
  if (members !== MAX_PLAYERS) {
    return {
      error: "NOT_ENOUGH_PLAYERS",
      message: `Cần đủ ${MAX_PLAYERS} người (hiện ${members})`,
    };
  }

  const playerIds = room.playerOrder.slice(0, MAX_PLAYERS);
  const startedAt = Date.now();
  const { answerKey, assignments } = dealGame(playerIds);

  setGamePlaying(roomId, {
    answerKey,
    assignments,
    startedAt,
  });

  for (const sessionId of playerIds) {
    const socketId = room.sockets[sessionId];
    if (!socketId) continue;
    io.to(socketId).emit("game:started", {
      myNumbers: assignments[sessionId],
      playerIndex: playerIds.indexOf(sessionId),
      startedAt,
      pairs: NUMBER_PAIRS,
    });
  }

  emitRoomState(roomId);

  console.log(`[start_game] ${roomId}`);
  console.log(`  Đáp án (ẩn): ${answerKey.join(", ")}`);
  playerIds.forEach((sessionId, index) => {
    console.log(
      `  Người chơi #${index + 1}: ${assignments[sessionId].join(", ")}`,
    );
  });

  return { ok: true };
}

io.on("connection", (socket) => {
  console.log(`[connect] ${socket.id}`);

  socket.emit("welcome", {
    id: socket.id,
    message: "Đã kết nối tới server",
  });

  socket.on("create_room", (payload, ack) => {
    const clientOrigin =
      typeof payload === "object" && payload?.clientOrigin
        ? String(payload.clientOrigin)
        : CLIENT_ORIGIN;
    const sessionId =
      typeof payload === "object" && payload?.sessionId
        ? String(payload.sessionId).trim()
        : null;
    const playerName = normalizePlayerName(
      typeof payload === "object" && payload?.playerName
        ? String(payload.playerName)
        : "",
    );

    if (!sessionId) {
      const err = {
        error: "MISSING_SESSION",
        message: "Thiếu sessionId",
      };
      if (typeof ack === "function") ack(err);
      return;
    }

    if (!playerName) {
      const err = {
        error: "MISSING_NAME",
        message: "Hãy nhập tên trước khi vào phòng",
      };
      if (typeof ack === "function") ack(err);
      return;
    }

    const roomId = createRoom(sessionId);
    const url = buildRoomUrl(roomId, clientOrigin);

    setPlayerName(roomId, sessionId, playerName);

    console.log(
      `[create_room] ${roomId} host=${playerName} (${sessionId.slice(0, 8)}…) -> ${url}`,
    );

    joinSocketToRoom(socket, roomId, sessionId, playerName, (result) => {
      if (typeof ack === "function") {
        if (result?.error) {
          ack(result);
        } else {
          ack({ ok: true, created: true, url, ...result });
        }
      }
    });
  });

  socket.on("join_room", (payload, ack) => {
    const { roomId, sessionId, playerName } = parseJoinPayload(payload);
    if (!roomId) {
      const err = {
        error: "INVALID_ROOM",
        message: "Mã room không hợp lệ",
      };
      if (typeof ack === "function") ack(err);
      else socket.emit("room:error", err);
      return;
    }

    joinSocketToRoom(socket, roomId, sessionId, playerName, ack);
  });

  socket.on("leave_room", (ack) => {
    const roomId = leaveRoom(socket, true);
    if (!roomId) {
      const err = { error: "NOT_IN_ROOM", message: "Bạn chưa ở trong phòng" };
      if (typeof ack === "function") ack(err);
      return;
    }

    console.log(`[leave_room] ${getSessionId(socket)} <- ${roomId}`);

    socket.emit("room:left", { room: roomId });
    if (typeof ack === "function") {
      ack({ ok: true, room: roomId });
    }
  });

  socket.on("start_game", (ack) => {
    const roomId = getCurrentRoom(socket);
    if (!roomId) {
      const err = { error: "NOT_IN_ROOM", message: "Bạn chưa ở trong phòng" };
      if (typeof ack === "function") ack(err);
      return;
    }

    const result = startGameForRoom(roomId, socket);
    if (typeof ack === "function") ack(result);
  });

  socket.on("submit_answer", (guesses, ack) => {
    const roomId = getCurrentRoom(socket);
    const sessionId = getSessionId(socket);
    if (!roomId || !sessionId) {
      const err = { error: "NOT_IN_ROOM", message: "Bạn chưa ở trong phòng" };
      if (typeof ack === "function") ack(err);
      return;
    }

    const room = getRoom(roomId);
    if (!room || room.status !== "playing" || !room.game) {
      const err = {
        error: "NOT_PLAYING",
        message: "Chưa trong ván chơi",
      };
      if (typeof ack === "function") ack(err);
      return;
    }

    if (room.game.submissions[sessionId]) {
      const err = { error: "ALREADY_SUBMITTED", message: "Bạn đã nộp bài" };
      if (typeof ack === "function") ack(err);
      return;
    }

    if (!validateGuesses(guesses)) {
      const err = {
        error: "INVALID_GUESSES",
        message: "Chọn đủ 6 cặp, mỗi cặp 1 số",
      };
      if (typeof ack === "function") ack(err);
      return;
    }

    const submittedAt = Date.now();
    const elapsedMs = submittedAt - room.game.startedAt;
    const correctCount = scoreGuesses(guesses, room.game.answerKey);

    recordSubmission(roomId, sessionId, {
      guesses: [...guesses],
      correctCount,
      elapsedMs,
      submittedAt,
    });

    const submittedCount = getSubmissionCount(roomId);

    io.to(roomId).emit("game:submit_progress", {
      submittedCount,
      maxMembers: MAX_PLAYERS,
    });
    emitRoomState(roomId);

    console.log(
      `[submit_answer] ${roomId} ${sessionId.slice(0, 8)}…: [${guesses.join(", ")}] → ${correctCount}/6 · ${(elapsedMs / 1000).toFixed(1)}s`,
    );

    if (typeof ack === "function") {
      ack({ ok: true, submittedCount });
    }

    if (allPlayersSubmitted(roomId)) {
      finishGame(roomId);
    }
  });

  socket.on("disconnect", (reason) => {
    const roomId = getCurrentRoom(socket);
    const sessionId = getSessionId(socket);
    if (roomId && sessionId) {
      socket.data.room = null;
      disconnectPlayer(roomId, sessionId);
      emitRoomState(roomId);
      console.log(
        `[disconnect] ${sessionId.slice(0, 8)}… (${reason}), giữ slot trong ${roomId}`,
      );
    } else {
      console.log(`[disconnect] ${socket.id} (${reason})`);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server socket lắng nghe tại http://localhost:${PORT}`);
});

httpServer.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Cổng ${PORT} đang bị chiếm. Dừng process cũ: lsof -i :${PORT} rồi kill <PID>`,
    );
  } else {
    console.error(err);
  }
  process.exit(1);
});
