const SESSION_KEY = "murder-clue:session";

function randomSessionId() {
  return crypto.randomUUID();
}

/** ID ổn định qua F5 (sessionStorage), dùng để server nhận lại cùng slot phòng. */
export function getOrCreateSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = randomSessionId();
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return randomSessionId();
  }
}
