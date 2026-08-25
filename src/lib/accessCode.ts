export interface GeneratedCode {
  code: string;
  createdAt: number;
  expiresAt: number;
}

const SESSION_UNLOCK_KEY = "marso_access_unlocked_until";
const SESSION_PASS_TOKEN_KEY = "marso_datasheet_pass_token";

// 5 Minutes Expiry
export const CODE_EXPIRY_MS = 5 * 60 * 1000;

/**
 * Unlock datasheet downloads for 5 minutes with a server-issued short-lived pass token.
 * Note: The raw access code is NEVER stored in browser storage.
 */
export function unlockSessionAccess(passToken: string) {
  const expiresAt = Date.now() + CODE_EXPIRY_MS;
  try {
    sessionStorage.setItem(SESSION_UNLOCK_KEY, expiresAt.toString());
    if (passToken && typeof passToken === "string") {
      sessionStorage.setItem(SESSION_PASS_TOKEN_KEY, passToken.trim());
    }
  } catch (e) {
    console.error("Failed to set session access unlock:", e);
  }
}

/**
 * Check if the current user session has an active unlocked access pass.
 */
export function isSessionUnlocked(): boolean {
  try {
    const val = sessionStorage.getItem(SESSION_UNLOCK_KEY);
    if (!val) return false;
    const expiresAt = parseInt(val, 10);
    if (isNaN(expiresAt) || Date.now() >= expiresAt) {
      clearSessionAccess();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the currently stored server-issued short-lived pass token.
 */
export function getSessionPassToken(): string {
  if (!isSessionUnlocked()) return "";
  try {
    return sessionStorage.getItem(SESSION_PASS_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

/**
 * Clear the current session unlock status and stored pass token.
 */
export function clearSessionAccess(): void {
  try {
    sessionStorage.removeItem(SESSION_UNLOCK_KEY);
    sessionStorage.removeItem(SESSION_PASS_TOKEN_KEY);
  } catch {}
}
