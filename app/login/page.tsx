"use client";

import Link from "next/link";
import { AuthForm } from "../components/AuthForm";
import { useI18n } from "../lib/i18n";

export default function LoginPage() {
  const { t } = useI18n();
  return <AuthForm mode="login" footer={<p>{t("auth.needAccount")} <Link href="/register">{t("auth.register")}</Link></p>} />;
}
