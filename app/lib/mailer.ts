import nodemailer from "nodemailer";

export type PasswordResetEmail = {
  to: string;
  resetUrl: string;
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
  const config = getMailConfig();
  if (!config) {
    if (process.env.NODE_ENV === "production") throw new Error("Password reset email is not configured.");
    console.info(`Password reset link for ${message.to}: ${message.resetUrl}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user && config.password ? { user: config.user, pass: config.password } : undefined,
  });

  await transporter.sendMail({
    from: config.from,
    to: message.to,
    subject: "Reset your Ultilog password",
    text: `Use this link to reset your Ultilog password: ${message.resetUrl}\n\nThis link expires in 1 hour. If you did not request a password reset, you can ignore this email.`,
    html: `<p>Use this link to reset your Ultilog password:</p><p><a href="${escapeHtml(message.resetUrl)}">Reset password</a></p><p>This link expires in 1 hour. If you did not request a password reset, you can ignore this email.</p>`,
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

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
