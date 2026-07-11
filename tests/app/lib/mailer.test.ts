import { afterEach, describe, expect, it, vi } from "vitest";

const sendMail = vi.fn();
const createTransport = vi.fn(() => ({ sendMail }));

vi.mock("nodemailer", () => ({
  default: { createTransport },
}));

const originalEnv = { ...process.env };
const { sendEmailVerificationEmail, sendPasswordResetEmail } = await import("../../../app/lib/mailer");

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("password reset mailer", () => {
  it("sends reset emails through configured SMTP", async () => {
    process.env.SMTP_HOST = "smtp.example.test";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASSWORD = "secret";
    process.env.SMTP_FROM = "Ultilog <noreply@example.test>";

    await sendPasswordResetEmail({ to: "sailor@example.test", resetUrl: "https://ultilog.test/reset-password?token=abc" });

    expect(createTransport).toHaveBeenCalledWith({
      host: "smtp.example.test",
      port: 465,
      secure: true,
      auth: { user: "user", pass: "secret" },
    });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: "Ultilog <noreply@example.test>",
      to: "sailor@example.test",
      subject: "Reset your Ultilog password",
    }));
  });

  it("uses translated reset email content when a locale is provided", async () => {
    process.env.SMTP_HOST = "smtp.example.test";
    process.env.SMTP_FROM = "Ultilog <noreply@example.test>";

    await sendPasswordResetEmail({ to: "sailor@example.test", resetUrl: "https://ultilog.test/reset-password?token=abc", locale: "de" });

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      subject: "Setze dein Ultilog-Passwort zurück",
      text: expect.stringContaining("Verwende diesen Link"),
      html: expect.stringContaining("Passwort zurücksetzen"),
    }));
  });

  it("logs reset links locally when SMTP is not configured", async () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_FROM;
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await sendPasswordResetEmail({ to: "sailor@example.test", resetUrl: "https://ultilog.test/reset-password?token=abc" });

    expect(createTransport).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith("Password reset link for sailor@example.test: https://ultilog.test/reset-password?token=abc");
    info.mockRestore();
  });

  it("fails in production when SMTP is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_FROM;

    await expect(sendPasswordResetEmail({ to: "sailor@example.test", resetUrl: "https://ultilog.test/reset-password?token=abc" })).rejects.toThrow("Password reset email is not configured.");
  });
});


describe("email verification mailer", () => {
  it("sends verification emails through configured SMTP", async () => {
    process.env.SMTP_HOST = "smtp.example.test";
    process.env.SMTP_FROM = "Ultilog <noreply@example.test>";

    await sendEmailVerificationEmail({ to: "sailor@example.test", verificationUrl: "https://ultilog.test/verify-email?token=abc" });

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: "Ultilog <noreply@example.test>",
      to: "sailor@example.test",
      subject: "Verify your Ultilog email",
      text: expect.stringContaining("verify your Ultilog email address"),
      html: expect.stringContaining("Verify email"),
    }));
  });
});
