"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { forgetKeys, loadRememberedKey, rememberKey, rewrapKey, type JournalKeyParams } from "@/lib/journal-crypto";
import { Sheet } from "@/components/ui/Sheet";
import { translateDbError } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";

const MIN_LENGTH = 8;

/**
 * Cambia la frase sin tocar los textos: la clave del diario se vuelve a envolver
 * con la frase nueva. Solo se actualizan la sal y la clave envuelta en Supabase.
 */
export function ChangePassphrase({
  userId,
  params,
  onClose,
  onChanged,
}: {
  userId: string;
  params: JournalKeyParams;
  onClose: () => void;
  onChanged: (key: CryptoKey) => void;
}) {
  const router = useRouter();
  const t = useT();
  const [supabase] = useState(() => createClient());
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < MIN_LENGTH) return setError(t.lock.minLen(MIN_LENGTH));
    if (next !== confirm) return setError(t.lock.mismatch);
    if (next === current) return setError(t.lock.samePhrase);
    setBusy(true);
    setError(null);
    const result = await rewrapKey(current, next, params);
    if (!result) {
      setBusy(false);
      return setError(t.lock.wrongCurrent);
    }
    const { error } = await supabase.rpc("change_journal_passphrase", {
      p_current_salt: params.salt,
      p_salt: result.params.salt,
      p_iterations: result.params.iterations,
      p_wrapped_key: result.params.wrapped_key,
    });
    if (error) {
      setBusy(false);
      return setError(translateDbError(error.message, t));
    }
    // Si este dispositivo recordaba la clave, se sigue recordando con la sal nueva
    const wasRemembered = !!(await loadRememberedKey(userId, params.salt));
    await forgetKeys();
    if (wasRemembered) await rememberKey(userId, result.params.salt, result.key);
    setBusy(false);
    onChanged(result.key);
    router.refresh();
  }

  return (
    <Sheet onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <p className="font-serif text-2xl">{t.lock.changeTitle}</p>
        <p className="text-sm text-ink-2">{t.lock.changeBody}</p>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder={t.lock.currentPh}
          className="field"
        />
        <input
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
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
        {error && <p className="border-l-2 border-ink pl-3 text-sm">{error}</p>}
        <button type="submit" disabled={busy || !current || !next || !confirm} className="btn btn-primary w-full">
          {busy ? t.lock.changing : t.lock.changeBtn}
        </button>
        <button type="button" onClick={onClose} className="btn btn-ghost w-full">
          {t.lock.cancel}
        </button>
      </form>
    </Sheet>
  );
}
