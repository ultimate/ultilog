/**
 * Passwords are normalized to Unicode NFC before they are measured and hashed.
 * This makes canonically equivalent Unicode input authenticate consistently.
 * The maximum is measured as UTF-8 bytes because bcrypt only processes 72 bytes.
 */
export const PASSWORD_MIN_CHARACTERS = 15;
export const PASSWORD_MAX_UTF8_BYTES = 72;

const compromisedPasswords = new Set([
  "123456789012345",
  "correcthorsebatterystaple",
  "iloveyouiloveyou",
  "letmeinletmeinletmein",
  "password123456789",
  "passwordpassword",
  "qwertyuiopasdfgh",
]);

export class PasswordPolicyError extends Error {
  constructor() {
    super("Password does not meet the password policy.");
    this.name = "PasswordPolicyError";
  }
}

export function applyPasswordPolicy(password: string): string {
  const normalized = password.normalize("NFC");
  const characters = Array.from(normalized);
  const folded = normalized.toLocaleLowerCase("en-US");

  if (
    characters.length < PASSWORD_MIN_CHARACTERS
    || new TextEncoder().encode(normalized).byteLength > PASSWORD_MAX_UTF8_BYTES
    || compromisedPasswords.has(folded)
    || /^(.)\1+$/u.test(normalized)
    || isRepeatedUnit(folded)
    || isPredictableSequence(folded)
  ) {
    throw new PasswordPolicyError();
  }

  return normalized;
}

function isRepeatedUnit(password: string) {
  for (let size = 1; size <= Math.min(8, Math.floor(password.length / 2)); size += 1) {
    if (password.length % size === 0 && password === password.slice(0, size).repeat(password.length / size)) return true;
  }
  return false;
}

function isPredictableSequence(password: string) {
  const compact = password.replace(/[^a-z0-9]/g, "");
  const sequences = ["0123456789", "9876543210", "abcdefghijklmnopqrstuvwxyz", "zyxwvutsrqponmlkjihgfedcba", "qwertyuiopasdfghjklzxcvbnm"];
  return compact.length >= PASSWORD_MIN_CHARACTERS && sequences.some((sequence) => sequence.includes(compact));
}
