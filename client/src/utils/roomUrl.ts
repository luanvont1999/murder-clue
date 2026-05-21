const ROOM_ID_RE = /^[a-f0-9]{8}$/;

/** Chuẩn hóa mã phòng: 8 ký tự hex, hoặc trích từ link ?room=… */
export function normalizeRoomInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const fromParam = trimmed.match(/[?&]room=([a-f0-9]{8})/i)?.[1];
  if (fromParam) return fromParam.toLowerCase();

  try {
    if (trimmed.includes("://") || trimmed.startsWith("/")) {
      const url = trimmed.startsWith("/")
        ? new URL(trimmed, window.location.origin)
        : new URL(trimmed);
      const room = url.searchParams.get("room")?.trim().toLowerCase();
      if (room && ROOM_ID_RE.test(room)) return room;
    }
  } catch {
    /* not a URL */
  }

  const code = trimmed.toLowerCase();
  return ROOM_ID_RE.test(code) ? code : null;
}

export function getRoomFromSearch(search = window.location.search): string | null {
  const room = new URLSearchParams(search).get("room")?.trim().toLowerCase();
  if (!room || !ROOM_ID_RE.test(room)) return null;
  return room;
}

export function buildRoomUrl(roomId: string): string {
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set("room", roomId);
  return url.toString();
}

export function setRoomInUrl(roomId: string | null) {
  const url = new URL(window.location.href);
  if (roomId) {
    url.searchParams.set("room", roomId);
  } else {
    url.searchParams.delete("room");
  }
  window.history.replaceState({}, "", url);
}

export function getClientOrigin(): string {
  return window.location.origin;
}
