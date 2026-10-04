"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createKeyParams, rememberKey, unlockKey, type JournalKeyParams } from "@/lib/journal-crypto";
import { translateDbError } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";

const MIN_LENGTH = 8;

/** Crear la frase (primera vez), desbloquear, o restablecerla si se olvidó */
export function JournalLock({
  userId,
  params,
  onUnlocked,
}: {
  userId: string;
  params: JournalKeyParams | null;
  onUnlocked: (key: CryptoKey) => void;
}) {
  const router = useRouter();
  const t = useT();
  const [supabase] = useState(() => createClient());
  const [mode, setMode] = useState<"setup" | "unlock" | "reset">(params ? "unlock" : "setup");
  const [phrase, setPhrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(isReset: boolean) {
    if (phrase.length < MIN_LENGTH) return setError(t.lock.minLen(MIN_LENGTH));
    if (phrase !== confirm) return setError(t.lock.mismatch);
    setBusy(true);
    setError(null);
    const { key, params: p } = await createKeyParams(phrase);
    const { error } = await supabase.rpc(isReset ? "reset_journal_key" : "setup_journal_key", {
      p_salt: p.salt,
      p_iterations: p.iterations,
      p_verifier: p.verifier,
    });
    setBusy(false);
    if (error) return setError(translateDbError(error.message, t));
    if (remember) await rememberKey(userId, p.salt, key);
    onUnlocked(key);
    router.refresh(); // trae los nuevos parámetros de la clave
  }

  async function unlock() {
    if (!params) return;
    setBusy(true);
    setError(null);
    const key = await unlockKey(phrase, params);
    setBusy(false);
    if (!key) return setError(t.lock.wrong);
    if (remember) await rememberKey(userId, params.salt, key);
    onUnlocked(key);
  }

  const rememberBox = (
    <label className="flex items-center gap-3 text-sm text-ink-2">
      <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-current" />
      {t.lock.remember}
    </label>
  );

  if (mode === "unlock") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          unlock();
        }}
        className="space-y-6 border-y border-line py-8"
      >
        <p className="font-serif text-2xl">{t.lock.encrypted}</p>
        <p className="text-sm text-ink-2">{t.lock.enterPhrase}</p>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          placeholder={t.lock.phrasePh}
          className="field"
        />
        {rememberBox}
        {error && <p className="border-l-2 border-ink pl-3 text-sm">{error}</p>}
        <button type="submit" disabled={busy || !phrase} className="btn btn-primary w-full">
          {busy ? t.lock.opening : t.lock.open}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("reset");
            setPhrase("");
            setError(null);
          }}
          className="block w-full text-center text-xs text-ink-3 underline underline-offset-4"
        >
          {t.lock.forgot}
        </button>
      </form>
    );
  }

  const isReset = mode === "reset";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        create(isReset);
      }}
      className="space-y-6 border-y border-line py-8"
    >
      <p className="font-serif text-2xl">{isReset ? t.lock.resetTitle : t.lock.setupTitle}</p>
      {isReset ? (
        <p className="border-l-2 border-ink pl-3 text-sm">{t.lock.resetWarn}</p>
      ) : (
        <p className="text-sm text-ink-2">
          {t.lock.setupBody} <span className="text-ink">{t.lock.setupWarn}</span>
        </p>
      )}
      <input
        type="password"
        autoFocus
        autoComplete="new-password"
        value={phrase}
        onChange={(e) => setPhrase(e.target.value)}
        placeholder={t.lock.newPh(MIN_LENGTH)}
        className="field"
      />
      <input
        type="password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder={t.lock.repeat}
        className="field"
      />
      {rememberBox}
      {error && <p className="border-l-2 border-ink pl-3 text-sm">{error}</p>}
      <button type="submit" disabled={busy || !phrase || !confirm} className="btn btn-primary w-full">
        {busy ? t.lock.preparing : isReset ? t.lock.resetBtn : t.lock.createBtn}
      </button>
      {isReset && (
        <button
          type="button"
          onClick={() => {
            setMode("unlock");
            setError(null);
          }}
          className="block w-full text-center text-xs text-ink-3 underline underline-offset-4"
        >
          {t.lock.cancelRemember}
        </button>
      )}
    </form>
  );
}
