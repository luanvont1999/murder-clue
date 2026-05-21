import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { emptySelections } from "../constants/pairs";
import { isSelectionsComplete } from "../constants/pairs";
import type {
  ConnectionStatus,
  GameEndedPayload,
  GameStartedPayload,
  GameSubmitProgressPayload,
  LeaderboardEntry,
  RoomAck,
  RoomErrorPayload,
  RoomStatePayload,
  RoomStatus,
  SubmitAnswerAck,
} from "../types/socket";
import {
  getStoredPlayerName,
  isPlayerNameConfirmed,
  normalizePlayerName,
  savePlayerName,
} from "../utils/playerName";
import { getOrCreateSessionId } from "../utils/session";
import {
  buildRoomUrl,
  getClientOrigin,
  getRoomFromSearch,
  normalizeRoomInput,
  setRoomInUrl,
} from "../utils/roomUrl";

function resolveServerUrl() {
  const fromEnv = import.meta.env.VITE_SERVER_URL?.trim();
  if (fromEnv) return fromEnv;
  if (import.meta.env.DEV) return "http://localhost:4001";
  return window.location.origin;
}

const JOIN_TIMEOUT_MS = 5000;
const SUBMIT_TIMEOUT_MS = 8000;

function applyRoomState(
  payload: RoomStatePayload,
  setters: {
    setRoom: (r: string) => void;
    setMemberCount: (n: number) => void;
    setMaxMembers: (n: number) => void;
    setRoomUrl: (u: string | null) => void;
    setRoomError: (e: string | null) => void;
    setIsJoining: (v: boolean) => void;
    setIsHost: (v: boolean) => void;
    setCanStart: (v: boolean) => void;
    setRoomStatus: (s: RoomStatus) => void;
    setHasSubmitted: (v: boolean) => void;
    setSubmittedCount: (n: number) => void;
    setMyResult: (
      r: { correctCount: number; elapsedMs: number } | null,
    ) => void;
  },
) {
  setters.setRoom(payload.room);
  setters.setMemberCount(payload.members);
  setters.setMaxMembers(payload.maxMembers);
  setters.setRoomUrl(payload.url ?? null);
  setters.setRoomError(null);
  setters.setIsJoining(false);
  setters.setIsHost(payload.isHost);
  setters.setCanStart(payload.canStart);
  setters.setRoomStatus(payload.status);
  setters.setHasSubmitted(Boolean(payload.hasSubmitted));
  setters.setSubmittedCount(payload.submittedCount ?? 0);
  if (payload.myResult) {
    setters.setMyResult(payload.myResult);
  } else if (!payload.hasSubmitted) {
    setters.setMyResult(null);
  }
  setRoomInUrl(payload.room);
}

function clearRoomState(setters: {
  setRoom: (r: string | null) => void;
  setRoomUrl: (u: string | null) => void;
  setMemberCount: (n: number) => void;
  setIsHost: (v: boolean) => void;
  setCanStart: (v: boolean) => void;
  setRoomStatus: (s: RoomStatus) => void;
  setMyNumbers: (n: number[] | null) => void;
  setPlayerIndex: (i: number | null) => void;
  setHasSubmitted: (v: boolean) => void;
  setSubmittedCount: (n: number) => void;
  setSelections: (s: (number | null)[]) => void;
  setMyResult: (r: { correctCount: number; elapsedMs: number } | null) => void;
  setLeaderboard: (l: LeaderboardEntry[] | null) => void;
}) {
  setters.setRoom(null);
  setters.setRoomUrl(null);
  setters.setMemberCount(0);
  setters.setIsHost(false);
  setters.setCanStart(false);
  setters.setRoomStatus("waiting");
  setters.setMyNumbers(null);
  setters.setPlayerIndex(null);
  setters.setHasSubmitted(false);
  setters.setSubmittedCount(0);
  setters.setSelections(emptySelections());
  setters.setMyResult(null);
  setters.setLeaderboard(null);
  setRoomInUrl(null);
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const roomRef = useRef<string | null>(null);
  const sessionIdRef = useRef(getOrCreateSessionId());
  const playerIndexRef = useRef<number | null>(null);
  const playerNameRef = useRef(getStoredPlayerName());
  const nameConfirmedRef = useRef(isPlayerNameConfirmed());
  const pendingJoinRef = useRef<string | null>(getRoomFromSearch());
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [playerName, setPlayerName] = useState<string | null>(
    () => getStoredPlayerName(),
  );
  const [isNameConfirmed, setIsNameConfirmed] = useState(
    () => isPlayerNameConfirmed(),
  );
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [maxMembers, setMaxMembers] = useState(6);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [canStart, setCanStart] = useState(false);
  const [roomStatus, setRoomStatus] = useState<RoomStatus>("waiting");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [submittedCount, setSubmittedCount] = useState(0);
  const [selections, setSelections] = useState<(number | null)[]>(emptySelections);
  const [myNumbers, setMyNumbers] = useState<number[] | null>(null);
  const [playerIndex, setPlayerIndex] = useState<number | null>(null);
  const [myResult, setMyResult] = useState<{
    correctCount: number;
    elapsedMs: number;
  } | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    playerIndexRef.current = playerIndex;
  }, [playerIndex]);

  const roomSetters = {
    setRoom,
    setMemberCount,
    setMaxMembers,
    setRoomUrl,
    setRoomError,
    setIsJoining,
    setIsHost,
    setCanStart,
    setRoomStatus,
    setHasSubmitted,
    setSubmittedCount,
    setMyResult,
  };

  const clearSetters = {
    setRoom,
    setRoomUrl,
    setMemberCount,
    setIsHost,
    setCanStart,
    setRoomStatus,
    setMyNumbers,
    setPlayerIndex,
    setHasSubmitted,
    setSubmittedCount,
    setSelections,
    setMyResult,
    setLeaderboard,
  };

  const handleRoomAck = useCallback(
    (ack: RoomAck | undefined, settled: { value: boolean }) => {
      if (settled.value) return;
      settled.value = true;
      setIsJoining(false);
      setIsCreating(false);

      if (!ack) {
        setRoomError(
          "Server không phản hồi — hãy restart server (npm start trong thư mục server).",
        );
        return;
      }
      if (ack.error) {
        setRoomError(ack.message ?? ack.error);
        return;
      }
      if (ack.room && ack.members !== undefined) {
        applyRoomState(ack as RoomStatePayload, roomSetters);
      }
    },
    [],
  );

  const rejoinRoom = useCallback(
    (socket: Socket, roomId: string) => {
      if (!playerNameRef.current) return;
      setIsJoining(true);
      socket.emit(
        "join_room",
        {
          room: roomId,
          sessionId: sessionIdRef.current,
          playerName: playerNameRef.current,
        },
        (ack: RoomAck | undefined) => {
          handleRoomAck(ack, { value: false });
        },
      );
    },
    [handleRoomAck],
  );

  const confirmPlayerName = useCallback(
    (raw: string) => {
      const name = normalizePlayerName(raw);
      if (!name) {
        setRoomError("Tên từ 1–24 ký tự");
        return false;
      }
      savePlayerName(name);
      playerNameRef.current = name;
      nameConfirmedRef.current = true;
      setPlayerName(name);
      setIsNameConfirmed(true);
      setRoomError(null);

      const pending = pendingJoinRef.current;
      if (pending && socketRef.current?.connected) {
        pendingJoinRef.current = null;
        rejoinRoom(socketRef.current, pending);
      }
      return true;
    },
    [rejoinRoom],
  );

  const emitWithTimeout = useCallback(
    (
      emit: (ack: (ack: RoomAck | undefined) => void) => void,
      onStart: () => void,
    ) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        setRoomError("Chưa kết nối server");
        return;
      }

      setRoomError(null);
      onStart();

      const settled = { value: false };
      const timeoutId = window.setTimeout(() => {
        if (settled.value) return;
        settled.value = true;
        setIsJoining(false);
        setIsCreating(false);
        setRoomError(
          "Server không phản hồi. Hãy restart server (Ctrl+C rồi npm start).",
        );
      }, JOIN_TIMEOUT_MS);

      emit((ack) => {
        window.clearTimeout(timeoutId);
        handleRoomAck(ack, settled);
      });
    },
    [handleRoomAck],
  );

  useEffect(() => {
    const socket = io(resolveServerUrl(), {
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setStatus("connected");
      setError(null);

      const targetRoom = roomRef.current ?? pendingJoinRef.current;
      if (targetRoom && nameConfirmedRef.current && playerNameRef.current) {
        if (!roomRef.current) {
          pendingJoinRef.current = null;
        }
        rejoinRoom(socket, targetRoom);
      }
    });

    socket.on("disconnect", () => {
      setStatus("disconnected");
    });

    socket.on("connect_error", (err) => {
      setStatus("disconnected");
      setError(err.message);
    });

    socket.on("room:joined", (payload: RoomStatePayload) => {
      applyRoomState(payload, roomSetters);
    });

    socket.on("room:state", (payload: RoomStatePayload) => {
      if (payload.room === roomRef.current) {
        applyRoomState(payload, roomSetters);
      }
    });

    socket.on("room:left", () => {
      clearRoomState(clearSetters);
    });

    socket.on("room:error", (payload: RoomErrorPayload) => {
      setRoomError(payload.message);
      setIsJoining(false);
      setIsCreating(false);
      setIsStarting(false);
      setIsSubmitting(false);
    });

    socket.on("game:started", (payload: GameStartedPayload) => {
      setMyNumbers(payload.myNumbers);
      setPlayerIndex(payload.playerIndex);
      playerIndexRef.current = payload.playerIndex;
      setRoomStatus("playing");
      setCanStart(false);
      setIsStarting(false);
      setHasSubmitted(false);
      setSubmittedCount(0);
      setSelections(emptySelections());
      setMyResult(null);
      setLeaderboard(null);
    });

    socket.on("game:submit_progress", (payload: GameSubmitProgressPayload) => {
      setSubmittedCount(payload.submittedCount);
      setIsSubmitting(false);
    });

    socket.on("game:ended", (payload: GameEndedPayload) => {
      setLeaderboard(payload.leaderboard);
      setRoomStatus("finished");
      setIsSubmitting(false);
      const idx = playerIndexRef.current;
      if (idx !== null) {
        const me = payload.leaderboard.find((row) => row.playerIndex === idx);
        if (me) {
          setMyResult({
            correctCount: me.correctCount,
            elapsedMs: me.elapsedMs,
          });
        }
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [handleRoomAck, rejoinRoom]);

  const selectPair = useCallback((pairIndex: number, value: number) => {
    setSelections((prev) => {
      const next = [...prev];
      next[pairIndex] = value;
      return next;
    });
  }, []);

  const createRoom = useCallback(() => {
    if (!playerNameRef.current) {
      setRoomError("Hãy xác nhận tên trước");
      return;
    }
    emitWithTimeout((ack) => {
      setIsCreating(true);
      socketRef.current?.emit(
        "create_room",
        {
          clientOrigin: getClientOrigin(),
          sessionId: sessionIdRef.current,
          playerName: playerNameRef.current,
        },
        ack,
      );
    }, () => setIsCreating(true));
  }, [emitWithTimeout]);

  const joinRoom = useCallback(
    (raw: string) => {
      if (!playerNameRef.current) {
        setRoomError("Hãy xác nhận tên trước");
        return;
      }
      const roomId = normalizeRoomInput(raw);
      if (!roomId) {
        setRoomError(
          "Mã phòng không hợp lệ — nhập 8 ký tự 0–9, a–f (vd. a1b2c3d4) hoặc dán link mời",
        );
        return;
      }
      emitWithTimeout((ack) => {
        setIsJoining(true);
        socketRef.current?.emit(
          "join_room",
          {
            room: roomId,
            sessionId: sessionIdRef.current,
            playerName: playerNameRef.current,
          },
          ack,
        );
      }, () => setIsJoining(true));
    },
    [emitWithTimeout],
  );

  const leaveRoom = useCallback(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;

    socket.emit("leave_room", (ack: RoomAck) => {
      if (ack.ok) {
        clearRoomState(clearSetters);
        setRoomError(null);
      }
    });
  }, []);

  const startGame = useCallback(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;

    setRoomError(null);
    setIsStarting(true);
    socket.emit("start_game", (ack: RoomAck) => {
      setIsStarting(false);
      if (ack.error) {
        setRoomError(ack.message ?? ack.error);
      }
    });
  }, []);

  const submitAnswer = useCallback(() => {
    const socket = socketRef.current;
    if (!socket?.connected || hasSubmitted) return;
    if (!isSelectionsComplete(selections)) {
      setRoomError("Chọn đủ 6 cặp trước khi nộp bài");
      return;
    }

    setRoomError(null);
    setIsSubmitting(true);
    const guesses = selections as number[];

    let settled = false;
    const finish = (ack?: SubmitAnswerAck) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      setIsSubmitting(false);

      if (!ack) {
        setRoomError(
          "Không nhận phản hồi từ server. Hãy restart server và thử lại.",
        );
        return;
      }
      if (ack.error) {
        setRoomError(ack.message ?? ack.error);
        return;
      }
      setHasSubmitted(true);
      if (ack.submittedCount !== undefined) {
        setSubmittedCount(ack.submittedCount);
      }
    };

    const timeoutId = window.setTimeout(() => finish(), SUBMIT_TIMEOUT_MS);

    socket.emit("submit_answer", guesses, (ack: SubmitAnswerAck) => {
      finish(ack);
    });
  }, [hasSubmitted, selections]);

  const copyRoomUrl = useCallback(async () => {
    if (!room) return false;
    const link = buildRoomUrl(room);
    await navigator.clipboard.writeText(link);
    setRoomUrl(link);
    return true;
  }, [room]);

  const reconnect = useCallback(() => {
    socketRef.current?.connect();
    setStatus("connecting");
    setError(null);
  }, []);

  return {
    status,
    error,
    playerName,
    isNameConfirmed,
    confirmPlayerName,
    room,
    roomUrl,
    memberCount,
    maxMembers,
    roomError,
    isJoining,
    isCreating,
    isStarting,
    isSubmitting,
    isHost,
    canStart,
    roomStatus,
    hasSubmitted,
    submittedCount,
    selections,
    myNumbers,
    playerIndex,
    myResult,
    leaderboard,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    submitAnswer,
    selectPair,
    copyRoomUrl,
    reconnect,
  };
}
