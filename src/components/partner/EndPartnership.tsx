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
    <div className="border-t border-line pt-6 text-center">
      {since && <p className="text-xs text-ink-3">Socios desde el {formatShortDate(since.slice(0, 10))}</p>}
      {!confirming ? (
        <button type="button" onClick={() => setConfirming(true)} className="mt-2 text-xs text-ink-3 underline underline-offset-4">
          Terminar vínculo con {partnerName}
        </button>
      ) : (
        <div className="mt-4 border border-ink p-4 text-left">
          <p className="text-sm">Las solicitudes pendientes se cancelan y dejaréis de ver el progreso del otro.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setConfirming(false)} className="btn btn-ghost">
              Cancelar
            </button>
            <button type="button" disabled={loading} onClick={end} className="btn btn-primary">
              Terminar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
