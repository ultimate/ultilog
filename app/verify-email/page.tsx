"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { LocaleSelect, useI18n } from "../lib/i18n";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailCard />}>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  return <VerifyEmailCard token={searchParams.get("token") ?? ""} />;
}

function VerifyEmailCard({ token = "" }: { token?: string }) {
  const { t } = useI18n();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(token ? null : t("auth.emailVerificationTokenMissing"));

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function verifyEmail() {
      const response = await fetch("/api/email-verification/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (cancelled) return;
      if (!response.ok) {
        setError(payload.error ?? t("auth.emailVerificationError"));
        return;
      }
      setMessage(t("auth.emailVerificationSuccess"));
    }
    void verifyEmail();
    return () => {
      cancelled = true;
    };
  }, [t, token]);

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-mark"><span className="sail-logo">◢</span><strong>ultilog</strong></div>
        <LocaleSelect className="auth-locale-select" />
        <h1>{t("auth.verifyEmailTitle")}</h1>
        <p>{t("auth.verifyEmailSubtitle")}</p>
        {message ? <p className="auth-success">{message}</p> : null}
        {error ? <p className="auth-error">{error}</p> : null}
        <p><Link href="/login">{t("auth.backToLogin")}</Link></p>
      </section>
    </main>
  );
}
