"use client";

import { useState } from "react";
import { relativeDay } from "@/lib/dates";
import { RecoverySheet } from "./RecoverySheet";
import { useT } from "@/lib/i18n/client";
import type { RecoverableMiss } from "@/types/app";

/** "Racha en riesgo": días fallados que aún se pueden rescatar (≤ 48 h) */
export function RecoveryBanner({ misses, today }: { misses: RecoverableMiss[]; today: string }) {
  const t = useT();
  const [selected, setSelected] = useState<RecoverableMiss | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (misses.length === 0 && !sentTo) return null;

  return (
    <section className="border border-dashed border-ink-3 px-4 py-4">
      {sentTo && <p className="mb-3 text-sm">{t.risk.sent(sentTo)}</p>}
      {misses.length > 0 && (
        <>
          <p className="eyebrow">{t.risk.title}</p>
          <p className="mt-2 text-sm text-ink-2">{t.risk.body}</p>
          <ul className="mt-3 divide-y divide-line">
            {misses.map((m) => (
              <li key={`${m.habit_id}-${m.missed_date}`} className="flex items-center gap-3 py-2.5">
                <span className="mono w-6 text-center text-lg">{m.habit_icon ?? "·"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{m.habit_name}</span>
                  <span className="text-xs text-ink-3">{t.risk.missed(relativeDay(m.missed_date, today, t))}</span>
                </span>
                <button type="button" onClick={() => setSelected(m)} className="text-sm underline underline-offset-4">
                  {t.risk.ask}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {selected && (
        <RecoverySheet
          miss={selected}
          today={today}
          onClose={() => setSelected(null)}
          onSent={() => {
            setSentTo(selected.partner_name ?? t.common.yourPartner);
            setSelected(null);
          }}
        />
      )}
    </section>
  );
}
