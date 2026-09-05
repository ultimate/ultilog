import { describe, expect, it, vi } from "vitest";
import { signInAfterRegistration } from "../../app/components/AuthForm";

describe("registration authentication", () => {
  it("signs the newly registered user in without an intermediate redirect", async () => {
    const authenticate = vi.fn().mockResolvedValue({ ok: true, error: undefined });

    await expect(signInAfterRegistration("new@example.test", "harbor lights", authenticate)).resolves.toBe(true);
    expect(authenticate).toHaveBeenCalledWith("credentials", {
      email: "new@example.test",
      password: "harbor lights",
      redirect: false,
    });
  });

  it("reports an authentication failure so registration does not continue", async () => {
    const authenticate = vi.fn().mockResolvedValue({ ok: false, error: "CredentialsSignin" });

    await expect(signInAfterRegistration("new@example.test", "incorrect", authenticate)).resolves.toBe(false);
  });
});
