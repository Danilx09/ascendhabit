"use client";

import Link from "next/link";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatLongDate, greeting } from "@/lib/dates";
import { TIME_OF_DAY_LABEL, withValue } from "@/lib/habits";
import { HabitCard } from "./HabitCard";
import { ProgressSheet } from "./ProgressSheet";
import { RecoveryBanner } from "./RecoveryBanner";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import type { RecoverableMiss, TimeOfDay, TodayData, TodayHabit } from "@/types/app";

const SECTION_ORDER: TimeOfDay[] = ["morning", "afternoon", "evening", "anytime"];

type Update = { id: string; value: number };

export function TodayView({ data, misses }: { data: TodayData; misses: RecoverableMiss[] }) {
  const router = useRouter();
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
  const [hello, setHello] = useState("Hola");
  useEffect(() => setHello(greeting()), []);

  function setValue(id: string, value: number) {
    setError(null);
    startTransition(async () => {
      applyOptimistic({ id, value });
      const { error } = await supabase.rpc("log_habit", { p_habit_id: id, p_value: value });
      if (error) setError(error.message);
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
        <p className="eyebrow">{formatLongDate(data.today)}</p>
        <h1 className="mt-3 font-serif text-[2.1rem] leading-[1.1] tracking-tight">
          {hello}
          {data.display_name ? `, ${data.display_name}` : ""}.
        </h1>
        <p className="mt-2 text-ink-2">
          {daily.length === 0
            ? habits.length === 0
              ? "Empieza creando tu primer hábito."
              : "Hoy no tienes hábitos con día fijo."
            : allDone
              ? "Día perfecto. Todo hecho."
              : `${left === 1 ? "Queda 1 hábito" : `Quedan ${left} hábitos`} por hoy.`}
        </p>

        {daily.length > 0 && (
          <div className="mt-8">
            <div className="flex items-end justify-between">
              <span className="font-serif text-5xl leading-none tabular-nums">{pct}%</span>
              <span className="text-right text-sm text-ink-2">
                Día Perfecto
                <br />
                <span className="text-ink">
                  {data.perfect_day_streak} {data.perfect_day_streak === 1 ? "día" : "días"}
                </span>
                <span className="text-ink-3"> · mejor {data.perfect_day_best}</span>
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
            <span className="block font-medium">Tu socio necesita tu respuesta</span>
            <span className="text-ink-2">
              {data.pending_recovery_requests === 1
                ? "1 solicitud de rescate pendiente"
                : `${data.pending_recovery_requests} solicitudes de rescate pendientes`}
            </span>
          </span>
          <span aria-hidden>→</span>
        </Link>
      )}

      <RecoveryBanner misses={misses} today={data.today} />

      {error && <p className="border-l-2 border-ink pl-3 text-sm">{error}</p>}

      {habits.length === 0 && (
        <div className="border-y border-line py-12 text-center">
          <p className="font-serif text-2xl italic">Una página en blanco.</p>
          <p className="mt-2 text-sm text-ink-2">Empieza con una plantilla o crea un hábito a tu medida.</p>
          <Link href="/habits/new" className="btn btn-primary mt-6">
            Crear hábito
          </Link>
        </div>
      )}

      {SECTION_ORDER.map((slot) => {
        const items = active.filter((h) => h.time_of_day === slot);
        if (items.length === 0) return null;
        return (
          <section key={slot}>
            <h2 className="eyebrow mb-1">{TIME_OF_DAY_LABEL[slot]}</h2>
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
            Hoy no toca ({notToday.length}) <span className="inline-block transition group-open:rotate-90">›</span>
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
