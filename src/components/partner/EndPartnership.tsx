"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatShortDate } from "@/lib/dates";
import { useT } from "@/lib/i18n/client";

export function EndPartnership({ partnerName, since }: { partnerName: string; since: string | null }) {
  const router = useRouter();
  const t = useT();
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
      {since && <p className="text-xs text-ink-3">{t.endPartner.since(formatShortDate(since.slice(0, 10), t.intl))}</p>}
      {!confirming ? (
        <button type="button" onClick={() => setConfirming(true)} className="mt-2 text-xs text-ink-3 underline underline-offset-4">
          {t.endPartner.endWith(partnerName)}
        </button>
      ) : (
        <div className="mt-4 border border-ink p-4 text-left">
          <p className="text-sm">{t.endPartner.warn}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setConfirming(false)} className="btn btn-ghost">
              {t.common.cancel}
            </button>
            <button type="button" disabled={loading} onClick={end} className="btn btn-primary">
              {t.endPartner.end}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
