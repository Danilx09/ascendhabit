"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { decryptText, encryptText } from "@/lib/journal-crypto";
import { EMOTIONS, MOOD_LABELS, REFLECTION_QUESTIONS, type TextField } from "./constants";
import type { JournalEntry } from "@/types/app";

const TEXT_FIELDS: TextField[] = ["free_journal", "q_gratitude", "q_challenge", "q_learning"];
const AUTOSAVE_MS = 900;

type Values = Record<TextField, string> & { mood_score: number | null; primary_emotion: string };
type Field = keyof Values;
type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

/** Editor del día: diario libre + bitácora. Autoguarda solo lo que cambió, ya cifrado. */
export function JournalEditor({ cryptoKey, date, entry }: { cryptoKey: CryptoKey; date: string; entry: JournalEntry | null }) {
  const [supabase] = useState(() => createClient());
  const [values, setValues] = useState<Values | null>(null);
  const [undecryptable, setUndecryptable] = useState<TextField[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [customEmotion, setCustomEmotion] = useState("");

  const latest = useRef<Values | null>(null);
  const dirty = useRef<Set<Field>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef<Promise<void> | null>(null);

  // 1) Descifrar la entrada al abrir el día
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const failed: TextField[] = [];
      const plain = {} as Record<TextField, string>;
      for (const f of TEXT_FIELDS) {
        const cipher = entry?.[f];
        if (!cipher) {
          plain[f] = "";
          continue;
        }
        try {
          plain[f] = await decryptText(cryptoKey, cipher);
        } catch {
          plain[f] = "";
          failed.push(f);
        }
      }
      if (cancelled) return;
      const v: Values = { ...plain, mood_score: entry?.mood_score ?? null, primary_emotion: entry?.primary_emotion ?? "" };
      latest.current = v;
      setValues(v);
      setUndecryptable(failed);
      if (v.primary_emotion && !EMOTIONS.includes(v.primary_emotion)) setCustomEmotion(v.primary_emotion);
    })();
    return () => {
      cancelled = true;
    };
  }, [cryptoKey, entry]);

  // 2) Guardar: cifra los textos modificados y envía solo esos campos
  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!latest.current || dirty.current.size === 0) return;
    if (saving.current) await saving.current; // no solapar guardados

    const fields = [...dirty.current];
    dirty.current.clear();
    const v = latest.current;

    const run = (async () => {
      setSaveState("saving");
      const patch: Record<string, string | number | null> = {};
      for (const f of fields) {
        if (f === "mood_score") patch.mood_score = v.mood_score;
        else if (f === "primary_emotion") patch.primary_emotion = v.primary_emotion.trim() || null;
        else patch[f] = v[f].trim() ? await encryptText(cryptoKey, v[f]) : null;
      }
      const { error } = await supabase.rpc("save_journal_entry", { p_date: date, p_patch: patch });
      if (error) {
        fields.forEach((f) => dirty.current.add(f)); // se reintenta en el próximo cambio o al salir
        setSaveState("error");
        return;
      }
      setSaveState(dirty.current.size ? "pending" : "saved");
      setSavedAt(new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" }).format(new Date()));
    })();
    saving.current = run;
    await run;
    saving.current = null;
  }, [cryptoKey, date, supabase]);

  function update<F extends Field>(field: F, value: Values[F]) {
    if (!latest.current) return;
    const next = { ...latest.current, [field]: value };
    latest.current = next;
    setValues(next);
    dirty.current.add(field);
    if (TEXT_FIELDS.includes(field as TextField)) setUndecryptable((u) => u.filter((f) => f !== field));
    setSaveState("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, AUTOSAVE_MS);
  }

  // 3) Guardar al salir de la app / cambiar de pestaña / cambiar de día
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      void flush();
    };
  }, [flush]);

  if (!values) return <p className="text-sm text-ink-3">Descifrando…</p>;

  const status =
    saveState === "saving" || saveState === "pending"
      ? "Guardando…"
      : saveState === "error"
        ? "Sin conexión · se guardará al reintentar"
        : saveState === "saved" && savedAt
          ? `Guardado · ${savedAt}`
          : "Cifrado de extremo a extremo";

  return (
    <div className="space-y-14">
      <p className="sticky top-0 z-10 -mx-6 bg-bg/90 px-6 py-2 text-right text-xs text-ink-3 backdrop-blur" aria-live="polite">
        {status}
      </p>

      {undecryptable.length > 0 && (
        <p className="border-l-2 border-ink pl-3 text-sm">
          Algunos textos de este día no se pudieron descifrar (¿se cambió la frase?). Si escribes encima, se reemplazarán.
        </p>
      )}

      {/* Diario abierto */}
      <section>
        <h2 className="eyebrow">Diario</h2>
        <AutoTextarea
          value={values.free_journal}
          onChange={(v) => update("free_journal", v)}
          placeholder="Escribe lo que pasa por tu cabeza…"
          minRows={8}
          className="ruled mt-3 font-serif text-[1.125rem]"
          ariaLabel="Diario del día"
        />
      </section>

      {/* Bitácora emocional */}
      <section className="space-y-10">
        <div>
          <h2 className="eyebrow">Bitácora</h2>
          <p className="mt-2 font-serif text-2xl">¿Cómo estuvo tu día por dentro?</p>
        </div>

        <div>
          <p className="text-sm text-ink-2">Nivel de energía</p>
          <div className="mt-3 grid grid-cols-5 border border-line" role="radiogroup" aria-label="Nivel de energía">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={values.mood_score === n}
                onClick={() => update("mood_score", values.mood_score === n ? null : n)}
                className={`flex flex-col items-center py-3 transition ${n > 1 ? "border-l border-line" : ""} ${
                  values.mood_score === n ? "bg-ink text-bg" : "text-ink-2"
                }`}
              >
                <span className="font-serif text-xl tabular-nums">{n}</span>
                <span className="mt-0.5 text-[10px] uppercase tracking-[0.1em] opacity-70">{MOOD_LABELS[n]}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm text-ink-2">Emoción principal</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {EMOTIONS.map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={values.primary_emotion === e}
                onClick={() => {
                  setCustomEmotion("");
                  update("primary_emotion", values.primary_emotion === e ? "" : e);
                }}
                className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                  values.primary_emotion === e ? "border-ink bg-ink text-bg" : "border-line text-ink-2"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
          <input
            value={customEmotion}
            onChange={(e) => {
              const v = e.target.value.slice(0, 30);
              setCustomEmotion(v);
              update("primary_emotion", v.toLowerCase());
            }}
            placeholder="u otra palabra…"
            className="field mt-3 text-sm"
          />
        </div>

        {REFLECTION_QUESTIONS.map((q) => (
          <div key={q.field}>
            <p className="eyebrow">{q.title}</p>
            <p className="mt-2 font-serif text-lg leading-snug">{q.prompt}</p>
            <AutoTextarea
              value={values[q.field]}
              onChange={(v) => update(q.field, v)}
              placeholder="…"
              minRows={2}
              className="field mt-2"
              ariaLabel={q.prompt}
            />
          </div>
        ))}
      </section>
    </div>
  );
}

/** Textarea que crece con el contenido */
function AutoTextarea({
  value,
  onChange,
  placeholder,
  minRows,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  minRows: number;
  className: string;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={minRows}
      aria-label={ariaLabel}
      className={`w-full resize-none overflow-hidden bg-transparent outline-none placeholder:text-ink-3 ${className}`}
    />
  );
}
