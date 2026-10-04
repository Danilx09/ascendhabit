"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { relativeDay } from "@/lib/dates";
import { RECOVERY_REASONS } from "@/lib/habits";
import type { RecoverableMiss, RecoveryReason } from "@/types/app";

export function RecoverySheet({
  miss,
  today,
  onClose,
  onSent,
}: {
  miss: RecoverableMiss;
  today: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [reason, setReason] = useState<RecoveryReason | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const partner = miss.partner_name ?? "tu socio";
  const left = miss.monthly_max - miss.used_this_month;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function send() {
    if (!reason) return;
    setError(null);
    setSending(true);
    const { error } = await supabase.rpc("request_streak_recovery", {
      p_habit_id: miss.habit_id,
      p_missed_date: miss.missed_date,
      p_reason: reason,
      p_message: message.trim() || null,
    });
    setSending(false);
    if (error) return setError(error.message);
    onSent();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="safe-bottom relative w-full max-w-md rounded-t-3xl bg-white p-6 pb-8 shadow-2xl dark:bg-zinc-900">
        <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        <p className="text-sm text-zinc-500">Solicitar rescate de racha</p>
        <h2 className="text-lg font-semibold">
          {miss.habit_icon} {miss.habit_name} · {relativeDay(miss.missed_date, today)}
        </h2>

        <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-zinc-500">Motivo</p>
        <div className="grid grid-cols-2 gap-2">
          {RECOVERY_REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setReason(r.value)}
              className={`rounded-xl border px-3 py-2.5 text-sm transition ${
                reason === r.value
                  ? "border-orange-500 bg-orange-500/10 font-semibold"
                  : "border-zinc-200 dark:border-zinc-700"
              }`}
            >
              {r.emoji} {r.label}
            </button>
          ))}
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={280}
          rows={3}
          placeholder={`Cuéntale a ${partner} qué pasó (opcional)`}
          className="mt-4 w-full resize-none rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none focus:border-orange-500 dark:border-zinc-700 dark:bg-zinc-900"
        />

        <p className="mt-2 text-xs text-zinc-500">
          Te {left === 1 ? "queda 1 rescate" : `quedan ${left} rescates`} este mes para este hábito. {partner} tiene 72 h para responder.
        </p>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

        <button
          type="button"
          disabled={!reason || sending}
          onClick={send}
          className="mt-4 w-full rounded-xl bg-orange-500 py-3 font-semibold text-white disabled:opacity-50"
        >
          {sending ? "Enviando…" : `Enviar a ${partner}`}
        </button>
      </div>
    </div>
  );
}
