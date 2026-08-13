import { describe, expect, it } from "vitest";
import { applyPasswordPolicy, PASSWORD_MAX_UTF8_BYTES, PASSWORD_MIN_CHARACTERS } from "../../../../app/lib/security/password-policy";

describe("password policy", () => {
  it("documents its passphrase-friendly bounds", () => {
    expect(PASSWORD_MIN_CHARACTERS).toBe(15);
    expect(PASSWORD_MAX_UTF8_BYTES).toBe(72);
  });

  it("measures the bcrypt maximum in UTF-8 bytes", () => {
    expect(() => applyPasswordPolicy("🚤".repeat(17) + "boat")).not.toThrow();
    expect(() => applyPasswordPolicy("🚤".repeat(17) + "boats")).toThrowError("Password does not meet the password policy.");
  });

  it("returns NFC while allowing Unicode and no required character classes", () => {
    expect(applyPasswordPolicy("Cafe\u0301 harbor lantern 2026")).toBe("Café harbor lantern 2026");
    expect(applyPasswordPolicy("only lowercase words here")).toBe("only lowercase words here");
  });
});
