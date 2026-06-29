"use client";

import { FormEvent, ReactNode, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

type Props = { mode: "login" | "register"; footer: ReactNode };

export function AuthForm({ mode, footer }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function demoLogin() {
    setError(null);
    setIsSubmitting(true);
    const response = await fetch("/api/demo-login", { method: "POST" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      setError(payload.error ?? "Unable to start demo.");
      setIsSubmitting(false);
      return;
    }
    const result = await signIn("credentials", { demo: "true", redirect: false });
    setIsSubmitting(false);
    if (result?.error) {
      setError("Unable to start demo.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    if (mode === "register") {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: String(form.get("name") ?? ""), email, password }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        setError(payload.error ?? "Unable to register.");
        setIsSubmitting(false);
        return;
      }
    }

    const result = await signIn("credentials", { email, password, redirect: false });
    setIsSubmitting(false);
    if (result?.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="auth-shell">
      <form onSubmit={submit} className="auth-card">
        <div className="brand-mark"><span className="sail-logo">◢</span><strong>ultilog</strong></div>
        <div>
          <p className="eyebrow">Personal skipper logbook</p>
          <h1>{mode === "login" ? "Welcome back" : "Create account"}</h1>
          <p>Keep your boats, crew, and logbooks private to your account.</p>
        </div>
        {mode === "register" && <label>Name<input name="name" required /></label>}
        <label>Email<input name="email" required type="email" /></label>
        <label>Password<input name="password" required type="password" minLength={8} /></label>
        {error && <p className="auth-error">{error}</p>}
        <button disabled={isSubmitting} type="submit">{isSubmitting ? "Please wait…" : mode === "login" ? "Log in" : "Register"}</button>
        {mode === "login" && <button className="demo-login-button" disabled={isSubmitting} type="button" onClick={demoLogin}>Try the demo</button>}
        <div className="auth-footer">{footer}</div>
      </form>
    </main>
  );
}
