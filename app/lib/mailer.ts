import { isLocale, t, type Locale } from "./i18n/translations";

export type PasswordResetEmail = {
  to: string;
  resetUrl: string;
  locale?: Locale | string;
};

export type EmailVerificationEmail = {
  to: string;
  verificationUrl: string;
  locale?: Locale | string;
};

type MailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  from: string;
};

export async function sendPasswordResetEmail(message: PasswordResetEmail) {
  const content = passwordResetEmailContent(message);
  await sendMailMessage({ to: message.to, content, localLogMessage: `Password reset link for ${message.to}: ${message.resetUrl}`, configurationError: "Password reset email is not configured." });
}

export async function sendEmailVerificationEmail(message: EmailVerificationEmail) {
  const content = emailVerificationEmailContent(message);
  await sendMailMessage({ to: message.to, content, localLogMessage: `Email verification link for ${message.to}: ${message.verificationUrl}`, configurationError: "Email verification is not configured." });
}

async function sendMailMessage(message: { to: string; content: { subject: string; text: string; html: string }; localLogMessage: string; configurationError: string }) {
  const config = getMailConfig();
  if (!config) {
    if (process.env.NODE_ENV === "production") throw new Error(message.configurationError);
    console.info(message.localLogMessage);
    return;
  }

  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.default.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user && config.password ? { user: config.user, pass: config.password } : undefined,
  });

  await transporter.sendMail({
    from: config.from,
    to: message.to,
    subject: message.content.subject,
    text: message.content.text,
    html: message.content.html,
  });
}

function getMailConfig(): MailConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();
  if (!host || !from) return null;

  const port = Number(process.env.SMTP_PORT ?? 587);
  if (!Number.isInteger(port) || port <= 0) throw new Error("SMTP_PORT must be a positive integer.");

  return {
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    user: process.env.SMTP_USER?.trim() || undefined,
    password: process.env.SMTP_PASSWORD || undefined,
    from,
  };
}

function passwordResetEmailContent(message: PasswordResetEmail) {
  const locale = isLocale(message.locale) ? message.locale : "en";
  const intro = t(locale, "email.passwordResetIntro");
  const expiry = t(locale, "email.passwordResetExpiry");
  const ignore = t(locale, "email.passwordResetIgnore");
  const cta = t(locale, "email.passwordResetCta");
  return {
    subject: t(locale, "email.passwordResetSubject"),
    text: `${intro} ${message.resetUrl}\n\n${expiry} ${ignore}`,
    html: `<p>${escapeHtml(intro)}</p><p><a href="${escapeHtml(message.resetUrl)}">${escapeHtml(cta)}</a></p><p>${escapeHtml(expiry)} ${escapeHtml(ignore)}</p>`,
  };
}

function emailVerificationEmailContent(message: EmailVerificationEmail) {
  const locale = isLocale(message.locale) ? message.locale : "en";
  const intro = t(locale, "email.verificationIntro");
  const expiry = t(locale, "email.verificationExpiry");
  const ignore = t(locale, "email.verificationIgnore");
  const cta = t(locale, "email.verificationCta");
  return {
    subject: t(locale, "email.verificationSubject"),
    text: `${intro} ${message.verificationUrl}\n\n${expiry} ${ignore}`,
    html: `<p>${escapeHtml(intro)}</p><p><a href="${escapeHtml(message.verificationUrl)}">${escapeHtml(cta)}</a></p><p>${escapeHtml(expiry)} ${escapeHtml(ignore)}</p>`,
  };
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
