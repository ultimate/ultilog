import { beforeEach, describe, expect, it } from "vitest";
import { decryptCrewField, deriveCrewKey, encryptCrewField } from "../../../../app/lib/crypto/crew-encryption";

const testMasterKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("crew encryption", () => {
  beforeEach(() => {
    process.env.CREW_ENCRYPTION_MASTER_KEY = testMasterKey;
    delete process.env.CREW_DATA_ENCRYPTION_KEY;
  });

  it("encrypts and decrypts crew fields with an owner-derived AES-GCM key", () => {
    const encrypted = encryptCrewField("owner-a", "Ada Lovelace");

    expect(encrypted).toMatch(/^crew:v1:/);
    expect(encrypted).not.toContain("Ada Lovelace");
    expect(decryptCrewField("owner-a", encrypted)).toBe("Ada Lovelace");
  });

  it("derives distinct stable keys for different owners", () => {
    expect(deriveCrewKey("owner-a")).toEqual(deriveCrewKey("owner-a"));
    expect(deriveCrewKey("owner-a")).not.toEqual(deriveCrewKey("owner-b"));
  });

  it("does not decrypt one owner's ciphertext with another owner's key", () => {
    const encrypted = encryptCrewField("owner-a", "private crew data");

    expect(() => decryptCrewField("owner-b", encrypted)).toThrow();
  });
});
