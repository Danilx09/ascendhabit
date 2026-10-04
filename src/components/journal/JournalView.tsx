"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatLongDate } from "@/lib/dates";
import { decryptText, loadRememberedKey } from "@/lib/journal-crypto";
import { JournalLock } from "./JournalLock";
import { ChangePassphrase } from "./ChangePassphrase";
import { JournalEditor, type JournalTab } from "./JournalEditor";
import { useT } from "@/lib/i18n/client";
import type { JournalDay } from "@/types/app";

type Status = "checking" | "setup" | "locked" | "unlocked";

/**
 * Puerta del diario: mantiene la clave en memoria mientras navegas entre días
 * (el editor se vuelve a montar por fecha, esta vista no).
 */
export function JournalView({ userId, day }: { userId: string; day: JournalDay }) {
  const t = useT();
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [status, setStatus] = useState<Status>("checking");
  const [tab, setTab] = useState<JournalTab>("diario");
  const [changing, setChanging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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
  const historyHref = `/journal/history?month=${day.date.slice(0, 7)}`;

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-center justify-between">
          <p className="eyebrow">{isToday ? t.journal.today : t.journal.past}</p>
          <Link href={historyHref} className="text-sm underline underline-offset-4">
            {t.journal.history}
          </Link>
        </div>
        <h1 className="mt-3 font-serif text-4xl leading-tight tracking-tight">{formatLongDate(day.date, t.intl)}</h1>
        <nav className="mt-4 flex items-center justify-between text-sm text-ink-3">
          {day.prev_date ? <Link href={`/journal?date=${day.prev_date}`}>{t.journal.prev}</Link> : <span />}
          {!isToday && (
            <Link href="/journal" className="text-ink underline underline-offset-4">
              {t.journal.goToday}
            </Link>
          )}
          {day.next_date ? <Link href={`/journal?date=${day.next_date}`}>{t.journal.next}</Link> : <span />}
        </nav>
      </header>

      {/* Pestañas: el diario (texto largo) y la bitácora (chequeo rápido) */}
      <div className="grid grid-cols-2 border border-line" role="tablist">
        {(["diario", "bitacora"] as const).map((tabKey, i) => (
          <button
            key={tabKey}
            type="button"
            role="tab"
            aria-selected={tab === tabKey}
            onClick={() => setTab(tabKey)}
            className={`py-2.5 text-sm transition ${i > 0 ? "border-l border-line" : ""} ${
              tab === tabKey ? "bg-ink text-bg" : "text-ink-2"
            }`}
          >
            {t.journal.tabs[tabKey]}
          </button>
        ))}
      </div>

      {status === "checking" && <p className="text-sm text-ink-3">{t.journal.opening}</p>}

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
        <JournalEditor key={day.date} cryptoKey={key} date={day.date} isToday={isToday} entry={day.entry} tab={tab} />
      )}

      {status === "unlocked" && day.key && (
        <footer className="border-t border-line pt-4 text-center">
          {notice && <p className="mb-3 text-sm text-ink-2">{notice}</p>}
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              setChanging(true);
            }}
            className="text-xs text-ink-3 underline underline-offset-4"
          >
            {t.lock.change}
          </button>
        </footer>
      )}

      {changing && day.key && (
        <ChangePassphrase
          userId={userId}
          params={day.key}
          onClose={() => setChanging(false)}
          onChanged={() => {
            // Misma clave del diario (solo cambió cómo se envuelve): el editor no se toca
            setChanging(false);
            setNotice(t.lock.changed);
          }}
        />
      )}
    </div>
  );
}
