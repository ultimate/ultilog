"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
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
        <button type="button" onClick={() => window.location.assign("/")}>{t("auth.continueToApp")}</button>
        <div className="auth-footer"><p><Link href="/login">{t("auth.backToLogin")}</Link></p></div>
      </section>
    </main>
  );
}
