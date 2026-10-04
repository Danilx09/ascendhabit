"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatLongDate, formatMonth, formatShortDate } from "@/lib/dates";
import { decryptText, loadRememberedKey } from "@/lib/journal-crypto";
import { JournalLock } from "./JournalLock";
import { JournalEditor } from "./JournalEditor";
import { MOOD_LABELS } from "./constants";
import type { JournalDay, JournalMonthItem } from "@/types/app";

type Status = "checking" | "setup" | "locked" | "unlocked";

/**
 * Puerta del diario: mantiene la clave en memoria mientras navegas entre días
 * (el editor se vuelve a montar por fecha, esta vista no).
 */
export function JournalView({ userId, day, month }: { userId: string; day: JournalDay; month: JournalMonthItem[] }) {
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    if (key) return setStatus("unlocked");
    if (!day.key) return setStatus("setup");
    let cancelled = false;
    (async () => {
      const remembered = await loadRememberedKey(userId, day.key!.salt);
      if (remembered) {
        try {
          await decryptText(remembered, day.key!.verifier); // comprueba que sigue siendo válida
          if (!cancelled) {
            setKey(remembered);
            setStatus("unlocked");
          }
          return;
        } catch {
          // clave recordada obsoleta: pedir la frase
        }
      }
      if (!cancelled) setStatus("locked");
    })();
    return () => {
      cancelled = true;
    };
  }, [day.key, key, userId]);

  const isToday = day.date === day.today;

  return (
    <div className="space-y-10">
      <header>
        <p className="eyebrow">{isToday ? "Hoy" : "Entrada pasada"}</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight tracking-tight">{formatLongDate(day.date)}</h1>
        <nav className="mt-4 flex items-center justify-between text-sm text-ink-2">
          {day.prev_date ? (
            <Link href={`/journal?date=${day.prev_date}`}>← {formatShortDate(day.prev_date)}</Link>
          ) : (
            <span />
          )}
          {!isToday && (
            <Link href="/journal" className="underline underline-offset-4">
              Ir a hoy
            </Link>
          )}
          {day.next_date ? <Link href={`/journal?date=${day.next_date}`}>{formatShortDate(day.next_date)} →</Link> : <span />}
        </nav>
      </header>

      {status === "checking" && <p className="text-sm text-ink-3">Abriendo tu diario…</p>}

      {(status === "setup" || status === "locked") && (
        <JournalLock
          userId={userId}
          params={day.key}
          onUnlocked={(k) => {
            setKey(k);
            setStatus("unlocked");
          }}
        />
      )}

      {status === "unlocked" && key && (
        <JournalEditor key={day.date} cryptoKey={key} date={day.date} entry={day.entry} />
      )}

      {/* Historial del mes (sin texto: está cifrado, solo fecha, energía y emoción) */}
      {month.length > 0 && (
        <section>
          <h2 className="eyebrow mb-1">{formatMonth(day.date.slice(0, 7) + "-01")}</h2>
          <ul className="divide-y divide-line border-y border-line">
            {month.map((m) => (
              <li key={m.entry_date}>
                <Link
                  href={`/journal?date=${m.entry_date}`}
                  className={`flex items-center gap-4 py-3 ${m.entry_date === day.date ? "text-ink" : "text-ink-2"}`}
                >
                  <span className="w-20 shrink-0 text-sm">{formatShortDate(m.entry_date)}</span>
                  <span className="flex flex-1 items-center gap-1" aria-label={m.mood_score ? `Energía ${m.mood_score} de 5` : "Sin energía registrada"}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span
                        key={n}
                        className={`h-1.5 w-1.5 rounded-full ${m.mood_score && n <= m.mood_score ? "bg-ink" : "bg-line"}`}
                      />
                    ))}
                    {m.mood_score && <span className="sr-only">{MOOD_LABELS[m.mood_score]}</span>}
                  </span>
                  <span className="truncate text-sm italic">{m.primary_emotion ?? ""}</span>
                  <span className="shrink-0 text-xs text-ink-3">
                    {[m.has_journal && "diario", m.has_reflection && "bitácora"].filter(Boolean).join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
