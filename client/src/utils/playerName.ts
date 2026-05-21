const NAME_KEY = "murder-clue:player-name";
const CONFIRMED_KEY = "murder-clue:name-confirmed";

export function normalizePlayerName(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (trimmed.length < 1 || trimmed.length > 24) return null;
  return trimmed;
}

export function getStoredPlayerName(): string | null {
  try {
    const name = sessionStorage.getItem(NAME_KEY);
    return name ? normalizePlayerName(name) : null;
  } catch {
    return null;
  }
}

export function isPlayerNameConfirmed(): boolean {
  try {
    return sessionStorage.getItem(CONFIRMED_KEY) === "1" && Boolean(getStoredPlayerName());
  } catch {
    return false;
  }
}

export function savePlayerName(name: string) {
  const normalized = normalizePlayerName(name);
  if (!normalized) return;
  try {
    sessionStorage.setItem(NAME_KEY, normalized);
    sessionStorage.setItem(CONFIRMED_KEY, "1");
  } catch {
    /* ignore */
  }
}
