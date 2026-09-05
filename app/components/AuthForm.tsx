"use client";

import { FormEvent, ReactNode, useState } from "react";
import { signIn } from "next-auth/react";
import Image from "next/image";
import { LocaleSelect, useI18n } from "../lib/i18n";
import { PasswordField } from "./PasswordField";
import { PASSWORD_MAX_UTF8_BYTES, PASSWORD_MIN_CHARACTERS } from "../lib/security/password-policy";
import { demoDeviceId } from "./demo-device";

type Props = { mode: "login" | "register"; footer: ReactNode };

type CredentialsSignIn = typeof signIn;

const featureIcons = ["∞", "◇", "♟", "▧", "✦"];

export async function signInAfterRegistration(email: string, password: string, authenticate: CredentialsSignIn = signIn) {
  const result = await authenticate("credentials", { email, password, redirect: false });
  return !result?.error;
}

export function AuthForm({ mode, footer }: Props) {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreparingDemo, setIsPreparingDemo] = useState(false);

  async function demoLogin() {
    setError(null);
    setIsSubmitting(true);
    setIsPreparingDemo(true);
    const response = await fetch("/api/demo-login", { method: "POST", headers: { "X-Device-Id": demoDeviceId() } });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      setError(payload.error ?? t("auth.demoError"));
      setIsSubmitting(false);
      setIsPreparingDemo(false);
      return;
    }
    const payload = await response.json() as { token?: string };
    if (!payload.token) {
      setError(t("auth.demoError"));
      setIsSubmitting(false);
      setIsPreparingDemo(false);
      return;
    }
    const result = await signIn("credentials", { demoToken: payload.token, redirect: false });
    setIsSubmitting(false);
    setIsPreparingDemo(false);
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
      const isSignedIn = await signInAfterRegistration(email, password).catch(() => false);
      if (!isSignedIn) {
        setError(t("auth.automaticLoginError"));
        setIsSubmitting(false);
        return;
      }
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

  const form = (
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
        <PasswordField label={t("auth.password")} name="password" required minLength={mode === "register" ? PASSWORD_MIN_CHARACTERS : undefined} maxLength={PASSWORD_MAX_UTF8_BYTES} />
        {mode === "register" && <PasswordField label={t("auth.confirm")} name="confirmPassword" required minLength={PASSWORD_MIN_CHARACTERS} maxLength={PASSWORD_MAX_UTF8_BYTES} />}
        {error && <p className="auth-error">{error}</p>}
        <button disabled={isSubmitting} type="submit">{isSubmitting && !isPreparingDemo ? t("auth.pleaseWait") : mode === "login" ? t("auth.login") : t("auth.register")}</button>
        {mode === "login" && <button className="demo-login-button" disabled={isSubmitting} type="button" onClick={demoLogin}>{isPreparingDemo ? t("auth.preparingDemo") : t("auth.tryDemo")}</button>}
        {mode === "login" && <button className="secondary-auth-button" disabled={isSubmitting} type="button" onClick={() => window.location.assign("/forgot-password")}>{t("auth.forgotPassword")}</button>}
        <div className="auth-footer">{footer}</div>
      </form>
  );

  if (mode === "register") {
    return <main className="auth-shell">{form}</main>;
  }

  const features = [
    ["landing.featureLogbookTitle", "landing.featureLogbookText"],
    ["landing.featureBoatsTitle", "landing.featureBoatsText"],
    ["landing.featureCrewTitle", "landing.featureCrewText"],
    ["landing.featureScanTitle", "landing.featureScanText"],
    ["landing.featureSmartTitle", "landing.featureSmartText"],
  ] as const;

  return (
    <main className="landing-shell">
      <section className="landing-layout">
        <div className="landing-story">
          <div className="landing-hero">
            <p className="eyebrow">{t("landing.eyebrow")}</p>
            <h1>{t("landing.headline")}</h1>
            <p className="landing-lead">{t("landing.lead")}</p>
            <div className="landing-promise"><span aria-hidden="true">≈</span><p><strong>{t("landing.promiseTitle")}</strong>{t("landing.promiseText")}</p></div>
          </div>
          <div className="landing-feature-track" aria-label={t("landing.featuresLabel")}>
            {features.map(([title, text], index) => (
              <article className="landing-feature" key={title}>
                <span aria-hidden="true">{featureIcons[index]}</span>
                <div><h2>{t(title)}</h2><p>{t(text)}</p></div>
              </article>
            ))}
          </div>
          <p className="landing-swipe-hint">{t("landing.swipeHint")}</p>
        </div>
        <aside className="landing-login" aria-label={t("auth.login")}>{form}</aside>
      </section>
      <section className="partner-banner" aria-label={t("landing.partnerLabel")}>
        <p><span>{t("landing.partnerEyebrow")}</span><strong>{t("landing.partnerTitle")}</strong></p>
        <a href="https://respocean.ch/" target="_blank" rel="noreferrer" aria-label="Respocean">
          <Image
            src="/partners/respocean.png"
            alt="Respocean"
            width={1429}
            height={248}
          />
        </a>
      </section>
    </main>
  );
}
