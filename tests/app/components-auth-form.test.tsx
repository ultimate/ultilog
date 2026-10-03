import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { signInAfterRegistration } from "../../app/components/AuthForm";
import { AuthForm } from "../../app/components/AuthForm";
import { I18nProvider } from "../../app/lib/i18n";

describe("registration authentication", () => {
  it("signs the newly registered user in without an intermediate redirect", async () => {
    const authenticate = vi
      .fn()
      .mockResolvedValue({ ok: true, error: undefined });

    await expect(
      signInAfterRegistration(
        "new@example.test",
        "harbor lights",
        authenticate,
      ),
    ).resolves.toBe(true);
    expect(authenticate).toHaveBeenCalledWith("credentials", {
      email: "new@example.test",
      password: "harbor lights",
      redirect: false,
    });
  });

  it("reports an authentication failure so registration does not continue", async () => {
    const authenticate = vi
      .fn()
      .mockResolvedValue({ ok: false, error: "CredentialsSignin" });

    await expect(
      signInAfterRegistration("new@example.test", "incorrect", authenticate),
    ).resolves.toBe(false);
  });
});

describe("signed-out footer", () => {
  it("links to the public changelog", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <AuthForm mode="login" footer={null} />
      </I18nProvider>,
    );
    expect(markup).toContain('href="/changelog"');
    expect(markup).toContain("What&#x27;s new");
  });
});
