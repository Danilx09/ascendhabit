import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatNumber, frequencyLabel, streakLabel, TIME_OF_DAY_LABEL } from "@/lib/habits";
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
  const unit = h.unit ?? (h.goal_type === "duration" ? "min" : "");

  return (
    <div className="space-y-10">
      <Link href="/habits" className="text-sm text-ink-3">
        ← Hábitos
      </Link>

      <header>
        <p className="eyebrow">
          {frequencyLabel(h)} · {TIME_OF_DAY_LABEL[h.time_of_day]}
          {h.goal_type !== "boolean" && ` · ${formatNumber(h.target_value)} ${unit}`}
        </p>
        <h1 className="mt-3 flex items-baseline gap-3 font-serif text-4xl leading-tight tracking-tight">
          <span className="mono text-3xl">{h.icon ?? ""}</span>
          {h.name}
        </h1>
        <p className="mt-2 text-sm text-ink-3">{h.share_with_partner ? "Visible para tu socio" : "Privado"}</p>
        {h.description && <p className="mt-4 text-ink-2">{h.description}</p>}
      </header>

      {h.archived_on && (
        <p className="border-l-2 border-ink pl-3 text-sm text-ink-2">
          Archivado. No aparece en Hoy ni cuenta para tu % ni para el Día Perfecto.
        </p>
      )}

      {/* Indicadores: cifras grandes en serif, etiquetas discretas */}
      <dl className="grid grid-cols-2 border-t border-line">
        <Stat label="Racha actual" value={streakLabel(d.current_streak, d.streak_unit)} />
        <Stat label="Mejor racha" value={streakLabel(d.best_streak, d.streak_unit)} left />
        <Stat
          label={h.frequency_type === "times_per_week" ? "Cumplimiento · 4 sem" : "Cumplimiento · 30 días"}
          value={d.rate_30d === null ? "–" : `${d.rate_30d}%`}
        />
        <Stat
          label="Completados"
          value={String(d.total_done)}
          hint={d.recovered_count > 0 ? `${d.recovered_count} rescatados` : undefined}
          left
        />
      </dl>

      <HabitCalendar detail={d} />

      <HabitActions habitId={h.id} archived={!!h.archived_on} />
    </div>
  );
}

function Stat({ label, value, hint, left = false }: { label: string; value: string; hint?: string; left?: boolean }) {
  return (
    <div className={`border-b border-line py-4 ${left ? "border-l pl-4" : "pr-4"}`}>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-2 font-serif text-3xl tabular-nums">{value}</dd>
      {hint && <dd className="mt-1 text-xs text-ink-3">{hint}</dd>}
    </div>
  );
}
