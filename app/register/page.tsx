"use client";

import Link from "next/link";
import { AuthForm } from "../components/AuthForm";
import { useI18n } from "../lib/i18n";

export default function RegisterPage() {
  const { t } = useI18n();
  return <AuthForm mode="register" footer={<p>{t("auth.alreadyRegistered")} <Link href="/login">{t("auth.login")}</Link></p>} />;
}
