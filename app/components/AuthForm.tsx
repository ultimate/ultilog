"use client";

import { FormEvent, ReactNode, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

type Props = { mode: "login" | "register"; footer: ReactNode };

export function AuthForm({ mode, footer }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-200">UltiLog</p>
          <h1 className="mt-3 text-3xl font-bold">{mode === "login" ? "Log in" : "Create account"}</h1>
          <p className="mt-2 text-sm text-slate-300">Keep your boats, crew, and logbooks private to your account.</p>
        </div>
        {mode === "register" && <label className="block text-sm font-medium">Name<input className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3" name="name" required /></label>}
        <label className="block text-sm font-medium">Email<input className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3" name="email" required type="email" /></label>
        <label className="block text-sm font-medium">Password<input className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3" name="password" required type="password" minLength={8} /></label>
        {error && <p className="rounded-xl bg-red-500/20 px-4 py-3 text-sm text-red-100">{error}</p>}
        <button disabled={isSubmitting} className="w-full rounded-xl bg-cyan-300 px-4 py-3 font-bold text-slate-950 disabled:opacity-60" type="submit">{isSubmitting ? "Please wait…" : mode === "login" ? "Log in" : "Register"}</button>
        <div className="text-center text-sm text-slate-300">{footer}</div>
      </form>
    </main>
  );
}
