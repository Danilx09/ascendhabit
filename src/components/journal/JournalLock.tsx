"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createKeyParams, rememberKey, unlockKey, type JournalKeyParams } from "@/lib/journal-crypto";

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
  const [supabase] = useState(() => createClient());
  const [mode, setMode] = useState<"setup" | "unlock" | "reset">(params ? "unlock" : "setup");
  const [phrase, setPhrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(isReset: boolean) {
    if (phrase.length < MIN_LENGTH) return setError(`Usa al menos ${MIN_LENGTH} caracteres.`);
    if (phrase !== confirm) return setError("Las frases no coinciden.");
    setBusy(true);
    setError(null);
    const { key, params: p } = await createKeyParams(phrase);
    const { error } = await supabase.rpc(isReset ? "reset_journal_key" : "setup_journal_key", {
      p_salt: p.salt,
      p_iterations: p.iterations,
      p_verifier: p.verifier,
    });
    setBusy(false);
    if (error) return setError(error.message);
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
    if (!key) return setError("Frase incorrecta.");
    if (remember) await rememberKey(userId, params.salt, key);
    onUnlocked(key);
  }

  const rememberBox = (
    <label className="flex items-center gap-3 text-sm text-ink-2">
      <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-current" />
      Recordar en este dispositivo
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
        <p className="font-serif text-2xl">Tu diario está cifrado.</p>
        <p className="text-sm text-ink-2">Escribe tu frase para abrirlo. Solo tú la conoces.</p>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          placeholder="Frase del diario"
          className="field"
        />
        {rememberBox}
        {error && <p className="border-l-2 border-ink pl-3 text-sm">{error}</p>}
        <button type="submit" disabled={busy || !phrase} className="btn btn-primary w-full">
          {busy ? "Abriendo…" : "Abrir diario"}
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
          Olvidé mi frase
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
      <p className="font-serif text-2xl">{isReset ? "Restablecer la frase" : "Un diario solo para ti."}</p>
      {isReset ? (
        <p className="border-l-2 border-ink pl-3 text-sm">
          Sin la frase anterior, los textos guardados no se pueden recuperar: se borrarán. Tu energía y emociones se
          conservan.
        </p>
      ) : (
        <p className="text-sm text-ink-2">
          Elige una frase para cifrar tu diario en este dispositivo. Nadie más puede leerlo: ni tu socio ni quien
          administre la base de datos. <span className="text-ink">Si la olvidas, no hay forma de recuperar los textos.</span>
        </p>
      )}
      <input
        type="password"
        autoFocus
        autoComplete="new-password"
        value={phrase}
        onChange={(e) => setPhrase(e.target.value)}
        placeholder={`Nueva frase (mín. ${MIN_LENGTH} caracteres)`}
        className="field"
      />
      <input
        type="password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="Repite la frase"
        className="field"
      />
      {rememberBox}
      {error && <p className="border-l-2 border-ink pl-3 text-sm">{error}</p>}
      <button type="submit" disabled={busy || !phrase || !confirm} className="btn btn-primary w-full">
        {busy ? "Preparando cifrado…" : isReset ? "Borrar textos y crear frase nueva" : "Crear frase y empezar"}
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
          Cancelar, la recuerdo
        </button>
      )}
    </form>
  );
}
