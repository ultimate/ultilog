import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "crypto";
import { decryptWithEnvelope } from "../security/envelope-encryption";

const LEGACY_ENCRYPTED_PREFIX = "crew:v1:";
const ENCRYPTION_VERSION = 1;
const ENCRYPTION_ALGORITHM = "AES-256-GCM";
const KEY_ID = "crew-pii-v1";
const KEY_ENV_NAMES = ["CREW_ENCRYPTION_MASTER_KEY", "CREW_DATA_ENCRYPTION_KEY", "DATA_ENCRYPTION_KEY", "ULTILOG_MASTER_KEY"];
const HKDF_SALT = "ultilog:crew-pii:v1";
const AES_256_KEY_BYTES = 32;
const GCM_IV_BYTES = 12;
const GCM_TAG_BYTES = 16;

type LegacyEncryptedCrewPayload = {
  iv: string;
  tag: string;
  value: string;
};

export type CrewEncryptionEnvelope = {
  v: number;
  alg: typeof ENCRYPTION_ALGORITHM;
  kid: typeof KEY_ID;
  iv: string;
  ct: string;
  tag: string;
};

export function encryptCrewField(ownerId: string, plaintext: string): string {
  const key = deriveCrewKey(ownerId);
  const iv = randomBytes(GCM_IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: GCM_TAG_BYTES });
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const envelope: CrewEncryptionEnvelope = {
    v: ENCRYPTION_VERSION,
    alg: ENCRYPTION_ALGORITHM,
    kid: KEY_ID,
    iv: encodeBase64(iv),
    ct: encodeBase64(ciphertext),
    tag: encodeBase64(cipher.getAuthTag()),
  };

  return JSON.stringify(envelope);
}

export function decryptCrewField(ownerId: string, value: string): string {
  if (value.startsWith(LEGACY_ENCRYPTED_PREFIX)) return decryptLegacyCrewField(ownerId, value);
  if (!looksLikeJsonEnvelope(value)) return decryptWithEnvelope(value);

  const key = deriveCrewKey(ownerId);
  const envelope = parseCrewEncryptionEnvelope(value);
  const decipher = createDecipheriv("aes-256-gcm", key, decodeRequiredBase64(envelope.iv, "iv", GCM_IV_BYTES), { authTagLength: GCM_TAG_BYTES });
  decipher.setAuthTag(decodeRequiredBase64(envelope.tag, "tag", GCM_TAG_BYTES));

  return Buffer.concat([decipher.update(decodeRequiredBase64(envelope.ct, "ct")), decipher.final()]).toString("utf8");
}

export function parseCrewEncryptionEnvelope(value: string): CrewEncryptionEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Encrypted crew field is not a valid JSON envelope.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Encrypted crew field envelope must be a JSON object.");
  const envelope = parsed as Record<string, unknown>;

  if (envelope.v !== ENCRYPTION_VERSION) throw new Error(`Unsupported crew encryption envelope version: ${String(envelope.v)}.`);
  if (envelope.alg !== ENCRYPTION_ALGORITHM) throw new Error(`Unsupported crew encryption algorithm: ${String(envelope.alg)}.`);
  if (envelope.kid !== KEY_ID) throw new Error(`Unsupported crew encryption key id: ${String(envelope.kid)}.`);

  for (const field of ["iv", "ct", "tag"] as const) {
    if (typeof envelope[field] !== "string") throw new Error(`Encrypted crew field envelope is missing ${field}.`);
  }
  const validatedEnvelope = envelope as CrewEncryptionEnvelope;
  for (const field of ["iv", "tag"] as const) {
    if (validatedEnvelope[field].length === 0) throw new Error(`Encrypted crew field envelope is missing ${field}.`);
  }

  decodeRequiredBase64(validatedEnvelope.iv, "iv", GCM_IV_BYTES);
  decodeRequiredBase64(validatedEnvelope.tag, "tag", GCM_TAG_BYTES);
  decodeRequiredBase64(validatedEnvelope.ct, "ct");

  return validatedEnvelope;
}

export function deriveCrewKey(ownerId: string): Buffer {
  return Buffer.from(hkdfSync("sha256", masterKeyFromEnvironment(), HKDF_SALT, `owner:${ownerId}:crew-pii`, AES_256_KEY_BYTES));
}

function decryptLegacyCrewField(ownerId: string, value: string): string {
  const key = deriveCrewKey(ownerId);
  const payload = JSON.parse(decodeBase64Url(value.slice(LEGACY_ENCRYPTED_PREFIX.length)).toString("utf8")) as LegacyEncryptedCrewPayload;
  const decipher = createDecipheriv("aes-256-gcm", key, decodeBase64Url(payload.iv), { authTagLength: GCM_TAG_BYTES });
  decipher.setAuthTag(decodeBase64Url(payload.tag));

  return Buffer.concat([decipher.update(decodeBase64Url(payload.value)), decipher.final()]).toString("utf8");
}

function masterKeyFromEnvironment() {
  const configured = KEY_ENV_NAMES.map((name) => process.env[name]).find((value) => value);
  if (!configured) throw new Error(`Missing crew encryption master key. Set one of: ${KEY_ENV_NAMES.join(", ")}.`);

  const decoded = decodeConfiguredKey(configured.trim());
  if (decoded.length !== AES_256_KEY_BYTES) throw new Error("Crew encryption master key must decode to 32 bytes for AES-256-GCM.");
  return decoded;
}

function decodeConfiguredKey(value: string) {
  if (/^[0-9a-f]{64}$/i.test(value)) return Buffer.from(value, "hex");

  for (const encoding of ["base64", "base64url"] as const) {
    const decoded = Buffer.from(value, encoding);
    if (decoded.length === AES_256_KEY_BYTES) return decoded;
  }

  return Buffer.from(value, "utf8");
}

function looksLikeJsonEnvelope(value: string) {
  const trimmed = value.trimStart();
  if (!trimmed.startsWith("{")) return false;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return true;
    return ["v", "alg", "kid", "iv", "ct", "tag"].some((field) => field in parsed);
  } catch {
    return true;
  }
}

function encodeBase64(value: Buffer) {
  return value.toString("base64");
}

function decodeRequiredBase64(value: string, field: string, expectedBytes?: number) {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error(`Encrypted crew field envelope ${field} is not valid base64.`);
  const decoded = Buffer.from(value, "base64");
  if (expectedBytes !== undefined && decoded.length !== expectedBytes) throw new Error(`Encrypted crew field envelope ${field} must decode to ${expectedBytes} bytes.`);
  return decoded;
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}
