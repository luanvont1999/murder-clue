import { useState } from "react";
import { GuessPanel } from "./components/GuessPanel";
import { NumberCardImage } from "./components/NumberCardImage";
import { isSelectionsComplete } from "./constants/pairs";
import { useSocket } from "./hooks/useSocket";
import { getRoomFromSearch } from "./utils/roomUrl";
import "./App.css";

function formatSeconds(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function App() {
  const {
    status,
    error,
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
    leaderboard,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    submitAnswer,
    selectPair,
    copyRoomUrl,
    reconnect,
    playerName,
    isNameConfirmed,
    confirmPlayerName,
  } = useSocket();

  const [nameDraft, setNameDraft] = useState(playerName ?? "");
  const [joinCode, setJoinCode] = useState(getRoomFromSearch() ?? "");
  const [copied, setCopied] = useState(false);

  const connected = status === "connected";
  const busy = isJoining || isCreating;
  const inRoom = Boolean(room);
  const finished = roomStatus === "finished" && leaderboard !== null;
  const playing = inRoom && roomStatus === "playing" && myNumbers !== null;
  const waiting = inRoom && roomStatus === "waiting";
  const canSubmit =
    playing && !hasSubmitted && isSelectionsComplete(selections);
  const guessPicked = selections.filter((v) => v !== null).length;

  const handleCopy = async () => {
    if (await copyRoomUrl()) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConfirmName = (e: React.FormEvent) => {
    e.preventDefault();
    confirmPlayerName(nameDraft);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    joinRoom(joinCode);
  };

  return (
    <main className="app">
      <header className="top">
        <h1 className="logo">Murder Clue</h1>
        {status !== "connected" && (
          <button type="button" className="link" onClick={reconnect}>
            {status === "connecting" ? "Đang kết nối…" : "Thử lại"}
          </button>
        )}
      </header>

      {(error || roomError) && (
        <p className="banner banner--error" role="alert">
          {roomError ?? error}
        </p>
      )}

      {finished ? (
        <section className="view view--rank" aria-label="Bảng xếp hạng">
          <h2 className="view-title">Kết quả</h2>
          <ol className="rank-list">
            {leaderboard.map((row) => {
              const isMe = row.playerIndex === playerIndex;
              return (
                <li
                  key={row.playerIndex}
                  className={`rank-row${isMe ? " rank-row--me" : ""}`}
                >
                  <span className="rank-pos">#{row.rank}</span>
                  <span className="rank-name">
                    {isMe
                      ? playerName ?? "Bạn"
                      : row.displayName ?? `Người ${row.playerIndex + 1}`}
                  </span>
                  <span className="rank-score">{row.correctCount}/6</span>
                  <span className="rank-time">{formatSeconds(row.elapsedMs)}</span>
                </li>
              );
            })}
          </ol>
          <button type="button" className="link link--muted" onClick={leaveRoom}>
            Rời phòng
          </button>
        </section>
      ) : playing ? (
        <section className="view view--play">
          <div className="cards-block">
            <p className="label">3 lá của bạn</p>
            <ul className="cards cards--sm">
              {myNumbers.map((n, i) => (
                <li key={`${n}-${i}`}>
                  <NumberCardImage value={n} />
                </li>
              ))}
            </ul>
          </div>

          <div className="guess-block">
            <p className="label">
              Đoán {guessPicked}/6
            </p>
            <GuessPanel
              selections={selections}
              onSelect={selectPair}
              disabled={hasSubmitted || isSubmitting}
            />
            <p className="progress" aria-live="polite">
              {submittedCount}/{maxMembers} đã nộp bài
            </p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={submitAnswer}
              disabled={!canSubmit || isSubmitting || hasSubmitted}
            >
              {isSubmitting
                ? "Đang nộp…"
                : hasSubmitted
                  ? "Đã nộp bài"
                  : "Nộp bài"}
            </button>
            {hasSubmitted && submittedCount < maxMembers && (
              <p className="caption">
                Chờ {maxMembers - submittedCount} người… Kết quả hiện khi đủ 6 người.
              </p>
            )}
          </div>
        </section>
      ) : waiting ? (
        <section className="view view--room">
          <div className="count" aria-live="polite">
            <span className="count__n">{memberCount}</span>
            <span className="count__sep">/</span>
            <span className="count__max">{maxMembers}</span>
          </div>
          <p className="caption">
            {memberCount >= maxMembers
              ? "Đủ người"
              : `Chờ thêm ${maxMembers - memberCount} người`}
          </p>

          {isHost && roomUrl && (
            <button type="button" className="btn btn--ghost" onClick={handleCopy}>
              {copied ? "Đã copy link" : "Copy link mời"}
            </button>
          )}

          {canStart && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={startGame}
              disabled={isStarting}
            >
              {isStarting ? "Đang bắt đầu…" : "Bắt đầu"}
            </button>
          )}

          {!isHost && memberCount < maxMembers && (
            <p className="caption">Chờ chủ phòng bắt đầu</p>
          )}

          <button type="button" className="link link--muted" onClick={leaveRoom}>
            Rời phòng
          </button>
        </section>
      ) : !isNameConfirmed ? (
        <section className="view view--name">
          <p className="label">Nhập tên trước khi vào phòng</p>
          <form className="name-form" onSubmit={handleConfirmName}>
            <input
              className="input input--block"
              type="text"
              autoComplete="nickname"
              autoCapitalize="words"
              maxLength={24}
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Tên của bạn"
              disabled={!connected}
              aria-label="Tên của bạn"
            />
            <button
              type="submit"
              className="btn btn--primary"
              disabled={!connected || !nameDraft.trim()}
            >
              Xác nhận
            </button>
          </form>
        </section>
      ) : (
        <section className="view view--lobby">
          <p className="caption name-greeting">
            Xin chào, <strong>{playerName}</strong>
          </p>

          <button
            type="button"
            className="btn btn--primary"
            onClick={createRoom}
            disabled={!connected || busy}
          >
            {isCreating ? "Đang tạo…" : "Tạo phòng"}
          </button>

          <div className="or">hoặc</div>

          <form className="join" onSubmit={handleJoin}>
            <input
              className="input"
              type="text"
              inputMode="text"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="a1b2c3d4 hoặc link mời"
              disabled={!connected || busy}
              aria-label="Mã phòng hoặc link mời"
            />
            <button
              type="submit"
              className="btn btn--secondary"
              disabled={!connected || !joinCode.trim() || busy}
            >
              {isJoining ? "…" : "Vào"}
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
