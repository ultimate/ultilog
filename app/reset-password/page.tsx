"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LocaleSelect, useI18n } from "../lib/i18n";
import { PasswordField } from "../components/PasswordField";

export default function ResetPasswordPage() {
  return <Suspense><ResetPasswordForm /></Suspense>;
}

function ResetPasswordForm() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    if (password !== confirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    setIsSubmitting(true);
    const response = await fetch("/api/password-reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setIsSubmitting(false);
    const payload = await response.json().catch(() => ({})) as { message?: string; error?: string };
    if (!response.ok) {
      setError(payload.error ?? t("auth.resetConfirmError"));
      return;
    }
    setMessage(payload.message ?? t("auth.passwordResetSuccess"));
    event.currentTarget.reset();
  }

  return (
    <main className="auth-shell">
      <form onSubmit={submit} className="auth-card">
        <div className="brand-mark"><span className="sail-logo">◢</span><strong>ultilog</strong></div>
        <LocaleSelect className="auth-locale-select" />
        <div>
          <p className="eyebrow">{t("auth.eyebrow")}</p>
          <h1>{t("auth.resetPasswordTitle")}</h1>
          <p>{t("auth.resetPasswordSubtitle")}</p>
        </div>
        <PasswordField label={t("auth.newPassword")} name="password" required minLength={8} />
        <PasswordField label={t("auth.confirmNewPassword")} name="confirmPassword" required minLength={8} />
        {error && <p className="auth-error">{error}</p>}
        {message && <p className="auth-success">{message}</p>}
        <button disabled={isSubmitting || !token} type="submit">{isSubmitting ? t("auth.pleaseWait") : t("auth.resetPassword")}</button>
        {!token && <p className="auth-error">{t("auth.resetTokenMissing")}</p>}
        <div className="auth-footer"><p><Link href="/login">{t("auth.backToLogin")}</Link></p></div>
      </form>
    </main>
  );
}
