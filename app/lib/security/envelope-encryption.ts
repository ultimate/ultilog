import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ENCRYPTED_PREFIX = "enc:v1:";
const KEY_ENV_NAMES = ["CREW_DATA_ENCRYPTION_KEY", "DATA_ENCRYPTION_KEY", "ULTILOG_MASTER_KEY"];
const AES_256_KEY_BYTES = 32;
const GCM_IV_BYTES = 12;
const GCM_TAG_BYTES = 16;

type EncryptedPayload = {
  dek: string;
  dekIv: string;
  dekTag: string;
  iv: string;
  tag: string;
  value: string;
};

export function encryptWithEnvelope(plaintext: string): string {
  const masterKey = masterKeyFromEnvironment();
  const dataKey = randomBytes(AES_256_KEY_BYTES);
  const valueIv = randomBytes(GCM_IV_BYTES);
  const valueCipher = createCipheriv("aes-256-gcm", dataKey, valueIv, { authTagLength: GCM_TAG_BYTES });
  const encryptedValue = Buffer.concat([valueCipher.update(plaintext, "utf8"), valueCipher.final()]);
  const valueTag = valueCipher.getAuthTag();

  const dekIv = randomBytes(GCM_IV_BYTES);
  const dekCipher = createCipheriv("aes-256-gcm", masterKey, dekIv, { authTagLength: GCM_TAG_BYTES });
  const encryptedDataKey = Buffer.concat([dekCipher.update(dataKey), dekCipher.final()]);
  const dekTag = dekCipher.getAuthTag();

  const payload: EncryptedPayload = {
    dek: encodeBase64Url(encryptedDataKey),
    dekIv: encodeBase64Url(dekIv),
    dekTag: encodeBase64Url(dekTag),
    iv: encodeBase64Url(valueIv),
    tag: encodeBase64Url(valueTag),
    value: encodeBase64Url(encryptedValue),
  };
  return `${ENCRYPTED_PREFIX}${encodeBase64Url(Buffer.from(JSON.stringify(payload), "utf8"))}`;
}

export function decryptWithEnvelope(value: string): string {
  if (!value.startsWith(ENCRYPTED_PREFIX)) return value;

  const masterKey = masterKeyFromEnvironment();
  const payload = JSON.parse(decodeBase64Url(value.slice(ENCRYPTED_PREFIX.length)).toString("utf8")) as EncryptedPayload;
  const dekDecipher = createDecipheriv("aes-256-gcm", masterKey, decodeBase64Url(payload.dekIv), { authTagLength: GCM_TAG_BYTES });
  dekDecipher.setAuthTag(decodeBase64Url(payload.dekTag));
  const dataKey = Buffer.concat([dekDecipher.update(decodeBase64Url(payload.dek)), dekDecipher.final()]);

  const valueDecipher = createDecipheriv("aes-256-gcm", dataKey, decodeBase64Url(payload.iv), { authTagLength: GCM_TAG_BYTES });
  valueDecipher.setAuthTag(decodeBase64Url(payload.tag));
  return Buffer.concat([valueDecipher.update(decodeBase64Url(payload.value)), valueDecipher.final()]).toString("utf8");
}

function masterKeyFromEnvironment() {
  const configured = KEY_ENV_NAMES.map((name) => process.env[name]).find((value) => value);
  if (!configured) throw new Error(`Missing crew data encryption master key. Set one of: ${KEY_ENV_NAMES.join(", ")}.`);

  const trimmed = configured.trim();
  const decoded = decodeConfiguredKey(trimmed);
  if (decoded.length !== AES_256_KEY_BYTES) throw new Error("Crew data encryption master key must decode to 32 bytes for AES-256-GCM.");
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
