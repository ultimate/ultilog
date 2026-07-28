import { afterEach, describe, expect, it } from "vitest";
import { decryptWithEnvelope, encryptWithEnvelope } from "../../../../app/lib/security/envelope-encryption";

const keyNames = ["CREW_DATA_ENCRYPTION_KEY", "DATA_ENCRYPTION_KEY", "ULTILOG_MASTER_KEY"];
const hexKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const base64Key = Buffer.from("12345678901234567890123456789012", "utf8").toString("base64");

describe("envelope encryption", () => {
  afterEach(() => {
    for (const keyName of keyNames) delete process.env[keyName];
  });

  it("returns plaintext values that are not envelope-encrypted", () => {
    process.env.CREW_DATA_ENCRYPTION_KEY = hexKey;

    expect(decryptWithEnvelope("plain text")).toBe("plain text");
  });

  it("encrypts and decrypts values with a hex master key", () => {
    process.env.CREW_DATA_ENCRYPTION_KEY = hexKey;

    const encrypted = encryptWithEnvelope("sensitive crew data");

    expect(encrypted).toMatch(/^enc:v1:/);
    expect(encrypted).not.toContain("sensitive crew data");
    expect(decryptWithEnvelope(encrypted)).toBe("sensitive crew data");
  });

  it("accepts fallback base64 master keys", () => {
    process.env.DATA_ENCRYPTION_KEY = base64Key;

    const encrypted = encryptWithEnvelope("fallback key data");

    expect(decryptWithEnvelope(encrypted)).toBe("fallback key data");
  });

  it("throws when no master key is configured", () => {
    for (const keyName of keyNames) delete process.env[keyName];

    expect(() => encryptWithEnvelope("secret")).toThrow("Missing crew data encryption master key");
  });

  it("throws when the configured master key has an invalid length", () => {
    process.env.CREW_DATA_ENCRYPTION_KEY = "too-short";

    expect(() => encryptWithEnvelope("secret")).toThrow("must decode to 32 bytes");
  });

  it("rejects tampered encrypted payloads", () => {
    process.env.CREW_DATA_ENCRYPTION_KEY = hexKey;
    const encrypted = encryptWithEnvelope("integrity protected");
    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith("A") ? "B" : "A"}`;

    expect(() => decryptWithEnvelope(tampered)).toThrow();
  });
});
