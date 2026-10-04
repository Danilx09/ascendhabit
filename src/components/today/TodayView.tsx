"use client";

import Link from "next/link";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatLongDate, greeting } from "@/lib/dates";
import { TIME_SLOTS, withValue } from "@/lib/habits";
import { translateDbError } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";
import { HabitCard } from "./HabitCard";
import { ProgressSheet } from "./ProgressSheet";
import { RecoveryBanner } from "./RecoveryBanner";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import type { RecoverableMiss, TodayData, TodayHabit } from "@/types/app";

type Update = { id: string; value: number };

export function TodayView({ data, misses }: { data: TodayData; misses: RecoverableMiss[] }) {
  const router = useRouter();
  const t = useT();
  useRefreshOnFocus();
  const [supabase] = useState(() => createClient());
  const [, startTransition] = useTransition();
  const [habits, applyOptimistic] = useOptimistic(
    data.habits,
    (state: TodayHabit[], u: Update) => state.map((h) => (h.id === u.id ? withValue(h, u.value) : h)),
  );
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // El saludo depende de la hora local: se calcula en el navegador
  const [hello, setHello] = useState(t.greet.hello);
  useEffect(() => setHello(greeting(t)), [t]);

  function setValue(id: string, value: number) {
    setError(null);
    startTransition(async () => {
      applyOptimistic({ id, value });
      const { error } = await supabase.rpc("log_habit", { p_habit_id: id, p_value: value });
      if (error) setError(translateDbError(error.message, t));
      router.refresh();
    });
  }

  const daily = habits.filter((h) => h.frequency_type !== "times_per_week" && h.scheduled_today);
  const doneCount = daily.filter((h) => h.done_today).length;
  const pct = daily.length ? Math.round((100 * doneCount) / daily.length) : 0;
  const allDone = daily.length > 0 && doneCount === daily.length;
  const left = daily.length - doneCount;

  const active = habits.filter((h) => h.scheduled_today);
  const notToday = habits.filter((h) => !h.scheduled_today);
  const sheetHabit = habits.find((h) => h.id === sheetId) ?? null;

  return (
    <div className="space-y-10">
      {/* Cabecera editorial */}
      <header>
        <p className="eyebrow">{formatLongDate(data.today, t.intl)}</p>
        <h1 className="mt-3 font-serif text-[2.1rem] leading-[1.1] tracking-tight">
          {hello}
          {data.display_name ? `, ${data.display_name}` : ""}.
        </h1>
        <p className="mt-2 text-ink-2">
          {daily.length === 0
            ? habits.length === 0
              ? t.today.noHabits
              : t.today.noFixed
            : allDone
              ? t.today.perfect
              : t.today.left(left)}
        </p>

        {daily.length > 0 && (
          <div className="mt-8">
            <div className="flex items-end justify-between">
              <span className="font-serif text-5xl leading-none tabular-nums">{pct}%</span>
              <span className="text-right text-sm text-ink-2">
                {t.today.perfectDay}
                <br />
                <span className="text-ink">{t.units.days(data.perfect_day_streak)}</span>
                <span className="text-ink-3"> · {t.today.best(data.perfect_day_best)}</span>
              </span>
            </div>
            <div className="mt-4 h-px w-full bg-line">
              <div className="h-px bg-ink transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </header>

      {data.pending_recovery_requests > 0 && (
        <Link href="/partner" className="flex items-center justify-between border border-ink px-4 py-3">
          <span className="text-sm">
            <span className="block font-medium">{t.today.partnerNeeds}</span>
            <span className="text-ink-2">{t.today.pendingRequests(data.pending_recovery_requests)}</span>
          </span>
          <span aria-hidden>→</span>
        </Link>
      )}

      <RecoveryBanner misses={misses} today={data.today} />

      {error && <p className="border-l-2 border-ink pl-3 text-sm">{error}</p>}

      {habits.length === 0 && (
        <div className="border-y border-line py-12 text-center">
          <p className="font-serif text-2xl italic">{t.today.blankTitle}</p>
          <p className="mt-2 text-sm text-ink-2">{t.today.blankBody}</p>
          <Link href="/habits/new" className="btn btn-primary mt-6">
            {t.today.createHabit}
          </Link>
        </div>
      )}

      {TIME_SLOTS.map((slot) => {
        const items = active.filter((h) => h.time_of_day === slot);
        if (items.length === 0) return null;
        return (
          <section key={slot}>
            <h2 className="eyebrow mb-1">{t.time[slot]}</h2>
            <ul className="divide-y divide-line border-y border-line">
              {items.map((h) => (
                <li key={h.id}>
                  <HabitCard habit={h} onSetValue={(v) => setValue(h.id, v)} onOpen={() => setSheetId(h.id)} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {notToday.length > 0 && (
        <details className="group">
          <summary className="eyebrow cursor-pointer list-none">
            {t.today.notToday(notToday.length)} <span className="inline-block transition group-open:rotate-90">›</span>
          </summary>
          <ul className="mt-1 divide-y divide-line border-y border-line opacity-50">
            {notToday.map((h) => (
              <li key={h.id}>
                <HabitCard habit={h} disabled onSetValue={() => {}} onOpen={() => setSheetId(h.id)} />
              </li>
            ))}
          </ul>
        </details>
      )}

      {sheetHabit && (
        <ProgressSheet
          habit={sheetHabit}
          onClose={() => setSheetId(null)}
          onSave={(v) => {
            setValue(sheetHabit.id, v);
            setSheetId(null);
          }}
        />
      )}
    </div>
  );
}
