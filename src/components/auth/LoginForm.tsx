"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const RESEND_SECONDS = 60;

export function LoginForm({ initialError }: { initialError: string | null }) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (error) {
      setError(
        error.status === 429
          ? "Demasiados intentos. Espera unos minutos antes de pedir otro código."
          : error.message,
      );
      return;
    }
    setStep("code");
    setCode("");
    setCooldown(RESEND_SECONDS);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: "email",
    });
    if (error) {
      setLoading(false);
      setError("Código incorrecto o expirado.");
      return;
    }
    router.replace("/today");
    router.refresh();
  }

  const inputClass =
    "w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 dark:border-zinc-700 dark:bg-zinc-900";
  const buttonClass =
    "w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white transition active:scale-[0.98] disabled:opacity-50";

  if (step === "email") {
    return (
      <form onSubmit={sendCode} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Tu email</span>
          <input
            type="email"
            required
            autoFocus
            autoComplete="email"
            inputMode="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" disabled={loading || !email} className={buttonClass}>
          {loading ? "Enviando…" : "Enviarme un código"}
        </button>
        <p className="text-center text-xs text-zinc-500">
          Sin contraseñas. Si es tu primera vez, se crea tu cuenta.
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={verifyCode} className="space-y-4">
      <p className="text-sm text-zinc-500">
        Enviamos un código a <span className="font-medium text-zinc-900 dark:text-zinc-100">{email}</span>.
        Revisa también la carpeta de spam.
      </p>
      <input
        type="text"
        required
        autoFocus
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6,10}"
        maxLength={10}
        placeholder="123456"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        className={`${inputClass} text-center font-mono text-2xl tracking-[0.4em]`}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button type="submit" disabled={loading || code.length < 6} className={buttonClass}>
        {loading ? "Verificando…" : "Entrar"}
      </button>
      <div className="flex justify-between text-sm">
        <button
          type="button"
          onClick={() => {
            setStep("email");
            setError(null);
          }}
          className="text-zinc-500"
        >
          ← Cambiar email
        </button>
        <button
          type="button"
          disabled={cooldown > 0 || loading}
          onClick={() => sendCode()}
          className="font-medium text-brand-500 disabled:text-zinc-400"
        >
          {cooldown > 0 ? `Reenviar en ${cooldown}s` : "Reenviar código"}
        </button>
      </div>
    </form>
  );
}
