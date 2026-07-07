import { beforeEach, describe, expect, it } from "vitest";
import { decryptCrewField, deriveCrewKey, encryptCrewField, parseCrewEncryptionEnvelope } from "../../../../app/lib/crypto/crew-encryption";

const testMasterKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("crew encryption", () => {
  beforeEach(() => {
    process.env.CREW_ENCRYPTION_MASTER_KEY = testMasterKey;
    delete process.env.CREW_DATA_ENCRYPTION_KEY;
  });

  it("encrypts and decrypts crew fields as JSON AES-GCM envelopes with an owner-derived key", () => {
    const encrypted = encryptCrewField("owner-a", "crew-1", "name", "Ada Lovelace");
    const envelope = parseCrewEncryptionEnvelope(encrypted);

    expect(encrypted).not.toContain("Ada Lovelace");
    expect(envelope).toMatchObject({ v: 1, alg: "AES-256-GCM", kid: "crew-pii-v1" });
    expect(envelope.iv).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(envelope.ct).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(envelope.tag).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(decryptCrewField("owner-a", "crew-1", "name", encrypted)).toBe("Ada Lovelace");
  });

  it("derives distinct stable keys for different owners", () => {
    expect(deriveCrewKey("owner-a")).toEqual(deriveCrewKey("owner-a"));
    expect(deriveCrewKey("owner-a")).not.toEqual(deriveCrewKey("owner-b"));
  });

  it("does not decrypt one owner's ciphertext with another owner's key", () => {
    const encrypted = encryptCrewField("owner-a", "crew-1", "name", "private crew data");

    expect(() => decryptCrewField("owner-b", "crew-1", "name", encrypted)).toThrow();
  });

  it("authenticates owner id, crew member id, and field name as associated data", () => {
    const encrypted = encryptCrewField("owner-a", "crew-1", "name", "private crew data");

    expect(decryptCrewField("owner-a", "crew-1", "name", encrypted)).toBe("private crew data");
    expect(() => decryptCrewField("owner-b", "crew-1", "name", encrypted)).toThrow();
    expect(() => decryptCrewField("owner-a", "crew-2", "name", encrypted)).toThrow();
    expect(() => decryptCrewField("owner-a", "crew-1", "role", encrypted)).toThrow();
  });

  it("rejects unsupported envelope versions and algorithms", () => {
    const envelope = parseCrewEncryptionEnvelope(encryptCrewField("owner-a", "crew-1", "name", "private crew data"));

    expect(() => decryptCrewField("owner-a", "crew-1", "name", JSON.stringify({ ...envelope, v: 2 }))).toThrow(/Unsupported crew encryption envelope version/);
    expect(() => decryptCrewField("owner-a", "crew-1", "name", JSON.stringify({ ...envelope, alg: "AES-128-GCM" }))).toThrow(/Unsupported crew encryption algorithm/);
  });

  it("rejects malformed envelope fields before decrypting", () => {
    const envelope = parseCrewEncryptionEnvelope(encryptCrewField("owner-a", "crew-1", "name", "private crew data"));

    expect(() => decryptCrewField("owner-a", "crew-1", "name", JSON.stringify({ ...envelope, iv: "not base64!" }))).toThrow(/iv is not valid base64/);
    expect(() => decryptCrewField("owner-a", "crew-1", "name", JSON.stringify({ ...envelope, tag: envelope.ct }))).toThrow(/tag must decode to 16 bytes/);
  });
});
