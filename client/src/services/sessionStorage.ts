export interface StoredSession {
  roomCode: string;
  playerId: string;
  sessionToken: string;
  nickname: string;
  avatar: string;
  color: string;
}

const SESSION_KEY = 'campfire_wolves_session_v1';

export function saveSessionToStorage(session: StoredSession): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadSessionFromStorage(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export function clearSessionFromStorage(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore
  }
}
