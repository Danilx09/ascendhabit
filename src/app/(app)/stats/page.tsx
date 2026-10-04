import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { formatShortDate } from "@/lib/dates";
import { streakLabel, WEEKDAYS } from "@/lib/habits";
import { BarChart } from "@/components/stats/BarChart";
import { HabitsTabs } from "@/components/habits/HabitsTabs";
import type { StatsData } from "@/types/app";

export const metadata: Metadata = { title: "Progreso · AscendHabit" };

const WEEKS = 12;

export default async function StatsPage() {
  const supabase = await createClient();
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
  const dayName = (iso: number) => WEEKDAYS.find((w) => w.iso === iso)?.long.toLowerCase() ?? "";
  const hasMood = weekly.some((w) => w.avg_mood !== null);

  return (
    <div className="space-y-12">
      <header className="space-y-6">
        <div>
          <p className="eyebrow">Últimas {WEEKS} semanas</p>
          <h1 className="mt-2 font-serif text-4xl tracking-tight">Progreso</h1>
        </div>
        <HabitsTabs active="stats" />
      </header>

      {weekly.length === 0 ? (
        <p className="border-y border-line py-10 text-center text-sm text-ink-3">
          Aún no hay datos. Vuelve cuando lleves unos días registrando hábitos.
        </p>
      ) : (
        <>
          {/* Resumen */}
          <dl className="grid grid-cols-2 border-t border-line">
            <Stat label="Esta semana" value={thisWeek?.pct === null || !thisWeek ? "–" : `${thisWeek.pct}%`} hint="en curso" />
            <Stat
              label="Tendencia"
              value={delta === null ? "–" : `${delta > 0 ? "↑ +" : delta < 0 ? "↓ " : ""}${delta} pts`}
              hint={last4 === null ? "faltan semanas completas" : `${last4}% en las últimas 4 semanas`}
              left
            />
            <Stat
              label="Días perfectos · 30 d"
              value={`${s.perfect_days_30d}`}
              hint={`de ${s.active_days_30d} días con hábitos`}
            />
            <Stat
              label="Día Perfecto"
              value={streakLabel(s.perfect_day_streak, "days")}
              hint={`mejor racha: ${s.perfect_day_best}`}
              left
            />
          </dl>

          <BarChart
            title="Cumplimiento semanal"
            max={100}
            ticks={[50, 100]}
            formatTick={(n) => `${n}%`}
            labelEvery={3}
            data={weekly.map((w) => ({
              key: w.week_start,
              label: formatShortDate(w.week_start).split(" ").slice(1).join(" "),
              value: w.pct,
              inProgress: w.is_current,
              readout:
                w.pct === null
                  ? `Semana del ${formatShortDate(w.week_start)} · sin hábitos`
                  : `Semana del ${formatShortDate(w.week_start)} · ${w.pct}% (${w.done}/${w.scheduled})${w.is_current ? " · en curso" : ""}`,
            }))}
          />

          {hasMood && (
            <BarChart
              title="Energía media semanal · bitácora"
              max={5}
              ticks={[1, 3, 5]}
              labelEvery={3}
              height={120}
              data={weekly.map((w) => ({
                key: w.week_start,
                label: formatShortDate(w.week_start).split(" ").slice(1).join(" "),
                value: w.avg_mood,
                inProgress: w.is_current,
                readout:
                  w.avg_mood === null
                    ? `Semana del ${formatShortDate(w.week_start)} · sin registro`
                    : `Semana del ${formatShortDate(w.week_start)} · energía ${String(w.avg_mood).replace(".", ",")} de 5 · ${w.journal_days} ${w.journal_days === 1 ? "día" : "días"} de diario`,
              }))}
            />
          )}

          {weekday.length > 0 && (
            <section className="space-y-3">
              <BarChart
                title="Por día de la semana"
                max={100}
                ticks={[50, 100]}
                formatTick={(n) => `${n}%`}
                height={120}
                defaultKey={best ? String(best.isodow) : undefined}
                data={s.weekday.map((d) => ({
                  key: String(d.isodow),
                  label: WEEKDAYS.find((w) => w.iso === d.isodow)?.short ?? "",
                  value: d.pct,
                  readout:
                    d.pct === null
                      ? `${WEEKDAYS.find((w) => w.iso === d.isodow)?.long} · sin hábitos`
                      : `${WEEKDAYS.find((w) => w.iso === d.isodow)?.long} · ${d.pct}% (${d.done}/${d.scheduled})`,
                }))}
              />
              {best && worst && best.isodow !== worst.isodow && (
                <p className="text-sm text-ink-2">
                  Tu mejor día es el <span className="text-ink">{dayName(best.isodow)}</span> ({best.pct}%); el más difícil, el{" "}
                  <span className="text-ink">{dayName(worst.isodow)}</span> ({worst.pct}%).
                </p>
              )}
            </section>
          )}

          {/* Por hábito: tabla con barra fina */}
          {s.habits.length > 0 && (
            <section>
              <p className="eyebrow mb-1">Por hábito · 30 días</p>
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
                      Racha {streakLabel(h.current_streak, h.streak_unit)} · mejor {streakLabel(h.best_streak, h.streak_unit)}
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
