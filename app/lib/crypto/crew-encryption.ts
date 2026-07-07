import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "crypto";
import { decryptWithEnvelope } from "../security/envelope-encryption";

const ENCRYPTED_PREFIX = "crew:v1:";
const KEY_ENV_NAMES = ["CREW_ENCRYPTION_MASTER_KEY", "CREW_DATA_ENCRYPTION_KEY", "DATA_ENCRYPTION_KEY", "ULTILOG_MASTER_KEY"];
const HKDF_SALT = "ultilog:crew-pii:v1";
const AES_256_KEY_BYTES = 32;
const GCM_IV_BYTES = 12;
const GCM_TAG_BYTES = 16;

type EncryptedCrewPayload = {
  iv: string;
  tag: string;
  value: string;
};

export function encryptCrewField(ownerId: string, plaintext: string): string {
  const key = deriveCrewKey(ownerId);
  const iv = randomBytes(GCM_IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: GCM_TAG_BYTES });
  const encryptedValue = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const payload: EncryptedCrewPayload = {
    iv: encodeBase64Url(iv),
    tag: encodeBase64Url(cipher.getAuthTag()),
    value: encodeBase64Url(encryptedValue),
  };

  return `${ENCRYPTED_PREFIX}${encodeBase64Url(Buffer.from(JSON.stringify(payload), "utf8"))}`;
}

export function decryptCrewField(ownerId: string, value: string): string {
  if (!value.startsWith(ENCRYPTED_PREFIX)) return decryptWithEnvelope(value);

  const key = deriveCrewKey(ownerId);
  const payload = JSON.parse(decodeBase64Url(value.slice(ENCRYPTED_PREFIX.length)).toString("utf8")) as EncryptedCrewPayload;
  const decipher = createDecipheriv("aes-256-gcm", key, decodeBase64Url(payload.iv), { authTagLength: GCM_TAG_BYTES });
  decipher.setAuthTag(decodeBase64Url(payload.tag));

  return Buffer.concat([decipher.update(decodeBase64Url(payload.value)), decipher.final()]).toString("utf8");
}

export function deriveCrewKey(ownerId: string): Buffer {
  return Buffer.from(hkdfSync("sha256", masterKeyFromEnvironment(), HKDF_SALT, `owner:${ownerId}:crew-pii`, AES_256_KEY_BYTES));
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

function encodeBase64Url(value: Buffer) {
  return value.toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}
