"use client";

import { FormEvent, ReactNode, useState } from "react";
import { signIn } from "next-auth/react";
import { LocaleSelect, useI18n } from "../lib/i18n";
import { PasswordField } from "./PasswordField";

type Props = { mode: "login" | "register"; footer: ReactNode };

export function AuthForm({ mode, footer }: Props) {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function demoLogin() {
    setError(null);
    setIsSubmitting(true);
    const response = await fetch("/api/demo-login", { method: "POST" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      setError(payload.error ?? t("auth.demoError"));
      setIsSubmitting(false);
      return;
    }
    const payload = await response.json() as { token?: string };
    if (!payload.token) {
      setError(t("auth.demoError"));
      setIsSubmitting(false);
      return;
    }
    const result = await signIn("credentials", { demoToken: payload.token, redirect: false });
    setIsSubmitting(false);
    if (result?.error) {
      setError(t("auth.demoError"));
      return;
    }
    window.location.assign("/");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    if (mode === "register") {
      const confirmPassword = String(form.get("confirmPassword") ?? "");
      if (password !== confirmPassword) {
        setError(t("auth.passwordMismatch"));
        setIsSubmitting(false);
        return;
      }
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: String(form.get("name") ?? ""), email, password }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        setError(payload.error ?? t("auth.registerError"));
        setIsSubmitting(false);
        return;
      }
      setIsSubmitting(false);
      window.location.assign(`/check-email?email=${encodeURIComponent(email)}`);
      return;
    }

    const result = await signIn("credentials", { email, password, redirect: false });
    setIsSubmitting(false);
    if (result?.error) {
      setError(t("auth.invalidCredentials"));
      return;
    }
    const profileResponse = await fetch("/api/profile").catch(() => undefined);
    const profile = (await profileResponse?.json().catch(() => ({})) ?? {}) as { email?: string; emailVerified?: boolean };
    if (profileResponse?.ok && profile.email && profile.emailVerified === false) {
      window.location.assign(`/check-email?email=${encodeURIComponent(profile.email)}`);
      return;
    }
    window.location.assign("/");
  }

  return (
    <main className="auth-shell">
      <form onSubmit={submit} className="auth-card">
        <div className="brand-mark"><span className="sail-logo">◢</span><strong>ultilog</strong></div>
        <LocaleSelect className="auth-locale-select" />
        <div>
          <p className="eyebrow">{t("auth.eyebrow")}</p>
          <h1>{mode === "login" ? t("auth.welcomeBack") : t("auth.createAccount")}</h1>
          <p>{t("auth.subtitle")}</p>
        </div>
        {mode === "register" && <label>{t("auth.username")}<input aria-label={t("auth.name")} name="name" required /></label>}
        <label>{t("auth.email")}<input name="email" required type="email" /></label>
        <PasswordField label={t("auth.password")} name="password" required minLength={8} />
        {mode === "register" && <PasswordField label={t("auth.confirm")} name="confirmPassword" required minLength={8} />}
        {error && <p className="auth-error">{error}</p>}
        <button disabled={isSubmitting} type="submit">{isSubmitting ? t("auth.pleaseWait") : mode === "login" ? t("auth.login") : t("auth.register")}</button>
        {mode === "login" && <button className="demo-login-button" disabled={isSubmitting} type="button" onClick={demoLogin}>{t("auth.tryDemo")}</button>}
        {mode === "login" && <button className="secondary-auth-button" disabled={isSubmitting} type="button" onClick={() => window.location.assign("/forgot-password")}>{t("auth.forgotPassword")}</button>}
        <div className="auth-footer">{footer}</div>
      </form>
    </main>
  );
}
