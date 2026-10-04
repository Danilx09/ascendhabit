"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";

const RESEND_SECONDS = 60;

export function LoginForm({ initialError }: { initialError: string | null }) {
  const router = useRouter();
  const t = useT();
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
          ? t.login.tooMany
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
      setError(t.login.wrongCode);
      return;
    }
    router.replace("/today");
    router.refresh();
  }

  const inputClass = "field";
  const buttonClass = "btn btn-primary w-full";

  if (step === "email") {
    return (
      <form onSubmit={sendCode} className="space-y-6">
        <label className="block">
          <span className="eyebrow">{t.login.email}</span>
          <input
            type="email"
            required
            autoFocus
            autoComplete="email"
            inputMode="email"
            placeholder={t.login.emailPh}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>
        {error && <p className="border-l-2 border-ink pl-3 text-sm">{error}</p>}
        <button type="submit" disabled={loading || !email} className={buttonClass}>
          {loading ? t.common.sending : t.login.send}
        </button>
        <p className="text-center text-xs text-ink-3">{t.login.noPasswords}</p>
      </form>
    );
  }

  return (
    <form onSubmit={verifyCode} className="space-y-6">
      <p className="text-sm text-ink-2">
        {t.login.sentTo} <span className="text-ink">{email}</span>. {t.login.checkSpam}
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
        className={`${inputClass} text-center font-serif text-3xl tracking-[0.4em]`}
      />
      {error && <p className="border-l-2 border-ink pl-3 text-sm">{error}</p>}
      <button type="submit" disabled={loading || code.length < 6} className={buttonClass}>
        {loading ? t.login.verifying : t.login.enter}
      </button>
      <div className="flex justify-between text-sm">
        <button
          type="button"
          onClick={() => {
            setStep("email");
            setError(null);
          }}
          className="text-ink-3"
        >
          {t.login.changeEmail}
        </button>
        <button
          type="button"
          disabled={cooldown > 0 || loading}
          onClick={() => sendCode()}
          className="underline underline-offset-4 disabled:text-ink-3 disabled:no-underline"
        >
          {cooldown > 0 ? t.login.resendIn(cooldown) : t.login.resend}
        </button>
      </div>
    </form>
  );
}
