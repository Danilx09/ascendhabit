import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatNumber, frequencyLabel, streakLabel, unitOf } from "@/lib/habits";
import { getT } from "@/lib/i18n/server";
import { pageTitle } from "@/lib/i18n/metadata";
import { HabitCalendar } from "@/components/habits/HabitCalendar";
import { HabitActions } from "@/components/habits/HabitActions";
import type { HabitDetail } from "@/types/app";

export const generateMetadata = pageTitle("detail");

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
  const t = await getT();
  const { data, error } = await supabase.rpc("get_habit_detail", { p_habit_id: id, p_month: validMonth });
  if (error) throw new Error(error.message);
  const d = data as HabitDetail;
  const h = d.habit;
  const unit = unitOf(h);

  return (
    <div className="space-y-10">
      <Link href="/habits" className="text-sm text-ink-3">
        {t.habits.back}
      </Link>

      <header>
        <p className="eyebrow">
          {frequencyLabel(h, t)} · {t.time[h.time_of_day]}
          {h.goal_type !== "boolean" && ` · ${formatNumber(h.target_value, t.intl)} ${unit}`}
        </p>
        <h1 className="mt-3 flex items-baseline gap-3 font-serif text-4xl leading-tight tracking-tight">
          <span className="mono text-3xl">{h.icon ?? ""}</span>
          {h.name}
        </h1>
        <p className="mt-2 text-sm text-ink-3">{h.share_with_partner ? t.detail.visible : t.detail.private}</p>
        {h.description && <p className="mt-4 text-ink-2">{h.description}</p>}
      </header>

      {h.archived_on && (
        <p className="border-l-2 border-ink pl-3 text-sm text-ink-2">
          {t.detail.archivedNote}
        </p>
      )}

      {/* Indicadores: cifras grandes en serif, etiquetas discretas */}
      <dl className="grid grid-cols-2 border-t border-line">
        <Stat label={t.detail.currentStreak} value={streakLabel(d.current_streak, d.streak_unit, t)} />
        <Stat label={t.detail.bestStreak} value={streakLabel(d.best_streak, d.streak_unit, t)} left />
        <Stat
          label={h.frequency_type === "times_per_week" ? t.detail.rate4w : t.detail.rate30}
          value={d.rate_30d === null ? "–" : `${d.rate_30d}%`}
        />
        <Stat
          label={t.detail.completed}
          value={String(d.total_done)}
          hint={d.recovered_count > 0 ? t.detail.recovered(d.recovered_count) : undefined}
          left
        />
      </dl>

      <HabitCalendar detail={d} t={t} />

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
