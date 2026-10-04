"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatShortDate, hoursUntil } from "@/lib/dates";
import { reasonInfo } from "@/lib/habits";
import type { RecoveryRequest, RecoveryStatus } from "@/types/app";

const STATUS_LABEL: Record<RecoveryStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
  expired: "Expirado",
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
          <h2 className="eyebrow mb-3">
            {partnerName} te pide rescatar {incoming.length === 1 ? "una racha" : `${incoming.length} rachas`}
          </h2>
          <ul className="space-y-3">
            {incoming.map((r) => {
              const reason = reasonInfo(r.reason);
              const left = now === null ? null : hoursUntil(r.expires_at, now);
              return (
                <li key={r.id} className="border border-ink p-5">
                  <p className="font-serif text-xl">{r.habit_name}</p>
                  <p className="mt-1 text-sm text-ink-2">
                    {formatShortDate(r.missed_date)} · {reason.label}
                  </p>
                  {r.message && <p className="mt-3 font-serif italic text-ink-2">“{r.message}”</p>}
                  {left !== null && (
                    <p className="mt-3 text-xs text-ink-3">
                      {left > 0 ? `Expira en ${left} h si no respondes` : "A punto de expirar"}
                    </p>
                  )}
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => resolve(r.id, false)}
                      className="btn btn-ghost"
                    >
                      Rechazar
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => resolve(r.id, true)}
                      className="btn btn-primary"
                    >
                      Aprobar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {error && <p className="mt-3 border-l-2 border-ink pl-3 text-sm">{error}</p>}
        </section>
      )}

      {history.length > 0 && (
        <section>
          <h2 className="eyebrow mb-1">Rescates recientes</h2>
          <ul className="divide-y divide-line border-y border-line">
            {history.map((r) => (
              <li key={r.id} className="flex items-center gap-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{r.habit_name}</span>
                  <span className="text-xs text-ink-3">
                    {r.direction === "outgoing" ? "Pediste" : `Pidió ${partnerName}`} · {formatShortDate(r.missed_date)}
                  </span>
                </span>
                <span
                  className={`shrink-0 text-[11px] uppercase tracking-[0.12em] ${
                    r.status === "approved" ? "text-ink" : r.status === "pending" ? "text-ink-2" : "text-ink-3 line-through"
                  }`}
                >
                  {STATUS_LABEL[r.status]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
