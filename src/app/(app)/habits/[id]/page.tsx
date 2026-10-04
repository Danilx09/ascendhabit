import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BRAND_COLOR, formatNumber, frequencyLabel, streakLabel, TIME_OF_DAY_LABEL } from "@/lib/habits";
import { HabitCalendar } from "@/components/habits/HabitCalendar";
import { HabitActions } from "@/components/habits/HabitActions";
import type { HabitDetail } from "@/types/app";

export const metadata: Metadata = { title: "Detalle · AscendHabit" };

export default async function HabitDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { id } = await params;
  const { month } = await searchParams;
  const validMonth = month && /^\d{4}-\d{2}-01$/.test(month) ? month : null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_habit_detail", { p_habit_id: id, p_month: validMonth });
  if (error) throw new Error(error.message);
  const d = data as HabitDetail;
  const h = d.habit;
  const color = h.color ?? BRAND_COLOR;
  const unit = h.unit ?? (h.goal_type === "duration" ? "min" : "");

  return (
    <div className="space-y-6">
      <Link href="/habits" className="text-sm text-zinc-500">
        ‹ Hábitos
      </Link>

      <header className="flex items-start gap-4">
        <span
          className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-3xl"
          style={{ backgroundColor: `${color}22` }}
        >
          {h.icon ?? "✨"}
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{h.name}</h1>
          <p className="text-sm text-zinc-500">
            {frequencyLabel(h)} · {TIME_OF_DAY_LABEL[h.time_of_day]}
            {h.goal_type !== "boolean" && ` · ${formatNumber(h.target_value)} ${unit}`}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {h.share_with_partner ? "👀 Visible para tu socio" : "🔒 Privado"}
          </p>
        </div>
      </header>

      {h.archived_on && (
        <p className="rounded-xl bg-zinc-100 px-4 py-3 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          Archivado. No aparece en Hoy ni cuenta para tu % ni para el Día Perfecto.
        </p>
      )}

      {/* Indicadores: valores en tinta de texto, nunca en el color del hábito */}
      <dl className="grid grid-cols-2 gap-2">
        <Stat label="Racha actual" value={streakLabel(d.current_streak, d.streak_unit)} icon="🔥" />
        <Stat label="Mejor racha" value={streakLabel(d.best_streak, d.streak_unit)} icon="🏆" />
        <Stat
          label={h.frequency_type === "times_per_week" ? "Cumplimiento (4 semanas)" : "Cumplimiento (30 días)"}
          value={d.rate_30d === null ? "–" : `${d.rate_30d}%`}
          icon="📈"
        />
        <Stat
          label="Total completados"
          value={String(d.total_done)}
          hint={d.recovered_count > 0 ? `${d.recovered_count} rescatados` : undefined}
          icon="✅"
        />
      </dl>

      <HabitCalendar detail={d} />

      {h.description && <p className="text-sm text-zinc-500">{h.description}</p>}

      <HabitActions habitId={h.id} archived={!!h.archived_on} />
    </div>
  );
}

function Stat({ label, value, hint, icon }: { label: string; value: string; hint?: string; icon: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <dt className="text-xs text-zinc-500">
        <span aria-hidden>{icon} </span>
        {label}
      </dt>
      <dd className="mt-1 text-xl font-bold">{value}</dd>
      {hint && <dd className="text-xs text-zinc-500">{hint}</dd>}
    </div>
  );
}
