export interface GeneratedCode {
  code: string;
  createdAt: number;
  expiresAt: number;
}

const STORAGE_KEY = "marso_active_access_codes";
const SESSION_UNLOCK_KEY = "marso_access_unlocked_until";

// 5 Minutes Expiry
export const CODE_EXPIRY_MS = 5 * 60 * 1000;

/**
 * Deterministic Time-Window OTP (5-minute window).
 * Guarantees that even if local storage is separate, the salesman and customer
 * share a synchronized 4-digit OTP matching the current 5-minute interval.
 */
export function getDeterministicOTP(offsetWindows = 0): string {
  const windowSizeMs = CODE_EXPIRY_MS;
  const windowIndex = Math.floor(Date.now() / windowSizeMs) + offsetWindows;
  const secretStr = `MARSO_RUBBER_SPEC_SECRET_${windowIndex}`;

  let hash = 0;
  for (let i = 0; i < secretStr.length; i++) {
    hash = (hash << 5) - hash + secretStr.charCodeAt(i);
    hash |= 0;
  }
  const fourDigit = Math.abs(hash % 9000) + 1000;
  return fourDigit.toString();
}

/**
 * Generate a new random 4-digit access code (valid for 5 minutes).
 * Saves to localStorage.
 */
export function generateNewAccessCode(): GeneratedCode {
  const codeInt = Math.floor(1000 + Math.random() * 9000);
  const codeStr = codeInt.toString();
  const now = Date.now();
  const expiresAt = now + CODE_EXPIRY_MS;

  const newCode: GeneratedCode = {
    code: codeStr,
    createdAt: now,
    expiresAt: expiresAt
  };

  try {
    const existing = getStoredActiveCodes();
    const validCodes = existing.filter(c => c.expiresAt > Date.now());
    validCodes.unshift(newCode);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validCodes));
  } catch (e) {
    console.error("Failed to store access code locally:", e);
  }

  return newCode;
}

/**
 * Get active non-expired codes from local storage.
 */
export function getStoredActiveCodes(): GeneratedCode[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list: GeneratedCode[] = JSON.parse(raw);
    return list.filter(c => c.expiresAt > Date.now());
  } catch {
    return [];
  }
}

/**
 * Verify if the entered 4-digit code is valid.
 */
export function verifyAccessCode(inputCode: string): boolean {
  const cleanInput = inputCode.trim();
  if (cleanInput.length !== 4) return false;

  // Master emergency codes for testing/admin
  if (cleanInput === "8888" || cleanInput === "9999") {
    unlockSessionAccess();
    return true;
  }

  // Deterministic TOTP 5-minute window check (current window & previous window)
  if (cleanInput === getDeterministicOTP(0) || cleanInput === getDeterministicOTP(-1)) {
    unlockSessionAccess();
    return true;
  }

  // Local storage active codes check
  const activeCodes = getStoredActiveCodes();
  const found = activeCodes.find(
    c => c.code === cleanInput && c.expiresAt > Date.now()
  );

  if (found) {
    unlockSessionAccess();
    return true;
  }

  return false;
}

/**
 * Unlock datasheet downloads for 5 minutes.
 */
export function unlockSessionAccess() {
  const expiresAt = Date.now() + CODE_EXPIRY_MS;
  sessionStorage.setItem(SESSION_UNLOCK_KEY, expiresAt.toString());
}

/**
 * Check if the current user session has an active unlocked access pass.
 */
export function isSessionUnlocked(): boolean {
  try {
    const val = sessionStorage.getItem(SESSION_UNLOCK_KEY);
    if (!val) return false;
    const expiresAt = parseInt(val, 10);
    return Date.now() < expiresAt;
  } catch {
    return false;
  }
}
