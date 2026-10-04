"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatShortDate } from "@/lib/dates";

export function EndPartnership({ partnerName, since }: { partnerName: string; since: string | null }) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function end() {
    setLoading(true);
    const { error } = await supabase.rpc("end_partnership");
    setLoading(false);
    if (!error) router.refresh();
  }

  return (
    <div className="pt-4 text-center">
      {since && <p className="text-xs text-zinc-500">Socios desde el {formatShortDate(since.slice(0, 10))}</p>}
      {!confirming ? (
        <button type="button" onClick={() => setConfirming(true)} className="mt-2 text-xs text-zinc-400 underline">
          Terminar vínculo con {partnerName}
        </button>
      ) : (
        <div className="mt-3 rounded-2xl border border-red-500/30 p-4">
          <p className="text-sm">
            ¿Seguro? Las solicitudes pendientes se cancelan y dejaréis de ver el progreso del otro.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setConfirming(false)} className="rounded-xl border border-zinc-300 py-2 text-sm dark:border-zinc-700">
              Cancelar
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={end}
              className="rounded-xl bg-red-500 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Sí, terminar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
