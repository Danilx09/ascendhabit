"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { relativeDay } from "@/lib/dates";
import { RECOVERY_REASONS } from "@/lib/habits";
import { Sheet } from "@/components/ui/Sheet";
import { translateDbError } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";
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
  const t = useT();
  const [supabase] = useState(() => createClient());
  const [reason, setReason] = useState<RecoveryReason | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const partner = miss.partner_name ?? t.common.yourPartner;
  const left = miss.monthly_max - miss.used_this_month;

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
    if (error) return setError(translateDbError(error.message, t));
    onSent();
    router.refresh();
  }

  return (
    <Sheet onClose={onClose}>
      <p className="eyebrow">{t.recovery.eyebrow}</p>
      <h2 className="mt-2 font-serif text-2xl">
        {miss.habit_name}, {relativeDay(miss.missed_date, today, t)}
      </h2>

      <p className="eyebrow mb-3 mt-8">{t.recovery.reason}</p>
      <div className="grid grid-cols-2 gap-2">
        {RECOVERY_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReason(r)}
            className={`border px-3 py-2.5 text-sm transition ${
              reason === r ? "border-ink bg-ink text-bg" : "border-line text-ink-2"
            }`}
          >
            {t.recovery.reasons[r]}
          </button>
        ))}
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={280}
        rows={3}
        placeholder={t.recovery.messagePh(partner)}
        className="field mt-6 resize-none"
      />

      <p className="mt-3 text-xs text-ink-3">{t.recovery.left(left, partner.charAt(0).toUpperCase() + partner.slice(1))}</p>
      {error && <p className="mt-3 border-l-2 border-ink pl-3 text-sm">{error}</p>}

      <button type="button" disabled={!reason || sending} onClick={send} className="btn btn-primary mt-6 w-full">
        {sending ? t.common.sending : t.recovery.send(partner)}
      </button>
    </Sheet>
  );
}
