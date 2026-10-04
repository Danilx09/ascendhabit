"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatHour } from "@/lib/dates";
import { translateDbError } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";

export function ReminderSettings({
  userId,
  email,
  initialEnabled,
  initialHour,
}: {
  userId: string;
  email: string;
  initialEnabled: boolean;
  initialHour: number;
}) {
  const router = useRouter();
  const t = useT();
  const hourLabel = (h: number) => formatHour(h, t.intl);
  const [supabase] = useState(() => createClient());
  const [enabled, setEnabled] = useState(initialEnabled);
  const [hour, setHour] = useState(initialHour);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(next: { enabled?: boolean; hour?: number }) {
    const e = next.enabled ?? enabled;
    const h = next.hour ?? hour;
    setEnabled(e);
    setHour(h);
    setMessage(null);
    const { error } = await supabase
      .from("profiles")
      .update({ reminder_enabled: e, reminder_hour: h })
      .eq("id", userId);
    if (error) {
      setMessage(translateDbError(error.message, t));
      return;
    }
    setMessage(e ? t.reminders.on(hourLabel(h)) : t.reminders.off);
    router.refresh();
  }

  async function sendTest() {
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.rpc("send_test_reminder");
    setBusy(false);
    setMessage(error ? translateDbError(error.message, t) : t.reminders.testSent(email));
  }

  return (
    <section className="space-y-5">
      <p className="eyebrow">{t.reminders.title}</p>

      <label className="flex cursor-pointer items-start justify-between gap-6 border-y border-line py-4">
        <span>
          <span className="block text-[15px]">{t.reminders.toggle}</span>
          <span className="mt-1 block text-sm text-ink-3">
            {t.reminders.hint}
          </span>
        </span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => save({ enabled: e.target.checked })}
          className="mt-1 h-5 w-5 shrink-0 accent-current"
        />
      </label>

      {enabled && (
        <label className="block">
          <span className="text-sm text-ink-2">{t.reminders.hour}</span>
          <select value={hour} onChange={(e) => save({ hour: Number(e.target.value) })} className="field bg-bg">
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
        </label>
      )}

      <button type="button" onClick={sendTest} disabled={busy} className="btn btn-ghost w-full">
        {busy ? t.common.sending : t.reminders.test}
      </button>
      {message && <p className="text-sm text-ink-2">{message}</p>}
    </section>
  );
}
