"use client";

import { useState } from "react";
import { relativeDay } from "@/lib/dates";
import { RecoverySheet } from "./RecoverySheet";
import type { RecoverableMiss } from "@/types/app";

/** "Racha en riesgo": días fallados que aún se pueden rescatar (≤ 48 h) */
export function RecoveryBanner({ misses, today }: { misses: RecoverableMiss[]; today: string }) {
  const [selected, setSelected] = useState<RecoverableMiss | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (misses.length === 0 && !sentTo) return null;

  return (
    <section className="rounded-2xl border border-orange-400/50 bg-orange-50 p-4 dark:bg-orange-500/5">
      {sentTo && (
        <p className="mb-3 rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
          Solicitud enviada a {sentTo}. Te avisaremos aquí cuando responda.
        </p>
      )}
      {misses.length > 0 && (
        <>
          <p className="font-semibold">⚠️ Racha en riesgo</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            ¿Tuviste un motivo justificado? Pide a tu socio que la rescate. Tienes 48 h.
          </p>
          <ul className="mt-3 space-y-2">
            {misses.map((m) => (
              <li
                key={`${m.habit_id}-${m.missed_date}`}
                className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 dark:bg-zinc-900"
              >
                <span className="text-xl">{m.habit_icon ?? "✨"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{m.habit_name}</span>
                  <span className="text-xs text-zinc-500">Fallado {relativeDay(m.missed_date, today)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelected(m)}
                  className="shrink-0 rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-semibold text-white"
                >
                  Pedir rescate
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
            setSentTo(selected.partner_name ?? "tu socio");
            setSelected(null);
          }}
        />
      )}
    </section>
  );
}
