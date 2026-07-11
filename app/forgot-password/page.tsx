"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { LocaleSelect, useI18n } from "../lib/i18n";

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: String(form.get("email") ?? "") }),
    });
    setIsSubmitting(false);
    const payload = await response.json().catch(() => ({})) as { message?: string; error?: string };
    if (!response.ok) {
      setError(payload.error ?? t("auth.resetRequestError"));
      return;
    }
    setMessage(payload.message ?? t("auth.resetRequestSent"));
  }

  return (
    <main className="auth-shell">
      <form onSubmit={submit} className="auth-card">
        <div className="brand-mark"><span className="sail-logo">◢</span><strong>ultilog</strong></div>
        <LocaleSelect className="auth-locale-select" />
        <div>
          <p className="eyebrow">{t("auth.eyebrow")}</p>
          <h1>{t("auth.forgotPasswordTitle")}</h1>
          <p>{t("auth.forgotPasswordSubtitle")}</p>
        </div>
        <label>{t("auth.email")}<input name="email" required type="email" /></label>
        {error && <p className="auth-error">{error}</p>}
        {message && <p className="auth-success">{message}</p>}
        <button disabled={isSubmitting} type="submit">{isSubmitting ? t("auth.pleaseWait") : t("auth.sendResetLink")}</button>
        <div className="auth-footer"><p><Link href="/login">{t("auth.backToLogin")}</Link></p></div>
      </form>
    </main>
  );
}
