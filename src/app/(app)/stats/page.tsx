import { createClient } from "@/lib/supabase/server";
import { formatDayMonth, formatShortDate } from "@/lib/dates";
import { streakLabel } from "@/lib/habits";
import { getT } from "@/lib/i18n/server";
import { pageTitle } from "@/lib/i18n/metadata";
import { BarChart } from "@/components/stats/BarChart";
import { HabitsTabs } from "@/components/habits/HabitsTabs";
import type { StatsData } from "@/types/app";

export const generateMetadata = pageTitle("stats");

const WEEKS = 12;

export default async function StatsPage() {
  const supabase = await createClient();
  const t = await getT();
  const sd = (d: string) => formatShortDate(d, t.intl);
  const dm = (d: string) => formatDayMonth(d, t.intl);
  const dayLong = (iso: number) => t.weekdays.long[iso - 1];
  const { data, error } = await supabase.rpc("get_stats", { p_weeks: WEEKS });
  if (error) throw new Error(error.message);
  const s = data as StatsData;

  // Semanas con datos (desde que existe el primer hábito)
  const weekly = s.weekly.filter((w, i) => w.scheduled > 0 || s.weekly.slice(0, i).some((p) => p.scheduled > 0));
  const thisWeek = s.weekly.find((w) => w.is_current);

  // Tendencia: últimas 4 semanas completas vs las 4 anteriores
  const complete = weekly.filter((w) => !w.is_current && w.scheduled > 0);
  const avg = (ws: typeof complete) => {
    const sch = ws.reduce((a, w) => a + w.scheduled, 0);
    return sch ? Math.round((100 * ws.reduce((a, w) => a + w.done, 0)) / sch) : null;
  };
  const last4 = avg(complete.slice(-4));
  const prev4 = avg(complete.slice(-8, -4));
  const delta = last4 !== null && prev4 !== null ? last4 - prev4 : null;

  const weekday = s.weekday.filter((d) => d.pct !== null);
  const best = weekday.length ? weekday.reduce((a, b) => (b.pct! > a.pct! ? b : a)) : null;
  const worst = weekday.length ? weekday.reduce((a, b) => (b.pct! < a.pct! ? b : a)) : null;
  const dayName = (iso: number) => (t.intl === "es" ? dayLong(iso).toLowerCase() : dayLong(iso));
  const hasMood = weekly.some((w) => w.avg_mood !== null);

  return (
    <div className="space-y-12">
      <header className="space-y-6">
        <div>
          <p className="eyebrow">{t.stats.weeks(WEEKS)}</p>
          <h1 className="mt-2 font-serif text-4xl tracking-tight">{t.stats.title}</h1>
        </div>
        <HabitsTabs active="stats" />
      </header>

      {weekly.length === 0 ? (
        <p className="border-y border-line py-10 text-center text-sm text-ink-3">
          {t.stats.empty}
        </p>
      ) : (
        <>
          {/* Resumen */}
          <dl className="grid grid-cols-2 border-t border-line">
            <Stat label={t.stats.thisWeek} value={thisWeek?.pct === null || !thisWeek ? "–" : `${thisWeek.pct}%`} hint={t.stats.inProgress} />
            <Stat
              label={t.stats.trend}
              value={delta === null ? "–" : `${delta > 0 ? "↑ +" : delta < 0 ? "↓ " : ""}${delta} pts`}
              hint={last4 === null ? t.stats.noComplete : t.stats.trendHint(last4)}
              left
            />
            <Stat
              label={t.stats.perfect30}
              value={`${s.perfect_days_30d}`}
              hint={t.stats.ofDays(s.active_days_30d)}
            />
            <Stat
              label={t.stats.perfectDay}
              value={streakLabel(s.perfect_day_streak, "days", t)}
              hint={t.stats.bestStreak(s.perfect_day_best)}
              left
            />
          </dl>

          <BarChart
            title={t.stats.weekly}
            max={100}
            ticks={[50, 100]}
            formatTick={(n) => `${n}%`}
            labelEvery={3}
            data={weekly.map((w) => ({
              key: w.week_start,
              label: dm(w.week_start),
              value: w.pct,
              inProgress: w.is_current,
              readout:
                w.pct === null
                  ? `${t.stats.weekOf(sd(w.week_start))} · ${t.stats.noHabits}`
                  : `${t.stats.weekOf(sd(w.week_start))} · ${w.pct}% (${w.done}/${w.scheduled})${w.is_current ? ` · ${t.stats.inProgress}` : ""}`,
            }))}
          />

          {hasMood && (
            <BarChart
              title={t.stats.energyTitle}
              max={5}
              ticks={[1, 3, 5]}
              labelEvery={3}
              height={120}
              data={weekly.map((w) => ({
                key: w.week_start,
                label: dm(w.week_start),
                value: w.avg_mood,
                inProgress: w.is_current,
                readout:
                  w.avg_mood === null
                    ? `${t.stats.weekOf(sd(w.week_start))} · ${t.stats.noRecord}`
                    : `${t.stats.weekOf(sd(w.week_start))} · ${t.stats.energyReadout(w.avg_mood.toLocaleString(t.intl), w.journal_days)}`,
              }))}
            />
          )}

          {weekday.length > 0 && (
            <section className="space-y-3">
              <BarChart
                title={t.stats.byWeekday}
                max={100}
                ticks={[50, 100]}
                formatTick={(n) => `${n}%`}
                height={120}
                defaultKey={best ? String(best.isodow) : undefined}
                data={s.weekday.map((d) => ({
                  key: String(d.isodow),
                  label: t.weekdays.short[d.isodow - 1],
                  value: d.pct,
                  readout:
                    d.pct === null
                      ? `${dayLong(d.isodow)} · ${t.stats.noHabits}`
                      : `${dayLong(d.isodow)} · ${d.pct}% (${d.done}/${d.scheduled})`,
                }))}
              />
              {best && worst && best.isodow !== worst.isodow && (
                <p className="text-sm text-ink-2">
                  {t.stats.bestDay(dayName(best.isodow), best.pct!, dayName(worst.isodow), worst.pct!)}
                </p>
              )}
            </section>
          )}

          {/* Por hábito: tabla con barra fina */}
          {s.habits.length > 0 && (
            <section>
              <p className="eyebrow mb-1">{t.stats.byHabit}</p>
              <ul className="divide-y divide-line border-y border-line">
                {s.habits.map((h) => (
                  <li key={h.id} className="py-3.5">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="flex min-w-0 items-baseline gap-3">
                        <span className="mono w-5 text-center">{h.icon ?? "·"}</span>
                        <span className="truncate text-[15px]">{h.name}</span>
                      </span>
                      <span className="shrink-0 font-serif text-lg tabular-nums">{h.rate_30d === null ? "–" : `${h.rate_30d}%`}</span>
                    </div>
                    <div className="ml-8 mt-2 h-px bg-line">
                      <div className="h-px bg-ink" style={{ width: `${h.rate_30d ?? 0}%` }} />
                    </div>
                    <p className="ml-8 mt-1.5 text-xs text-ink-3">
                      {t.stats.habitStreak(streakLabel(h.current_streak, h.streak_unit, t), streakLabel(h.best_streak, h.streak_unit, t))}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
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
