"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { LocaleSelect, useI18n } from "../lib/i18n";

export default function CheckEmailPage() {
  return (
    <Suspense fallback={<CheckEmailCard />}>
      <CheckEmailContent />
    </Suspense>
  );
}

function CheckEmailContent() {
  const searchParams = useSearchParams();
  return <CheckEmailCard email={searchParams.get("email") ?? ""} />;
}

function CheckEmailCard({ email = "" }: { email?: string }) {
  const { t } = useI18n();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  async function resendVerificationEmail() {
    if (!email) return;
    setMessage(null);
    setError(null);
    setIsResending(true);
    const response = await fetch("/api/email-verification/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setIsResending(false);
    const payload = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
    if (!response.ok) {
      setError(payload.error ?? t("auth.emailVerificationResendError"));
      return;
    }
    setMessage(payload.message ?? t("auth.emailVerificationResent"));
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-mark"><span className="sail-logo">◢</span><strong>ultilog</strong></div>
        <LocaleSelect className="auth-locale-select" />
        <div>
          <p className="eyebrow">{t("auth.eyebrow")}</p>
          <h1>{t("auth.checkEmailTitle")}</h1>
          <p>{t("auth.checkEmailSubtitle")}</p>
          {email ? <p className="auth-success">{t("auth.checkEmailSentTo")} {email}</p> : null}
        </div>
        {message ? <p className="auth-success">{message}</p> : null}
        {error ? <p className="auth-error">{error}</p> : null}
        <button type="button" onClick={resendVerificationEmail} disabled={!email || isResending}>{isResending ? t("auth.pleaseWait") : t("auth.resendVerificationEmail")}</button>
        <button type="button" onClick={() => window.location.assign("/")}>{t("auth.continueToApp")}</button>
        <div className="auth-footer"><p><Link href="/login">{t("auth.backToLogin")}</Link></p></div>
      </section>
    </main>
  );
}
