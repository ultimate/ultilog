"use client";

import Link from "next/link";
import { useI18n } from "../../lib/i18n";

export function SharedLoginLink({ returnPath }: { returnPath: string }) {
  const { t } = useI18n();
  return <Link className="button-link shared-login-link" href={`/login?callbackUrl=${encodeURIComponent(returnPath)}`}>{t("auth.login")}</Link>;
}
