"use client";

import Link from "next/link";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatLongDate, greeting } from "@/lib/dates";
import { TIME_OF_DAY_LABEL, withValue } from "@/lib/habits";
import { ProgressRing } from "@/components/ui/ProgressRing";
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
  // El saludo depende de la hora local: se calcula en el navegador para no
  // chocar con el render del servidor (que corre en UTC).
  const [hello, setHello] = useState("Hola");
  useEffect(() => setHello(greeting()), []);

  function setValue(id: string, value: number) {
    setError(null);
    startTransition(async () => {
      applyOptimistic({ id, value });
      const { error } = await supabase.rpc("log_habit", { p_habit_id: id, p_value: value });
      if (error) setError(error.message);
      router.refresh(); // recalcula rachas y Día Perfecto en el servidor
    });
  }

  // Progreso del día: hábitos con día fijo programados hoy (igual que el servidor)
  const daily = habits.filter((h) => h.frequency_type !== "times_per_week" && h.scheduled_today);
  const doneCount = daily.filter((h) => h.done_today).length;
  const pct = daily.length ? Math.round((100 * doneCount) / daily.length) : 0;
  const allDone = daily.length > 0 && doneCount === daily.length;

  const active = habits.filter((h) => h.scheduled_today);
  const notToday = habits.filter((h) => !h.scheduled_today);
  const sheetHabit = habits.find((h) => h.id === sheetId) ?? null;

  return (
    <div className="space-y-6">
      {/* Cabecera / check-in del día */}
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-zinc-500">{formatLongDate(data.today)}</p>
          <h1 className="truncate text-2xl font-bold tracking-tight">
            {hello}
            {data.display_name ? `, ${data.display_name}` : ""}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {daily.length === 0
              ? habits.length === 0
                ? "Empieza creando tu primer hábito."
                : "Hoy no tienes hábitos con día fijo."
              : allDone
                ? "¡Día perfecto! 🎉"
                : `Te ${daily.length - doneCount === 1 ? "falta 1 hábito" : `faltan ${daily.length - doneCount} hábitos`}`}
          </p>
        </div>
        <ProgressRing pct={pct}>
          <span className="text-sm font-bold">{daily.length ? `${pct}%` : "–"}</span>
        </ProgressRing>
      </header>

      {/* Racha de Día Perfecto */}
      {habits.length > 0 && (
        <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-brand-600 to-violet-600 px-4 py-3 text-white shadow-lg shadow-brand-600/20">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-white/70">Racha de Día Perfecto</p>
            <p className="text-2xl font-bold">
              🔥 {data.perfect_day_streak} {data.perfect_day_streak === 1 ? "día" : "días"}
            </p>
          </div>
          <p className="text-right text-xs text-white/70">
            Mejor
            <br />
            <span className="text-base font-semibold text-white">{data.perfect_day_best}</span>
          </p>
        </div>
      )}

      {/* Solicitudes de rescate que esperan tu respuesta */}
      {data.pending_recovery_requests > 0 && (
        <Link
          href="/partner"
          className="flex items-center gap-3 rounded-2xl border-2 border-amber-400/60 bg-amber-50 px-4 py-3 dark:bg-amber-500/5"
        >
          <span className="text-2xl">🛟</span>
          <span className="flex-1 text-sm">
            <span className="block font-semibold">Tu socio necesita tu ayuda</span>
            {data.pending_recovery_requests === 1
              ? "Tienes 1 solicitud de rescate pendiente"
              : `Tienes ${data.pending_recovery_requests} solicitudes de rescate pendientes`}
          </span>
          <span className="text-zinc-400">›</span>
        </Link>
      )}

      <RecoveryBanner misses={misses} today={data.today} />

      {error && (
        <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Estado vacío */}
      {habits.length === 0 && (
        <div className="rounded-3xl border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700">
          <p className="text-4xl">🌱</p>
          <p className="mt-3 font-semibold">Todavía no tienes hábitos</p>
          <p className="mt-1 text-sm text-zinc-500">Empieza con una plantilla o crea uno a tu medida.</p>
          <Link
            href="/habits/new"
            className="mt-5 inline-block rounded-xl bg-brand-600 px-5 py-2.5 font-semibold text-white"
          >
            Crear hábito
          </Link>
        </div>
      )}

      {/* Hábitos de hoy agrupados por momento del día */}
      {SECTION_ORDER.map((slot) => {
        const items = active.filter((h) => h.time_of_day === slot);
        if (items.length === 0) return null;
        return (
          <section key={slot}>
            <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {TIME_OF_DAY_LABEL[slot]}
            </h2>
            <ul className="space-y-2">
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
          <summary className="cursor-pointer list-none px-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Hoy no toca ({notToday.length}) <span className="inline-block transition group-open:rotate-90">›</span>
          </summary>
          <ul className="mt-2 space-y-2 opacity-60">
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
