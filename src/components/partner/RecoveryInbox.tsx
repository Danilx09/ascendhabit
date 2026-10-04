"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatShortDate, hoursUntil } from "@/lib/dates";
import { reasonInfo } from "@/lib/habits";
import type { RecoveryRequest, RecoveryStatus } from "@/types/app";

const STATUS: Record<RecoveryStatus, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  approved: { label: "Aprobado", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  rejected: { label: "Rechazado", className: "bg-red-500/15 text-red-600 dark:text-red-400" },
  expired: { label: "Expirado", className: "bg-zinc-500/15 text-zinc-500" },
};

export function RecoveryInbox({
  requests,
  partnerName,
}: {
  requests: RecoveryRequest[];
  partnerName: string;
  today: string;
}) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // La hora actual solo se conoce en el navegador (evita desajustes de hidratación)
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const incoming = requests.filter((r) => r.direction === "incoming" && r.status === "pending");
  const history = requests.filter((r) => !(r.direction === "incoming" && r.status === "pending")).slice(0, 8);

  async function resolve(id: string, approve: boolean) {
    setError(null);
    setBusyId(id);
    const { error } = await supabase.rpc("resolve_streak_recovery", { p_request_id: id, p_approve: approve });
    setBusyId(null);
    if (error) return setError(error.message);
    router.refresh();
  }

  return (
    <>
      {incoming.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            {partnerName} te pide rescatar {incoming.length === 1 ? "una racha" : `${incoming.length} rachas`}
          </h2>
          <ul className="space-y-3">
            {incoming.map((r) => {
              const reason = reasonInfo(r.reason);
              const left = now === null ? null : hoursUntil(r.expires_at, now);
              return (
                <li key={r.id} className="rounded-2xl border-2 border-amber-400/60 bg-amber-50 p-4 dark:bg-amber-500/5">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{r.habit_icon ?? "✨"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{r.habit_name}</p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        Día fallado: {formatShortDate(r.missed_date)} · {reason.emoji} {reason.label}
                      </p>
                      {r.message && (
                        <p className="mt-2 rounded-lg bg-white px-3 py-2 text-sm italic dark:bg-zinc-900">“{r.message}”</p>
                      )}
                      {left !== null && (
                        <p className="mt-2 text-xs text-zinc-500">
                          {left > 0 ? `Expira en ${left} h si no respondes` : "A punto de expirar"}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => resolve(r.id, false)}
                      className="rounded-xl border border-zinc-300 bg-white py-2.5 font-medium disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      Rechazar
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => resolve(r.id, true)}
                      className="rounded-xl bg-emerald-500 py-2.5 font-semibold text-white disabled:opacity-50"
                    >
                      Aprobar rescate
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        </section>
      )}

      {history.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Rescates recientes</h2>
          <ul className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {history.map((r) => {
              const status = STATUS[r.status];
              return (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-lg">{r.habit_icon ?? "✨"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.habit_name}</span>
                    <span className="text-xs text-zinc-500">
                      {r.direction === "outgoing" ? "Pediste" : `Pidió ${partnerName}`} · {formatShortDate(r.missed_date)}
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>
                    {status.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
